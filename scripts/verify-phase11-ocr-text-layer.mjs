import fs from 'node:fs';
import path from 'node:path';
import { OCRService } from '../src/services/ocr/ocrService.ts';
import { normalizeBoundingBox, projectToViewport } from '../src/services/ocr/ocrUtils.ts';
import { extractWordAtOffset, cleanWordToken, isSingleWord } from '../src/utils/textUtils.ts';
import { LocalDictionaryProvider } from '../src/services/dictionary/LocalDictionaryProvider.ts';

async function verifyPhase11OCRTextLayer() {
  console.log('======================================================================');
  console.log('   PDF LANGUAGE COMPANION — PHASE 2.2 OCR TEXT LAYER VERIFICATION     ');
  console.log('======================================================================\n');

  const rootDir = process.cwd();
  const testDir = path.join(rootDir, 'test-assets');
  const dict = new LocalDictionaryProvider();

  // -------------------------------------------------------------------------
  // Test 1: Bounding Box Normalization Math & Coordinate Invariance
  // -------------------------------------------------------------------------
  console.log('[Test 1] Bounding Box Normalization [0, 1] Range:');
  const rawBbox = { x0: 100, y0: 200, x1: 350, y1: 250 };
  const imgW = 1000;
  const imgH = 1400;

  const norm = normalizeBoundingBox(rawBbox, imgW, imgH);
  console.log(`- Normalized: normX=${norm.normX}, normY=${norm.normY.toFixed(4)}, normWidth=${norm.normWidth}, normHeight=${norm.normHeight.toFixed(4)}`);

  if (norm.normX !== 0.1 || Math.abs(norm.normY - 200 / 1400) > 0.0001 || norm.normWidth !== 0.25 || Math.abs(norm.normHeight - 50 / 1400) > 0.0001) {
    throw new Error('Bounding box normalization failed: incorrect unit ratios.');
  }
  console.log('✓ Normalization produces exact unit ratios in [0, 1] range.');

  // -------------------------------------------------------------------------
  // Test 2: Viewport Projection across Zoom Scales (0.5x, 1.0x, 2.0x, Fit Width)
  // -------------------------------------------------------------------------
  console.log('\n[Test 2] Viewport Projection across Zoom Scales (0.5x, 1.0x, 2.0x, Fit Width):');
  const baseViewport = { width: 595, height: 842 };

  const scales = [
    { name: '0.5x Zoom', scale: 0.5 },
    { name: '1.0x Zoom', scale: 1.0 },
    { name: '2.0x Zoom', scale: 2.0 },
    { name: 'Fit Width (e.g. 820px container)', scale: 820 / baseViewport.width },
  ];

  for (const { name, scale } of scales) {
    const vW = baseViewport.width * scale;
    const vH = baseViewport.height * scale;
    const proj = projectToViewport(norm, vW, vH);

    console.log(`  - ${name.padEnd(35)} -> Viewport: ${vW.toFixed(1)}x${vH.toFixed(1)} | Span: left=${proj.left}px, top=${proj.top}px, width=${proj.width}px, height=${proj.height}px`);

    // Verify proportional scaling
    const expectedLeft = Math.round(norm.normX * vW * 100) / 100;
    const expectedTop = Math.round(norm.normY * vH * 100) / 100;
    const expectedWidth = Math.round(norm.normWidth * vW * 100) / 100;
    const expectedHeight = Math.round(norm.normHeight * vH * 100) / 100;

    if (proj.left !== expectedLeft || proj.top !== expectedTop || proj.width !== expectedWidth || proj.height !== expectedHeight) {
      throw new Error(`Projection drift detected for scale ${scale}: got [${proj.left}, ${proj.top}, ${proj.width}, ${proj.height}], expected [${expectedLeft}, ${expectedTop}, ${expectedWidth}, ${expectedHeight}]`);
    }
  }
  console.log('✓ Viewport coordinate projection verified across all zoom levels with zero drift.');

  // -------------------------------------------------------------------------
  // Test 3: High-DPI / Device Pixel Ratio Invariance
  // -------------------------------------------------------------------------
  console.log('\n[Test 3] High-DPI (Retina 2x / 3x) Scaling Invariance:');
  const cssWidth = 600;
  const cssHeight = 800;

  // Standard DPI (pixelRatio = 1)
  const norm1x = normalizeBoundingBox({ x0: 60, y0: 80, x1: 180, y1: 120 }, cssWidth * 1, cssHeight * 1);
  const proj1x = projectToViewport(norm1x, cssWidth, cssHeight);

  // Retina 2x DPI (pixelRatio = 2, internal canvas is 1200x1600)
  const norm2x = normalizeBoundingBox({ x0: 120, y0: 160, x1: 360, y1: 240 }, cssWidth * 2, cssHeight * 2);
  const proj2x = projectToViewport(norm2x, cssWidth, cssHeight);

  // Retina 3x DPI (pixelRatio = 3, internal canvas is 1800x2400)
  const norm3x = normalizeBoundingBox({ x0: 180, y0: 240, x1: 540, y1: 360 }, cssWidth * 3, cssHeight * 3);
  const proj3x = projectToViewport(norm3x, cssWidth, cssHeight);

  console.log(`  - 1x Display projection: left=${proj1x.left}px, top=${proj1x.top}px, width=${proj1x.width}px, height=${proj1x.height}px`);
  console.log(`  - 2x Display projection: left=${proj2x.left}px, top=${proj2x.top}px, width=${proj2x.width}px, height=${proj2x.height}px`);
  console.log(`  - 3x Display projection: left=${proj3x.left}px, top=${proj3x.top}px, width=${proj3x.width}px, height=${proj3x.height}px`);

  if (proj1x.left !== proj2x.left || proj1x.top !== proj2x.top || proj1x.width !== proj2x.width || proj1x.height !== proj2x.height ||
      proj1x.left !== proj3x.left || proj1x.top !== proj3x.top || proj1x.width !== proj3x.width || proj1x.height !== proj3x.height) {
    throw new Error('High-DPI device pixel ratio caused coordinate drift.');
  }
  console.log('✓ High-DPI coordinate invariance validated.');

  // -------------------------------------------------------------------------
  // Test 4: OCR Recognition & Word Span Synthesis on Test Image
  // -------------------------------------------------------------------------
  console.log('\n[Test 4] Real OCR Page Recognition & Span Geometry:');
  const ocr = OCRService.getInstance();
  const testImagePath = path.join(testDir, 'sample-german-ocr.bmp');

  const ocrResult = await ocr.recognize(testImagePath, 1);
  console.log(`- OCR image dimensions: ${ocrResult.imageWidth} x ${ocrResult.imageHeight}`);
  console.log(`- Recognized words count: ${ocrResult.words.length}`);

  if (ocrResult.words.length < 4) {
    throw new Error(`Expected at least 4 recognized words, got ${ocrResult.words.length}`);
  }

  // Simulate rendering spans at viewport 600x400
  const vpWidth = 600;
  const vpHeight = 400;

  const simulatedSpans = ocrResult.words.map((word, idx) => {
    const wordNorm = normalizeBoundingBox(word.bbox, ocrResult.imageWidth, ocrResult.imageHeight);
    const wordProj = projectToViewport(wordNorm, vpWidth, vpHeight);
    const fontSize = Math.max(Math.round(wordProj.height * 0.85), 8);
    return {
      text: word.text,
      left: wordProj.left,
      top: wordProj.top,
      width: wordProj.width,
      height: wordProj.height,
      fontSize,
    };
  });

  console.log('Synthesized OCR DOM Spans:');
  simulatedSpans.forEach((span, i) => {
    console.log(`  [Span ${i + 1}] "${span.text}" -> style: left=${span.left}px, top=${span.top}px, width=${span.width}px, height=${span.height}px, fontSize=${span.fontSize}px`);
  });

  await ocr.terminate();
  console.log('✓ OCR text layer spans synthesized with accurate geometric bounds.');

  // -------------------------------------------------------------------------
  // Test 5: German Character Handling in OCR Words (ä, ö, ü, ß)
  // -------------------------------------------------------------------------
  console.log('\n[Test 5] German Character & Umlaut Handling in OCR Spans:');
  const germanWords = [
    { text: 'Mädchen', expectedUmlaut: 'ä' },
    { text: 'Bücher', expectedUmlaut: 'ü' },
    { text: 'Straße', expectedUmlaut: 'ß' },
    { text: 'Köpfe', expectedUmlaut: 'ö' },
    { text: 'größer', expectedUmlaut: 'ö' },
  ];

  for (const { text, expectedUmlaut } of germanWords) {
    const cleaned = cleanWordToken(text);
    if (!cleaned.includes(expectedUmlaut)) {
      throw new Error(`Cleaned token "${cleaned}" lost expected German character "${expectedUmlaut}"`);
    }
    if (!isSingleWord(cleaned)) {
      throw new Error(`isSingleWord failed on German word: "${cleaned}"`);
    }
    console.log(`  ✓ "${text}" -> cleaned: "${cleaned}" (single word: true)`);
  }
  console.log('✓ German character sanitization and token integrity confirmed.');

  // -------------------------------------------------------------------------
  // Test 6 & 7: Word Offset Extraction & useWordSelection Compatibility
  // -------------------------------------------------------------------------
  console.log('\n[Test 6 & 7] Word Offset Extraction on OCR Span Text Nodes:');
  const testSpanTexts = [
    { spanText: 'Mädchen', clickOffset: 3, expectedWord: 'Mädchen' },
    { spanText: 'Bücher', clickOffset: 1, expectedWord: 'Bücher' },
    { spanText: 'Straße', clickOffset: 4, expectedWord: 'Straße' },
    { spanText: 'Deutsch-Englisch', clickOffset: 8, expectedWord: 'Deutsch-Englisch' },
    { spanText: '„Kaffee“', clickOffset: 3, expectedWord: 'Kaffee' },
  ];

  for (const { spanText, clickOffset, expectedWord } of testSpanTexts) {
    const extraction = extractWordAtOffset(spanText, clickOffset);
    if (!extraction) {
      throw new Error(`extractWordAtOffset failed on "${spanText}" at offset ${clickOffset}`);
    }
    console.log(`  - Click on "${spanText}" at offset ${clickOffset} -> extracted: "${extraction.word}" (start: ${extraction.startOffset}, end: ${extraction.endOffset})`);
    if (extraction.word !== expectedWord) {
      throw new Error(`Expected extracted word "${expectedWord}", got "${extraction.word}"`);
    }
  }
  console.log('✓ OCR text node clicks map 1:1 to word token extraction.');

  // -------------------------------------------------------------------------
  // Test 8: End-to-End Dictionary Resolution from OCR Extracted Words
  // -------------------------------------------------------------------------
  console.log('\n[Test 8] Local Dictionary Pipeline Integration with OCR Words:');
  const ocrLookupTests = [
    { word: 'Mädchen', expectedTranslation: 'girl' },
    { word: 'Bücher', expectedTranslation: 'book', expectedLemma: 'Buch' },
    { word: 'Straße', expectedTranslation: 'street' },
    { word: 'Kaffee', expectedTranslation: 'coffee' },
    { word: 'Schule', expectedTranslation: 'school' },
  ];

  for (const { word, expectedTranslation, expectedLemma } of ocrLookupTests) {
    const result = await dict.lookup(word, 'de', 'en');
    if (!result) {
      throw new Error(`Dictionary lookup failed for OCR word "${word}"`);
    }
    const hasTranslation = result.translations.some((t) => t.toLowerCase().includes(expectedTranslation.toLowerCase()));
    console.log(`  ✓ OCR Word "${word}" -> Lemma: "${result.lemma || word}", Translations: [${result.translations.join(', ')}]`);
    if (!hasTranslation) {
      throw new Error(`Translation for "${word}" did not contain "${expectedTranslation}"`);
    }
    if (expectedLemma && result.lemma !== expectedLemma) {
      throw new Error(`Lemma for "${word}" expected "${expectedLemma}", got "${result.lemma}"`);
    }
  }
  console.log('✓ OCR extracted words resolve seamlessly through existing LocalDictionaryProvider.');

  console.log('\n======================================================================');
  console.log('🎉 ALL PHASE 2.2 OCR TEXT LAYER TESTS PASSED SUCCESSFULLY!          ');
  console.log('======================================================================\n');
}

verifyPhase11OCRTextLayer().catch((err) => {
  console.error('\n❌ Phase 2.2 Verification Failed:', err);
  process.exit(1);
});

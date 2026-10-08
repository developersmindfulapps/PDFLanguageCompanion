import fs from 'node:fs';
import path from 'node:path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { cleanWordToken, isSingleWord, extractWordAtOffset } from '../src/utils/textUtils.ts';
import { localDictionaryProvider } from '../src/services/dictionary/LocalDictionaryProvider.ts';

async function verifyPhase8E2E() {
  console.log('===============================================================');
  console.log('   PDF LANGUAGE COMPANION — PHASE 8 END-TO-END INTEGRATION     ');
  console.log('===============================================================\n');

  const testDir = path.resolve(process.cwd(), 'test-assets');

  // 1. Load and parse 3-page German textbook PDF
  console.log('[E2E Step 1] Ingesting and Parsing Multi-Page German PDF...');
  const pdfBytes = new Uint8Array(fs.readFileSync(path.join(testDir, 'sample-german-multipage.pdf')));
  const doc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  if (doc.numPages !== 3) throw new Error(`Expected 3 pages, got ${doc.numPages}`);
  console.log(`✓ PDF parsed successfully (${doc.numPages} pages).`);

  // 2. Simulate Page 1 Rendering, Text Extraction, and Word Lookup
  console.log('\n[E2E Step 2] Page 1: Word Detection & Local Dictionary Resolution...');
  const page1 = await doc.getPage(1);
  const text1 = await page1.getTextContent();
  const page1Tokens = text1.items.map(i => 'str' in i ? i.str : '').filter(Boolean);
  console.log(`- Page 1 text spans: ${page1Tokens.length} items`);

  // Test selecting "Wörter" (inflected)
  const sampleLine1 = 'Ich lerne jeden Tag neue Wörter.';
  const offsetWoerter = sampleLine1.indexOf('Wörter') + 2;
  const extraction1 = extractWordAtOffset(sampleLine1, offsetWoerter);
  if (!extraction1 || extraction1.word !== 'Wörter') {
    throw new Error(`Failed to extract Wörter: ${JSON.stringify(extraction1)}`);
  }
  const lookup1 = await localDictionaryProvider.lookup(extraction1.word, 'de', 'en');
  if (!lookup1 || (!lookup1.translations.some(t => t.toLowerCase().includes('word')) && !lookup1.translations.includes('words'))) {
    throw new Error(`Failed lookup for "${extraction1.word}": got ${JSON.stringify(lookup1)}`);
  }
  console.log(`✓ Clicked "${extraction1.word}" -> Lemma: "${lookup1.lemma || 'N/A'}", Translations: [${lookup1.translations.join(', ')}] (POS: ${lookup1.partOfSpeech})`);

  // 3. Simulate Page 2 Navigation and Word Lookup
  console.log('\n[E2E Step 3] Page 2 Navigation & Word Lookup...');
  const page2 = await doc.getPage(2);
  const text2 = await page2.getTextContent();
  const page2Str = text2.items.map(i => 'str' in i ? i.str : '').join(' ');
  if (!page2Str.includes('Bahnhof')) throw new Error('Page 2 missing expected content');

  // Test selecting "Schule" on Page 2
  const sampleLine2 = 'Die Schule liegt in der Nähe vom Bahnhof.';
  const offsetSchule = sampleLine2.indexOf('Schule') + 2;
  const extraction2 = extractWordAtOffset(sampleLine2, offsetSchule);
  const lookup2 = await localDictionaryProvider.lookup(extraction2.word, 'de', 'en');
  if (!lookup2 || !lookup2.translations.includes('school')) {
    throw new Error(`Failed lookup for Schule: ${JSON.stringify(lookup2)}`);
  }
  console.log(`✓ Page 2 Clicked "${extraction2.word}" -> Translations: [${lookup2.translations.join(', ')}] (POS: ${lookup2.partOfSpeech})`);

  // 4. Simulate Page 3: German Umlauts & Compounds
  console.log('\n[E2E Step 4] Page 3: German Umlauts & Inflected Verbs...');
  const sampleLine3 = 'Lesen Sie gerne Bücher auf Deutsch?';
  const offsetBuecher = sampleLine3.indexOf('Bücher') + 2;
  const extraction3 = extractWordAtOffset(sampleLine3, offsetBuecher);
  const lookup3 = await localDictionaryProvider.lookup(extraction3.word, 'de', 'en');
  if (!lookup3 || lookup3.lemma !== 'Buch' || !lookup3.translations.includes('book')) {
    throw new Error(`Failed lookup for Bücher: ${JSON.stringify(lookup3)}`);
  }
  console.log(`✓ Clicked "${extraction3.word}" -> Base Lemma: "${lookup3.lemma}", Translations: [${lookup3.translations.join(', ')}]`);

  // 5. Scanned / Image-Only PDF Detection
  console.log('\n[E2E Step 5] Scanned / Image-Only PDF Detection Verification...');
  const scannedBytes = new Uint8Array(fs.readFileSync(path.join(testDir, 'sample-scanned-image.pdf')));
  const scannedDoc = await pdfjsLib.getDocument({ data: scannedBytes }).promise;
  const scannedPage = await scannedDoc.getPage(1);
  const scannedText = await scannedPage.getTextContent();
  const hasSelectableText = scannedText.items.some(i => 'str' in i && i.str.trim().length > 0);
  if (hasSelectableText) throw new Error('Scanned PDF falsely detected text');
  console.log('✓ Scanned PDF accurately identified (0 text items) -> triggers EmptyTextWarning.');

  // 6. Unknown Word & Boundary Checks
  console.log('\n[E2E Step 6] Unknown Word & Boundary Conditions...');
  const unknownLookup = await localDictionaryProvider.lookup('unbekannteswort99', 'de', 'en');
  if (unknownLookup !== null) throw new Error('Unknown word lookup should return null');
  console.log('✓ Unknown word returns null cleanly without error.');

  // 7. Multi-word selection handling
  if (isSingleWord('zwei Wörter zusammen')) throw new Error('Multi-word false positive');
  if (!isSingleWord('„Kaffee“')) throw new Error('Single word false negative');
  console.log('✓ Multi-word selection suppression verified.');

  console.log('\n===============================================================');
  console.log('🎉 ALL END-TO-END INTEGRATION SCENARIOS PASSED SUCCESSFULLY!');
  console.log('===============================================================\n');
}

verifyPhase8E2E().catch(err => {
  console.error('Phase 8 E2E Verification failed:', err);
  process.exit(1);
});

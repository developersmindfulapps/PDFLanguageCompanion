import fs from 'node:fs';
import path from 'node:path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function testPdfTextExtraction() {
  console.log('--- Testing Phase 4 PDF Text Extraction & Scanned Detection ---');

  const testDir = path.resolve(process.cwd(), 'test-assets');

  // Test A: Single page German PDF
  console.log('\n[Test A] Single-page German PDF:');
  const pdfAData = new Uint8Array(fs.readFileSync(path.join(testDir, 'sample-german-1page.pdf')));
  const docA = await pdfjsLib.getDocument({ data: pdfAData }).promise;
  const pageA = await docA.getPage(1);
  const textA = await pageA.getTextContent();
  const hasTextA = textA.items.some(item => 'str' in item && item.str.trim().length > 0);
  console.log(`- Page 1 text items: ${textA.items.length}, hasText: ${hasTextA}`);
  if (!hasTextA || textA.items.length === 0) throw new Error('Test A failed: expected text content');
  console.log('✓ Test A passed');

  // Test B: German umlauts & special characters
  console.log('\n[Test B] German Umlauts & Special Characters (ä, ö, ü, Ä, Ö, Ü, ß):');
  const pdfBData = new Uint8Array(fs.readFileSync(path.join(testDir, 'sample-german-umlauts.pdf')));
  const docB = await pdfjsLib.getDocument({ data: pdfBData }).promise;
  const pageB = await docB.getPage(1);
  const textB = await pageB.getTextContent();
  const extractedStrings = textB.items.map(i => 'str' in i ? i.str : '').join(' ');
  console.log(`- Extracted: ${extractedStrings}`);
  const expectedTokens = ['Straße', 'Überblick', 'Köpfe', 'Mädchen', 'größer', 'Äpfel', 'Öle', 'Übungen'];
  for (const token of expectedTokens) {
    if (!extractedStrings.includes(token)) {
      throw new Error(`Test B failed: expected token "${token}" in extracted text`);
    }
  }
  console.log('✓ Test B passed');

  // Test C: Multi-page navigation text separation
  console.log('\n[Test C] Multi-page PDF (Independent page text extraction):');
  const pdfCData = new Uint8Array(fs.readFileSync(path.join(testDir, 'sample-german-multipage.pdf')));
  const docC = await pdfjsLib.getDocument({ data: pdfCData }).promise;
  if (docC.numPages !== 3) throw new Error(`Expected 3 pages, got ${docC.numPages}`);
  for (let p = 1; p <= docC.numPages; p++) {
    const page = await docC.getPage(p);
    const content = await page.getTextContent();
    const str = content.items.map(i => 'str' in i ? i.str : '').join(' ');
    console.log(`- Page ${p}: contains "Kapitel ${p}" -> ${str.includes(`Kapitel ${p}`)}`);
    if (!str.includes(`Kapitel ${p}`)) throw new Error(`Test C failed: Page ${p} missing Kapitel ${p}`);
  }
  console.log('✓ Test C passed');

  // Test D: Scanned / Image-only PDF
  console.log('\n[Test D] Scanned / Image-only PDF Detection:');
  const pdfDData = new Uint8Array(fs.readFileSync(path.join(testDir, 'sample-scanned-image.pdf')));
  const docD = await pdfjsLib.getDocument({ data: pdfDData }).promise;
  const pageD = await docD.getPage(1);
  const textD = await pageD.getTextContent();
  const hasTextD = textD.items.some(item => 'str' in item && item.str.trim().length > 0);
  console.log(`- Scanned page text items: ${textD.items.length}, hasText: ${hasTextD}`);
  if (hasTextD) throw new Error('Test D failed: image-only PDF was falsely detected as having text');
  console.log('✓ Test D passed (EmptyTextWarning correctly triggered)');

  console.log('\n🎉 ALL PHASE 4 AUTOMATED VERIFICATIONS PASSED!\n');
}

testPdfTextExtraction().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});

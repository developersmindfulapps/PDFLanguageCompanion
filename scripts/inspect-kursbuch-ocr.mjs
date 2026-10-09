import fs from 'node:fs';
import { ocrService } from '../src/services/ocr/ocrService.ts';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function inspectKursbuch() {
  console.log('--- Inspecting Kursbuch OCR ---');
  const pdfBytes = new Uint8Array(fs.readFileSync('kursbuch.pdf'));
  const doc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  console.log(`Kursbuch page count: ${doc.numPages}`);

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    console.log(`\n=== Running OCR on Page ${p} ===`);
    const ocrResult = await ocrService.recognizePage(page, { psm: 6 });
    console.log(`Page ${p} OCR words detected: ${ocrResult.words.length}`);

    // Print all words and check for "Lieblingsfilm", "Lieblingsmusik", "Telefonnummer", "ht", etc.
    ocrResult.words.forEach((w, idx) => {
      if (
        w.text.includes('Liebling') ||
        w.text.includes('film') ||
        w.text.includes('Film') ||
        w.text.includes('ht') ||
        w.text.includes('Telefon') ||
        w.text.includes('Nummer') ||
        w.text.includes('Musik') ||
        w.text.includes('Name') ||
        w.text.includes('Wohn')
      ) {
        console.log(`Word [${idx}]: "${w.text}" bbox:`, w.bbox, `conf: ${w.confidence}`);
      }
    });

    console.log('\nFirst 30 OCR words on Page ' + p + ':');
    console.log(ocrResult.words.slice(0, 30).map(w => w.text).join(' | '));
  }
}

inspectKursbuch().catch(console.error);

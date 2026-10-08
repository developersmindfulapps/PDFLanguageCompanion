// Helper to generate minimal valid test PDF files for verification
import fs from 'node:fs';
import path from 'node:path';

function createSimplePdf(pagesContent, isImageOnly = false) {
  let objects = [];
  
  const fontObjNum = 3;
  const pageObjNums = [];
  let currentObjNum = 4;

  const pageEntries = [];

  for (const text of pagesContent) {
    const pageObj = currentObjNum++;
    const contentObj = currentObjNum++;
    pageObjNums.push(pageObj);
    pageEntries.push({ pageObj, contentObj, text });
  }

  // Object 1: Catalog
  objects[1] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`;

  // Object 2: Pages
  objects[2] = `2 0 obj\n<< /Type /Pages /Kids [${pageObjNums.map(n => `${n} 0 R`).join(' ')}] /Count ${pageObjNums.length} >>\nendobj`;

  // Object 3: Font with WinAnsiEncoding for umlauts
  objects[3] = `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj`;

  // Create Page & Content objects
  for (const entry of pageEntries) {
    let streamContent = '';
    if (isImageOnly) {
      // Draw a rectangle / graphical shape, but NO text (BT...ET)
      streamContent = '0.85 0.85 0.85 rg\n50 200 495 500 re\nf\n0.2 0.2 0.2 RG\n2 w\n50 200 495 500 re\nS\n';
    } else {
      const lines = entry.text.split('\n');
      streamContent = 'BT\n/F1 14 Tf\n50 750 Td\n20 TL\n';
      for (const line of lines) {
        // Escape special chars and encode Latin1
        const escapedLine = line
          .replace(/\\/g, '\\\\')
          .replace(/\(/g, '\\(')
          .replace(/\)/g, '\\)')
          .replace(/ä/g, '\\344')
          .replace(/ö/g, '\\366')
          .replace(/ü/g, '\\374')
          .replace(/Ä/g, '\\304')
          .replace(/Ö/g, '\\326')
          .replace(/Ü/g, '\\334')
          .replace(/ß/g, '\\337');
        streamContent += `(${escapedLine}) '\n`;
      }
      streamContent += 'ET';
    }

    const streamLength = Buffer.byteLength(streamContent, 'latin1');

    objects[entry.pageObj] = `${entry.pageObj} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${entry.contentObj} 0 R >>\nendobj`;

    objects[entry.contentObj] = `${entry.contentObj} 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj`;
  }

  let pdfOutput = '%PDF-1.4\n';
  const offsets = [0];

  for (let i = 1; i < currentObjNum; i++) {
    offsets[i] = Buffer.byteLength(pdfOutput, 'latin1');
    pdfOutput += objects[i] + '\n';
  }

  const xrefOffset = Buffer.byteLength(pdfOutput, 'latin1');
  pdfOutput += `xref\n0 ${currentObjNum}\n0000000000 65535 f \n`;

  for (let i = 1; i < currentObjNum; i++) {
    const offsetStr = String(offsets[i]).padStart(10, '0');
    pdfOutput += `${offsetStr} 00000 n \n`;
  }

  pdfOutput += `trailer\n<< /Size ${currentObjNum} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdfOutput, 'latin1');
}

const testDir = path.resolve(process.cwd(), 'test-assets');
fs.mkdirSync(testDir, { recursive: true });

// 1. Single-page German sample
const singlePageText = [
  'Deutschkurs: Erste Schritte',
  '',
  'Willkommen in der Sprachschule.',
  'Wir lesen ein Buch und lernen Deutsch.',
  'Der Kaffee im Seminar ist sehr gut.',
  'Heute ist ein schöner Tag in Berlin.'
].join('\n');

fs.writeFileSync(
  path.join(testDir, 'sample-german-1page.pdf'),
  createSimplePdf([singlePageText])
);

// 2. Multi-page German sample (3 pages)
const page1 = [
  'Kapitel 1: Die Begrüßung',
  '',
  'Guten Tag! Wie geht es Ihnen?',
  'Mein Name ist Thomas Müller.',
  'Ich lerne jeden Tag neue Wörter.'
].join('\n');

const page2 = [
  'Kapitel 2: In der Stadt',
  '',
  'Die Schule liegt in der Nähe vom Bahnhof.',
  'Dort gibt es viele Geschäfte und Cafés.',
  'Ein Student liest eine Zeitung.'
].join('\n');

const page3 = [
  'Kapitel 3: Freizeit und Hobbys',
  '',
  'Am Wochenende trinken wir Kaffee.',
  'Lesen Sie gerne Bücher auf Deutsch?',
  'Übung macht den Meister!'
].join('\n');

fs.writeFileSync(
  path.join(testDir, 'sample-german-multipage.pdf'),
  createSimplePdf([page1, page2, page3])
);

// 3. German special characters & umlauts
const umlautsText = [
  'Deutsche Sonderzeichen Testseite',
  '',
  'Straße (Eszett / scharfes S)',
  'Überblick (Großes U-Umlaut)',
  'Köpfe (Kleines O-Umlaut)',
  'Mädchen (Kleines A-Umlaut)',
  'größer (Umlaut mit Eszett)',
  'Äpfel, Öle, Übungen'
].join('\n');

fs.writeFileSync(
  path.join(testDir, 'sample-german-umlauts.pdf'),
  createSimplePdf([umlautsText])
);

// 4. Scanned / Image-only PDF (No text items)
fs.writeFileSync(
  path.join(testDir, 'sample-scanned-image.pdf'),
  createSimplePdf([''], true)
);

// 5. Dense text German page (30 lines)
const denseLines = [];
denseLines.push('Deutsch für Fortgeschrittene: Lesetext und Grammatik');
denseLines.push('');
for (let i = 1; i <= 25; i++) {
  denseLines.push(`Abschnitt ${i}: In der Sprachschule lernen die Studenten fleißig neue Wörter und lesen ein Buch über Berlin.`);
}
fs.writeFileSync(
  path.join(testDir, 'sample-dense-text.pdf'),
  createSimplePdf([denseLines.join('\n')])
);

// 6. Multi-column simulated layout
const multiColumnText = [
  'Spalte A                    Spalte B',
  'Die Schule                  Das Geschäft',
  'Der Kaffee                  Der Bahnhof',
  'Das Buch                    Die Zeitung',
  'Das Mädchen                 Die Straße'
].join('\n');
fs.writeFileSync(
  path.join(testDir, 'sample-multi-column.pdf'),
  createSimplePdf([multiColumnText])
);

// 7. Low-text / Title page (Only title + page number, must NOT trigger scanned warning)
const lowTextPage = [
  'DEUTSCH A1 KURSBUCH',
  '',
  'Seite 1'
].join('\n');
fs.writeFileSync(
  path.join(testDir, 'sample-low-text-title.pdf'),
  createSimplePdf([lowTextPage])
);

// 8. Corrupted / Invalid PDF file
fs.writeFileSync(
  path.join(testDir, 'sample-corrupted.pdf'),
  Buffer.from('THIS IS NOT A VALID PDF FILE HEADER DATA 1234567890', 'utf-8')
);

console.log('Test PDFs updated in test-assets/');

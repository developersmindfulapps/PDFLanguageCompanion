/**
 * PDF Text Extraction Diagnostic Tool
 *
 * Usage:
 *   node scripts/diagnose-pdf-text.mjs <path-to-pdf>
 *   node scripts/diagnose-pdf-text.mjs test-assets/sample-german-1page.pdf
 *
 * This script traces the full pipeline from raw TextContent.items
 * down to the hasText check, to identify exactly where text is being
 * lost for a real-world PDF.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error('Usage: node scripts/diagnose-pdf-text.mjs <path-to-pdf>');
  process.exit(1);
}

const resolvedPath = path.resolve(process.cwd(), pdfPath);
if (!fs.existsSync(resolvedPath)) {
  console.error(`File not found: ${resolvedPath}`);
  process.exit(1);
}

const bytes = new Uint8Array(fs.readFileSync(resolvedPath));
console.log(`\n${'='.repeat(70)}`);
console.log(`  PDF TEXT EXTRACTION DIAGNOSTIC`);
console.log(`  File: ${path.basename(resolvedPath)}`);
console.log(`  Size: ${(bytes.length / 1024).toFixed(1)} KB`);
console.log(`${'='.repeat(70)}\n`);

async function diagnose() {
  const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
  const numPages = doc.numPages;
  console.log(`[Document] Total pages: ${numPages}\n`);

  const MAX_PAGES = Math.min(numPages, 5); // inspect up to 5 pages

  for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
    console.log(`${'─'.repeat(70)}`);
    console.log(`  PAGE ${pageNum} of ${numPages}`);
    console.log(`${'─'.repeat(70)}`);

    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();

    const items = textContent.items;
    console.log(`\n[Raw] textContent.items.length: ${items.length}`);

    // -----------------------------------------------------------------
    // Categorize items by type
    // -----------------------------------------------------------------
    let textItemCount = 0;
    let markedContentCount = 0;
    let otherCount = 0;

    // TextItem: has 'str' property
    // TextMarkedContent: has 'type' property, no 'str'
    for (const item of items) {
      if ('str' in item) textItemCount++;
      else if ('type' in item) markedContentCount++;
      else otherCount++;
    }

    console.log(`[Categories] TextItem (has 'str'): ${textItemCount}, TextMarkedContent (no 'str'): ${markedContentCount}, Other: ${otherCount}`);

    // -----------------------------------------------------------------
    // Our current hasText check:
    //   'str' in item && typeof item.str === 'string' && item.str.trim().length > 0
    // -----------------------------------------------------------------
    const textItems = items.filter(item => 'str' in item);
    const nonEmptyItems = textItems.filter(item => typeof item.str === 'string' && item.str.trim().length > 0);
    const currentHasText = nonEmptyItems.length > 0;

    console.log(`\n[Current hasText check]`);
    console.log(`  Items with 'str' property:           ${textItems.length}`);
    console.log(`  Items where str.trim().length > 0:   ${nonEmptyItems.length}`);
    console.log(`  => hasText result:                   ${currentHasText}`);

    // -----------------------------------------------------------------
    // Deep analysis of ALL TextItems
    // -----------------------------------------------------------------
    if (textItems.length > 0) {
      console.log(`\n[TextItem Analysis] Showing first 20 items with 'str':`);
      const toShow = textItems.slice(0, 20);
      for (let i = 0; i < toShow.length; i++) {
        const item = toShow[i];
        const strLen = item.str?.length ?? 'N/A';
        const strTrimLen = item.str?.trim().length ?? 'N/A';
        // Show char codes for first 10 chars
        const charCodes = [...(item.str || '')].slice(0, 10).map(c => c.charCodeAt(0));
        console.log(`  [${i}] str=${JSON.stringify(item.str)}, len=${strLen}, trimLen=${strTrimLen}, charCodes=[${charCodes.join(',')}], width=${item.width?.toFixed(2)}, height=${item.height?.toFixed(2)}, hasEOL=${item.hasEOL}`);
      }

      // Check if ALL items are empty-string or space-only
      const allEmpty = textItems.every(item => !item.str || item.str.trim().length === 0);
      const allSpaces = textItems.every(item => item.str !== undefined && item.str.trim().length === 0 && item.str.length > 0);

      console.log(`\n  All TextItems are empty string:      ${textItems.every(item => item.str === '')}`);
      console.log(`  All TextItems are whitespace-only:   ${allSpaces}`);
      console.log(`  All TextItems have zero-width:       ${textItems.every(item => item.width === 0)}`);

      // -----------------------------------------------------------------
      // Alternative hasText: any item has non-zero width (even if str is space)
      // -----------------------------------------------------------------
      const hasTextByWidth = textItems.some(item => item.width > 0);
      console.log(`\n[Alternative check: any item.width > 0]:   ${hasTextByWidth}`);

      // -----------------------------------------------------------------
      // Alternative hasText: any item has non-zero str OR non-zero width
      // -----------------------------------------------------------------
      const hasTextRelaxed = textItems.some(item => {
        const hasStr = typeof item.str === 'string' && item.str.trim().length > 0;
        const hasWidth = typeof item.width === 'number' && item.width > 0;
        return hasStr || hasWidth;
      });
      console.log(`[Alternative check: str.trim > 0 OR width > 0]: ${hasTextRelaxed}`);

      // -----------------------------------------------------------------
      // Concatenated text sample
      // -----------------------------------------------------------------
      const concatenated = textItems.map(item => item.str || '').join('');
      const trimmedConcat = concatenated.trim();
      console.log(`\n[Concatenated text (first 200 chars)]: ${JSON.stringify(trimmedConcat.slice(0, 200))}`);
      console.log(`[Total concatenated length]: ${concatenated.length}, trimmed: ${trimmedConcat.length}`);

    } else {
      console.log(`\n[!] No TextItems at all — all ${markedContentCount} items are TextMarkedContent (or other).`);
      console.log(`    This can happen if page.getTextContent() is called with includeMarkedContent: true`);
      console.log(`    AND the PDF only has marked-content structure tags without embedded text items.`);
    }

    // -----------------------------------------------------------------
    // Check TextMarkedContent if present
    // -----------------------------------------------------------------
    if (markedContentCount > 0) {
      const mcItems = items.filter(item => 'type' in item && !('str' in item));
      console.log(`\n[TextMarkedContent items] First 5:`);
      mcItems.slice(0, 5).forEach((item, i) => {
        console.log(`  [${i}] type=${item.type}, id=${item.id}`);
      });
    }

    // -----------------------------------------------------------------
    // Try with includeMarkedContent explicitly false
    // -----------------------------------------------------------------
    console.log(`\n[Retry] getTextContent({ includeMarkedContent: false }):`);
    try {
      const textContentNoMC = await page.getTextContent({ includeMarkedContent: false });
      const itemsNoMC = textContentNoMC.items;
      const textItemsNoMC = itemsNoMC.filter(item => 'str' in item);
      const nonEmptyNoMC = textItemsNoMC.filter(item => item.str?.trim().length > 0);
      console.log(`  Total items: ${itemsNoMC.length}, TextItems: ${textItemsNoMC.length}, nonEmpty: ${nonEmptyNoMC.length}`);
      const concatNoMC = textItemsNoMC.map(i => i.str || '').join('').trim();
      console.log(`  Sample text: ${JSON.stringify(concatNoMC.slice(0, 100))}`);
    } catch (err) {
      console.log(`  Error: ${err.message}`);
    }

    console.log('');
  }

  await doc.destroy();

  console.log(`${'='.repeat(70)}`);
  console.log(`  DIAGNOSTIC COMPLETE`);
  console.log(`${'='.repeat(70)}\n`);
}

diagnose().catch(err => {
  console.error('Diagnostic failed:', err);
  process.exit(1);
});

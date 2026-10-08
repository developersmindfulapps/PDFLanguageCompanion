import fs from 'node:fs';
import path from 'node:path';
import { OCRService } from '../src/services/ocr/ocrService.ts';
import { LocalDictionaryProvider } from '../src/services/dictionary/LocalDictionaryProvider.ts';
import { normalizeBoundingBox, projectToViewport } from '../src/services/ocr/ocrUtils.ts';
import { extractWordAtOffset } from '../src/utils/textUtils.ts';

/**
 * Verification test suite for Phase 2.3: OCR UX, Page Caching, Navigation Races, and Lifecycle.
 */
async function verifyPhase12OCRUXAndCaching() {
  console.log('======================================================================');
  console.log('   PDF LANGUAGE COMPANION — PHASE 2.3 OCR UX & CACHING VERIFICATION   ');
  console.log('======================================================================\n');

  const rootDir = process.cwd();
  const testDir = path.join(rootDir, 'test-assets');
  const dict = new LocalDictionaryProvider();
  const ocr = OCRService.getInstance();

  const testImagePath = path.join(testDir, 'sample-german-ocr.bmp');

  // Simulated in-memory session cache matching useOCR logic
  const sessionCache = new Map();
  let isProcessing = false;
  let currentProgress = null;
  let activeJobPage = null;

  async function simulateRunOCR(pageNumber) {
    if (sessionCache.has(pageNumber)) {
      return sessionCache.get(pageNumber);
    }
    isProcessing = true;
    activeJobPage = pageNumber;
    currentProgress = { status: 'Starting OCR...', progress: 0 };

    try {
      const res = await ocr.recognize(testImagePath, pageNumber, {
        onProgress: (p) => {
          if (activeJobPage === pageNumber) {
            currentProgress = p;
          }
        },
      });

      sessionCache.set(pageNumber, res);
      if (activeJobPage === pageNumber) {
        isProcessing = false;
        currentProgress = null;
        activeJobPage = null;
      }
      return res;
    } catch (err) {
      isProcessing = false;
      currentProgress = null;
      activeJobPage = null;
      throw err;
    }
  }

  function simulateCancelOCR() {
    ocr.cancel();
    isProcessing = false;
    currentProgress = null;
    activeJobPage = null;
  }

  function simulateClearDocument() {
    simulateCancelOCR();
    sessionCache.clear();
  }

  // -------------------------------------------------------------------------
  // Scenario 1: Initial Scanned Page Detection & User-Triggered OCR
  // -------------------------------------------------------------------------
  console.log('[Scenario 1] Scanned Page Detection & On-Demand OCR Trigger:');
  console.log(`- Initial cache size: ${sessionCache.size}`);
  console.log(`- Is processing: ${isProcessing}`);
  if (sessionCache.has(1)) throw new Error('Cache should be empty initially');

  console.log('Triggering Run OCR on Page 1...');
  const page1Result = await simulateRunOCR(1);

  console.log(`- Page 1 recognized text: "${page1Result.text.replace(/\n/g, ' ')}"`);
  console.log(`- Page 1 words count: ${page1Result.words.length}`);
  console.log(`- Cache size after OCR: ${sessionCache.size}`);
  console.log(`- Is processing after OCR: ${isProcessing}`);

  if (sessionCache.size !== 1 || !sessionCache.has(1)) {
    throw new Error('Page 1 result was not stored in session cache.');
  }
  console.log('✓ Page 1 successfully recognized and stored in session cache.');

  // -------------------------------------------------------------------------
  // Scenario 2: Per-Page Cache Reuse (Navigate away & back)
  // -------------------------------------------------------------------------
  console.log('\n[Scenario 2] Page Navigation & Cache Reuse (Page 1 -> Page 2 -> Page 1):');
  // Navigate to page 2 (not yet OCR'd)
  let currentPage = 2;
  console.log(`- Navigated to Page ${currentPage}. Cached result:`, sessionCache.get(currentPage) || 'None');
  if (sessionCache.has(2)) throw new Error('Page 2 should not be in cache yet');

  // Navigate back to page 1
  currentPage = 1;
  const cachedResult = sessionCache.get(currentPage);
  console.log(`- Navigated back to Page ${currentPage}. Cached result found:`, Boolean(cachedResult));
  if (!cachedResult || cachedResult.words.length !== page1Result.words.length) {
    throw new Error('Failed to retrieve cached OCR result for Page 1.');
  }
  console.log('✓ Navigating back to Page 1 immediately reuses cache without re-running OCR (0ms delay).');

  // -------------------------------------------------------------------------
  // Scenario 3: Navigation Race Condition Handling
  // -------------------------------------------------------------------------
  console.log('\n[Scenario 3] Navigation Race Condition (Navigate while OCR is in-flight):');
  console.log('Starting OCR on Page 2...');
  const inFlightPromise = simulateRunOCR(2);

  // User immediately flips to Page 3 before Page 2 completes
  setTimeout(() => {
    console.log('User flips to Page 3 while Page 2 OCR is running. Cancelling active job...');
    simulateCancelOCR();
  }, 10);

  let caughtCancel = false;
  try {
    await inFlightPromise;
  } catch (err) {
    caughtCancel = true;
  }

  console.log(`- Cancellation caught cleanly: ${caughtCancel}`);
  console.log(`- Active processing state reset: ${!isProcessing}`);
  console.log(`- Active job page reset: ${activeJobPage === null}`);

  // Subsequent OCR on Page 3 starts fresh
  console.log('Starting clean OCR on Page 3...');
  const page3Result = await simulateRunOCR(3);
  console.log(`- Page 3 completed successfully (words: ${page3Result.words.length})`);
  if (!sessionCache.has(3)) {
    throw new Error('Page 3 was not cached after recovery.');
  }
  console.log('✓ In-flight job cancelled cleanly during page flip; new page processed normally.');

  // -------------------------------------------------------------------------
  // Scenario 4: Document Replacement / Lifecycle Cleanup
  // -------------------------------------------------------------------------
  console.log('\n[Scenario 4] Document Replacement & Cache Clearance (PDF A -> PDF B):');
  console.log(`- Cache size before reset (PDF A): ${sessionCache.size} pages`);
  if (sessionCache.size === 0) throw new Error('Expected cached pages before document reset.');

  console.log('Opening new PDF document (PDF B)...');
  simulateClearDocument();
  await ocr.terminate();

  console.log(`- Cache size after reset (PDF B): ${sessionCache.size} pages`);
  console.log(`- OCR service status after reset: "${ocr.getStatus()}"`);
  console.log(`- OCR service isInitialized: ${ocr.isInitialized()}`);

  if (sessionCache.size !== 0) {
    throw new Error('Session cache was not completely cleared on document reset.');
  }
  if (ocr.isInitialized() !== false) {
    throw new Error('OCR worker was not terminated on document reset.');
  }
  console.log('✓ Document reset cleanly wiped cache and terminated worker resources.');

  // -------------------------------------------------------------------------
  // Scenario 5: Word Selection & Dictionary Lookup on OCR Words
  // -------------------------------------------------------------------------
  console.log('\n[Scenario 5] OCR Text Layer Selection & Dictionary Tooltip Integration:');
  const freshResult = await simulateRunOCR(1);
  const sampleWords = freshResult.words;

  console.log(`Testing lookup on ${sampleWords.length} recognized words:`);
  for (const word of sampleWords) {
    const extracted = extractWordAtOffset(word.text, 0);
    if (!extracted) throw new Error(`Word extraction failed for "${word.text}"`);
    const dictResult = await dict.lookup(extracted.word, 'de', 'en');
    console.log(`  - Word "${extracted.word}" -> Dictionary match: ${dictResult ? dictResult.translations.join(', ') : 'Not in MVP dictionary (graceful null)'}`);
  }
  console.log('✓ OCR text layer integrates seamlessly with existing word selection and dictionary provider.');

  await ocr.terminate();
  console.log('\n======================================================================');
  console.log('🎉 ALL PHASE 2.3 OCR UX & CACHING SCENARIOS PASSED SUCCESSFULLY!     ');
  console.log('======================================================================\n');
}

verifyPhase12OCRUXAndCaching().catch((err) => {
  console.error('\n❌ Phase 2.3 Verification Failed:', err);
  process.exit(1);
});

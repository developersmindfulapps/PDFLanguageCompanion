import fs from 'node:fs';
import path from 'node:path';
import { OCRService, OCRCancelledError } from '../src/services/ocr/index.ts';

async function verifyPhase10OCR() {
  console.log('======================================================================');
  console.log('   PDF LANGUAGE COMPANION — PHASE 2.1 OCR WORKER FOUNDATION VERIFY   ');
  console.log('======================================================================\n');

  const rootDir = process.cwd();
  const testDir = path.join(rootDir, 'test-assets');
  const publicDir = path.join(rootDir, 'public');
  const distDir = path.join(rootDir, 'dist');

  // -------------------------------------------------------------------------
  // Check 1: OCR Service and Types Module Existence
  // -------------------------------------------------------------------------
  console.log('[Check 1] OCR Module & Interface Exports:');
  if (typeof OCRService !== 'function' || typeof OCRCancelledError !== 'function') {
    throw new Error('OCRService or OCRCancelledError class is not exported properly.');
  }
  const ocr = OCRService.getInstance();
  if (!ocr || typeof ocr.initialize !== 'function' || typeof ocr.recognize !== 'function' || typeof ocr.cancel !== 'function' || typeof ocr.terminate !== 'function') {
    throw new Error('OCRService instance missing required methods.');
  }
  console.log('✓ OCRService singleton & API methods exported correctly.');

  // -------------------------------------------------------------------------
  // Check 2: Bundled Tesseract Assets in public/ and dist/
  // -------------------------------------------------------------------------
  console.log('\n[Check 2] Bundled Tesseract Assets (public/ & dist/):');
  const requiredPublicFiles = [
    'public/tesseract/worker.min.js',
    'public/tesseract/tesseract-core-relaxedsimd-lstm.wasm.js',
    'public/tesseract/tesseract-core-relaxedsimd-lstm.wasm',
    'public/tesseract/tesseract-core-simd-lstm.wasm.js',
    'public/tesseract/tesseract-core-simd-lstm.wasm',
    'public/tesseract/tesseract-core-lstm.wasm.js',
    'public/tesseract/tesseract-core-lstm.wasm',
    'public/tessdata/deu.traineddata.gz',
  ];

  for (const relPath of requiredPublicFiles) {
    const fullPath = path.join(rootDir, relPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Missing required local asset: ${relPath}`);
    }
    const stat = fs.statSync(fullPath);
    if (stat.size === 0) {
      throw new Error(`Asset file is empty: ${relPath}`);
    }
    console.log(`  ✓ ${relPath} (${(stat.size / 1024).toFixed(1)} KB)`);
  }

  // Check dist packaging if dist exists
  if (fs.existsSync(distDir)) {
    console.log('Checking dist/ bundle synchronization:');
    const distWorker = path.join(distDir, 'tesseract', 'worker.min.js');
    const distLang = path.join(distDir, 'tessdata', 'deu.traineddata.gz');
    if (!fs.existsSync(distWorker) || !fs.existsSync(distLang)) {
      throw new Error('Built dist/ directory is missing packaged Tesseract or traineddata assets.');
    }
    console.log('  ✓ dist/tesseract/worker.min.js verified');
    console.log('  ✓ dist/tessdata/deu.traineddata.gz verified');
  }

  // -------------------------------------------------------------------------
  // Check 3: German Language Model Bundling
  // -------------------------------------------------------------------------
  console.log('\n[Check 3] German Language Model (deu.traineddata.gz):');
  const langDataPath = path.join(publicDir, 'tessdata', 'deu.traineddata.gz');
  const langDataStat = fs.statSync(langDataPath);
  console.log(`  File size: ${(langDataStat.size / (1024 * 1024)).toFixed(2)} MB`);
  if (langDataStat.size < 500 * 1024) {
    throw new Error('German traineddata file appears suspiciously small or incomplete.');
  }
  console.log('✓ German language data verified in local package.');

  // -------------------------------------------------------------------------
  // Check 4: Worker Initialization & Status Lifecycle
  // -------------------------------------------------------------------------
  console.log('\n[Check 4] OCR Worker Initialization:');
  console.log(`- Status before initialize: "${ocr.getStatus()}", isInitialized: ${ocr.isInitialized()}`);
  if (ocr.getStatus() !== 'idle' || ocr.isInitialized() !== false) {
    throw new Error('Initial OCR status should be idle and uninitialized.');
  }

  const worker = await ocr.initialize();
  if (!worker) {
    throw new Error('initialize() failed to return worker instance.');
  }
  console.log(`- Status after initialize: "${ocr.getStatus()}", isInitialized: ${ocr.isInitialized()}`);
  if (!ocr.isInitialized()) {
    throw new Error('Expected isInitialized() to return true after initialization.');
  }
  console.log('✓ Worker initialized successfully in local offline mode.');

  // -------------------------------------------------------------------------
  // Check 5 & 6: Recognition on Local Test Image & German Umlauts
  // -------------------------------------------------------------------------
  console.log('\n[Check 5 & 6] Recognition of German Test Image & Umlauts:');
  const testImagePath = path.join(testDir, 'sample-german-ocr.bmp');
  if (!fs.existsSync(testImagePath)) {
    throw new Error(`Test image fixture not found: ${testImagePath}`);
  }

  let progressReported = false;
  const result = await ocr.recognize(testImagePath, 1, {
    onProgress: (p) => {
      progressReported = true;
    },
  });

  console.log(`- Recognized full text: ${JSON.stringify(result.text)}`);
  console.log(`- Page number: ${result.pageNumber}`);
  console.log(`- Page confidence: ${result.confidence}%`);
  console.log(`- Source image dimensions: ${result.imageWidth} x ${result.imageHeight}`);
  console.log(`- Progress callbacks invoked: ${progressReported}`);

  if (!progressReported) {
    throw new Error('Progress callback was not invoked during recognition.');
  }
  if (!result.text || result.text.length === 0) {
    throw new Error('OCR recognition returned empty text.');
  }

  // Verify German special characters in recognized text
  const expectedGermanWords = ['Mädchen', 'Bücher'];
  for (const expected of expectedGermanWords) {
    const found = result.words.some((w) => w.text.includes(expected));
    console.log(`  - German word "${expected}": ${found ? 'Found' : 'Missing'}`);
    if (!found) {
      throw new Error(`Expected German word "${expected}" was not recognized in test image.`);
    }
  }
  console.log('✓ German umlauts (ä, ü) recognized accurately.');

  // -------------------------------------------------------------------------
  // Check 7 & 8: Word-Level Bounding Boxes and Confidences
  // -------------------------------------------------------------------------
  console.log('\n[Check 7 & 8] Word-Level Bounding Boxes & Confidence Metrics:');
  if (!Array.isArray(result.words) || result.words.length === 0) {
    throw new Error('OCR result words array is empty or invalid.');
  }

  for (let i = 0; i < result.words.length; i++) {
    const word = result.words[i];
    console.log(`  [Word ${i + 1}] "${word.text}" | bbox: [x0=${word.bbox.x0}, y0=${word.bbox.y0}, x1=${word.bbox.x1}, y1=${word.bbox.y1}] | conf: ${word.confidence}%`);

    if (typeof word.text !== 'string' || word.text.trim().length === 0) {
      throw new Error(`Word ${i} text is invalid.`);
    }
    if (!word.bbox || typeof word.bbox.x0 !== 'number' || typeof word.bbox.y0 !== 'number' || typeof word.bbox.x1 !== 'number' || typeof word.bbox.y1 !== 'number') {
      throw new Error(`Word ${i} bounding box is invalid or incomplete.`);
    }
    if (word.bbox.x1 <= word.bbox.x0 || word.bbox.y1 <= word.bbox.y0) {
      throw new Error(`Word ${i} bounding box has invalid non-positive dimensions.`);
    }
    if (typeof word.confidence !== 'number' || word.confidence < 0 || word.confidence > 100) {
      throw new Error(`Word ${i} confidence is out of valid range [0, 100]: ${word.confidence}`);
    }
  }
  console.log('✓ Word-level bounding boxes and confidence metrics validated.');

  // -------------------------------------------------------------------------
  // Check 9: Cancellation & Recovery
  // -------------------------------------------------------------------------
  console.log('\n[Check 9] In-Flight Job Cancellation & Recovery:');
  
  // Test A: Manual cancel()
  const cancelPromise = ocr.recognize(testImagePath, 2);
  setTimeout(() => {
    ocr.cancel();
  }, 5);

  let manualCancelled = false;
  try {
    await cancelPromise;
  } catch (err) {
    if (err instanceof OCRCancelledError) {
      manualCancelled = true;
    } else {
      throw err;
    }
  }

  if (!manualCancelled) {
    throw new Error('Manual ocr.cancel() did not reject with OCRCancelledError.');
  }
  console.log('✓ Manual ocr.cancel() rejected immediately with OCRCancelledError.');

  // Test B: Recovery after cancellation
  const recoveryResult = await ocr.recognize(testImagePath, 3);
  if (!recoveryResult || recoveryResult.words.length === 0) {
    throw new Error('OCR recovery after cancellation failed.');
  }
  console.log(`✓ Post-cancellation job completed cleanly (Page ${recoveryResult.pageNumber}, ${recoveryResult.words.length} words).`);

  // Test C: AbortSignal cancellation
  const ac = new AbortController();
  const abortPromise = ocr.recognize(testImagePath, 4, { signal: ac.signal });
  setTimeout(() => {
    ac.abort();
  }, 5);

  let signalCancelled = false;
  try {
    await abortPromise;
  } catch (err) {
    if (err instanceof OCRCancelledError) {
      signalCancelled = true;
    } else {
      throw err;
    }
  }

  if (!signalCancelled) {
    throw new Error('AbortSignal did not reject with OCRCancelledError.');
  }
  console.log('✓ AbortSignal cancellation rejected cleanly with OCRCancelledError.');

  // -------------------------------------------------------------------------
  // Check 10: Worker Cleanup & Termination
  // -------------------------------------------------------------------------
  console.log('\n[Check 10] Worker Termination & Resource Cleanup:');
  await ocr.terminate();
  console.log(`- Status after terminate: "${ocr.getStatus()}", isInitialized: ${ocr.isInitialized()}`);
  if (ocr.getStatus() !== 'idle' || ocr.isInitialized() !== false) {
    throw new Error('Worker was not cleanly uninitialized after terminate().');
  }
  console.log('✓ Worker terminated and resources released.');

  // -------------------------------------------------------------------------
  // Check 11: Network Dependency Safety
  // -------------------------------------------------------------------------
  console.log('\n[Check 11] Network Dependency & Manifest Isolation:');
  const manifest = JSON.parse(fs.readFileSync(path.join(publicDir, 'manifest.json'), 'utf8'));
  console.log(`- Manifest permissions: ${JSON.stringify(manifest.permissions || [])}`);
  console.log(`- Manifest host permissions: ${JSON.stringify(manifest.host_permissions || [])}`);
  console.log(`- Manifest extension_pages CSP: ${JSON.stringify(manifest.content_security_policy?.extension_pages || '')}`);
  if (manifest.permissions && manifest.permissions.length > 0) {
    throw new Error('Manifest permissions must remain empty for privacy isolation.');
  }
  if (manifest.host_permissions && manifest.host_permissions.length > 0) {
    throw new Error('Manifest host_permissions must remain empty for privacy isolation.');
  }
  const csp = manifest.content_security_policy?.extension_pages || '';
  if (!csp.includes("'wasm-unsafe-eval'")) {
    throw new Error("Manifest content_security_policy.extension_pages must contain 'wasm-unsafe-eval' for local WebAssembly.");
  }
  if (csp.includes("'unsafe-eval'")) {
    throw new Error("Manifest CSP must NOT contain 'unsafe-eval'.");
  }
  if (csp.includes('http://') || csp.includes('https://')) {
    throw new Error("Manifest CSP must NOT contain remote HTTP/HTTPS origins.");
  }
  console.log('✓ Privacy & CSP isolation verified: 0 permissions requested, wasm-unsafe-eval allowed, no unsafe-eval, local execution only.');

  console.log('\n======================================================================');
  console.log('🎉 ALL PHASE 2.1 OCR WORKER FOUNDATION TESTS PASSED SUCCESSFULLY!    ');
  console.log('======================================================================\n');
}

verifyPhase10OCR().catch((err) => {
  console.error('\n❌ OCR Verification Failed:', err);
  process.exit(1);
});

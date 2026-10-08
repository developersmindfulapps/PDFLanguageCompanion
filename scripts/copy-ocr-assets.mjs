import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const tesseractDist = path.join(rootDir, 'node_modules', 'tesseract.js', 'dist');
const coreDist = path.join(rootDir, 'node_modules', 'tesseract.js-core');
const langDist = path.join(rootDir, 'node_modules', '@tesseract.js-data', 'deu', '4.0.0_best_int');

const publicTesseractDir = path.join(rootDir, 'public', 'tesseract');
const publicTessdataDir = path.join(rootDir, 'public', 'tessdata');

fs.mkdirSync(publicTesseractDir, { recursive: true });
fs.mkdirSync(publicTessdataDir, { recursive: true });

// Clean public/tesseract to ensure pruned files are removed
const existingFiles = fs.readdirSync(publicTesseractDir);
for (const file of existingFiles) {
  fs.unlinkSync(path.join(publicTesseractDir, file));
}

console.log('Copying Tesseract worker script...');
fs.copyFileSync(
  path.join(tesseractDist, 'worker.min.js'),
  path.join(publicTesseractDir, 'worker.min.js')
);
console.log('  ✓ worker.min.js');

console.log('Copying optimized Tesseract LSTM WASM core files...');
// Only LSTM variants are needed (OEM.LSTM_ONLY)
// 1. Relaxed-SIMD LSTM (Chromium 114+)
// 2. Standard SIMD LSTM (All modern browsers with WebAssembly SIMD)
// 3. Baseline LSTM (Non-SIMD fallback)
const requiredCoreFiles = [
  'tesseract-core-relaxedsimd-lstm.wasm.js',
  'tesseract-core-relaxedsimd-lstm.wasm',
  'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm',
  'tesseract-core-lstm.wasm.js',
  'tesseract-core-lstm.wasm',
];

for (const file of requiredCoreFiles) {
  const src = path.join(coreDist, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(publicTesseractDir, file));
    console.log(`  ✓ ${file}`);
  } else {
    throw new Error(`Required core asset missing from node_modules: ${file}`);
  }
}

console.log('Copying German traineddata...');
fs.copyFileSync(
  path.join(langDist, 'deu.traineddata.gz'),
  path.join(publicTessdataDir, 'deu.traineddata.gz')
);
console.log('  ✓ deu.traineddata.gz');

console.log('\nPruned OCR assets successfully synchronized to public/tesseract and public/tessdata!\n');

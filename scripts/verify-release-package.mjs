import fs from 'node:fs';
import path from 'node:path';

export async function verifyReleasePackage() {
  console.log('=====================================================================');
  console.log('       PDF LANGUAGE COMPANION — RELEASE PACKAGE VERIFICATION        ');
  console.log('=====================================================================\n');

  const rootDir = process.cwd();
  const distDir = path.join(rootDir, 'dist');
  let errors = [];

  // Check 1: dist/ directory existence
  console.log('[Check 1] Distribution Directory:');
  if (!fs.existsSync(distDir)) {
    console.error('  ✗ dist/ directory not found! Run "npm run build" first.');
    process.exit(1);
  }
  console.log('  ✓ dist/ directory exists.\n');

  // Check 2: Manifest & Extension Core
  console.log('[Check 2] Extension Manifest & Entry Points:');
  const manifestPath = path.join(distDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    errors.push('Missing dist/manifest.json');
  } else {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (manifest.manifest_version !== 3) {
        errors.push(`Expected manifest_version 3, got ${manifest.manifest_version}`);
      }
      if (!manifest.name || !manifest.version) {
        errors.push('manifest.json missing name or version');
      }
      // Check icons
      if (manifest.icons) {
        for (const [size, iconRel] of Object.entries(manifest.icons)) {
          const iconPath = path.join(distDir, iconRel);
          if (!fs.existsSync(iconPath)) {
            errors.push(`Declared icon missing: ${iconRel} (${size}x${size})`);
          }
        }
      }
      console.log(`  ✓ Manifest v3 valid: "${manifest.name}" v${manifest.version}`);
    } catch (err) {
      errors.push(`Invalid JSON in dist/manifest.json: ${err.message}`);
    }
  }

  // Check viewer.html and background.js
  const viewerHtml = path.join(distDir, 'viewer.html');
  const backgroundJs = path.join(distDir, 'background.js');
  if (!fs.existsSync(viewerHtml)) errors.push('Missing dist/viewer.html');
  if (!fs.existsSync(backgroundJs)) errors.push('Missing dist/background.js');
  console.log('  ✓ Entry points (viewer.html, background.js) present.\n');

  // Check 3: Dictionary License & Attribution File
  console.log('[Check 3] Dictionary License & Attribution Notice:');
  const dictLicensePath = path.join(distDir, 'LICENSE_DICTIONARY.txt');
  if (!fs.existsSync(dictLicensePath)) {
    errors.push('Missing dist/LICENSE_DICTIONARY.txt');
  } else {
    const content = fs.readFileSync(dictLicensePath, 'utf8');
    if (content.length < 500) {
      errors.push('dist/LICENSE_DICTIONARY.txt is suspiciously short');
    }
    if (!content.includes('English Wiktionary') || !content.includes('Kaikki.org')) {
      errors.push('dist/LICENSE_DICTIONARY.txt missing Wiktionary or Kaikki.org attribution');
    }
    if (!content.includes('CC-BY-SA 4.0') && !content.includes('Creative Commons Attribution-ShareAlike 4.0')) {
      errors.push('dist/LICENSE_DICTIONARY.txt missing CC-BY-SA 4.0 license declaration');
    }
    // Verify that it doesn't assert relative paths that don't exist in dist without qualifying them
    if (content.match(/^This dictionary dataset \(src\/data\//m)) {
      errors.push('dist/LICENSE_DICTIONARY.txt asserts local relative src/data/ path in package root');
    }
    console.log('  ✓ dist/LICENSE_DICTIONARY.txt valid, attribution & license terms verified.');
  }
  console.log();

  // Check 4: Third-Party Licenses File
  console.log('[Check 4] Bundled Third-Party Software Notices:');
  const thirdPartyPath = path.join(distDir, 'THIRD_PARTY_LICENSES.txt');
  if (!fs.existsSync(thirdPartyPath)) {
    errors.push('Missing dist/THIRD_PARTY_LICENSES.txt');
  } else {
    const content = fs.readFileSync(thirdPartyPath, 'utf8');
    if (content.length < 1000) {
      errors.push('dist/THIRD_PARTY_LICENSES.txt is suspiciously short');
    }
    const requiredStrings = [
      'Mozilla PDF.js',
      'pdf.worker.min.mjs',
      '4.10.38',
      'Tesseract.js',
      '7.0.0',
      'tesseract-core',
      'deu.traineddata.gz',
      'Adobe CMap',
      'Apache License',
      'Version 2.0, January 2004'
    ];
    for (const req of requiredStrings) {
      if (!content.includes(req)) {
        errors.push(`dist/THIRD_PARTY_LICENSES.txt missing required notice string: "${req}"`);
      }
    }
    console.log('  ✓ dist/THIRD_PARTY_LICENSES.txt valid, PDF.js & Tesseract notices verified.');
  }
  console.log();

  // Check 5: Bundled Subdirectory License Files
  console.log('[Check 5] Subdirectory License Files (Fonts & CMaps):');
  const subLicenses = [
    { name: 'Adobe CMap License', path: path.join(distDir, 'cmaps', 'LICENSE') },
    { name: 'Foxit Fonts License', path: path.join(distDir, 'standard_fonts', 'LICENSE_FOXIT') },
    { name: 'Liberation Fonts License', path: path.join(distDir, 'standard_fonts', 'LICENSE_LIBERATION') }
  ];

  for (const item of subLicenses) {
    if (!fs.existsSync(item.path)) {
      errors.push(`Missing license file: ${item.path}`);
    } else {
      console.log(`  ✓ ${item.name} present (${path.basename(item.path)}).`);
    }
  }
  console.log();

  // Check 6: Bundled Binary Assets & Workers
  console.log('[Check 6] Bundled Runtime Binary Assets:');
  const requiredBinaries = [
    { name: 'PDF.js Web Worker', path: path.join(distDir, 'pdf.worker.min.mjs') },
    { name: 'Tesseract Web Worker', path: path.join(distDir, 'tesseract', 'worker.min.js') },
    { name: 'Tesseract Core LSTM WASM', path: path.join(distDir, 'tesseract', 'tesseract-core-lstm.wasm') },
    { name: 'Tesseract Core SIMD WASM', path: path.join(distDir, 'tesseract', 'tesseract-core-simd-lstm.wasm') },
    { name: 'Tesseract Core Relaxed-SIMD WASM', path: path.join(distDir, 'tesseract', 'tesseract-core-relaxedsimd-lstm.wasm') },
    { name: 'German Traineddata Model', path: path.join(distDir, 'tessdata', 'deu.traineddata.gz') }
  ];

  for (const item of requiredBinaries) {
    if (!fs.existsSync(item.path)) {
      errors.push(`Missing runtime binary asset: ${item.name} at ${item.path}`);
    } else {
      const sizeMb = (fs.statSync(item.path).size / 1048576).toFixed(2);
      console.log(`  ✓ ${item.name} (${sizeMb} MB)`);
    }
  }

  // Check compiled bundles
  const assetsDir = path.join(distDir, 'assets');
  if (!fs.existsSync(assetsDir)) {
    errors.push('Missing dist/assets/ directory');
  } else {
    const assetFiles = fs.readdirSync(assetsDir);
    const jsBundles = assetFiles.filter(f => f.startsWith('viewer-') && f.endsWith('.js'));
    const cssBundles = assetFiles.filter(f => f.startsWith('viewer-') && f.endsWith('.css'));
    if (jsBundles.length === 0) errors.push('No compiled viewer-*.js bundle found in dist/assets/');
    if (cssBundles.length === 0) errors.push('No compiled viewer-*.css bundle found in dist/assets/');
    for (const js of jsBundles) {
      const jsSize = fs.statSync(path.join(assetsDir, js)).size;
      const jsSizeKb = (jsSize / 1024).toFixed(1);
      if (jsSize > 1000000) {
        errors.push(`Compiled bundle ${js} (${jsSizeKb} KB) exceeds 1.0 MB threshold! Dictionary data was likely re-bundled into JavaScript.`);
      } else {
        console.log(`  ✓ Compiled JavaScript bundle: ${js} (${jsSizeKb} KB - decoupled bundle threshold passed)`);
      }
    }
    console.log(`  ✓ Compiled CSS stylesheet: ${cssBundles.join(', ')}`);
  }
  console.log();

  // Check 7: Documentation & Metadata Reconciliation
  console.log('[Check 7] Documentation Metrics Reconciliation:');
  const readmePath = path.join(rootDir, 'README.md');
  const metaPath = path.join(rootDir, 'public', 'data', 'de-en-metadata.json');

  if (fs.existsSync(readmePath) && fs.existsSync(metaPath)) {
    const readmeContent = fs.readFileSync(readmePath, 'utf8');
    const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

    const expectedHeadwords = metadata.acceptedHeadwordsCount.toLocaleString('en-US');
    const expectedInflections = metadata.inflectionKeysCount.toLocaleString('en-US');

    if (!readmeContent.includes(expectedHeadwords)) {
      errors.push(`README.md does not contain verified headword count: "${expectedHeadwords}"`);
    }
    if (!readmeContent.includes(expectedInflections)) {
      errors.push(`README.md does not contain verified inflection count: "${expectedInflections}"`);
    }
    console.log(`  ✓ README.md matches verified metadata: ${expectedHeadwords} headwords, ${expectedInflections} inflections.`);
  } else {
    errors.push('Could not verify README.md or de-en-metadata.json');
  }
  console.log();

  // Check 8: Decoupled Standalone Dictionary Assets in dist/data/
  console.log('[Check 8] Decoupled Standalone Dictionary Assets (dist/data/):');
  const distDataDir = path.join(distDir, 'data');
  if (!fs.existsSync(distDataDir)) {
    errors.push('Missing dist/data/ directory in release package');
  } else {
    const distDictFile = path.join(distDataDir, 'de-en-dictionary.json');
    const distInflFile = path.join(distDataDir, 'de-en-inflections.json');
    const distMetaFile = path.join(distDataDir, 'de-en-metadata.json');

    if (!fs.existsSync(distDictFile)) {
      errors.push('Missing dist/data/de-en-dictionary.json');
    } else {
      try {
        const dictData = JSON.parse(fs.readFileSync(distDictFile, 'utf8'));
        const headwordCount = Object.keys(dictData).length;
        if (headwordCount < 10000) {
          errors.push(`dist/data/de-en-dictionary.json has only ${headwordCount} entries (< 10,000 threshold)`);
        } else {
          const sizeMb = (fs.statSync(distDictFile).size / 1048576).toFixed(2);
          console.log(`  ✓ dist/data/de-en-dictionary.json present (${sizeMb} MB, ${headwordCount.toLocaleString()} headwords)`);
        }
      } catch (err) {
        errors.push(`Invalid JSON in dist/data/de-en-dictionary.json: ${err.message}`);
      }
    }

    if (!fs.existsSync(distInflFile)) {
      errors.push('Missing dist/data/de-en-inflections.json');
    } else {
      try {
        const inflData = JSON.parse(fs.readFileSync(distInflFile, 'utf8'));
        const inflCount = Object.keys(inflData).length;
        if (inflCount < 40000) {
          errors.push(`dist/data/de-en-inflections.json has only ${inflCount} entries (< 40,000 threshold)`);
        } else {
          const sizeMb = (fs.statSync(distInflFile).size / 1048576).toFixed(2);
          console.log(`  ✓ dist/data/de-en-inflections.json present (${sizeMb} MB, ${inflCount.toLocaleString()} inflection keys)`);
        }
      } catch (err) {
        errors.push(`Invalid JSON in dist/data/de-en-inflections.json: ${err.message}`);
      }
    }

    if (!fs.existsSync(distMetaFile)) {
      errors.push('Missing dist/data/de-en-metadata.json');
    } else {
      try {
        const distMeta = JSON.parse(fs.readFileSync(distMetaFile, 'utf8'));
        if (distMeta.sourceSha256 !== 'ff03802fa4d034a80c03fd72a78243834cc06e69d7031c7be9d745a02c78b34e') {
          errors.push(`dist/data/de-en-metadata.json sourceSha256 mismatch: expected ff0380..., got ${distMeta.sourceSha256}`);
        } else {
          console.log(`  ✓ dist/data/de-en-metadata.json verified (pinned source SHA-256 confirmed)`);
        }
      } catch (err) {
        errors.push(`Invalid JSON in dist/data/de-en-metadata.json: ${err.message}`);
      }
    }
  }

  // Ensure no stale duplicate JSON files exist in src/data/
  const staleDictFile = path.join(rootDir, 'src', 'data', 'de-en-dictionary.json');
  const staleInflFile = path.join(rootDir, 'src', 'data', 'de-en-inflections.json');
  if (fs.existsSync(staleDictFile) || fs.existsSync(staleInflFile)) {
    errors.push('Found stale duplicate JSON files in src/data/. Only public/data/ must contain canonical dictionary assets.');
  } else {
    console.log('  ✓ No stale duplicate JSON files in src/data/ (clean single source of truth confirmed)');
  }
  console.log();

  // Summary & Exit
  console.log('=====================================================================');
  if (errors.length > 0) {
    console.error('❌ RELEASE PACKAGE VERIFICATION FAILED WITH THE FOLLOWING ERRORS:\n');
    errors.forEach((err, idx) => console.error(`  ${idx + 1}. ${err}`));
    console.error('\n=====================================================================');
    process.exit(1);
  }

  console.log('🎉 ALL RELEASE PACKAGE VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  console.log('=====================================================================\n');
  return true;
}

if (process.argv[1] && process.argv[1].endsWith('verify-release-package.mjs')) {
  verifyReleasePackage().catch(err => {
    console.error('Fatal verification error:', err);
    process.exit(1);
  });
}

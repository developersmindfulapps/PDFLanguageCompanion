import fs from 'node:fs';
import path from 'node:path';
import { LocalDictionaryProvider } from '../src/services/dictionary/LocalDictionaryProvider.ts';
import { loadDictionaryAssets } from '../src/services/dictionary/deEnDataLoader.ts';

export async function verifyPhase21Decoupling() {
  console.log('=====================================================================');
  console.log('    PDF LANGUAGE COMPANION — PHASE 2.1 DECOUPLING TEST SUITE         ');
  console.log('=====================================================================\n');

  // Test 1: Canonical Dataset Location Check
  console.log('[Test 1] Canonical File Locations & Stale File Invariant:');
  const rootDir = process.cwd();
  const publicDataDir = path.join(rootDir, 'public', 'data');
  const srcDataDir = path.join(rootDir, 'src', 'data');

  const requiredFiles = ['de-en-dictionary.json', 'de-en-inflections.json', 'de-en-metadata.json'];
  for (const f of requiredFiles) {
    const pubFile = path.join(publicDataDir, f);
    if (!fs.existsSync(pubFile)) {
      throw new Error(`Canonical file missing: public/data/${f}`);
    }
    const srcFile = path.join(srcDataDir, f);
    if (fs.existsSync(srcFile)) {
      throw new Error(`Stale duplicate file still present in src/data/${f}! Must be removed.`);
    }
  }
  console.log('  ✓ public/data/ is the single canonical source of truth.');
  console.log('  ✓ No stale duplicate JSON files in src/data/.\n');

  // Test 2: Standard Lookup Regression Cases
  console.log('[Test 2] Asynchronous Lookup Regression Cases:');
  const provider = new LocalDictionaryProvider();

  const testCases = [
    { word: 'Haus', expectedPOS: 'noun', expectedTranslation: 'house', expectedGender: 'n' },
    { word: 'arbeiten', expectedPOS: 'verb', expectedTranslation: 'to work' },
    { word: 'ging', expectedLemma: 'gehen', expectedTranslation: 'to go' },
    { word: 'Büchern', expectedLemma: 'Buch', expectedTranslation: 'book' },
    { word: 'schönste', expectedLemma: 'schön', expectedTranslation: 'beautiful' },
    { word: 'ins', expectedTranslation: 'into the' },
    { word: 'am', expectedTranslation: 'at the' },
    { word: 'Lieblingsfilm', expectedTranslation: 'favorite film', expectedGender: 'm' },
    { word: 'Lieblingsmusik', expectedSource: 'compositional', expectedTranslation: 'favorite music' },
    { word: 'Telefonnummer', expectedTranslation: 'telephone number', expectedGender: 'f' }
  ];

  for (const tc of testCases) {
    const result = await provider.lookup(tc.word, 'de', 'en');
    if (!result) {
      throw new Error(`Lookup failed for "${tc.word}": returned null`);
    }
    if (tc.expectedTranslation && !result.translations.some(t => t.toLowerCase().includes(tc.expectedTranslation.toLowerCase()))) {
      throw new Error(`Translation mismatch for "${tc.word}": got [${result.translations.join(', ')}]`);
    }
    if (tc.expectedGender && result.gender !== tc.expectedGender) {
      throw new Error(`Gender mismatch for "${tc.word}": expected ${tc.expectedGender}, got ${result.gender}`);
    }
    if (tc.expectedLemma && result.lemma?.toLowerCase() !== tc.expectedLemma.toLowerCase()) {
      throw new Error(`Lemma mismatch for "${tc.word}": expected ${tc.expectedLemma}, got ${result.lemma}`);
    }
    if (tc.expectedSource && result.source !== tc.expectedSource) {
      throw new Error(`Source mismatch for "${tc.word}": expected ${tc.expectedSource}, got ${result.source}`);
    }
    console.log(`  ✓ "${tc.word}" -> resolved (${result.translations[0]}${result.gender ? ' [' + result.gender + ']' : ''})`);
  }
  console.log('  ✓ All 10 regression test cases resolved accurately.\n');

  // Test 3: Concurrent Initialization & Promise Deduplication
  console.log('[Test 3] Concurrent Initialization & Concurrency Strategy:');
  let loadCallCount = 0;
  const mockCountingLoader = async () => {
    loadCallCount++;
    return await loadDictionaryAssets();
  };

  const concurrentProvider = new LocalDictionaryProvider(undefined, undefined, mockCountingLoader);
  if (concurrentProvider.isInitialized()) {
    throw new Error('Provider should not be initialized before lookup/ensureInitialized');
  }

  // Fire 50 concurrent lookups simultaneously
  const concurrentWords = ['Haus', 'Buch', 'gehen', 'arbeiten', 'Stadt', 'Tag', 'Mensch', 'Frau', 'Mann', 'Kind'];
  const promises = [];
  for (let i = 0; i < 50; i++) {
    const word = concurrentWords[i % concurrentWords.length];
    promises.push(concurrentProvider.lookup(word, 'de', 'en'));
  }

  const results = await Promise.all(promises);
  for (let i = 0; i < results.length; i++) {
    if (!results[i]) throw new Error(`Concurrent lookup ${i} failed`);
  }

  if (loadCallCount !== 1) {
    throw new Error(`Concurrent calls triggered ${loadCallCount} loads instead of exactly 1!`);
  }
  if (!concurrentProvider.isInitialized()) {
    throw new Error('Provider should report isInitialized() === true after loading');
  }
  console.log(`  ✓ 50 concurrent lookups resolved with exactly ${loadCallCount} underlying data load.\n`);

  // Test 4: Asset Load Failure Discrimination (Error vs. Not Found)
  console.log('[Test 4] Asset Load Failure vs. Word Not Found Discrimination:');
  let shouldFail = true;
  const mockFailingLoader = async () => {
    if (shouldFail) {
      throw new Error('Simulated network/disk I/O error');
    }
    return await loadDictionaryAssets();
  };

  const failingProvider = new LocalDictionaryProvider(undefined, undefined, mockFailingLoader);
  let errorCaught = false;
  try {
    await failingProvider.lookup('Haus', 'de', 'en');
  } catch (err) {
    errorCaught = true;
    if (!err.message.includes('Simulated network/disk I/O error')) {
      throw new Error(`Unexpected error message: ${err.message}`);
    }
  }

  if (!errorCaught) {
    throw new Error('Lookup should have rejected on load failure, but resolved!');
  }
  if (failingProvider.isInitialized()) {
    throw new Error('Provider should NOT be marked initialized on load failure');
  }
  if (!failingProvider.getInitializationError()) {
    throw new Error('Provider getInitializationError() should record failure');
  }
  console.log('  ✓ Load failure throws explicit Error; does NOT masquerade as "Word not found".');

  // Test 5: Self-Healing Retry
  console.log('\n[Test 5] Self-Healing Retry After Load Failure:');
  shouldFail = false; // Fix failure
  const retryResult = await failingProvider.lookup('Haus', 'de', 'en');
  if (!retryResult || !retryResult.translations.includes('house')) {
    throw new Error('Retry after failure did not resolve correctly');
  }
  if (!failingProvider.isInitialized()) {
    throw new Error('Provider should be initialized after successful retry');
  }
  if (failingProvider.getInitializationError() !== null) {
    throw new Error('Provider getInitializationError() should be cleared after successful retry');
  }
  console.log('  ✓ Provider cleanly recovers and re-initializes on subsequent lookup.\n');

  // Test 6: True "Word Not Found" Behavior
  console.log('[Test 6] True "Word Not Found" Return Value Contract:');
  const healthyProvider = new LocalDictionaryProvider();
  const notFoundResult = await healthyProvider.lookup('NonExistentGermanToken12345', 'de', 'en');
  if (notFoundResult !== null) {
    throw new Error(`Expected null for unknown word, got: ${JSON.stringify(notFoundResult)}`);
  }
  console.log('  ✓ Unknown word returns null cleanly without throwing.\n');

  console.log('=====================================================================');
  console.log('🎉 ALL PHASE 2.1 DECOUPLING TESTS PASSED SUCCESSFULLY!');
  console.log('=====================================================================\n');
  return true;
}

if (process.argv[1] && process.argv[1].endsWith('verify-phase21-decoupling.mjs')) {
  verifyPhase21Decoupling().catch((err) => {
    console.error('Fatal verification error:', err);
    process.exit(1);
  });
}

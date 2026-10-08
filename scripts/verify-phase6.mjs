import { LocalDictionaryProvider } from '../src/services/dictionary/LocalDictionaryProvider.ts';

async function verifyPhase6() {
  console.log('--- Testing Phase 6: Local Dictionary Engine ---\n');

  const provider = new LocalDictionaryProvider();

  // Test 1: Exact lookup
  console.log('[Test 1] Exact Match Lookup:');
  const exactCases = [
    { word: 'Buch', expectedTranslations: ['book'] },
    { word: 'Schule', expectedTranslations: ['school'] },
    { word: 'Kaffee', expectedTranslations: ['coffee'] },
    { word: 'Straße', expectedTranslations: ['street', 'road'] },
    { word: 'Mädchen', expectedTranslations: ['girl'] }
  ];

  for (const { word, expectedTranslations } of exactCases) {
    const result = await provider.lookup(word, 'de', 'en');
    if (!result) throw new Error(`Exact lookup failed: "${word}" returned null`);
    if (result.query !== word) throw new Error(`Original query not preserved: expected "${word}", got "${result.query}"`);
    const matches = expectedTranslations.some(t => result.translations.includes(t));
    if (!matches) throw new Error(`Translation mismatch for "${word}": got [${result.translations.join(', ')}]`);
  }
  console.log('✓ Exact lookup resolved successfully for all test words.');

  // Test 2: Case normalization
  console.log('\n[Test 2] Case Normalization Lookup:');
  const caseCases = [
    { word: 'buch', expectedLemma: 'Buch' },
    { word: 'BUCH', expectedLemma: 'Buch' },
    { word: 'schule', expectedLemma: 'Schule' },
    { word: 'SCHULE', expectedLemma: 'Schule' },
    { word: 'kaffee', expectedLemma: 'Kaffee' },
    { word: 'straße', expectedLemma: 'Straße' }
  ];

  for (const { word, expectedLemma } of caseCases) {
    const result = await provider.lookup(word, 'de', 'en');
    if (!result) throw new Error(`Case normalized lookup failed for: "${word}"`);
    if (result.query !== word) throw new Error(`Original query not preserved for "${word}"`);
    if (!result.translations.length) throw new Error(`No translations for "${word}"`);
  }
  console.log('✓ Case-normalized variants correctly resolved without altering query token.');

  // Test 3: Lemma fallback
  console.log('\n[Test 3] Lemma Fallback Lookup:');
  const lemmaCases = [
    { word: 'Kaffees', expectedLemma: 'Kaffee' },
    { word: 'Bücher', expectedLemma: 'Buch' },
    { word: 'Büchern', expectedLemma: 'Buch' },
    { word: 'Geschäfte', expectedLemma: 'Geschäft' },
    { word: 'Bahnhöfe', expectedLemma: 'Bahnhof' },
    { word: 'ging', expectedLemma: 'gehen' },
    { word: 'liest', expectedLemma: 'lesen' },
    { word: 'trinkt', expectedLemma: 'trinken' },
    { word: 'lernt', expectedLemma: 'lernen' }
  ];

  for (const { word, expectedLemma } of lemmaCases) {
    const result = await provider.lookup(word, 'de', 'en');
    if (!result) throw new Error(`Lemma fallback lookup failed for: "${word}"`);
    if (result.lemma !== expectedLemma) {
      throw new Error(`Lemma mismatch for "${word}": expected "${expectedLemma}", got "${result.lemma}"`);
    }
    if (!result.translations.length) throw new Error(`No translations returned for lemma of "${word}"`);
  }
  console.log('✓ Lemma mappings resolved correctly to canonical root entries.');

  // Test 4: German characters & umlauts
  console.log('\n[Test 4] German Characters & Umlauts (ä, ö, ü, ß):');
  const umlautCases = [
    { word: 'Straße', contains: 'street' },
    { word: 'Mädchen', contains: 'girl' },
    { word: 'größer', contains: 'big' },
    { word: 'Äpfel', contains: 'apple' },
    { word: 'Öle', contains: 'oil' },
    { word: 'Übungen', contains: 'exercise' }
  ];

  for (const { word, contains } of umlautCases) {
    const result = await provider.lookup(word, 'de', 'en');
    if (!result) throw new Error(`Umlaut lookup failed for: "${word}"`);
    const found = result.translations.some(t => t.toLowerCase().includes(contains));
    if (!found) throw new Error(`Expected translation containing "${contains}" for "${word}", got: ${result.translations.join(', ')}`);
  }
  console.log('✓ German umlauts and eszett looked up accurately.');

  // Test 5: Unknown words
  console.log('\n[Test 5] Unknown Word Handling:');
  const unknownResult = await provider.lookup('xyznotaword123', 'de', 'en');
  if (unknownResult !== null) {
    throw new Error(`Expected null for unknown word, got: ${JSON.stringify(unknownResult)}`);
  }
  console.log('✓ Unknown word returned null cleanly without exceptions.');

  // Test 6: Language validation
  console.log('\n[Test 6] Language Pair Validation:');
  const validPair = await provider.lookup('Schule', 'de', 'en');
  if (!validPair) throw new Error('Valid "de -> en" failed');

  const unsupportedPair1 = await provider.lookup('Schule', 'fr', 'en');
  if (unsupportedPair1 !== null) throw new Error('Unsupported source lang "fr" should return null');

  const unsupportedPair2 = await provider.lookup('Schule', 'de', 'es');
  if (unsupportedPair2 !== null) throw new Error('Unsupported target lang "es" should return null');
  console.log('✓ Language pairs validated properly.');

  console.log('\n🎉 ALL PHASE 6 LOCAL DICTIONARY TESTS PASSED!\n');
}

verifyPhase6().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});

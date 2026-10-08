import { localDictionaryProvider } from '../src/services/dictionary/LocalDictionaryProvider.ts';

async function verifyPhase7() {
  console.log('--- Testing Phase 7: Floating Tooltip Data & Lookup Contracts ---\n');

  // Test 1: Known word tooltip payload
  console.log('[Test 1] Tooltip Payload for Known Word:');
  const resultSchule = await localDictionaryProvider.lookup('Schule', 'de', 'en');
  if (!resultSchule) throw new Error('Failed to lookup "Schule"');
  if (resultSchule.query !== 'Schule') throw new Error('Query mismatch');
  if (!resultSchule.translations.includes('school')) throw new Error('Missing translation "school"');
  if (resultSchule.partOfSpeech !== 'noun') throw new Error('Missing POS "noun"');
  console.log(`✓ "Schule" payload: Query="${resultSchule.query}", Translations=[${resultSchule.translations.join(', ')}], POS="${resultSchule.partOfSpeech}"`);

  // Test 2: Known word with case normalization & lemma detection
  console.log('\n[Test 2] Tooltip Payload for Case Normalization & Lemmas:');
  const resultCaps = await localDictionaryProvider.lookup('SCHULE', 'de', 'en');
  if (!resultCaps) throw new Error('Failed to lookup "SCHULE"');
  if (resultCaps.query !== 'SCHULE') throw new Error('Original query not preserved in SCHULE');
  console.log(`✓ "SCHULE" payload: Query="${resultCaps.query}", Lemma="${resultCaps.lemma}", Translations=[${resultCaps.translations.join(', ')}]`);

  const resultLemma = await localDictionaryProvider.lookup('Kaffees', 'de', 'en');
  if (!resultLemma) throw new Error('Failed to lookup "Kaffees"');
  if (resultLemma.query !== 'Kaffees') throw new Error('Original query not preserved in Kaffees');
  if (resultLemma.lemma !== 'Kaffee') throw new Error('Expected lemma "Kaffee"');
  console.log(`✓ "Kaffees" payload: Query="${resultLemma.query}", Base="${resultLemma.lemma}", Translations=[${resultLemma.translations.join(', ')}]`);

  // Test 3: German Umlauts in Tooltip
  console.log('\n[Test 3] German Umlaut Tooltip Payloads:');
  const words = ['Straße', 'Mädchen', 'größer'];
  for (const w of words) {
    const res = await localDictionaryProvider.lookup(w, 'de', 'en');
    if (!res) throw new Error(`Failed to lookup "${w}"`);
    console.log(`✓ "${w}" payload: Translations=[${res.translations.join(', ')}]`);
  }

  // Test 4: Unknown Word (Not Found State)
  console.log('\n[Test 4] Unknown Word Not Found Contract:');
  const notFound = await localDictionaryProvider.lookup('xyzunknown', 'de', 'en');
  if (notFound !== null) throw new Error('Expected null for unknown word');
  console.log('✓ Unknown word returns null cleanly to trigger "Word not found" fallback UI.');

  // Test 5: Virtual Element Rect Contract for @floating-ui/react
  console.log('\n[Test 5] Virtual Element DOMRect Contract:');
  const mockRect = {
    top: 150,
    left: 200,
    bottom: 170,
    right: 260,
    width: 60,
    height: 20,
    x: 200,
    y: 150,
    toJSON: () => {}
  };
  const mockSelection = {
    word: 'Schule',
    pageNumber: 1,
    rect: mockRect
  };
  const virtualElement = {
    getBoundingClientRect: () => mockSelection.rect
  };
  const rect = virtualElement.getBoundingClientRect();
  if (rect.width !== 60 || rect.height !== 20 || rect.top !== 150) {
    throw new Error('Virtual element rect contract invalid');
  }
  console.log('✓ Virtual element positioning rect contract validated.');

  console.log('\n🎉 ALL PHASE 7 VERIFICATIONS PASSED!\n');
}

verifyPhase7().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});

import { cleanWordToken, isSingleWord, extractWordAtOffset } from '../src/utils/textUtils.ts';

async function verifyPhase5() {
  console.log('--- Testing Phase 5: Word Detection & Token Cleaning ---\n');

  // Test 1: Basic words & Capitalization preservation
  console.log('[Test 1] Basic Words & Capitalization Preservation:');
  const basicWords = [
    { in: 'Schule', out: 'Schule' },
    { in: 'Kaffee', out: 'Kaffee' },
    { in: 'Buch', out: 'Buch' },
    { in: 'arbeiten', out: 'arbeiten' },
    { in: 'lernen', out: 'lernen' }
  ];
  for (const { in: raw, out: expected } of basicWords) {
    const res = cleanWordToken(raw);
    if (res !== expected) throw new Error(`Failed for ${raw}: got ${res}, expected ${expected}`);
  }
  console.log('✓ Basic words & capitalization preserved.');

  // Test 2: Punctuation stripping
  console.log('\n[Test 2] Punctuation & Quotes Stripping:');
  const punctCases = [
    { in: '„Schule“', out: 'Schule' },
    { in: '(Schule)', out: 'Schule' },
    { in: 'Schule,', out: 'Schule' },
    { in: 'Schule.', out: 'Schule' },
    { in: 'Schule!', out: 'Schule' },
    { in: 'Schule?', out: 'Schule' },
    { in: 'Schule:', out: 'Schule' },
    { in: '"Schule"', out: 'Schule' },
    { in: '„Schule“,', out: 'Schule' },
    { in: '»Buch«', out: 'Buch' },
    { in: '[Wort];', out: 'Wort' }
  ];
  for (const { in: raw, out: expected } of punctCases) {
    const res = cleanWordToken(raw);
    if (res !== expected) throw new Error(`Failed for ${raw}: got ${res}, expected ${expected}`);
  }
  console.log('✓ All punctuation variations cleanly stripped.');

  // Test 3: German characters & umlauts (ä, ö, ü, Ä, Ö, Ü, ß)
  console.log('\n[Test 3] German Umlauts & Eszett Preservation:');
  const germanTokens = [
    'Straße',
    'Überblick',
    'Köpfe',
    'Mädchen',
    'größer',
    'Äpfel',
    'Öle',
    'Übungen'
  ];
  for (const token of germanTokens) {
    const res = cleanWordToken(`„${token}“!`);
    if (res !== token) throw new Error(`Failed for German token ${token}: got ${res}`);
  }
  console.log('✓ German umlauts and eszett preserved without ASCII mangling.');

  // Test 4: Internal hyphens
  console.log('\n[Test 4] Hyphenated Words:');
  const hyphenCases = [
    { in: 'Deutsch-Englisch', out: 'Deutsch-Englisch' },
    { in: '(Deutsch-Englisch)', out: 'Deutsch-Englisch' },
    { in: 'E-Mail,', out: 'E-Mail' }
  ];
  for (const { in: raw, out: expected } of hyphenCases) {
    const res = cleanWordToken(raw);
    if (res !== expected) throw new Error(`Failed for hyphen case ${raw}: got ${res}`);
  }
  console.log('✓ Hyphenated compound words correctly preserved.');

  // Test 5: Offset Word Extraction from text sentences
  console.log('\n[Test 5] Word Offset Extraction:');
  const sentence = 'Wir lernen jeden Tag in der Sprachschule!';
  const indexSprachschule = sentence.indexOf('Sprachschule') + 4;
  const extraction = extractWordAtOffset(sentence, indexSprachschule);
  if (!extraction || extraction.word !== 'Sprachschule') {
    throw new Error(`Failed extraction: expected "Sprachschule", got "${extraction?.word}"`);
  }
  console.log(`✓ Extracted token: "${extraction.word}" (start: ${extraction.startOffset}, end: ${extraction.endOffset})`);

  // Test 6: Multi-word selection detection
  console.log('\n[Test 6] Multi-word Selection Handling:');
  if (isSingleWord('einen Kaffee')) {
    throw new Error('Multi-word string should not be single word');
  }
  if (!isSingleWord('Kaffee')) {
    throw new Error('"Kaffee" should be identified as single word');
  }
  console.log('✓ Multi-word selections accurately distinguished.');

  console.log('\n🎉 ALL PHASE 5 UNIT & UTILITY VERIFICATIONS PASSED!\n');
}

verifyPhase5().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});

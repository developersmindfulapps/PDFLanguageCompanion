import { cleanWordToken, isSingleWord, extractWordAtOffset } from '../src/utils/textUtils.ts';

function runTests() {
  console.log('--- Running Text Utilities Unit Tests ---');

  const testCases = [
    // Basic words
    { input: 'Schule', expected: 'Schule' },
    { input: 'Kaffee', expected: 'Kaffee' },
    { input: 'Buch', expected: 'Buch' },

    // Punctuation & Quotes
    { input: '„Schule“', expected: 'Schule' },
    { input: '(Schule)', expected: 'Schule' },
    { input: 'Schule,', expected: 'Schule' },
    { input: 'Schule.', expected: 'Schule' },
    { input: 'Schule!', expected: 'Schule' },
    { input: 'Schule?', expected: 'Schule' },
    { input: 'Schule:', expected: 'Schule' },
    { input: '"Schule"', expected: 'Schule' },
    { input: '«Schule»', expected: 'Schule' },
    { input: '[Schule]', expected: 'Schule' },
    { input: '„Schule“,', expected: 'Schule' },

    // German umlauts & special characters
    { input: 'Straße', expected: 'Straße' },
    { input: 'Überblick', expected: 'Überblick' },
    { input: 'Köpfe', expected: 'Köpfe' },
    { input: 'Mädchen', expected: 'Mädchen' },
    { input: 'größer', expected: 'größer' },
    { input: 'Äpfel', expected: 'Äpfel' },
    { input: 'Öle', expected: 'Öle' },
    { input: 'Übungen', expected: 'Übungen' },
    { input: '„Größerer“', expected: 'Größerer' },

    // Hyphen
    { input: 'Deutsch-Englisch', expected: 'Deutsch-Englisch' },
    { input: '-Deutsch-Englisch-', expected: 'Deutsch-Englisch' },

    // Whitespace
    { input: '   Kaffee   ', expected: 'Kaffee' },
    { input: '\n\tBuch\n', expected: 'Buch' },
  ];

  let passed = 0;
  for (const { input, expected } of testCases) {
    const result = cleanWordToken(input);
    if (result !== expected) {
      console.error(`❌ cleanWordToken("${input}") failed. Expected "${expected}", got "${result}"`);
      process.exit(1);
    }
    passed++;
  }
  console.log(`✓ Passed all ${passed} cleanWordToken test cases.`);

  // Test isSingleWord
  if (!isSingleWord('Schule')) throw new Error('isSingleWord("Schule") should be true');
  if (!isSingleWord('„Schule“,')) throw new Error('isSingleWord("„Schule“,") should be true');
  if (isSingleWord('einen Kaffee')) throw new Error('isSingleWord("einen Kaffee") should be false');
  if (isSingleWord('')) throw new Error('isSingleWord("") should be false');
  console.log('✓ Passed isSingleWord test cases.');

  // Test extractWordAtOffset
  const sampleSentence = 'Ich möchte einen Kaffee trinken.';
  // 'Kaffee' is from index 17 to 23
  const kaffeeOffset = sampleSentence.indexOf('Kaffee') + 2; // clicking inside 'Kaffee'
  const extracted = extractWordAtOffset(sampleSentence, kaffeeOffset);
  if (!extracted || extracted.word !== 'Kaffee') {
    throw new Error(`extractWordAtOffset failed. Expected "Kaffee", got "${extracted?.word}"`);
  }
  console.log(`✓ Passed extractWordAtOffset on sentence ("${sampleSentence}" -> "${extracted.word}").`);

  // Test extractWordAtOffset on German umlauts
  const umlautSentence = 'Die Straße ist gesperrt.';
  const strasseOffset = umlautSentence.indexOf('Straße') + 3;
  const extractedStrasse = extractWordAtOffset(umlautSentence, strasseOffset);
  if (!extractedStrasse || extractedStrasse.word !== 'Straße') {
    throw new Error(`extractWordAtOffset failed for Straße. Got "${extractedStrasse?.word}"`);
  }
  console.log(`✓ Passed extractWordAtOffset on umlaut sentence ("${umlautSentence}" -> "${extractedStrasse.word}").`);

  console.log('\n🎉 ALL TEXT UTILITY TESTS PASSED!\n');
}

runTests();

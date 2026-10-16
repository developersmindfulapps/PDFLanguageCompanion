import fs from 'node:fs';
import path from 'node:path';
import { localDictionaryProvider } from '../src/services/dictionary/LocalDictionaryProvider.ts';
import { normalizeBoundingBox, projectToViewport } from '../src/services/ocr/ocrUtils.ts';
import { cleanWordToken, isSingleWord, extractWordAtOffset } from '../src/utils/textUtils.ts';

async function verifyPhase34() {
  console.log('=====================================================================');
  console.log('   PDF LANGUAGE COMPANION — PHASE 3.4 VERIFICATION TEST SUITE       ');
  console.log('   Real-World German Compounds & OCR Word Selection Bug Fix         ');
  console.log('=====================================================================\n');

  // -------------------------------------------------------------
  // PART 1: Real-World Kursbuch Compound & Core Word Resolution
  // -------------------------------------------------------------
  console.log('[Test 1] Real-World Kursbuch Vocabulary Lookups & Contract Verification:');

  const vocabularyTests = [
    {
      word: 'Telefonnummer',
      expectedTranslation: 'telephone number',
      expectedPos: 'noun',
      expectedGender: 'f',
      expectedPlural: 'Telefonnummern',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'Lieblingsfilm',
      expectedTranslation: 'favorite film',
      expectedPos: 'noun',
      expectedGender: 'm',
      expectedPlural: 'Lieblingsfilme',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'Lieblingsmusik',
      expectedTranslation: 'favorite music',
      expectedPos: 'noun',
      expectedGender: 'f',
      expectedLemma: 'Liebling + Musik',
      expectedSource: 'compositional',
      expectedIsDerived: true,
      exactTranslations: ['favorite music'],
    },
    {
      word: 'Nachname',
      expectedTranslation: 'last name',
      expectedPos: 'noun',
      expectedGender: 'm',
      expectedPlural: 'Nachnamen',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'Geburtsdatum',
      expectedTranslation: 'date of birth',
      expectedPos: 'noun',
      expectedGender: 'n',
      expectedPlural: 'Geburtsdaten',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'Vorname',
      expectedTranslation: 'given name',
      expectedPos: 'noun',
      expectedGender: 'm',
      expectedPlural: 'Vornamen',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'Wohnort',
      expectedTranslation: 'place of residence',
      expectedPos: 'noun',
      expectedGender: 'm',
      expectedPlural: 'Wohnorte',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'Interessen',
      expectedTranslation: 'interest',
      expectedPos: 'noun',
      expectedGender: 'n',
      expectedLemma: 'Interesse',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'Interesse',
      expectedTranslation: 'interest',
      expectedPos: 'noun',
      expectedGender: 'n',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'Telefon',
      expectedTranslation: 'telephone',
      expectedPos: 'noun',
      expectedGender: 'n',
      expectedPlural: 'Telefone',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'Nummer',
      expectedTranslation: 'number',
      expectedPos: 'noun',
      expectedGender: 'f',
      expectedPlural: 'Nummern',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'Liebling',
      expectedTranslation: 'darling',
      expectedPos: 'noun',
      expectedGender: 'm',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'Musik',
      expectedTranslation: 'music',
      expectedPos: 'noun',
      expectedGender: 'f',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'Lieblingsbuch',
      expectedTranslation: 'favorite book',
      expectedPos: 'noun',
      expectedGender: 'n',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
  ];

  for (const t of vocabularyTests) {
    const result = await localDictionaryProvider.lookup(t.word, 'de', 'en');
    if (!result) {
      throw new Error(`Lookup failed for "${t.word}": returned null`);
    }

    const hasMatch = result.translations.some(tr =>
      tr.toLowerCase().includes(t.expectedTranslation.toLowerCase())
    );
    if (!hasMatch) {
      throw new Error(
        `Translation mismatch for "${t.word}": expected to contain "${t.expectedTranslation}", got [${result.translations.join(', ')}]`
      );
    }

    if (t.exactTranslations) {
      if (
        result.translations.length !== t.exactTranslations.length ||
        !result.translations.every((tr, idx) => tr === t.exactTranslations[idx])
      ) {
        throw new Error(
          `Exact translations mismatch for "${t.word}": expected [${t.exactTranslations.join(', ')}], got [${result.translations.join(', ')}]`
        );
      }
    }

    if (t.expectedPos && !result.partOfSpeech.includes(t.expectedPos)) {
      throw new Error(
        `POS mismatch for "${t.word}": expected "${t.expectedPos}", got "${result.partOfSpeech}"`
      );
    }

    if (t.expectedGender && result.gender !== t.expectedGender) {
      throw new Error(
        `Gender mismatch for "${t.word}": expected "${t.expectedGender}", got "${result.gender}"`
      );
    }

    if (t.expectedPlural && result.plural !== t.expectedPlural) {
      throw new Error(
        `Plural mismatch for "${t.word}": expected "${t.expectedPlural}", got "${result.plural}"`
      );
    }

    if (t.expectedLemma && result.lemma !== t.expectedLemma) {
      throw new Error(
        `Lemma mismatch for "${t.word}": expected "${t.expectedLemma}", got "${result.lemma}"`
      );
    }

    if (t.expectedSource && result.source !== t.expectedSource) {
      throw new Error(
        `Source mismatch for "${t.word}": expected "${t.expectedSource}", got "${result.source}"`
      );
    }

    if (t.expectedIsDerived !== undefined && result.isDerived !== t.expectedIsDerived) {
      throw new Error(
        `isDerived mismatch for "${t.word}": expected ${t.expectedIsDerived}, got ${result.isDerived}`
      );
    }

    console.log(
      `  ✓ "${t.word}" -> POS: ${result.partOfSpeech}${result.gender ? ` (${result.gender})` : ''}${result.plural ? `, Plural: ${result.plural}` : ''}${result.lemma ? `, Lemma: ${result.lemma}` : ''} [source: ${result.source}, isDerived: ${result.isDerived}] -> [${result.translations.join(', ')}]`
    );
  }
  console.log('✓ All 14 real-world Kursbuch vocabulary items & metadata contracts verified.\n');

  // -------------------------------------------------------------
  // PART 2: OCR Word Selection & Partial/Phantom Selection Logic
  // -------------------------------------------------------------
  console.log('[Test 2] OCR Word Selection & Exact/Partial Rules:');

  /**
   * Pure reproduction of the OCR selection resolver from useWordSelection.ts
   */
  function simulateOcrSelection({
    isCollapsed,
    startSpanWord,
    endSpanWord,
    selectedText,
  }) {
    // 1. Collapsed click rejection
    if (isCollapsed) return null;

    // 2. Multi-span selection rejection
    if (startSpanWord !== endSpanWord) return null;

    // 3. Multiword rejection
    if (!isSingleWord(selectedText)) return null;

    // 4. Exact word verification
    const fullCleaned = cleanWordToken(startSpanWord);
    const selectedCleaned = cleanWordToken(selectedText);

    if (!fullCleaned || !selectedCleaned || selectedCleaned.toLowerCase() !== fullCleaned.toLowerCase()) {
      return null;
    }

    return fullCleaned;
  }

  const targetWords = ['Lieblingsfilm', 'Telefonnummer', 'Vorname', 'Nachname'];

  for (const word of targetWords) {
    // 2a. Simple collapsed click -> null
    const clickResult = simulateOcrSelection({
      isCollapsed: true,
      startSpanWord: word,
      endSpanWord: word,
      selectedText: '',
    });
    if (clickResult !== null) throw new Error(`Collapsed click on "${word}" should return null`);

    // 2b. Exact selection of word -> word
    const exactResult = simulateOcrSelection({
      isCollapsed: false,
      startSpanWord: word,
      endSpanWord: word,
      selectedText: word,
    });
    if (exactResult !== word) throw new Error(`Exact selection on "${word}" failed: got ${exactResult}`);

    // 2c. Double-click (selects entire word token in span) -> word
    const dblClickResult = simulateOcrSelection({
      isCollapsed: false,
      startSpanWord: word,
      endSpanWord: word,
      selectedText: ` ${word} `,
    });
    if (dblClickResult !== word) throw new Error(`Double-click selection on "${word}" failed`);

    // 2d. Punctuation around word -> cleaned word
    const punctResult1 = simulateOcrSelection({
      isCollapsed: false,
      startSpanWord: `„${word}“`,
      endSpanWord: `„${word}“`,
      selectedText: `„${word}“`,
    });
    if (punctResult1 !== word) throw new Error(`Punctuation selection 1 on "${word}" failed`);

    const punctResult2 = simulateOcrSelection({
      isCollapsed: false,
      startSpanWord: `(${word},)`,
      endSpanWord: `(${word},)`,
      selectedText: `(${word},)`,
    });
    if (punctResult2 !== word) throw new Error(`Punctuation selection 2 on "${word}" failed`);

    // 2e. Partial selection: Beginning -> null
    const partialBeg = word.slice(0, Math.floor(word.length * 0.7));
    const partialBegResult = simulateOcrSelection({
      isCollapsed: false,
      startSpanWord: word,
      endSpanWord: word,
      selectedText: partialBeg,
    });
    if (partialBegResult !== null) throw new Error(`Partial beginning "${partialBeg}" of "${word}" should return null`);

    // 2f. Partial selection: Middle -> null
    const partialMid = word.slice(2, -2);
    const partialMidResult = simulateOcrSelection({
      isCollapsed: false,
      startSpanWord: word,
      endSpanWord: word,
      selectedText: partialMid,
    });
    if (partialMidResult !== null) throw new Error(`Partial middle "${partialMid}" of "${word}" should return null`);

    // 2g. Partial selection: Ending -> null
    const partialEnd = word.slice(Math.floor(word.length * 0.4));
    const partialEndResult = simulateOcrSelection({
      isCollapsed: false,
      startSpanWord: word,
      endSpanWord: word,
      selectedText: partialEnd,
    });
    if (partialEndResult !== null) throw new Error(`Partial ending "${partialEnd}" of "${word}" should return null`);

    // 2h. Multiword / Neighbor span selection (e.g. word + "ht") -> null
    const multiSpanResult = simulateOcrSelection({
      isCollapsed: false,
      startSpanWord: word,
      endSpanWord: 'ht',
      selectedText: `${word} ht`,
    });
    if (multiSpanResult !== null) throw new Error(`Multi-span selection on "${word} ht" should return null`);

    console.log(`  ✓ "${word}": Exact=PASS, DoubleClick=PASS, Punctuation=PASS, PartialBeg=REJECT, PartialMid=REJECT, PartialEnd=REJECT, MultiSpan=REJECT, Click=REJECT`);
  }
  console.log('✓ OCR selection invariant verified for all test words.\n');

  // -------------------------------------------------------------
  // PART 3: Normal Text-PDF Mode Selection Verification
  // -------------------------------------------------------------
  console.log('[Test 3] Normal Text-PDF Mode Selection Invariant:');

  // 3a. Click at offset inside normal text line
  const textLine = 'Guten Morgen, wie geht es Ihnen?';
  const offsetClick1 = extractWordAtOffset(textLine, 2); // 'Guten'
  if (!offsetClick1 || offsetClick1.word !== 'Guten') throw new Error('Normal PDF click offset failed on Guten');
  const offsetClick2 = extractWordAtOffset(textLine, 8); // 'Morgen'
  if (!offsetClick2 || offsetClick2.word !== 'Morgen') throw new Error('Normal PDF click offset failed on Morgen');

  console.log(`  ✓ Normal text-PDF single click: offset 2 -> "${offsetClick1.word}", offset 8 -> "${offsetClick2.word}" (preserved)`);

  // 3b. Drag selection in normal text-PDF mode
  const dragSingleWord = 'Lieblingsfilm';
  if (!isSingleWord(dragSingleWord)) throw new Error('isSingleWord failed on single word');
  const dragCleaned = cleanWordToken(dragSingleWord);
  if (dragCleaned !== 'Lieblingsfilm') throw new Error('cleanWordToken failed');

  const dragMultiWord = 'Lieblingsfilm und Musik';
  if (isSingleWord(dragMultiWord)) throw new Error('isSingleWord unexpectedly passed multiword');

  console.log(`  ✓ Normal text-PDF drag selection: single word passes, multi-word rejected.\n`);

  // -------------------------------------------------------------
  // PART 4: Geometric Scaling Across Zoom Levels
  // -------------------------------------------------------------
  console.log('[Test 4] OCR Coordinate Projection Across Zoom Levels:');

  const rawBbox = { x0: 100, y0: 150, x1: 250, y1: 180 };
  const imageWidth = 1000;
  const imageHeight = 1400;

  const normalized = normalizeBoundingBox(rawBbox, imageWidth, imageHeight);
  if (normalized.normX !== 0.1 || normalized.normY !== 150 / 1400 || normalized.normWidth !== 0.15 || normalized.normHeight !== 30 / 1400) {
    throw new Error(`Normalization error: ${JSON.stringify(normalized)}`);
  }

  const zoomLevels = [
    { name: '50%', width: 500, height: 700, expectedLeft: 50, expectedTop: 75, expectedWidth: 75, expectedHeight: 15 },
    { name: '75%', width: 750, height: 1050, expectedLeft: 75, expectedTop: 112.5, expectedWidth: 112.5, expectedHeight: 22.5 },
    { name: '100%', width: 1000, height: 1400, expectedLeft: 100, expectedTop: 150, expectedWidth: 150, expectedHeight: 30 },
    { name: '125%', width: 1250, height: 1750, expectedLeft: 125, expectedTop: 187.5, expectedWidth: 187.5, expectedHeight: 37.5 },
    { name: '150%', width: 1500, height: 2100, expectedLeft: 150, expectedTop: 225, expectedWidth: 225, expectedHeight: 45 },
    { name: '200%', width: 2000, height: 2800, expectedLeft: 200, expectedTop: 300, expectedWidth: 300, expectedHeight: 60 },
    { name: 'Fit-Width (1120px)', width: 1120, height: 1568, expectedLeft: 112, expectedTop: 168, expectedWidth: 168, expectedHeight: 33.6 },
  ];

  for (const z of zoomLevels) {
    const proj = projectToViewport(normalized, z.width, z.height);
    if (
      Math.abs(proj.left - z.expectedLeft) > 0.01 ||
      Math.abs(proj.top - z.expectedTop) > 0.01 ||
      Math.abs(proj.width - z.expectedWidth) > 0.01 ||
      Math.abs(proj.height - z.expectedHeight) > 0.01
    ) {
      throw new Error(`Zoom projection mismatch at ${z.name}: got ${JSON.stringify(proj)}`);
    }
    console.log(`  ✓ Zoom ${z.name.padEnd(18)}: left=${proj.left}px, top=${proj.top}px, width=${proj.width}px, height=${proj.height}px (1:1 exact projection)`);
  }
  console.log('✓ Viewport coordinate projection mathematically verified across all 7 zoom states.\n');

  // -------------------------------------------------------------
  // PART 5: Metadata & Offline Invariant Audit
  // -------------------------------------------------------------
  console.log('[Test 5] Offline & Dataset Metadata Audit:');

  const metaPath = path.resolve(process.cwd(), 'public', 'data', 'de-en-metadata.json');
  const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

  if (metadata.sourceSha256 !== 'ff03802fa4d034a80c03fd72a78243834cc06e69d7031c7be9d745a02c78b34e') {
    throw new Error(`Pinned SHA-256 mismatch: ${metadata.sourceSha256}`);
  }

  if (metadata.acceptedHeadwordsCount < 14000 || metadata.acceptedHeadwordsCount > 16000) {
    throw new Error(`Headword count outside target range: ${metadata.acceptedHeadwordsCount}`);
  }

  if (metadata.inflectionKeysCount < 90000) {
    throw new Error(`Inflection keys count unexpectedly low: ${metadata.inflectionKeysCount}`);
  }

  console.log(`  ✓ Pinned Source: ${metadata.source}`);
  console.log(`  ✓ Snapshot Date: ${metadata.snapshotDate}`);
  console.log(`  ✓ Verified SHA-256: ${metadata.sourceSha256}`);
  console.log(`  ✓ Headword Count: ${metadata.acceptedHeadwordsCount}`);
  console.log(`  ✓ Inflection Keys: ${metadata.inflectionKeysCount}`);
  console.log(`  ✓ License: ${metadata.license}`);

  console.log('\n=====================================================================');
  console.log('🎉 ALL PHASE 3.4 VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  console.log('=====================================================================\n');
}

verifyPhase34().catch((err) => {
  console.error('Phase 3.4 verification failed:', err);
  process.exit(1);
});

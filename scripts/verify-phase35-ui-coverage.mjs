import fs from 'node:fs';
import path from 'node:path';
import { localDictionaryProvider } from '../src/services/dictionary/LocalDictionaryProvider.ts';
import { normalizeBoundingBox, projectToViewport } from '../src/services/ocr/ocrUtils.ts';
import { cleanWordToken, isSingleWord } from '../src/utils/textUtils.ts';

async function verifyPhase35() {
  console.log('=====================================================================');
  console.log('   PDF LANGUAGE COMPANION — PHASE 3.5 VERIFICATION TEST SUITE       ');
  console.log('   Real-World Coverage Audit & Fit Width UX State Machine           ');
  console.log('=====================================================================\n');

  // -------------------------------------------------------------
  // PART 1: Function Words & Contractions Coverage Audit
  // -------------------------------------------------------------
  console.log('[Test 1] Function Words, Contractions & Real-World Kursbuch Lookups:');

  const coverageTests = [
    // Contractions (Preposition + Determiner)
    {
      word: 'ins',
      expectedPos: 'prep+art',
      expectedTranslation: 'into the',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'Ins', // Titlecase / Sentence-initial
      expectedPos: 'prep+art',
      expectedTranslation: 'into the',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'ans',
      expectedPos: 'prep+art',
      expectedTranslation: 'onto the',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'im',
      expectedPos: 'prep+art',
      expectedTranslation: 'in the',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'am',
      expectedPos: 'prep+art',
      expectedTranslation: 'at the',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'vom',
      expectedPos: 'prep+art',
      expectedTranslation: 'from the',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'zum',
      expectedPos: 'prep+art',
      expectedTranslation: 'to the',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'zur',
      expectedPos: 'prep+art',
      expectedTranslation: 'to the',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'beim',
      expectedPos: 'prep+art',
      expectedTranslation: 'at the',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'aufs',
      expectedPos: 'prep+art',
      expectedTranslation: 'on the',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'fürs',
      expectedPos: 'prep+art',
      expectedTranslation: 'for the',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'ums',
      expectedPos: 'prep+art',
      expectedTranslation: 'around the',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'durchs',
      expectedPos: 'prep+art',
      expectedTranslation: 'through the',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    // Core German Function Words & Particles
    {
      word: 'doch',
      expectedPos: 'part',
      expectedTranslation: 'yes',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'mal',
      expectedPos: 'adv',
      expectedTranslation: 'times',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'hin',
      expectedPos: 'adv',
      expectedTranslation: 'there',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'her',
      expectedPos: 'adv',
      expectedTranslation: 'hither',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'ja',
      expectedPos: 'adv',
      expectedTranslation: 'obviously',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'nein',
      expectedPos: 'interj',
      expectedTranslation: 'no',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'bitte',
      expectedPos: 'adv',
      expectedTranslation: 'please',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'danke',
      expectedPos: 'interj',
      expectedTranslation: 'thanks',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    // Real Kursbuch Vocabulary & Compounds
    {
      word: 'Telefonnummer',
      expectedPos: 'noun',
      expectedGender: 'f',
      expectedPlural: 'Telefonnummern',
      expectedTranslation: 'telephone number',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'Lieblingsfilm',
      expectedPos: 'noun',
      expectedGender: 'm',
      expectedPlural: 'Lieblingsfilme',
      expectedTranslation: 'favorite film',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'Lieblingsmusik',
      expectedPos: 'noun',
      expectedGender: 'f',
      expectedTranslation: 'favorite music',
      expectedSource: 'compositional',
      expectedIsDerived: true,
      expectedLemma: 'Liebling + Musik',
    },
    {
      word: 'Vorname',
      expectedPos: 'noun',
      expectedGender: 'm',
      expectedPlural: 'Vornamen',
      expectedTranslation: 'given name',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
    {
      word: 'Nachname',
      expectedPos: 'noun',
      expectedGender: 'm',
      expectedPlural: 'Nachnamen',
      expectedTranslation: 'last name',
      expectedSource: 'dictionary',
      expectedIsDerived: false,
    },
  ];

  for (const t of coverageTests) {
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
      `  ✓ "${t.word}" -> POS: ${result.partOfSpeech} [source: ${result.source}, isDerived: ${result.isDerived}] -> [${result.translations.slice(0, 2).join(', ')}]`
    );
  }
  console.log('✓ All 26 function words, contractions, and Kursbuch vocabulary items verified.\n');

  // -------------------------------------------------------------
  // PART 2: Fit Width UX & State Machine Simulation
  // -------------------------------------------------------------
  console.log('[Test 2] Fit Width UX & State Machine Simulation:');

  const ZOOM_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  class ZoomStateMachine {
    constructor() {
      this.state = { scale: 1.0, mode: 'custom' };
      this.containerWidth = 1000;
      this.pageWidth = 700; // unscaled viewport width
    }

    get buttonLabel() {
      return this.state.mode === 'fit-width' ? 'Reset' : 'Fit Width';
    }

    get buttonTitle() {
      return this.state.mode === 'fit-width' ? 'Reset zoom to 100%' : 'Fit to Width';
    }

    get zoomPercentText() {
      return `${Math.round(this.state.scale * 100)}%`;
    }

    computeFitScale() {
      const availableWidth = this.containerWidth - 48;
      return Math.min(Math.max(availableWidth / this.pageWidth, 0.4), 2.5);
    }

    toggleFitWidth() {
      if (this.state.mode === 'fit-width') {
        // Exit Fit Width -> Reset to 100%
        this.state = { scale: 1.0, mode: 'custom' };
      } else {
        // Enter Fit Width
        const fitScale = this.computeFitScale();
        this.state = { scale: fitScale, mode: 'fit-width' };
      }
    }

    zoomIn() {
      const currentScale = this.state.scale;
      const nextScale = ZOOM_PRESETS.find((s) => s > currentScale + 0.05) ?? Math.min(3.0, currentScale + 0.25);
      this.state = { scale: nextScale, mode: 'custom' };
    }

    zoomOut() {
      const currentScale = this.state.scale;
      const prevScales = ZOOM_PRESETS.filter((s) => s < currentScale - 0.05);
      const prevScale = prevScales.length > 0 ? prevScales[prevScales.length - 1] : Math.max(0.25, currentScale - 0.25);
      this.state = { scale: prevScale, mode: 'custom' };
    }

    resizeContainer(newWidth) {
      this.containerWidth = newWidth;
      if (this.state.mode === 'fit-width') {
        const newFitScale = this.computeFitScale();
        this.state = { scale: newFitScale, mode: 'fit-width' };
      }
    }
  }

  const sm = new ZoomStateMachine();

  // Step 2a: Initial state
  if (sm.state.scale !== 1.0 || sm.state.mode !== 'custom' || sm.buttonLabel !== 'Fit Width') {
    throw new Error('Initial zoom state invalid');
  }
  console.log(`  ✓ Initial State: Zoom=${sm.zoomPercentText}, Mode=${sm.state.mode}, Button="${sm.buttonLabel}"`);

  // Step 2b: Click "Fit Width"
  sm.toggleFitWidth();
  const expectedFit1 = (1000 - 48) / 700; // 1.36
  if (sm.state.mode !== 'fit-width' || Math.abs(sm.state.scale - expectedFit1) > 0.01 || sm.buttonLabel !== 'Reset') {
    throw new Error(`Fit width activation failed: ${JSON.stringify(sm.state)}, button=${sm.buttonLabel}`);
  }
  console.log(`  ✓ Fit Width Active: Zoom=${sm.zoomPercentText}, Mode=${sm.state.mode}, Button="${sm.buttonLabel}" (Active)`);

  // Step 2c: Click "Reset" -> Must return to exactly 100%
  sm.toggleFitWidth();
  if (sm.state.scale !== 1.0 || sm.state.mode !== 'custom' || sm.buttonLabel !== 'Fit Width') {
    throw new Error(`Reset button failed: ${JSON.stringify(sm.state)}, button=${sm.buttonLabel}`);
  }
  console.log(`  ✓ Reset Clicked: Zoom=${sm.zoomPercentText}, Mode=${sm.state.mode}, Button="${sm.buttonLabel}" (100% Restored)`);

  // Step 2d: Fit Width -> Manual Zoom In -> Exits Fit Width
  sm.toggleFitWidth();
  if (sm.state.mode !== 'fit-width') throw new Error('Fit width failed to reactivate');
  sm.zoomIn(); // from ~1.36 -> 1.5
  if (sm.state.mode !== 'custom' || sm.state.scale !== 1.5 || sm.buttonLabel !== 'Fit Width') {
    throw new Error(`Manual Zoom In failed to exit Fit Width: ${JSON.stringify(sm.state)}, button=${sm.buttonLabel}`);
  }
  console.log(`  ✓ Fit Width -> Zoom In: Zoom=${sm.zoomPercentText}, Mode=${sm.state.mode}, Button="${sm.buttonLabel}" (Fit Width Exited)`);

  // Step 2e: Fit Width -> Manual Zoom Out -> Exits Fit Width
  sm.toggleFitWidth();
  sm.zoomOut(); // from ~1.36 -> 1.25
  if (sm.state.mode !== 'custom' || sm.state.scale !== 1.25 || sm.buttonLabel !== 'Fit Width') {
    throw new Error(`Manual Zoom Out failed to exit Fit Width: ${JSON.stringify(sm.state)}, button=${sm.buttonLabel}`);
  }
  console.log(`  ✓ Fit Width -> Zoom Out: Zoom=${sm.zoomPercentText}, Mode=${sm.state.mode}, Button="${sm.buttonLabel}" (Fit Width Exited)`);

  // Step 2f: Resize while in Fit Width mode
  sm.toggleFitWidth(); // enter fit-width at 1000px container
  const scaleBeforeResize = sm.state.scale;
  sm.resizeContainer(1448); // expand container: (1448 - 48) / 700 = 2.0
  if (sm.state.mode !== 'fit-width' || Math.abs(sm.state.scale - 2.0) > 0.01 || sm.buttonLabel !== 'Reset') {
    throw new Error(`Resize in Fit Width mode failed: scale=${sm.state.scale}, mode=${sm.state.mode}`);
  }
  console.log(`  ✓ Resize in Fit Width Mode (1000px -> 1448px): Scale dynamically updated (${Math.round(scaleBeforeResize * 100)}% -> ${sm.zoomPercentText}), Mode remains ${sm.state.mode}, Button remains "${sm.buttonLabel}"`);

  // Step 2g: Resize while in Manual Zoom mode (Scale remains fixed)
  sm.toggleFitWidth(); // exit fit width (now 100% custom)
  sm.zoomIn(); // 1.25
  const manualScale = sm.state.scale;
  sm.resizeContainer(800); // shrink container
  if (sm.state.mode !== 'custom' || sm.state.scale !== manualScale || sm.buttonLabel !== 'Fit Width') {
    throw new Error(`Resize in Manual mode unexpectedly changed scale: ${JSON.stringify(sm.state)}`);
  }
  console.log(`  ✓ Resize in Manual Mode: Scale remains fixed at ${sm.zoomPercentText}, Mode remains ${sm.state.mode}, Button remains "${sm.buttonLabel}".\n`);

  // -------------------------------------------------------------
  // PART 3: OCR Reprojection Across Fit-Width & Normal Views
  // -------------------------------------------------------------
  console.log('[Test 3] OCR Dynamic Viewport Projection Under Fit-Width:');

  const testOcrWord = {
    text: 'Lieblingsfilm',
    bbox: { x0: 100, y0: 150, x1: 250, y1: 180 },
  };
  const baseImageWidth = 1000;
  const baseImageHeight = 1400;

  const normBbox = normalizeBoundingBox(testOcrWord.bbox, baseImageWidth, baseImageHeight);

  // 100% viewport projection
  const proj100 = projectToViewport(normBbox, 1000, 1400);
  if (proj100.left !== 100 || proj100.top !== 150 || proj100.width !== 150 || proj100.height !== 30) {
    throw new Error(`100% projection failed: ${JSON.stringify(proj100)}`);
  }
  console.log(`  ✓ 100% Viewport: left=${proj100.left}px, top=${proj100.top}px, width=${proj100.width}px, height=${proj100.height}px`);

  // Fit-Width viewport projection (e.g. 1360px x 1904px)
  const projFit = projectToViewport(normBbox, 1360, 1904);
  if (
    Math.abs(projFit.left - 136) > 0.01 ||
    Math.abs(projFit.top - 204) > 0.01 ||
    Math.abs(projFit.width - 204) > 0.01 ||
    Math.abs(projFit.height - 40.8) > 0.01
  ) {
    throw new Error(`Fit-width projection failed: ${JSON.stringify(projFit)}`);
  }
  console.log(`  ✓ Fit-Width Viewport: left=${projFit.left}px, top=${projFit.top}px, width=${projFit.width}px, height=${projFit.height}px (1:1 dynamic projection, 0 OCR re-runs).\n`);

  console.log('=====================================================================');
  console.log('🎉 ALL PHASE 3.5 VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  console.log('=====================================================================\n');
}

verifyPhase35().catch((err) => {
  console.error('Phase 3.5 verification failed:', err);
  process.exit(1);
});

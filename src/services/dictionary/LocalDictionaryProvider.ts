import type {
  DictionaryProvider,
  DictionaryResult,
  DictionaryData,
} from '../../types/dictionary.ts';
import { deEnDictionaryData } from '../../data/deEnDictionary.ts';

export class LocalDictionaryProvider implements DictionaryProvider {
  public readonly id = 'local-de-en';
  public readonly name = 'Local German-English Dictionary';

  private data: DictionaryData;
  private caseInsensitiveIndex: Map<string, { originalKey: string; t: string[]; pos?: string; lemma?: string }>;
  private lemmaIndex: Map<string, string>;

  constructor(customData?: DictionaryData) {
    this.data = customData || deEnDictionaryData;
    this.caseInsensitiveIndex = new Map();
    this.lemmaIndex = new Map();

    this.buildIndices();
  }

  private buildIndices(): void {
    const entries = this.data.entries || {};
    for (const [key, val] of Object.entries(entries)) {
      const lower = key.toLowerCase();
      // Store primary casing in index
      if (!this.caseInsensitiveIndex.has(lower) || key[0] === key[0].toUpperCase()) {
        this.caseInsensitiveIndex.set(lower, {
          originalKey: key,
          t: val.t,
          pos: val.pos,
          lemma: val.lemma,
        });
      }
    }

    const lemmas = this.data.lemmas || {};
    for (const [inflected, lemma] of Object.entries(lemmas)) {
      this.lemmaIndex.set(inflected.toLowerCase(), lemma);
    }
  }

  /**
   * Looks up a German word and resolves to its English translations.
   * Lookup priority:
   * 1. Exact match
   * 2. Case-normalized variant
   * 3. Simple known lemma mapping
   * 4. Returns null if not found
   */
  public async lookup(
    word: string,
    sourceLang: string,
    targetLang: string
  ): Promise<DictionaryResult | null> {
    // 1. Language validation: Only German -> English is supported for MVP
    if (sourceLang.toLowerCase() !== 'de' || targetLang.toLowerCase() !== 'en') {
      return null;
    }

    const query = word.trim();
    if (!query) {
      return null;
    }

    const entries = this.data.entries;

    // 2. Step 1 — Exact match
    if (entries && Object.prototype.hasOwnProperty.call(entries, query)) {
      const match = entries[query];
      return {
        query,
        lemma: match.lemma,
        sourceLang: 'de',
        targetLang: 'en',
        translations: [...match.t],
        partOfSpeech: match.pos,
      };
    }

    // 3. Step 2 — Case-normalized lookup
    const lowerQuery = query.toLowerCase();
    const caseMatch = this.caseInsensitiveIndex.get(lowerQuery);
    if (caseMatch) {
      return {
        query,
        lemma: caseMatch.lemma || (caseMatch.originalKey !== query ? caseMatch.originalKey : undefined),
        sourceLang: 'de',
        targetLang: 'en',
        translations: [...caseMatch.t],
        partOfSpeech: caseMatch.pos,
      };
    }

    // 4. Step 3 — Simple lemma fallback
    const targetLemma = this.lemmaIndex.get(lowerQuery);
    if (targetLemma) {
      // Look up lemma entry
      const lemmaLower = targetLemma.toLowerCase();
      const lemmaEntry = this.caseInsensitiveIndex.get(lemmaLower) || entries[targetLemma];
      if (lemmaEntry) {
        return {
          query,
          lemma: targetLemma,
          sourceLang: 'de',
          targetLang: 'en',
          translations: [...lemmaEntry.t],
          partOfSpeech: lemmaEntry.pos,
        };
      }
    }

    // 5. Unknown word: return null cleanly
    return null;
  }
}

export const localDictionaryProvider = new LocalDictionaryProvider();

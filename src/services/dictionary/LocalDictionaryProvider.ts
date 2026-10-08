import type {
  DictionaryProvider,
  DictionaryResult,
  HeadwordEntry,
  LexicalSense,
} from '../../types/dictionary.ts';
import { deEnDictionary, deEnInflections } from '../../data/deEnDictionary.ts';

/**
 * Common German inflectional suffixes for rule-based adjective/participle fallback.
 * Ordered from longest to shortest suffix.
 */
const INFLECTION_SUFFIXES = [
  'esten', 'ester', 'estes', 'estem', 'este',
  'enden', 'endem', 'ender', 'endes', 'ende',
  'sten', 'ster', 'stes', 'stem', 'ste',
  'tem', 'ten', 'ter', 'tes', 'te',
  'en', 'em', 'er', 'es', 'e', 'st', 't'
];

export class LocalDictionaryProvider implements DictionaryProvider {
  public readonly id = 'local-de-en';
  public readonly name = 'Local German-English Dictionary';

  private entries: Record<string, HeadwordEntry>;
  private inflections: Record<string, string>;

  constructor(
    customEntries?: Record<string, HeadwordEntry>,
    customInflections?: Record<string, string>
  ) {
    this.entries = customEntries || deEnDictionary;
    this.inflections = customInflections || deEnInflections;
  }

  /**
   * Helper to format a HeadwordEntry into a DictionaryResult.
   */
  private formatResult(query: string, entry: HeadwordEntry, lemma?: string): DictionaryResult {
    const senses: LexicalSense[] = entry.senses || [];
    const allTranslations: string[] = [];
    const posSet = new Set<string>();
    let gender: 'm' | 'f' | 'n' | undefined;
    let plural: string | undefined;

    for (const sense of senses) {
      if (sense.pos) posSet.add(sense.pos);
      if (sense.gender && !gender) gender = sense.gender;
      if (sense.plural && !plural) plural = sense.plural;
      for (const t of sense.translations) {
        if (!allTranslations.includes(t)) {
          allTranslations.push(t);
        }
      }
    }

    return {
      query,
      lemma: lemma && lemma !== query ? lemma : undefined,
      sourceLang: 'de',
      targetLang: 'en',
      translations: allTranslations,
      partOfSpeech: Array.from(posSet).join('/'),
      gender,
      plural,
      senses,
    };
  }

  /**
   * Looks up a German word and resolves to its English translations.
   * Multi-stage lookup pipeline:
   * 1. Exact case-sensitive match (preserves homographs: Sie vs sie, Morgen vs morgen)
   * 2. Case-disambiguated fallback (e.g. sentence-initial Gehen -> gehen, lowercase buch -> Buch)
   * 3. Precompiled inflection index lookup (e.g. häuser -> Haus, ging -> gehen)
   * 4. Morphological suffix stripping fallback (e.g. schnelles -> schnell)
   * 5. Returns null if unknown
   */
  public async lookup(
    word: string,
    sourceLang: string,
    targetLang: string
  ): Promise<DictionaryResult | null> {
    if (!word) return null;

    // Validate languages (German -> English)
    if (sourceLang.toLowerCase() !== 'de' || targetLang.toLowerCase() !== 'en') {
      return null;
    }

    const query = word.trim();
    if (!query) return null;

    // 1. Stage 1 — Exact case-sensitive match
    if (Object.prototype.hasOwnProperty.call(this.entries, query)) {
      return this.formatResult(query, this.entries[query]);
    }

    // 2. Stage 2 — Case-disambiguated match
    // If capitalized, try lowercase (sentence-initial verbs, adjectives, etc.)
    if (query[0] === query[0].toUpperCase() && query.length > 1) {
      const lower = query.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(this.entries, lower)) {
        return this.formatResult(query, this.entries[lower], lower);
      }
    }
    // If lowercase, try capitalized (nouns typed or scanned in lowercase)
    if (query[0] === query[0].toLowerCase()) {
      const capitalized = query[0].toUpperCase() + query.slice(1);
      if (Object.prototype.hasOwnProperty.call(this.entries, capitalized)) {
        return this.formatResult(query, this.entries[capitalized], capitalized);
      }
    }

    // 3. Stage 3 — Precompiled inflection index
    const lowerQuery = query.toLowerCase();
    const mappedLemma = this.inflections[lowerQuery];
    if (mappedLemma) {
      if (Object.prototype.hasOwnProperty.call(this.entries, mappedLemma)) {
        return this.formatResult(query, this.entries[mappedLemma], mappedLemma);
      }
    }

    // 4. Stage 4 — Morphological suffix stripping fallback (adjectives / participles)
    if (lowerQuery.length >= 5) {
      for (const suffix of INFLECTION_SUFFIXES) {
        if (lowerQuery.endsWith(suffix) && lowerQuery.length - suffix.length >= 3) {
          const stem = lowerQuery.slice(0, -suffix.length);

          // Direct stem check
          if (Object.prototype.hasOwnProperty.call(this.entries, stem)) {
            return this.formatResult(query, this.entries[stem], stem);
          }

          // Capitalized stem check
          const capStem = stem[0].toUpperCase() + stem.slice(1);
          if (Object.prototype.hasOwnProperty.call(this.entries, capStem)) {
            return this.formatResult(query, this.entries[capStem], capStem);
          }

          // Stem in inflections index
          const stemLemma = this.inflections[stem];
          if (stemLemma && Object.prototype.hasOwnProperty.call(this.entries, stemLemma)) {
            return this.formatResult(query, this.entries[stemLemma], stemLemma);
          }
        }
      }
    }

    return null;
  }
}

export const localDictionaryProvider = new LocalDictionaryProvider();

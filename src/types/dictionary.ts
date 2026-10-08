/**
 * Type definitions for dictionary lookups, providers, and results.
 */

export interface DictionaryResult {
  query: string;
  lemma?: string;
  sourceLang: string;
  targetLang: string;
  translations: string[];
  partOfSpeech?: string;
}

export interface DictionaryEntry {
  translations: string[];
  partOfSpeech?: string;
  lemma?: string;
}

export interface DictionaryData {
  version: string;
  source: string;
  license: string;
  entries: Record<string, { t: string[]; pos?: string; lemma?: string }>;
  lemmas?: Record<string, string>;
}

export interface DictionaryProvider {
  id: string;
  name: string;

  lookup(
    word: string,
    sourceLang: string,
    targetLang: string
  ): Promise<DictionaryResult | null>;
}

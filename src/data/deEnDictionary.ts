import type { DictionaryData, HeadwordEntry } from '../types/dictionary.ts';
import { loadDictionaryAssets, type LoadedDictionaryData } from '../services/dictionary/deEnDataLoader.ts';

export { loadDictionaryAssets, type LoadedDictionaryData };
export type { HeadwordEntry };

/**
 * Loads the German-English dictionary dataset asynchronously.
 */
export async function getDeEnDictionaryData(): Promise<DictionaryData> {
  const { entries, inflections } = await loadDictionaryAssets();
  return {
    version: '1.0.0',
    source: 'Kaikki.org English Wiktionary (German Entries)',
    license: 'CC-BY-SA 4.0 / GFDL',
    entries,
    lemmas: inflections,
  };
}

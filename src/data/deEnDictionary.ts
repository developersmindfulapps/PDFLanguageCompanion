import type { DictionaryData, HeadwordEntry } from '../types/dictionary.ts';
import dictionaryJson from './de-en-dictionary.json' with { type: 'json' };
import inflectionsJson from './de-en-inflections.json' with { type: 'json' };
import metadataJson from './de-en-metadata.json' with { type: 'json' };

export const deEnDictionary: Record<string, HeadwordEntry> = dictionaryJson as Record<string, HeadwordEntry>;
export const deEnInflections: Record<string, string> = inflectionsJson as Record<string, string>;
export const deEnMetadata = metadataJson;

export const deEnDictionaryData: DictionaryData = {
  version: metadataJson.generatorVersion || '1.0.0',
  source: metadataJson.source || 'Kaikki.org English Wiktionary (German Entries)',
  license: metadataJson.license || 'CC-BY-SA 4.0 / GFDL',
  entries: deEnDictionary,
  lemmas: deEnInflections,
};

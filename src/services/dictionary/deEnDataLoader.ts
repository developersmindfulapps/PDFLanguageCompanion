import type { HeadwordEntry } from '../../types/dictionary.ts';

export interface LoadedDictionaryData {
  entries: Record<string, HeadwordEntry>;
  inflections: Record<string, string>;
}

/**
 * Resolves the relative asset path to a fully qualified URL or path
 * depending on whether the code is running in a Chrome Extension or Vite dev server.
 */
export function resolveDataAssetUrl(relativePath: string): string {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    try {
      return chrome.runtime.getURL(relativePath);
    } catch {
      // Fallback if chrome.runtime is partially mocked or unavailable
    }
  }
  // Vite dev server serves public/ directory directly at root
  return `/${relativePath}`;
}

/**
 * Dedicated, environment-aware data loader for German-English dictionary assets.
 * 
 * In Chrome Extension & Web Browser:
 *   Loads assets via fetch() using local packaged URLs (100% offline).
 * 
 * In Node.js (CLI verification & regression scripts):
 *   Loads assets via node:fs from the canonical public/data directory.
 * 
 * Atomic Validation:
 *   Both assets must successfully load, parse as valid JSON, and meet minimum
 *   vocabulary thresholds before either is returned.
 */
export async function loadDictionaryAssets(): Promise<LoadedDictionaryData> {
  // 1. Node.js Environment (Automated CLI verification scripts)
  if (typeof window === 'undefined') {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const baseDir = path.resolve(process.cwd(), 'public', 'data');
    const dictPath = path.join(baseDir, 'de-en-dictionary.json');
    const inflPath = path.join(baseDir, 'de-en-inflections.json');

    if (!fs.existsSync(dictPath) || !fs.existsSync(inflPath)) {
      throw new Error(`Dictionary asset files missing in ${baseDir}`);
    }

    const entries = JSON.parse(fs.readFileSync(dictPath, 'utf8')) as Record<string, HeadwordEntry>;
    const inflections = JSON.parse(fs.readFileSync(inflPath, 'utf8')) as Record<string, string>;

    validateDictionaryAssets(entries, inflections);
    return { entries, inflections };
  }

  // 2. Browser & Chrome Extension Environment
  const dictUrl = resolveDataAssetUrl('data/de-en-dictionary.json');
  const inflUrl = resolveDataAssetUrl('data/de-en-inflections.json');

  const [dictRes, inflRes] = await Promise.all([
    fetch(dictUrl),
    fetch(inflUrl)
  ]);

  if (!dictRes.ok) {
    throw new Error(`Failed to load dictionary dataset from ${dictUrl}: HTTP ${dictRes.status}`);
  }
  if (!inflRes.ok) {
    throw new Error(`Failed to load inflections dataset from ${inflUrl}: HTTP ${inflRes.status}`);
  }

  const [entries, inflections] = await Promise.all([
    dictRes.json() as Promise<Record<string, HeadwordEntry>>,
    inflRes.json() as Promise<Record<string, string>>
  ]);

  validateDictionaryAssets(entries, inflections);
  return { entries, inflections };
}

/**
 * Validates that both loaded dictionary assets meet expected structure and thresholds.
 */
function validateDictionaryAssets(
  entries: Record<string, HeadwordEntry>,
  inflections: Record<string, string>
): void {
  if (!entries || typeof entries !== 'object') {
    throw new Error('Dictionary entries failed validation: expected non-null object');
  }
  if (!inflections || typeof inflections !== 'object') {
    throw new Error('Dictionary inflections failed validation: expected non-null object');
  }

  const entryCount = Object.keys(entries).length;
  const inflectionCount = Object.keys(inflections).length;

  if (entryCount < 10000) {
    throw new Error(`Dictionary entries failed validation: expected >= 10,000, got ${entryCount}`);
  }
  if (inflectionCount < 40000) {
    throw new Error(`Dictionary inflections failed validation: expected >= 40,000, got ${inflectionCount}`);
  }
}

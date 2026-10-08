/**
 * Utility functions for German word tokenization, cleaning, and boundary extraction.
 */

// Matches leading and trailing non-letter, non-number characters (punctuation, quotes, brackets, whitespace)
// Preserves internal word characters, German umlauts (ä, ö, ü, Ä, Ö, Ü, ß), and internal hyphens.
const LEADING_NON_WORD = /^[^\p{L}\p{N}]+/u;
const TRAILING_NON_WORD = /[^\p{L}\p{N}]+$/u;

/**
 * Checks if a single character is a letter (including German umlauts/eszett) or digit.
 */
export function isWordChar(char: string): boolean {
  if (!char || char.length !== 1) return false;
  return /[\p{L}\p{N}]/u.test(char);
}

/**
 * Checks if a character is valid inside a token (word character or hyphen).
 */
export function isTokenChar(char: string): boolean {
  if (!char || char.length !== 1) return false;
  return isWordChar(char) || char === '-';
}

/**
 * Strips surrounding punctuation, quotes, brackets, and whitespace from a token
 * while preserving original capitalization, German characters, and internal hyphens.
 *
 * Examples:
 *   "„Schule“"  -> "Schule"
 *   "(Schule)"  -> "Schule"
 *   "Schule,"   -> "Schule"
 *   "Straße!"   -> "Straße"
 *   "Deutsch-Englisch" -> "Deutsch-Englisch"
 */
export function cleanWordToken(rawText: string): string {
  if (!rawText) return '';
  
  let cleaned = rawText.trim();
  cleaned = cleaned.replace(LEADING_NON_WORD, '');
  cleaned = cleaned.replace(TRAILING_NON_WORD, '');

  return cleaned;
}

/**
 * Validates whether a given string contains exactly one single word token.
 */
export function isSingleWord(text: string): boolean {
  const cleaned = cleanWordToken(text);
  if (!cleaned) return false;
  return !/\s/.test(cleaned);
}

export interface WordExtractionResult {
  word: string;
  startOffset: number;
  endOffset: number;
}

/**
 * Extracts a word token and its character boundaries from a Text node at a given offset.
 */
export function extractWordAtOffset(text: string, offset: number): WordExtractionResult | null {
  if (!text || offset < 0 || offset > text.length) {
    return null;
  }

  // Adjust offset if clicked at whitespace right after a word
  let targetOffset = offset;
  if (targetOffset >= text.length || !isTokenChar(text[targetOffset])) {
    if (targetOffset > 0 && isTokenChar(text[targetOffset - 1])) {
      targetOffset = targetOffset - 1;
    } else {
      return null;
    }
  }

  // Find start boundary (move left)
  let start = targetOffset;
  while (start > 0 && isTokenChar(text[start - 1])) {
    start--;
  }

  // Find end boundary (move right)
  let end = targetOffset;
  while (end < text.length && isTokenChar(text[end])) {
    end++;
  }

  const rawSub = text.slice(start, end);
  const cleaned = cleanWordToken(rawSub);

  if (!cleaned) {
    return null;
  }

  // Adjust start and end offsets to match cleaned token
  const leadingOffset = rawSub.indexOf(cleaned);
  const finalStart = start + (leadingOffset >= 0 ? leadingOffset : 0);
  const finalEnd = finalStart + cleaned.length;

  return {
    word: cleaned,
    startOffset: finalStart,
    endOffset: finalEnd,
  };
}

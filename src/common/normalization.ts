/**
 * Manuscript AI - Persian & Arabic Unicode Text Normalization Engine
 *
 * Provides historical manuscript text normalization without modifying the original raw text:
 * - Unifies Arabic Yeh (ي \u064A) and Persian Yeh (ی \u06CC), Yeh with Hamza (ئ \u0626), Alef Maqsura (ى \u0649)
 * - Unifies Arabic Kaf (ك \u0643) and Persian Kaf (ک \u06A9)
 * - Normalizes Alef variations (آ \u0622, أ \u0623, إ \u0625, ٱ \u0671 -> ا \u0627)
 * - Strips Tashkeel / Harakat (diacritics: Fatha, Damma, Kasra, Sukun, Shadda, Tanween)
 * - Strips Tatweel / Kashida (ـ \u0640)
 * - Normalizes Zero-Width Non-Joiner (ZWNJ \u200C) and collapses excessive whitespace
 * - Applies Unicode NFKC normalization
 */

// Diacritics / Harakat range (\u064B to \u065F, plus Quranic annotations \u0670, \u06D6-\u06ED)
const HARAKAT_REGEX = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;

// Tatweel / Kashida character
const TATWEEL_REGEX = /\u0640/g;

// Alef variants
const ALEF_VARIANTS_REGEX = /[\u0622\u0623\u0625\u0671]/g;

// Arabic Teh Marbuta to Heh or standard Heh
const TEH_MARBUTA_REGEX = /\u0629/g;

// Multiple ZWNJ or ZWNJ at word boundaries
const ZWNJ = '\u200C';
const MULTIPLE_ZWNJ_REGEX = /\u200C+/g;
const BOUNDARY_ZWNJ_REGEX = /(^\u200C+|\u200C+$|\s\u200C|\u200C\s)/g;

export interface NormalizationOptions {
  unifyYeh?: boolean;
  unifyKaf?: boolean;
  unifyAlef?: boolean;
  removeDiacritics?: boolean;
  removeTatweel?: boolean;
  cleanZwnj?: boolean;
  unifyNumbers?: boolean;
}

const DEFAULT_OPTIONS: NormalizationOptions = {
  unifyYeh: true,
  unifyKaf: true,
  unifyAlef: true,
  removeDiacritics: true,
  removeTatweel: true,
  cleanZwnj: true,
  unifyNumbers: true,
};

/**
 * Normalizes Persian and Arabic text for robust full-text search and indexing.
 * Preserves the original raw string in caller records while creating an indexed search representation.
 */
export function normalizePersianArabicText(
  input: string,
  options: NormalizationOptions = DEFAULT_OPTIONS,
): string {
  if (!input) return '';

  // Step 1: Unicode NFKC decomposition/composition
  let text = input.normalize('NFKC');

  // Step 2: Remove diacritics / harakat if enabled
  if (options.removeDiacritics !== false) {
    text = text.replace(HARAKAT_REGEX, '');
  }

  // Step 3: Remove Tatweel (elongation)
  if (options.removeTatweel !== false) {
    text = text.replace(TATWEEL_REGEX, '');
  }

  // Step 4: Unify Yeh variants
  // Convert Arabic Yeh (\u064A) and Alef Maqsura (\u0649) to Persian Yeh (\u06CC)
  if (options.unifyYeh !== false) {
    text = text
      .replace(/\u064A/g, '\u06CC') // Arabic Yeh -> Persian Yeh
      .replace(/\u0649/g, '\u06CC'); // Alef Maqsura -> Persian Yeh
  }

  // Step 5: Unify Kaf variants
  // Convert Arabic Kaf (\u0643) to Persian Kaf (\u06A9)
  if (options.unifyKaf !== false) {
    text = text.replace(/\u0643/g, '\u06A9');
  }

  // Step 6: Unify Alef variants
  // Convert آ, أ, إ, ٱ to plain Alef ا (\u0627)
  if (options.unifyAlef !== false) {
    text = text.replace(ALEF_VARIANTS_REGEX, '\u0627');
  }

  // Step 7: Clean Zero-Width Non-Joiner (ZWNJ)
  if (options.cleanZwnj !== false) {
    text = text.replace(MULTIPLE_ZWNJ_REGEX, ZWNJ);
    text = text.replace(BOUNDARY_ZWNJ_REGEX, ' ');
  }

  // Step 8: Unify Arabic and Persian numerals to standard ASCII numerals for indexing
  if (options.unifyNumbers !== false) {
    text = text
      .replace(/[٠۰]/g, '0')
      .replace(/[١۱]/g, '1')
      .replace(/[٢۲]/g, '2')
      .replace(/[٣۳]/g, '3')
      .replace(/[٤۴]/g, '4')
      .replace(/[٥۵]/g, '5')
      .replace(/[٦۶]/g, '6')
      .replace(/[٧۷]/g, '7')
      .replace(/[٨۸]/g, '8')
      .replace(/[٩۹]/g, '9');
  }

  // Step 9: Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Generates an excerpt snippet with highlighted match around a query match.
 */
export function createSearchSnippet(
  originalText: string,
  normalizedText: string,
  query: string,
  maxSnippetChars: number = 140,
): { snippet: string; matchFound: boolean } {
  if (!query || !originalText) {
    return {
      snippet: originalText ? originalText.slice(0, maxSnippetChars) : '',
      matchFound: false,
    };
  }

  const normalizedQuery = normalizePersianArabicText(query);
  const matchIndex = normalizedText.indexOf(normalizedQuery);

  if (matchIndex === -1) {
    // Try word-level partial match
    const queryWords = normalizedQuery.split(' ').filter(Boolean);
    let bestIndex = -1;
    for (const word of queryWords) {
      const idx = normalizedText.indexOf(word);
      if (idx !== -1) {
        bestIndex = idx;
        break;
      }
    }

    if (bestIndex === -1) {
      return {
        snippet: originalText.slice(0, maxSnippetChars) + (originalText.length > maxSnippetChars ? '...' : ''),
        matchFound: false,
      };
    }

    const start = Math.max(0, bestIndex - Math.floor(maxSnippetChars / 2));
    const end = Math.min(originalText.length, start + maxSnippetChars);
    const snippet = (start > 0 ? '...' : '') + originalText.slice(start, end) + (end < originalText.length ? '...' : '');
    return { snippet, matchFound: true };
  }

  const start = Math.max(0, matchIndex - Math.floor(maxSnippetChars / 2));
  const end = Math.min(originalText.length, start + maxSnippetChars);
  const snippet = (start > 0 ? '...' : '') + originalText.slice(start, end) + (end < originalText.length ? '...' : '');

  return { snippet, matchFound: true };
}

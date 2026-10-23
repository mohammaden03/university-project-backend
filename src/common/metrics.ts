/**
 * Manuscript AI - HTR & OCR Evaluation Metrics
 *
 * Implements rigorous Character Error Rate (CER) and Word Error Rate (WER)
 * based on Levenshtein edit distance between ground truth and hypothesis predictions.
 */

export interface LevenshteinMatrixResult {
  distance: number;
  insertions: number;
  deletions: number;
  substitutions: number;
  length: number;
}

/**
 * Computes Levenshtein distance on any sequence of tokens (characters or words)
 */
export function computeLevenshtein<T>(reference: T[], hypothesis: T[]): LevenshteinMatrixResult {
  const n = reference.length;
  const m = hypothesis.length;

  if (n === 0) {
    return {
      distance: m,
      insertions: m,
      deletions: 0,
      substitutions: 0,
      length: 0,
    };
  }

  if (m === 0) {
    return {
      distance: n,
      insertions: 0,
      deletions: n,
      substitutions: 0,
      length: n,
    };
  }

  // Cost matrix initialization
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (reference[i - 1] === hypothesis[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1, // substitution
        );
      }
    }
  }

  // Backtrack to count insertions, deletions, substitutions
  let i = n;
  let j = m;
  let insertions = 0;
  let deletions = 0;
  let substitutions = 0;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && reference[i - 1] === hypothesis[j - 1]) {
      i--;
      j--;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      substitutions++;
      i--;
      j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      deletions++;
      i--;
    } else {
      insertions++;
      j--;
    }
  }

  return {
    distance: dp[n][m],
    insertions,
    deletions,
    substitutions,
    length: n,
  };
}

export interface MetricResult {
  cer: number; // Character Error Rate (0.0 to 1.0+)
  wer: number; // Word Error Rate (0.0 to 1.0+)
  charEdits: number;
  wordEdits: number;
  groundTruthChars: number;
  groundTruthWords: number;
  hypothesisChars: number;
  hypothesisWords: number;
  charAccuracy: number; // Max(0, 1 - cer)
  wordAccuracy: number; // Max(0, 1 - wer)
}

/**
 * Calculates Character Error Rate (CER) and Word Error Rate (WER) between a ground truth string
 * and a model hypothesis transcription.
 */
export function calculateCerWer(groundTruth: string, hypothesis: string): MetricResult {
  const gtChars = Array.from(groundTruth.trim());
  const hypChars = Array.from(hypothesis.trim());

  const gtWords = groundTruth.trim().split(/\s+/).filter(Boolean);
  const hypWords = hypothesis.trim().split(/\s+/).filter(Boolean);

  const charResult = computeLevenshtein(gtChars, hypChars);
  const wordResult = computeLevenshtein(gtWords, hypWords);

  const cer = charResult.length > 0 ? charResult.distance / charResult.length : hypChars.length > 0 ? 1.0 : 0.0;
  const wer = wordResult.length > 0 ? wordResult.distance / wordResult.length : hypWords.length > 0 ? 1.0 : 0.0;

  return {
    cer: Number(cer.toFixed(4)),
    wer: Number(wer.toFixed(4)),
    charEdits: charResult.distance,
    wordEdits: wordResult.distance,
    groundTruthChars: gtChars.length,
    groundTruthWords: gtWords.length,
    hypothesisChars: hypChars.length,
    hypothesisWords: hypWords.length,
    charAccuracy: Number(Math.max(0, 1 - cer).toFixed(4)),
    wordAccuracy: Number(Math.max(0, 1 - wer).toFixed(4)),
  };
}

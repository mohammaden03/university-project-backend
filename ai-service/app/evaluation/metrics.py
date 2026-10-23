"""
Levenshtein Distance, Character Error Rate (CER), and Word Error Rate (WER) Implementation
"""

from typing import List, Tuple

def levenshtein_distance(seq1: List, seq2: List) -> Tuple[int, int, int, int]:
    """
    Computes Levenshtein distance and returns (distance, insertions, deletions, substitutions).
    """
    n, m = len(seq1), len(seq2)
    if n == 0:
        return m, m, 0, 0
    if m == 0:
        return n, 0, n, 0

    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if seq1[i - 1] == seq2[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = min(
                    dp[i - 1][j] + 1,      # deletion
                    dp[i][j - 1] + 1,      # insertion
                    dp[i - 1][j - 1] + 1   # substitution
                )

    # Backtracking for breakdown
    i, j = n, m
    insertions, deletions, substitutions = 0, 0, 0
    while i > 0 or j > 0:
        if i > 0 and j > 0 and seq1[i - 1] == seq2[j - 1]:
            i -= 1
            j -= 1
        elif i > 0 and j > 0 and dp[i][j] == dp[i - 1][j - 1] + 1:
            substitutions += 1
            i -= 1
            j -= 1
        elif i > 0 and dp[i][j] == dp[i - 1][j] + 1:
            deletions += 1
            i -= 1
        else:
            insertions += 1
            j -= 1

    return dp[n][m], insertions, deletions, substitutions

def compute_cer_wer(ground_truth: str, hypothesis: str) -> dict:
    gt_chars = list(ground_truth.strip())
    hyp_chars = list(hypothesis.strip())

    gt_words = [w for w in ground_truth.strip().split() if w]
    hyp_words = [w for w in hypothesis.strip().split() if w]

    char_dist, _, _, _ = levenshtein_distance(gt_chars, hyp_chars)
    word_dist, _, _, _ = levenshtein_distance(gt_words, hyp_words)

    cer = char_dist / len(gt_chars) if len(gt_chars) > 0 else (1.0 if len(hyp_chars) > 0 else 0.0)
    wer = word_dist / len(gt_words) if len(gt_words) > 0 else (1.0 if len(hyp_words) > 0 else 0.0)

    return {
        "cer": round(cer, 4),
        "wer": round(wer, 4),
        "char_edits": char_dist,
        "word_edits": word_dist,
        "gt_chars": len(gt_chars),
        "gt_words": len(gt_words),
    }

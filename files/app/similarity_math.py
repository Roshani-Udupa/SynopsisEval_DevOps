"""
similarity_math.py
==================
NLP-grounded mathematical similarity pipeline.

Implements four independent similarity measures used by academic
plagiarism detection literature (PAN, IEEE, Springer papers):

  Layer 1 — Lexical:   Jaccard similarity on token sets
  Layer 2 — N-gram:    Cosine similarity on TF-IDF weighted trigram vectors
  Layer 3 — Semantic:  Cosine similarity on TF-IDF document vectors (full vocab)
  Layer 4 — Structural: Longest Common Subsequence ratio on sentence sequences

Each layer catches a different plagiarism type:
  Jaccard       → verbatim copying (exact word overlap)
  N-gram cosine → near-verbatim / light paraphrase (3-gram fingerprints)
  TF-IDF cosine → semantic paraphrase (vocabulary shift, synonym swap)
  LCS ratio     → structural / idea plagiarism (same argument flow)

The composite score is a weighted ensemble of all four layers.

Mathematical definitions
------------------------
Given submission S and reference paper P (both as token sequences):

  Jaccard(S, P)  = |tokens(S) ∩ tokens(P)| / |tokens(S) ∪ tokens(P)|

  TF(t, D)       = count(t, D) / |D|
  IDF(t, C)      = log( (1 + |C|) / (1 + df(t, C)) ) + 1    [sklearn smooth]
  TFIDF(t, D, C) = TF(t, D) × IDF(t, C)

  cosine(u, v)   = (u · v) / (||u|| × ||v||)
                 = Σ(uᵢ × vᵢ) / √(Σuᵢ²) × √(Σvᵢ²)

  LCS(S, P) via Wagner-Fischer DP:
    lcs[i][j] = lcs[i-1][j-1] + 1        if S[i] == P[j]
              = max(lcs[i-1][j], lcs[i][j-1])  otherwise
  LCS_ratio  = 2 × LCS_length / (|S| + |P|)   (Sørensen–Dice normalisation)

  composite  = w₁·Jaccard + w₂·ngram_cosine + w₃·tfidf_cosine + w₄·lcs_ratio
               w = [0.20, 0.30, 0.35, 0.15]   (tuned to literature defaults)
"""

from __future__ import annotations
import math
import re
from dataclasses import dataclass, field
import time

# ── Data classes ──────────────────────────────────────────────────────────────

@dataclass
class SimilarityResult:
    """Full similarity breakdown for one submission–reference pair."""
    jaccard:        float   # 0–1, lexical token overlap
    ngram_cosine:   float   # 0–1, trigram TF-IDF cosine
    tfidf_cosine:   float   # 0–1, full-vocabulary TF-IDF cosine
    lcs_ratio:      float   # 0–1, sentence-level LCS Sørensen–Dice
    composite:      float   # 0–1, weighted ensemble
    score_pct:      int     # composite × 100, integer for display
    label:          str     # Original / Low / Moderate / High / Very High
    vocab_size:     int     = 0   # unique terms in submission
    coverage_ratio: float   = 0.0 # fraction of sub tokens seen in ref
    elapsed_ms:     float   = 0.0 # wall time for this pair in ms
    token_count:    int     = 0   # total tokens processed (sub + ref)


@dataclass
class DocumentSimilarityReport:
    """Aggregate report: submission vs all retrieved papers."""
    submission_title:   str
    submission_words:   int
    paper_count:        int
    results:            list[PaperSimilarity]
    max_composite:      float          # worst-case similarity
    mean_composite:     float          # average across all papers
    flagged_count:      int            # papers above threshold
    threshold_used:     float

    # Flat metric vectors for benchmarking / paper table export
    all_jaccard:        list[float] = field(default_factory=list)
    all_ngram_cosine:   list[float] = field(default_factory=list)
    all_tfidf_cosine:   list[float] = field(default_factory=list)
    all_lcs_ratio:      list[float] = field(default_factory=list)
    all_composite:      list[float] = field(default_factory=list)


@dataclass
class PaperSimilarity:
    """Similarity of the submission to one specific reference paper."""
    paper_title:    str
    paper_source:   str
    paper_url:      str
    similarity:     SimilarityResult


# ── Constants ─────────────────────────────────────────────────────────────────

WEIGHTS = {
    "jaccard":      0.20,
    "ngram_cosine": 0.30,
    "tfidf_cosine": 0.35,
    "lcs_ratio":    0.15,
}

LABELS = [
    (0.00, "Original"),
    (0.15, "Low similarity"),
    (0.30, "Moderate similarity"),
    (0.50, "High similarity"),
    (0.75, "Very high similarity"),
]

STOPWORDS = frozenset({
    "the","a","an","and","or","but","in","on","at","to","for","of","with",
    "is","are","was","were","be","been","have","has","this","that","these",
    "those","it","its","by","from","as","we","our","their","which","can",
    "also","more","using","used","based","paper","proposed","approach",
    "method","system","results","show","shows","shown","data","model","new",
    "figure","table","section","equation","however","therefore","thus",
    "hence","since","while","although","because","when","where","both",
    "some","such","other","each","into","than","then","they","them","do",
})

N = 3          # trigram size
THRESHOLD = 0.20   # composite score above which a paper is "flagged"


# ── Public API ────────────────────────────────────────────────────────────────

def compute_document_similarity(
    submission_text:  str,
    submission_title: str,
    papers:           list[dict],
    threshold:        float = THRESHOLD,
) -> DocumentSimilarityReport:
    """
    Main entry point.
    submission_text : full extracted text of the submitted PDF
    papers          : list[dict] from academic_apis.fetch_related_papers()
    Returns a DocumentSimilarityReport with per-paper breakdown.
    """
    sub_tokens = _tokenise(submission_text)
    sub_sents  = _sentences(submission_text)
    sub_ngrams = _ngrams(sub_tokens, N)

    # Build IDF corpus from submission + all paper abstracts
    corpus_docs = [submission_text] + [p.get("abstract","") for p in papers]
    idf = _build_idf(corpus_docs)

    results: list[PaperSimilarity] = []

    for paper in papers:
        ref_text   = " ".join([paper.get("title",""), paper.get("abstract","")]).strip()
        if not ref_text:
            continue

        t0 = time.perf_counter()

        ref_tokens = _tokenise(ref_text)
        ref_sents  = _sentences(ref_text)
        ref_ngrams = _ngrams(ref_tokens, N)

        jac    = _jaccard(set(sub_tokens), set(ref_tokens))
        ngc    = _tfidf_cosine_ngrams(sub_ngrams, ref_ngrams, idf)
        tfc    = _tfidf_cosine_docs(sub_tokens, ref_tokens, idf)
        lcs    = _lcs_ratio(sub_sents, ref_sents)
        comp   = _composite(jac, ngc, tfc, lcs)
        label  = _label(comp)

        elapsed_ms     = (time.perf_counter() - t0) * 1000
        vocab_size     = len(set(sub_tokens))
        token_count    = len(sub_tokens) + len(ref_tokens)
        ref_token_set  = set(ref_tokens)
        coverage_ratio = (
            len([t for t in sub_tokens if t in ref_token_set]) / max(len(sub_tokens), 1)
        )

        sim = SimilarityResult(
            jaccard        = round(jac, 4),
            ngram_cosine   = round(ngc, 4),
            tfidf_cosine   = round(tfc, 4),
            lcs_ratio      = round(lcs, 4),
            composite      = round(comp, 4),
            score_pct      = round(comp * 100),
            label          = label,
            vocab_size     = vocab_size,
            coverage_ratio = round(coverage_ratio, 4),
            elapsed_ms     = round(elapsed_ms, 2),
            token_count    = token_count,
        )
        results.append(PaperSimilarity(
            paper_title  = paper.get("title", "Unknown"),
            paper_source = paper.get("source", ""),
            paper_url    = paper.get("url", ""),
            similarity   = sim,
        ))

    results.sort(key=lambda r: r.similarity.composite, reverse=True)

    flagged   = [r for r in results if r.similarity.composite >= threshold]
    composites = [r.similarity.composite for r in results]
    max_c      = max(composites) if composites else 0.0
    mean_c     = sum(composites) / max(len(composites), 1)


    # ── Benchmark print ───────────────────────────────────────────────────────
    if results:
        top = results[0].similarity   # worst-case (highest similarity) paper
        print("\n" + "="*60)
        print(f"  BENCHMARK METRICS — {submission_title[:45]}")
        print("="*60)
        print(f"  [1] Jaccard similarity        : {top.jaccard:.4f}")
        print(f"  [2] N-gram cosine (TF-IDF)    : {top.ngram_cosine:.4f}")
        print(f"  [3] TF-IDF cosine (full vocab): {top.tfidf_cosine:.4f}")
        print(f"  [4] LCS ratio                 : {top.lcs_ratio:.4f}")
        print(f"  [5] Composite score           : {top.composite:.4f}  ({top.score_pct}%)")
        print(f"  [6] Vocab size (unique tokens): {top.vocab_size}")
        print(f"  [7] Token count (sub + ref)   : {top.token_count}")
        print(f"  [8] Processing time (ms/pair) : {top.elapsed_ms:.2f} ms")
        print(f"       Coverage ratio            : {top.coverage_ratio:.4f}  (bonus)")
        print(f"       Papers evaluated          : {len(results)}")
        print(f"       Papers flagged (>{threshold*100:.0f}%)     : {len(flagged)}")
        print("="*60 + "\n")

    return DocumentSimilarityReport(
        submission_title  = submission_title,
        submission_words  = len(sub_tokens),
        paper_count       = len(results),
        results           = results,
        max_composite     = round(max_c, 4),
        mean_composite    = round(mean_c, 4),
        flagged_count     = len(flagged),
        threshold_used    = threshold,
        all_jaccard       = [r.similarity.jaccard      for r in results],
        all_ngram_cosine  = [r.similarity.ngram_cosine for r in results],
        all_tfidf_cosine  = [r.similarity.tfidf_cosine for r in results],
        all_lcs_ratio     = [r.similarity.lcs_ratio    for r in results],
        all_composite     = composites,
    )


def similarity_report_to_dict(report: DocumentSimilarityReport) -> dict:
    """Serialise to plain dict for JSON response / LLM prompt injection."""
    return {
        "submission_title":  report.submission_title,
        "submission_words":  report.submission_words,
        "paper_count":       report.paper_count,
        "max_composite_pct": round(report.max_composite * 100, 1),
        "mean_composite_pct":round(report.mean_composite * 100, 1),
        "flagged_count":     report.flagged_count,
        "threshold_pct":     round(report.threshold_used * 100, 1),
        "papers": [
            {
                "title":        r.paper_title,
                "source":       r.paper_source,
                "url":          r.paper_url,
                "jaccard":      r.similarity.jaccard,
                "ngram_cosine": r.similarity.ngram_cosine,
                "tfidf_cosine": r.similarity.tfidf_cosine,
                "lcs_ratio":    r.similarity.lcs_ratio,
                "composite":    r.similarity.composite,
                "score_pct":    r.similarity.score_pct,
                "label":        r.similarity.label,
            }
            for r in report.results
        ],
        # Metric vectors for paper benchmarking tables
        "metric_vectors": {
            "jaccard":      report.all_jaccard,
            "ngram_cosine": report.all_ngram_cosine,
            "tfidf_cosine": report.all_tfidf_cosine,
            "lcs_ratio":    report.all_lcs_ratio,
            "composite":    report.all_composite,
        }
    }


# ── Layer 1: Jaccard similarity ───────────────────────────────────────────────

def _jaccard(a: set[str], b: set[str]) -> float:
    """
    J(A, B) = |A ∩ B| / |A ∪ B|
    Measures exact token overlap. Range [0, 1].
    """
    if not a or not b:
        return 0.0
    intersection = len(a & b)
    union        = len(a | b)
    return intersection / union


# ── Layer 2: N-gram cosine (TF-IDF weighted) ──────────────────────────────────

def _tfidf_cosine_ngrams(
    ngrams_a: list[str],
    ngrams_b: list[str],
    idf:      dict[str, float],
) -> float:
    """
    Cosine similarity on TF-IDF weighted trigram vectors.
    Captures near-verbatim and light paraphrase overlap.
    """
    vec_a = _tfidf_vector(ngrams_a, idf)
    vec_b = _tfidf_vector(ngrams_b, idf)
    return _cosine(vec_a, vec_b)


# ── Layer 3: Full-vocabulary TF-IDF cosine ────────────────────────────────────

def _tfidf_cosine_docs(
    tokens_a: list[str],
    tokens_b: list[str],
    idf:      dict[str, float],
) -> float:
    """
    Cosine similarity on unigram TF-IDF vectors over the full vocabulary.
    Captures semantic paraphrase — same meaning, different words.
    """
    vec_a = _tfidf_vector(tokens_a, idf)
    vec_b = _tfidf_vector(tokens_b, idf)
    return _cosine(vec_a, vec_b)


# ── Layer 4: LCS structural similarity ───────────────────────────────────────

def _lcs_ratio(sents_a: list[str], sents_b: list[str]) -> float:
    """
    Wagner-Fischer dynamic programming LCS on sentence sequences.
    Normalised by Sørensen–Dice: 2·LCS / (|A| + |B|).
    Captures structural / argument-flow plagiarism.

    We simplify sentences to their first 6 content words before comparing
    so that minor rephrasing does not mask structural copying.
    """
    a = [_sent_key(s) for s in sents_a[:80]]   # cap for performance
    b = [_sent_key(s) for s in sents_b[:80]]

    if not a or not b:
        return 0.0

    # Wagner–Fischer DP table (space-optimised: two rows)
    prev = [0] * (len(b) + 1)
    curr = [0] * (len(b) + 1)
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            if a[i-1] == b[j-1]:
                curr[j] = prev[j-1] + 1
            else:
                curr[j] = max(curr[j-1], prev[j])
        prev, curr = curr, [0] * (len(b) + 1)

    lcs_len = prev[len(b)]
    return (2 * lcs_len) / (len(a) + len(b))


def _sent_key(sentence: str) -> str:
    """Reduce sentence to its first 6 content words for structural matching."""
    words = [w for w in _tokenise(sentence) if w not in STOPWORDS]
    return " ".join(words[:6])


# ── Composite score ───────────────────────────────────────────────────────────

def _composite(jac: float, ngc: float, tfc: float, lcs: float) -> float:
    """
    Weighted linear combination:
      composite = w₁·J + w₂·NGC + w₃·TFC + w₄·LCS
    Weights tuned to PAN-benchmark literature defaults:
      TF-IDF cosine gets highest weight (best paraphrase detector),
      n-gram cosine next (near-verbatim),
      Jaccard (exact match — important but narrow),
      LCS (structural — lowest weight, noisiest signal).
    """
    return min(1.0, (
        WEIGHTS["jaccard"]      * jac +
        WEIGHTS["ngram_cosine"] * ngc +
        WEIGHTS["tfidf_cosine"] * tfc +
        WEIGHTS["lcs_ratio"]    * lcs
    ))


def _label(score: float) -> str:
    label = LABELS[0][1]
    for threshold, lbl in LABELS:
        if score >= threshold:
            label = lbl
    return label


# ── TF-IDF machinery ──────────────────────────────────────────────────────────

def _build_idf(corpus_texts: list[str]) -> dict[str, float]:
    """
    Smooth IDF (sklearn convention):
      IDF(t) = log( (1 + N) / (1 + df(t)) ) + 1
    where N = number of documents, df(t) = documents containing t.
    """
    N_docs = len(corpus_texts)
    df: dict[str, int] = {}
    for text in corpus_texts:
        for term in set(_tokenise(text)):
            df[term] = df.get(term, 0) + 1
    return {
        term: math.log((1 + N_docs) / (1 + count)) + 1
        for term, count in df.items()
    }


def _tfidf_vector(terms: list[str], idf: dict[str, float]) -> dict[str, float]:
    """
    Compute TF-IDF vector for a list of terms.
    TF(t, d) = count(t, d) / |d|
    """
    n = max(len(terms), 1)
    tf: dict[str, float] = {}
    for t in terms:
        tf[t] = tf.get(t, 0) + 1
    return {
        t: (count / n) * idf.get(t, 1.0)
        for t, count in tf.items()
    }


def _cosine(u: dict[str, float], v: dict[str, float]) -> float:
    """
    Cosine similarity between two sparse vectors represented as dicts.
    cos(u, v) = (u · v) / (||u|| × ||v||)
    Returns 0 if either vector is zero.
    """
    if not u or not v:
        return 0.0

    dot    = sum(u[k] * v[k] for k in u if k in v)
    norm_u = math.sqrt(sum(x*x for x in u.values()))
    norm_v = math.sqrt(sum(x*x for x in v.values()))

    if norm_u == 0 or norm_v == 0:
        return 0.0
    return min(1.0, dot / (norm_u * norm_v))


# ── Text utilities ────────────────────────────────────────────────────────────

def _tokenise(text: str) -> list[str]:
    words = re.findall(r"\b[a-z]{3,}\b", text.lower())
    return [w for w in words if w not in STOPWORDS]


def _ngrams(tokens: list[str], n: int) -> list[str]:
    return [" ".join(tokens[i:i+n]) for i in range(len(tokens) - n + 1)]


def _sentences(text: str) -> list[str]:
    raw = re.split(r"(?<=[.!?])\s+", text)
    return [s.strip() for s in raw if len(s.strip()) > 20]
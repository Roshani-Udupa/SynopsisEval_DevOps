"""
PDF text extraction using PyMuPDF.
Extracts: full text, title guess, abstract guess, and keyword list.
"""

import re
import fitz  # PyMuPDF


def extract_pdf_content(pdf_bytes: bytes) -> dict:
    """
    Given raw PDF bytes, return a dict with:
        - full_text    : entire document text
        - title        : best-guess title (first large text block on page 1)
        - abstract     : best-guess abstract section
        - keywords     : simple keyword list extracted from abstract/intro
        - page_count   : number of pages
        - word_count   : approximate word count
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    pages_text = []
    for page in doc:
        pages_text.append(page.get_text("text"))

    full_text = "\n".join(pages_text).strip()

    title     = _extract_title(doc)
    abstract  = _extract_abstract(full_text)
    keywords  = _extract_keywords(abstract or full_text[:2000])

    doc.close()

    return {
        "full_text":  full_text,
        "title":      title,
        "abstract":   abstract,
        "keywords":   keywords,
        "page_count": len(pages_text),
        "word_count": len(full_text.split()),
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _extract_title(doc: fitz.Document) -> str:
    """
    Try metadata first; fall back to the largest font-size text on page 1.
    """
    meta_title = doc.metadata.get("title", "").strip()
    if meta_title and len(meta_title) > 5:
        return meta_title

    # Largest font on first page heuristic
    if doc.page_count == 0:
        return "Unknown Title"

    page   = doc[0]
    blocks = page.get_text("dict")["blocks"]
    best   = ""
    best_size = 0.0

    for block in blocks:
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                size = span.get("size", 0)
                text = span.get("text", "").strip()
                if size > best_size and len(text) > 10:
                    best_size = size
                    best      = text

    return best if best else "Unknown Title"


def _extract_abstract(full_text: str) -> str:
    """
    Try to find an 'Abstract' section by keyword scanning.
    Returns up to 1500 chars of the abstract body.
    """
    patterns = [
        r"(?i)abstract[:\s\-–]+(.{200,1500}?)(?=\n\s*(?:introduction|keywords|1\.|I\.))",
        r"(?i)abstract[:\s\-–]+(.{200,1500})",
    ]
    for pat in patterns:
        m = re.search(pat, full_text, re.DOTALL)
        if m:
            return _clean(m.group(1))

    # Fallback: first 800 chars after removing very short lines
    lines = [l.strip() for l in full_text.split("\n") if len(l.strip()) > 40]
    return _clean(" ".join(lines[:6]))


def _extract_keywords(text: str) -> list[str]:
    """
    Pull out a keyword list:
      1. explicit 'Keywords:' line if present
      2. otherwise naive high-frequency content words
    """
    m = re.search(r"(?i)key\s*words?[:\s\-–]+(.+?)(?:\n|$)", text)
    if m:
        raw = m.group(1)
        kws = [k.strip(" .;,") for k in re.split(r"[,;·•]", raw) if k.strip()]
        return kws[:12]

    # Naive frequency fallback
    stopwords = {
        "the","a","an","and","or","but","in","on","at","to","for","of","with",
        "is","are","was","were","be","been","have","has","this","that","these",
        "those","it","its","by","from","as","we","our","their","which","can",
        "also","more","using","used","based","paper","proposed","approach","method",
        "system","results","show","shows","shown","data","model","models","new",
    }
    words = re.findall(r"\b[a-zA-Z]{4,}\b", text.lower())
    freq: dict[str, int] = {}
    for w in words:
        if w not in stopwords:
            freq[w] = freq.get(w, 0) + 1

    sorted_words = sorted(freq, key=lambda x: freq[x], reverse=True)
    return sorted_words[:10]


def _clean(text: str) -> str:
    text = re.sub(r"\s+", " ", text)
    return text.strip()

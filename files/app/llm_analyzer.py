"""
LLM-powered semantic similarity analysis via Ollama.

The LLM is given:
  - The submitted document's title, abstract, and keywords
  - A list of related papers (title + abstract) from academic APIs

It returns a structured JSON assessment with:
  - overall_similarity_score (0–100)
  - verdict (Original / Mostly Original / Moderate Overlap / High Similarity / Highly Similar)
  - summary (2–3 paragraph narrative)
  - flagged_papers (list of papers with per-paper similarity %, overlap reason)
  - original_contributions (what appears genuinely novel)
  - recommendations (what the student should address)
"""

import json
import re
import ollama
from app.config import OLLAMA_MODEL, OLLAMA_HOST


_SYSTEM_PROMPT = """You are an expert academic plagiarism and originality reviewer with deep knowledge of computer science, engineering, and related fields. You assess submitted academic synopses for similarity against existing published literature.

You ALWAYS respond with valid JSON only — no markdown fences, no explanation outside the JSON object. Your output must be parseable by json.loads() directly."""


def _build_user_prompt(doc: dict, papers: list[dict]) -> str:
    paper_list = ""
    for i, p in enumerate(papers[:15], 1):  # cap at 15 to stay within context
        abstract = (p.get("abstract") or "")[:400]
        authors  = ", ".join((p.get("authors") or [])[:3])
        year     = p.get("year") or "n.d."
        paper_list += f"""
[{i}] "{p['title']}" — {authors} ({year}) [{p['source']}]
     Abstract: {abstract}
     URL: {p.get('url','')}
"""

    abstract_excerpt = (doc.get("abstract") or doc.get("full_text",""))[:1200]

    return f"""
SUBMITTED DOCUMENT
==================
Title:    {doc.get('title','Unknown')}
Keywords: {', '.join(doc.get('keywords', []))}
Abstract / Opening:
{abstract_excerpt}

RELATED PAPERS FROM ACADEMIC DATABASES ({len(papers)} found)
=========================================================
{paper_list}

TASK
====
Analyse the submitted document against the related papers above.
Produce a JSON object with EXACTLY these fields:

{{
  "overall_similarity_score": <integer 0-100>,
  "verdict": "<one of: Original | Mostly Original | Moderate Overlap | High Similarity | Highly Similar>",
  "summary": "<2-3 paragraph narrative explaining the originality assessment>",
  "flagged_papers": [
    {{
      "rank": <1-based integer>,
      "title": "<paper title>",
      "authors": "<author string>",
      "year": "<year or n.d.>",
      "source": "<database name>",
      "url": "<url>",
      "similarity_percent": <integer 0-100>,
      "overlap_reason": "<specific explanation of what overlaps>"
    }}
  ],
  "original_contributions": "<what appears genuinely novel in the submission>",
  "recommendations": "<actionable advice for the student>",
  "confidence": "<Low | Medium | High — how confident you are given the available papers>"
}}

Only include papers in flagged_papers if similarity_percent >= 20. Sort flagged_papers by similarity_percent descending. Be precise and fair — do not inflate scores.
"""


async def analyse_with_llm(doc_content: dict, papers: list[dict]) -> dict:
    """
    Stream the LLM response, parse JSON, return the structured result.
    Falls back gracefully if LLM output is malformed.
    """
    client = ollama.AsyncClient(host=OLLAMA_HOST)

    user_prompt = _build_user_prompt(doc_content, papers)

    response = await client.chat(
        model = 'llama3.2:3b',
        # model=OLLAMA_MODEL,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user",   "content": user_prompt},
        ],
        options={
            "temperature": 0.1,   # low temp = consistent, structured output
            "num_predict": 2048,
        },
    )

    raw_text = response["message"]["content"]
    return _parse_llm_response(raw_text, papers)


def _parse_llm_response(raw: str, papers: list[dict]) -> dict:
    """
    Try to extract a JSON object from the LLM's raw output.
    If parsing fails, return a safe fallback structure.
    """
    # Strip markdown fences if the model added them anyway
    raw = re.sub(r"```(?:json)?", "", raw).strip()

    # Find the outermost {...}
    brace_start = raw.find("{")
    brace_end   = raw.rfind("}")
    if brace_start != -1 and brace_end != -1:
        json_str = raw[brace_start : brace_end + 1]
        try:
            result = json.loads(json_str)
            # Validate required keys exist
            _validate_and_fix(result, papers)
            return result
        except json.JSONDecodeError:
            pass

    # Fallback if JSON is completely broken
    return _fallback_result(papers)


def _validate_and_fix(result: dict, papers: list[dict]) -> None:
    """Ensure required keys exist; fill defaults if missing."""
    result.setdefault("overall_similarity_score", 0)
    result.setdefault("verdict", "Unknown")
    result.setdefault("summary", "Analysis could not be fully parsed.")
    result.setdefault("flagged_papers", [])
    result.setdefault("original_contributions", "Not determined.")
    result.setdefault("recommendations", "Please review manually.")
    result.setdefault("confidence", "Low")

    # Clamp score
    score = result["overall_similarity_score"]
    result["overall_similarity_score"] = max(0, min(100, int(score)))


def _fallback_result(papers: list[dict]) -> dict:
    return {
        "overall_similarity_score": 0,
        "verdict": "Analysis Error",
        "summary": (
            "The LLM was unable to produce a structured response. "
            "This may be due to an extremely short document, "
            "an unsupported language, or a model timeout. "
            "Please try again or review the document manually."
        ),
        "flagged_papers": [],
        "original_contributions": "Could not be determined.",
        "recommendations": "Retry the analysis or review the document manually.",
        "confidence": "Low",
    }

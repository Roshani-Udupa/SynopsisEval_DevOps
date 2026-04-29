"""
Async academic API clients.

Sources (all free, no key required unless noted):
  1. OpenAlex        — 250M works, truly free, no key, generous limits
  2. Crossref        — 150M works, free, no key, polite pool
  3. arXiv           — CS/engineering preprints, free, no key
  4. CORE            — 300M open-access papers, free (key optional)
  5. Semantic Scholar — 200M papers, free (key recommended to avoid 429s)
  6. IEEE Xplore     — requires free API key (optional)
  7. Springer Nature  — requires free API key (optional)

All functions return list[dict]:
  { title, authors, year, abstract, url, source }
"""

import asyncio
import os
import re
import traceback

import httpx
from app.config import IEEE_API_KEY, SPRINGER_API_KEY, MAX_REFERENCES

TIMEOUT = httpx.Timeout(25.0)


# ── Query builder ─────────────────────────────────────────────────────────────

def _build_query(title: str, keywords: list[str]) -> str:
    """
    Build a clean 4-8 word search query.
    Strips common boilerplate ('Project Title:', 'Abstract:', etc.)
    and picks the most informative words.
    """
    # Strip boilerplate prefixes students often include in titles
    clean_title = re.sub(
        r"(?i)^(project\s+title|title|abstract|synopsis|report)\s*[:\-–]\s*", "", title
    ).strip()

    # Take first 8 meaningful words of the cleaned title
    title_words = clean_title.split()[:8]
    kw_words    = keywords[:4]

    combined = " ".join(title_words + kw_words)
    return combined[:200].strip()


# ── Public entry point ────────────────────────────────────────────────────────

async def fetch_related_papers(title: str, keywords: list[str], abstract: str) -> list[dict]:
    query = _build_query(title, keywords)
    print(f"[academic_apis] Search query: '{query}'")

    tasks = [
        ("OpenAlex",         _openalex_search(query)),
        ("Crossref",         _crossref_search(query)),
        ("arXiv",            _arxiv_search(query)),
        ("CORE",             _core_search(query)),
        ("Semantic Scholar", _semantic_scholar(query)),
    ]
    if IEEE_API_KEY:
        tasks.append(("IEEE", _ieee_search(query)))
    if SPRINGER_API_KEY:
        tasks.append(("Springer", _springer_search(query)))

    names   = [t[0] for t in tasks]
    coros   = [t[1] for t in tasks]
    results = await asyncio.gather(*coros, return_exceptions=True)

    papers: list[dict] = []
    seen:   set[str]   = set()

    for name, batch in zip(names, results):
        if isinstance(batch, Exception):
            print(f"[academic_apis] ⚠ {name} failed: {type(batch).__name__}: {batch}")
            traceback.print_exception(type(batch), batch, batch.__traceback__)
            continue
        print(f"[academic_apis] {name} returned {len(batch)} paper(s).")
        for p in batch:
            norm = p.get("title", "").lower().strip()
            if norm and norm not in seen:
                seen.add(norm)
                papers.append(p)

    print(f"[academic_apis] Total unique papers after dedup: {len(papers)}")
    if not papers:
        print(
            "[academic_apis] ⚠ No papers found. Possible causes:\n"
            "  1. Query too specific — check the cleaned query above\n"
            "  2. Outbound HTTPS blocked in this environment\n"
            "  3. All sources rate-limited simultaneously\n"
        )
    return papers[: MAX_REFERENCES * 2]


# ── helpers ───────────────────────────────────────────────────────────────────

async def _get_with_backoff(client: httpx.AsyncClient, url: str, **kwargs) -> httpx.Response:
    """GET with exponential backoff on 429."""
    for attempt, wait in enumerate([0, 5, 15, 30]):
        if wait:
            print(f"[academic_apis] 429 on {url[:60]}… waiting {wait}s (attempt {attempt+1}/4)")
            await asyncio.sleep(wait)
        r = await client.get(url, **kwargs)
        if r.status_code != 429:
            break
    r.raise_for_status()
    return r


def _papers_with_abstract(items: list[dict]) -> list[dict]:
    return [p for p in items if p.get("abstract", "").strip()]


# ── 1. OpenAlex ───────────────────────────────────────────────────────────────

async def _openalex_search(query: str) -> list[dict]:
    """
    OpenAlex: 250M+ works, completely free, no key.
    Polite pool: add mailto for slightly higher limits.
    Abstract comes as inverted index — we reconstruct it.
    """
    url = "https://api.openalex.org/works"
    params = {
        "search":    query,
        "per_page":  MAX_REFERENCES,
        "filter":    "has_abstract:true",
        "select":    "title,authorships,publication_year,abstract_inverted_index,primary_location",
        "mailto":    "plagiarism-worker@example.com",   # polite pool
    }
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
        r = await _get_with_backoff(client, url, params=params)
        data = r.json()

    papers = []
    for item in data.get("results", []):
        abstract = _reconstruct_abstract(item.get("abstract_inverted_index") or {})
        if not abstract:
            continue
        authors = [
            a.get("author", {}).get("display_name", "")
            for a in item.get("authorships", [])
        ]
        loc = item.get("primary_location") or {}
        url_paper = (loc.get("landing_page_url") or
                     loc.get("pdf_url") or "")
        papers.append({
            "title":    item.get("display_name") or item.get("title", ""),
            "authors":  [a for a in authors if a],
            "year":     item.get("publication_year"),
            "abstract": abstract,
            "url":      url_paper,
            "source":   "OpenAlex",
        })
    return papers


def _reconstruct_abstract(inverted: dict) -> str:
    """OpenAlex returns abstracts as inverted index {word: [positions]}."""
    if not inverted:
        return ""
    max_pos = max(pos for positions in inverted.values() for pos in positions)
    words   = [""] * (max_pos + 1)
    for word, positions in inverted.items():
        for pos in positions:
            words[pos] = word
    return " ".join(w for w in words if w).strip()


# ── 2. Crossref ───────────────────────────────────────────────────────────────

async def _crossref_search(query: str) -> list[dict]:
    """
    Crossref: 150M+ works, free, no key.
    Use polite pool by adding mailto.
    """
    url = "https://api.crossref.org/works"
    params = {
        "query":            query,
        "rows":             MAX_REFERENCES,
        "select":           "title,author,published,abstract,URL",
        "mailto":           "plagiarism-worker@example.com",
        "filter":           "has-abstract:1",
    }
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
        r = await _get_with_backoff(client, url, params=params)
        data = r.json()

    papers = []
    for item in data.get("message", {}).get("items", []):
        abstract = _strip_jats(item.get("abstract", ""))
        if not abstract:
            continue
        title   = " ".join(item.get("title", []) or [])
        authors = [
            f"{a.get('given','')} {a.get('family','')}".strip()
            for a in item.get("author", [])
        ]
        pub = item.get("published", {})
        year = (pub.get("date-parts") or [[None]])[0][0]
        papers.append({
            "title":    title,
            "authors":  authors,
            "year":     year,
            "abstract": abstract,
            "url":      item.get("URL", ""),
            "source":   "Crossref",
        })
    return papers


def _strip_jats(text: str) -> str:
    """Crossref abstracts may contain JATS XML tags — strip them."""
    return re.sub(r"<[^>]+>", "", text).strip()


# ── 3. arXiv ──────────────────────────────────────────────────────────────────

async def _arxiv_search(query: str) -> list[dict]:
    """
    arXiv: excellent for CS, EE, robotics, AI — completely free.
    """
    url = "http://export.arxiv.org/api/query"
    params = {
        "search_query": f"all:{query}",
        "start":        0,
        "max_results":  MAX_REFERENCES,
        "sortBy":       "relevance",
    }
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
        r = await _get_with_backoff(client, url, params=params)
        xml = r.text

    papers = []
    # Minimal XML parse without lxml dependency
    entries = re.findall(r"<entry>(.*?)</entry>", xml, re.DOTALL)
    for entry in entries:
        title    = _xml_tag(entry, "title")
        abstract = _xml_tag(entry, "summary")
        link     = re.search(r'<id>(.*?)</id>', entry)
        link_url = link.group(1).strip() if link else ""
        authors  = re.findall(r"<name>(.*?)</name>", entry)
        pub_raw  = _xml_tag(entry, "published")
        year     = pub_raw[:4] if pub_raw else None

        if not abstract or not title:
            continue
        papers.append({
            "title":    title.strip(),
            "authors":  authors,
            "year":     int(year) if year and year.isdigit() else None,
            "abstract": abstract.strip(),
            "url":      link_url,
            "source":   "arXiv",
        })
    return papers


def _xml_tag(text: str, tag: str) -> str:
    m = re.search(fr"<{tag}[^>]*>(.*?)</{tag}>", text, re.DOTALL)
    return m.group(1).strip() if m else ""


# ── 4. CORE ───────────────────────────────────────────────────────────────────

async def _core_search(query: str) -> list[dict]:
    url = "https://api.core.ac.uk/v3/search/works/"   # trailing slash avoids 301
    params  = {"q": query, "limit": MAX_REFERENCES}
    headers = {"Accept": "application/json"}

    core_key = os.getenv("CORE_API_KEY", "")
    if core_key:
        headers["Authorization"] = f"Bearer {core_key}"

    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
        r = await _get_with_backoff(client, url, params=params, headers=headers)
        data = r.json()

    papers = []
    for item in data.get("results", []):
        abstract = item.get("abstract") or ""
        if not abstract:
            continue
        authors = []
        for a in item.get("authors", []):
            name = a.get("name") or (a.get("firstName","") + " " + a.get("lastName","")).strip()
            if name:
                authors.append(name)
        papers.append({
            "title":    item.get("title", ""),
            "authors":  authors,
            "year":     item.get("yearPublished"),
            "abstract": abstract,
            "url":      item.get("downloadUrl") or (item.get("sourceFulltextUrls") or [""])[0],
            "source":   "CORE",
        })
    return papers


# ── 5. Semantic Scholar ───────────────────────────────────────────────────────

async def _semantic_scholar(query: str) -> list[dict]:
    url = "https://api.semanticscholar.org/graph/v1/paper/search"
    params = {
        "query":  query,
        "limit":  MAX_REFERENCES,
        "fields": "title,authors,year,abstract,url",
    }
    headers = {}
    s2_key = os.getenv("SEMANTIC_SCHOLAR_API_KEY", "")
    if s2_key:
        headers["x-api-key"] = s2_key

    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
        r = await _get_with_backoff(client, url, params=params, headers=headers)
        data = r.json()

    papers = []
    for item in data.get("data", []):
        abstract = item.get("abstract") or ""
        if not abstract:
            continue
        papers.append({
            "title":    item.get("title", ""),
            "authors":  [a["name"] for a in item.get("authors", [])],
            "year":     item.get("year"),
            "abstract": abstract,
            "url":      item.get("url") or "",
            "source":   "Semantic Scholar",
        })
    return papers


# ── 6. IEEE Xplore (optional key) ────────────────────────────────────────────

async def _ieee_search(query: str) -> list[dict]:
    url = "https://ieeexploreapi.ieee.org/api/v1/search/articles"
    params = {"querytext": query, "max_records": MAX_REFERENCES, "apikey": IEEE_API_KEY}
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
        r = await _get_with_backoff(client, url, params=params)
        data = r.json()
    papers = []
    for item in data.get("articles", []):
        abstract = item.get("abstract") or ""
        if not abstract:
            continue
        papers.append({
            "title":    item.get("title", ""),
            "authors":  [a.get("full_name","") for a in item.get("authors",{}).get("authors",[])],
            "year":     item.get("publication_year"),
            "abstract": abstract,
            "url":      item.get("html_url", ""),
            "source":   "IEEE Xplore",
        })
    return papers


# ── 7. Springer Nature (optional key) ────────────────────────────────────────

async def _springer_search(query: str) -> list[dict]:
    url = "https://api.springernature.com/meta/v2/json"
    params = {"q": query, "p": MAX_REFERENCES, "api_key": SPRINGER_API_KEY}
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
        r = await _get_with_backoff(client, url, params=params)
        data = r.json()
    papers = []
    for item in data.get("records", []):
        abstract = item.get("abstract") or ""
        if not abstract:
            continue
        papers.append({
            "title":    item.get("title", ""),
            "authors":  [c.get("creator","") for c in item.get("creators",[])],
            "year":     item.get("publicationDate","")[:4],
            "abstract": abstract,
            "url":      (item.get("url") or [{}])[0].get("value",""),
            "source":   "Springer Nature",
        })
    return papers
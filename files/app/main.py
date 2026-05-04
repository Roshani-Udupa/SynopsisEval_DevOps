"""
Synopsis Plagiarism Worker — FastAPI Application
================================================
Routes:
  GET  /          → Upload UI (Jinja2 HTML)
  POST /analyse   → Accept PDF, run pipeline, return JSON result
  GET  /health    → Liveness probe
"""

import asyncio
import io
import json
import time
import traceback
import uuid
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.templating import Jinja2Templates

from app.config import MAX_UPLOAD_BYTES, MAX_UPLOAD_MB
from app.pdf_extractor import extract_pdf_content
from app.academic_apis import fetch_related_papers
from app.llm_analyzer import analyse_with_llm
from app.similarity_math import compute_document_similarity, similarity_report_to_dict

# ── App setup ─────────────────────────────────────────────────────────────────

BASE_DIR   = Path(__file__).resolve().parent.parent
TEMPLATES  = Jinja2Templates(directory=str(BASE_DIR / "templates"))

app = FastAPI(
    title="Synopsis Plagiarism Worker",
    description="Offline academic plagiarism detection powered by Ollama LLM",
    version="1.0.0",
    docs_url="/api-docs",
)


# ── In-memory job store (single-worker, no Redis needed here) ─────────────────
# job_id → { status, progress, message, result, error }
_jobs: dict[str, dict] = {}


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return TEMPLATES.TemplateResponse("index.html", {"request": request})


@app.get("/health")
async def health():
    return {"status": "ok", "service": "plagiarism-worker"}


@app.post("/analyse/start")
async def start_analysis(file: UploadFile = File(...)):
    """
    Accept a PDF upload, validate it, kick off background processing,
    return a job_id immediately.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    pdf_bytes = await file.read()

    if len(pdf_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(pdf_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_UPLOAD_MB} MB.",
        )

    if not pdf_bytes.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="File does not appear to be a valid PDF.")

    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "status":   "queued",
        "progress": 0,
        "message":  "Job queued",
        "result":   None,
        "error":    None,
        "filename": file.filename,
        "started":  time.time(),
    }

    asyncio.create_task(_run_analysis(job_id, pdf_bytes, file.filename))
    return {"job_id": job_id}


@app.get("/analyse/progress/{job_id}")
async def stream_progress(job_id: str):
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail="Job not found.")

    async def event_generator():
        while True:
            job = _jobs.get(job_id, {})
            data = {
                "status":   job.get("status"),
                "progress": job.get("progress", 0),
                "message":  job.get("message", ""),
            }
            yield f"data: {json.dumps(data)}\n\n"
            if job.get("status") in ("done", "error"):
                break
            await asyncio.sleep(0.8)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/analyse/result/{job_id}")
async def get_result(job_id: str):
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail="Job not found.")

    job = _jobs[job_id]
    if job["status"] == "error":
        raise HTTPException(status_code=500, detail=job.get("error", "Unknown error"))
    if job["status"] != "done":
        raise HTTPException(status_code=202, detail="Analysis still in progress.")

    return JSONResponse(job["result"])


# ── Background pipeline ───────────────────────────────────────────────────────

async def _run_analysis(job_id: str, pdf_bytes: bytes, filename: str):
    job = _jobs[job_id]

    try:
        # ── Step 1: Extract PDF ─────────────────────────────────────────────
        _update(job, 5, "extracting", "Extracting text from PDF…")
        doc_content = await asyncio.to_thread(extract_pdf_content, pdf_bytes)

        if doc_content["word_count"] < 50:
            raise ValueError(
                "Could not extract meaningful text from this PDF. "
                "Ensure the PDF is not a scanned image without OCR."
            )

        _update(job, 20, "extracting", f"Extracted {doc_content['word_count']:,} words from {doc_content['page_count']} pages.")

        # ── Step 2: Query academic APIs ─────────────────────────────────────
        _update(job, 25, "fetching", "Querying academic databases (Semantic Scholar, CORE…)")
        papers = await fetch_related_papers(
            title    = doc_content["title"],
            keywords = doc_content["keywords"],
            abstract = doc_content["abstract"],
        )
        _update(job, 55, "fetching", f"Found {len(papers)} related papers.")

        # ── Step 3: Mathematical NLP similarity ─────────────────────────────
        _update(job, 58, "analysing", "Running NLP similarity analysis (TF-IDF cosine, Jaccard, LCS)…")
        math_report = await asyncio.to_thread(
            compute_document_similarity,
            doc_content["full_text"],
            doc_content["title"],
            papers,
        )
        math_dict = similarity_report_to_dict(math_report)
        _update(job, 62, "analysing", f"Math similarity done. Max composite: {math_report.max_composite*100:.1f}%")

        # ── Step 4: LLM semantic analysis ───────────────────────────────────
        _update(job, 65, "analysing", f"Sending to LLM ({_model_name()}) for semantic analysis…")
        analysis = await analyse_with_llm(doc_content, papers)
        _update(job, 90, "analysing", "LLM analysis complete. Preparing report…")

        # ── Step 5: Collate final result ─────────────────────────────────────
        result = {
            "filename":        filename,
            "title":           doc_content["title"],
            "page_count":      doc_content["page_count"],
            "word_count":      doc_content["word_count"],
            "keywords":        doc_content["keywords"],
            "papers_found":    len(papers),
            "math_similarity": math_dict,
            "analysis":        analysis,
            "elapsed_s":       round(time.time() - job["started"], 1),
        }

        # ── Benchmark summary ────────────────────────────────────────────────
        ms  = math_dict
        llm = analysis
        print("\n" + "="*65)
        print(f"  EXECUTION COMPLETE — {filename}")
        print("="*65)
        print(f"  File            : {filename}")
        print(f"  Pages / Words   : {result['page_count']} pages / {result['word_count']:,} words")
        print(f"  Model used      : {_model_name()}")
        print(f"  Papers fetched  : {result['papers_found']}")
        print(f"  Total time      : {result['elapsed_s']} s")
        print("─"*65)
        print("  MATH SIMILARITY  (worst-case paper)")
        if ms["papers"]:
            top = ms["papers"][0]
            print(f"  [1] Jaccard               : {top['jaccard']:.4f}")
            print(f"  [2] N-gram cosine         : {top['ngram_cosine']:.4f}")
            print(f"  [3] TF-IDF cosine         : {top['tfidf_cosine']:.4f}")
            print(f"  [4] LCS ratio             : {top['lcs_ratio']:.4f}")
            print(f"  [5] Composite score       : {top['composite']:.4f}  ({top['score_pct']}%  {top['label']})")
        else:
            print("  (no papers fetched — math similarity not computed)")
        print(f"  [6] Max composite overall : {ms['max_composite_pct']}%")
        print(f"  [7] Mean composite        : {ms['mean_composite_pct']}%")
        print(f"  [8] Papers flagged ≥20%   : {ms['flagged_count']} / {ms['paper_count']}")
        print("─"*65)
        print("  LLM ANALYSIS")
        print(f"  Verdict         : {llm.get('verdict', '—')}")
        print(f"  Similarity score: {llm.get('overall_similarity_score', '—')}%")
        print(f"  Confidence      : {llm.get('confidence', '—')}")
        print(f"  Flagged papers  : {len(llm.get('flagged_papers', []))}")
        print("="*65 + "\n")

        job["status"]   = "done"
        job["progress"] = 100
        job["message"]  = "Analysis complete"
        job["result"]   = result

    except Exception as exc:
        job["status"]  = "error"
        job["message"] = "Analysis failed"
        job["error"]   = str(exc)
        traceback.print_exc()


def _update(job: dict, progress: int, status: str, message: str):
    job["progress"] = progress
    job["status"]   = status
    job["message"]  = message


def _model_name() -> str:
    from app.config import OLLAMA_MODEL
    return OLLAMA_MODEL
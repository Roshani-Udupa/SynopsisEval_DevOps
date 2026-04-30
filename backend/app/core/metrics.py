from prometheus_client import Counter, Histogram, Gauge

# --- Registration Metrics ---
TEAM_REGISTRATIONS = Counter(
    'synopsiseval_team_registrations_total',
    'Team registration attempts',
    ['status']  # labels: pending / approved / rejected
)

# --- Plagiarism Metrics ---
PLAGIARISM_JOB_DURATION = Histogram(
    'synopsiseval_plagiarism_job_seconds',
    'Time taken for plagiarism analysis jobs',
    buckets=[10, 30, 60, 120, 180, 300, 600]
)

PLAGIARISM_JOBS_ACTIVE = Gauge(
    'synopsiseval_plagiarism_jobs_active',
    'Number of plagiarism jobs currently running'
)

# --- Document & API Metrics ---
DOCUMENT_UPLOADS = Counter(
    'synopsiseval_document_uploads_total',
    'Total PDF documents uploaded',
    ['team_id', 'status']
)

ACADEMIC_API_CALLS = Counter(
    'synopsiseval_academic_api_calls_total',
    'Calls to external academic APIs',
    ['source', 'status']
)

LLM_INFERENCE_DURATION = Histogram(
    'synopsiseval_llm_inference_seconds',
    'Time for Ollama LLM to generate analysis',
    buckets=[5, 15, 30, 60, 120, 180, 300]
)
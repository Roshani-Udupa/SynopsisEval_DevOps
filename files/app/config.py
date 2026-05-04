import os

# ── Ollama ────────────────────────────────────────────────────────────────────
OLLAMA_MODEL   = os.getenv("OLLAMA_MODEL", "gemma2:2b")
OLLAMA_HOST    = os.getenv("OLLAMA_HOST", "http://localhost:11434")

# ── Academic API keys (all optional — graceful degradation if missing) ────────
# IEEE Xplore  → https://developer.ieee.org/  (free, 200 req/day)
IEEE_API_KEY      = os.getenv("IEEE_API_KEY", "")

# Springer Nature → https://dev.springernature.com/  (free, 5000 req/day)
SPRINGER_API_KEY  = os.getenv("SPRINGER_API_KEY", "")

# Semantic Scholar → https://api.semanticscholar.org/  (free, no key needed)
# CORE             → https://core.ac.uk/services/api  (free, no key needed for basic)

# ── Upload limits ─────────────────────────────────────────────────────────────
MAX_UPLOAD_MB  = int(os.getenv("MAX_UPLOAD_MB", "20"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

# ── Analysis tuning ───────────────────────────────────────────────────────────
MAX_REFERENCES = int(os.getenv("MAX_REFERENCES", "10"))   # max papers to fetch per source
SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "0.75"))  # flag above this

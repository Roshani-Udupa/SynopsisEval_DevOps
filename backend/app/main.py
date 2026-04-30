import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.database import engine, Base
from app.routers import auth, admin, reviewer, shared, student
from prometheus_fastapi_instrumentator import Instrumentator
from app.core.metrics import (
    TEAM_REGISTRATIONS, 
    PLAGIARISM_JOB_DURATION, 
    PLAGIARISM_JOBS_ACTIVE
)

# Import all models to register them with Base metadata
from app.models.user import (
    User, ReviewerProfile, Guide, Team, TeamMember,
    ReviewerAssignment, Document, PlagiarismJob,
    ReviewScore, EmailLog, Notification, PasswordResetToken, AuditLog
)



app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Synopsis Review Portal API — manages team submissions, plagiarism checks, and review scoring.",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(reviewer.router, prefix="/api")
app.include_router(shared.router, prefix="/api")
app.include_router(student.router, prefix="/api")

Instrumentator(
    should_group_status_codes=True,
    should_ignore_untemplated=True,
    should_respect_env_var=False,
    should_instrument_requests_inprogress=True,
    excluded_handlers=["/api/health", "/metrics"], # Updated to match your health path
    body_handlers=["/api/v1/student/documents/upload"],
).instrument(app).expose(app, endpoint="/metrics")
# Uploads directory (for file serving)
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")



@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": settings.APP_NAME}

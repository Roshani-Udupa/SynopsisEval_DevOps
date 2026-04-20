"""
Student router — team info, document upload, results.
"""
import uuid
import os
import aiofiles
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.core.database import get_db
from app.core.security import get_current_user, require_student
from app.core.config import settings
from app.models.user import (
    User, Team, TeamMember, Document, PlagiarismJob, ReviewScore, Guide
)

router = APIRouter(prefix="/student", tags=["Student"])


def _require_student_user():
    return Depends(require_student)


# ── Team Info ──────────────────────────────────────────────────────────────
@router.get("/team")
async def get_my_team(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Find team via membership
    membership_res = await db.execute(
        select(TeamMember).where(TeamMember.user_id == current_user.id)
    )
    membership = membership_res.scalar_one_or_none()
    if not membership:
        raise HTTPException(404, "No team found for this user")

    team = await db.get(Team, membership.team_id)
    if not team:
        raise HTTPException(404, "Team not found")

    # Get all members
    members_res = await db.execute(
        select(TeamMember).where(TeamMember.team_id == team.id)
    )
    members_rows = members_res.scalars().all()
    members = []
    for m in members_rows:
        u = await db.get(User, m.user_id)
        if u:
            members.append({"full_name": u.full_name, "usn": m.usn, "role": u.role})

    # Guide
    guide = None
    if team.guide_id:
        g = await db.get(Guide, team.guide_id)
        if g:
            guide = {"full_name": g.full_name, "department": g.department}

    # Latest doc
    doc_res = await db.execute(
        select(Document).where(Document.team_id == team.id, Document.is_latest == True)
    )
    latest_doc_obj = doc_res.scalar_one_or_none()
    latest_doc = None
    if latest_doc_obj:
        latest_doc = {
            "file_name": latest_doc_obj.file_name,
            "created_at": latest_doc_obj.created_at.isoformat(),
            "version": latest_doc_obj.version,
        }

    return {
        "id": str(team.id),
        "team_name": team.team_name,
        "status": team.status,
        "scores_released": team.scores_released,
        "rejection_note": team.rejection_note,
        "created_at": team.created_at.isoformat(),
        "members": members,
        "guide": guide,
        "latest_document": latest_doc,
    }


# ── Documents ──────────────────────────────────────────────────────────────
@router.get("/documents")
async def get_team_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    membership_res = await db.execute(
        select(TeamMember).where(TeamMember.user_id == current_user.id)
    )
    membership = membership_res.scalar_one_or_none()
    if not membership:
        raise HTTPException(404, "No team found")

    docs_res = await db.execute(
        select(Document)
        .where(Document.team_id == membership.team_id)
        .order_by(Document.version.desc())
    )
    docs = docs_res.scalars().all()

    out = []
    for d in docs:
        uploader = await db.get(User, d.uploaded_by)
        job_res = await db.execute(
            select(PlagiarismJob).where(PlagiarismJob.document_id == d.id)
        )
        job = job_res.scalar_one_or_none()
        out.append({
            "id": str(d.id),
            "file_name": d.file_name,
            "file_size_bytes": d.file_size_bytes,
            "version": d.version,
            "is_latest": d.is_latest,
            "created_at": d.created_at.isoformat(),
            "uploader_name": uploader.full_name if uploader else "—",
            "plagiarism_status": job.status if job else None,
            "similarity_score": float(job.similarity_score) if job and job.similarity_score else None,
        })
    return out


@router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "student_leader":
        raise HTTPException(403, "Only team leaders can upload documents")

    # Validate file type
    if file.content_type != "application/pdf":
        raise HTTPException(400, "Only PDF files are allowed")

    # Read content and validate size
    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE_BYTES:
        raise HTTPException(400, f"File exceeds 10MB limit ({len(content) / 1024 / 1024:.1f}MB)")

    # Get team
    membership_res = await db.execute(
        select(TeamMember).where(TeamMember.user_id == current_user.id)
    )
    membership = membership_res.scalar_one_or_none()
    if not membership:
        raise HTTPException(404, "No team found")

    team = await db.get(Team, membership.team_id)
    if not team or team.status != "approved":
        raise HTTPException(403, "Team must be approved before uploading")

    # Get current version
    latest_res = await db.execute(
        select(Document).where(Document.team_id == team.id, Document.is_latest == True)
    )
    current_latest = latest_res.scalar_one_or_none()
    new_version = (current_latest.version + 1) if current_latest else 1

    # Retire old latest
    if current_latest:
        current_latest.is_latest = False

    # Save file
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    filename = f"{team.id}_v{new_version}_{file.filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, filename)
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    doc = Document(
        team_id=team.id,
        uploaded_by=current_user.id,
        file_name=file.filename,
        file_path=file_path,
        file_size_bytes=len(content),
        mime_type="application/pdf",
        version=new_version,
        is_latest=True,
    )
    db.add(doc)
    await db.commit()
    return {"message": "Uploaded successfully", "version": new_version}


# ── Results ────────────────────────────────────────────────────────────────
@router.get("/results")
async def get_results(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    membership_res = await db.execute(
        select(TeamMember).where(TeamMember.user_id == current_user.id)
    )
    membership = membership_res.scalar_one_or_none()
    if not membership:
        raise HTTPException(404, "No team found")

    team = await db.get(Team, membership.team_id)
    if not team:
        raise HTTPException(404, "Team not found")

    if not team.scores_released:
        return {"scores_released": False, "team_name": team.team_name, "scores": []}

    # Get scores
    scores_res = await db.execute(
        select(ReviewScore).where(ReviewScore.team_id == team.id)
    )
    scores = scores_res.scalars().all()
    score_list = []
    for s in scores:
        reviewer = await db.get(User, s.reviewer_id)
        r = float(s.relevance_score or 0)
        m = float(s.methodology_score or 0)
        p = float(s.presentation_score or 0)
        i = float(s.innovation_score or 0)
        score_list.append({
            "reviewer_name": reviewer.full_name if reviewer else "Reviewer",
            "relevance_score": r,
            "methodology_score": m,
            "presentation_score": p,
            "innovation_score": i,
            "total_score": r + m + p + i,
            "feedback_text": s.feedback_text,
        })

    # Averages
    averages = None
    if score_list:
        averages = {
            "relevance": sum(s["relevance_score"] for s in score_list) / len(score_list),
            "methodology": sum(s["methodology_score"] for s in score_list) / len(score_list),
            "presentation": sum(s["presentation_score"] for s in score_list) / len(score_list),
            "innovation": sum(s["innovation_score"] for s in score_list) / len(score_list),
            "total": sum(s["total_score"] for s in score_list) / len(score_list),
        }

    # Plagiarism
    latest_doc_res = await db.execute(
        select(Document).where(Document.team_id == team.id, Document.is_latest == True)
    )
    latest_doc = latest_doc_res.scalar_one_or_none()
    plag_status = None
    similarity_score = None
    if latest_doc:
        job_res = await db.execute(
            select(PlagiarismJob).where(PlagiarismJob.document_id == latest_doc.id)
        )
        job = job_res.scalar_one_or_none()
        if job:
            plag_status = job.status
            similarity_score = float(job.similarity_score) if job.similarity_score else None

    return {
        "scores_released": True,
        "team_name": team.team_name,
        "scores": score_list,
        "averages": averages,
        "plagiarism_status": plag_status,
        "similarity_score": similarity_score,
    }

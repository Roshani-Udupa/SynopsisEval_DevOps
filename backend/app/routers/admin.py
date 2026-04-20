"""
Admin router — team management, reviewer management,
document hub, score dashboard, communications.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from pydantic import BaseModel
from app.core.database import get_db
from app.core.security import require_admin
from app.models.user import (
    User, Team, ReviewerProfile, ReviewerAssignment,
    Document, PlagiarismJob, ReviewScore, EmailLog, AuditLog
)

router = APIRouter(prefix="/admin", tags=["Admin"])


# ── Dashboard Stats ────────────────────────────────────────────────────────
@router.get("/dashboard/stats")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    total_teams = (await db.execute(select(func.count()).select_from(Team))).scalar()
    pending_teams = (await db.execute(select(func.count()).select_from(Team).where(Team.status == "pending"))).scalar()
    approved_teams = (await db.execute(select(func.count()).select_from(Team).where(Team.status == "approved"))).scalar()
    rejected_teams = (await db.execute(select(func.count()).select_from(Team).where(Team.status == "rejected"))).scalar()

    total_reviewers = (await db.execute(select(func.count()).select_from(User).where(User.role == "reviewer"))).scalar()
    pending_reviewers = (await db.execute(
        select(func.count()).select_from(User)
        .where(User.role == "reviewer", User.status == "pending")
    )).scalar()

    total_documents = (await db.execute(select(func.count()).select_from(Document))).scalar()
    plagiarism_completed = (await db.execute(
        select(func.count()).select_from(PlagiarismJob).where(PlagiarismJob.status == "completed")
    )).scalar()

    scores_released = (await db.execute(
        select(func.count()).select_from(Team).where(Team.scores_released == True)
    )).scalar()

    # Recent audit logs
    audit_res = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(10)
    )
    recent = audit_res.scalars().all()
    activity = [
        {"type": a.action, "label": a.action.replace("_", " ").title(), "time": a.created_at.isoformat()}
        for a in recent
    ]

    return {
        "total_teams": total_teams,
        "pending_teams": pending_teams,
        "approved_teams": approved_teams,
        "rejected_teams": rejected_teams,
        "total_reviewers": total_reviewers,
        "pending_reviewers": pending_reviewers,
        "total_documents": total_documents,
        "plagiarism_completed": plagiarism_completed,
        "scores_released_count": scores_released,
        "recent_activity": activity,
    }


# ── Teams ──────────────────────────────────────────────────────────────────
@router.get("/teams")
async def list_teams(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    q = select(Team)
    if status:
        q = q.where(Team.status == status)
    result = await db.execute(q.order_by(Team.created_at.desc()))
    teams = result.scalars().all()

    out = []
    for t in teams:
        leader = await db.get(User, t.leader_id)
        members_res = await db.execute(select(User).join(
            User.memberships
        ).where(User.memberships.any(team_id=t.id)))  # type: ignore
        from app.models.user import TeamMember
        members_res2 = await db.execute(select(TeamMember).where(TeamMember.team_id == t.id))
        member_count = len(members_res2.scalars().all())

        guide = await db.get(__import__('app.models.user', fromlist=['Guide']).Guide, t.guide_id) if t.guide_id else None

        out.append({
            "id": str(t.id),
            "team_name": t.team_name,
            "status": t.status,
            "leader_name": leader.full_name if leader else "—",
            "leader_email": leader.email if leader else "—",
            "member_count": member_count,
            "guide_name": guide.full_name if guide else None,
            "created_at": t.created_at.isoformat(),
            "rejection_note": t.rejection_note,
        })
    return out


class StatusUpdate(BaseModel):
    status: str
    rejection_note: Optional[str] = None


@router.patch("/teams/{team_id}/status")
async def update_team_status(
    team_id: str,
    body: StatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    team = await db.get(Team, uuid.UUID(team_id))
    if not team:
        raise HTTPException(404, "Team not found")

    team.status = body.status
    team.rejection_note = body.rejection_note

    # If approved, activate all team member accounts
    if body.status == "approved":
        from app.models.user import TeamMember
        members = (await db.execute(select(TeamMember).where(TeamMember.team_id == team.id))).scalars().all()
        for m in members:
            user = await db.get(User, m.user_id)
            if user:
                user.status = "approved"

    db.add(AuditLog(
        actor_id=current_user.id,
        action=f"TEAM_{body.status.upper()}",
        entity_type="team",
        entity_id=team.id,
        metadata_json={"note": body.rejection_note},
    ))
    await db.commit()
    return {"message": f"Team {body.status}"}


class ScoreReleaseBody(BaseModel):
    scores_released: bool


@router.patch("/teams/{team_id}/release-scores")
async def toggle_score_release(
    team_id: str,
    body: ScoreReleaseBody,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    team = await db.get(Team, uuid.UUID(team_id))
    if not team:
        raise HTTPException(404, "Team not found")
    team.scores_released = body.scores_released
    db.add(AuditLog(
        actor_id=current_user.id,
        action="SCORES_RELEASED" if body.scores_released else "SCORES_HIDDEN",
        entity_type="team",
        entity_id=team.id,
    ))
    await db.commit()
    return {"message": "Updated"}


# ── Reviewers ──────────────────────────────────────────────────────────────
@router.get("/reviewers")
async def list_reviewers(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    result = await db.execute(
        select(User).where(User.role == "reviewer").order_by(User.created_at.desc())
    )
    reviewers = result.scalars().all()
    out = []
    for r in reviewers:
        profile_res = await db.execute(
            select(ReviewerProfile).where(ReviewerProfile.user_id == r.id)
        )
        profile = profile_res.scalar_one_or_none()

        assignments_res = await db.execute(
            select(ReviewerAssignment).where(ReviewerAssignment.reviewer_id == r.id)
        )
        assignments = assignments_res.scalars().all()
        assigned_teams = []
        for a in assignments:
            t = await db.get(Team, a.team_id)
            if t:
                assigned_teams.append({"id": str(t.id), "team_name": t.team_name})

        out.append({
            "id": str(r.id),
            "full_name": r.full_name,
            "email": r.email,
            "status": r.status,
            "department": profile.department if profile else None,
            "designation": profile.designation if profile else None,
            "expertise": profile.expertise if profile else [],
            "created_at": r.created_at.isoformat(),
            "assigned_teams": assigned_teams,
        })
    return out


@router.patch("/reviewers/{reviewer_id}/approve")
async def approve_reviewer(
    reviewer_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    user = await db.get(User, uuid.UUID(reviewer_id))
    if not user or user.role != "reviewer":
        raise HTTPException(404, "Reviewer not found")
    user.status = "approved"
    db.add(AuditLog(actor_id=current_user.id, action="REVIEWER_APPROVED", entity_type="user", entity_id=user.id))
    await db.commit()
    return {"message": "Reviewer approved"}


class AssignmentBody(BaseModel):
    reviewer_id: str
    team_id: str


@router.post("/reviewer-assignments")
async def assign_reviewer(
    body: AssignmentBody,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    assignment = ReviewerAssignment(
        reviewer_id=uuid.UUID(body.reviewer_id),
        team_id=uuid.UUID(body.team_id),
        assigned_by=current_user.id,
    )
    db.add(assignment)
    await db.commit()
    return {"message": "Assigned"}


@router.delete("/reviewer-assignments/{reviewer_id}/{team_id}")
async def remove_assignment(
    reviewer_id: str,
    team_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    result = await db.execute(
        select(ReviewerAssignment).where(
            ReviewerAssignment.reviewer_id == uuid.UUID(reviewer_id),
            ReviewerAssignment.team_id == uuid.UUID(team_id),
        )
    )
    a = result.scalar_one_or_none()
    if a:
        await db.delete(a)
        await db.commit()
    return {"message": "Removed"}


# ── Documents ──────────────────────────────────────────────────────────────
@router.get("/documents")
async def list_all_documents(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    result = await db.execute(select(Document).order_by(Document.created_at.desc()))
    docs = result.scalars().all()
    out = []
    for d in docs:
        team = await db.get(Team, d.team_id)
        uploader = await db.get(User, d.uploaded_by)
        job_res = await db.execute(select(PlagiarismJob).where(PlagiarismJob.document_id == d.id))
        job = job_res.scalar_one_or_none()
        out.append({
            "id": str(d.id),
            "team_name": team.team_name if team else "—",
            "file_name": d.file_name,
            "file_size_bytes": d.file_size_bytes,
            "version": d.version,
            "is_latest": d.is_latest,
            "uploaded_by": uploader.full_name if uploader else "—",
            "created_at": d.created_at.isoformat(),
            "plagiarism_status": job.status if job else None,
            "similarity_score": float(job.similarity_score) if job and job.similarity_score else None,
        })
    return out


@router.post("/documents/{doc_id}/plagiarism-check")
async def trigger_plagiarism(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    doc = await db.get(Document, uuid.UUID(doc_id))
    if not doc:
        raise HTTPException(404, "Document not found")

    existing = await db.execute(select(PlagiarismJob).where(PlagiarismJob.document_id == doc.id))
    job = existing.scalar_one_or_none()

    if job:
        job.status = "processing"
        job.started_at = datetime.now(timezone.utc)
    else:
        job = PlagiarismJob(
            document_id=doc.id,
            triggered_by=current_user.id,
            status="processing",
            started_at=datetime.now(timezone.utc),
        )
        db.add(job)

    await db.commit()
    return {"message": "Job started", "job_id": str(job.id)}


class PlagiarismResult(BaseModel):
    status: str
    similarity_score: Optional[float] = None


@router.patch("/documents/{doc_id}/plagiarism-result")
async def update_plagiarism_result(
    doc_id: str,
    body: PlagiarismResult,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    result = await db.execute(
        select(PlagiarismJob).where(PlagiarismJob.document_id == uuid.UUID(doc_id))
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")

    job.status = body.status
    if body.similarity_score is not None:
        job.similarity_score = body.similarity_score
    job.completed_at = datetime.now(timezone.utc)
    job.report_url = f"/mock-reports/{doc_id}.pdf"
    await db.commit()
    return {"message": "Updated"}


# ── Score Dashboard ────────────────────────────────────────────────────────
@router.get("/score-dashboard")
async def score_dashboard(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    result = await db.execute(select(Team).where(Team.status == "approved"))
    teams = result.scalars().all()

    out = []
    for t in teams:
        scores_res = await db.execute(select(ReviewScore).where(ReviewScore.team_id == t.id))
        scores = scores_res.scalars().all()

        docs_res = await db.execute(select(Document).where(Document.team_id == t.id))
        doc_count = len(docs_res.scalars().all())

        # Check plagiarism done
        latest_doc_res = await db.execute(
            select(Document).where(Document.team_id == t.id, Document.is_latest == True)
        )
        latest_doc = latest_doc_res.scalar_one_or_none()
        plag_done = False
        if latest_doc:
            job_res = await db.execute(
                select(PlagiarismJob).where(
                    PlagiarismJob.document_id == latest_doc.id,
                    PlagiarismJob.status == "completed"
                )
            )
            plag_done = job_res.scalar_one_or_none() is not None

        reviewer_scores = []
        for s in scores:
            reviewer = await db.get(User, s.reviewer_id)
            total = float(s.relevance_score or 0) + float(s.methodology_score or 0) + float(s.presentation_score or 0) + float(s.innovation_score or 0)
            reviewer_scores.append({
                "reviewer_name": reviewer.full_name if reviewer else "—",
                "total_score": total,
            })

        avg = sum(s["total_score"] for s in reviewer_scores) / len(reviewer_scores) if reviewer_scores else None

        out.append({
            "team_id": str(t.id),
            "team_name": t.team_name,
            "scores_released": t.scores_released,
            "reviewer_scores": reviewer_scores,
            "average_score": avg,
            "document_count": doc_count,
            "plagiarism_done": plag_done,
        })
    return out


@router.post("/score-dashboard/publish-all")
async def publish_all_scores(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    await db.execute(
        update(Team).where(Team.status == "approved").values(scores_released=True)
    )
    db.add(AuditLog(actor_id=current_user.id, action="ALL_SCORES_RELEASED"))
    await db.commit()
    return {"message": "All scores published"}


# ── Communications ─────────────────────────────────────────────────────────
class SendMessageBody(BaseModel):
    recipient_type: str
    subject: str
    body: str
    template_used: Optional[str] = None


@router.post("/communications/send")
async def send_communication(
    payload: SendMessageBody,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    log = EmailLog(
        sent_by=current_user.id,
        recipient_type=payload.recipient_type,
        subject=payload.subject,
        body=payload.body,
        template_used=payload.template_used,
        status="sent",
        mock_sent_at=datetime.now(timezone.utc),
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)

    return {
        "id": str(log.id),
        "recipient_type": log.recipient_type,
        "subject": log.subject,
        "status": log.status,
        "mock_sent_at": log.mock_sent_at.isoformat(),
        "created_at": log.created_at.isoformat(),
    }


@router.get("/email-logs")
async def get_email_logs(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    result = await db.execute(select(EmailLog).order_by(EmailLog.created_at.desc()).limit(50))
    logs = result.scalars().all()
    return [
        {
            "id": str(l.id),
            "recipient_type": l.recipient_type,
            "subject": l.subject,
            "status": l.status,
            "mock_sent_at": l.mock_sent_at.isoformat() if l.mock_sent_at else None,
            "created_at": l.created_at.isoformat(),
        }
        for l in logs
    ]

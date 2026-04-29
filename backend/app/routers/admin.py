"""
Admin router — team management, reviewer management,
document hub, score dashboard, communications.
"""
import uuid
import httpx
import asyncio
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from pydantic import BaseModel
from app.core.database import get_db
from app.core.email import generic_announcement_email, send_bulk_email
from app.core.notifications import create_notification, notify_users
from app.core.security import require_admin
from app.models.user import (
    User, Team, TeamMember, ReviewerProfile, ReviewerAssignment,
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

    members = []
    if body.status in {"approved", "rejected"}:
        members = (await db.execute(select(TeamMember).where(TeamMember.team_id == team.id))).scalars().all()

    # If approved, activate all team member accounts
    if body.status == "approved":
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

    if body.status == "approved":
        await notify_users(
            db,
            [m.user_id for m in members],
            title="Team approved",
            message=f"Your team {team.team_name} has been approved and is now active.",
            type="success",
            action_url="/student",
        )
        await db.commit()
    elif body.status == "rejected":
        await notify_users(
            db,
            [m.user_id for m in members],
            title="Team rejected",
            message=f"Your team {team.team_name} was rejected. {body.rejection_note or 'Please review the feedback from the administrator.'}",
            type="warning",
            action_url="/student",
        )
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

    members = []
    if body.scores_released:
        members = (await db.execute(select(TeamMember).where(TeamMember.team_id == team.id))).scalars().all()

    db.add(AuditLog(
        actor_id=current_user.id,
        action="SCORES_RELEASED" if body.scores_released else "SCORES_HIDDEN",
        entity_type="team",
        entity_id=team.id,
    ))
    await db.commit()

    if body.scores_released:
        await notify_users(
            db,
            [m.user_id for m in members],
            title="Review scores released",
            message=f"Review scores for {team.team_name} are now available in your portal.",
            type="success",
            action_url="/student/results",
        )
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
            "department": profile.department if profile and profile.department else r.department,
            "designation": profile.designation if profile and profile.designation else r.designation,
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
    await create_notification(
        db,
        recipient_id=user.id,
        title="Reviewer account approved",
        message="Your reviewer account has been approved. You can now access the reviewer portal.",
        type="success",
        action_url="/reviewer",
    )
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

    reviewer = await db.get(User, uuid.UUID(body.reviewer_id))
    team = await db.get(Team, uuid.UUID(body.team_id))
    await db.commit()

    if reviewer and team:
        await create_notification(
            db,
            recipient_id=reviewer.id,
            title="New review assignment",
            message=f"You have been assigned to review {team.team_name}.",
            type="info",
            action_url="/reviewer/assigned-teams",
        )
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
    db.expire_all()
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


WORKER_URL = "http://localhost:8001"

# @router.post("/documents/{doc_id}/plagiarism-check")
# async def trigger_plagiarism(
#     doc_id: str,
#     db: AsyncSession = Depends(get_db),
#     current_user=Depends(require_admin),
# ):
#     doc = await db.get(Document, uuid.UUID(doc_id))
#     if not doc:
#         raise HTTPException(404, "Document not found")

#     existing = await db.execute(select(PlagiarismJob).where(PlagiarismJob.document_id == doc.id))
#     job = existing.scalar_one_or_none()
#     if job:
#         job.status = "processing"
#         job.started_at = datetime.now(timezone.utc)
#     else:
#         job = PlagiarismJob(
#             document_id=doc.id,
#             triggered_by=current_user.id,
#             status="processing",
#             started_at=datetime.now(timezone.utc),
#         )
#         db.add(job)
#     await db.commit()
#     await db.refresh(job)

#     # async def run_worker():
#     #     async with httpx.AsyncClient(timeout=300) as client:
#     #         # 1. Upload PDF to worker
#     #         with open(doc.file_path, "rb") as f:
#     #             start_resp = await client.post(
#     #                 f"{WORKER_URL}/analyse/start",
#     #                 files={"file": (f"{doc_id}.pdf", f, "application/pdf")},
#     #             )
#     #         worker_job_id = start_resp.json()["job_id"]

#     #         # 2. Poll until done
#     #         for _ in range(100):
#     #             await asyncio.sleep(200)
#     #             result_resp = await client.get(f"{WORKER_URL}/analyse/result/{worker_job_id}")
#     #             if result_resp.status_code == 202:
#     #                 continue
#     #             if result_resp.status_code == 200:
#     #                 data = result_resp.json()
#     #                 print(data)
#     #                 job.similarity_score = data["analysis"]["overall_similarity_score"]
#     #                 job.status = "completed"
#     #             else:
#     #                 job.status = "failed"
#     #             job.completed_at = datetime.now(timezone.utc)
#     #             job.report_url = f"/mock-reports/{doc_id}.pdf"
#     #             await db.commit()
#     #             return

#     #         job.status = "failed"
#     #         await db.commit()
#     async def run_worker():
#         async with httpx.AsyncClient(timeout=300) as client:
#             with open(doc.file_path, "rb") as f:
#                 start_resp = await client.post(
#                     f"{WORKER_URL}/analyse/start",
#                     files={"file": (f"{doc_id}.pdf", f, "application/pdf")},
#                 )
#             worker_job_id = start_resp.json()["job_id"]

#             for _ in range(100):
#                 await asyncio.sleep(2)
#                 result_resp = await client.get(f"{WORKER_URL}/analyse/result/{worker_job_id}")
#                 if result_resp.status_code == 202:
#                     continue

#                 async with AsyncSessionLocal() as fresh_db:  # ← fresh session
#                     result = await fresh_db.execute(
#                         select(PlagiarismJob).where(PlagiarismJob.document_id == uuid.UUID(doc_id))
#                     )
#                     fresh_job = result.scalar_one_or_none()
#                     if fresh_job:
#                         if result_resp.status_code == 200:
#                             data = result_resp.json()
#                             fresh_job.similarity_score = data["analysis"]["overall_similarity_score"]
#                             fresh_job.status = "completed"
#                         else:
#                             fresh_job.status = "failed"
#                         fresh_job.completed_at = datetime.now(timezone.utc)
#                         fresh_job.report_url = f"/mock-reports/{doc_id}.pdf"
#                         await fresh_db.commit()
#                 return

#             async with AsyncSessionLocal() as fresh_db:
#                 result = await fresh_db.execute(
#                     select(PlagiarismJob).where(PlagiarismJob.document_id == uuid.UUID(doc_id))
#                 )
#                 fresh_job = result.scalar_one_or_none()
#                 if fresh_job:
#                     fresh_job.status = "failed"
#                     await fresh_db.commit()

#     asyncio.create_task(run_worker())
#     return {"message": "Job started", "job_id": str(job.id)}

@router.post("/documents/{doc_id}/plagiarism-check")
async def trigger_plagiarism(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    doc = await db.get(Document, uuid.UUID(doc_id))
    if not doc:
        raise HTTPException(404, "Document not found")

    file_path = doc.file_path  # capture before any commit expires it

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
    await db.refresh(job)

    async with httpx.AsyncClient(timeout=300) as client:
        with open(file_path, "rb") as f:
            start_resp = await client.post(
                f"{WORKER_URL}/analyse/start",
                files={"file": (f"{doc_id}.pdf", f, "application/pdf")},
            )
        start_resp.raise_for_status()
        worker_job_id = start_resp.json()["job_id"]

        for _ in range(100):
            await asyncio.sleep(2)
            result_resp = await client.get(f"{WORKER_URL}/analyse/result/{worker_job_id}")
            if result_resp.status_code == 202:
                continue
            if result_resp.status_code == 200:
                data = result_resp.json()
                job.similarity_score = data["analysis"]["overall_similarity_score"]
                job.status = "completed"
            else:
                job.status = "failed"
            break
        else:
            job.status = "failed"

    job.completed_at = datetime.now(timezone.utc)
    job.report_url = f"/mock-reports/{doc_id}.pdf"

    # capture before final commit expires the object
    final_job_id = str(job.id)
    final_status = job.status
    final_score = job.similarity_score

    await db.commit()

    return {
        "message": "Job complete",
        "job_id": final_job_id,
        "similarity_score": final_score,
        "status": final_status,
    }


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

    approved_teams = (await db.execute(select(Team).where(Team.status == "approved"))).scalars().all()
    for team in approved_teams:
        members = (await db.execute(select(TeamMember).where(TeamMember.team_id == team.id))).scalars().all()
        await notify_users(
            db,
            [m.user_id for m in members],
            title="Review scores released",
            message=f"Review scores for {team.team_name} are now available in your portal.",
            type="success",
            action_url="/student/results",
        )
    await db.commit()

    return {"message": "All scores published"}


# ── Communications ─────────────────────────────────────────────────────────
class SendMessageBody(BaseModel):
    recipient_type: str
    subject: str
    body: str
    template_used: Optional[str] = None


async def _resolve_communication_recipients(
    db: AsyncSession,
    recipient_type: str,
) -> list[str]:
    if recipient_type == "all_reviewers":
        query = select(User.email).where(User.role == "reviewer")
    else:
        team_query = select(User.email).join(TeamMember, TeamMember.user_id == User.id)
        if recipient_type == "all_teams":
            query = team_query.where(User.role.in_(["student_leader", "student_member"]))
        elif recipient_type == "pending_teams":
            query = team_query.join(Team, Team.id == TeamMember.team_id).where(Team.status == "pending")
        elif recipient_type == "approved_teams":
            query = team_query.join(Team, Team.id == TeamMember.team_id).where(Team.status == "approved")
        else:
            raise HTTPException(400, "Unsupported recipient type")

    result = await db.execute(query.distinct())
    emails = [email for email in result.scalars().all() if email]
    unique_emails = list(dict.fromkeys(emails))
    if not unique_emails:
        raise HTTPException(404, "No recipients found for the selected audience")
    return unique_emails


@router.post("/communications/send")
async def send_communication(
    payload: SendMessageBody,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    recipient_emails = await _resolve_communication_recipients(db, payload.recipient_type)
    _, html_body = generic_announcement_email(payload.subject, payload.body)

    log = EmailLog(
        sent_by=current_user.id,
        recipient_type=payload.recipient_type,
        subject=payload.subject,
        body=payload.body,
        template_used=payload.template_used,
        status="queued",
    )
    db.add(log)

    await db.flush()
    delivery = await send_bulk_email(recipient_emails, payload.subject, html_body, payload.body)
    log.status = "sent" if delivery["failed"] == 0 else "failed"
    log.sent_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(log)

    return {
        "id": str(log.id),
        "recipient_type": log.recipient_type,
        "subject": log.subject,
        "status": log.status,
        "sent_at": log.sent_at.isoformat() if log.sent_at else None,
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
            "sent_at": l.sent_at.isoformat() if l.sent_at else None,
            "created_at": l.created_at.isoformat(),
        }
        for l in logs
    ]
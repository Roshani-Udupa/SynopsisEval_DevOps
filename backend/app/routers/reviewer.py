"""
Reviewer router — dashboard, assignments, scoring, and review history.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_reviewer
from app.models.user import (
    Document,
    Guide,
    PlagiarismJob,
    ReviewScore,
    ReviewerAssignment,
    ReviewerProfile,
    Team,
    TeamMember,
    User,
)

router = APIRouter(prefix="/reviewer", tags=["Reviewer"])


class ReviewScoreBody(BaseModel):
    team_id: uuid.UUID
    relevance_score: float
    methodology_score: float
    presentation_score: float
    innovation_score: float
    feedback_text: Optional[str] = None

    @field_validator(
        "relevance_score",
        "methodology_score",
        "presentation_score",
        "innovation_score",
    )
    @classmethod
    def validate_score_range(cls, value: float) -> float:
        if value < 0 or value > 10:
            raise ValueError("Scores must be between 0 and 10")
        return value

    @field_validator("feedback_text", mode="before")
    @classmethod
    def normalize_feedback(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        text = value.strip()
        return text or None


def _score_total(review: ReviewScore) -> float:
    return (
        float(review.relevance_score or 0)
        + float(review.methodology_score or 0)
        + float(review.presentation_score or 0)
        + float(review.innovation_score or 0)
    )


async def _ensure_assignment(
    db: AsyncSession,
    reviewer_id: uuid.UUID,
    team_id: uuid.UUID,
) -> ReviewerAssignment:
    result = await db.execute(
        select(ReviewerAssignment).where(
            ReviewerAssignment.reviewer_id == reviewer_id,
            ReviewerAssignment.team_id == team_id,
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Team not assigned to reviewer")
    return assignment


@router.get("/dashboard")
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_reviewer),
):
    profile_res = await db.execute(
        select(ReviewerProfile).where(ReviewerProfile.user_id == current_user.id)
    )
    profile = profile_res.scalar_one_or_none()

    assignments_res = await db.execute(
        select(ReviewerAssignment)
        .where(ReviewerAssignment.reviewer_id == current_user.id)
        .order_by(ReviewerAssignment.assigned_at.desc())
    )
    assignments = assignments_res.scalars().all()
    team_ids = [assignment.team_id for assignment in assignments]

    reviewed_team_ids: set[uuid.UUID] = set()
    if team_ids:
        reviewed_res = await db.execute(
            select(ReviewScore.team_id).where(
                ReviewScore.reviewer_id == current_user.id,
                ReviewScore.team_id.in_(team_ids),
            )
        )
        reviewed_team_ids = set(reviewed_res.scalars().all())

    recent_res = await db.execute(
        select(ReviewScore, Team.team_name)
        .join(Team, Team.id == ReviewScore.team_id)
        .where(ReviewScore.reviewer_id == current_user.id)
        .order_by(ReviewScore.updated_at.desc())
        .limit(5)
    )

    reviewed_count = len(reviewed_team_ids)
    total_assigned = len(team_ids)
    pending_count = max(total_assigned - reviewed_count, 0)

    recent_reviews = []
    for review, team_name in recent_res.all():
        recent_reviews.append(
            {
                "team_name": team_name,
                "total_score": _score_total(review),
                "submitted_at": review.submitted_at.isoformat(),
            }
        )

    expertise = list(profile.expertise or []) if profile else []

    return {
        "total_assigned": total_assigned,
        "reviewed_count": reviewed_count,
        "pending_count": pending_count,
        "department": profile.department if profile else None,
        "designation": profile.designation if profile else None,
        "expertise": expertise,
        "recent_reviews": recent_reviews,
    }


@router.get("/assigned-teams")
async def get_assigned_teams(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_reviewer),
):
    assignments_res = await db.execute(
        select(ReviewerAssignment)
        .where(ReviewerAssignment.reviewer_id == current_user.id)
        .order_by(ReviewerAssignment.assigned_at.desc())
    )
    assignments = assignments_res.scalars().all()
    if not assignments:
        return []

    team_ids = [assignment.team_id for assignment in assignments]

    teams_res = await db.execute(select(Team).where(Team.id.in_(team_ids)))
    teams = {team.id: team for team in teams_res.scalars().all()}

    member_counts_res = await db.execute(
        select(TeamMember.team_id, func.count(TeamMember.id))
        .where(TeamMember.team_id.in_(team_ids))
        .group_by(TeamMember.team_id)
    )
    member_counts = {team_id: count for team_id, count in member_counts_res.all()}

    latest_docs_res = await db.execute(
        select(Document).where(
            Document.team_id.in_(team_ids),
            Document.is_latest == True,
        )
    )
    latest_docs = {document.team_id: document for document in latest_docs_res.scalars().all()}
    document_ids = [document.id for document in latest_docs.values()]

    plagiarism_map: dict[uuid.UUID, PlagiarismJob] = {}
    if document_ids:
        plagiarism_res = await db.execute(
            select(PlagiarismJob).where(PlagiarismJob.document_id.in_(document_ids))
        )
        plagiarism_map = {job.document_id: job for job in plagiarism_res.scalars().all()}

    reviewed_res = await db.execute(
        select(ReviewScore.team_id).where(
            ReviewScore.reviewer_id == current_user.id,
            ReviewScore.team_id.in_(team_ids),
        )
    )
    reviewed_team_ids = set(reviewed_res.scalars().all())

    out = []
    for assignment in assignments:
        team = teams.get(assignment.team_id)
        if not team:
            continue

        latest_doc = latest_docs.get(team.id)
        job = plagiarism_map.get(latest_doc.id) if latest_doc else None

        out.append(
            {
                "team_id": str(team.id),
                "team_name": team.team_name,
                "team_status": team.status,
                "member_count": member_counts.get(team.id, 0),
                "has_document": latest_doc is not None,
                "document_id": str(latest_doc.id) if latest_doc else None,
                "document_name": latest_doc.file_name if latest_doc else None,
                "document_version": latest_doc.version if latest_doc else None,
                "document_uploaded_at": latest_doc.created_at.isoformat() if latest_doc else None,
                "similarity_score": float(job.similarity_score) if job and job.similarity_score is not None else None,
                "already_reviewed": team.id in reviewed_team_ids,
                "assigned_at": assignment.assigned_at.isoformat(),
            }
        )

    return out


@router.get("/teams/{team_id}")
async def get_team_detail(
    team_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_reviewer),
):
    await _ensure_assignment(db, current_user.id, team_id)

    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    members_res = await db.execute(
        select(TeamMember).where(TeamMember.team_id == team.id)
    )
    members = members_res.scalars().all()
    member_rows = []
    for member in members:
        user = await db.get(User, member.user_id)
        if user:
            member_rows.append(
                {
                    "full_name": user.full_name,
                    "usn": member.usn,
                    "role": user.role,
                }
            )

    guide_payload = None
    if team.guide_id:
        guide = await db.get(Guide, team.guide_id)
        if guide:
            guide_payload = {
                "full_name": guide.full_name,
                "department": guide.department,
            }

    docs_res = await db.execute(
        select(Document)
        .where(Document.team_id == team.id)
        .order_by(Document.version.desc(), Document.created_at.desc())
    )
    documents = docs_res.scalars().all()
    document_ids = [document.id for document in documents]

    plagiarism_map: dict[uuid.UUID, PlagiarismJob] = {}
    if document_ids:
        plagiarism_res = await db.execute(
            select(PlagiarismJob).where(PlagiarismJob.document_id.in_(document_ids))
        )
        plagiarism_map = {job.document_id: job for job in plagiarism_res.scalars().all()}

    review_res = await db.execute(
        select(ReviewScore).where(
            ReviewScore.team_id == team.id,
            ReviewScore.reviewer_id == current_user.id,
        )
    )
    existing_review = review_res.scalar_one_or_none()

    document_rows = []
    for document in documents:
        job = plagiarism_map.get(document.id)
        uploader = await db.get(User, document.uploaded_by)
        document_rows.append(
            {
                "id": str(document.id),
                "file_name": document.file_name,
                "file_size_bytes": document.file_size_bytes,
                "version": document.version,
                "is_latest": document.is_latest,
                "uploaded_at": document.created_at.isoformat(),
                "uploaded_by": uploader.full_name if uploader else "—",
                "similarity_score": float(job.similarity_score) if job and job.similarity_score is not None else None,
                "plagiarism_status": job.status if job else None,
            }
        )

    existing_score = None
    if existing_review:
        existing_score = {
            "relevance_score": float(existing_review.relevance_score or 0),
            "methodology_score": float(existing_review.methodology_score or 0),
            "presentation_score": float(existing_review.presentation_score or 0),
            "innovation_score": float(existing_review.innovation_score or 0),
            "feedback_text": existing_review.feedback_text,
            "submitted_at": existing_review.submitted_at.isoformat(),
            "updated_at": existing_review.updated_at.isoformat(),
        }

    return {
        "team_id": str(team.id),
        "team_name": team.team_name,
        "team_status": team.status,
        "members": member_rows,
        "guide": guide_payload,
        "documents": document_rows,
        "existing_score": existing_score,
    }


@router.post("/scores")
async def submit_review(
    payload: ReviewScoreBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_reviewer),
):
    team = await db.get(Team, payload.team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    await _ensure_assignment(db, current_user.id, team.id)

    if team.status != "approved":
        raise HTTPException(status_code=400, detail="Team is not available for review yet")

    latest_doc_res = await db.execute(
        select(Document).where(
            Document.team_id == team.id,
            Document.is_latest == True,
        )
    )
    latest_doc = latest_doc_res.scalar_one_or_none()
    if not latest_doc:
        raise HTTPException(status_code=400, detail="Team has not uploaded a document yet")

    review_res = await db.execute(
        select(ReviewScore).where(
            ReviewScore.team_id == team.id,
            ReviewScore.reviewer_id == current_user.id,
        )
    )
    review = review_res.scalar_one_or_none()

    if review:
        review.relevance_score = payload.relevance_score
        review.methodology_score = payload.methodology_score
        review.presentation_score = payload.presentation_score
        review.innovation_score = payload.innovation_score
        review.feedback_text = payload.feedback_text
        message = "Review updated"
    else:
        review = ReviewScore(
            team_id=team.id,
            reviewer_id=current_user.id,
            relevance_score=payload.relevance_score,
            methodology_score=payload.methodology_score,
            presentation_score=payload.presentation_score,
            innovation_score=payload.innovation_score,
            feedback_text=payload.feedback_text,
        )
        db.add(review)
        message = "Review submitted"

    await db.commit()

    return {
        "message": message,
        "team_id": str(team.id),
        "total_score": payload.relevance_score + payload.methodology_score + payload.presentation_score + payload.innovation_score,
    }


@router.get("/my-reviews")
async def get_my_reviews(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_reviewer),
):
    result = await db.execute(
        select(ReviewScore, Team.team_name)
        .outerjoin(Team, Team.id == ReviewScore.team_id)
        .where(ReviewScore.reviewer_id == current_user.id)
        .order_by(ReviewScore.updated_at.desc())
    )

    out = []
    for review, team_name in result.all():
        out.append(
            {
                "team_id": str(review.team_id),
                "team_name": team_name or "—",
                "relevance_score": float(review.relevance_score or 0),
                "methodology_score": float(review.methodology_score or 0),
                "presentation_score": float(review.presentation_score or 0),
                "innovation_score": float(review.innovation_score or 0),
                "total_score": _score_total(review),
                "feedback_text": review.feedback_text,
                "submitted_at": review.submitted_at.isoformat(),
                "updated_at": review.updated_at.isoformat(),
            }
        )

    return out
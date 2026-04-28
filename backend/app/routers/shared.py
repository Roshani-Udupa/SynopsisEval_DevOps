"""
Shared router — profile and in-app notifications.
"""
from __future__ import annotations

import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, hash_password, verify_password
from app.models.user import Document, Notification, ReviewerAssignment, ReviewerProfile, TeamMember, User

router = APIRouter(tags=["Shared"])


class ProfileUpdateBody(BaseModel):
    full_name: str
    department: Optional[str] = None
    designation: Optional[str] = None
    expertise: Optional[list[str]] = None

    @field_validator("full_name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Full name must be at least 2 characters")
        return value


class ChangePasswordBody(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters long")
        return value

    @model_validator(mode="after")
    def passwords_match(self) -> "ChangePasswordBody":
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


async def _get_reviewer_profile(db: AsyncSession, user_id: uuid.UUID) -> ReviewerProfile | None:
    result = await db.execute(select(ReviewerProfile).where(ReviewerProfile.user_id == user_id))
    return result.scalar_one_or_none()


async def _serialize_profile(db: AsyncSession, user: User) -> dict:
    reviewer_profile = await _get_reviewer_profile(db, user.id)

    usn = None
    membership_res = await db.execute(select(TeamMember).where(TeamMember.user_id == user.id))
    membership = membership_res.scalar_one_or_none()
    if membership:
        usn = membership.usn

    department = user.department or (reviewer_profile.department if reviewer_profile else None)
    designation = user.designation or (reviewer_profile.designation if reviewer_profile else None)
    expertise = list(reviewer_profile.expertise or []) if reviewer_profile else []

    return {
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "status": user.status,
        "created_at": user.created_at.isoformat(),
        "department": department,
        "designation": designation,
        "expertise": expertise,
        "usn": usn,
    }


async def _can_access_document(db: AsyncSession, current_user: User, document: Document) -> bool:
    if current_user.role == "admin":
        return True

    if current_user.role in {"student_leader", "student_member"}:
        membership_res = await db.execute(
            select(TeamMember).where(
                TeamMember.user_id == current_user.id,
                TeamMember.team_id == document.team_id,
            )
        )
        return membership_res.scalar_one_or_none() is not None

    if current_user.role == "reviewer":
        assignment_res = await db.execute(
            select(ReviewerAssignment).where(
                ReviewerAssignment.reviewer_id == current_user.id,
                ReviewerAssignment.team_id == document.team_id,
            )
        )
        return assignment_res.scalar_one_or_none() is not None

    return False


@router.get("/profile")
async def get_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _serialize_profile(db, current_user)


@router.patch("/profile")
async def update_profile(
    payload: ProfileUpdateBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.full_name = payload.full_name
    current_user.department = payload.department
    current_user.designation = payload.designation

    reviewer_profile = await _get_reviewer_profile(db, current_user.id)
    if current_user.role == "reviewer":
        if not reviewer_profile:
            reviewer_profile = ReviewerProfile(
                user_id=current_user.id,
                department=payload.department,
                designation=payload.designation,
                expertise=payload.expertise or [],
            )
            db.add(reviewer_profile)
        else:
            reviewer_profile.department = payload.department
            reviewer_profile.designation = payload.designation
            reviewer_profile.expertise = payload.expertise or []

    await db.commit()
    return await _serialize_profile(db, current_user)


@router.get("/documents/{document_id}/download")
async def download_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = await db.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if not await _can_access_document(db, current_user, document):
        raise HTTPException(status_code=403, detail="Access denied")

    if not os.path.exists(document.file_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=document.file_path,
        filename=document.file_name,
        media_type=document.mime_type,
    )


@router.post("/profile/change-password")
async def change_password(
    payload: ChangePasswordBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    current_user.password_hash = hash_password(payload.new_password)
    await db.commit()
    return {"message": "Password changed successfully"}


@router.get("/notifications")
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification)
        .where(Notification.recipient_id == current_user.id)
        .order_by(Notification.created_at.desc())
    )
    notifications = result.scalars().all()
    return [
        {
            "id": str(notification.id),
            "title": notification.title,
            "message": notification.message,
            "type": notification.type,
            "is_read": notification.is_read,
            "action_url": notification.action_url,
            "created_at": notification.created_at.isoformat(),
        }
        for notification in notifications
    ]


@router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.recipient_id == current_user.id,
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    await db.commit()
    return {"message": "Updated"}


@router.post("/notifications/mark-all-read")
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            Notification.recipient_id == current_user.id,
            Notification.is_read == False,
        )
    )
    unread = result.scalars().all()
    for notification in unread:
        notification.is_read = True

    await db.commit()
    return {"message": "Updated"}


@router.delete("/notifications/{notification_id}")
async def delete_notification(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.recipient_id == current_user.id,
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    await db.delete(notification)
    await db.commit()
    return {"message": "Deleted"}
"""Helpers for creating in-app notifications and mirrored email alerts."""
from __future__ import annotations

import logging
import uuid
from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.email import generic_announcement_email, send_bulk_email
from app.models.user import Notification, User


logger = logging.getLogger("synopsis.notifications")


async def _send_notification_email(
    db: AsyncSession,
    recipient_ids: Iterable[uuid.UUID],
    title: str,
    message: str,
    action_url: str | None = None,
) -> None:
    unique_recipient_ids = list(dict.fromkeys(recipient_ids))
    if not unique_recipient_ids:
        return

    result = await db.execute(select(User.email).where(User.id.in_(unique_recipient_ids)))
    recipient_emails = [email for email in result.scalars().all() if email]
    if not recipient_emails:
        return

    subject, html_body = generic_announcement_email(title, message, action_url)
    text_body = f"{title}\n\n{message}"
    if action_url:
        text_body = f"{text_body}\n\nOpen: {action_url}"

    outcome = await send_bulk_email(recipient_emails, subject, html_body, text_body)
    if outcome["failed"]:
        logger.warning(
            "Failed to send %s of %s notification emails for '%s'",
            outcome["failed"],
            len(recipient_emails),
            title,
        )


async def create_notification(
    db: AsyncSession,
    recipient_id: uuid.UUID,
    title: str,
    message: str,
    type: str = "info",
    action_url: str | None = None,
) -> Notification:
    notification = Notification(
        recipient_id=recipient_id,
        title=title,
        message=message,
        type=type,
        action_url=action_url,
    )
    db.add(notification)
    await _send_notification_email(db, [recipient_id], title, message, action_url)
    return notification


async def notify_users(
    db: AsyncSession,
    recipient_ids: Iterable[uuid.UUID],
    title: str,
    message: str,
    type: str = "info",
    action_url: str | None = None,
) -> list[Notification]:
    notifications: list[Notification] = []
    for recipient_id in recipient_ids:
        notifications.append(
            await create_notification(db, recipient_id, title, message, type, action_url)
        )
    return notifications


async def notify_role(
    db: AsyncSession,
    role: str,
    title: str,
    message: str,
    type: str = "info",
    action_url: str | None = None,
) -> list[Notification]:
    result = await db.execute(select(User.id).where(User.role == role))
    recipient_ids = result.scalars().all()
    return await notify_users(db, recipient_ids, title, message, type, action_url)


async def notify_admins(
    db: AsyncSession,
    title: str,
    message: str,
    type: str = "info",
    action_url: str | None = None,
) -> list[Notification]:
    return await notify_role(db, "admin", title, message, type, action_url)
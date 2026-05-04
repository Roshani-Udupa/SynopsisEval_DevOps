from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.models.user import Notification, TeamMember
from app.routers import shared
from tests.helpers import AsyncSessionStub, ResultStub


@pytest.mark.asyncio
async def test_get_profile_serializes_reviewer_state() -> None:
    reviewer_profile = SimpleNamespace(department='Computer Science', designation='Associate Professor', expertise=['ML', 'NLP'])
    membership = SimpleNamespace(usn='1AB21CS001')
    user = SimpleNamespace(
        id='user-1',
        full_name='Dr. Jane Smith',
        email='reviewer@example.com',
        role='reviewer',
        status='approved',
        created_at=SimpleNamespace(isoformat=lambda: '2026-05-01T10:00:00+00:00'),
        department=None,
        designation=None,
    )
    db = AsyncSessionStub([ResultStub(scalar=reviewer_profile), ResultStub(scalar=membership)])

    response = await shared.get_profile(db=db, current_user=user)

    assert response['full_name'] == 'Dr. Jane Smith'
    assert response['department'] == 'Computer Science'
    assert response['designation'] == 'Associate Professor'
    assert response['expertise'] == ['ML', 'NLP']
    assert response['usn'] == '1AB21CS001'


@pytest.mark.asyncio
async def test_change_password_rejects_wrong_current_password(monkeypatch) -> None:
    user = SimpleNamespace(password_hash='old-hash')
    db = AsyncSessionStub()
    monkeypatch.setattr(shared, 'verify_password', lambda plain, hashed: False)

    with pytest.raises(HTTPException) as exc_info:
        await shared.change_password(
            shared.ChangePasswordBody(
                current_password='wrong',
                new_password='NewPassword1',
                confirm_password='NewPassword1',
            ),
            db=db,
            current_user=user,
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == 'Current password is incorrect'


@pytest.mark.asyncio
async def test_change_password_updates_password_hash(monkeypatch) -> None:
    user = SimpleNamespace(password_hash='old-hash')
    db = AsyncSessionStub()
    monkeypatch.setattr(shared, 'verify_password', lambda plain, hashed: True)
    monkeypatch.setattr(shared, 'hash_password', lambda value: 'new-hash')

    response = await shared.change_password(
        shared.ChangePasswordBody(
            current_password='old-hash',
            new_password='NewPassword1',
            confirm_password='NewPassword1',
        ),
        db=db,
        current_user=user,
    )

    assert response['message'] == 'Password changed successfully'
    assert user.password_hash == 'new-hash'
    assert db.commits == 1


@pytest.mark.asyncio
async def test_notifications_are_serialized_and_mark_all_read_updates_flags() -> None:
    notifications = [
        SimpleNamespace(
            id='note-1',
            title='Team approved',
            message='Your team has been approved.',
            type='success',
            is_read=False,
            action_url='/student',
            created_at=SimpleNamespace(isoformat=lambda: '2026-05-01T10:00:00+00:00'),
        ),
        SimpleNamespace(
            id='note-2',
            title='Scores released',
            message='Your scores are available.',
            type='info',
            is_read=True,
            action_url=None,
            created_at=SimpleNamespace(isoformat=lambda: '2026-05-01T11:00:00+00:00'),
        ),
    ]
    db = AsyncSessionStub([ResultStub(scalars=notifications), ResultStub(scalars=[notifications[0]])])
    user = SimpleNamespace(id='user-1')

    response = await shared.list_notifications(db=db, current_user=user)

    assert response[0]['title'] == 'Team approved'
    assert response[1]['is_read'] is True

    mark_all_response = await shared.mark_all_notifications_read(db=db, current_user=user)

    assert mark_all_response['message'] == 'Updated'
    assert notifications[0].is_read is True

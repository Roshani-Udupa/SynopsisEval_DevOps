from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.models.user import Team, TeamMember, User
from app.routers import admin
from tests.helpers import AsyncSessionStub, ResultStub


@pytest.mark.asyncio
async def test_update_team_status_approves_team_members(monkeypatch) -> None:
    team = SimpleNamespace(id=uuid.UUID('77777777-7777-7777-7777-777777777777'), team_name='Team Alpha', status='pending', rejection_note=None)
    member_one = SimpleNamespace(user_id='student-1')
    member_two = SimpleNamespace(user_id='student-2')
    user_one = SimpleNamespace(id='student-1', status='pending')
    user_two = SimpleNamespace(id='student-2', status='pending')
    db = AsyncSessionStub([ResultStub(scalars=[member_one, member_two])], {
        (Team, team.id): team,
        (User, member_one.user_id): user_one,
        (User, member_two.user_id): user_two,
    })
    notify_users = AsyncMock()
    monkeypatch.setattr(admin, 'notify_users', notify_users)

    response = await admin.update_team_status(
        team_id=str(team.id),
        body=admin.StatusUpdate(status='approved', rejection_note=None),
        db=db,
        current_user=SimpleNamespace(id='admin-1'),
    )

    assert response['message'] == 'Team approved'
    assert team.status == 'approved'
    assert user_one.status == 'approved'
    assert user_two.status == 'approved'
    assert len(db.added) == 1
    notify_users.assert_awaited_once()


@pytest.mark.asyncio
async def test_toggle_score_release_notifies_team_members(monkeypatch) -> None:
    team = SimpleNamespace(id=uuid.UUID('88888888-8888-8888-8888-888888888888'), team_name='Team Alpha', status='approved', scores_released=False)
    member = SimpleNamespace(user_id='student-1')
    db = AsyncSessionStub([ResultStub(scalars=[member])], {
        (Team, team.id): team,
    })
    notify_users = AsyncMock()
    monkeypatch.setattr(admin, 'notify_users', notify_users)

    response = await admin.toggle_score_release(
        team_id=str(team.id),
        body=admin.ScoreReleaseBody(scores_released=True),
        db=db,
        current_user=SimpleNamespace(id='admin-1'),
    )

    assert response['message'] == 'Updated'
    assert team.scores_released is True
    notify_users.assert_awaited_once()

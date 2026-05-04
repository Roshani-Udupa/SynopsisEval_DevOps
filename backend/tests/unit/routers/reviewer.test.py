from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.models.user import Document, ReviewScore, ReviewerAssignment, Team
from app.routers import reviewer
from tests.helpers import AsyncSessionStub, ResultStub


@pytest.mark.asyncio
async def test_submit_review_creates_score_for_assigned_team() -> None:
    team_id = uuid.UUID('55555555-5555-5555-5555-555555555555')
    team = SimpleNamespace(id=team_id, status='approved')
    assignment = SimpleNamespace(team_id=team.id, reviewer_id='reviewer-1')
    latest_doc = SimpleNamespace(id='doc-1')
    db = AsyncSessionStub([
        ResultStub(scalar=assignment),
        ResultStub(scalar=latest_doc),
        ResultStub(scalar=None),
    ])
    db.get_results[(Team, team.id)] = team

    response = await reviewer.submit_review(
        reviewer.ReviewScoreBody(
            team_id=str(team_id),
            relevance_score=8,
            methodology_score=7,
            presentation_score=9,
            innovation_score=6,
            feedback_text='Strong proposal',
        ),
        db=db,
        current_user=SimpleNamespace(id='reviewer-1', role='reviewer'),
    )

    assert response['message'] == 'Review submitted'
    assert response['team_id'] == str(team_id)
    assert response['total_score'] == 30
    assert len(db.added) == 1
    assert isinstance(db.added[0], ReviewScore)


@pytest.mark.asyncio
async def test_submit_review_rejects_unassigned_team() -> None:
    team = SimpleNamespace(id=uuid.UUID('66666666-6666-6666-6666-666666666666'), status='approved')
    db = AsyncSessionStub([ResultStub(scalar=None)])
    db.get_results[(Team, team.id)] = team

    with pytest.raises(HTTPException) as exc_info:
        await reviewer.submit_review(
            reviewer.ReviewScoreBody(
                team_id=str(team.id),
                relevance_score=8,
                methodology_score=7,
                presentation_score=9,
                innovation_score=6,
                feedback_text=None,
            ),
            db=db,
            current_user=SimpleNamespace(id='reviewer-1', role='reviewer'),
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == 'Team not assigned to reviewer'


@pytest.mark.asyncio
async def test_get_assigned_teams_returns_empty_list_when_no_assignments() -> None:
    db = AsyncSessionStub([ResultStub(scalars=[])])

    response = await reviewer.get_assigned_teams(db=db, current_user=SimpleNamespace(id='reviewer-1', role='reviewer'))

    assert response == []
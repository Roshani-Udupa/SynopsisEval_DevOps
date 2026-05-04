from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.models.user import Document, PlagiarismJob, ReviewScore, Team, TeamMember, User
from app.routers import student
from tests.helpers import AsyncSessionStub, ResultStub


class UploadFileStub:
    filename = 'synopsis.pdf'
    content_type = 'application/pdf'

    async def read(self):
        return b'%PDF-1.4 sample content'


@pytest.mark.asyncio
async def test_get_results_returns_locked_state_when_scores_are_hidden() -> None:
    team = SimpleNamespace(id='team-1', team_name='Team Alpha', scores_released=False)
    membership = SimpleNamespace(team_id=team.id)
    db = AsyncSessionStub([ResultStub(scalar=membership)])
    db.get_results[(Team, team.id)] = team

    response = await student.get_results(db=db, current_user=SimpleNamespace(id='user-1'))

    assert response['scores_released'] is False
    assert response['team_name'] == 'Team Alpha'
    assert response['scores'] == []


@pytest.mark.asyncio
async def test_get_results_returns_scores_and_averages() -> None:
    team = SimpleNamespace(id='team-1', team_name='Team Alpha', scores_released=True)
    membership = SimpleNamespace(team_id=team.id)
    reviewer = SimpleNamespace(full_name='Prof A')
    score = SimpleNamespace(
        team_id=team.id,
        reviewer_id='reviewer-1',
        relevance_score=8,
        methodology_score=7,
        presentation_score=9,
        innovation_score=6,
        feedback_text='Good work',
        submitted_at=SimpleNamespace(isoformat=lambda: '2026-05-01T10:00:00+00:00'),
    )
    latest_doc = SimpleNamespace(id='doc-1')
    job = SimpleNamespace(status='completed', similarity_score=12.5)
    db = AsyncSessionStub([
        ResultStub(scalar=membership),
        ResultStub(scalars=[score]),
        ResultStub(scalar=latest_doc),
        ResultStub(scalar=job),
    ])
    db.get_results[(Team, team.id)] = team
    db.get_results[(User, 'reviewer-1')] = reviewer

    response = await student.get_results(db=db, current_user=SimpleNamespace(id='user-1'))

    assert response['scores_released'] is True
    assert response['team_name'] == 'Team Alpha'
    assert response['scores'][0]['total_score'] == 30.0
    assert response['averages']['total'] == 30.0
    assert response['plagiarism_status'] == 'completed'
    assert response['similarity_score'] == 12.5


@pytest.mark.asyncio
async def test_upload_document_saves_new_version(tmp_path: Path, monkeypatch) -> None:
    team = SimpleNamespace(id='team-1', status='approved')
    membership = SimpleNamespace(team_id=team.id)
    current_user = SimpleNamespace(id='leader-1', role='student_leader')
    db = AsyncSessionStub([
        ResultStub(scalar=membership),
        ResultStub(scalar=None),
    ])
    db.get_results[(Team, team.id)] = team
    monkeypatch.setattr(student.settings, 'UPLOAD_DIR', str(tmp_path))

    response = await student.upload_document(file=UploadFileStub(), db=db, current_user=current_user)

    assert response['message'] == 'Uploaded successfully'
    assert response['version'] == 1
    assert len(db.added) == 1
    saved_document = db.added[0]
    assert isinstance(saved_document, Document)
    assert saved_document.version == 1
    assert Path(saved_document.file_path).exists()


@pytest.mark.asyncio
async def test_upload_document_rejects_non_pdf(monkeypatch) -> None:
    team = SimpleNamespace(id='team-1', status='approved')
    membership = SimpleNamespace(team_id=team.id)
    current_user = SimpleNamespace(id='leader-1', role='student_leader')
    db = AsyncSessionStub([
        ResultStub(scalar=membership),
    ])
    db.get_results[(Team, team.id)] = team

    class WrongFile:
        filename = 'notes.txt'
        content_type = 'text/plain'

        async def read(self):
            return b'not a pdf'

    with pytest.raises(HTTPException) as exc_info:
        await student.upload_document(file=WrongFile(), db=db, current_user=current_user)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == 'Only PDF files are allowed'
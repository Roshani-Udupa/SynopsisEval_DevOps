from __future__ import annotations

import hashlib
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.models.user import PasswordResetToken
from app.routers import auth
from app.schemas.auth import (
    GuideInput,
    LoginRequest,
    MemberInput,
    PasswordResetConfirm,
    PasswordResetRequest,
    ReviewerRegisterRequest,
    TeamRegisterRequest,
)
from tests.helpers import AsyncSessionStub, ResultStub


@pytest.mark.asyncio
async def test_login_returns_token_response_for_valid_user(monkeypatch) -> None:
    user = SimpleNamespace(
        id=uuid.UUID('11111111-1111-1111-1111-111111111111'),
        email='admin@synopsis.edu',
        password_hash='hashed',
        full_name='Admin User',
        role='admin',
        status='approved',
    )
    db = AsyncSessionStub([ResultStub(scalar=user)])
    monkeypatch.setattr(auth, 'verify_password', lambda plain, hashed: True)
    monkeypatch.setattr(auth, 'create_access_token', lambda data: 'token-123')

    response = await auth.login(LoginRequest(email='admin@synopsis.edu', password='admin123'), db=db)

    assert response.access_token == 'token-123'
    assert response.user_id == str(user.id)
    assert response.role == 'admin'
    assert response.status == 'approved'


@pytest.mark.asyncio
async def test_login_rejects_invalid_credentials(monkeypatch) -> None:
    user = SimpleNamespace(
        id=uuid.UUID('11111111-1111-1111-1111-111111111111'),
        email='admin@synopsis.edu',
        password_hash='hashed',
        full_name='Admin User',
        role='admin',
        status='approved',
    )
    db = AsyncSessionStub([ResultStub(scalar=user)])
    monkeypatch.setattr(auth, 'verify_password', lambda plain, hashed: False)

    with pytest.raises(HTTPException) as exc_info:
        await auth.login(LoginRequest(email='admin@synopsis.edu', password='wrong'), db=db)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == 'Invalid email or password'


@pytest.mark.asyncio
async def test_register_reviewer_rejects_duplicate_email() -> None:
    existing_user = SimpleNamespace(id='existing')
    db = AsyncSessionStub([ResultStub(scalar=existing_user)])

    with pytest.raises(HTTPException) as exc_info:
        await auth.register_reviewer(
            ReviewerRegisterRequest(
                email='reviewer@example.com',
                password='secure1234',
                full_name='Dr. Jane Smith',
                department='Computer Science',
                designation='Associate Professor',
                expertise=['ML'],
            ),
            db=db,
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == 'Email already registered'


@pytest.mark.asyncio
async def test_register_reviewer_creates_profile_and_notifies_admins(monkeypatch) -> None:
    db = AsyncSessionStub([ResultStub(scalar=None)])
    notify_admins = AsyncMock()
    monkeypatch.setattr(auth, 'notify_admins', notify_admins)

    response = await auth.register_reviewer(
        ReviewerRegisterRequest(
            email='reviewer@example.com',
            password='secure1234',
            full_name='Dr. Jane Smith',
            department='Computer Science',
            designation='Associate Professor',
            expertise=['ML', 'NLP'],
        ),
        db=db,
    )

    assert response.message == 'Reviewer account submitted for approval. You will be notified once approved.'
    assert len(db.added) == 2
    assert db.commits == 2
    notify_admins.assert_awaited_once()


@pytest.mark.asyncio
async def test_password_reset_request_returns_generic_success(monkeypatch) -> None:
    user = SimpleNamespace(id=uuid.UUID('22222222-2222-2222-2222-222222222222'), full_name='Student One', email='student@example.com')
    db = AsyncSessionStub([ResultStub(scalar=user)])
    send_email = AsyncMock()
    monkeypatch.setattr(auth, 'send_email', send_email)
    monkeypatch.setattr(auth, 'password_reset_email', lambda reset_url, full_name: ('Reset your password', '<p>Reset</p>'))
    monkeypatch.setattr(auth.uuid, 'uuid4', lambda: uuid.UUID('33333333-3333-3333-3333-333333333333'))

    response = await auth.request_password_reset(PasswordResetRequest(email='student@example.com'), db=db)

    assert response.message == 'If an account exists with that email, a password reset link has been sent.'
    assert db.commits == 1
    send_email.assert_awaited_once()


@pytest.mark.asyncio
async def test_password_reset_confirm_updates_password(monkeypatch) -> None:
    token = 'reset-token'
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    reset_token = SimpleNamespace(user_id=uuid.UUID('44444444-4444-4444-4444-444444444444'), token_hash=token_hash, used=False)
    user = SimpleNamespace(id=reset_token.user_id, password_hash='old-hash')
    db = AsyncSessionStub([ResultStub(scalar=reset_token), ResultStub(scalar=user)])
    monkeypatch.setattr(auth, 'hash_password', lambda value: 'new-hash')

    response = await auth.confirm_password_reset(
        PasswordResetConfirm(token=token, new_password='Password123', confirm_password='Password123'),
        db=db,
    )

    assert response.message == 'Password updated successfully. You may now log in.'
    assert user.password_hash == 'new-hash'
    assert reset_token.used is True
    assert db.commits == 1
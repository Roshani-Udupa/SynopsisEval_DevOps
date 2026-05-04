from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.core import security


def test_password_hash_round_trip() -> None:
    hashed = security.hash_password('Password123')

    assert hashed != 'Password123'
    assert security.verify_password('Password123', hashed)


def test_create_and_decode_access_token() -> None:
    token = security.create_access_token({'sub': '123', 'role': 'admin', 'email': 'admin@example.com'})
    payload = security.decode_token(token)

    assert payload['sub'] == '123'
    assert payload['role'] == 'admin'
    assert payload['email'] == 'admin@example.com'
    assert 'exp' in payload


def test_decode_token_rejects_invalid_token() -> None:
    with pytest.raises(HTTPException) as exc_info:
      security.decode_token('not-a-jwt')

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == 'Invalid or expired token'
    assert exc_info.value.headers == {'WWW-Authenticate': 'Bearer'}


@pytest.mark.asyncio
async def test_role_checker_blocks_wrong_role() -> None:
    with pytest.raises(HTTPException) as exc_info:
        await security.require_student(current_user=SimpleNamespace(role='reviewer'))

    assert exc_info.value.status_code == 403
    assert 'student_leader' in exc_info.value.detail
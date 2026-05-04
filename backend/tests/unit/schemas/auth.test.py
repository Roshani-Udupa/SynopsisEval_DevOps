import pytest
from pydantic import ValidationError

from app.schemas.auth import (
    GuideInput,
    LoginRequest,
    MemberInput,
    PasswordResetConfirm,
    ReviewerRegisterRequest,
    TeamRegisterRequest,
)


def test_login_request_accepts_valid_credentials() -> None:
    payload = LoginRequest(email='admin@synopsis.edu', password='admin123')

    assert payload.email == 'admin@synopsis.edu'
    assert payload.password == 'admin123'


def test_password_reset_confirm_validates_strength_and_match() -> None:
    with pytest.raises(ValidationError) as weak_exc:
        PasswordResetConfirm(token='t', new_password='short', confirm_password='short')

    assert 'at least 8 characters' in str(weak_exc.value)

    with pytest.raises(ValidationError) as mismatch_exc:
        PasswordResetConfirm(token='t', new_password='Password1', confirm_password='Password2')

    assert 'Passwords do not match' in str(mismatch_exc.value)


def test_reviewer_registration_trims_and_validates_name() -> None:
    payload = ReviewerRegisterRequest(
        email='reviewer@example.com',
        password='secure1234',
        full_name=' Dr. Jane Smith ',
        department='CSE',
        designation='Associate Professor',
        expertise=['ML'],
    )

    assert payload.full_name == 'Dr. Jane Smith'
    assert payload.expertise == ['ML']


def test_team_registration_normalizes_usn_and_rejects_duplicates() -> None:
    payload = TeamRegisterRequest(
        team_name='Neural Nexus',
        leader_name='Arjun Kumar',
        leader_email='arjun@example.com',
        leader_usn='1ab21cs001',
        leader_password='leader1234',
        members=[
            MemberInput(
                full_name='Priya Sharma',
                email='priya@example.com',
                usn='1ab21cs002',
                password='member1234',
            )
        ],
        guide=GuideInput(full_name='Prof. Ramesh B', email='ramesh@university.edu', department='CSE'),
    )

    assert payload.leader_usn == '1AB21CS001'
    assert payload.members[0].usn == '1AB21CS002'

    with pytest.raises(ValidationError) as duplicate_exc:
        TeamRegisterRequest(
            team_name='Neural Nexus',
            leader_name='Arjun Kumar',
            leader_email='arjun@example.com',
            leader_usn='1AB21CS001',
            leader_password='leader1234',
            members=[
                MemberInput(
                    full_name='Priya Sharma',
                    email='arjun@example.com',
                    usn='1AB21CS001',
                    password='member1234',
                )
            ],
            guide=GuideInput(full_name='Prof. Ramesh B', email='ramesh@university.edu', department='CSE'),
        )

    assert 'Duplicate USN found' in str(duplicate_exc.value)
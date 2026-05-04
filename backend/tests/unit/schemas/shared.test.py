import pytest
from pydantic import ValidationError

from app.schemas.auth import MessageResponse
from app.routers.shared import ChangePasswordBody, ProfileUpdateBody


def test_profile_update_trims_name_and_keeps_optional_fields() -> None:
    payload = ProfileUpdateBody(full_name='  Reviewer Two  ', department=None, designation='  ')

    assert payload.full_name == 'Reviewer Two'
    assert payload.department is None
    assert payload.designation == '  '


def test_profile_update_rejects_short_name() -> None:
    with pytest.raises(ValidationError) as exc_info:
        ProfileUpdateBody(full_name='A', department=None, designation=None)

    assert 'at least 2 characters' in str(exc_info.value)


def test_change_password_validates_match_and_length() -> None:
    payload = ChangePasswordBody(
        current_password='OldPassword1',
        new_password='NewPassword1',
        confirm_password='NewPassword1',
    )

    assert payload.new_password == 'NewPassword1'

    with pytest.raises(ValidationError) as mismatch_exc:
        ChangePasswordBody(
            current_password='OldPassword1',
            new_password='NewPassword1',
            confirm_password='NewPassword2',
        )

    assert 'Passwords do not match' in str(mismatch_exc.value)


def test_message_response_defaults_to_success_true() -> None:
    response = MessageResponse(message='Saved successfully')

    assert response.success is True
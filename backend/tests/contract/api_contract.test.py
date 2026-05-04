from __future__ import annotations

from app.main import app


def test_openapi_contains_expected_paths_and_response_models() -> None:
    schema = app.openapi()

    assert '/api/auth/login' in schema['paths']
    assert '/api/student/results' in schema['paths']
    assert '/api/reviewer/dashboard' in schema['paths']
    assert '/api/profile' in schema['paths']

    login_response = schema['paths']['/api/auth/login']['post']['responses']['200']['content']['application/json']['schema']
    reviewer_response = schema['paths']['/api/auth/register/reviewer']['post']['responses']['201']['content']['application/json']['schema']

    assert login_response['$ref'].endswith('/TokenResponse')
    assert reviewer_response['$ref'].endswith('/MessageResponse')
    assert 'TokenResponse' in schema['components']['schemas']
    assert 'MessageResponse' in schema['components']['schemas']
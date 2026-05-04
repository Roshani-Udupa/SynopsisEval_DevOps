from __future__ import annotations

import pytest
from fastapi.middleware.cors import CORSMiddleware

from app.main import app, health


@pytest.mark.asyncio
async def test_health_endpoint_returns_expected_payload() -> None:
    response = await health()

    assert response == {'status': 'ok', 'service': app.title}


def test_core_routes_are_registered() -> None:
    route_paths = {route.path for route in app.routes}

    assert '/api/auth/login' in route_paths
    assert '/api/reviewer/dashboard' in route_paths
    assert '/api/student/results' in route_paths
    assert '/api/profile' in route_paths
    assert '/api/notifications' in route_paths


def test_cors_middleware_is_configured() -> None:
    assert any(middleware.cls is CORSMiddleware for middleware in app.user_middleware)
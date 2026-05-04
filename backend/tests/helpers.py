from __future__ import annotations

from typing import Any


class ResultStub:
    def __init__(self, scalar: Any = None, scalars: list[Any] | tuple[Any, ...] | None = None):
        self._scalar = scalar
        self._scalars = list(scalars or [])

    def scalar_one_or_none(self):
        return self._scalar

    def scalar_one(self):
        if self._scalar is None:
            raise ValueError('No scalar value configured for this stub')
        return self._scalar

    def scalars(self):
        return self

    def all(self):
        return list(self._scalars)

    def first(self):
        return self._scalars[0] if self._scalars else None


class AsyncSessionStub:
    def __init__(self, execute_results: list[ResultStub] | None = None, get_results: dict[Any, Any] | None = None):
        self.execute_results = list(execute_results or [])
        self.get_results = get_results or {}
        self.added: list[Any] = []
        self.deleted: list[Any] = []
        self.refreshed: list[Any] = []
        self.commits = 0
        self.flushes = 0

    async def execute(self, *args, **kwargs):
        if not self.execute_results:
            raise AssertionError('No execute result configured for AsyncSessionStub')
        return self.execute_results.pop(0)

    async def get(self, model, key):
        return (
            self.get_results.get((model, key))
            or self.get_results.get((model, str(key)))
            or self.get_results.get(key)
        )

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        self.flushes += 1

    async def commit(self):
        self.commits += 1

    async def delete(self, obj):
        self.deleted.append(obj)

    async def refresh(self, obj):
        self.refreshed.append(obj)
# Unit test: safe_client blocks redirect hop to internal address (no external redirector reachable from preview)
import asyncio
import sys

import httpx
import pytest
from fastapi import HTTPException

sys.path.insert(0, "/app/backend")
from audit_engine import safe_client  # noqa: E402


def _handler(req):
    if req.url.host == "example.com":
        return httpx.Response(302, headers={"Location": "http://127.0.0.1:8001/api/"})
    return httpx.Response(200, text="internal-secret")


def test_redirect_to_internal_blocked():
    async def go():
        async with safe_client(transport=httpx.MockTransport(_handler)) as c:
            return await c.get("https://example.com/")
    with pytest.raises(HTTPException) as e:
        asyncio.run(go())
    assert e.value.status_code == 400

# Shared fixtures: BASE_URL, Clerk session tokens for owner (user A) and a second user (B)
import os
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

BASE_URL = None
fe = dotenv_values(Path("/app/frontend/.env"))
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or fe.get("REACT_APP_BACKEND_URL")).rstrip("/")
_SK = dotenv_values(Path("/app/backend/.env")).get("CLERK_SECRET_KEY")
CLERK = "https://api.clerk.com/v1"
H = {"Authorization": f"Bearer {_SK}", "User-Agent": "accesslayer-tests", "Content-Type": "application/json"}

OWNER_ID = "user_3LQEhGRnyMRaC8GoVc3nZtQVj3s"
USER_B_EMAIL = "tester_b+clerk_test@accesslayer.io"


def clerk_user_id(email):
    r = requests.get(f"{CLERK}/users", params={"email_address": email}, headers=H, timeout=20)
    r.raise_for_status()
    if r.json():
        return r.json()[0]["id"]
    r = requests.post(f"{CLERK}/users", json={"email_address": [email], "password": "AccessLayer-TestB-2026!",
                                              "skip_password_checks": True}, headers=H, timeout=20)
    r.raise_for_status()
    return r.json()["id"]


class Tok:
    def __init__(self, uid):
        r = requests.post(f"{CLERK}/sessions", json={"user_id": uid}, headers=H, timeout=20)
        r.raise_for_status()
        self.sid = r.json()["id"]

    def get(self):
        r = requests.post(f"{CLERK}/sessions/{self.sid}/tokens", json={"expires_in_seconds": 600}, headers=H, timeout=20)
        r.raise_for_status()
        return r.json()["jwt"]


@pytest.fixture(scope="session")
def base():
    return BASE_URL


@pytest.fixture(scope="session")
def tok_a():
    return Tok(OWNER_ID)


@pytest.fixture(scope="session")
def tok_b():
    return Tok(clerk_user_id(USER_B_EMAIL))


@pytest.fixture
def A(tok_a):
    return {"Authorization": f"Bearer {tok_a.get()}"}


@pytest.fixture
def B(tok_b):
    return {"Authorization": f"Bearer {tok_b.get()}"}

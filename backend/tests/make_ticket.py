# Helper: create a Clerk sign-in ticket for the owner test user (prints ticket only)
import requests
from conftest import CLERK, H, OWNER_ID

r = requests.post(f"{CLERK}/sign_in_tokens", json={"user_id": OWNER_ID, "expires_in_seconds": 900}, headers=H, timeout=20)
r.raise_for_status()
print(r.json()["token"])

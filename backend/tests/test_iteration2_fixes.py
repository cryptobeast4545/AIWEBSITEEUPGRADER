# Iteration 2 regression: SSRF hardening, widget report origin check, drop-alert source isolation
import time
import pytest
import requests
from conftest import BASE_URL

API = f"{BASE_URL}/api"


# SSRF: private / loopback / DNS-to-private / redirect-to-internal must be rejected with 400
@pytest.mark.parametrize("url", [
    "http://172.17.0.1", "http://172.17.0.1:8001/api/", "http://localtest.me", "http://localtest.me:8001/api/",
    "http://0.0.0.0", "http://0.0.0.0:8001", "http://127.0.0.1:8001", "http://127.1", "http://10.0.0.1.nip.io",
    "http://169.254.169.254/latest/meta-data/", "http://192.168.1.1", "http://[::1]:8001",
])
def test_ssrf_blocked(url):
    r = requests.post(f"{API}/public/scan", json={"url": url}, timeout=60)
    print(url, r.status_code, r.text[:160])
    assert r.status_code == 400, f"{url} -> {r.status_code} {r.text[:200]}"


def test_public_site_still_works():
    r = requests.post(f"{API}/public/scan", json={"url": "https://example.com"}, timeout=60)
    assert r.status_code == 200, r.text[:200]
    d = r.json()
    assert isinstance(d["a11y_score"], int) and "example.com" in d["url"]


def test_public_redirect_to_public_ok():
    r = requests.post(f"{API}/public/scan", json={"url": "http://example.com"}, timeout=60)
    assert r.status_code == 200


@pytest.mark.parametrize("src", ["http://127.0.0.1:8001/api/", "http://localtest.me/x.png", "http://172.17.0.1/a.png",
                                 "http://169.254.169.254/latest/meta-data/"])
def test_widget_alt_internal_rejected(src):
    r = requests.post(f"{API}/widget/demo/alt", json={"src": src + f"?t={time.time()}", "context": ""}, timeout=30)
    print(src, r.status_code, r.text[:160])
    assert r.status_code == 400


# Widget report origin check
@pytest.fixture(scope="module")
def site(tok_a):
    h = {"Authorization": f"Bearer {tok_a.get()}"}
    r = requests.post(f"{API}/sites", json={"name": "TEST_iter2", "url": "https://example.com", "whatsapp": "",
                                             "alert_email": "delivered@resend.dev"}, headers=h, timeout=30)
    assert r.status_code == 200, r.text
    s = r.json()
    yield s
    requests.delete(f"{API}/sites/{s['id']}", headers={"Authorization": f"Bearer {tok_a.get()}"}, timeout=30)


V = [{"id": "image-alt", "impact": "critical", "help": "x", "nodes": [{"html": "<img>", "target": ["img"]}]}] * 4


def test_report_wrong_origin_403(site):
    r = requests.post(f"{API}/widget/{site['id']}/report", json={"url": "https://evil.com/", "violations": V},
                      headers={"Origin": "https://evil.com"}, timeout=30)
    assert r.status_code == 403


def test_report_no_origin_wrong_url_403(site):
    r = requests.post(f"{API}/widget/{site['id']}/report", json={"url": "https://evil.com/", "violations": V}, timeout=30)
    assert r.status_code == 403


def test_report_lookalike_host_403(site):
    r = requests.post(f"{API}/widget/{site['id']}/report", json={"url": "https://notexample.com/", "violations": V},
                      headers={"Origin": "https://notexample.com"}, timeout=30)
    assert r.status_code == 403


def test_report_matching_origin_ok(site):
    r = requests.post(f"{API}/widget/{site['id']}/report", json={"url": "https://www.example.com/page", "violations": V},
                      headers={"Origin": "https://www.example.com"}, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["a11y_score"] == 0


def test_report_subdomain_ok(site):
    r = requests.post(f"{API}/widget/{site['id']}/report", json={"url": "https://blog.example.com/", "violations": []},
                      headers={"Origin": "https://blog.example.com"}, timeout=30)
    assert r.status_code == 200


def test_demo_report_any_origin_ok():
    r = requests.post(f"{API}/widget/demo/report", json={"url": "https://anything.test/", "violations": []},
                      headers={"Origin": "https://anything.test"}, timeout=30)
    assert r.status_code == 200


def test_history_sources(site, tok_a):
    h = {"Authorization": f"Bearer {tok_a.get()}"}
    r = requests.post(f"{API}/sites/{site['id']}/audit", headers=h, timeout=90)
    assert r.status_code == 200 and r.json()["source"] == "server"
    lst = requests.get(f"{API}/sites/{site['id']}/audits", headers=h, timeout=30).json()
    srcs = sorted(a["source"] for a in lst)
    assert srcs == ["server", "widget", "widget"], srcs

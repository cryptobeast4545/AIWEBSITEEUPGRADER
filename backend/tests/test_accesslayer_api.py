# AccessLayer API regression tests: public scan/report, widget APIs, auth-protected sites/audits, isolation, WhatsApp status webhook
import requests
import pytest

from conftest import BASE_URL

API = f"{BASE_URL}/api"
STATE = {}


# ---- Public ----
class TestPublic:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=20)
        assert r.status_code == 200 and r.json()["status"] == "ok"

    def test_integrations_status(self):
        r = requests.get(f"{API}/integrations/status", timeout=20)
        d = r.json()
        print(d)
        for k in ("database", "ai", "voice", "whatsapp", "email"):
            assert d[k] is True, k

    def test_widget_js(self):
        r = requests.get(f"{API}/widget.js", timeout=20)
        assert r.status_code == 200
        assert "javascript" in r.headers["content-type"]
        assert len(r.text) > 1000

    def test_public_scan_and_report(self):
        r = requests.post(f"{API}/public/scan", json={"url": "example.com"}, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d["a11y_score"], int) and 0 <= d["a11y_score"] <= 100
        assert isinstance(d["seo_score"], int)
        assert isinstance(d["violations"], list) and len(d["seo"]) > 10
        g = requests.get(f"{API}/reports/{d['id']}", timeout=20)
        assert g.status_code == 200
        assert g.json()["a11y_score"] == d["a11y_score"] and "user_id" not in g.json()

    def test_public_scan_invalid(self):
        assert requests.post(f"{API}/public/scan", json={"url": "localhost"}, timeout=20).status_code == 400
        assert requests.post(f"{API}/public/scan", json={"url": ""}, timeout=20).status_code == 400

    def test_report_404(self):
        assert requests.get(f"{API}/reports/nope123", timeout=20).status_code == 404


# ---- Widget ----
class TestWidget:
    def test_config(self):
        r = requests.get(f"{API}/widget/demo/config", timeout=20)
        assert r.status_code == 200 and "autofix" in r.json()

    def test_command(self):
        r = requests.post(f"{API}/widget/demo/command", json={"transcript": "click the menu button", "lang": "en-IN",
                                                            "elements": [{"i": 0, "tag": "button", "label": "Menu"}, {"i": 1, "tag": "a", "label": "Home"}]}, timeout=60)
        assert r.status_code == 200, r.text
        c = r.json()["command"]
        print(c)
        assert c["action"] == "CLICK" and c["index"] == 0

    def test_command_hindi_scroll(self):
        r = requests.post(f"{API}/widget/demo/command", json={"transcript": "नीचे स्क्रॉल करो", "lang": "hi-IN", "elements": []}, timeout=60)
        assert r.status_code == 200, r.text
        print(r.json())
        assert r.json()["command"]["action"] == "SCROLL"

    def test_tts(self):
        r = requests.post(f"{API}/widget/demo/tts", json={"text": "Hello from AccessLayer", "lang": "en-IN"}, timeout=60)
        assert r.status_code == 200, r.text
        assert len(r.json()["audio_base64"]) > 1000

    def test_alt(self):
        r = requests.post(f"{API}/widget/demo/alt", json={"src": "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=400"}, timeout=60)
        assert r.status_code == 200, r.text
        print(r.json())
        assert len(r.json()["alt"]) > 5

    def test_alt_relative_400(self):
        assert requests.post(f"{API}/widget/demo/alt", json={"src": "/img.png"}, timeout=20).status_code == 400

    def test_report(self):
        v = [{"id": "image-alt", "impact": "critical", "help": "x", "nodes": [{"html": "<img>"}]},
             {"id": "color-contrast", "impact": "serious", "help": "y", "nodes": [{"html": "<p>"}]}]
        r = requests.post(f"{API}/widget/demo/report", json={"url": "https://demo.test/", "violations": v, "passes": 10}, timeout=20)
        assert r.status_code == 200
        assert r.json()["a11y_score"] == 63 and r.json()["counts"]["critical"] == 1

    def test_unknown_site(self):
        assert requests.get(f"{API}/widget/nosuchsite/config", timeout=20).status_code == 404
        assert requests.post(f"{API}/widget/nosuchsite/command", json={"transcript": "x"}, timeout=20).status_code == 404


# ---- Auth ----
class TestAuth:
    def test_401(self):
        for m, p in [("get", "/sites"), ("get", "/stats/overview"), ("post", "/sites"), ("get", "/me")]:
            assert requests.request(m, f"{API}{p}", json={}, timeout=20).status_code == 401, p
        assert requests.get(f"{API}/sites", headers={"Authorization": "Bearer bad.token.x"}, timeout=20).status_code == 401

    def test_me(self, A):
        r = requests.get(f"{API}/me", headers=A, timeout=20)
        assert r.status_code == 200 and r.json()["user_id"].startswith("user_")

    def test_create_site(self, A):
        r = requests.post(f"{API}/sites", headers=A, json={"name": "TEST_Example", "url": "example.com", "alert_email": "delivered@resend.dev"}, timeout=20)
        assert r.status_code == 200, r.text
        s = r.json()
        assert s["url"] == "https://example.com" and s["name"] == "TEST_Example"
        STATE["site"] = s["id"]
        g = requests.get(f"{API}/sites/{s['id']}", headers=A, timeout=20)
        assert g.status_code == 200 and g.json()["alert_email"] == "delivered@resend.dev"
        assert any(x["id"] == s["id"] for x in requests.get(f"{API}/sites", headers=A, timeout=20).json())

    def test_create_site_validation(self, A):
        assert requests.post(f"{API}/sites", headers=A, json={"name": "", "url": "example.com"}, timeout=20).status_code == 422

    def test_update_site(self, A):
        r = requests.patch(f"{API}/sites/{STATE['site']}", headers=A, json={"autofix": False, "name": "TEST_Renamed"}, timeout=20)
        assert r.status_code == 200 and r.json()["autofix"] is False
        g = requests.get(f"{API}/sites/{STATE['site']}", headers=A, timeout=20).json()
        assert g["name"] == "TEST_Renamed" and g["autofix"] is False

    def test_isolation(self, B):
        for m, p in [("get", f"/sites/{STATE['site']}"), ("patch", f"/sites/{STATE['site']}"), ("delete", f"/sites/{STATE['site']}"),
                     ("post", f"/sites/{STATE['site']}/audit"), ("get", f"/sites/{STATE['site']}/audits")]:
            assert requests.request(m, f"{API}{p}", headers=B, json={}, timeout=30).status_code == 404, p
        assert not any(x["id"] == STATE["site"] for x in requests.get(f"{API}/sites", headers=B, timeout=20).json())

    def test_audit(self, A):
        r = requests.post(f"{API}/sites/{STATE['site']}/audit", headers=A, timeout=60)
        assert r.status_code == 200, r.text
        a = r.json()
        assert isinstance(a["a11y_score"], int) and isinstance(a["seo_score"], int)
        assert isinstance(a["violations"], list) and isinstance(a["seo"], list)
        STATE["audit"] = a["id"]
        STATE["rule"] = a["violations"][0]["id"] if a["violations"] else None
        lst = requests.get(f"{API}/sites/{STATE['site']}/audits", headers=A, timeout=20).json()
        assert lst[0]["id"] == a["id"]
        g = requests.get(f"{API}/audits/{a['id']}", headers=A, timeout=20)
        assert g.status_code == 200 and g.json()["a11y_score"] == a["a11y_score"]

    def test_audit_isolation(self, B):
        assert requests.get(f"{API}/audits/{STATE['audit']}", headers=B, timeout=20).status_code == 404
        assert requests.post(f"{API}/audits/{STATE['audit']}/fix", headers=B, json={"rule_id": "x"}, timeout=20).status_code == 404

    def test_fix(self, A):
        if not STATE.get("rule"):
            pytest.skip("no violations on example.com")
        r = requests.post(f"{API}/audits/{STATE['audit']}/fix", headers=A, json={"rule_id": STATE["rule"]}, timeout=90)
        assert r.status_code == 200, r.text
        assert len(r.json()["tip"]) > 20
        g = requests.get(f"{API}/audits/{STATE['audit']}", headers=A, timeout=20).json()
        assert STATE["rule"] in g["fixes"]
        assert requests.post(f"{API}/audits/{STATE['audit']}/fix", headers=A, json={"rule_id": "nonexistent"}, timeout=20).status_code == 404

    def test_send_email(self, A):
        r = requests.post(f"{API}/audits/{STATE['audit']}/send-email", headers=A, timeout=60)
        assert r.status_code == 200, r.text
        assert r.json()["to"] == "delivered@resend.dev"

    def test_stats(self, A):
        r = requests.get(f"{API}/stats/overview", headers=A, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["sites"] >= 1 and d["audits"] >= 1 and isinstance(d["trend"], list)

    def test_delete_site(self, A):
        r = requests.delete(f"{API}/sites/{STATE['site']}", headers=A, timeout=20)
        assert r.status_code == 200
        assert requests.get(f"{API}/sites/{STATE['site']}", headers=A, timeout=20).status_code == 404
        assert requests.get(f"{API}/audits/{STATE['audit']}", headers=A, timeout=20).status_code == 404


class TestWhatsApp:
    def test_status_callback(self):
        r = requests.post(f"{API}/whatsapp/webhook", json={"status": "delivered", "from": "9999999999"}, timeout=20)
        assert r.status_code == 200 and r.json() == {"ok": True}

    def test_verify(self):
        assert requests.get(f"{API}/whatsapp/webhook?hub.challenge=abc", timeout=20).text == "abc"

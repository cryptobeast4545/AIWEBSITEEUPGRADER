import os
import re
import ipaddress
import logging
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx
import resend
from fastapi import HTTPException

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
EMAIL_FROM = os.environ.get("EMAIL_FROM", "")          # e.g. "AccessLayer <no-reply@yourdomain.com>"
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "AccessLayer")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")

# Initialise the Resend client once at import time (key may be empty during tests)
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} ≠ real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str) -> str | None:
    _assert_safe_email(subject, html)
    if not RESEND_API_KEY:
        raise HTTPException(status_code=503, detail="Email is not configured (missing RESEND_API_KEY)")
    if not EMAIL_FROM:
        raise HTTPException(status_code=503, detail="Email is not configured (missing EMAIL_FROM)")
    params: resend.Emails.SendParams = {
        "from": EMAIL_FROM,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if EMAIL_REPLY_TO:
        params["reply_to"] = [EMAIL_REPLY_TO]
    try:
        email = resend.Emails.send(params)
        return email.get("id")
    except Exception as e:
        logger.error(f"Resend email failed: {str(e)}")
        raise HTTPException(status_code=502, detail="Failed to send email")


def _color(s):
    return "#047857" if s >= 90 else "#b45309" if s >= 60 else "#b91c1c"


def scorecard_html(site_name: str, audit: dict, report_url: str | None):
    c = audit.get("counts", {})
    rows = "".join(
        f'<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a">{escape(v.get("help", ""))}</td>'
        f'<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;text-transform:uppercase;color:#475569">{escape(v.get("impact", ""))}</td>'
        f'<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a;text-align:right">{int(v.get("count", 0))}</td></tr>'
        for v in audit.get("violations", [])[:8])
    seo = audit.get("seo_score")
    link = (f'<p style="margin:24px 0"><a href="{escape(report_url)}" style="background:#047857;color:#ffffff;padding:12px 20px;'
            f'border-radius:999px;text-decoration:none;font-weight:bold;font-size:14px">Open full report</a></p>') if report_url else ""
    return f"""<table role="presentation" width="100%" style="background:#f1f5f9;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" style="background:#ffffff;border-radius:16px;font-family:Arial,sans-serif;padding:32px">
<tr><td>
<p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#047857;margin:0">{escape(EMAIL_FROM_NAME)} · WCAG 2.1 AA Scorecard</p>
<h1 style="font-size:24px;color:#0f172a;margin:8px 0 4px">{escape(site_name)}</h1>
<p style="font-size:13px;color:#475569;margin:0 0 24px">{escape(audit.get("url", ""))}</p>
<table role="presentation" width="100%"><tr>
<td style="background:#f8fafc;border-radius:12px;padding:16px;text-align:center"><div style="font-size:40px;font-weight:bold;color:{_color(audit.get('a11y_score', 0))}">{int(audit.get("a11y_score", 0))}</div><div style="font-size:12px;color:#475569">Accessibility score</div></td>
<td width="12"></td>
<td style="background:#f8fafc;border-radius:12px;padding:16px;text-align:center"><div style="font-size:40px;font-weight:bold;color:{_color(seo or 0)}">{int(seo) if seo is not None else "–"}</div><div style="font-size:12px;color:#475569">SEO score</div></td>
</tr></table>
<p style="font-size:14px;color:#0f172a;margin:24px 0 8px"><strong>Issues by impact:</strong> Critical {c.get("critical", 0)} · Serious {c.get("serious", 0)} · Moderate {c.get("moderate", 0)} · Minor {c.get("minor", 0)}</p>
<table role="presentation" width="100%" style="border-collapse:collapse">{rows}</table>
{link}
<p style="font-size:12px;color:#64748b;margin-top:24px">Sent by {escape(EMAIL_FROM_NAME)} accessibility monitoring. We never ask for passwords or payment details by email.</p>
</td></tr></table></td></tr></table>"""


def normalize_phone(phone: str) -> str:
    return re.sub(r"\D", "", phone or "").removeprefix("91")[-10:]


def whatsapp_configured():
    return bool(os.environ.get("FAST2SMS_API_KEY") and os.environ.get("FAST2SMS_PHONE_NUMBER_ID"))


def email_configured():
    return bool(RESEND_API_KEY and EMAIL_FROM)


async def send_whatsapp(phone: str, message: str):
    if not whatsapp_configured():
        raise HTTPException(503, "WhatsApp is not configured yet (missing Fast2SMS keys)")
    num = normalize_phone(phone)
    if len(num) != 10:
        raise HTTPException(400, "Invalid Indian mobile number")
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post("https://www.fast2sms.com/dev/whatsapp-session",
                         params={"phone_number_id": os.environ["FAST2SMS_PHONE_NUMBER_ID"], "to": f"91{num}"},
                         headers={"Authorization": os.environ["FAST2SMS_API_KEY"], "Content-Type": "application/json", "accept": "application/json"},
                         json={"type": "text", "text": message[:4000]})
    try:
        data = r.json()
    except ValueError:
        data = {}
    if r.status_code >= 400 or data.get("return") is False:
        logger.error("Fast2SMS error %s %s", r.status_code, str(data)[:300])
        raise HTTPException(502, data.get("message") or f"WhatsApp send failed ({r.status_code})")


def whatsapp_summary(name: str, audit: dict, report_url: str | None):
    c = audit.get("counts", {})
    top = "\n".join(f"• {v.get('help')} ({v.get('impact')})" for v in audit.get("violations", [])[:3])
    msg = (f"*AccessLayer Scorecard* — {name}\n{audit.get('url')}\n\n"
           f"♿ Accessibility: *{audit.get('a11y_score')}/100*\n🔎 SEO: *{audit.get('seo_score') if audit.get('seo_score') is not None else '–'}/100*\n"
           f"Critical {c.get('critical', 0)} · Serious {c.get('serious', 0)} · Moderate {c.get('moderate', 0)} · Minor {c.get('minor', 0)}")
    if top:
        msg += f"\n\n*Top issues*\n{top}"
    if report_url:
        msg += f"\n\nFull report: {report_url}"
    return msg + "\n\nReply with any issue name for fix help."

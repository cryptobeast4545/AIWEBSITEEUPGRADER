import asyncio
import hashlib
import logging
import os
import re
import uuid
from pathlib import Path
from typing import List, Optional

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import db  # noqa: E402
import ai  # noqa: E402
import voice  # noqa: E402
import notify  # noqa: E402
from audit_engine import run_url_audit, score_violations, normalize_axe, normalize_url  # noqa: E402
from clerk_auth import clerk_router, require_user  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="AccessLayer API")
api = APIRouter(prefix="/api")


@app.on_event("startup")
async def startup():
    try:
        await db.connect()
    except Exception as e:
        logger.error("Database connection failed: %s", str(e)[:300])


@app.on_event("shutdown")
async def shutdown():
    await db.close()


# ---------- models ----------
class SiteIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    url: str = Field(min_length=3, max_length=300)
    whatsapp: str = ""
    alert_email: str = ""


class SiteUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    whatsapp: Optional[str] = None
    alert_email: Optional[str] = None
    alerts_enabled: Optional[bool] = None
    autofix: Optional[bool] = None
    voice_enabled: Optional[bool] = None
    ai_alt: Optional[bool] = None


class ScanIn(BaseModel):
    url: str


class FixIn(BaseModel):
    rule_id: str


class WidgetReport(BaseModel):
    url: str
    violations: list = []
    passes: int = 0


class AltIn(BaseModel):
    src: str
    context: str = ""


class TTSIn(BaseModel):
    text: str = Field(min_length=1, max_length=3000)
    lang: str = "en-IN"


class CommandIn(BaseModel):
    transcript: str
    lang: str = "en-IN"
    elements: list = []


def origin_of(request: Request):
    o = request.headers.get("origin") or ""
    return o if o.startswith("https://") else ""


async def owned_site(site_id: str, user: dict):
    s = await db.fetchrow("select * from al_sites where id=$1 and user_id=$2", site_id, user["user_id"])
    if not s:
        raise HTTPException(404, "Site not found")
    return s


async def save_audit(site_id, user_id, source, result):
    aid = uuid.uuid4().hex
    await db.execute(
        "insert into al_audits (id, site_id, user_id, source, url, a11y_score, seo_score, counts, violations, seo, meta) "
        "values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
        aid, site_id, user_id, source, result["url"], result["a11y_score"], result.get("seo_score"),
        result["counts"], result["violations"], result.get("seo", []), result.get("meta", {}))
    return await db.fetchrow("select * from al_audits where id=$1", aid)


def report_url(origin, audit_id):
    return f"{origin}/report/{audit_id}" if origin else None


async def check_drop_alert(site: dict, audit: dict):
    try:
        prev = await db.fetchrow("select a11y_score from al_audits where site_id=$1 and id<>$2 order by created_at desc limit 1",
                                 site["id"], audit["id"])
        if not prev or not site.get("alerts_enabled"):
            return
        drop = prev["a11y_score"] - audit["a11y_score"]
        if drop < 5:
            return
        link = report_url(site.get("app_origin"), audit["id"])
        msg = (f"⚠️ *Compliance drop alert* — {site['name']}\nAccessibility score fell from {prev['a11y_score']} to "
               f"*{audit['a11y_score']}* (−{drop}).\nCritical issues: {audit['counts'].get('critical', 0)}" + (f"\n{link}" if link else ""))
        if site.get("whatsapp") and notify.whatsapp_configured():
            await notify.send_whatsapp(site["whatsapp"], msg)
        if site.get("alert_email"):
            await notify.send_email(to=site["alert_email"], subject=f"Accessibility score dropped to {audit['a11y_score']} – {site['name']}",
                                    html=notify.scorecard_html(site["name"], audit, link))
    except Exception as e:
        logger.warning("Drop alert failed: %s", str(e)[:200])


# ---------- public ----------
@api.get("/")
async def root():
    return {"service": "AccessLayer", "status": "ok"}


@api.get("/integrations/status")
async def integrations_status():
    ok_db = True
    try:
        db.pool()
    except HTTPException:
        ok_db = False
    return {"database": ok_db, "ai": ai.configured(), "voice": voice.configured(),
            "whatsapp": notify.whatsapp_configured(), "email": True, "model": ai.model_name()}


@api.get("/widget.js")
async def widget_js():
    return FileResponse(ROOT_DIR / "static" / "widget.js", media_type="application/javascript",
                        headers={"Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*"})


@api.post("/public/scan")
async def public_scan(body: ScanIn):
    result = await run_url_audit(body.url)
    return await save_audit(None, None, "public", result)


@api.get("/reports/{audit_id}")
async def public_report(audit_id: str):
    a = await db.fetchrow("select a.*, s.name as site_name from al_audits a left join al_sites s on s.id=a.site_id where a.id=$1", audit_id)
    if not a:
        raise HTTPException(404, "Report not found")
    a.pop("user_id", None)
    return a


# ---------- widget (public, keyed by site id) ----------
async def widget_site(site_id: str):
    s = await db.fetchrow("select * from al_sites where id=$1", site_id)
    if not s:
        raise HTTPException(404, "Unknown site id")
    return s


@api.get("/widget/{site_id}/config")
async def widget_config(site_id: str):
    s = await widget_site(site_id)
    return {"name": s["name"], "autofix": s["autofix"], "voice": s["voice_enabled"], "ai_alt": s["ai_alt"] and ai.configured(),
            "sarvam": voice.configured(), "ai": ai.configured()}


@api.post("/widget/{site_id}/report")
async def widget_report(site_id: str, body: WidgetReport, bg: BackgroundTasks):
    s = await widget_site(site_id)
    violations = normalize_axe(body.violations)
    score, counts = score_violations(violations)
    result = {"url": body.url[:500], "a11y_score": score, "seo_score": None, "counts": counts, "violations": violations,
              "meta": {"engine": "axe-core (in-browser, live DOM)", "passes": body.passes}}
    audit = await save_audit(site_id, s["user_id"], "widget", result)
    if site_id != "demo":
        bg.add_task(check_drop_alert, s, audit)
    return {"id": audit["id"], "a11y_score": score, "counts": counts}


@api.post("/widget/{site_id}/alt")
async def widget_alt(site_id: str, body: AltIn):
    s = await widget_site(site_id)
    if not s["ai_alt"]:
        raise HTTPException(403, "AI alt text disabled for this site")
    src = body.src[:1000]
    if not src.startswith(("http://", "https://")):
        raise HTTPException(400, "Image URL must be absolute")
    key = hashlib.sha256(src.encode()).hexdigest()
    hit = await db.fetchrow("select alt from al_alt_cache where src=$1", key)
    if hit:
        return {"alt": hit["alt"], "cached": True}
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as c:
        try:
            r = await c.get(src, headers={"User-Agent": "AccessLayerBot/2.0"})
        except httpx.HTTPError:
            raise HTTPException(422, "Could not download image")
    mime = (r.headers.get("content-type") or "").split(";")[0].strip()
    if r.status_code >= 400 or mime not in ("image/jpeg", "image/png", "image/webp", "image/heic", "image/heif") or len(r.content) > 8_000_000:
        raise HTTPException(422, "Unsupported image")
    alt = await ai.alt_text(r.content, mime, body.context)
    await db.execute("insert into al_alt_cache (src, alt) values ($1,$2) on conflict (src) do nothing", key, alt)
    return {"alt": alt, "cached": False}


@api.post("/widget/{site_id}/tts")
async def widget_tts(site_id: str, body: TTSIn):
    await widget_site(site_id)
    return {"audio_base64": await voice.tts(body.text, body.lang), "mime_type": "audio/wav"}


@api.post("/widget/{site_id}/command")
async def widget_command(site_id: str, body: CommandIn):
    await widget_site(site_id)
    return {"transcript": body.transcript, "command": await ai.voice_command(body.transcript, body.elements, body.lang)}


@api.post("/widget/{site_id}/voice")
async def widget_voice(site_id: str, file: UploadFile = File(...), lang: str = Form("en-IN"), elements: str = Form("[]")):
    import json
    await widget_site(site_id)
    raw = await file.read()
    if not raw or len(raw) > 10_000_000:
        raise HTTPException(400, "Empty or oversized audio")
    transcript = await voice.stt(raw, file.filename or "voice.wav", file.content_type or "audio/wav", lang)
    try:
        els = json.loads(elements)
    except ValueError:
        els = []
    cmd = await ai.voice_command(transcript, els, lang) if transcript else {"action": "NONE", "reply": "I could not hear anything"}
    return {"transcript": transcript, "command": cmd}


# ---------- dashboard (auth) ----------
@api.get("/me")
async def me(user: dict = Depends(require_user)):
    return {"user_id": user["user_id"]}


@api.get("/sites")
async def list_sites(user: dict = Depends(require_user)):
    return await db.fetch(
        "select s.*, la.a11y_score as last_score, la.seo_score as last_seo, la.created_at as last_audit_at, "
        "(select count(*) from al_audits x where x.site_id=s.id) as audit_count "
        "from al_sites s left join lateral (select a11y_score, seo_score, created_at from al_audits a where a.site_id=s.id "
        "order by created_at desc limit 1) la on true where s.user_id=$1 order by s.created_at desc", user["user_id"])


@api.post("/sites")
async def create_site(body: SiteIn, request: Request, user: dict = Depends(require_user)):
    url = normalize_url(body.url)
    sid = "site_" + uuid.uuid4().hex[:12]
    await db.execute("insert into al_sites (id, user_id, name, url, whatsapp, alert_email, app_origin) values ($1,$2,$3,$4,$5,$6,$7)",
                     sid, user["user_id"], body.name.strip(), url, notify.normalize_phone(body.whatsapp), body.alert_email.strip(), origin_of(request))
    return await db.fetchrow("select * from al_sites where id=$1", sid)


@api.get("/sites/{site_id}")
async def get_site(site_id: str, user: dict = Depends(require_user)):
    return await owned_site(site_id, user)


@api.patch("/sites/{site_id}")
async def update_site(site_id: str, body: SiteUpdate, request: Request, user: dict = Depends(require_user)):
    await owned_site(site_id, user)
    data = body.model_dump(exclude_none=True)
    if "url" in data:
        data["url"] = normalize_url(data["url"])
    if "whatsapp" in data:
        data["whatsapp"] = notify.normalize_phone(data["whatsapp"])
    if origin_of(request):
        data["app_origin"] = origin_of(request)
    if data:
        cols = list(data)
        sets = ", ".join(f"{c}=${i + 2}" for i, c in enumerate(cols))
        await db.execute(f"update al_sites set {sets} where id=$1", site_id, *[data[c] for c in cols])
    return await db.fetchrow("select * from al_sites where id=$1", site_id)


@api.delete("/sites/{site_id}")
async def delete_site(site_id: str, user: dict = Depends(require_user)):
    await owned_site(site_id, user)
    await db.execute("delete from al_audits where site_id=$1", site_id)
    await db.execute("delete from al_sites where id=$1", site_id)
    return {"ok": True}


@api.post("/sites/{site_id}/audit")
async def audit_site(site_id: str, bg: BackgroundTasks, user: dict = Depends(require_user)):
    s = await owned_site(site_id, user)
    audit = await save_audit(site_id, user["user_id"], "server", await run_url_audit(s["url"]))
    bg.add_task(check_drop_alert, s, audit)
    return audit


@api.get("/sites/{site_id}/audits")
async def site_audits(site_id: str, user: dict = Depends(require_user)):
    await owned_site(site_id, user)
    return await db.fetch("select id, source, url, a11y_score, seo_score, counts, created_at from al_audits "
                          "where site_id=$1 order by created_at desc limit 50", site_id)


async def owned_audit(audit_id, user):
    a = await db.fetchrow("select * from al_audits where id=$1 and user_id=$2", audit_id, user["user_id"])
    if not a:
        raise HTTPException(404, "Audit not found")
    return a


@api.get("/audits/{audit_id}")
async def get_audit(audit_id: str, user: dict = Depends(require_user)):
    return await owned_audit(audit_id, user)


@api.post("/audits/{audit_id}/fix")
async def audit_fix(audit_id: str, body: FixIn, user: dict = Depends(require_user)):
    a = await owned_audit(audit_id, user)
    if body.rule_id in (a["fixes"] or {}):
        return {"rule_id": body.rule_id, "tip": a["fixes"][body.rule_id]}
    v = next((x for x in a["violations"] if x["id"] == body.rule_id), None)
    if not v:
        raise HTTPException(404, "Issue not found in this audit")
    tip = await ai.fix_tip(v, a["url"])
    await db.execute("update al_audits set fixes = fixes || jsonb_build_object($2::text, $3::text) where id=$1", audit_id, body.rule_id, tip)
    return {"rule_id": body.rule_id, "tip": tip}


@api.post("/audits/{audit_id}/send-email")
async def audit_email(audit_id: str, request: Request, user: dict = Depends(require_user)):
    a = await owned_audit(audit_id, user)
    s = await owned_site(a["site_id"], user)
    if not s.get("alert_email"):
        raise HTTPException(400, "Add a report email in site settings first")
    link = report_url(origin_of(request) or s.get("app_origin"), audit_id)
    eid = await notify.send_email(to=s["alert_email"], subject=f"Accessibility scorecard: {a['a11y_score']}/100 – {s['name']}",
                                  html=notify.scorecard_html(s["name"], a, link))
    return {"ok": True, "email_id": eid, "to": s["alert_email"]}


@api.post("/audits/{audit_id}/send-whatsapp")
async def audit_whatsapp(audit_id: str, request: Request, user: dict = Depends(require_user)):
    a = await owned_audit(audit_id, user)
    s = await owned_site(a["site_id"], user)
    if not s.get("whatsapp"):
        raise HTTPException(400, "Add a WhatsApp number in site settings first")
    await notify.send_whatsapp(s["whatsapp"], notify.whatsapp_summary(s["name"], a, report_url(origin_of(request) or s.get("app_origin"), audit_id)))
    return {"ok": True, "to": s["whatsapp"]}


@api.get("/stats/overview")
async def overview(user: dict = Depends(require_user)):
    r = await db.fetchrow(
        "select (select count(*) from al_sites where user_id=$1) as sites, (select count(*) from al_audits where user_id=$1) as audits, "
        "(select coalesce(round(avg(a11y_score)),0) from al_audits where user_id=$1) as avg_score, "
        "(select coalesce(sum((counts->>'critical')::int),0) from (select distinct on (site_id) counts from al_audits where user_id=$1 order by site_id, created_at desc) t) as open_critical",
        user["user_id"])
    trend = await db.fetch("select a11y_score, seo_score, created_at from al_audits where user_id=$1 order by created_at desc limit 20", user["user_id"])
    return {**r, "trend": list(reversed(trend))}


# ---------- WhatsApp bot (Fast2SMS webhook) ----------
SEEN_IDS: dict = {}
SENT_CACHE: dict = {}


def _dup(mid):
    if not mid:
        return False
    if mid in SEEN_IDS:
        return True
    SEEN_IDS[mid] = 1
    if len(SEEN_IDS) > 300:
        SEEN_IDS.pop(next(iter(SEEN_IDS)))
    return False


def _echo(text):
    import time
    now = time.time()
    for k in [k for k, v in SENT_CACHE.items() if v < now]:
        SENT_CACHE.pop(k, None)
    return SENT_CACHE.get(text[:80], 0) > now


async def wa_reply(phone, text):
    import time
    SENT_CACHE[text[:80]] = time.time() + 60
    try:
        await db.execute("insert into al_wa_log (phone, direction, body) values ($1,'out',$2)", phone, text[:2000])
    except Exception:
        pass
    await notify.send_whatsapp(phone, text)


async def _media(url):
    for delay in (0, 2, 4):
        if delay:
            await asyncio.sleep(delay)
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.get(url, headers={"User-Agent": "AccessLayerBot/2.0"})
        if r.status_code == 200:
            return r.content, (r.headers.get("content-type") or "application/octet-stream").split(";")[0].strip()
        if r.status_code in (401, 403):
            break
    raise HTTPException(502, "Media download failed")


HELP = ("*AccessLayer WhatsApp Concierge* 🤖\n\n"
        "• *#AUDIT <url>* — instant accessibility + SEO score\n• *#AUDIT* — audit your registered site\n"
        "• *#SITES* — list your monitored sites\n• Ask any question, send a screenshot or a voice note for fix help.")


async def handle_wa(body: dict):
    msg_type = str(body.get("message_type") or body.get("type") or "text").lower()
    phone = notify.normalize_phone(str(body.get("from") or body.get("mobile") or body.get("phone") or ""))
    if len(phone) != 10 or _dup(str(body.get("message_id") or "")):
        return
    status = str(body.get("status") or body.get("webhook_type") or "").lower()
    if status in ("sent", "delivered", "read", "failed", "status"):
        return
    text = str(body.get("body") or body.get("message") or body.get("text") or "").strip()
    if text and _echo(text):
        return
    try:
        await db.execute("insert into al_wa_log (phone, direction, body) values ($1,'in',$2)", phone, (text or msg_type)[:2000])
    except Exception:
        pass
    try:
        if msg_type == "image":
            if not body.get("media_url"):
                return await wa_reply(phone, "📸 Image received but I couldn't download it. Please try again.")
            await wa_reply(phone, "🔍 Checking your screenshot for accessibility issues...")
            data, mime = await _media(body["media_url"])
            return await wa_reply(phone, await ai.concierge_media(data, mime, str(body.get("caption") or "")))
        if msg_type in ("audio", "voice"):
            if not body.get("media_url"):
                return await wa_reply(phone, "🎙️ Couldn't process the voice note. Please type instead.")
            data, mime = await _media(body["media_url"])
            text = await ai.transcribe(data, mime)
            await wa_reply(phone, f"🎙️ _I heard: \"{text}\"_")
        if not text or text.upper() in ("HI", "HELLO", "#HELP", "HELP", "START"):
            return await wa_reply(phone, HELP)
        up = text.upper()
        if up.startswith("#SITES"):
            sites = await db.fetch("select name, url from al_sites where whatsapp=$1", phone)
            return await wa_reply(phone, "Your sites:\n" + "\n".join(f"• {s['name']} — {s['url']}" for s in sites) if sites
                                  else "No sites linked to this number yet. Add your WhatsApp number in the AccessLayer dashboard.")
        if up.startswith("#AUDIT"):
            arg = text[6:].strip()
            site = None
            if not arg:
                site = await db.fetchrow("select * from al_sites where whatsapp=$1 order by created_at desc limit 1", phone)
                if not site:
                    return await wa_reply(phone, "Send *#AUDIT https://yoursite.com* or link this number to a site in your dashboard.")
                arg = site["url"]
            await wa_reply(phone, f"⏳ Auditing {arg} ...")
            result = await run_url_audit(arg)
            audit = await save_audit(site["id"] if site else None, site["user_id"] if site else None, "whatsapp", result)
            return await wa_reply(phone, notify.whatsapp_summary(site["name"] if site else result["meta"].get("title") or arg, audit,
                                                                 report_url(site.get("app_origin") if site else "", audit["id"])))
        await wa_reply(phone, await ai.concierge(text))
    except HTTPException as e:
        try:
            await wa_reply(phone, f"Sorry — {e.detail}")
        except Exception:
            logger.error("WA reply failed: %s", e.detail)
    except Exception as e:
        logger.error("WA webhook error: %s", str(e)[:300])


@api.post("/whatsapp/webhook")
async def wa_webhook(request: Request, bg: BackgroundTasks):
    try:
        body = await request.json()
    except Exception:
        body = dict(await request.form())
    if isinstance(body, dict):
        bg.add_task(handle_wa, body)
    return {"ok": True}


@api.get("/whatsapp/webhook")
async def wa_verify(request: Request):
    ch = request.query_params.get("hub.challenge") or request.query_params.get("challenge")
    if ch:
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse(ch)
    return {"status": "WhatsApp webhook active"}


@api.get("/whatsapp/log")
async def wa_log(user: dict = Depends(require_user)):
    phones = [s["whatsapp"] for s in await db.fetch("select whatsapp from al_sites where user_id=$1 and whatsapp<>''", user["user_id"])]
    if not phones:
        return []
    return await db.fetch("select phone, direction, body, created_at from al_wa_log where phone = any($1::text[]) order by id desc limit 50", phones)


app.include_router(api)
app.include_router(clerk_router)
app.add_middleware(CORSMiddleware, allow_credentials=False, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

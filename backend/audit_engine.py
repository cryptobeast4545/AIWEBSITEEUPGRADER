import ipaddress
import re
import socket
import time
from collections import Counter
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from fastapi import HTTPException

PENALTY = {"critical": 25, "serious": 12, "moderate": 5, "minor": 2}
UA = "Mozilla/5.0 (compatible; AccessLayerBot/2.0; +https://accesslayer.io)"


def _public_host(host: str) -> bool:
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            return False
    return True


async def assert_public_request(request):
    if not _public_host(request.url.host):
        raise HTTPException(400, "That address is not a public website")


def safe_client(**kw):
    return httpx.AsyncClient(follow_redirects=True, event_hooks={"request": [assert_public_request]}, **kw)


def normalize_url(url: str) -> str:
    url = (url or "").strip()
    if not url:
        raise HTTPException(400, "URL is required")
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    p = urlparse(url)
    if not p.hostname or "." not in p.hostname:
        raise HTTPException(400, "Please enter a valid public website URL")
    return url


def score_violations(violations):
    counts = Counter(v.get("impact") or "minor" for v in violations)
    score = max(0, 100 - sum(PENALTY.get(v.get("impact") or "minor", 2) for v in violations))
    return score, {k: counts.get(k, 0) for k in PENALTY}


def _snip(el):
    s = str(el)
    return s[:220] + ("…" if len(s) > 220 else "")


def _lum(hex_):
    hex_ = hex_.lstrip("#")
    if len(hex_) == 3:
        hex_ = "".join(c * 2 for c in hex_)
    if len(hex_) != 6:
        return None
    rgb = [int(hex_[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    rgb = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]


def _style_color(style, prop):
    m = re.search(rf"(?:^|;)\s*{prop}\s*:\s*(#[0-9a-fA-F]{{3,6}})", style or "")
    return m.group(1) if m else None


def _accessible_name(el):
    if el.get("aria-label", "").strip() or el.get("aria-labelledby") or el.get("title", "").strip():
        return True
    if el.get_text(strip=True):
        return True
    for img in el.find_all("img"):
        if img.get("alt", "").strip():
            return True
    return any(t.get_text(strip=True) for t in el.find_all("title"))


def _v(rule, impact, help_, desc, tags, nodes):
    return {"id": rule, "impact": impact, "help": help_, "description": desc, "tags": tags,
            "count": len(nodes), "nodes": [{"html": _snip(n)} for n in nodes[:5]],
            "helpUrl": f"https://dequeuniversity.com/rules/axe/4.10/{rule}"}


def a11y_rules(soup):
    out = []
    html = soup.find("html")
    if not html or not html.get("lang"):
        out.append(_v("html-has-lang", "serious", "<html> element must have a lang attribute",
                      "Screen readers need the page language to pronounce content correctly.", ["wcag2a", "wcag311"], [html] if html else []))
    if not soup.title or not soup.title.get_text(strip=True):
        out.append(_v("document-title", "serious", "Documents must have a <title> element",
                      "The title is the first thing announced by screen readers.", ["wcag2a", "wcag242"], []))
    vp = soup.find("meta", attrs={"name": "viewport"})
    if vp and re.search(r"user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b", vp.get("content", ""), re.I):
        out.append(_v("meta-viewport", "critical", "Zooming and scaling must not be disabled",
                      "Low-vision users rely on pinch-zoom.", ["wcag2aa", "wcag144"], [vp]))
    imgs = [i for i in soup.find_all("img") if not i.has_attr("alt") and i.get("role") != "presentation" and i.get("aria-hidden") != "true"]
    if imgs:
        out.append(_v("image-alt", "critical", "Images must have alternate text",
                      "Missing alt text leaves blind users with file names or nothing.", ["wcag2a", "wcag111"], imgs))
    bad_alt = [i for i in soup.find_all("img", alt=True) if re.search(r"\.(jpe?g|png|gif|webp|svg)$|^(img|image|photo|dsc)[-_ ]?\d*", i["alt"].strip(), re.I)]
    if bad_alt:
        out.append(_v("image-redundant-alt", "minor", "Alt text should describe the image, not the file",
                      "File-name style alt text is meaningless to listeners.", ["best-practice"], bad_alt))
    ids_lbl = {l.get("for") for l in soup.find_all("label") if l.get("for")}
    unl = []
    for el in soup.find_all(["input", "select", "textarea"]):
        if el.name == "input" and el.get("type", "text").lower() in ("hidden", "submit", "button", "reset", "image"):
            continue
        if el.get("aria-label") or el.get("aria-labelledby") or el.get("title") or (el.get("id") and el.get("id") in ids_lbl) or el.find_parent("label"):
            continue
        unl.append(el)
    if unl:
        out.append(_v("label", "critical", "Form elements must have labels",
                      "Unlabelled fields cannot be identified by screen reader users.", ["wcag2a", "wcag412"], unl))
    btns = [b for b in soup.find_all("button") if not _accessible_name(b)]
    btns += [b for b in soup.find_all("input", type=re.compile("^(submit|button|reset)$", re.I)) if not b.get("value") and not b.get("aria-label")]
    if btns:
        out.append(_v("button-name", "critical", "Buttons must have discernible text",
                      "Icon-only buttons are silent to assistive tech.", ["wcag2a", "wcag412"], btns))
    links = [a for a in soup.find_all("a", href=True) if not _accessible_name(a)]
    if links:
        out.append(_v("link-name", "serious", "Links must have discernible text",
                      "Empty links are announced as 'link' with no destination.", ["wcag2a", "wcag244"], links))
    vague = [a for a in soup.find_all("a", href=True) if a.get_text(strip=True).lower() in ("click here", "here", "read more", "more", "link")]
    if vague:
        out.append(_v("link-in-text-block", "minor", "Link text should describe the destination",
                      "Generic text like 'click here' gives no context out of flow.", ["best-practice"], vague))
    frames = [f for f in soup.find_all(["iframe", "frame"]) if not f.get("title")]
    if frames:
        out.append(_v("frame-title", "serious", "Frames must have an accessible name",
                      "Untitled iframes are confusing when tabbing.", ["wcag2a", "wcag412"], frames))
    heads = soup.find_all(re.compile("^h[1-6]$"))
    empty_h = [h for h in heads if not h.get_text(strip=True)]
    if empty_h:
        out.append(_v("empty-heading", "minor", "Headings should not be empty", "Empty headings break document outline.", ["best-practice"], empty_h))
    if not soup.find("h1"):
        out.append(_v("page-has-heading-one", "moderate", "Page should contain a level-one heading",
                      "Screen reader users jump to the H1 to find the main topic.", ["best-practice"], []))
    skipped, prev = [], 0
    for h in heads:
        lvl = int(h.name[1])
        if prev and lvl > prev + 1:
            skipped.append(h)
        prev = lvl
    if skipped:
        out.append(_v("heading-order", "moderate", "Heading levels should only increase by one",
                      "Skipped heading levels confuse page navigation.", ["best-practice"], skipped))
    if not soup.find("main") and not soup.find(attrs={"role": "main"}):
        out.append(_v("landmark-one-main", "moderate", "Document should have one main landmark",
                      "Landmarks let keyboard users jump to content.", ["best-practice"], []))
    ids = Counter(e.get("id") for e in soup.find_all(id=True))
    dup = [e for e in soup.find_all(id=True) if ids[e.get("id")] > 1]
    if dup:
        out.append(_v("duplicate-id", "minor", "ID attribute values must be unique",
                      "Duplicate IDs break label and ARIA references.", ["wcag2a", "wcag411"], dup))
    pos_tab = [e for e in soup.find_all(attrs={"tabindex": True}) if re.match(r"^[1-9]", str(e.get("tabindex")))]
    if pos_tab:
        out.append(_v("tabindex", "serious", "Elements should not have tabindex greater than zero",
                      "Positive tabindex scrambles keyboard focus order.", ["best-practice"], pos_tab))
    clicky = [e for e in soup.find_all(["div", "span"], attrs={"onclick": True}) if not e.get("role") and not e.get("tabindex")]
    if clicky:
        out.append(_v("click-events-have-key-events", "serious", "Clickable elements must be keyboard accessible",
                      "Non-semantic div buttons cannot be reached without a mouse.", ["wcag2a", "wcag211"], clicky))
    low = []
    for e in soup.find_all(style=True):
        fg, bg = _style_color(e["style"], "color"), _style_color(e["style"], "background(?:-color)?")
        if fg and bg:
            l1, l2 = _lum(fg), _lum(bg)
            if l1 is not None and l2 is not None and (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05) < 4.5:
                low.append(e)
    if low:
        out.append(_v("color-contrast", "serious", "Elements must meet minimum colour contrast ratio (4.5:1)",
                      "Low contrast text is unreadable for low-vision and elderly users.", ["wcag2aa", "wcag143"], low))
    autoplay = soup.find_all(["video", "audio"], autoplay=True)
    if autoplay:
        out.append(_v("no-autoplay-audio", "moderate", "Media should not autoplay",
                      "Autoplaying sound interferes with screen readers.", ["wcag2a", "wcag142"], autoplay))
    if soup.find_all("marquee") or soup.find_all("blink"):
        out.append(_v("marquee", "serious", "<marquee> and <blink> must not be used", "Moving text is hard to read.", ["wcag2a", "wcag222"], soup.find_all(["marquee", "blink"])))
    return out


def _chk(cid, title, ok, detail, weight=1, warn=False):
    return {"id": cid, "title": title, "status": "pass" if ok else ("warn" if warn else "fail"), "detail": detail, "weight": weight}


async def _exists(client, url):
    try:
        r = await client.get(url)
        return r.status_code == 200 and len(r.text) > 10
    except (Exception, HTTPException):
        return False


async def seo_checks(soup, url, html_bytes, elapsed, client):
    t = soup.title.get_text(strip=True) if soup.title else ""
    desc = (soup.find("meta", attrs={"name": re.compile("^description$", re.I)}) or {}).get("content", "") if soup.find("meta", attrs={"name": re.compile("^description$", re.I)}) else ""
    h1s = soup.find_all("h1")
    canonical = soup.find("link", rel=lambda v: v and "canonical" in v)
    og = {m.get("property") for m in soup.find_all("meta", property=re.compile("^og:"))}
    tw = soup.find("meta", attrs={"name": re.compile("^twitter:card", re.I)})
    robots = soup.find("meta", attrs={"name": re.compile("^robots$", re.I)})
    imgs = soup.find_all("img")
    alt_ok = sum(1 for i in imgs if i.get("alt", "").strip())
    jsonld = soup.find_all("script", type="application/ld+json")
    base = f"{urlparse(url).scheme}://{urlparse(url).netloc}"
    words = len(soup.get_text(" ", strip=True).split())
    links = soup.find_all("a", href=True)
    internal = sum(1 for a in links if urlparse(urljoin(url, a["href"])).netloc == urlparse(url).netloc)
    checks = [
        _chk("title", "Title tag (30–60 chars)", 30 <= len(t) <= 60, f"{len(t)} chars: “{t[:70]}”" if t else "Missing title", 3, warn=bool(t)),
        _chk("meta-description", "Meta description (70–160 chars)", 70 <= len(desc) <= 160, f"{len(desc)} chars" if desc else "Missing meta description", 3, warn=bool(desc)),
        _chk("h1", "Exactly one H1 heading", len(h1s) == 1, f"{len(h1s)} H1 found", 2, warn=len(h1s) > 1),
        _chk("canonical", "Canonical URL", bool(canonical), canonical.get("href", "") if canonical else "No canonical link", 1),
        _chk("https", "Served over HTTPS", url.startswith("https://"), url, 2),
        _chk("viewport", "Mobile viewport meta", bool(soup.find("meta", attrs={"name": "viewport"})), "Responsive viewport set" if soup.find("meta", attrs={"name": "viewport"}) else "Missing viewport", 2),
        _chk("lang", "Language declared", bool(soup.find("html") and soup.find("html").get("lang")), (soup.find("html") or {}).get("lang", "missing") if soup.find("html") else "missing", 1),
        _chk("open-graph", "Open Graph tags (title, description, image)", {"og:title", "og:description", "og:image"} <= og, f"Found: {', '.join(sorted(og)) or 'none'}", 2, warn=bool(og)),
        _chk("twitter-card", "Twitter card", bool(tw), tw.get("content", "") if tw else "Missing twitter:card", 1),
        _chk("indexable", "Page is indexable", not (robots and "noindex" in robots.get("content", "").lower()), robots.get("content", "") if robots else "No robots restriction", 3),
        _chk("img-alt", "Images have alt text", not imgs or alt_ok == len(imgs), f"{alt_ok}/{len(imgs)} images with alt", 2, warn=alt_ok > 0),
        _chk("structured-data", "Structured data (JSON-LD)", bool(jsonld), f"{len(jsonld)} JSON-LD blocks", 1),
        _chk("content-length", "Enough content (300+ words)", words >= 300, f"{words} words", 1, warn=words >= 100),
        _chk("internal-links", "Internal linking", internal >= 3, f"{internal} internal / {len(links)} total links", 1, warn=internal > 0),
        _chk("page-weight", "HTML size under 500 KB", len(html_bytes) < 500_000, f"{round(len(html_bytes) / 1024)} KB", 1),
        _chk("response-time", "Server response under 1.5s", elapsed < 1.5, f"{elapsed:.2f}s", 2, warn=elapsed < 3),
        _chk("favicon", "Favicon", bool(soup.find("link", rel=lambda v: v and "icon" in " ".join(v if isinstance(v, list) else [v]))), "Icon link tag", 1),
        _chk("robots-txt", "robots.txt available", await _exists(client, base + "/robots.txt"), base + "/robots.txt", 1),
        _chk("sitemap", "sitemap.xml available", await _exists(client, base + "/sitemap.xml"), base + "/sitemap.xml", 1),
    ]
    total = sum(c["weight"] for c in checks)
    got = sum(c["weight"] * (1 if c["status"] == "pass" else 0.5 if c["status"] == "warn" else 0) for c in checks)
    return round(got / total * 100), checks


async def run_url_audit(url: str):
    url = normalize_url(url)
    async with safe_client(timeout=20, headers={"User-Agent": UA}) as client:
        try:
            t0 = time.monotonic()
            r = await client.get(url)
            elapsed = time.monotonic() - t0
        except HTTPException:
            raise
        except httpx.HTTPError:
            raise HTTPException(422, "Could not reach that website. Check the URL and try again.")
        if r.status_code >= 400:
            raise HTTPException(422, f"Website responded with HTTP {r.status_code}")
        soup = BeautifulSoup(r.content, "lxml")
        violations = a11y_rules(soup)
        score, counts = score_violations(violations)
        seo_score, seo = await seo_checks(soup, str(r.url), r.content, elapsed, client)
    title = soup.title.get_text(strip=True)[:120] if soup.title else ""
    return {"url": str(r.url), "a11y_score": score, "seo_score": seo_score, "counts": counts,
            "violations": violations, "seo": seo,
            "meta": {"title": title, "elements": len(soup.find_all(True)), "images": len(soup.find_all("img")), "engine": "AccessLayer server rules (axe-core rule IDs)"}}


def normalize_axe(violations):
    out = []
    for v in violations[:80]:
        nodes = v.get("nodes") or []
        out.append({"id": str(v.get("id", ""))[:80], "impact": v.get("impact") if v.get("impact") in PENALTY else "minor",
                    "help": str(v.get("help", ""))[:240], "description": str(v.get("description", ""))[:400],
                    "tags": [str(t)[:40] for t in (v.get("tags") or [])][:10], "helpUrl": str(v.get("helpUrl", ""))[:300],
                    "count": len(nodes), "nodes": [{"html": str(n.get("html", ""))[:220], "target": n.get("target")} for n in nodes[:5]]})
    return out

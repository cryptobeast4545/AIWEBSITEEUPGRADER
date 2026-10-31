# AccessLayer

> One line of code. Every visitor included.

AccessLayer is a web accessibility (WCAG 2.1 AA) auditing, auto-remediation, and monitoring platform. It scans any website with axe-core, auto-fixes alt text, labels, contrast, and keyboard traps in the browser, gives visitors dyslexia modes and Indic voice control, and delivers one-click WCAG + SEO scorecards to owners via WhatsApp and email.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Backend Modules](#backend-modules)
- [Frontend](#frontend)
- [The Drop-in Widget](#the-drop-in-widget)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [Deployment](#deployment)
- [Testing](#testing)
- [Integrations](#integrations)

---

## Overview

The web is still built for a narrow slice of people — 96.3% of the top 1M homepages fail WCAG. AccessLayer targets three groups:

- **Users with disabilities** — blind, low-vision, motor-impaired, dyslexic, and non-native speakers.
- **Small & medium businesses** — instant ADA, Section 508 & EAA compliance without engineering overhauls.
- **Public service portals** — government, healthcare, and education sites needing multilingual voice help.

A site owner creates an account, adds their website, and pastes a single `<script>` tag into their page `<head>`. The widget then runs entirely in the browser inside an isolated Shadow DOM, repairing accessibility issues as the page loads, while the dashboard and notifications layer track scores over time.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (any site)                                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  widget.js  (Shadow-DOM isolated accessibility layer) │  │
│  │  • auto-remediation • a11y modes • Indic voice        │  │
│  │  • axe-core scan • AI alt text • TTS                  │  │
│  └───────────────────────┬───────────────────────────────┘  │
└──────────────────────────┼──────────────────────────────────┘
                           │ HTTPS (widget & public APIs)
┌──────────────────────────▼──────────────────────────────────┐
│  Backend — FastAPI (server.py)                               │
│  audit_engine · ai (Gemini) · voice (Sarvam) · notify        │
│  clerk_auth · db (asyncpg → Supabase)                        │
│  + serves compiled React SPA for unified deployment         │
└──────────────────────────┬──────────────────────────────────┘
                           │
   ┌───────────────────────┼───────────────────────┐
   ▼                       ▼                       ▼
 Supabase (Postgres)   Gemini / Sarvam AI    Fast2SMS / Resend
 sites · audits · cache   alt text · voice      WhatsApp · email
```

- **Backend**: a single FastAPI app (`backend/server.py`) exposes the REST API, the WhatsApp webhook, Clerk auth, and serves the compiled React build as static files (for a unified deployment on one domain).
- **Frontend**: a React 19 SPA (Create React App + CRACO) using Tailwind CSS and Radix UI, authenticated with Clerk.
- **Database**: Supabase (PostgreSQL) accessed via asyncpg.
- **Widget**: a dependency-free `widget.js` injected into any host page; it runs inside an isolated Shadow DOM so it never breaks host styles.

---

## Project Structure

```
.
├── backend/
│   ├── server.py            # FastAPI app: all REST endpoints, WhatsApp webhook, SPA serving
│   ├── audit_engine.py      # Server-side a11y + SEO rules, URL normalization, SSRF guard, scoring
│   ├── ai.py                # Google Gemini: alt text, fix tips, voice commands, concierge, STT
│   ├── voice.py             # Sarvam AI: speech-to-text (Saaras) + text-to-speech (Bulbul)
│   ├── notify.py            # Resend email + Fast2SMS WhatsApp, anti-phishing email validation
│   ├── db.py                # asyncpg pool → Supabase, schema, query helpers
│   ├── clerk_auth.py        # Clerk auth: JWT verify, require_user dep, production proxy
│   ├── requirements.txt     # Pinned production deps
│   ├── requirements.in      # High-level dep list
│   ├── pytest.ini
│   ├── .env                 # Local environment (not committed secrets)
│   ├── static/
│   │   ├── widget.js        # Drop-in accessibility widget
│   │   └── frontend/        # Compiled React build (created by build_frontend.sh)
│   └── tests/
│       ├── conftest.py              # BASE_URL + Clerk session token fixtures
│       ├── test_accesslayer_api.py  # Full API regression suite
│       ├── test_iteration2_fixes.py
│       └── test_ssrf_redirect_unit.py
├── frontend/
│   ├── package.json         # React 19, CRACO, Tailwind, Radix, Clerk, Recharts…
│   ├── craco.config.js
│   ├── jsconfig.json        # @/ path alias → src/
│   ├── postcss.config.js
│   ├── public/index.html
│   └── src/
│       ├── App.js           # Routes + Clerk auth shell
│       ├── App.css
│       ├── lib/             # api client, embed snippet, widget hook
│       ├── pages/
│       │   ├── Landing.jsx    # Marketing + free quick scan
│       │   ├── Dashboard.jsx  # Owner console: sites, stats, trends
│       │   ├── SiteDetail.jsx # Site audits, embed snippet, settings
│       │   ├── Report.jsx     # Public/shareable audit report
│       │   └── Demo.jsx       # Live widget demo
│       └── components/      # Nav, ScoreRing, AddSiteDialog, EmbedSnippet,
│                            # AuthShell, auth/ClerkAuthProvider, ui/* (Radix)
├── demo/
│   ├── before.html          # Inaccessible demo page
│   └── after.html           # Remediated demo page
├── docs/                    # AccessLayer documentation (HTML/PDF) + generators
├── design_guidelines.json
├── build_frontend.sh        # Builds React app → copies to backend/static/frontend/
├── Procfile                 # Heroku-style: uvicorn workers
├── render.yaml              # Render deployment config
├── runtime.txt              # python-3.12.10
├── .python-version
└── .gitignore
```

---

## Features

### For site owners (dashboard)
- **WCAG 2.1 AA + SEO audit** — server-side rules and in-browser axe-core produce a 0–100 accessibility score and a 19-point SEO scorecard.
- **Site management** — add/edit/delete monitored sites, per-site settings (autofix, voice, AI alt, alerts).
- **Score trends** — area charts of a11y and SEO scores over time.
- **Shareable reports** — public `/report/:id` links.
- **AI fix tips** — per-violation developer guidance generated by Gemini, cached on the audit.
- **Drop alerts** — automatic WhatsApp + email alerts when a score drops ≥ 5 points.
- **Manual scorecards** — send a rich HTML WCAG scorecard to an email or WhatsApp number.
- **Multi-tenant isolation** — every site/audit is scoped to its Clerk user; cross-user access returns 404.

### For visitors (the widget)
- **Auto-remediation on load** — the widget fixes missing alt text, form labels, button names, keyboard-operable custom controls, positive `tabindex`, dialog focus traps, `<html lang>`, iframe titles, viewport zoom, and adds a skip link. A `MutationObserver` re-runs fixes as the DOM changes.
- **AI vision alt text** — Gemini describes unlabeled images and injects meaningful alt text in real time (cached server-side).
- **Accessibility modes** — high contrast, dark, invert, mono, light; OpenDyslexic and Atkinson Hyperlegible fonts; letter/word spacing; enlarged cursor; focus highlight; link outlines; reduced motion; reading guide ruler; page zoom.
- **Indic voice control** — speak in Hindi, Tamil, Telugu, Hinglish, etc. Saaras STT transcribes the command, Gemini maps it to a JSON action (CLICK, FILL_FORM, SCROLL, READ_TEXT, GO_BACK, SET_MODE), and the widget executes it on the live page.
- **Text-to-speech** — read main content or clicked elements aloud, via Sarvam Bulbul TTS (with browser SpeechSynthesis fallback).
- **Live axe scan** — run axe-core against the live DOM and report violations to the server.

### WhatsApp concierge
A Fast2SMS-powered WhatsApp bot lets owners and developers:
- `#AUDIT <url>` — instant accessibility + SEO scorecard.
- `#AUDIT` — audit the registered site for the sender's number.
- `#SITES` — list monitored sites linked to the number.
- `#HELP` — command help.
- Free text — accessibility fix concierge powered by Gemini.
- Send a screenshot — Gemini spots visible a11y issues and suggests fixes.
- Send a voice note — transcribed then answered.

---

## Tech Stack

**Backend**
- FastAPI + Uvicorn (workers)
- asyncpg (Supabase / PostgreSQL)
- httpx (SSRF-safe HTTP client with redirect guards)
- BeautifulSoup4 + lxml (HTML parsing for server audits)
- google-genai (Gemini)
- resend (transactional email)
- PyJWT + python-jose (Clerk session verification)
- python-multipart (audio upload)

**Frontend**
- React 19 (Create React App + CRACO)
- React Router 7
- Tailwind CSS 3 + tailwindcss-animate + Radix UI primitives
- Clerk (React + UI) for authentication
- Recharts (trend charts), Framer Motion (animation)
- react-hook-form + zod (forms), axios, SWR, TanStack Query
- sonner (toasts), lucide-react (icons)

**External services**
- Supabase (PostgreSQL) — primary data store
- Google Gemini — AI alt text, fix tips, voice commands, concierge
- Sarvam AI — Indic STT (Saaras) + TTS (Bulbul), 11 languages
- Fast2SMS — WhatsApp messaging
- Resend — transactional email
- Clerk — authentication (with in-domain production proxy)

---

## Backend Modules

### `audit_engine.py`
Server-side audit engine with SSRF protection (`assert_public_request` rejects private/loopback/reserved hosts), URL normalization, an axe-core-compatible scoring model (`PENALTY = {critical:25, serious:12, moderate:5, minor:2}`), ~25 accessibility rules (`a11y_rules`) covering lang, title, viewport, image-alt, labels, button/link names, heading order, landmarks, duplicate IDs, tabindex, color contrast, autoplay, marquee/blink, and 19 SEO checks (`seo_checks`) covering title length, meta description, H1, canonical, HTTPS, viewport, Open Graph, Twitter card, indexability, alt text, structured data, content length, internal links, page weight, response time, favicon, robots.txt, and sitemap.xml.

### `ai.py`
Gemini integration with lazy client init and graceful degradation. Provides: `alt_text` (vision), `fix_tip` (developer guidance per violation), `voice_command` (natural-language → structured JSON action, with a deterministic `rule_command` fallback when AI is unconfigured), `concierge` / `concierge_media` (WhatsApp fix help, including image analysis), and `transcribe` (audio transcription).

### `voice.py`
Sarvam AI wrapper supporting 11 Indic languages (`en-IN, hi-IN, ta-IN, te-IN, kn-IN, ml-IN, mr-IN, bn-IN, gu-IN, pa-IN, od-IN`). `stt` uses Saaras v4 (falls back to Saarika v2.5); `tts` uses Bulbul v4-flash (falls back to Bulbul v2). Returns base64 WAV audio.

### `notify.py`
Resend email + Fast2SMS WhatsApp. Includes a hardened `_assert_safe_email` validator that blocks phishing patterns: no forms/inputs in email bodies (G2), no credential-requesting text (G2), only absolute `https://` URLs (G3), no URL shorteners / numeric hosts / credential-bearing URLs (G3), and anchor text must match the real link host (G3). Also renders branded HTML WCAG scorecards.

### `db.py`
asyncpg connection pool to Supabase with automatic Supabase pooler (pgBouncer) detection, a `jsonb` type codec, the full schema DDL, and thin `fetch`/`fetchrow`/`execute` helpers that serialize datetimes to ISO strings. Auto-creates a `demo` site on connect.

### `clerk_auth.py`
Clerk authentication that is inert until keys are set. Exposes `/api/clerk/config` for the frontend, a production-only `/api/__clerk/*` proxy (relays Clerk's Frontend API through the app's own domain — zero DNS per app), and a `require_user` FastAPI dependency that verifies the Bearer token (or `__session` cookie) via JWKS and returns the stable `user_id`.

---

## Frontend

Routes (`src/App.js`):
| Path | Page | Auth |
|------|------|------|
| `/` | Landing — marketing + free quick scan | Public |
| `/demo` | Live widget demo | Public |
| `/report/:id` | Shareable audit report | Public |
| `/sign-in/*`, `/sign-up/*` | Clerk auth | Public |
| `/dashboard` | Owner console (sites, stats, trends) | Protected |
| `/sites/:id` | Site detail (audits, embed, settings) | Protected |

Key pages:
- **Landing** (`Landing.jsx`) — hero with live remediation visual, quick-scan form, problem/feature sections, install snippet, scoring engine explainer.
- **Dashboard** (`Dashboard.jsx`) — stat cards (sites, audits, avg score, open critical), score trend area chart, site cards with a11y/SEO scores.
- **SiteDetail** (`SiteDetail.jsx`) — per-site audits, embed snippet, alert settings, email/WhatsApp send.
- **Report** (`Report.jsx`) — public audit report with score ring and violation breakdown.
- **Demo** (`Demo.jsx`) — a demo store page running the live widget.

---

## The Drop-in Widget

`backend/static/widget.js` is a single self-contained script. Install with:

```html
<script
  src="https://your-backend-domain.com/api/widget.js"
  data-site-id="YOUR_SITE_ID"
  data-api="https://your-backend-domain.com/api"
  data-autofix="true"
  data-sarvam-voice="enabled"
  data-position="right"
  async>
</script>
```

What it does, isolated in a Shadow DOM (so it never affects host styles):
- **Auto-remediation** — alt text (file-name heuristic + optional Gemini vision), form labels, button/link names, keyboard-operable custom controls, dialog focus traps, skip link, `<html lang>`, iframe titles, viewport zoom fix. Re-runs via `MutationObserver`.
- **Accessibility panel** — contrast/dark/invert/mono/light modes, OpenDyslexic & Atkinson fonts, spacing, enlarged cursor, focus highlight, link outlines, reduced motion, reading guide, zoom; preferences persisted to `localStorage`.
- **Voice control** — mic capture → WAV encoding → Sarvam STT → Gemini command mapping → page action; browser SpeechRecognition fallback.
- **TTS read-aloud** — main content or clicked elements, Sarvam Bulbul with SpeechSynthesis fallback.
- **Live axe scan** — loads axe-core from CDN and reports results to the server.

---

## Database Schema

All tables are auto-created by `db.py` on startup (`SCHEMA`):

| Table | Purpose |
|-------|---------|
| `al_sites` | Monitored websites (id, user_id, name, url, whatsapp, alert_email, toggles, app_origin) |
| `al_audits` | Audit results (a11y_score, seo_score, counts, violations, seo, fixes, meta, source) |
| `al_alt_cache` | AI-generated alt text cache (keyed by sha256 of image src) |
| `al_wa_log` | WhatsApp conversation log (phone, direction, body) |

A `demo` site is seeded automatically.

---

## API Reference

Base path: `/api`. All auth-protected routes require `Authorization: Bearer <clerk_session_jwt>`.

### Public
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Service health |
| GET | `/integrations/status` | Integration availability (db, ai, voice, whatsapp, email) |
| GET | `/widget.js` | Serves the widget script |
| POST | `/public/scan` | Audit any URL (a11y + SEO) |
| GET | `/reports/{audit_id}` | Public audit report (user_id stripped) |

### Widget (keyed by site id)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/widget/{site_id}/config` | Site widget config (autofix, voice, ai_alt flags) |
| POST | `/widget/{site_id}/report` | Receive in-browser axe violations (host-validated) |
| POST | `/widget/{site_id}/alt` | Generate AI alt text for an image (cached) |
| POST | `/widget/{site_id}/tts` | Text-to-speech (Sarvam) |
| POST | `/widget/{site_id}/command` | Map a voice transcript to a page action |
| POST | `/widget/{site_id}/voice` | STT from uploaded audio + command mapping |

### Auth-protected (Clerk)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/me` | Current user |
| GET | `/sites` | List user's sites (+ last score, audit count) |
| POST | `/sites` | Create a site |
| GET | `/sites/{site_id}` | Get a site |
| PATCH | `/sites/{site_id}` | Update site settings |
| DELETE | `/sites/{site_id}` | Delete a site (+ its audits) |
| POST | `/sites/{site_id}/audit` | Run a server-side audit (drops alert in background) |
| GET | `/sites/{site_id}/audits` | List site audits (last 50) |
| GET | `/audits/{audit_id}` | Get an audit |
| POST | `/audits/{audit_id}/fix` | Generate/cache an AI fix tip for a violation |
| POST | `/audits/{audit_id}/send-email` | Email a scorecard |
| POST | `/audits/{audit_id}/send-whatsapp` | WhatsApp a scorecard summary |
| GET | `/stats/overview` | Sites, audits, avg score, open critical, trend |

### WhatsApp
| Method | Path | Description |
|--------|------|-------------|
| GET | `/whatsapp/webhook` | Webhook verification (hub.challenge echo) |
| POST | `/whatsapp/webhook` | Inbound message handler (runs in background) |
| GET | `/whatsapp/log` | Recent WhatsApp conversation (auth, user's numbers only) |

### Clerk
| Method | Path | Description |
|--------|------|-------------|
| GET | `/clerk/config` | Publishable key + proxy URL for frontend |
| ALL | `/__clerk/{path}` | Production-only Clerk Frontend API proxy |

---

## Environment Variables

Copy `frontend/.env.example` for the frontend and create `backend/.env` for the backend.

### Backend (`backend/.env`)
| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_DB_URL` | Yes | PostgreSQL connection string |
| `SUPABASE_POOLER_HOST` | Optional | Supabase pooler host (pgBouncer, port 6543) |
| `CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key (enables auth) |
| `GEMINI_API_KEY` | Yes | Google Gemini API key (enables AI) |
| `GEMINI_MODEL` | Optional | Model name (default `gemini-3.5-flash-lite`) |
| `SARVAM_API_KEY` | Yes | Sarvam AI key (enables Indic voice) |
| `SARVAM_SPEAKER` | Optional | TTS speaker voice |
| `FAST2SMS_API_KEY` | Yes | Fast2SMS key (enables WhatsApp) |
| `FAST2SMS_PHONE_NUMBER_ID` | Yes | Fast2SMS WhatsApp number id |
| `RESEND_API_KEY` | Yes | Resend key (enables email) |
| `EMAIL_FROM` | Yes | From address, e.g. `AccessLayer <no-reply@yourdomain.com>` |
| `EMAIL_FROM_NAME` | Optional | Sender display name (default `AccessLayer`) |
| `EMAIL_REPLY_TO` | Optional | Reply-to address |

### Frontend (`frontend/.env`)
| Variable | Description |
|----------|-------------|
| `REACT_APP_BACKEND_URL` | Backend API base URL |
| `WDS_SOCKET_PORT` | Webpack dev-server socket port (443 for HTTPS) |
| `ENABLE_HEALTH_CHECK` | Enable the build health-check plugin |

> The backend is designed to degrade gracefully: each integration is independently configurable and `/api/integrations/status` reports what is live. Missing keys return 501/503 rather than crashing.

---

## Local Development

### Prerequisites
- Python 3.12
- Node.js (with npm)
- A Supabase project and API keys for the integrations you want to use

### Backend
```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then fill in your keys
uvicorn server:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install --legacy-peer-deps
cp .env.example .env   # set REACT_APP_BACKEND_URL to your backend
npm start              # craco start (CRA dev server)
```

The frontend dev server proxies API calls to the backend at `REACT_APP_BACKEND_URL`.

---

## Deployment

The project is configured for a single unified deployment: one Python process serves both the API and the compiled React build.

### Render (`render.yaml`)
- **Build**: `bash build_frontend.sh && pip install -r backend/requirements.txt`
- **Start**: `cd backend && uvicorn server:app --host 0.0.0.0 --port $PORT --workers 2`
- Python `3.12.10`, region `oregon`, free plan.
- Secret env vars are marked `sync: false` (set them in the Render dashboard).

### `build_frontend.sh`
1. Installs frontend deps (`npm install --legacy-peer-deps`).
2. Builds the React app (`craco build`).
3. Copies `frontend/build/` into `backend/static/frontend/`.

At startup, `server.py` mounts `static/frontend/` and serves `index.html` as a catch-all so client-side routing works, while still serving exact static assets first.

### Procfile (Heroku-style)
```
web: cd backend && uvicorn server:app --host 0.0.0.0 --port $PORT --workers 2
```

---

## Testing

Tests are in `backend/tests/` and run against a live deployed instance (URL from `REACT_APP_BACKEND_URL`). The suite uses real Clerk session tokens minted in `conftest.py`.

```bash
cd backend
pytest -v
```

Test files:
- `test_accesslayer_api.py` — public scan/report, widget APIs (config, command, TTS, alt, report), auth-protected sites/audits CRUD, multi-tenant isolation, fix tips, email send, stats, WhatsApp webhook verification.
- `test_iteration2_fixes.py` — regression tests for iteration-2 fixes.
- `test_ssrf_redirect_unit.py` — unit tests for SSRF / redirect protection.

`conftest.py` provides:
- `base` — the API base URL.
- `tok_a` / `tok_b` — Clerk session tokens for the owner (user A) and a second user (B) for isolation tests.
- `A` / `B` — `Authorization: Bearer` headers per request.

---

## Integrations

| Service | Used for | Module |
|---------|----------|--------|
| Supabase (PostgreSQL) | Primary data store | `db.py` |
| Google Gemini | AI alt text, fix tips, voice commands, concierge, transcription | `ai.py` |
| Sarvam AI | Indic speech-to-text (Saaras) + text-to-speech (Bulbul) | `voice.py` |
| Fast2SMS | WhatsApp messaging + webhook bot | `notify.py`, `server.py` |
| Resend | Transactional email scorecards + drop alerts | `notify.py` |
| Clerk | Authentication + production in-domain proxy | `clerk_auth.py` |
| axe-core (CDN) | In-browser accessibility scan (widget) | `widget.js` |
| BeautifulSoup4 + lxml | Server-side HTML audit | `audit_engine.py` |

---

© AccessLayer · Built with axe-core, Gemini, Sarvam AI, Fast2SMS & Resend.

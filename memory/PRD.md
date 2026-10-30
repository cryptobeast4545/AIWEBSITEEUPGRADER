# AccessLayer — Universal Accessibility Layer (PRD)

## Original problem
Drop-in JS widget that scans any page (axe-core), auto-fixes alt text (AI vision), contrast, labels, keyboard nav, dyslexia fonts, Sarvam AI Indic voice control; one-click accessibility + SEO score reports; WhatsApp bot via Fast2SMS (#AUDIT, drop alerts, fix concierge on Gemini); Resend email scorecards; Supabase database; Gemini 3.5 Flash Lite.

## User choices
Own Gemini key · Sarvam voice · Email+password login (Emergent-managed Clerk) · SEO audit, WhatsApp bot, email scorecards, AI alt text · Code synced to github.com/cryptobeast4545/AIWEBSITEEUPGRADER via /app/scripts/push_github.sh (sanitized, no .env)

## Architecture
- FastAPI backend (Emergent) + Supabase Postgres via asyncpg (tables al_sites, al_audits, al_alt_cache, al_wa_log; pooler aws-0-eu-central-2)
- Widget: /api/widget.js (vanilla JS, Shadow DOM), public endpoints /api/widget/{site_id}/*
- React frontend: Landing, /demo store, /report/:id, /dashboard, /sites/:id, Clerk sign-in/up

## Implemented (2026-10-30)
- Server audit engine (axe rule IDs) + 19 SEO checks, scoring (−25/−12/−5/−2), SSRF guard
- Widget: contrast modes, zoom, dyslexia/readable fonts, spacing, guide, big cursor, focus, stop motion, read aloud, click-to-read, Sarvam STT/TTS voice commands (11 languages, Gemini intent parse, browser fallback), axe-core scan → report, auto-fixes (alt via Gemini vision, labels, names, keyboard, contrast, skip link, lang, dialogs focus trap, iframes)
- Dashboard: sites CRUD, audits, history, trend chart, AI fix tips, embed snippet, settings toggles, email + WhatsApp scorecards, compliance drop alerts
- WhatsApp webhook bot: #AUDIT, #SITES, #HELP, AI concierge (text, image, voice notes)

## Backlog
- P1: Weekly scheduled email scorecards (cron), PDF scorecard attachment
- P1: Fast2SMS webhook set-up in user's Fast2SMS dashboard (URL in Settings tab)
- P2: Rate limiting on public widget endpoints, multi-page crawl audits, team members

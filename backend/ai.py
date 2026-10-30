import json
import os
import re
import logging

from fastapi import HTTPException
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)
_client = None


def model_name():
    return os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite")


def configured():
    return bool(os.environ.get("GEMINI_API_KEY"))


def client():
    global _client
    if not configured():
        raise HTTPException(503, "AI is not configured yet (missing Gemini key)")
    if _client is None:
        _client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    return _client


async def generate(contents, system=None, temperature=0.3, max_tokens=800, json_mode=False):
    cfg = types.GenerateContentConfig(temperature=temperature, max_output_tokens=max_tokens, system_instruction=system,
                                      response_mime_type="application/json" if json_mode else None)
    try:
        r = await client().aio.models.generate_content(model=model_name(), contents=contents, config=cfg)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Gemini error: %s", str(e)[:300])
        raise HTTPException(502, "AI request failed")
    return (r.text or "").strip()


async def alt_text(image: bytes, mime: str, context: str = ""):
    prompt = ("Write one concise, accurate alt-text sentence (max 18 words) for this image on a web page. "
              "Describe subject, action and any important visible text. Do not start with 'Image of'. "
              "Return only the sentence." + (f" Page context: {context[:200]}" if context else ""))
    txt = await generate([types.Part.from_bytes(data=image, mime_type=mime), prompt], temperature=0.2, max_tokens=80)
    return txt.strip().strip('"')[:250]


async def fix_tip(v: dict, url: str):
    nodes = "\n".join(n.get("html", "") for n in v.get("nodes", [])[:3])
    prompt = (f"Accessibility issue on {url}\nRule: {v.get('id')} ({v.get('impact')})\nProblem: {v.get('help')}\n"
              f"Offending HTML:\n{nodes}\n\nGive a short fix guide for a developer: 1) why it matters (1 sentence), "
              "2) exact corrected HTML snippet in a ```html code block, 3) one-line WCAG reference. Keep under 140 words.")
    return await generate(prompt, temperature=0.2, max_tokens=500)


VOICE_SYSTEM = """You convert a spoken website voice command (any Indian language or English, may be Hinglish) into one JSON action.
You get the transcript and a numbered list of interactive elements on the page.
Return ONLY JSON: {"action": "CLICK"|"FOCUS"|"FILL_FORM"|"SCROLL"|"READ_TEXT"|"GO_BACK"|"SET_MODE"|"NONE",
"index": element number or null, "value": text to type / scroll direction (up|down|top|bottom) / mode (contrast|dyslexia|bigger|smaller|reset) or null,
"reply": very short confirmation in the SAME language as the user}.
READ_TEXT with index null means read the main page content."""


def rule_command(t: str):
    s = t.lower()
    if re.search(r"scroll down|neeche|नीचे|keezhe|kindha", s):
        return {"action": "SCROLL", "value": "down", "index": None, "reply": "Scrolling down"}
    if re.search(r"scroll up|upar|ऊपर|mele|paina", s):
        return {"action": "SCROLL", "value": "up", "index": None, "reply": "Scrolling up"}
    if re.search(r"\btop\b", s):
        return {"action": "SCROLL", "value": "top", "index": None, "reply": "Going to top"}
    if re.search(r"read|padho|पढ़|padi", s):
        return {"action": "READ_TEXT", "value": None, "index": None, "reply": "Reading the page"}
    if re.search(r"back|peeche|पीछे", s):
        return {"action": "GO_BACK", "value": None, "index": None, "reply": "Going back"}
    if "contrast" in s:
        return {"action": "SET_MODE", "value": "contrast", "index": None, "reply": "High contrast on"}
    return {"action": "NONE", "value": None, "index": None, "reply": "Sorry, I did not understand"}


async def voice_command(transcript: str, elements: list, lang: str):
    if not configured():
        return rule_command(transcript)
    listing = "\n".join(f"{e.get('i')}: [{e.get('tag')}] {str(e.get('label', ''))[:80]}" for e in elements[:120])
    raw = await generate(f"Language: {lang}\nTranscript: {transcript}\nElements:\n{listing}", system=VOICE_SYSTEM,
                         temperature=0, max_tokens=200, json_mode=True)
    try:
        cmd = json.loads(re.search(r"\{.*\}", raw, re.S).group(0))
    except Exception:
        return rule_command(transcript)
    return {"action": cmd.get("action", "NONE"), "index": cmd.get("index"), "value": cmd.get("value"), "reply": cmd.get("reply", "")}


CONCIERGE = """You are the AccessLayer WhatsApp Fix Concierge, an expert in web accessibility (WCAG 2.1/2.2 AA, ADA, Section 508, EAA) and SEO.
Keep replies SHORT and friendly (max ~90 words) — WhatsApp users dislike long walls of text. Use simple formatting (*bold*, short lists).
Help site owners and developers fix accessibility issues (alt text, contrast, labels, keyboard focus, ARIA, dialogs) with tiny code examples.
Remind them of commands when helpful: #AUDIT <url> for an instant score, #SITES to list their sites, #HELP for commands.
Reply in the user's language (Hindi, Hinglish, Tamil, etc. if they use it)."""


async def concierge(text: str):
    return await generate(text, system=CONCIERGE, temperature=0.5, max_tokens=400)


async def concierge_media(data: bytes, mime: str, caption: str = ""):
    p = f"User sent this image with caption: \"{caption}\". " if caption else "User sent this screenshot/image. "
    p += "Spot any accessibility problems visible and suggest fixes briefly."
    return await generate([types.Part.from_bytes(data=data, mime_type=mime), p], system=CONCIERGE, max_tokens=400)


async def transcribe(data: bytes, mime: str):
    return await generate([types.Part.from_bytes(data=data, mime_type=mime),
                           "Transcribe this audio exactly. Return ONLY the transcript."], temperature=0, max_tokens=400)

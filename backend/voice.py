import os

import httpx
from fastapi import HTTPException

SARVAM = "https://api.sarvam.ai"
LANGS = {"bn-IN", "en-IN", "gu-IN", "hi-IN", "kn-IN", "ml-IN", "mr-IN", "od-IN", "pa-IN", "ta-IN", "te-IN"}


def configured():
    return bool(os.environ.get("SARVAM_API_KEY"))


def _headers():
    if not configured():
        raise HTTPException(501, "Sarvam voice is not configured")
    return {"api-subscription-key": os.environ["SARVAM_API_KEY"]}


async def stt(audio: bytes, filename: str, mime: str, lang: str):
    data = {"model": "saaras:v4", "mode": "transcribe", "language_code": lang if lang in LANGS else "unknown"}
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(f"{SARVAM}/speech-to-text", headers=_headers(), data=data,
                         files={"file": (filename, audio, mime)})
        if r.status_code >= 400:
            data = {"model": "saarika:v2.5", "language_code": data["language_code"]}
            r = await c.post(f"{SARVAM}/speech-to-text", headers=_headers(), data=data, files={"file": (filename, audio, mime)})
    if r.status_code >= 400:
        raise HTTPException(502, f"Speech recognition failed ({r.status_code})")
    return r.json().get("transcript", "")


async def tts(text: str, lang: str):
    payload = {"text": text[:1500], "target_language_code": lang if lang in LANGS else "en-IN",
               "language_code": lang if lang in LANGS else "en-IN", "model": "bulbul:v4-flash", "pace": 1.0}
    if os.environ.get("SARVAM_SPEAKER"):
        payload["speaker"] = os.environ["SARVAM_SPEAKER"]
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(f"{SARVAM}/text-to-speech", headers=_headers(), json=payload)
        if r.status_code >= 400:
            payload["model"] = "bulbul:v2"
            payload.pop("language_code", None)
            r = await c.post(f"{SARVAM}/text-to-speech", headers=_headers(), json=payload)
    if r.status_code >= 400:
        raise HTTPException(502, f"Speech synthesis failed ({r.status_code})")
    audios = r.json().get("audios") or []
    if not audios:
        raise HTTPException(502, "No audio returned")
    return audios[0]

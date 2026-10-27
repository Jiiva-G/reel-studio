"""Per-scene voice-over with caching. Providers:
  sarvam — Sarvam AI Bulbul TTS (Indian languages, code-mixed text; needs SARVAM_API_KEY)
  gemini — Gemini TTS (model auto-discovered; needs GEMINI_API_KEY)
  edge   — Microsoft Edge online TTS via edge-tts (no key; unofficial service, may change without notice)
  none   — silent placeholder of the estimated length (local demo/testing only)
"""
from __future__ import annotations

import asyncio
import re
from pathlib import Path

from .. import gemini, media
from .project import Project, sha

SAMPLE_RATE = 48000


class VoiceError(RuntimeError):
    pass


def apply_pronunciations(text: str, mapping: dict) -> str:
    for word, say in (mapping or {}).items():
        text = re.sub(rf"\b{re.escape(word)}\b", say, text)
    return text


def _to_wav(src: Path, out: Path) -> Path:
    media.run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-ac", "1", "-ar", str(SAMPLE_RATE), str(out)])
    return out


def _edge(text: str, voice: str, rate: str, out_mp3: Path) -> list[dict]:
    import edge_tts

    async def go():
        words = []
        comm = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
        with open(out_mp3, "wb") as fh:
            async for chunk in comm.stream():
                if chunk["type"] == "audio":
                    fh.write(chunk["data"])
                elif chunk["type"] == "WordBoundary":
                    start = chunk["offset"] / 1e7
                    words.append({"start": start, "end": start + chunk["duration"] / 1e7, "text": chunk["text"]})
        return words

    try:
        return asyncio.run(go())
    except Exception as e:
        raise VoiceError(f"Edge TTS failed for voice '{voice}': {e}") from None


SARVAM_URL = "https://api.sarvam.ai/text-to-speech"


def _sarvam(text: str, cfg: dict, out_wav: Path) -> None:
    import base64

    import httpx

    from ..credentials import redact, require_key

    body = {"text": text, "language_code": cfg.get("sarvam_language", "ta-IN"),
            "model": cfg.get("sarvam_model", "bulbul:v4-flash"), "pace": cfg.get("sarvam_pace", 1.0),
            "speech_sample_rate": SAMPLE_RATE, "output_audio_codec": "wav"}
    if cfg.get("sarvam_speaker"):
        body["speaker"] = cfg["sarvam_speaker"]
    try:
        r = httpx.post(SARVAM_URL, json=body, timeout=120,
                       headers={"api-subscription-key": require_key("SARVAM_API_KEY")})
    except httpx.HTTPError as e:
        raise VoiceError(redact(f"Could not reach Sarvam: {e}")) from None
    if r.status_code != 200:
        hint = {401: " (invalid key — check SARVAM_API_KEY)", 403: " (key not allowed for this model)",
                429: " (rate limit / credits exhausted)"}.get(r.status_code, "")
        raise VoiceError(redact(f"Sarvam TTS error {r.status_code}{hint}: {r.text[:300]}"))
    audios = r.json().get("audios") or []
    if not audios:
        raise VoiceError("Sarvam TTS returned no audio.")
    src = out_wav.with_suffix(".sarvam.wav")
    src.write_bytes(b"".join(base64.b64decode(a) for a in audios[:1]))
    _to_wav(src, out_wav)
    src.unlink(missing_ok=True)


def resolve_provider(requested: str, log=print, language: str | None = None) -> tuple[str, str | None]:
    """Return (provider, gemini_tts_model). 'auto' prefers Sarvam for Tamil/Tanglish when its key is set,
    then Gemini TTS. Edge TTS (an unofficial service) is never chosen automatically: request it explicitly."""
    from ..credentials import get_key

    if requested in ("edge", "none"):
        if requested == "edge":
            log("Voice provider: Edge TTS (unofficial Microsoft service; may change or stop without notice)")
        return requested, None
    if requested == "sarvam":
        if not get_key("SARVAM_API_KEY"):
            raise VoiceError("SARVAM_API_KEY is not set (environment variable, .env file or `reel-studio keys`).")
        return "sarvam", None
    if requested == "auto" and language in ("tamil", "tanglish", None) and get_key("SARVAM_API_KEY"):
        log("Voice provider: Sarvam (Tamil/Tanglish)")
        return "sarvam", None
    try:
        c = gemini.client()
        model, why = gemini.pick_model(c, "tts")
        log(f"Gemini TTS model: {model} ({why})")
        return "gemini", model
    except Exception as e:
        reason = str(e).splitlines()[0] if str(e) else type(e).__name__
        if requested == "gemini":
            raise VoiceError(f"Gemini TTS unavailable: {reason}") from None
        raise VoiceError(f"No voice provider available ({reason}). Set GEMINI_API_KEY or SARVAM_API_KEY, "
                         "or choose --voice-provider edge (unofficial) or none (silent placeholder).") from None


def synth(text: str, out_wav: Path, provider: str, cfg: dict, tts_model: str | None = None,
          est_seconds: float = 3.0) -> list[dict]:
    """Synthesize one clip to a 48 kHz mono WAV. Returns word timings when the provider gives them."""
    tmp = out_wav.with_suffix(".raw")
    words: list[dict] = []
    if provider == "sarvam":
        _sarvam(text, cfg, out_wav)
    elif provider == "gemini":
        c = gemini.client()
        pcm, rate = gemini.tts(c, tts_model, text, cfg.get("gemini_voice", "Puck"), cfg.get("gemini_style"),
                               cfg.get("gemini_language_code"))
        gemini.write_wav(pcm, rate, tmp.with_suffix(".src.wav"))
        _to_wav(tmp.with_suffix(".src.wav"), out_wav)
        tmp.with_suffix(".src.wav").unlink(missing_ok=True)
    elif provider == "edge":
        mp3 = tmp.with_suffix(".mp3")
        words = _edge(text, cfg.get("edge_voice", "en-US-EmmaMultilingualNeural"), cfg.get("edge_rate", "+0%"), mp3)
        _to_wav(mp3, out_wav)
        mp3.unlink(missing_ok=True)
    elif provider == "none":
        media.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"anullsrc=r={SAMPLE_RATE}:cl=mono",
                   "-t", f"{est_seconds:.2f}", str(out_wav)])
    else:
        raise VoiceError(f"Unknown voice provider: {provider}")
    if media.audio_duration(out_wav) < 0.3:
        raise VoiceError(f"Voice clip is empty: {out_wav.name}")
    return words


def run(project: Project, board: dict, provider_req: str, scenes: set[int] | None = None, force: bool = False,
        log=print) -> dict:
    cfg = project.brand.get("voice", {})
    provider, tts_model = resolve_provider(provider_req, log, project.state.get("language"))
    manifest = project.load_json("audio/voice/manifest.json") or {}
    for s in board["scenes"]:
        sid = str(s["id"])
        text = apply_pronunciations(s["narration"], cfg.get("pronunciations"))
        key = sha(text, provider, tts_model, cfg.get("gemini_voice"), cfg.get("gemini_style"), cfg.get("edge_voice"),
                  cfg.get("edge_rate"), cfg.get("sarvam_model"), cfg.get("sarvam_speaker"), cfg.get("sarvam_pace"))
        out = project.p("audio", "voice", f"scene_{int(sid):02d}.wav")
        cached = manifest.get(sid)
        wanted = scenes is None or int(sid) in scenes
        if cached and cached.get("hash") == key and out.exists() and not (force and wanted):
            continue
        if not wanted and cached and out.exists():
            continue  # keep the existing clip for scenes not selected
        log(f"Voice: scene {sid} ({provider})")
        words = synth(text, out, provider, cfg, tts_model, est_seconds=max(1.5, s["end_s"] - s["start_s"] - 0.6))
        manifest[sid] = {"hash": key, "file": out.name, "duration": round(media.audio_duration(out), 3),
                         "provider": provider, "model": tts_model,
                         "voice": {"gemini": cfg.get("gemini_voice"), "sarvam": cfg.get("sarvam_speaker")}.get(
                             provider, cfg.get("edge_voice")),
                         "words": words, "placeholder": provider == "none"}
        project.write_json("audio/voice/manifest.json", manifest)
    # transcript of what was voiced
    lines = [f"[scene {s['id']}] {s['narration']}" for s in board["scenes"]]
    project.p("transcript.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return manifest


def voice_test(text: str, out: Path, provider_req: str, cfg: dict, log=print, language: str | None = None) -> Path:
    provider, model = resolve_provider(provider_req, log, language)
    out.parent.mkdir(parents=True, exist_ok=True)
    synth(apply_pronunciations(text, cfg.get("pronunciations")), out, provider, cfg, model)
    log(f"Voice sample ({provider}{' / ' + model if model else ''}): {out}")
    return out

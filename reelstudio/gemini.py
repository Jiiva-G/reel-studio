"""Google Gemini (AI Studio API) helpers: model discovery, video upload,
JSON/text generation with retries, and speech generation."""
from __future__ import annotations

import mimetypes
import os
import re
import time
import wave
from pathlib import Path

from .credentials import redact, require_key

RETRY_CODES = {429, 500, 502, 503, 504}
EXCLUDE_FOR_TEXT = ("tts", "image", "live", "audio", "lite", "embedding", "exp", "learnlm", "robotics",
                    "computer-use", "veo", "imagen", "gemma", "nano")


class GeminiError(RuntimeError):
    pass


def client():
    from google import genai

    return genai.Client(api_key=require_key("GEMINI_API_KEY"))


def _friendly(e) -> str:
    code = getattr(e, "code", None)
    msg = getattr(e, "message", None) or str(e)
    hint = {
        400: "Bad request — the model may not support this input, or the key is not an AI Studio API key.",
        401: "Gemini rejected the API key. Check the key (environment, .env or `reel-studio keys`).",
        403: "Permission denied — check the key's project has the Gemini API enabled.",
        404: "Model or file not found — check GEMINI_MODEL / GEMINI_TTS_MODEL (see README).",
        429: "Quota or rate limit reached — wait, or check limits in Google AI Studio.",
    }.get(code, "")
    return redact(f"Gemini API error {code}: {msg}" + (f"\n{hint}" if hint else ""))


def _version(name: str) -> float:
    m = re.match(r"gemini-(\d+(?:\.\d+)?)", name)
    return float(m.group(1)) if m else 0.0


def available_models(c) -> list[str]:
    names = []
    for m in c.models.list():
        actions = m.supported_actions or []
        if "generateContent" in actions:
            names.append(m.name.removeprefix("models/"))
    return names


def pick_model(c, purpose: str = "video") -> tuple[str, str]:
    """Return (model_id, reason). purpose: 'video' | 'text' | 'tts'.
    Env overrides: GEMINI_MODEL (video/text), GEMINI_TTS_MODEL (tts)."""
    override = os.environ.get("GEMINI_TTS_MODEL" if purpose == "tts" else "GEMINI_MODEL")
    try:
        names = available_models(c)
    except Exception as e:  # discovery unavailable
        if override:
            return override, "from environment override (model listing failed, not verified)"
        raise GeminiError("Could not list Gemini models: " + _friendly(e) +
                          "\nSet GEMINI_MODEL to a model ID shown in Google AI Studio.") from None
    if override:
        if override.removeprefix("models/") not in names:
            raise GeminiError(f"Model '{override}' is not available to this key. Available: {', '.join(sorted(names))}")
        return override.removeprefix("models/"), "from environment override (verified in model list)"

    if purpose == "tts":
        cands = [n for n in names if "tts" in n]
    else:
        cands = [n for n in names if re.match(r"gemini-\d", n) and "flash" in n
                 and not any(x in n for x in EXCLUDE_FOR_TEXT)]
    if not cands:
        raise GeminiError(f"No suitable {purpose} model found for this key. Available: {', '.join(sorted(names))}")
    # Prefer stable over preview, then the newest version, then the shortest (base) name.
    cands.sort(key=lambda n: ("preview" not in n, _version(n), -len(n)), reverse=True)
    choice = cands[0]
    kind = "stable" if "preview" not in choice else "preview (no stable option listed)"
    return choice, f"auto-selected newest {kind} Flash-family model from your account's model list"


def generate(c, model: str, contents, system: str | None = None, schema: dict | None = None,
             temperature: float = 0.4, retries: int = 4, max_output_tokens: int | None = None) -> str:
    from google.genai import errors, types

    cfg = types.GenerateContentConfig(
        system_instruction=system,
        temperature=temperature,
        max_output_tokens=max_output_tokens,
        response_mime_type="application/json" if schema else None,
        response_json_schema=schema,
    )
    for attempt in range(retries + 1):
        try:
            resp = c.models.generate_content(model=model, contents=contents, config=cfg)
            text = resp.text
            if not text:
                reason = resp.candidates[0].finish_reason if resp.candidates else "no candidates"
                raise GeminiError(f"Gemini returned an empty response (finish reason: {reason}).")
            return text
        except errors.APIError as e:
            if e.code in RETRY_CODES and attempt < retries:
                time.sleep(min(60, 5 * 2 ** attempt))
                continue
            raise GeminiError(_friendly(e)) from None


def upload_video(c, path: Path, log=print, timeout_s: int = 900):
    from google.genai import errors, types

    mime = mimetypes.guess_type(path.name)[0] or "video/mp4"
    log("Uploading video to Gemini")
    try:
        f = c.files.upload(file=str(path), config=types.UploadFileConfig(mime_type=mime, display_name=path.name))
        log("Waiting for video processing")
        start = time.time()
        while f.state and f.state.name == "PROCESSING":
            if time.time() - start > timeout_s:
                raise GeminiError(f"Video processing did not finish within {timeout_s}s.")
            time.sleep(4)
            f = c.files.get(name=f.name)
    except errors.APIError as e:
        raise GeminiError(_friendly(e)) from None
    if f.state and f.state.name == "FAILED":
        raise GeminiError(f"Gemini could not process the video: {f.error}")
    return f


def delete_file(c, f) -> None:
    try:
        c.files.delete(name=f.name)
    except Exception:
        pass  # uploaded files also expire automatically after ~48h


def frames_as_parts(frames: list[tuple[float, Path]]) -> list:
    from google.genai import types

    parts = []
    for t, p in frames:
        parts.append(f"Frame at t={t:.1f}s:")
        parts.append(types.Part.from_bytes(data=p.read_bytes(), mime_type="image/jpeg"))
    return parts


def tts(c, model: str, text: str, voice: str, style: str | None = None, language_code: str | None = None,
        retries: int = 3) -> tuple[bytes, int]:
    """Return (pcm16_mono_bytes, sample_rate)."""
    from google.genai import errors, types

    cfg = types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice)),
            language_code=language_code,
        ),
    )
    prompt = f"{style.strip()}\n\n{text}" if style else text
    for attempt in range(retries + 1):
        try:
            resp = c.models.generate_content(model=model, contents=prompt, config=cfg)
            part = resp.candidates[0].content.parts[0].inline_data
            rate = int(re.search(r"rate=(\d+)", part.mime_type or "").group(1)) if "rate=" in (part.mime_type or "") else 24000
            return part.data, rate
        except errors.APIError as e:
            if e.code in RETRY_CODES and attempt < retries:
                time.sleep(min(60, 5 * 2 ** attempt))
                continue
            raise GeminiError(_friendly(e)) from None
        except (AttributeError, IndexError, TypeError):
            raise GeminiError("Gemini TTS returned no audio for this text.") from None


def write_wav(pcm: bytes, rate: int, out: Path) -> Path:
    with wave.open(str(out), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)
    return out

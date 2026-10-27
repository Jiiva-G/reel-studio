"""Speech-to-text with Groq Whisper."""
from __future__ import annotations

import os
from pathlib import Path

from . import media
from .credentials import redact, require_key

DEFAULT_MODEL = "whisper-large-v3-turbo"
# Groq's upload limit depends on the account tier; stay well under the smallest.
MAX_UPLOAD_BYTES = 19 * 1024 * 1024
CHUNK_SECONDS = 600


class TranscriptionError(RuntimeError):
    pass


def _as_dict(resp) -> dict:
    for attr in ("to_dict", "model_dump"):
        fn = getattr(resp, attr, None)
        if callable(fn):
            return fn()
    return {"text": getattr(resp, "text", "")}


def transcribe_file(audio: Path, model: str | None = None, language: str | None = None,
                    words: bool = False) -> dict:
    """Transcribe one audio file (<= MAX_UPLOAD_BYTES). Returns
    {text, language, segments:[{start,end,text}], words:[{start,end,word}], model}."""
    from groq import APIConnectionError, APIStatusError, Groq

    model = model or os.environ.get("GROQ_WHISPER_MODEL") or DEFAULT_MODEL
    client = Groq(api_key=require_key("GROQ_API_KEY"))
    kwargs = dict(model=model, response_format="verbose_json",
                  timestamp_granularities=["segment", "word"] if words else ["segment"], temperature=0.0)
    if language:
        kwargs["language"] = language
    try:
        with open(audio, "rb") as fh:
            resp = client.audio.transcriptions.create(file=(audio.name, fh.read()), **kwargs)
    except APIStatusError as e:
        hint = ""
        if e.status_code in (400, 404) and "model" in str(e).lower():
            hint = (f"\nModel '{model}' may be unavailable for your account. List models at "
                    "https://console.groq.com/docs/speech-to-text and set GROQ_WHISPER_MODEL.")
        elif e.status_code == 401:
            hint = "\nGroq rejected the API key (401). Check the key (environment, .env or `reel-studio keys`)."
        elif e.status_code == 429:
            hint = "\nGroq rate limit / quota reached. Wait and retry."
        raise TranscriptionError(redact(f"Groq API error {e.status_code}: {e.message}{hint}")) from None
    except APIConnectionError as e:
        raise TranscriptionError(redact(f"Could not reach Groq: {e}")) from None

    data = _as_dict(resp)
    segments = [{"start": float(s.get("start", 0)), "end": float(s.get("end", 0)), "text": s.get("text", "").strip()}
                for s in data.get("segments") or []]
    word_list = [{"start": float(w.get("start", 0)), "end": float(w.get("end", 0)), "word": w.get("word", "")}
                 for w in data.get("words") or []]
    return {"text": (data.get("text") or "").strip(), "language": data.get("language"),
            "segments": segments, "words": word_list, "model": model}


def transcribe_video(video: Path, work_dir: Path, model: str | None = None, language: str | None = None,
                     log=print) -> dict:
    """Extract audio, chunk if needed, transcribe in order with absolute timestamps."""
    info = media.probe(video)
    if not info["has_audio"]:
        return {"text": "", "segments": [], "words": [], "model": None, "language": None,
                "note": "The video has no audio track."}
    work_dir.mkdir(parents=True, exist_ok=True)
    log("Extracting audio")
    audio = media.extract_audio(video, work_dir / "audio.mp3")
    parts = [(0.0, audio)]
    if audio.stat().st_size > MAX_UPLOAD_BYTES:
        log("Audio is large; splitting into segments")
        parts = media.split_audio(audio, work_dir / "chunks", CHUNK_SECONDS)

    log(f"Transcribing audio with Groq ({model or os.environ.get('GROQ_WHISPER_MODEL') or DEFAULT_MODEL})")
    result = {"text": "", "segments": [], "words": [], "model": None, "language": None}
    texts = []
    for offset, part in parts:
        r = transcribe_file(part, model=model, language=language)
        texts.append(r["text"])
        result["segments"] += [{**s, "start": s["start"] + offset, "end": s["end"] + offset} for s in r["segments"]]
        result["model"], result["language"] = r["model"], result["language"] or r["language"]
    result["text"] = "\n".join(t for t in texts if t)
    if not result["text"]:
        result["note"] = "Transcription returned no speech (music-only or silent audio?)."
    return result


def format_transcript(tr: dict) -> str:
    def ts(s: float) -> str:
        return f"{int(s // 60):02d}:{s % 60:05.2f}"

    head = [f"# Transcript (model: {tr.get('model')}, detected language: {tr.get('language') or 'unknown'})",
            "# Original language, not translated. Timestamps from Whisper segments (approximate).", ""]
    if tr.get("note"):
        head.append(f"NOTE: {tr['note']}\n")
    if tr.get("segments"):
        body = [f"[{ts(s['start'])} - {ts(s['end'])}] {s['text']}" for s in tr["segments"]]
    else:
        body = [tr.get("text", "")]
    return "\n".join(head + body) + "\n"

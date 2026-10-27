"""Use your own recorded narration (one WAV/FLAC file for the whole reel) instead of TTS. Local only, no API.

Scene boundaries come from one of two local methods:
  align — DTW alignment against the project's existing per-scene voice clips (best when you recorded the
          same script that a TTS voice already read; see align.py)
  text  — each boundary estimated from the scenes' share of the script length, snapped to a real pause
After import, scenes, captions and sound effects follow your recording; run `voice,sound,render,qa` again.
"""
from __future__ import annotations

import hashlib
import shutil
from pathlib import Path

from . import align, narration
from .project import Project, slugify
from .timeline import chunk_text

AUDIO_TYPES = (".wav", ".flac", ".ogg")


def _digest(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for block in iter(lambda: fh.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def _copy_in(project: Project, src: Path) -> Path:
    """Copy the recording into audio/ without touching the original; never overwrite a different file."""
    stem = f"narration_{slugify(src.stem)[:30]}"
    for n in range(1, 100):
        dst = project.p("audio", f"{stem}{'' if n == 1 else f'_{n}'}{src.suffix.lower()}")
        if not dst.exists():
            shutil.copy2(src, dst)
            return dst
        if _digest(dst) == _digest(src):
            return dst
    raise RuntimeError("Too many narration files with the same name in audio/.")


def _voice_clips(project: Project, board: dict) -> list[Path] | None:
    manifest = project.load_json("audio/voice/manifest.json") or {}
    clips = []
    for s in board["scenes"]:
        entry = manifest.get(str(s["id"]))
        if not entry or entry.get("placeholder"):
            return None
        clip = project.dir / "audio" / "voice" / entry["file"]
        if not clip.exists():
            return None
        clips.append(clip)
    return clips


def import_wav(project: Project, wav: Path, method: str = "auto", log=print) -> dict:
    wav = Path(wav)
    if not wav.is_file():
        raise FileNotFoundError(f"Narration file not found: {wav}")
    if wav.suffix.lower() not in AUDIO_TYPES:
        raise ValueError(f"Use a {', '.join(AUDIO_TYPES)} file (got {wav.suffix}).")
    board = project.load_json("storyboard.json")
    if not board or not board.get("scenes") or any("id" not in s for s in board["scenes"]):
        raise ValueError("Run the 'validate' stage first so the storyboard has numbered scenes.")
    if not (project.dir / "storyboard_before_narration.json").exists():
        project.write_json("storyboard_before_narration.json", board)

    dst = _copy_in(project, wav)
    clips = _voice_clips(project, board)
    if method == "align" and not clips:
        raise ValueError("'align' needs voice clips for every scene: run the voice stage with a TTS provider first, "
                         "or use --method text.")
    use_align = method == "align" or (method == "auto" and clips is not None)
    phrases = [chunk_text(s.get("subtitle") or s["narration"]) for s in board["scenes"]]
    if use_align:
        res_align = align.line_spans(dst, clips)
        spans = [tuple(x) for x in res_align["spans"]]
        detail = {"method": "align", "dtw_cost": res_align["dtw_cost"], "cuts": res_align["cuts"]}
    else:
        x = narration._load(dst)
        spans = narration.phrase_spans_by_text(x, [s["narration"] for s in board["scenes"]], snap=0.8)
        detail = {"method": "text"}
    log(f"Scene boundaries from your recording ({detail['method']}): "
        + ", ".join(f"{a:.2f}-{b:.2f}s" for a, b in spans))
    res = narration.from_wav(dst, spans, phrases, phrases, fps=project.brand.get("fps", 30))
    for s, w in zip(board["scenes"], res["windows"]):
        s["window_f"] = w
    board["captions"] = res["captions"]
    board["narration_audio"] = {"path": dst.name, "duration_s": res["duration_s"], "source": wav.name, **detail}
    project.write_json("storyboard.json", board)
    project.write_json("render/narration_timing.json", {**res, **detail})
    project.mark("voice", "pending", note="narration imported; run voice,sound,render,qa")
    log(f"Narration imported: audio/{dst.name} ({res['duration_s']:.1f}s video). "
        "Next: run --only voice,sound,render,qa")
    return board["narration_audio"]


def clear(project: Project, log=print) -> None:
    """Go back to TTS timing (the copied recording stays in audio/)."""
    board = project.load_json("storyboard.json") or {}
    if not board.pop("narration_audio", None):
        log("No imported narration in this project.")
        return
    board.pop("captions", None)
    for s in board.get("scenes", []):
        s.pop("window_f", None)
    project.write_json("storyboard.json", board)
    project.mark("voice", "pending", note="imported narration removed")
    log("Imported narration removed from the storyboard; TTS timing will be used again.")

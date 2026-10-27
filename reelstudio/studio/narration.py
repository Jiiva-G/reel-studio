"""Assemble one narration track from per-line voice clips, and derive scene windows, phrase-level
captions and per-scene cue frames from the audio itself (pauses), with no API call.

Used when an episode's scenes are driven by `narration_audio` (see timeline.build_from_narration).
The same cue/caption logic is reused when the user later supplies their own WAV.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import soundfile as sf

from .. import media

SR = 48000
WIN = 0.02  # s, RMS window for pause detection


def _load(path: Path) -> np.ndarray:
    x, sr = sf.read(str(path), dtype="float64", always_2d=False)
    if x.ndim > 1:
        x = x.mean(axis=1)
    if sr != SR:
        tmp = path.with_suffix(".48k.wav")
        media.run(["ffmpeg", "-y", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), str(tmp)])
        x, _ = sf.read(str(tmp), dtype="float64")
        tmp.unlink(missing_ok=True)
    return x


def pauses(x: np.ndarray, thresh_db: float = -38.0, min_s: float = 0.15) -> list[tuple[float, float]]:
    """Silent runs (start, end) in seconds inside the speech (leading/trailing silence excluded)."""
    n = int(WIN * SR)
    frames = len(x) // n
    rms = np.sqrt(np.mean(x[: frames * n].reshape(frames, n) ** 2, axis=1) + 1e-12)
    silent = 20 * np.log10(rms) < thresh_db
    voiced = np.where(~silent)[0]
    if not len(voiced):
        return []
    first, last = voiced[0], voiced[-1]
    out, run = [], None
    for i in range(first, last + 1):
        if silent[i] and run is None:
            run = i
        elif not silent[i] and run is not None:
            if (i - run) * WIN >= min_s:
                out.append((run * WIN, i * WIN))
            run = None
    return out


def speech_bounds(x: np.ndarray, thresh_db: float = -38.0) -> tuple[float, float]:
    n = int(WIN * SR)
    frames = len(x) // n
    rms = np.sqrt(np.mean(x[: frames * n].reshape(frames, n) ** 2, axis=1) + 1e-12)
    voiced = np.where(20 * np.log10(rms) >= thresh_db)[0]
    return (voiced[0] * WIN, (voiced[-1] + 1) * WIN) if len(voiced) else (0.0, len(x) / SR)


def tighten(x: np.ndarray, max_pause: float = 0.25) -> np.ndarray:
    """Shorten internal pauses longer than max_pause (cut from their middle) and trim edges."""
    a, b = speech_bounds(x)
    keep = []
    cursor = int(a * SR)
    for s, e in pauses(x):
        if e - s > max_pause:
            cut_from = int((s + max_pause / 2) * SR)
            cut_to = int((e - max_pause / 2) * SR)
            keep.append(x[cursor:cut_from])
            cursor = cut_to
    keep.append(x[cursor:int(b * SR)])
    return np.concatenate(keep)


def tempo(x: np.ndarray, factor: float, work: Path) -> np.ndarray:
    if abs(factor - 1) < 1e-3:
        return x
    src, dst = work / "_t_in.wav", work / "_t_out.wav"
    sf.write(str(src), x, SR, subtype="PCM_24")
    media.run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-af", f"atempo={factor}", str(dst)])
    y, _ = sf.read(str(dst), dtype="float64")
    src.unlink(missing_ok=True)
    dst.unlink(missing_ok=True)
    return y


def phrase_spans(x: np.ndarray, n_phrases: int) -> list[tuple[float, float]]:
    """Split a line's speech into n phrases at its n-1 longest pauses (time order)."""
    a, b = speech_bounds(x)
    ps = pauses(x)
    cuts = sorted(sorted(ps, key=lambda p: p[1] - p[0], reverse=True)[: n_phrases - 1])
    spans, start = [], a
    for s, e in cuts:
        spans.append((start, s))
        start = e
    spans.append((start, b))
    while len(spans) < n_phrases:  # fewer pauses than phrases: split the longest span evenly
        i = max(range(len(spans)), key=lambda k: spans[k][1] - spans[k][0])
        s, e = spans[i]
        spans[i:i + 1] = [(s, (s + e) / 2), ((s + e) / 2, e)]
    return spans


def phrase_spans_by_text(x: np.ndarray, segments: list[str], snap: float = 0.6) -> list[tuple[float, float]]:
    """Split a line's speech into len(segments) phrases: each boundary is estimated from the spoken
    text's length share, then snapped to the nearest real pause within `snap` seconds."""
    a, b = speech_bounds(x)
    ps = pauses(x, min_s=0.08)
    lens = [max(1, len(s.replace(" ", ""))) for s in segments]
    total = sum(lens)
    spans, start, acc = [], a, 0
    for L in lens[:-1]:
        acc += L
        t = a + (b - a) * acc / total
        near = [p for p in ps if abs((p[0] + p[1]) / 2 - t) <= snap and p[0] > start]
        if near:
            s, e = min(near, key=lambda p: abs((p[0] + p[1]) / 2 - t))
        else:
            s = e = t
        spans.append((start, s))
        start = e
    spans.append((start, b))
    return spans


def from_wav(wav: Path, spans: list[tuple[float, float]], phrases: list[list[str]], spoken_segments: list[list[str]],
             fps: int = 30, tail: float = 1.0, overlap_f: int = 8) -> dict:
    """Windows/cues/captions for a single pre-recorded narration with known line spans (seconds)."""
    x = _load(wav)
    total = max(len(x) / SR, spans[-1][1] + tail)
    lines = []
    for (s, e), texts, segs in zip(spans, phrases, spoken_segments):
        seg = x[int(s * SR):int(e * SR)]
        sub = phrase_spans_by_text(seg, segs) if len(segs) == len(texts) else phrase_spans(seg, len(texts))
        lines.append({"start": s, "end": e, "phrases": [(t, s + a, s + b) for t, (a, b) in zip(texts, sub)]})
    total_f = round(total * fps)
    bounds = [round(((a["end"] + b["start"]) / 2) * fps) for a, b in zip(lines, lines[1:])]
    windows, cues = [], []
    for i, ln in enumerate(lines):
        a = 0 if i == 0 else bounds[i - 1] - overlap_f // 2
        b = total_f if i == len(lines) - 1 else bounds[i] + overlap_f // 2
        windows.append([a, b])
        c = {"v": round(ln["start"] * fps) - a, "e": round(ln["end"] * fps) - a, "d": b - a}
        for k, (_, s, _e) in enumerate(ln["phrases"]):
            c[f"s{k}"] = round(s * fps) - a
        cues.append(c)
    caps = [{"text": t, "start": round(s, 3), "end": round(e, 3)} for ln in lines for t, s, e in ln["phrases"]]
    return {"duration_s": round(total_f / fps, 3), "total_f": total_f, "windows": windows, "cues": cues,
            "captions": caps, "lines": [{"start": ln["start"], "end": ln["end"]} for ln in lines]}


def assemble(clips: list[Path], phrases: list[list[str]], out_wav: Path, fps: int = 30, lead: float = 0.15,
             gap: float = 0.40, tail: float = 1.0, max_pause: float = 0.25, speed: float = 1.08,
             overlap_f: int = 8, spoken_segments: list[list[str]] | None = None) -> dict:
    """Returns {duration_s, lines:[{start,end,phrases:[(text,start,end)]}], windows:[[from,to]], cues:[{...}]}
    spoken_segments: per line, the narration split into the same number of pieces as its caption
    phrases; used to place phrase boundaries (else: the longest pauses)."""
    work = out_wav.parent
    lines, t = [], lead
    for i, (clip, texts) in enumerate(zip(clips, phrases)):
        y = tempo(tighten(_load(clip), max_pause), speed, work)
        dur = len(y) / SR
        segs = spoken_segments[i] if spoken_segments else None
        spans = phrase_spans_by_text(y, segs) if segs and len(segs) == len(texts) else phrase_spans(y, len(texts))
        lines.append({"start": t, "end": t + dur, "audio": y,
                      "phrases": [(txt, t + s, t + e) for txt, (s, e) in zip(texts, spans)]})
        t += dur + gap
    total = lines[-1]["end"] + tail
    track = np.zeros(int(round(total * SR)) + 1)
    for ln in lines:
        i = int(round(ln["start"] * SR))
        track[i:i + len(ln["audio"])] += ln["audio"]
    sf.write(str(out_wav), track, SR, subtype="PCM_24")

    total_f = round(total * fps)
    bounds = [round(((a["end"] + b["start"]) / 2) * fps) for a, b in zip(lines, lines[1:])]
    windows, cues = [], []
    for i, ln in enumerate(lines):
        a = 0 if i == 0 else bounds[i - 1] - overlap_f // 2
        b = total_f if i == len(lines) - 1 else bounds[i] + overlap_f // 2
        windows.append([a, b])
        c = {"v": round(ln["start"] * fps) - a, "e": round(ln["end"] * fps) - a, "d": b - a}
        for k, (_, s, _e) in enumerate(ln["phrases"]):
            c[f"s{k}"] = round(s * fps) - a
        cues.append(c)
    caps = [{"text": txt, "start": round(s, 3), "end": round(e, 3)} for ln in lines for txt, s, e in ln["phrases"]]
    return {"duration_s": round(total, 3), "total_f": total_f, "windows": windows, "cues": cues, "captions": caps,
            "lines": [{"start": round(ln["start"], 3), "end": round(ln["end"], 3)} for ln in lines]}

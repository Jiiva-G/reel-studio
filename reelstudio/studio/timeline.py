"""Turn storyboard + voice clip lengths into a frame-accurate timeline with captions."""
from __future__ import annotations

import re

LEAD_S = 0.15  # silence before narration starts in a scene
TAIL_S = 0.30  # breathing room after narration
MIN_S = {"hook": 1.8, "endcard": 2.6, "code": 4.0, "terminal": 4.0, "diagram": 3.5, "compare": 3.5}
CHUNK_WORDS, CHUNK_CHARS = 5, 34
# Default offsets (seconds from scene start) for sound effects given by name only.
SFX_OFFSETS = {"whoosh": -0.12, "pop": 0.35, "impact": 0.25, "click": 0.45, "typing": 0.4}


def chunk_text(text: str) -> list[str]:
    words = text.split()
    chunks, cur = [], []
    for w in words:
        if cur and (len(cur) >= CHUNK_WORDS or len(" ".join(cur + [w])) > CHUNK_CHARS):
            chunks.append(" ".join(cur))
            cur = []
        cur.append(w)
        if re.search(r"[.!?]$", w):
            chunks.append(" ".join(cur))
            cur = []
    if cur:
        chunks.append(" ".join(cur))
    return chunks


def _caption_times(chunks: list[str], start: float, dur: float, words: list[dict], same_text: bool) -> list[tuple]:
    if not chunks:
        return []
    n_words = sum(len(c.split()) for c in chunks)
    if words and same_text and len(words) == n_words:
        out, i = [], 0
        for c in chunks:
            k = len(c.split())
            out.append((c, start + words[i]["start"], start + words[i + k - 1]["end"]))
            i += k
        return out
    total = sum(len(c) for c in chunks)
    out, t = [], start
    for c in chunks:
        d = dur * len(c) / total
        out.append((c, t, t + d))
        t += d
    return out


def build_from_narration(board: dict, fps: int) -> dict:
    """Timeline for a single pre-recorded narration file: each scene carries an explicit frame window
    (`window_f`, aligned to pauses in the audio) and captions come from `captions` (seconds)."""
    scenes, sfx_events, music_curve = [], [], []
    for s in board["scenes"]:
        a, b = s["window_f"]
        nxt_overlap = 8 if s is not board["scenes"][-1] else 0
        scenes.append({"id": s["id"], "type": s["type"], "from": a, "duration": b - a, "overlap": nxt_overlap,
                       "transition": s.get("transition", "fade"), "on_screen": s.get("on_screen", {})})
        s["start_s"], s["end_s"], s["timing"] = round(a / fps, 3), round(b / fps, 3), "from uploaded narration"
        for fx in s.get("sfx") or []:
            name, at = (fx["name"], float(fx["at"])) if isinstance(fx, dict) else (fx, SFX_OFFSETS.get(fx, 0.3))
            sfx_events.append({"name": name, "at": round(max(0.0, a / fps + at), 3), "scene": s["id"]})
        music_curve.append((a / fps, b / fps, s.get("music_intensity", "medium")))
    captions = [{"text": c["text"], "from": round(c["start"] * fps), "to": round(c["end"] * fps)} for c in board["captions"]]
    for x, y in zip(captions, captions[1:]):
        x["to"] = min(x["to"], y["from"])
    total_f = scenes[-1]["from"] + scenes[-1]["duration"]
    voice = [{"path": board["narration_audio"]["path"], "at": 0.0, "scene": 0}]
    return {"fps": fps, "duration_s": round(total_f / fps, 3), "durationInFrames": total_f, "scenes": scenes,
            "captions": captions, "voice": voice, "sfx": sfx_events, "music_curve": music_curve}


def build(board: dict, manifest: dict, fps: int) -> dict:
    """Scenes play back to back; with `transition_overlap_s` each scene keeps running for that long
    under the start of the next one (overlapping transition), which also shortens the total."""
    ov_f = round(float(board.get("transition_overlap_s", 0)) * fps)
    t_f = 0
    scenes, captions, voice_events, sfx_events, music_curve = [], [], [], [], []
    n = len(board["scenes"])
    for idx, s in enumerate(board["scenes"]):
        last = idx == n - 1
        t = t_f / fps
        v = manifest.get(str(s["id"]), {})
        vdur = float(v.get("duration", 0))
        dur = max(vdur + LEAD_S + TAIL_S, MIN_S.get(s["type"], 2.0))
        dur_f = round(dur * fps)  # the last ov_f frames play under the start of the next scene
        s["start_s"], s["end_s"], s["timing"] = round(t, 3), round(t + dur_f / fps, 3), "from voice-over"
        scenes.append({"id": s["id"], "type": s["type"], "from": t_f, "duration": dur_f, "overlap": 0 if last else ov_f,
                       "transition": s.get("transition", "fade"), "on_screen": s.get("on_screen", {})})
        if vdur:
            voice_events.append({"file": v["file"], "at": t + LEAD_S, "scene": s["id"]})
            same = (s.get("subtitle") or s["narration"]).strip() == s["narration"].strip()
            for text, a, b in _caption_times(chunk_text(s.get("subtitle") or s["narration"]), t + LEAD_S, vdur,
                                             v.get("words") or [], same):
                captions.append({"text": text, "from": round(a * fps), "to": max(round(b * fps), round(a * fps) + 6)})
        for fx in s.get("sfx") or []:
            if isinstance(fx, dict):  # exact time, synced to the scene's animation
                name, at = fx["name"], t + float(fx["at"])
            else:
                name, at = fx, t + SFX_OFFSETS.get(fx, 0.3)
                if name == "whoosh" and t == 0:
                    continue
            sfx_events.append({"name": name, "at": round(max(0.0, at), 3), "scene": s["id"]})
        music_curve.append((t, t + dur_f / fps, s.get("music_intensity", "medium")))
        t_f += dur_f - (0 if last else ov_f)
    # make consecutive captions not overlap
    for a, b in zip(captions, captions[1:]):
        a["to"] = min(a["to"], b["from"])
    total_f = scenes[-1]["from"] + scenes[-1]["duration"]
    return {"fps": fps, "duration_s": round(total_f / fps, 3), "durationInFrames": total_f, "scenes": scenes,
            "captions": captions, "voice": voice_events, "sfx": sfx_events, "music_curve": music_curve}

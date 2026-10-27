"""Optional scored soundtrack (music + effects locked to the timeline) using the MIT-licensed cinetic skill's
score.py (https://github.com/Leonxlnx/cinetic), installed separately. Local, no API.

Without this step the sound stage uses the built-in procedural music bed and effects.
"""
from __future__ import annotations

import math
import os
import subprocess
import sys
from pathlib import Path

from .project import Project

# Reel Studio sound-effect names -> cinetic event kinds
KIND = {"whoosh": "whoosh", "click": "click", "pop": "pop", "impact": "hit", "typing": "text", "glitch": "snap",
        "scanner": "tick", "stamp": "land", "chime": "bell", "rise": "swell"}
BPM = 100
TENSE = ["Am9", "Fmaj7", "Dm9", "E7sus4"]
RESOLVE = ["Cmaj9", "Gadd9", "Am9", "Fmaj7"]


class ScoreError(RuntimeError):
    pass


def find_score_py(explicit: str | None = None) -> Path:
    raw = explicit or os.environ.get("REEL_STUDIO_CINETIC")
    if not raw:
        raise ScoreError("Scoring needs the cinetic skill. Install it, then pass --cinetic PATH or set "
                         "REEL_STUDIO_CINETIC to its folder.")
    p = Path(raw)
    p = p if p.suffix == ".py" else p / "scripts" / "audio" / "score.py"
    if not p.is_file():
        raise ScoreError(f"cinetic score.py not found at {p}")
    return p


def plan(timeline: dict) -> tuple[dict, dict]:
    """cues.json + score.json for cinetic from the timeline: effects from the scenes' sfx, sections from the
    scene layout (intro -> build -> payoff -> lessons -> resolve on the end card)."""
    fps = timeline["fps"]
    total = timeline["durationInFrames"]
    scenes = timeline["scenes"]
    events = []
    for ev in timeline["sfx"]:
        kind = KIND.get(ev["name"])
        if kind:
            f = round(ev["at"] * fps, 2)
            events.append({"f": f, "kind": kind, "weight": 1, "id": f"s{ev['scene']}:{kind}:{int(f)}"})
    events.sort(key=lambda e: e["f"])
    hits = [e["f"] for e in events if e["kind"] == "hit"]
    payoff = hits[0] if hits else scenes[min(len(scenes) - 1, max(1, len(scenes) // 2))]["from"]
    end_from = scenes[-1]["from"]
    cues = {"fps": fps, "bpm": BPM, "total": total,
            "acts": {f"s{s['id']}": {"from": s["from"], "dur": s["duration"]} for s in scenes},
            "cue": {"payoff": payoff, "lockup": min(total - 1, end_from + fps)}, "events": events}

    bar_f = 4 * 60 / BPM * fps
    bar = lambda f: int(f // bar_f) + 1  # noqa: E731
    nb = max(1, math.ceil(total / bar_f))
    b2 = bar(scenes[1]["from"]) if len(scenes) > 1 else 1
    pb, be = bar(payoff), bar(end_from)
    marks = [(1, "intro"), (b2, "build"), (pb, "resolve"), (pb + 3, "breakdown"), (be, "resolve"), (be + 2, "hold")]
    sections, last = [], 0
    for i, (start, style) in enumerate(marks):
        start = max(start, last + 1)
        end = (marks[i + 1][0] - 1) if i + 1 < len(marks) else nb
        end = min(end, nb)
        if start <= end:
            sections.append({"bars": [start, end], "style": style})
            last = end
    if not sections or sections[-1]["bars"][1] < nb:
        sections.append({"bars": [last + 1, nb], "style": "hold"})
    chords = [(TENSE if b < pb else RESOLVE)[(b - 1) % 4] for b in range(1, nb + 1)]
    score = {"key": "A minor", "bpm": BPM, "music": "synth", "sfx": {"engine": "synth"}, "chords": chords,
             "sections": sections, "drops": [{"at": "@payoff", "silence": 14, "suck": 0}], "typing": "auto",
             "payoff": "@payoff", "mix": {"music": 0.9, "sfx": 1.0, "reverb": 0.9, "sidechain": 0.5, "duck_db": 3},
             "master": {"ceiling": 0.77, "fade": 0.6}}
    return cues, score


def run(project: Project, cinetic: str | None = None, log=print) -> Path:
    import json

    score_py = find_score_py(cinetic)
    timeline = project.load_json("timeline.json")
    if not timeline:
        raise ScoreError("timeline.json not found: run the voice stage first.")
    cues, score = plan(timeline)
    sd = project.dir / "render" / "score"
    sd.mkdir(parents=True, exist_ok=True)
    (sd / "cues.json").write_text(json.dumps(cues, indent=1), encoding="utf-8")
    (sd / "score.json").write_text(json.dumps(score, indent=1), encoding="utf-8")
    out = project.p("audio", "soundtrack.wav")
    log(f"Scoring {timeline['duration_s']:.1f}s with cinetic ({len(cues['events'])} effects)")
    proc = subprocess.run([sys.executable, str(score_py), "--cues", str(sd / "cues.json"), "--score",
                           str(sd / "score.json"), "--out", str(out), "--json", str(sd / "report.json"), "--lufs", "-24"],
                          capture_output=True, text=True, encoding="utf-8", errors="replace", cwd=str(sd),
                          env={**os.environ, "EARSHOT_PYTHON": "none"})
    if proc.returncode != 0 or not out.exists():
        tail = "\n".join((proc.stderr or proc.stdout).strip().splitlines()[-15:])
        raise ScoreError(f"cinetic score.py failed (exit {proc.returncode}):\n{tail}")
    board = project.load_json("storyboard.json") or {}
    board["soundtrack"] = out.name
    project.write_json("storyboard.json", board)
    log(f"Soundtrack: audio/{out.name}. Next: run --only sound,render,qa")
    return out

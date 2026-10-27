"""Automated quality checks on the rendered reel -> render_report.md."""
from __future__ import annotations

from datetime import datetime

from .. import media
from .project import Project
from .render import HEIGHT, WIDTH


def _frame_stats(path) -> tuple[float, float]:
    from PIL import Image, ImageStat

    with Image.open(path) as im:
        st = ImageStat.Stat(im.convert("L"))
        return st.mean[0], st.stddev[0]


def run(project: Project, timeline: dict, board: dict, log=print) -> tuple[int, int]:
    from .pipeline import outputs  # local import: pipeline imports this module

    names = outputs(board)
    log("Quality check")
    out = project.dir / names["video"]
    checks: list[tuple[str, str, str]] = []  # (status, name, detail)
    add = lambda st, name, detail="": checks.append((st, name, detail))

    if not out.exists():
        add("FAIL", "Output file exists", str(out))
        return _write(project, checks, board, names["report"])
    add("PASS", "Output file exists", f"{out.stat().st_size / 1e6:.1f} MB")
    info = media.probe(out)
    add("PASS" if (info["width"], info["height"]) == (WIDTH, HEIGHT) else "FAIL", "Resolution 1080x1920",
        f"{info['width']}x{info['height']}")
    add("PASS" if info["fps"] and abs(info["fps"] - timeline["fps"]) < 0.01 else "FAIL", "Frame rate",
        f"{info['fps']} fps (expected {timeline['fps']})")
    exp = timeline["duration_s"]
    add("PASS" if abs(info["duration"] - exp) <= 0.15 else "FAIL", "Duration matches timeline",
        f"{info['duration']:.2f}s vs {exp:.2f}s")
    add("PASS" if info["video_codec"] == "h264" and info["pix_fmt"] == "yuv420p" else "FAIL", "Video codec H.264 yuv420p",
        f"{info['video_codec']} {info['pix_fmt']}")
    add("PASS" if info["audio_codec"] == "aac" else "FAIL", "Audio codec AAC", str(info["audio_codec"]))
    errs = media.decode_errors(out)
    add("PASS" if not errs else "FAIL", "Full decode with FFmpeg", "no errors" if not errs else "; ".join(errs[:3]))
    blacks = media.black_segments(out)
    add("PASS" if not blacks else "FAIL", "No black gaps (>0.4s)",
        "none" if not blacks else ", ".join(f"{a:.1f}-{b:.1f}s" for a, b in blacks))

    voice = project.dir / "audio" / "voice_track.wav"
    manifest = project.load_json("audio/voice/manifest.json") or {}
    placeholder = any(v.get("placeholder") for v in manifest.values())
    if placeholder:
        add("WARN", "Narration present", "placeholder silent voice (provider 'none') — not a real voice-over")
    elif voice.exists():
        vs = media.volume_stats(voice)
        gaps = [g for g in media.silences(voice, -45, 2.6) if g[0] > 0.5 and g[1] < exp - 3.0]
        add("PASS" if vs["mean_db"] is not None and vs["mean_db"] > -40 else "FAIL", "Narration present",
            f"voice mean {vs['mean_db']} dB")
        add("PASS" if not gaps else "WARN", "No long silent gaps in narration (>2.6s)",
            "none" if not gaps else ", ".join(f"{a:.1f}-{b:.1f}s" for a, b in gaps))
    else:
        add("FAIL", "Narration present", "voice_track.wav missing")
    if board.get("narration_audio"):
        src = project.dir / "audio" / board["narration_audio"]["path"]
        ok = src.exists() and len(timeline["voice"]) == 1 and timeline["voice"][0].get("path") == board["narration_audio"]["path"]
        add("PASS" if ok else "FAIL", "Narration comes from one narration track only",
            f"{src.name} ({media.audio_duration(src):.2f}s), {len(timeline['voice'])} voice input(s)")

    fv = media.volume_stats(out)
    add("PASS" if fv["max_db"] is not None and fv["max_db"] <= -0.5 else "FAIL", "No clipping (peak <= -0.5 dBFS)",
        f"peak {fv['max_db']} dB, mean {fv['mean_db']} dB")
    a_dur = media.run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=duration",
                       "-of", "csv=p=0", str(out)]).stdout.strip()
    try:
        diff = abs(float(a_dur) - info["duration"])
        add("PASS" if diff <= 0.1 else "FAIL", "Audio/video stream lengths in sync", f"diff {diff:.3f}s")
    except ValueError:
        add("FAIL", "Audio/video stream lengths in sync", "audio stream duration unavailable")
    first_voice = timeline["voice"][0]["at"] if timeline["voice"] else None
    add("PASS" if first_voice is not None and first_voice < 0.6 else "WARN", "Narration starts immediately (hook)",
        f"first voice at {first_voice}s")

    cap_scenes = {s["id"] for s in timeline["scenes"]}
    covered = {s["id"] for s in timeline["scenes"]
               if any(s["from"] <= c["from"] < s["from"] + s["duration"] for c in timeline["captions"])}
    add("PASS" if cap_scenes == covered else "WARN", "Captions present in every scene",
        f"{len(covered)}/{len(cap_scenes)} scenes")

    qa_dir = project.dir / names["qa_dir"]
    qa_dir.mkdir(exist_ok=True)
    sheet = media.contact_sheet(out, qa_dir / "contact_sheet.png", cols=4, rows=3)
    add("PASS", "Contact sheet generated", str(sheet))
    end_frame = media.grab_frame(out, max(info["duration"] - 0.6, 0), qa_dir / "end_card.png")
    mean, std = _frame_stats(end_frame)
    add("PASS" if std > 8 else "FAIL", "End card renders (not blank)", f"luma std {std:.1f}")
    for s in timeline["scenes"]:
        t = (s["from"] + s["duration"] * 0.7) / timeline["fps"]
        media.grab_frame(out, t, qa_dir / f"scene_{s['id']:02d}.png")
    add("PASS", "Pre-render layout limits", "validated in 'validate' stage") if project.done("validate") else \
        add("WARN", "Pre-render layout limits", "validate stage not completed")
    add("SKIP", "Visual review of frames", "not automated — review " + names["qa_dir"] + "/contact_sheet.png and scene_*.png")
    return _write(project, checks, board, names["report"])


def _write(project: Project, checks, board, report_name: str = "render_report.md") -> tuple[int, int]:
    passed = sum(1 for c in checks if c[0] == "PASS")
    failed = sum(1 for c in checks if c[0] == "FAIL")
    mix = project.load_json("audio/mix_info.json") or {}
    lines = [f"# Render report — {board.get('title', '')}", "", f"Generated {datetime.now():%Y-%m-%d %H:%M}", "",
             f"**{passed} passed, {failed} failed, {sum(1 for c in checks if c[0] == 'WARN')} warnings**", "",
             "| Status | Check | Detail |", "|---|---|---|",
             *[f"| {st} | {n} | {d} |" for st, n, d in checks], "",
             f"Music: {mix.get('music', 'unknown')}  ",
             ("Sound effects: inside the scored soundtrack" if str(mix.get('music', '')).startswith('scored')
              else f"Sound effects: {mix.get('sfx_events', 0)} events (procedural, original)")]
    if board.get("unverified_claims"):
        lines += ["", "## Unverified claims to check before publishing", *[f"- {c}" for c in board["unverified_claims"]]]
    project.p(report_name).write_text("\n".join(lines) + "\n", encoding="utf-8")
    return passed, failed

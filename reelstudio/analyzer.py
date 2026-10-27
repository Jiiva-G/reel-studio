"""Reel analysis: Groq transcript + Gemini visual analysis -> Markdown report.
Optionally also extracts the reel's creative structure (reference_analysis.json)."""
from __future__ import annotations

import json
import shutil
from pathlib import Path

from . import gemini, groq_audio, media
from .credentials import MissingKeyError, redact

VISUAL_PROMPT = """You are analysing a short vertical social video (Instagram Reel). Watch the whole video.
Report in Markdown with these numbered sections:
1. Overall topic and purpose.
2. Scene-by-scene breakdown with MM:SS timestamps (start-end) for each scene.
3. Visible on-screen text and captions, verbatim, with timestamps.
4. Code snippets, commands, terminal output and UI demonstrations. Transcribe code exactly in fenced code blocks.
5. Technical concepts shown and how they are explained visually.
6. Important visual transitions, examples and demonstrations.
7. Unclear content: any text too small/blurry to read. Write [unclear] instead of guessing.
8. Key takeaways and practical lessons.
Rules: describe only what is visible. Never invent code, numbers or text. If a timestamp is uncertain, prefix it with ~."""

FRAMES_NOTE = ("NOTE: You are seeing still frames sampled from the video, not the full video. "
               "Events between frames are not visible to you; say so where relevant.\n\n")

REPORT_PROMPT = """You are writing a detailed, easy-to-understand analysis report of an Instagram Reel.
Inputs below: video metadata, a visual analysis of the video, and the audio transcript (original language; may be
Tamil, English or Tanglish, possibly imperfect ASR). Do not translate the transcript in place, but you may explain
its meaning in English.

Write Markdown with EXACTLY these level-2 headings in this order:
## 1. Reel Overview
## 2. Full Audio Transcript
## 3. Scene-by-Scene Explanation
## 4. On-Screen Text and Code
## 5. Simple Explanation
## 6. Technical Deep Dive
## 7. Accuracy Review
## 8. Important Takeaways
## 9. Content Improvement Suggestions
## 10. Limitations

Under heading 2 write only the single line {{TRANSCRIPT}} (it will be replaced with the verbatim transcript).
Section 3: link narration to scenes by timestamp where both have reliable timestamps; say when alignment is approximate.
Section 7: split into "Verified problems" (demonstrably wrong/incomplete from what is shown) and "Possible concerns
(verify)". Consider production readiness, security, outdated APIs.
Section 9: cover hook (first 1-3 s), pacing, clarity, examples and ending/CTA.
Section 10: list missing audio, unreadable text, uncertain timestamps, frame-only coverage, ASR uncertainty.
Never invent spoken words, code, timestamps, metrics or facts. Mark uncertainty explicitly."""

REFERENCE_PROMPT = """Analyse this Instagram Reel as a CREATIVE REFERENCE for producing new, original reels in a
similar style. Describe structure and style, not content to copy. Timestamps in seconds. Colors as hex estimates.
Only describe what you can observe; use "unknown" when unsure. Audio transcript (may be imperfect) is included."""

REFERENCE_SCHEMA = {
    "type": "object",
    "properties": {
        "duration_s": {"type": "number"},
        "hook": {"type": "object", "properties": {
            "first_3s": {"type": "string"}, "technique": {"type": "string"}, "effectiveness": {"type": "string"}},
            "required": ["first_3s", "technique", "effectiveness"]},
        "scenes": {"type": "array", "items": {"type": "object", "properties": {
            "start_s": {"type": "number"}, "end_s": {"type": "number"}, "purpose": {"type": "string"},
            "visual": {"type": "string"}, "on_screen_text": {"type": "string"}, "composition": {"type": "string"},
            "motion": {"type": "string"}, "transition_out": {"type": "string"}},
            "required": ["start_s", "end_s", "purpose", "visual"]}},
        "visual_hierarchy": {"type": "string"},
        "typography": {"type": "string"},
        "color_palette": {"type": "array", "items": {"type": "object", "properties": {
            "hex": {"type": "string"}, "role": {"type": "string"}}, "required": ["hex", "role"]}},
        "transitions": {"type": "array", "items": {"type": "string"}},
        "motion_graphics": {"type": "string"},
        "animation_style": {"type": "string"},
        "camera_movement": {"type": "string"},
        "pacing": {"type": "object", "properties": {
            "approx_cuts": {"type": "integer"}, "avg_shot_s": {"type": "number"}, "notes": {"type": "string"}},
            "required": ["notes"]},
        "voice_delivery": {"type": "string"},
        "music_mood": {"type": "string"},
        "sound_effects": {"type": "array", "items": {"type": "string"}},
        "subtitles": {"type": "string"},
        "ending_cta": {"type": "string"},
        "strengths": {"type": "array", "items": {"type": "string"}},
        "weaknesses": {"type": "array", "items": {"type": "string"}},
        "style_summary": {"type": "string"},
    },
    "required": ["duration_s", "hook", "scenes", "typography", "color_palette", "pacing", "style_summary",
                 "ending_cta", "strengths", "weaknesses"],
}


def _fallback_report(info: dict, transcript_md: str | None, visual_md: str | None, problems: list[str]) -> str:
    out = ["# Reel Analysis (partial)", "", "## 1. Reel Overview",
           f"Duration: {info['duration']:.1f}s, {info['width']}x{info['height']}.", "",
           "## 2. Full Audio Transcript", transcript_md or "_Not available._", ""]
    if visual_md:
        out += ["## Visual Analysis (Gemini)", visual_md, ""]
    out += ["## 10. Limitations", *[f"- {p}" for p in problems],
            "- The combined sections (simple explanation, deep dive, accuracy review, suggestions) were not "
            "generated because a required API step failed."]
    return "\n".join(out) + "\n"


def write_reference_storyboard(ref: dict, out: Path) -> Path:
    lines = ["# Reference Reel — Creative Storyboard", "",
             f"**Style summary:** {ref.get('style_summary', '')}", "",
             f"**Hook (first 3 s):** {ref['hook'].get('first_3s', '')} — *{ref['hook'].get('technique', '')}*", "",
             "| # | Time | Purpose | Visual | On-screen text | Motion / transition |", "|---|---|---|---|---|---|"]
    for i, s in enumerate(ref.get("scenes", []), 1):
        cell = lambda v: str(v or "").replace("|", "\\|").replace("\n", " ")
        lines.append(f"| {i} | {s['start_s']:.1f}–{s['end_s']:.1f}s | {cell(s.get('purpose'))} | {cell(s.get('visual'))} "
                     f"| {cell(s.get('on_screen_text'))} | {cell(s.get('motion'))} / {cell(s.get('transition_out'))} |")
    palette = ", ".join(f"`{c['hex']}` {c['role']}" for c in ref.get("color_palette", []))
    lines += ["", f"**Palette (estimated):** {palette}", f"**Typography:** {ref.get('typography', '')}",
              f"**Pacing:** {ref.get('pacing', {}).get('notes', '')}", f"**Music mood:** {ref.get('music_mood', '')}",
              f"**Subtitles:** {ref.get('subtitles', '')}", f"**Ending / CTA:** {ref.get('ending_cta', '')}", "",
              "**Strengths:**", *[f"- {x}" for x in ref.get("strengths", [])],
              "", "**Weaknesses:**", *[f"- {x}" for x in ref.get("weaknesses", [])]]
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return out


def run(video: Path, output_dir: Path, audio: bool = True, visual: bool = True, keep_temp: bool = False,
        language: str | None = None, reference: bool = False, log=print) -> int:
    """Returns process exit code: 0 ok, 2 partial failure, 1 total failure."""
    log("Checking input video")
    media.require_ffmpeg()
    video = media.validate_video(video)
    info = media.probe(video)
    output_dir.mkdir(parents=True, exist_ok=True)
    tmp = output_dir / "_tmp"
    tmp.mkdir(exist_ok=True)
    problems: list[str] = []
    transcript, transcript_md, visual_md, frames_only_used = None, None, None, False
    (output_dir / "video_info.json").write_text(json.dumps({**info, "path": str(video)}, indent=2), encoding="utf-8")

    try:
        # ---- Audio ----
        if audio:
            try:
                transcript = groq_audio.transcribe_video(video, tmp, language=language, log=log)
                transcript_md = groq_audio.format_transcript(transcript)
                (output_dir / "transcript.txt").write_text(transcript_md, encoding="utf-8")
                (output_dir / "transcript.json").write_text(json.dumps(transcript, ensure_ascii=False, indent=2),
                                                            encoding="utf-8")
                if transcript.get("note"):
                    problems.append(transcript["note"])
            except (groq_audio.TranscriptionError, MissingKeyError, media.MediaError) as e:
                problems.append(f"Audio transcription failed: {redact(e)}")
                log(f"!! Audio transcription failed: {redact(e)}")

        # ---- Visual ----
        c = model = uploaded = None
        if visual or reference:
            try:
                c = gemini.client()
                model, why = gemini.pick_model(c, "video")
                log(f"Gemini model: {model} ({why})")
                (output_dir / "models.json").write_text(json.dumps(
                    {"gemini": model, "gemini_reason": why, "groq": transcript and transcript.get("model")}, indent=2),
                    encoding="utf-8")
                try:
                    uploaded = gemini.upload_video(c, video, log=log)
                    contents_video = [uploaded]
                except gemini.GeminiError as e:
                    log(f"!! Video upload failed ({e}); falling back to sampled frames")
                    problems.append(f"Direct video upload failed ({e}); analysis used sampled still frames only, "
                                    "so events between frames may be missed.")
                    frames = media.extract_frames(video, tmp / "frames", every_s=2.0)
                    contents_video = gemini.frames_as_parts(frames)
                    frames_only_used = True
                if visual:
                    log("Analyzing visual scenes")
                    prompt = (FRAMES_NOTE if frames_only_used else "") + VISUAL_PROMPT
                    visual_md = gemini.generate(c, model, contents_video + [prompt], temperature=0.2)
                    (output_dir / "visual_analysis.md").write_text(visual_md, encoding="utf-8")
                if reference:
                    log("Extracting creative structure from reference")
                    tr_text = transcript_md or "(no transcript available)"
                    ref_json = gemini.generate(c, model, contents_video + [REFERENCE_PROMPT, "TRANSCRIPT:\n" + tr_text],
                                               schema=REFERENCE_SCHEMA, temperature=0.2)
                    ref = json.loads(ref_json)
                    ref["_source"] = {"video": str(video), "frames_only": frames_only_used, "model": model}
                    (output_dir / "reference_analysis.json").write_text(json.dumps(ref, ensure_ascii=False, indent=2),
                                                                        encoding="utf-8")
                    write_reference_storyboard(ref, output_dir / "reference_storyboard.md")
            except (gemini.GeminiError, MissingKeyError, media.MediaError, json.JSONDecodeError) as e:
                problems.append(f"Visual analysis failed: {redact(e)}")
                log(f"!! Visual analysis failed: {redact(e)}")
            finally:
                if c and uploaded:
                    gemini.delete_file(c, uploaded)

        # ---- Combined report ----
        log("Combining results")
        report = None
        if c and model and (visual_md or transcript_md):
            meta = (f"Duration: {info['duration']:.1f}s; resolution {info['width']}x{info['height']}; "
                    f"has audio: {info['has_audio']}.")
            if frames_only_used:
                meta += " Visual analysis was based on sampled frames only."
            if not visual:
                meta += " Visual analysis was skipped by the user (--audio-only)."
            try:
                report = gemini.generate(c, model, [
                    REPORT_PROMPT, "METADATA:\n" + meta,
                    "KNOWN PROBLEMS:\n" + ("\n".join(problems) or "none"),
                    "VISUAL ANALYSIS:\n" + (visual_md or "(not available)"),
                    "TRANSCRIPT:\n" + (transcript_md or "(not available)")], temperature=0.3)
                tr_block = f"```text\n{transcript_md.strip()}\n```" if transcript_md else "_No transcript available._"
                if "{{TRANSCRIPT}}" in report:
                    report = report.replace("{{TRANSCRIPT}}", tr_block)
                else:
                    report += "\n\n## Appendix: Full Audio Transcript\n" + tr_block
            except gemini.GeminiError as e:
                problems.append(f"Report synthesis failed: {redact(e)}")
        if report is None:
            report = _fallback_report(info, transcript_md, visual_md, problems)
        log("Saving reports")
        (output_dir / "analysis.md").write_text(report, encoding="utf-8")
    finally:
        if not keep_temp:
            shutil.rmtree(tmp, ignore_errors=True)

    wanted = int(audio) + int(visual or reference)
    failed = sum(1 for p in problems if "failed" in p.lower())
    if problems:
        log("Completed with problems:\n  - " + "\n  - ".join(problems))
    log(f"Report: {output_dir / 'analysis.md'}")
    return 1 if wanted and failed >= wanted else (2 if failed else 0)

"""Stage orchestration with caching/resume."""
from __future__ import annotations

import json
import shutil
from pathlib import Path

from .. import analyzer
from ..credentials import redact
from . import qa, render, script, sound, timeline, voice
from .project import STAGES, Project


class StageError(RuntimeError):
    pass


def stage_reference(project: Project, log=print) -> None:
    ref = project.state.get("reference")
    if not ref:
        log("No reference reel; using the brand's default style")
        project.mark("reference", "skipped")
        return
    ref_dir = project.dir / "reference"
    video = Path(ref["video"]) if ref.get("video") else None
    if not video or not video.exists():
        raise StageError("Reference video not found. Reference reels must be local video files you have the right "
                         "to use; URLs are not downloaded.")
    code = analyzer.run(video, ref_dir, audio=True, visual=True, reference=True, log=log)
    if not (ref_dir / "reference_analysis.json").exists():
        project.mark("reference", "failed")
        raise StageError("Reference analysis failed (see messages above). Fix, or remove the reference and continue.")
    project.mark("reference", "done", partial=code == 2)


def stage_script(project: Project, log=print) -> dict:
    content = (project.dir / "content.md").read_text(encoding="utf-8")
    board = script.generate(project, content, log=log)
    project.write_json("storyboard.json", board)
    script.write_docs(project, board)
    project.mark("script", "done")
    return board


def stage_validate(project: Project, log=print) -> dict:
    board = load_board(project)
    board = script.finalize(board, project.brand) if any("id" not in s for s in board["scenes"]) else board
    errs, warns = script.validate(board)
    project.write_json("validation.json", {"errors": errs, "warnings": warns})
    for w in warns:
        log(f"  warning: {w}")
    for e in errs:
        log(f"  ERROR: {e}")
    if errs:
        project.mark("validate", "failed", errors=len(errs))
        raise StageError(f"Storyboard has {len(errs)} error(s). Edit storyboard.json and run the 'validate' stage again.")
    project.write_json("storyboard.json", board)
    script.write_docs(project, board)
    project.mark("validate", "done", warnings=len(warns))
    return board


def outputs(board: dict) -> dict:
    """Output file names; a storyboard can version them so earlier renders are never overwritten."""
    o = board.get("output") or {}
    return {"video": o.get("video", "final_reel.mp4"), "cover": o.get("cover", "cover.png"),
            "report": o.get("report", "render_report.md"), "qa_dir": o.get("qa_dir", "qa")}


def load_board(project: Project) -> dict:
    board = project.load_json("storyboard.json")
    if not board:
        raise StageError("storyboard.json not found — run the 'script' stage first.")
    return board


def build_timeline(project: Project, board: dict) -> dict:
    if board.get("narration_audio"):  # one pre-recorded narration file drives the timing
        if not (project.dir / "audio" / board["narration_audio"]["path"]).exists():
            raise StageError(f"Narration audio not found: audio/{board['narration_audio']['path']}")
        tl = timeline.build_from_narration(board, project.brand.get("fps", 30))
        project.write_json("timeline.json", tl)
        project.write_json("storyboard.json", board)
        script.write_docs(project, board)
        return tl
    manifest = project.load_json("audio/voice/manifest.json") or {}
    missing = [s["id"] for s in board["scenes"] if str(s["id"]) not in manifest]
    if missing:
        raise StageError(f"Voice missing for scenes {missing} — run the 'voice' stage.")
    tl = timeline.build(board, manifest, project.brand.get("fps", 30))
    project.write_json("timeline.json", tl)
    project.write_json("storyboard.json", board)  # now carries real start/end times
    script.write_docs(project, board)
    return tl


def run(project: Project, stages: list[str], approve_api: bool = False, voice_provider: str | None = None,
        scenes: set[int] | None = None, force: bool = False, log=print) -> None:
    for st in stages:
        if st not in STAGES:
            raise StageError(f"Unknown stage '{st}'. Stages: {', '.join(STAGES)}")
        log(f"=== stage: {st} ===")
        provider = voice_provider or project.state.get("voice_provider") or project.brand.get("voice", {}).get("provider", "auto")
        needs_api = st in ("reference", "script") or (st == "voice" and provider != "none")
        if needs_api and not (st == "reference" and not project.state.get("reference")):
            project.require_approval(st, approve_api)
        try:
            if st == "reference":
                stage_reference(project, log)
            elif st == "script":
                stage_script(project, log)
            elif st == "validate":
                stage_validate(project, log)
            elif st == "voice":
                board = load_board(project)
                if board.get("narration_audio"):
                    log(f"Using uploaded narration audio/{board['narration_audio']['path']}; no TTS")
                    build_timeline(project, board)
                    project.mark("voice", "done", provider="uploaded narration")
                    continue
                project.state["voice_provider"] = provider
                project.save()
                voice.run(project, board, provider, scenes=scenes, force=force, log=log)
                build_timeline(project, board)
                project.mark("voice", "done", provider=provider)
            elif st == "sound":
                board = load_board(project)
                tl = build_timeline(project, board)
                sound.mix(project, tl, log=log)
                project.mark("sound", "done")
            elif st == "render":
                board = load_board(project)
                tl = project.load_json("timeline.json") or build_timeline(project, board)
                render.render(project, tl, board, log=log)
                project.mark("render", "done")
            elif st == "qa":
                board = load_board(project)
                passed, failed = qa.run(project, project.load_json("timeline.json"), board, log=log)
                project.mark("qa", "done" if not failed else "failed", passed=passed, failed=failed)
                log(f"QA: {passed} passed, {failed} failed — see {outputs(board)['report']}")
        except StageError:
            raise
        except Exception as e:
            project.mark(st, "failed", error=redact(e)[:500])
            raise StageError(f"Stage '{st}' failed: {redact(e)}") from None


def status(project: Project) -> str:
    lines = [f"Project: {project.dir}", f"Name: {project.state.get('name')}  Brand: {project.state.get('brand')}  "
             f"Language: {project.state.get('language')}  API approved: {project.state.get('approved_api')}"]
    if project.state.get("reference"):
        lines.append(f"Reference: {project.state['reference'].get('source')}")
    for st in STAGES:
        info = project.state.get("stages", {}).get(st)
        lines.append(f"  {st:<10} {info['status'] if info else 'pending':<8} {info.get('at', '') if info else ''}")
    board = project.load_json("storyboard.json") or {}
    o = outputs(board)
    for name in (o["video"], o["cover"], "caption.md", o["report"]):
        p = project.dir / name
        lines.append(f"  {'✓' if p.exists() else '·'} {name}")
    return "\n".join(lines)


def demo_fixture(project: Project) -> None:
    """Local demo storyboard (clearly labelled) for testing without any API."""
    src = Path(__file__).resolve().parents[2] / "examples" / "demo" / "demo_storyboard.json"
    board = json.loads(src.read_text(encoding="utf-8"))
    board = script.finalize(board, project.brand)
    project.write_json("storyboard.json", board)
    shutil.copy(src.with_name("demo_content.md"), project.dir / "content.md")
    script.write_docs(project, board)
    project.mark("reference", "skipped")
    project.mark("script", "done", source="local demo fixture")

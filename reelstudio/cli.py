"""Reel Studio: turn content into a finished 9:16 short-video MP4 (Instagram Reels, Shorts, TikTok).

Typical flow:
  reel-studio new --content notes.md --approve-api      script + storyboard (Gemini), then STOPS for review
  reel-studio run <project> --from voice                voice-over, sound, render, QA -> final_reel.mp4

From the browser editor:
  reel-studio import my-reel.reelstudio.zip             then: reel-studio run <project> --from validate

Without any API key:
  reel-studio demo                                      renders a local demo with silent placeholder narration
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

from .credentials import KNOWN_KEYS, SERVICE, key_source, redact
from .studio import bundle, narration_import, pipeline, score, voice
from .studio.project import DEFAULT_BRAND, PROJECTS, ROOT, STAGES, ApprovalNeeded, Project, load_brand

log = lambda m: print(f"[studio] {m}", flush=True)  # noqa: E731
REVIEW_STAGES = ["reference", "script", "validate"]
PRODUCE_STAGES = ["voice", "sound", "render", "qa"]
VOICES = ["auto", "sarvam", "gemini", "edge", "none"]


def cmd_new(a) -> int:
    if not a.content and not a.text:
        print("Provide --content FILE or --text TEXT", file=sys.stderr)
        return 1
    content = Path(a.content).read_text(encoding="utf-8") if a.content else a.text
    ref = Path(a.reference) if a.reference else None
    if ref and not ref.is_file():
        print("--reference must be a local video file you have the right to use (URLs are not downloaded).",
              file=sys.stderr)
        return 1
    name = a.name or (content.strip().splitlines()[0].lstrip("# ")[:40] if content.strip() else "reel")
    proj = Project.create(name, a.brand, a.language, a.duration)
    (proj.dir / "content.md").write_text(content, encoding="utf-8")
    if ref:
        dest = proj.p("reference", "reference" + ref.suffix.lower())
        shutil.copy(ref, dest)
        proj.state["reference"] = {"source": ref.name, "video": str(dest)}
    if a.voice_provider:
        proj.state["voice_provider"] = a.voice_provider
    proj.save()
    log(f"Project created: {proj.dir}")
    stages = REVIEW_STAGES + (PRODUCE_STAGES if a.produce else [])
    pipeline.run(proj, stages, approve_api=a.approve_api, log=log)
    if not a.produce:
        log("Review script.md / storyboard.md (edit storyboard.json if needed), then run:")
        log(f'  reel-studio run "{proj.dir.name}" --from voice')
    return 0


def _stages(a) -> list[str]:
    if a.only:
        return [s.strip() for s in a.only.split(",")]
    start = STAGES.index(a.from_stage) if a.from_stage else 0
    return STAGES[start:]


def cmd_run(a) -> int:
    proj = Project.resolve(a.project)
    scenes = {int(x) for x in a.scenes.split(",")} if a.scenes else None
    pipeline.run(proj, _stages(a), approve_api=a.approve_api, voice_provider=a.voice_provider, scenes=scenes,
                 force=a.force, log=log)
    print(pipeline.status(proj))
    return 0


def cmd_status(a) -> int:
    print(pipeline.status(Project.resolve(a.project)))
    return 0


def cmd_validate(a) -> int:
    pipeline.run(Project.resolve(a.project), ["validate"], log=log)
    log("Storyboard OK")
    return 0


def cmd_import(a) -> int:
    proj = bundle.import_bundle(Path(a.bundle), a.name, log=log)
    pipeline.run(proj, ["validate"], log=log)
    log("Next: render with a voice provider of your choice, e.g.")
    log(f'  reel-studio run "{proj.dir.name}" --from voice --voice-provider none     (silent, no API)')
    log(f'  reel-studio run "{proj.dir.name}" --from voice --approve-api             (TTS with your own keys)')
    return 0


def cmd_narration(a) -> int:
    proj = Project.resolve(a.project)
    if a.clear:
        narration_import.clear(proj, log=log)
    elif a.file:
        narration_import.import_wav(proj, Path(a.file), a.method, log=log)
    else:
        print("Give a narration file, or --clear.", file=sys.stderr)
        return 1
    return 0


def cmd_score(a) -> int:
    score.run(Project.resolve(a.project), a.cinetic, log=log)
    return 0


def cmd_voice_test(a) -> int:
    brand = load_brand(a.brand)
    cfg = dict(brand.get("voice", {}))
    if a.voice:
        cfg[{"edge": "edge_voice", "sarvam": "sarvam_speaker"}.get(a.provider, "gemini_voice")] = a.voice
    out = Path(a.out) if a.out else PROJECTS / "_voice_tests" / f"sample_{a.provider}.wav"
    voice.voice_test(a.text, out, a.provider, cfg, log=log, language=brand.get("language"))
    return 0


def cmd_demo(a) -> int:
    proj = Project.create("local demo fixture", a.brand, "english", None)
    pipeline.demo_fixture(proj)
    log(f"Demo project (LOCAL FIXTURE, not your content): {proj.dir}")
    provider = a.voice_provider or "none"
    pipeline.run(proj, ["validate", "voice", "sound", "render", "qa"], voice_provider=provider,
                 approve_api=provider != "none", log=log)
    print(pipeline.status(proj))
    return 0


def cmd_analyze(a) -> int:
    from . import analyzer, media

    try:
        return analyzer.run(Path(a.video), a.output_dir, audio=not a.frames_only, visual=not a.audio_only,
                            keep_temp=a.keep_temp, language=a.language, reference=a.reference,
                            log=lambda m: print(f"[analyze] {m}", flush=True))
    except media.MediaError as e:
        print(f"Error: {redact(e)}", file=sys.stderr)
        return 1


def cmd_keys(a) -> int:
    """Store keys in the OS keyring (Windows Credential Manager, macOS Keychain, Secret Service) with hidden input."""
    if not a.status and not a.delete:
        try:
            import keyring
        except ImportError:
            print("keyring is not installed; use environment variables or a .env file instead.", file=sys.stderr)
            return 1
        from getpass import getpass

        for name in KNOWN_KEYS:
            value = getpass(f"{name} (input hidden, Enter to keep the current value): ").strip()
            if value:
                keyring.set_password(SERVICE, name, value)
    elif a.delete:
        import keyring

        for name in KNOWN_KEYS:
            try:
                keyring.delete_password(SERVICE, name)
            except keyring.errors.PasswordDeleteError:
                pass
    for name in KNOWN_KEYS:
        src = key_source(name)
        print(f"{name}: {'Missing' if src == 'missing' else 'Present (' + src + ')'}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="reel-studio", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    n = sub.add_parser("new", help="create a project from content (+ optional local reference video) and draft the storyboard")
    n.add_argument("--content", help="Markdown/text file with your content")
    n.add_argument("--text", help="content as a string (alternative to --content)")
    n.add_argument("--reference", help="local reference video you have the right to use (style guidance only)")
    n.add_argument("--brand", default=DEFAULT_BRAND, help="brand name in brands/ or a path to a brand .json")
    n.add_argument("--language", choices=["english", "tamil", "tanglish"], help="default: brand language")
    n.add_argument("--duration", type=int, help="target seconds (default: brand default)")
    n.add_argument("--name", help="project name")
    n.add_argument("--voice-provider", choices=VOICES)
    n.add_argument("--produce", action="store_true", help="continue straight to render (skip the review stop)")
    n.add_argument("--approve-api", action="store_true", help="approve sending data to the AI APIs for this project")
    n.set_defaults(fn=cmd_new)

    r = sub.add_parser("run", help="run / resume stages of an existing project")
    r.add_argument("project", help="project folder name, path, or unique part of the name")
    r.add_argument("--from", dest="from_stage", choices=STAGES, help="start at this stage")
    r.add_argument("--only", help="comma-separated stages to run, e.g. voice,sound")
    r.add_argument("--scenes", help="regenerate voice only for these scene ids, e.g. 2,5 (with --force)")
    r.add_argument("--force", action="store_true", help="ignore voice cache for selected scenes")
    r.add_argument("--voice-provider", choices=VOICES)
    r.add_argument("--approve-api", action="store_true")
    r.set_defaults(fn=cmd_run)

    s = sub.add_parser("status", help="show stage status and outputs")
    s.add_argument("project")
    s.set_defaults(fn=cmd_status)

    v = sub.add_parser("validate", help="validate storyboard.json after manual edits")
    v.add_argument("project")
    v.set_defaults(fn=cmd_validate)

    i = sub.add_parser("import", help="create a project from a browser-editor bundle (.reelstudio.zip)")
    i.add_argument("bundle")
    i.add_argument("--name", help="project name (default: the bundle's)")
    i.set_defaults(fn=cmd_import)

    nr = sub.add_parser("narration", help="use your own recorded narration (WAV/FLAC) instead of TTS")
    nr.add_argument("project")
    nr.add_argument("file", nargs="?", help="your recording of the whole script (the original is never modified)")
    nr.add_argument("--method", choices=["auto", "align", "text"], default="auto",
                    help="align = match to existing TTS clips; text = script length + pauses (default: auto)")
    nr.add_argument("--clear", action="store_true", help="remove the imported narration and use TTS timing again")
    nr.set_defaults(fn=cmd_narration)

    sc = sub.add_parser("score", help="optional: score music + effects to the timeline with the cinetic skill")
    sc.add_argument("project")
    sc.add_argument("--cinetic", help="path to the cinetic skill folder (or set REEL_STUDIO_CINETIC)")
    sc.set_defaults(fn=cmd_score)

    t = sub.add_parser("voice-test", help="synthesize a short sample with the configured voice")
    t.add_argument("--provider", choices=["auto", "sarvam", "gemini", "edge"], default="auto")
    t.add_argument("--voice", help="override voice name")
    t.add_argument("--text", default="Hello! This is a quick Reel Studio voice test.")
    t.add_argument("--brand", default=DEFAULT_BRAND)
    t.add_argument("--out")
    t.set_defaults(fn=cmd_voice_test)

    d = sub.add_parser("demo", help="render the local demo (no AI APIs with --voice-provider none)")
    d.add_argument("--brand", default=DEFAULT_BRAND)
    d.add_argument("--voice-provider", choices=["none", "edge"], help="default none (silent placeholder narration)")
    d.set_defaults(fn=cmd_demo)

    an = sub.add_parser("analyze", help="analyse a local video file (Groq transcript + Gemini visuals) into a report")
    an.add_argument("video", help="path to a video you have the right to analyse (.mp4/.mov)")
    an.add_argument("--output-dir", type=Path, default=ROOT / "output", help="report directory (default: ./output)")
    mode = an.add_mutually_exclusive_group()
    mode.add_argument("--frames-only", action="store_true", help="visual analysis only; skip audio transcription")
    mode.add_argument("--audio-only", action="store_true", help="audio transcription only; skip visual analysis")
    an.add_argument("--reference", action="store_true", help="also extract creative structure (reference_analysis.json)")
    an.add_argument("--language", help="ISO-639-1 audio language hint, e.g. ta or en (default: auto-detect)")
    an.add_argument("--keep-temp", action="store_true", help="keep extracted audio/frames for debugging")
    an.set_defaults(fn=cmd_analyze)

    k = sub.add_parser("keys", help="store API keys in the OS keyring with hidden input (or show their status)")
    k.add_argument("--status", action="store_true", help="show Present/Missing only")
    k.add_argument("--delete", action="store_true", help="remove keys stored by Reel Studio from the keyring")
    k.set_defaults(fn=cmd_keys)
    return p


def main(argv=None) -> int:
    a = build_parser().parse_args(argv)
    try:
        return a.fn(a)
    except ApprovalNeeded as e:
        print(f"APPROVAL NEEDED: {e}", file=sys.stderr)
        return 3
    except (pipeline.StageError, bundle.BundleError, score.ScoreError, FileNotFoundError, FileExistsError,
            ValueError) as e:
        print(f"Error: {redact(e)}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())

"""End-to-end smoke test without any API: build a small editor bundle, import it, render it with silent
placeholder narration, then check the MP4 and the QA result. Needs Node.js (renderer/ npm ci) and FFmpeg.

    uv run python scripts/smoke_render.py [--keep]
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

BUNDLE = {
    "format": "reel-studio.bundle", "version": 1, "generator": "smoke test",
    "project": {"name": "smoke test", "language": "english", "duration_s": 12},
    "brand": {"name": "Smoke Test", "handle": "@smoketest", "cta": "Follow"},
    "storyboard": {"title": "Smoke test", "scenes": [
        {"type": "hook", "narration": "Every render is checked.", "on_screen": {"heading": "Every render is *checked*"},
         "transition": "zoom", "sfx": ["impact"]},
        {"type": "code", "narration": "Code scenes highlight syntax.",
         "on_screen": {"heading": "Code", "filename": "app.py", "language": "python",
                       "code": "def hello():\n    return 'world'"}, "transition": "slide", "sfx": ["typing"]},
        {"type": "endcard", "narration": "That's the smoke test.", "on_screen": {"heading": "All *good*", "cta": "Follow"},
         "transition": "fade"}]},
}


def run(args: list[str], env: dict) -> None:
    print("$", " ".join(args), flush=True)
    subprocess.run(args, cwd=ROOT, env=env, check=True)


def main() -> int:
    keep = "--keep" in sys.argv
    tmp = Path(tempfile.mkdtemp(prefix="reel-smoke-"))
    env = {**os.environ, "REEL_STUDIO_PROJECTS": str(tmp / "projects")}
    for k in ("GROQ_API_KEY", "GEMINI_API_KEY", "SARVAM_API_KEY"):
        env.pop(k, None)  # prove the path works without keys
    try:
        bundle = tmp / "smoke.reelstudio.zip"
        with zipfile.ZipFile(bundle, "w") as z:
            z.writestr("bundle.json", json.dumps(BUNDLE))
        py = [sys.executable, "-m", "reelstudio.cli"]
        run([*py, "import", str(bundle)], env)
        project = next((tmp / "projects").iterdir())
        run([*py, "run", str(project), "--from", "voice", "--voice-provider", "none"], env)

        video = project / "final_reel.mp4"
        info = json.loads(subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams",
                                          "-show_format", str(video)], capture_output=True, text=True, check=True).stdout)
        v = next(s for s in info["streams"] if s["codec_type"] == "video")
        a = next(s for s in info["streams"] if s["codec_type"] == "audio")
        state = json.loads((project / "project.json").read_text(encoding="utf-8"))
        checks = {
            "1080x1920": (v["width"], v["height"]) == (1080, 1920),
            "h264 yuv420p": (v["codec_name"], v["pix_fmt"]) == ("h264", "yuv420p"),
            "aac audio": a["codec_name"] == "aac",
            "duration 4-30 s": 4 <= float(info["format"]["duration"]) <= 30,
            "cover.png": (project / "cover.png").exists(),
            "QA stage passed": state["stages"]["qa"]["status"] == "done",
        }
        for name, ok in checks.items():
            print(f"{'PASS' if ok else 'FAIL'}  {name}")
        return 0 if all(checks.values()) else 1
    finally:
        if keep:
            print(f"kept: {tmp}")
        else:
            shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())

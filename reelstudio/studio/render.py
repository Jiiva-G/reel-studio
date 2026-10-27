"""Render the timeline with Remotion (React) into an H.264/AAC MP4, plus cover.png."""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

from .. import media
from .project import RENDERER, Project

WIDTH, HEIGHT = 1080, 1920


class RenderError(RuntimeError):
    pass


def gl_backend() -> str:
    """Chromium OpenGL backend for the 3D scenes: ANGLE on Windows/macOS, SwiftShader-on-ANGLE on Linux
    (works on headless servers and CI without a GPU). Override with REEL_STUDIO_GL."""
    if os.environ.get("REEL_STUDIO_GL"):
        return os.environ["REEL_STUDIO_GL"]
    return "swangle" if sys.platform.startswith("linux") else "angle"


def _npx() -> str:
    exe = shutil.which("npx.cmd") or shutil.which("npx")
    if not exe:
        raise RenderError("npx not found. Install Node.js 18+.")
    if not (RENDERER / "node_modules" / "remotion").exists():
        raise RenderError(f"Renderer dependencies missing. Run: npm ci  (in {RENDERER})")
    return exe


def brand_props(brand: dict) -> dict:
    return {"name": brand["name"], "handle": brand["handle"], "colors": brand["colors"], "cta": brand.get("cta", "Follow")}


def reel_props(project: Project, timeline: dict, audio_name: str | None, caption_style: str = "default") -> dict:
    return {"fps": timeline["fps"], "width": WIDTH, "height": HEIGHT,
            "durationInFrames": timeline["durationInFrames"], "brand": brand_props(project.brand),
            "scenes": timeline["scenes"], "captions": timeline["captions"], "audio": audio_name, "showProgress": True,
            "captionStyle": caption_style}


def _remotion(args: list[str], log=print) -> None:
    cmd = [_npx(), "remotion", *args]
    proc = subprocess.run(cmd, cwd=RENDERER, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if proc.returncode != 0:
        tail = "\n".join((proc.stderr or proc.stdout).strip().splitlines()[-25:])
        raise RenderError(f"Remotion failed (exit {proc.returncode}):\n{tail}")


def render(project: Project, timeline: dict, board: dict, log=print) -> Path:
    audio_dir = project.dir / "audio"
    has_mix = (audio_dir / "mix.wav").exists()
    from .pipeline import outputs  # local import: pipeline imports this module

    names = outputs(board)
    props_path = project.write_json("render/props.json", reel_props(project, timeline, "mix.wav" if has_mix else None,
                                                                   board.get("caption_style", "default")))
    out = project.dir / names["video"]
    tmp_out = project.dir / "render" / f"{Path(names['video']).stem}.partial.mp4"
    log(f"Rendering {timeline['durationInFrames']} frames ({timeline['duration_s']:.1f}s) with Remotion")
    _remotion(["render", "src/index.ts", "Reel", str(tmp_out), f"--props={props_path}", f"--public-dir={audio_dir}",
               "--codec=h264", "--crf=14", "--pixel-format=yuv420p", "--audio-codec=aac", "--audio-bitrate=192k",
               f"--gl={gl_backend()}", "--log=error"], log)
    # Remotion's JPEG frames yield full-range video (yuvj420p). Re-encode to TV-range yuv420p BT.709,
    # H.264 High profile with faststart: the format Instagram expects.
    log("Final encode for Instagram (H.264 High, yuv420p, BT.709, faststart)")
    media.run(["ffmpeg", "-y", "-v", "error", "-i", str(tmp_out),
               "-vf", "scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p",
               "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-profile:v", "high", "-level", "4.2",
               "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
               "-c:a", "copy", "-movflags", "+faststart", str(out)])
    tmp_out.unlink(missing_ok=True)

    cover_props = {"brand": brand_props(project.brand), "title": board.get("cover_text") or board.get("title", ""),
                   "subtitle": None, "tag": board.get("cover_tag") or (board["scenes"][0].get("on_screen") or {}).get("tag")}
    cp = project.write_json("render/cover_props.json", cover_props)
    log(f"Rendering {names['cover']}")
    _remotion(["still", "src/index.ts", "Cover", str(project.dir / names["cover"]), f"--props={cp}", f"--gl={gl_backend()}",
               "--log=error"], log)
    info = media.probe(out)
    log(f"Rendered {out} ({info['width']}x{info['height']}, {info['duration']:.2f}s)")
    return out

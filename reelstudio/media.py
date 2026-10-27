"""FFmpeg / ffprobe helpers. All commands are passed as argument lists, so
Windows paths with spaces need no quoting."""
from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path

VIDEO_EXTS = {".mp4", ".mov", ".m4v", ".webm", ".mkv"}


class MediaError(RuntimeError):
    pass


def require_ffmpeg() -> None:
    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            raise MediaError(f"{tool} not found on PATH. Install FFmpeg (e.g. `scoop install ffmpeg`).")


def run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if check and proc.returncode != 0:
        tail = "\n".join(proc.stderr.strip().splitlines()[-8:])
        raise MediaError(f"{Path(cmd[0]).name} failed (exit {proc.returncode}):\n{tail}")
    return proc


def probe(path: Path) -> dict:
    proc = run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)])
    data = json.loads(proc.stdout)
    video = next((s for s in data.get("streams", []) if s.get("codec_type") == "video"), None)
    audio = next((s for s in data.get("streams", []) if s.get("codec_type") == "audio"), None)
    fps = None
    if video and video.get("avg_frame_rate", "0/0") != "0/0":
        num, den = video["avg_frame_rate"].split("/")
        fps = round(float(num) / float(den), 3) if float(den) else None
    return {
        "duration": float(data.get("format", {}).get("duration", 0) or 0),
        "size_bytes": int(data.get("format", {}).get("size", 0) or 0),
        "has_video": video is not None,
        "has_audio": audio is not None,
        "width": video.get("width") if video else None,
        "height": video.get("height") if video else None,
        "fps": fps,
        "video_codec": video.get("codec_name") if video else None,
        "audio_codec": audio.get("codec_name") if audio else None,
        "pix_fmt": video.get("pix_fmt") if video else None,
    }


def validate_video(path: Path) -> Path:
    path = Path(path).expanduser()
    if not path.exists():
        raise MediaError(f"Video not found: {path}")
    if not path.is_file():
        raise MediaError(f"Not a file: {path}")
    if path.suffix.lower() not in VIDEO_EXTS:
        raise MediaError(f"Unsupported extension '{path.suffix}'. Expected one of: {', '.join(sorted(VIDEO_EXTS))}")
    return path.resolve()


def extract_audio(video: Path, out: Path) -> Path:
    """Mono 16 kHz MP3 at 48 kbps: small enough for transcription APIs."""
    run(["ffmpeg", "-y", "-v", "error", "-i", str(video), "-vn", "-ac", "1", "-ar", "16000",
         "-c:a", "libmp3lame", "-b:a", "48k", str(out)])
    return out


def split_audio(audio: Path, out_dir: Path, segment_s: int) -> list[tuple[float, Path]]:
    """Split into fixed-length chunks; returns (start_offset_seconds, path)."""
    out_dir.mkdir(parents=True, exist_ok=True)
    pattern = out_dir / "chunk_%03d.mp3"
    run(["ffmpeg", "-y", "-v", "error", "-i", str(audio), "-f", "segment", "-segment_time", str(segment_s),
         "-c", "copy", str(pattern)])
    chunks = sorted(out_dir.glob("chunk_*.mp3"))
    return [(i * float(segment_s), p) for i, p in enumerate(chunks)]


def extract_frames(video: Path, out_dir: Path, every_s: float, max_frames: int = 40,
                   width: int = 720) -> list[tuple[float, Path]]:
    out_dir.mkdir(parents=True, exist_ok=True)
    duration = probe(video)["duration"]
    if duration and duration / every_s > max_frames:
        every_s = duration / max_frames
    run(["ffmpeg", "-y", "-v", "error", "-i", str(video), "-vf", f"fps=1/{every_s:.4f},scale={width}:-2",
         "-q:v", "3", str(out_dir / "frame_%04d.jpg")])
    frames = sorted(out_dir.glob("frame_*.jpg"))
    # fps filter emits the first frame at t=0, then every `every_s`
    return [(round(i * every_s, 2), p) for i, p in enumerate(frames)]


def contact_sheet(video: Path, out: Path, cols: int = 4, rows: int = 3, width: int = 270) -> Path:
    duration = probe(video)["duration"] or 1
    n = cols * rows
    every = max(duration / n, 0.1)
    run(["ffmpeg", "-y", "-v", "error", "-i", str(video), "-vf",
         f"fps=1/{every:.4f},scale={width}:-2,tile={cols}x{rows}:padding=6:color=white", "-frames:v", "1", str(out)])
    return out


def grab_frame(video: Path, t: float, out: Path) -> Path:
    run(["ffmpeg", "-y", "-v", "error", "-ss", f"{t:.3f}", "-i", str(video), "-frames:v", "1", str(out)])
    return out


def audio_duration(path: Path) -> float:
    return probe(path)["duration"]


def volume_stats(path: Path) -> dict:
    proc = run(["ffmpeg", "-v", "info", "-i", str(path), "-af", "volumedetect", "-f", "null", "-"], check=False)
    mean = re.search(r"mean_volume:\s*(-?[\d.]+|-inf)", proc.stderr)
    peak = re.search(r"max_volume:\s*(-?[\d.]+|-inf)", proc.stderr)
    f = lambda m: (float("-inf") if m.group(1) == "-inf" else float(m.group(1))) if m else None
    return {"mean_db": f(mean), "max_db": f(peak)}


def silences(path: Path, noise_db: int = -40, min_s: float = 1.5) -> list[tuple[float, float]]:
    proc = run(["ffmpeg", "-v", "info", "-i", str(path), "-af", f"silencedetect=noise={noise_db}dB:d={min_s}",
                "-f", "null", "-"], check=False)
    starts = [float(x) for x in re.findall(r"silence_start:\s*(-?[\d.]+)", proc.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end:\s*(-?[\d.]+)", proc.stderr)]
    if len(ends) < len(starts):
        ends.append(audio_duration(path))
    return list(zip(starts, ends))


def black_segments(path: Path, min_s: float = 0.4) -> list[tuple[float, float]]:
    proc = run(["ffmpeg", "-v", "info", "-i", str(path), "-vf", f"blackdetect=d={min_s}:pix_th=0.08",
                "-an", "-f", "null", "-"], check=False)
    return [(float(a), float(b)) for a, b in re.findall(r"black_start:([\d.]+)\s+black_end:([\d.]+)", proc.stderr)]


def decode_errors(path: Path) -> list[str]:
    proc = run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "null", "-"], check=False)
    return [line for line in proc.stderr.splitlines() if line.strip()]

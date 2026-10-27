"""Release guard: fail if tracked files include media, recordings, renders, env files, large files or
strings that look like API keys or session cookies. Runs in CI and before every release.

    uv run python scripts/check_repo.py
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MEDIA = {".mp4", ".mov", ".m4v", ".webm", ".mkv", ".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac", ".raw"}
MAX_BYTES = 1_500_000
ALLOW_LARGE = {"renderer/package-lock.json", "apps/web/package-lock.json", "uv.lock"}
ALLOW_MEDIA = "apps/web/public/media/"  # silent demo loops rendered from examples/demo (no voice, no personal content)
SECRET = re.compile(
    r"(gsk_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_\-]{30,}|sk-[A-Za-z0-9_\-]{20,}|sk_(live|test)_[A-Za-z0-9]{16,}"
    r"|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|xox[abp]-[A-Za-z0-9-]{10,}"
    r"|-----BEGIN [A-Z ]*PRIVATE KEY-----|sessionid=[A-Za-z0-9%]{10,}|csrftoken=[A-Za-z0-9]{16,})")


def tracked() -> list[str]:
    try:
        out = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, capture_output=True, text=True, check=True).stdout
        files = [f for f in out.split("\0") if f]
        if files:
            return files
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
    skip = {".git", ".venv", "node_modules", "projects", "output", ".ruff_cache", "dist"}
    return [p.relative_to(ROOT).as_posix() for p in ROOT.rglob("*")
            if p.is_file() and not skip.intersection(p.relative_to(ROOT).parts)]


def main() -> int:
    problems = []
    for rel in tracked():
        p = ROOT / rel
        if not p.is_file():
            continue
        name = p.name.lower()
        if p.suffix.lower() in MEDIA and not rel.startswith(ALLOW_MEDIA):
            problems.append(f"media file: {rel}")
        if name == ".env" or (name.startswith(".env.") and name != ".env.example"):
            problems.append(f"env file: {rel}")
        if p.stat().st_size > MAX_BYTES and rel not in ALLOW_LARGE:
            problems.append(f"large file ({p.stat().st_size // 1024} KB): {rel}")
        if p.stat().st_size < 5_000_000:
            text = p.read_bytes().decode("utf-8", errors="ignore")
            for m in SECRET.finditer(text):
                problems.append(f"possible secret in {rel}: {m.group(0)[:8]}…")
    for line in problems:
        print("FAIL", line)
    print("check_repo: " + ("OK" if not problems else f"{len(problems)} problem(s)"))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())

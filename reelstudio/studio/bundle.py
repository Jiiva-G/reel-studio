"""Import a project bundle exported by the Reel Studio browser editor (.reelstudio.zip or bundle .json).

Bundle format (version 1), stored as `bundle.json` inside the zip:
  {"format": "reel-studio.bundle", "version": 1,
   "project": {"name", "language", "duration_s"},
   "brand": {"name", "handle", "cta", "colors": {...}, "fonts": {...}},
   "content": "optional notes/markdown",
   "storyboard": {"title", "cover_text", "caption", "hashtags", "scenes": [{"type", "narration", "subtitle",
                  "on_screen", "transition", "sfx", "music_intensity", "visual"}]}}
Only these fields are read; anything else in the file is ignored. Nothing in the zip is extracted to disk.
"""
from __future__ import annotations

import copy
import json
import zipfile
from pathlib import Path

from . import script
from .project import DEFAULT_BRAND, Project, load_brand

FORMAT = "reel-studio.bundle"
VERSION = 1
MAX_BYTES = 2 * 1024 * 1024
LANGUAGES = ("english", "tamil", "tanglish")
BRAND_COLORS = ("bg", "bg2", "surface", "text", "muted", "accent", "accent2", "codeBg", "success", "danger")
SCENE_FIELDS = ("type", "narration", "subtitle", "on_screen", "transition", "sfx", "music_intensity", "visual")


class BundleError(ValueError):
    pass


def read(path: Path) -> dict:
    path = Path(path)
    if not path.exists():
        raise BundleError(f"Bundle not found: {path}")
    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as z:
            try:
                info = z.getinfo("bundle.json")
            except KeyError:
                raise BundleError("bundle.json is missing from the zip.") from None
            if info.file_size > MAX_BYTES:
                raise BundleError("bundle.json is too large.")
            raw = z.read(info)
    else:
        if path.stat().st_size > MAX_BYTES:
            raise BundleError("Bundle file is too large.")
        raw = path.read_bytes()
    try:
        data = json.loads(raw.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        raise BundleError(f"Bundle is not valid JSON: {e}") from None
    if not isinstance(data, dict) or data.get("format") != FORMAT:
        raise BundleError(f"Not a Reel Studio bundle (expected format '{FORMAT}').")
    if data.get("version") != VERSION:
        raise BundleError(f"Unsupported bundle version {data.get('version')!r}; this Reel Studio reads version {VERSION}.")
    return data


def _hex(v) -> bool:
    return isinstance(v, str) and len(v) in (4, 7) and v.startswith("#") and all(c in "0123456789abcdefABCDEF" for c in v[1:])


def brand_from(data: dict) -> dict:
    """The default brand profile with the bundle's visual identity applied (whitelisted fields only)."""
    brand = copy.deepcopy(load_brand(DEFAULT_BRAND))
    b = data.get("brand") or {}
    for k in ("name", "handle", "cta"):
        if isinstance(b.get(k), str) and b[k].strip():
            brand[k] = b[k].strip()[:60]
    for k, v in (b.get("colors") or {}).items():
        if k in BRAND_COLORS and _hex(v):
            brand["colors"][k] = v
    if isinstance(b.get("fonts"), dict):
        brand["fonts"] = {k: str(v)[:60] for k, v in b["fonts"].items() if k in ("heading", "body", "code")}
    return brand


def storyboard_from(data: dict) -> dict:
    sb = data.get("storyboard") or {}
    scenes = sb.get("scenes")
    if not isinstance(scenes, list) or not scenes:
        raise BundleError("The bundle's storyboard has no scenes.")
    out = []
    for i, s in enumerate(scenes, 1):
        if not isinstance(s, dict):
            raise BundleError(f"Scene {i} is not an object.")
        scene = {k: copy.deepcopy(s[k]) for k in SCENE_FIELDS if k in s}
        scene.setdefault("on_screen", {})
        scene.setdefault("visual", "")
        out.append(scene)
    title = str(sb.get("title") or (data.get("project") or {}).get("name") or "Reel")[:120]
    return {"title": title, "brief": {}, "scenes": out, "instagram_caption": str(sb.get("caption") or ""),
            "hashtags": [str(h) for h in sb.get("hashtags") or []][:20], "cover_text": str(sb.get("cover_text") or title),
            "unverified_claims": [], "_meta": {"source": "browser editor bundle", "generator": data.get("generator")}}


def import_bundle(path: Path, name: str | None = None, log=print) -> Project:
    data = read(path)
    meta = data.get("project") or {}
    language = meta.get("language") if meta.get("language") in LANGUAGES else "english"
    duration = meta.get("duration_s") if isinstance(meta.get("duration_s"), (int, float)) else None
    board = storyboard_from(data)
    brand = brand_from(data)
    proj = Project.create(name or meta.get("name") or board["title"], DEFAULT_BRAND, language,
                          int(duration) if duration else None, brand_data=brand)
    content = data.get("content")
    (proj.dir / "content.md").write_text(content if isinstance(content, str) else f"# {board['title']}\n",
                                         encoding="utf-8")
    board = script.finalize(board, brand)
    proj.write_json("storyboard.json", board)
    script.write_docs(proj, board)
    proj.mark("reference", "skipped")
    proj.mark("script", "done", source="imported bundle")
    log(f"Imported {len(board['scenes'])} scenes into {proj.dir}")
    return proj

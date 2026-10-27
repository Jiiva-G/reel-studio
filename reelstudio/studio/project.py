"""Project folder layout and persisted state (project.json)."""
from __future__ import annotations

import hashlib
import json
import os
import re
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROJECTS = Path(os.environ.get("REEL_STUDIO_PROJECTS") or ROOT / "projects")
BRANDS = ROOT / "brands"
DEFAULT_BRAND = "reel-studio"
ASSETS = ROOT / "assets"
RENDERER = ROOT / "renderer"

STAGES = ["reference", "script", "validate", "voice", "sound", "render", "qa"]
# Stages that send data to a paid/external AI API (needs one-time approval per project).
API_STAGES = {"reference": "Groq (audio) + Gemini (video upload)", "script": "Gemini (your content text)",
              "voice": "Sarvam, Gemini TTS or Microsoft Edge TTS (narration text)"}


class ApprovalNeeded(RuntimeError):
    pass


def slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s[:40] or "reel"


def sha(*parts: object) -> str:
    h = hashlib.sha256()
    for p in parts:
        h.update(json.dumps(p, sort_keys=True, ensure_ascii=False).encode("utf-8"))
    return h.hexdigest()[:16]


def load_brand(name: str) -> dict:
    """A brand by name (brands/<name>.json) or by path to a JSON file."""
    path = Path(name) if name.endswith(".json") else BRANDS / f"{name}.json"
    if not path.exists():
        raise FileNotFoundError(f"Brand profile not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


class Project:
    def __init__(self, path: Path):
        self.dir = Path(path).resolve()
        self.state_file = self.dir / "project.json"
        self.state = json.loads(self.state_file.read_text(encoding="utf-8")) if self.state_file.exists() else {}

    # ---- layout ----
    def p(self, *parts: str) -> Path:
        out = self.dir.joinpath(*parts)
        out.parent.mkdir(parents=True, exist_ok=True)
        return out

    @classmethod
    def create(cls, name: str, brand: str, language: str, duration: int | None, brand_data: dict | None = None) -> "Project":
        """brand_data: a full brand profile stored with the project (brand.json) instead of brands/<brand>.json."""
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        path = PROJECTS / f"{stamp}-{slugify(name)}"
        path.mkdir(parents=True, exist_ok=False)
        proj = cls(path)
        if brand_data is not None:
            proj.write_json("brand.json", brand_data)
        b = brand_data if brand_data is not None else load_brand(brand)
        proj.state = {"name": name, "created": datetime.now().isoformat(timespec="seconds"), "brand": brand,
                      "language": language or b.get("language", "english"),
                      "duration_s": duration or b.get("default_duration_s", 45),
                      "approved_api": False, "reference": None, "stages": {}}
        proj.save()
        return proj

    @classmethod
    def resolve(cls, ref: str) -> "Project":
        cand = Path(ref)
        if not cand.is_absolute():
            cand = PROJECTS / ref if (PROJECTS / ref).exists() else cand
        if not (cand / "project.json").exists():
            matches = sorted(PROJECTS.glob(f"*{ref}*"))
            if len(matches) == 1:
                cand = matches[0]
            else:
                raise FileNotFoundError(f"Project not found: {ref}")
        return cls(cand)

    def save(self) -> None:
        self.state_file.write_text(json.dumps(self.state, ensure_ascii=False, indent=2), encoding="utf-8")

    @property
    def brand(self) -> dict:
        own = self.dir / "brand.json"
        return json.loads(own.read_text(encoding="utf-8")) if own.exists() else load_brand(self.state["brand"])

    # ---- stage bookkeeping ----
    def mark(self, stage: str, status: str, **info) -> None:
        self.state.setdefault("stages", {})[stage] = {"status": status, "at": datetime.now().isoformat(timespec="seconds"),
                                                      **info}
        self.save()

    def done(self, stage: str) -> bool:
        return self.state.get("stages", {}).get(stage, {}).get("status") == "done"

    def require_approval(self, stage: str, approve_flag: bool) -> None:
        if stage not in API_STAGES:
            return
        if approve_flag and not self.state.get("approved_api"):
            self.state["approved_api"] = True
            self.save()
        if not self.state.get("approved_api"):
            raise ApprovalNeeded(
                f"Stage '{stage}' sends data to {API_STAGES[stage]}. Free tiers may apply, otherwise usage is billed "
                f"to your API accounts. Re-run with --approve-api to approve API use for this project.")

    # ---- common files ----
    def load_json(self, name: str):
        path = self.dir / name
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None

    def write_json(self, name: str, data) -> Path:
        path = self.p(name)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        return path

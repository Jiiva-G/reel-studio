"""Content brief + timed storyboard generation (Gemini) and validation."""
from __future__ import annotations

import json
import re

from .. import gemini
from .project import Project

SCENE_TYPES = ["hook", "title", "bullets", "code", "terminal", "chat", "diagram", "compare", "stat", "quote", "endcard"]
# "custom" scenes are hand-built episode components (renderer/src/episodes); not offered to the script model.
ALL_SCENE_TYPES = SCENE_TYPES + ["custom"]
TRANSITIONS = ["fade", "slide", "zoom", "wipe", "clockwipe", "flip", "zoomthrough"]
SFX = ["whoosh", "click", "pop", "impact", "typing", "glitch", "scanner", "stamp", "chime", "rise"]
ICONS = ["user", "laptop", "server", "database", "api", "shield", "lock", "cloud", "bolt", "check", "cross", "clock",
         "code", "globe", "robot"]

# Layout limits that keep text readable at 1080x1920 inside the Instagram safe area.
LIMITS = {"heading": 52, "hook_heading": 60, "subheading": 90, "bullet": 48, "bullets": 5, "code_line": 44,
          "code_lines": 16, "terminal_line": 46, "terminal_lines": 10, "node_label": 20, "nodes": 4,
          "compare_point": 34, "compare_points": 3, "subtitle": 140, "messages": 4, "message": 80}
# on_screen fields each scene type needs (validation errors when missing).
REQUIRED = {"hook": ["heading"], "title": ["heading"], "bullets": ["bullets"], "code": ["code"],
            "terminal": ["terminal_lines"], "chat": ["messages"], "diagram": ["nodes"], "compare": ["left", "right"],
            "stat": ["value", "label"], "quote": ["quote"], "endcard": ["heading"]}


def rules() -> dict:
    """The storyboard rules shared with the browser editor (exported to schema/rules.json)."""
    return {"scene_types": SCENE_TYPES, "transitions": TRANSITIONS, "sfx": SFX, "icons": ICONS, "limits": LIMITS,
            "required": REQUIRED}

_str = {"type": "string"}
_strs = {"type": "array", "items": _str}
ON_SCREEN_SCHEMA = {"type": "object", "properties": {
    "heading": _str, "subheading": _str, "tag": _str, "bullets": _strs, "code": _str, "filename": _str,
    "language": _str, "highlight_lines": {"type": "array", "items": {"type": "integer"}}, "terminal_lines": _strs,
    "illustrative": {"type": "boolean"},
    "messages": {"type": "array", "items": {"type": "object", "properties": {
        "role": {"type": "string", "enum": ["user", "assistant"]}, "text": _str}, "required": ["role", "text"]}},
    "nodes": {"type": "array", "items": {"type": "object", "properties": {
        "label": _str, "icon": {"type": "string", "enum": ICONS}, "note": _str}, "required": ["label"]}},
    "edge_labels": _strs,
    "left": {"type": "object", "properties": {"title": _str, "points": _strs}, "required": ["title", "points"]},
    "right": {"type": "object", "properties": {"title": _str, "points": _strs}, "required": ["title", "points"]},
    "value": _str, "label": _str, "quote": _str, "cta": _str}}

STORYBOARD_SCHEMA = {
    "type": "object",
    "properties": {
        "title": _str,
        "brief": {"type": "object", "properties": {
            "core_message": _str, "target_audience": _str, "hook": _str, "key_points": _strs,
            "supporting_examples": _strs, "accuracy_requirements": _strs, "call_to_action": _str,
            "suggested_duration_s": {"type": "number"}, "language_and_tone": _str},
            "required": ["core_message", "target_audience", "hook", "key_points", "accuracy_requirements",
                         "call_to_action", "suggested_duration_s", "language_and_tone"]},
        "scenes": {"type": "array", "items": {"type": "object", "properties": {
            "type": {"type": "string", "enum": SCENE_TYPES},
            "narration": _str, "subtitle": _str, "visual": _str,
            "on_screen": ON_SCREEN_SCHEMA,
            "transition": {"type": "string", "enum": TRANSITIONS},
            "sfx": {"type": "array", "items": {"type": "string", "enum": SFX}},
            "music_intensity": {"type": "string", "enum": ["low", "medium", "high"]}},
            "required": ["type", "narration", "subtitle", "visual", "on_screen", "transition", "sfx", "music_intensity"]}},
        "instagram_caption": _str,
        "hashtags": _strs,
        "cover_text": _str,
        "unverified_claims": _strs,
    },
    "required": ["title", "brief", "scenes", "instagram_caption", "hashtags", "cover_text", "unverified_claims"],
}

LANG_RULES = {
    "tanglish": ("Narration: natural spoken Tanglish written so a TTS voice can read it — Tamil words in TAMIL SCRIPT, "
                 "English technical terms in Latin script (e.g. 'இந்த FastAPI endpoint-ஐ protect பண்ணலாம்'). "
                 "Subtitle: the same sentence in romanized Tanglish (Latin script), e.g. 'Indha FastAPI endpoint-a "
                 "protect pannalam'."),
    "tamil": "Narration: Tamil in Tamil script; keep unavoidable technical terms in English. Subtitle: same text.",
    "english": "Narration and subtitle: clear conversational English (subtitle identical to narration).",
}

SYSTEM = """You are a senior creative director and technical educator producing Instagram Reels (9:16, 1080x1920).
You write accurate, original scripts and storyboards. Rules:
- Use ONLY facts present in the provided content or that are standard, well-established technical knowledge. Never
  invent statistics, quotes, benchmarks, prices or results. List anything you are not certain of in unverified_claims.
- Code must be correct and runnable as shown; prefer short focused snippets.
- Terminal output that was not provided in the content is illustrative: set on_screen.illustrative=true.
- A reference reel analysis (if given) is STYLE guidance only (pacing, structure, hook technique). Do not copy its
  text, code, narration or visuals.
- Scene 1 must be type "hook" (problem or bold promise, under 2.5 s of narration). Last scene must be "endcard".
- One idea per scene. 1-2 short sentences of narration per scene. Match total length to the content; don't pad.
- Wrap 1-2 key words in *asterisks* inside headings for accent color.
- Text limits: heading <= 52 chars (hook heading <= 60), subheading <= 90, bullets <= 5 items of <= 48 chars,
  code <= 16 lines of <= 44 chars, terminal <= 10 lines of <= 46 chars, diagram <= 4 nodes with labels <= 20 chars,
  compare <= 3 points of <= 34 chars per side.
- Required on_screen fields per type: hook/title: heading. bullets: bullets. code: code (+filename). terminal:
  terminal_lines (commands start with "$ "; "!" lines show amber). chat: messages (<= 4, <= 80 chars, role
  user/assistant; set illustrative=true for fictional chats). diagram: nodes. compare: left+right.
  stat: value+label (value must come from the content). quote: quote. endcard: heading + cta.
- sfx: whoosh for transitions, pop for reveals, typing for code/terminal, impact for the key reveal (use sparingly).
"""


def build_prompt(content: str, language: str, duration_s: int, brand: dict, reference: dict | None) -> list[str]:
    parts = [
        f"LANGUAGE: {language}. {LANG_RULES.get(language, LANG_RULES['english'])}",
        f"TARGET DURATION: about {duration_s} seconds (shorter is fine if the content is small).",
        f"BRAND: {brand['name']} ({brand['handle']}). Style: {brand.get('style', '')}. "
        f"Intro rules: {brand.get('intro_rules', '')} Outro rules: {brand.get('outro_rules', '')} "
        f"CTA verb: {brand.get('cta', 'Follow')}.",
        "CONTENT:\n" + content.strip(),
    ]
    if reference:
        slim = {k: reference.get(k) for k in ("hook", "pacing", "scenes", "transitions", "motion_graphics",
                                              "subtitles", "ending_cta", "strengths", "weaknesses", "style_summary")}
        parts.append("REFERENCE REEL STYLE ANALYSIS (guidance only, do not copy):\n" + json.dumps(slim, ensure_ascii=False))
    parts.append("Produce the brief, scenes, Instagram caption (with line breaks, no hashtags inside), 5-12 hashtags, "
                 "and short cover_text (<= 32 chars, may use *emphasis*).")
    return parts


def generate(project: Project, content: str, log=print) -> dict:
    c = gemini.client()
    model, why = gemini.pick_model(c, "text")
    log(f"Writing script and storyboard with Gemini ({model})")
    reference = project.load_json("reference/reference_analysis.json")
    text = gemini.generate(c, model, build_prompt(content, project.state["language"], project.state["duration_s"],
                                                  project.brand, reference),
                           system=SYSTEM, schema=STORYBOARD_SCHEMA, temperature=0.6)
    board = json.loads(text)
    board["_meta"] = {"model": model, "model_reason": why, "language": project.state["language"]}
    return finalize(board, project.brand)


def finalize(board: dict, brand: dict) -> dict:
    """Number scenes and attach estimated timings (refined after voice-over)."""
    t = 0.0
    for i, s in enumerate(board["scenes"], 1):
        s["id"] = i
        s.setdefault("subtitle", s.get("narration", ""))
        s.setdefault("sfx", [])
        s.setdefault("transition", "fade")
        s.setdefault("music_intensity", "medium")
        est = estimate_seconds(s.get("narration", ""))
        s["start_s"], s["end_s"] = round(t, 2), round(t + est, 2)
        s["timing"] = "estimated"
        t += est
    board["estimated_duration_s"] = round(t, 2)
    board.setdefault("hashtags", [])
    for h in brand.get("base_hashtags", []):
        if h not in board["hashtags"]:
            board["hashtags"].append(h)
    return board


def estimate_seconds(narration: str) -> float:
    # ~14 characters/second covers English and mixed Tamil script reasonably; padding added later.
    return max(2.0, len(narration.strip()) / 14.0 + 0.6)


def validate(board: dict) -> tuple[list[str], list[str]]:
    """Return (errors, warnings). Errors block voice/render."""
    errs, warns = [], []
    scenes = board.get("scenes") or []
    if not scenes:
        return ["Storyboard has no scenes."], []
    if scenes[0].get("type") != "hook":
        warns.append("Scene 1 is not a hook.")
    if scenes[-1].get("type") != "endcard":
        warns.append("Last scene is not an endcard.")
    for s in scenes:
        sid, typ, o = s.get("id"), s.get("type"), s.get("on_screen") or {}
        tag = f"Scene {sid} ({typ})"
        if typ not in ALL_SCENE_TYPES:
            errs.append(f"{tag}: unknown type.")
            continue
        if not (s.get("narration") or "").strip():
            errs.append(f"{tag}: empty narration.")
        if len(s.get("subtitle") or "") > LIMITS["subtitle"]:
            warns.append(f"{tag}: subtitle is long ({len(s['subtitle'])} chars); it will be split into chunks.")
        for fx in s.get("sfx") or []:
            name = fx.get("name") if isinstance(fx, dict) else fx
            if name not in SFX:
                errs.append(f"{tag}: unknown sound effect '{name}'.")
        if typ == "custom":
            if not o.get("component"):
                errs.append(f"{tag}: custom scene needs on_screen.component.")
            if s.get("transition") not in TRANSITIONS:
                warns.append(f"{tag}: unknown transition, 'fade' will be used.")
            continue  # layout of custom scenes is checked visually (QA frames), not by text limits
        for field in REQUIRED[typ]:
            if not o.get(field):
                errs.append(f"{tag}: missing on_screen.{field}.")
        plain = lambda x: re.sub(r"\*", "", x or "")
        hmax = LIMITS["hook_heading"] if typ == "hook" else LIMITS["heading"]
        if len(plain(o.get("heading"))) > hmax:
            errs.append(f"{tag}: heading too long ({len(plain(o.get('heading')))} > {hmax}).")
        if len(plain(o.get("subheading"))) > LIMITS["subheading"]:
            errs.append(f"{tag}: subheading too long.")
        if len(o.get("bullets") or []) > LIMITS["bullets"]:
            errs.append(f"{tag}: more than {LIMITS['bullets']} bullets.")
        for b in o.get("bullets") or []:
            if len(plain(b)) > LIMITS["bullet"]:
                errs.append(f"{tag}: bullet too long: '{b[:30]}…'")
        code_lines = (o.get("code") or "").split("\n") if o.get("code") else []
        if len(code_lines) > LIMITS["code_lines"]:
            errs.append(f"{tag}: code has {len(code_lines)} lines (max {LIMITS['code_lines']}).")
        for ln in code_lines:
            if len(ln) > LIMITS["code_line"]:
                errs.append(f"{tag}: code line too long ({len(ln)} > {LIMITS['code_line']}): '{ln[:30]}…'")
                break
        tl = o.get("terminal_lines") or []
        if len(tl) > LIMITS["terminal_lines"]:
            errs.append(f"{tag}: too many terminal lines.")
        if any(len(x) > LIMITS["terminal_line"] for x in tl):
            warns.append(f"{tag}: a terminal line is long; it will wrap.")
        if typ == "terminal" and tl and o.get("illustrative") is None:
            warns.append(f"{tag}: terminal output not marked illustrative/real — set on_screen.illustrative.")
        msgs = o.get("messages") or []
        if len(msgs) > LIMITS["messages"]:
            errs.append(f"{tag}: more than {LIMITS['messages']} chat messages (extra ones are not rendered).")
        if any(len(m.get("text", "")) > LIMITS["message"] for m in msgs):
            errs.append(f"{tag}: a chat message is longer than {LIMITS['message']} chars.")
        if typ == "chat" and msgs and o.get("illustrative") is None:
            warns.append(f"{tag}: chat not marked illustrative/real — set on_screen.illustrative.")
        nodes = o.get("nodes") or []
        if len(nodes) > LIMITS["nodes"]:
            errs.append(f"{tag}: more than {LIMITS['nodes']} diagram nodes (extra nodes are not rendered).")
        if any(len(n.get("label", "")) > LIMITS["node_label"] for n in nodes):
            errs.append(f"{tag}: diagram node label too long.")
        for side in ("left", "right"):
            pts = (o.get(side) or {}).get("points") or []
            if len(pts) > LIMITS["compare_points"] or any(len(p) > LIMITS["compare_point"] for p in pts):
                errs.append(f"{tag}: {side} compare points exceed limits.")
        if s.get("transition") not in TRANSITIONS:
            warns.append(f"{tag}: unknown transition, 'fade' will be used.")
    if board.get("unverified_claims"):
        warns.append(f"{len(board['unverified_claims'])} unverified claim(s) listed — review before publishing.")
    return errs, warns


def _sfx_label(fx) -> str:
    return f"{fx['name']}@{fx['at']:.1f}s" if isinstance(fx, dict) else str(fx)


def write_docs(project: Project, board: dict) -> None:
    b = board.get("brief", {})
    script = [f"# {board.get('title', 'Reel')}", "", "## Content brief",
              f"- **Core message:** {b.get('core_message', '')}", f"- **Audience:** {b.get('target_audience', '')}",
              f"- **Hook:** {b.get('hook', '')}", f"- **CTA:** {b.get('call_to_action', '')}",
              f"- **Duration:** ~{b.get('suggested_duration_s', '')} s (estimated {board.get('estimated_duration_s')} s)",
              f"- **Language & tone:** {b.get('language_and_tone', '')}", "", "**Key points:**",
              *[f"- {k}" for k in b.get("key_points", [])], "", "**Accuracy requirements:**",
              *[f"- {k}" for k in b.get("accuracy_requirements", [])]]
    if board.get("unverified_claims"):
        script += ["", "**⚠ Unverified claims (check before publishing):**", *[f"- {k}" for k in board["unverified_claims"]]]
    script += ["", "## Narration", ""]
    for s in board["scenes"]:
        script += [f"**Scene {s['id']} · {s['type']}** ({s['start_s']:.1f}–{s['end_s']:.1f}s, {s.get('timing')})",
                   "", s["narration"], "", f"_Subtitle:_ {s.get('subtitle', '')}", ""]
    project.p("script.md").write_text("\n".join(script), encoding="utf-8")

    sb = [f"# Storyboard — {board.get('title', '')}", "",
          "| # | Time | Type | On-screen | Visual / motion | SFX | Music |", "|---|---|---|---|---|---|---|"]
    for s in board["scenes"]:
        o = s.get("on_screen", {})
        summary = o.get("heading") or o.get("quote") or ", ".join(o.get("bullets") or []) or (o.get("filename") or "")
        cell = lambda v: str(v or "").replace("|", "\\|").replace("\n", " ")
        sb.append(f"| {s['id']} | {s['start_s']:.1f}–{s['end_s']:.1f}s | {s['type']} | {cell(summary)} | "
                  f"{cell(s.get('visual'))} ({s.get('transition')}) | {', '.join(_sfx_label(x) for x in s.get('sfx') or [])} "
                  f"| {s.get('music_intensity')} |")
    project.p("storyboard.md").write_text("\n".join(sb) + "\n", encoding="utf-8")

    tags = " ".join(board.get("hashtags", []))
    project.p("caption.md").write_text(
        f"# Instagram caption\n\n{board.get('instagram_caption', '')}\n\n{tags}\n\n## Cover text\n\n"
        f"{board.get('cover_text', '')}\n", encoding="utf-8")

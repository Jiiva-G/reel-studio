// Port of reelstudio/studio/script.py validate(): same rules (schema/rules.json) and the same messages,
// so the editor and `reel-studio validate` agree. Each issue also names the scene and field it belongs to.
import { RULES, type Project, type Scene } from "./types";

export type Issue = { level: "error" | "warning"; scene?: number; field?: string; message: string };

const L = RULES.limits;
const plain = (s?: string) => (s ?? "").replace(/\*/g, "");

export const headingLimit = (type: string) => (type === "hook" ? L.hook_heading : L.heading);

/** Seconds of narration, as the engine estimates them before voice-over (script.estimate_seconds). */
export const estimateSeconds = (narration: string) => Math.max(2.0, narration.trim().length / 14.0 + 0.6);

export function validateScene(s: Scene, id: number): Issue[] {
  const out: Issue[] = [];
  const o = s.on_screen ?? {};
  const tag = `Scene ${id} (${s.type})`;
  const err = (message: string, field?: string) => out.push({ level: "error", scene: id, field, message: `${tag}: ${message}` });
  const warn = (message: string, field?: string) => out.push({ level: "warning", scene: id, field, message: `${tag}: ${message}` });

  if (!RULES.scene_types.includes(s.type)) {
    err("unknown type.", "type");
    return out;
  }
  if (!s.narration.trim()) err("empty narration.", "narration");
  const subtitle = s.subtitle ?? "";
  if (subtitle.length > L.subtitle) warn(`subtitle is long (${subtitle.length} chars); it will be split into chunks.`, "subtitle");
  for (const fx of s.sfx) if (!RULES.sfx.includes(fx)) err(`unknown sound effect '${fx}'.`, "sfx");
  const required = (RULES.required as Record<string, string[]>)[s.type] ?? [];
  for (const field of required) {
    const v = (o as Record<string, unknown>)[field];
    if (!v || (Array.isArray(v) && v.length === 0)) err(`missing on_screen.${field}.`, field);
  }
  const hmax = headingLimit(s.type);
  if (plain(o.heading).length > hmax) err(`heading too long (${plain(o.heading).length} > ${hmax}).`, "heading");
  if (plain(o.subheading).length > L.subheading) err("subheading too long.", "subheading");
  if ((o.bullets ?? []).length > L.bullets) err(`more than ${L.bullets} bullets.`, "bullets");
  for (const b of o.bullets ?? []) if (plain(b).length > L.bullet) err(`bullet too long: '${b.slice(0, 30)}…'`, "bullets");
  const codeLines = o.code ? o.code.split("\n") : [];
  if (codeLines.length > L.code_lines) err(`code has ${codeLines.length} lines (max ${L.code_lines}).`, "code");
  const longLine = codeLines.find((ln) => ln.length > L.code_line);
  if (longLine) err(`code line too long (${longLine.length} > ${L.code_line}): '${longLine.slice(0, 30)}…'`, "code");
  const tl = o.terminal_lines ?? [];
  if (tl.length > L.terminal_lines) err("too many terminal lines.", "terminal_lines");
  if (tl.some((x) => x.length > L.terminal_line)) warn("a terminal line is long; it will wrap.", "terminal_lines");
  if (s.type === "terminal" && tl.length && o.illustrative === undefined)
    warn("terminal output not marked illustrative/real — set on_screen.illustrative.", "illustrative");
  const msgs = o.messages ?? [];
  if (msgs.length > L.messages) err(`more than ${L.messages} chat messages (extra ones are not rendered).`, "messages");
  if (msgs.some((m) => m.text.length > L.message)) err(`a chat message is longer than ${L.message} chars.`, "messages");
  if (s.type === "chat" && msgs.length && o.illustrative === undefined)
    warn("chat not marked illustrative/real — set on_screen.illustrative.", "illustrative");
  const nodes = o.nodes ?? [];
  if (nodes.length > L.nodes) err(`more than ${L.nodes} diagram nodes (extra nodes are not rendered).`, "nodes");
  if (nodes.some((n) => n.label.length > L.node_label)) err("diagram node label too long.", "nodes");
  for (const side of ["left", "right"] as const) {
    const pts = o[side]?.points ?? [];
    if (pts.length > L.compare_points || pts.some((p) => p.length > L.compare_point)) err(`${side} compare points exceed limits.`, side);
  }
  if (!RULES.transitions.includes(s.transition)) warn("unknown transition, 'fade' will be used.", "transition");
  return out;
}

export function validateProject(p: Project): Issue[] {
  if (!p.scenes.length) return [{ level: "error", message: "Storyboard has no scenes." }];
  const out: Issue[] = [];
  if (p.scenes[0].type !== "hook") out.push({ level: "warning", scene: 1, message: "Scene 1 is not a hook." });
  if (p.scenes[p.scenes.length - 1].type !== "endcard")
    out.push({ level: "warning", scene: p.scenes.length, message: "Last scene is not an endcard." });
  p.scenes.forEach((s, i) => out.push(...validateScene(s, i + 1)));
  return out;
}

export const counts = (issues: Issue[]) => ({
  errors: issues.filter((i) => i.level === "error").length,
  warnings: issues.filter((i) => i.level === "warning").length,
});

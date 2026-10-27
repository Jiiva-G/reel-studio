import React from "react";
import { Icon } from "./ui";
import { estimateSeconds, headingLimit, type Issue } from "../lib/validate";
import { blankScene } from "../lib/samples";
import { RULES, type OnScreen, type Scene, type SceneType } from "../lib/types";

const L = RULES.limits;
const LABEL: Record<string, string> = {
  hook: "Hook", title: "Title", bullets: "Bullets", code: "Code", terminal: "Terminal", chat: "Chat", diagram: "Diagram",
  compare: "Compare", stat: "Stat", quote: "Quote", endcard: "End card",
};
const TRANSITION: Record<string, string> = { fade: "Fade", slide: "Slide", zoom: "Zoom", wipe: "Wipe", clockwipe: "Clock wipe", flip: "Flip", zoomthrough: "Zoom through" };
// on_screen fields each template renders (renderer/src/components/Scenes.tsx)
const FIELDS: Record<string, (keyof OnScreen)[]> = {
  hook: ["tag", "heading", "subheading"], title: ["tag", "heading", "subheading"], bullets: ["heading", "bullets"],
  code: ["heading", "subheading", "filename", "language", "code", "highlight_lines"], terminal: ["heading", "subheading", "filename", "terminal_lines", "illustrative"],
  chat: ["heading", "subheading", "filename", "messages", "illustrative"], diagram: ["heading", "nodes", "edge_labels"],
  compare: ["heading", "left", "right"], stat: ["heading", "value", "label"], quote: ["heading", "subheading", "quote"], endcard: ["heading", "subheading", "cta"],
};
const LANGS = ["python", "javascript", "typescript", "bash", "json", "yaml", "sql", "go", "rust", "java", "text"];
export const typeLabel = (t: string) => LABEL[t] ?? t;

type Props = { scene: Scene; index: number; total: number; issues: Issue[]; onChange: (fn: (s: Scene) => void, key: string) => void;
  onMove: (dir: -1 | 1) => void; onDuplicate: () => void; onDelete: () => void; start: number; seconds: number };

const fieldIssue = (issues: Issue[], f: string) => issues.find((i) => i.field === f);

const Counter: React.FC<{ n: number; max: number }> = ({ n, max }) => <span className="num" style={n > max ? { color: "var(--negative)" } : undefined}>{n} / {max}</span>;

export const SceneEditor: React.FC<Props> = ({ scene, index, total, issues, onChange, onMove, onDuplicate, onDelete, start, seconds }) => {
  const o = scene.on_screen;
  const set = (k: keyof OnScreen, v: unknown) => onChange((s) => { (s.on_screen as Record<string, unknown>)[k] = v; }, `os-${scene.uid}-${k}`);
  const fields = FIELDS[scene.type] ?? ["heading"];
  const plain = (x?: string) => (x ?? "").replace(/\*/g, "").length;
  const id = (f: string) => `f-${scene.uid}-${f}`;
  const err = (f: string) => fieldIssue(issues, f);
  const hmax = headingLimit(scene.type);

  const changeType = (t: SceneType) => onChange((s) => {
    const fresh = blankScene(t).on_screen as Record<string, unknown>;
    const keep = s.on_screen as Record<string, unknown>;
    for (const k of Object.keys(fresh)) if (keep[k] !== undefined && keep[k] !== "") fresh[k] = keep[k];
    if (keep.heading) fresh.heading = keep.heading;
    s.type = t;
    s.on_screen = fresh as OnScreen;
  }, `type-${scene.uid}`);

  const strList = (k: "bullets" | "terminal_lines" | "edge_labels", max: number, lineMax: number, label: string) => {
    const xs = (o[k] as string[] | undefined) ?? [];
    return (
      <div className="field" key={k}>
        <span className="lbl" id={id(k)}>{label}</span>
        <div className="list-ed" role="group" aria-labelledby={id(k)}>
          {xs.map((x, i) => (
            <div className="item" key={i}>
              <input className={`input${k === "terminal_lines" ? " mono" : ""}`} value={x} aria-label={`${label} ${i + 1}`} aria-invalid={x.replace(/\*/g, "").length > lineMax}
                onChange={(e) => onChange((s) => { ((s.on_screen[k] as string[]) ??= [])[i] = e.target.value; }, `os-${scene.uid}-${k}-${i}`)} />
              <button className="icon-btn" aria-label={`Remove ${label.toLowerCase()} ${i + 1}`} onClick={() => onChange((s) => { (s.on_screen[k] as string[]).splice(i, 1); }, `rm-${k}`)}><Icon name="x" /></button>
            </div>
          ))}
          <button className="link-btn" disabled={xs.length >= max} onClick={() => onChange((s) => { ((s.on_screen[k] as string[]) ??= []).push(k === "terminal_lines" ? "$ " : ""); }, `add-${k}`)}>
            + Add {xs.length >= max ? `(max ${max})` : ""}</button>
        </div>
        <div className="hint"><span>{k === "terminal_lines" ? "Commands start with \"$ \"; lines starting with \"!\" are highlighted." : `Up to ${max}, ${lineMax} characters each.`}</span>{err(k) ? <span className="over">{err(k)!.message.split(": ").slice(1).join(": ")}</span> : null}</div>
      </div>
    );
  };

  const text = (k: keyof OnScreen, label: string, max?: number, hint?: string, mono = false) => (
    <div className="field" key={k}>
      <label htmlFor={id(k)}>{label}</label>
      <input className={`input${mono ? " mono" : ""}`} id={id(k)} value={(o[k] as string) ?? ""} aria-invalid={!!err(k as string)}
        aria-describedby={`${id(k)}-h`} onChange={(e) => set(k, e.target.value)} />
      <div className="hint" id={`${id(k)}-h`}><span>{err(k as string) ? <span className="over">{err(k as string)!.message.split(": ").slice(1).join(": ")}</span> : hint}</span>{max ? <Counter n={plain(o[k] as string)} max={max} /> : null}</div>
    </div>
  );

  const render = (k: keyof OnScreen) => {
    switch (k) {
      case "heading": return text("heading", scene.type === "endcard" ? "Closing line" : "On-screen heading", hmax, "Wrap one or two words in *asterisks* for the accent colour.");
      case "subheading": return text("subheading", "Subheading (optional)", L.subheading);
      case "tag": return text("tag", "Tag (optional)", undefined, "A short label above the heading, e.g. the technology.");
      case "cta": return text("cta", "Button text", undefined, "Shown with your handle, e.g. Follow or Subscribe.");
      case "value": return text("value", "Figure", undefined, "Use a figure from your own content, never an invented one.");
      case "label": return text("label", "What the figure means");
      case "filename": return text("filename", scene.type === "chat" ? "Window title (optional)" : "File or window name (optional)", undefined, undefined, true);
      case "quote": return (
        <div className="field" key="quote"><label htmlFor={id("quote")}>Quote</label>
          <textarea className="input" id={id("quote")} rows={3} value={o.quote ?? ""} aria-invalid={!!err("quote")} onChange={(e) => set("quote", e.target.value)} /></div>);
      case "language": return (
        <div className="field" key="language"><label htmlFor={id("lang")}>Language</label>
          <select className="input" id={id("lang")} value={o.language ?? "python"} onChange={(e) => set("language", e.target.value)}>
            {LANGS.map((x) => <option key={x}>{x}</option>)}</select></div>);
      case "code": {
        const lines = (o.code ?? "").split("\n");
        return (
          <div className="field" key="code"><label htmlFor={id("code")}>Code</label>
            <textarea className="input mono" id={id("code")} rows={Math.min(16, Math.max(4, lines.length + 1))} value={o.code ?? ""} spellCheck={false}
              aria-invalid={!!err("code")} aria-describedby={`${id("code")}-h`} onChange={(e) => set("code", e.target.value)} />
            <div className="hint" id={`${id("code")}-h`}><span>{err("code") ? <span className="over">{err("code")!.message.split(": ").slice(1).join(": ")}</span> : `Up to ${L.code_lines} lines of ${L.code_line} characters, so it stays readable on a phone.`}</span><Counter n={lines.length} max={L.code_lines} /></div></div>);
      }
      case "highlight_lines": return (
        <div className="field" key="hl"><label htmlFor={id("hl")}>Highlight lines (optional)</label>
          <input className="input" id={id("hl")} inputMode="numeric" placeholder="e.g. 2, 3" value={(o.highlight_lines ?? []).join(", ")}
            onChange={(e) => set("highlight_lines", e.target.value.split(/[ ,]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0))} /></div>);
      case "bullets": return strList("bullets", L.bullets, L.bullet, "Bullets");
      case "terminal_lines": return strList("terminal_lines", L.terminal_lines, L.terminal_line, "Terminal lines");
      case "edge_labels": return strList("edge_labels", Math.max(0, (o.nodes?.length ?? 1) - 1), 20, "Arrow labels (optional)");
      case "illustrative": return (
        <div className="field" key="ill"><span className="lbl" id={id("ill")}>This output is</span>
          <div className="seg-ctl" role="group" aria-labelledby={id("ill")}>
            <button aria-pressed={o.illustrative === true} onClick={() => set("illustrative", true)}>Illustrative</button>
            <button aria-pressed={o.illustrative === false} onClick={() => set("illustrative", false)}>Real</button>
          </div>
          <p className="hint">Illustrative output is labelled on screen, so viewers know it is an example.</p></div>);
      case "messages": {
        const ms = o.messages ?? [];
        return (
          <div className="field" key="msgs"><span className="lbl" id={id("msgs")}>Messages</span>
            <div className="list-ed" role="group" aria-labelledby={id("msgs")}>
              {ms.map((m, i) => (
                <div className="item msg" key={i}>
                  <select className="input" aria-label={`Message ${i + 1} sender`} value={m.role} onChange={(e) => onChange((s) => { s.on_screen.messages![i].role = e.target.value as "user" | "assistant"; }, `msg-r-${i}`)}>
                    <option value="user">User</option><option value="assistant">Assistant</option></select>
                  <input className="input" aria-label={`Message ${i + 1}`} value={m.text} aria-invalid={m.text.length > L.message} onChange={(e) => onChange((s) => { s.on_screen.messages![i].text = e.target.value; }, `msg-${scene.uid}-${i}`)} />
                  <button className="icon-btn" aria-label={`Remove message ${i + 1}`} onClick={() => onChange((s) => { s.on_screen.messages!.splice(i, 1); }, "rm-msg")}><Icon name="x" /></button>
                </div>))}
              <button className="link-btn" disabled={ms.length >= L.messages} onClick={() => onChange((s) => { (s.on_screen.messages ??= []).push({ role: ms[ms.length - 1]?.role === "user" ? "assistant" : "user", text: "" }); }, "add-msg")}>+ Add message</button>
            </div><p className="hint">Up to {L.messages} messages of {L.message} characters.</p></div>);
      }
      case "nodes": {
        const ns = o.nodes ?? [];
        return (
          <div className="field" key="nodes"><span className="lbl" id={id("nodes")}>Boxes, top to bottom</span>
            <div className="list-ed" role="group" aria-labelledby={id("nodes")}>
              {ns.map((n, i) => (
                <div className="item node" key={i}>
                  <input className="input" aria-label={`Box ${i + 1} label`} value={n.label} placeholder="Label" aria-invalid={n.label.length > L.node_label} onChange={(e) => onChange((s) => { s.on_screen.nodes![i].label = e.target.value; }, `node-${scene.uid}-${i}`)} />
                  <select className="input" aria-label={`Box ${i + 1} icon`} value={n.icon ?? ""} onChange={(e) => onChange((s) => { s.on_screen.nodes![i].icon = e.target.value || undefined; }, `nicon-${i}`)}>
                    <option value="">No icon</option>{RULES.icons.map((x) => <option key={x}>{x}</option>)}</select>
                  <input className="input" aria-label={`Box ${i + 1} note`} value={n.note ?? ""} placeholder="Note (optional)" onChange={(e) => onChange((s) => { s.on_screen.nodes![i].note = e.target.value || undefined; }, `nnote-${scene.uid}-${i}`)} />
                  <button className="icon-btn" aria-label={`Remove box ${i + 1}`} onClick={() => onChange((s) => { s.on_screen.nodes!.splice(i, 1); }, "rm-node")}><Icon name="x" /></button>
                </div>))}
              <button className="link-btn" disabled={ns.length >= L.nodes} onClick={() => onChange((s) => { (s.on_screen.nodes ??= []).push({ label: "" }); }, "add-node")}>+ Add box</button>
            </div><p className="hint">Up to {L.nodes} boxes, labels up to {L.node_label} characters.</p></div>);
      }
      case "left": case "right": {
        const side = o[k] ?? { title: "", points: [] };
        const name = k === "left" ? "Left side" : "Right side";
        return (
          <div className="field" key={k}><span className="lbl" id={id(k)}>{name}</span>
            <div className="list-ed" role="group" aria-labelledby={id(k)}>
              <input className="input" aria-label={`${name} title`} placeholder="Title" value={side.title} onChange={(e) => onChange((s) => { (s.on_screen[k] ??= { title: "", points: [] }).title = e.target.value; }, `${k}-t-${scene.uid}`)} />
              {side.points.map((pt, i) => (
                <div className="item" key={i}>
                  <input className="input" aria-label={`${name} point ${i + 1}`} value={pt} aria-invalid={pt.length > L.compare_point} onChange={(e) => onChange((s) => { s.on_screen[k]!.points[i] = e.target.value; }, `${k}-p-${scene.uid}-${i}`)} />
                  <button className="icon-btn" aria-label={`Remove ${name.toLowerCase()} point ${i + 1}`} onClick={() => onChange((s) => { s.on_screen[k]!.points.splice(i, 1); }, `rm-${k}`)}><Icon name="x" /></button>
                </div>))}
              <button className="link-btn" disabled={side.points.length >= L.compare_points} onClick={() => onChange((s) => { (s.on_screen[k] ??= { title: "", points: [] }).points.push(""); }, `add-${k}`)}>+ Add point</button>
            </div></div>);
      }
      default: return null;
    }
  };

  const narrIssue = err("narration");
  return (
    <>
      <div className="head">
        <div><h2 style={{ fontSize: 20, lineHeight: "26px" }}>Scene {index + 1} of {total}</h2>
          <p className="muted num">{fmt(start)} – {fmt(start + seconds)} · estimated</p></div>
        <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          <button className="icon-btn" aria-label="Move scene up" disabled={index === 0} onClick={() => onMove(-1)}><Icon name="up" /></button>
          <button className="icon-btn" aria-label="Move scene down" disabled={index === total - 1} onClick={() => onMove(1)}><Icon name="down" /></button>
          <button className="btn ghost" onClick={onDuplicate}>Duplicate</button>
          <button className="btn ghost" onClick={onDelete} disabled={total <= 1}>Delete</button>
        </div>
      </div>
      {issues.length ? (
        <ul className="issues" aria-label="Problems in this scene">
          {issues.map((i, n) => <li key={n} className={i.level}><Icon name="alert" />{i.message.replace(/^Scene \d+ \([a-z]+\): /, "")}</li>)}
        </ul>
      ) : null}
      <div className="form">
        <div className="row2">
          <div className="field"><label htmlFor={id("type")}>Template</label>
            <select className="input" id={id("type")} value={scene.type} onChange={(e) => changeType(e.target.value as SceneType)}>
              {RULES.scene_types.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}</select></div>
          <div className="field"><label htmlFor={id("tr")}>Transition in</label>
            <select className="input" id={id("tr")} value={scene.transition} onChange={(e) => onChange((s) => { s.transition = e.target.value as Scene["transition"]; }, "tr")}>
              {RULES.transitions.map((t) => <option key={t} value={t}>{TRANSITION[t] ?? t}</option>)}</select></div>
        </div>
        <div className="field">
          <label htmlFor={id("narr")}>Narration</label>
          <textarea className="input" id={id("narr")} rows={3} value={scene.narration} aria-invalid={!!narrIssue} aria-describedby={`${id("narr")}-h`}
            onChange={(e) => onChange((s) => { s.narration = e.target.value; }, `narr-${scene.uid}`)} />
          <div className="hint" id={`${id("narr")}-h`}><span>{narrIssue ? <span className="over">Write what is said in this scene.</span> : "Spoken by the voice-over or by you."}</span><span className="num">About {estimateSeconds(scene.narration).toFixed(1)} s</span></div>
        </div>
        <div className="field">
          <label htmlFor={id("sub")}>Captions (optional)</label>
          <input className="input" id={id("sub")} value={scene.subtitle ?? ""} placeholder="Same as the narration"
            onChange={(e) => onChange((s) => { s.subtitle = e.target.value || undefined; }, `sub-${scene.uid}`)} />
          <p className="hint">Use this when captions differ from what is spoken, e.g. romanized Tanglish.</p>
        </div>
        {fields.map(render)}
        <div className="field"><span className="lbl" id={id("fx")}>Sound effects</span>
          <div className="chips" role="group" aria-labelledby={id("fx")}>
            {RULES.sfx.map((x) => (
              <button key={x} className="chip" aria-pressed={scene.sfx.includes(x)}
                onClick={() => onChange((s) => { s.sfx = s.sfx.includes(x) ? s.sfx.filter((y) => y !== x) : [...s.sfx, x]; }, "sfx")}>{x}</button>))}
          </div><p className="hint">Placed by the engine when it renders; the preview is silent.</p></div>
        <div className="field"><label htmlFor={id("vis")}>Visual direction (optional)</label>
          <input className="input" id={id("vis")} value={scene.visual} onChange={(e) => onChange((s) => { s.visual = e.target.value; }, `vis-${scene.uid}`)} /></div>
      </div>
    </>
  );
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;

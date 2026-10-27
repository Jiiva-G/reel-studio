import React, { useEffect, useMemo, useRef, useState } from "react";
import { go, STEPS, type Step } from "./App";
import { Preview } from "./Preview";
import { SceneEditor, typeLabel } from "./SceneEditor";
import { useEditor } from "./store";
import { Icon, Pill, useCopy, useToast } from "./ui";
import { bundleJson, download, exportBundle, projectFromBundle, slug } from "../lib/bundle";
import { blankScene, DEFAULT_BRAND, uid } from "../lib/samples";
import { deletePreset, listPresets, savePreset } from "../lib/storage";
import { sceneTimings, fmtTime } from "../lib/timeline";
import { counts, estimateSeconds, validateProject, type Issue } from "../lib/validate";
import { RULES, type Brand, type Preset, type Project, type Scene } from "../lib/types";

const STEP_LABEL: Record<Step, string> = { script: "Script", storyboard: "Storyboard", brand: "Brand", export: "Export" };

export default function Workspace({ id, step }: { id: string; step: Step }) {
  const ed = useEditor(id);
  const toast = useToast();
  const [sel, setSel] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const p = ed.project;
  const issues = useMemo(() => (p ? validateProject(p) : []), [p]);
  const times = useMemo(() => (p ? sceneTimings(p) : []), [p]);
  useEffect(() => { if (p) document.title = `${p.name} — Reel Studio`; }, [p?.name]);
  useEffect(() => { if (p && sel >= p.scenes.length) setSel(Math.max(0, p.scenes.length - 1)); }, [p, sel]);

  if (p === undefined) return <div className="center-msg">Opening the project…</div>;
  if (p === null) return (
    <main className="center-msg" id="main"><h1>Project not found</h1><p>It may have been deleted, or it was created in another browser.</p>
      <a className="btn" href="#/">Back to projects</a></main>);

  const c = counts(issues);
  const total = times.reduce((a, t) => a + t.seconds, 0);
  const sceneIssues = (i: number) => issues.filter((x) => x.scene === i + 1);
  const updateScene = (i: number) => (fn: (s: Scene) => void, key: string) => ed.update((q) => { fn(q.scenes[i]); return q; }, key);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= p.scenes.length || from === to) return;
    ed.update((q) => { const [s] = q.scenes.splice(from, 1); q.scenes.splice(to, 0, s); return q; }, `move-${Date.now()}`);
    setSel(to);
  };
  const removeScene = (i: number) => {
    ed.update((q) => { q.scenes.splice(i, 1); return q; }, `del-${Date.now()}`);
    toast({ text: `Scene ${i + 1} deleted`, action: { label: "Undo", run: ed.undo } });
  };

  return (
    <div className="ws">
      <header className="bar">
        <div className="left">
          <a className="icon-btn" href="#/" aria-label="Back to projects"><Icon name="back" /></a>
          <h1 className="pname" style={{ fontSize: 16, lineHeight: "22px", letterSpacing: 0 }}>{p.name}</h1>
          {ed.save === "error"
            ? <button className="pill save-state err" onClick={ed.retry} title="Saving failed. Click to retry.">Not saved · Retry</button>
            : <span className="pill neutral save-state" aria-live="polite">{ed.save === "saving" ? "Saving…" : "Saved locally"}</span>}
        </div>
        <nav className="center" aria-label="Steps"><div className="tabs">
          {STEPS.map((s) => (
            <a key={s} href={`#/p/${p.id}/${s}`} aria-current={s === step ? "step" : undefined}>{STEP_LABEL[s]}
              {s === "export" && c.errors ? <span className="count" aria-label={`${c.errors} errors`}>· {c.errors}</span> : null}</a>))}
        </div></nav>
        <div className="right">
          <button className="icon-btn hide-s" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!ed.canUndo} onClick={ed.undo}><Icon name="undo" /></button>
          <button className="icon-btn hide-s" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!ed.canRedo} onClick={ed.redo}><Icon name="redo" /></button>
          <span className="div hide-s" />
          <a className="btn primary" href={`#/p/${p.id}/export`}>Export</a>
        </div>
      </header>

      <div className="body">
        {step === "storyboard" ? (
          <>
            <SceneList project={p} sel={sel} onSelect={setSel} issues={issues} times={times} onMove={move}
              onAdd={() => { ed.update((q) => { q.scenes.splice(sel + 1, 0, blankScene("title")); return q; }, `add-${Date.now()}`); setSel(sel + 1); }} />
            <section className="editor" aria-label={`Scene ${sel + 1}`} id="main">
              {p.scenes[sel] ? (
                <SceneEditor key={p.scenes[sel].uid} scene={p.scenes[sel]} index={sel} total={p.scenes.length} issues={sceneIssues(sel)}
                  onChange={updateScene(sel)} onMove={(d) => move(sel, sel + d)} start={times[sel]?.from / 30} seconds={times[sel]?.seconds ?? 0}
                  onDuplicate={() => { ed.update((q) => { q.scenes.splice(sel + 1, 0, { ...structuredClone(q.scenes[sel]), uid: uid() }); return q; }, `dup-${Date.now()}`); setSel(sel + 1); }}
                  onDelete={() => removeScene(sel)} />
              ) : <div className="empty"><h2>No scenes yet</h2><button className="btn" onClick={() => ed.update((q) => { q.scenes.push(blankScene("hook")); return q; }, "add")}>Add a hook scene</button></div>}
            </section>
          </>
        ) : step === "script" ? (
          <ScriptView project={p} update={ed.update} undo={ed.undo} total={total} counts={c} onOpenScene={(i) => { setSel(i); go({ name: "project", id: p.id, step: "storyboard" }); }} />
        ) : step === "brand" ? (
          <BrandView project={p} update={ed.update} />
        ) : (
          <ExportView project={p} issues={issues} total={total} update={ed.update} onOpenScene={(i) => { setSel(i); go({ name: "project", id: p.id, step: "storyboard" }); }} />
        )}
        <Preview project={p} selected={sel} onSelect={setSel} open={previewOpen} onClose={() => setPreviewOpen(false)} />
      </div>
      <button className="btn fab" onClick={() => setPreviewOpen(true)}>Preview</button>
    </div>
  );
}

const SceneList: React.FC<{ project: Project; sel: number; onSelect: (i: number) => void; issues: Issue[]; times: { seconds: number }[];
  onMove: (from: number, to: number) => void; onAdd: () => void }> = ({ project, sel, onSelect, issues, times, onMove, onAdd }) => {
  const [over, setOver] = useState<number | null>(null);
  const drag = useRef<number | null>(null);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => { refs.current[sel]?.scrollIntoView({ block: "nearest" }); }, [sel]);
  return (
    <aside className="scenes" aria-label="Scenes">
      <h2>Scenes <span className="faint num">{project.scenes.length} · {fmtTime(times.reduce((a, t) => a + t.seconds, 0))}</span></h2>
      <div role="listbox" aria-label="Scenes. Alt+Up and Alt+Down move the selected scene." aria-activedescendant={`sc-${sel}`} id="scene-list">
        {project.scenes.map((s, i) => {
          const mine = issues.filter((x) => x.scene === i + 1);
          const bad = mine.some((x) => x.level === "error");
          const head = (s.on_screen.heading || s.on_screen.quote || s.on_screen.value || "").replace(/\*/g, "");
          return (
            <div key={s.uid} id={`sc-${i}`} ref={(el) => { refs.current[i] = el; }} className={`scene-card${over === i ? " drag-over" : ""}`} role="option"
              aria-selected={i === sel} aria-label={`Scene ${i + 1}, ${typeLabel(s.type)}${bad ? ", has errors" : mine.length ? ", has warnings" : ""}`} tabIndex={i === sel ? 0 : -1} draggable
              onClick={() => onSelect(i)}
              onKeyDown={(e) => {
                if (e.altKey && e.key === "ArrowUp") { e.preventDefault(); onMove(i, i - 1); }
                else if (e.altKey && e.key === "ArrowDown") { e.preventDefault(); onMove(i, i + 1); }
                else if (e.key === "ArrowUp" && i > 0) { e.preventDefault(); onSelect(i - 1); refs.current[i - 1]?.focus(); }
                else if (e.key === "ArrowDown" && i < project.scenes.length - 1) { e.preventDefault(); onSelect(i + 1); refs.current[i + 1]?.focus(); }
              }}
              onDragStart={(e) => { drag.current = i; e.dataTransfer.effectAllowed = "move"; }}
              onDragOver={(e) => { e.preventDefault(); setOver(i); }} onDragLeave={() => setOver(null)}
              onDrop={(e) => { e.preventDefault(); setOver(null); if (drag.current != null) onMove(drag.current, i); drag.current = null; }}>
              <span className="mini" aria-hidden="true" style={{ width: 40, height: 71, borderRadius: 4, background: project.brand.colors.bg, display: "grid", alignContent: "center", padding: 4, font: "700 7px/1.1 var(--font)", color: project.brand.colors.text, overflow: "hidden" }}>{head.slice(0, 40)}</span>
              <div><div className="t">{i + 1} · {typeLabel(s.type)}{mine.length ? <span className={`dot${bad ? " err" : ""}`} aria-label={bad ? "Has errors" : "Has warnings"} /> : null}</div>
                <div className="n">{s.narration || <em className="faint">No narration yet</em>}</div></div>
              <div className="d num">{times[i]?.seconds.toFixed(1)} s<br /><span className="grip" aria-hidden="true">⋮⋮</span></div>
            </div>
          );
        })}
      </div>
      <button className="add" onClick={onAdd}>+ Add scene after {sel + 1}</button>
    </aside>
  );
};

/* ---------------- Script ---------------- */
const groupOf = (i: number, n: number) => (i === 0 ? "Hook" : i === n - 1 ? "Call to action" : "Explain");

function aiPrompt(p: Project) {
  const L = RULES.limits;
  return `Write a storyboard for a ${p.durationTarget}-second vertical (9:16) explainer video.
Language: ${p.language}. Use ONLY facts in my notes; do not invent numbers or quotes.

My notes:
${p.content || "(paste your notes here)"}

Reply with JSON only, in this shape:
{"scenes": [{"type": "hook", "narration": "...", "on_screen": {"heading": "..."}, "transition": "zoom"}]}

Rules:
- Scene types: ${RULES.scene_types.join(", ")}. First scene "hook", last scene "endcard".
- One idea per scene, 1-2 short sentences of narration each.
- Required on_screen fields: ${Object.entries(RULES.required).map(([k, v]) => `${k}: ${v.join("+")}`).join("; ")}.
- Limits: heading <= ${L.heading} chars (hook <= ${L.hook_heading}), bullets <= ${L.bullets} of <= ${L.bullet} chars, code <= ${L.code_lines} lines of <= ${L.code_line} chars, terminal <= ${L.terminal_lines} lines, diagram <= ${L.nodes} nodes with labels <= ${L.node_label} chars, compare <= ${L.compare_points} points of <= ${L.compare_point} chars per side.
- Wrap 1-2 key words of a heading in *asterisks* for the accent colour.
- Transitions: ${RULES.transitions.join(", ")}.`;
}

const ScriptView: React.FC<{ project: Project; update: (fn: (p: Project) => Project, key?: string) => void; undo: () => void; total: number; counts: { errors: number; warnings: number }; onOpenScene: (i: number) => void }> = ({ project: p, update, undo, total, counts: c, onOpenScene }) => {
  const copy = useCopy();
  const toast = useToast();
  const [reply, setReply] = useState("");
  const n = p.scenes.length;
  const groups = (["Hook", "Explain", "Call to action"] as const).map((g) => [g, p.scenes.map((s, i) => [s, i] as const).filter(([, i]) => groupOf(i, n) === g)] as const);
  const applyReply = () => {
    try {
      const json = JSON.parse(reply.replace(/^```(json)?|```$/gm, "").trim());
      const scenes = Array.isArray(json) ? json : json.scenes;
      const tmp = projectFromBundle({ ...bundleJson(p), storyboard: { ...bundleJson(p).storyboard, scenes } });
      update((q) => { q.scenes = tmp.scenes; return q; }, `ai-${Date.now()}`);
      setReply("");
      toast({ text: `Replaced the script with ${tmp.scenes.length} scenes`, action: { label: "Undo", run: undo } });
    } catch (e) {
      toast({ text: e instanceof Error && e.message.includes("scenes") ? e.message : "That reply is not the JSON shape asked for. Check it and try again." });
    }
  };
  return (
    <section className="editor wide" aria-labelledby="sc-h" id="main">
      <div className="head"><div><h2 id="sc-h" style={{ fontSize: 20, lineHeight: "26px" }}>Script</h2>
        <p className="muted">The whole narration, scene by scene · <span className="num">{fmtTime(total)}</span> estimated · target {p.durationTarget} s</p></div>
        {c.errors ? <Pill kind="bad">{c.errors} errors</Pill> : c.warnings ? <Pill kind="warn">{c.warnings} warnings</Pill> : <Pill kind="ok">0 errors · 0 warnings</Pill>}</div>
      <div className="script-doc">
        <section><h2>Your notes</h2>
          <textarea className="input" rows={4} aria-label="Your notes" placeholder="Paste the facts and points this reel should cover." value={p.content}
            onChange={(e) => update((q) => { q.content = e.target.value; return q; }, "content")} /></section>
        {groups.map(([g, items]) => items.length ? (
          <section key={g}><h2>{g}</h2>
            {items.map(([s, i]) => (
              <div className="sline" key={s.uid}>
                <button className="k link-btn" style={{ textAlign: "left" }} onClick={() => onOpenScene(i)} aria-label={`Open scene ${i + 1} in the storyboard`}>{i + 1} · {typeLabel(s.type)}</button>
                <textarea className="input" rows={2} aria-label={`Narration, scene ${i + 1}`} value={s.narration}
                  onChange={(e) => update((q) => { q.scenes[i].narration = e.target.value; return q; }, `narr-${s.uid}`)} />
                <span className="s num">{estimateSeconds(s.narration).toFixed(1)} s</span>
              </div>))}
          </section>) : null)}
        <details className="card">
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Draft the scenes with an AI assistant</summary>
          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            <p className="muted">Reel Studio does not call any AI service. Copy this prompt into the assistant you already use, then paste its JSON reply below. Your current scenes are replaced, and Undo brings them back.</p>
            <div><button className="btn" onClick={() => copy(aiPrompt(p))}><Icon name="copy" />Copy prompt</button></div>
            <textarea className="input mono prompt-box" aria-label="Paste the assistant's JSON reply" placeholder='{"scenes": [...]}' value={reply} onChange={(e) => setReply(e.target.value)} />
            <div><button className="btn" disabled={!reply.trim()} onClick={applyReply}>Use these scenes</button></div>
          </div>
        </details>
      </div>
    </section>
  );
};

/* ---------------- Brand ---------------- */
const lum = (hex: string) => {
  const h = hex.length === 4 ? hex.replace(/#(.)(.)(.)/, "#$1$1$2$2$3$3") : hex;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const COLOR_LABEL: [keyof Brand["colors"], string][] = [["bg", "Background"], ["text", "Text"], ["accent", "Accent"], ["accent2", "Second accent"],
  ["surface", "Cards"], ["muted", "Secondary text"], ["codeBg", "Code background"], ["bg2", "Background, second tone"]];

const BrandView: React.FC<{ project: Project; update: (fn: (p: Project) => Project, key?: string) => void }> = ({ project: p, update }) => {
  const toast = useToast();
  const [presets, setPresets] = useState<Preset[]>([]);
  useEffect(() => { listPresets().then(setPresets, () => {}); }, []);
  const b = p.brand;
  const setB = (fn: (b: Brand) => void, key: string) => update((q) => { fn(q.brand); return q; }, key);
  const checks = [["Text on background", contrast(b.colors.text, b.colors.bg), 4.5], ["Accent on background", contrast(b.colors.accent, b.colors.bg), 3]] as const;
  const valid = (v: string) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);
  return (
    <section className="editor" aria-labelledby="br-h" style={{ gridColumn: "1 / 3" }} id="main">
      <div className="head"><div><h2 id="br-h" style={{ fontSize: 20, lineHeight: "26px" }}>Brand</h2><p className="muted">How your videos look. Changes show in the preview straight away.</p></div></div>
      <div className="settings">
        <div className="set-row"><div className="about"><h2>Identity</h2><p>Shown on every scene and on the end card.</p></div>
          <div className="panel">
            <div className="row2">
              <div className="field"><label htmlFor="b-name">Name</label><input className="input" id="b-name" maxLength={60} value={b.name} onChange={(e) => setB((x) => { x.name = e.target.value; }, "b-name")} /></div>
              <div className="field"><label htmlFor="b-handle">Handle</label><input className="input" id="b-handle" maxLength={60} value={b.handle} onChange={(e) => setB((x) => { x.handle = e.target.value; }, "b-handle")} /></div>
            </div>
            <div className="field"><label htmlFor="b-cta">End-card action</label><input className="input" id="b-cta" maxLength={60} value={b.cta} onChange={(e) => setB((x) => { x.cta = e.target.value; }, "b-cta")} /></div>
          </div></div>
        <div className="set-row"><div className="about"><h2>Colours</h2><p>Contrast is checked as you change them.</p></div>
          <div className="panel">
            <div className="swatches edit">
              {COLOR_LABEL.map(([k, label]) => (
                <div className="field" key={k}><label htmlFor={`c-${k}`}>{label}</label>
                  <div className="color-in">
                    <input type="color" aria-label={`${label} picker`} value={b.colors[k].length === 7 ? b.colors[k] : "#000000"} onChange={(e) => setB((x) => { x.colors[k] = e.target.value; }, `c-${k}`)} />
                    <input className="input mono" id={`c-${k}`} defaultValue={b.colors[k]} key={b.colors[k]} aria-invalid={!valid(b.colors[k])}
                      onBlur={(e) => { const v = e.target.value.trim(); if (valid(v)) setB((x) => { x.colors[k] = v.toLowerCase(); }, `c-${k}`); else { e.target.value = b.colors[k]; toast({ text: "Use a colour like #e85450" }); } }} />
                  </div></div>))}
            </div>
            {checks.map(([label, r, min]) => (
              <div className="contrast" key={label}><Pill kind={r >= min ? "ok" : "bad"}>{r.toFixed(1)} : 1</Pill>
                <span className="muted">{label} {r >= min ? "passes" : `is below ${min} : 1 and may be hard to read`}.</span></div>))}
          </div></div>
        <div className="set-row"><div className="about"><h2>Presets</h2><p>Saved in this browser. Apply one to reuse a look in any project.</p></div>
          <div className="panel"><div className="presets">
            <button className="chip" onClick={() => setB((x) => { Object.assign(x, structuredClone(DEFAULT_BRAND)); }, `preset-${Date.now()}`)}>Reel Studio default</button>
            {presets.map((pr) => (
              <span key={pr.id} style={{ display: "inline-flex" }}>
                <button className="chip" onClick={() => setB((x) => { Object.assign(x, structuredClone(pr.brand)); }, `preset-${Date.now()}`)}>{pr.name}</button>
                <button className="icon-btn" aria-label={`Delete preset ${pr.name}`} onClick={async () => { await deletePreset(pr.id); setPresets(await listPresets()); }}><Icon name="x" /></button>
              </span>))}
            <button className="chip" onClick={async () => { await savePreset({ id: uid(), name: b.name || "My brand", brand: structuredClone(b) }); setPresets(await listPresets()); toast({ text: "Preset saved" }); }}>+ Save as preset</button>
          </div>
          <p className="hint">Fonts are Space Grotesk and Inter in this version; choosing other fonts is planned.</p></div></div>
      </div>
    </section>
  );
};

/* ---------------- Export ---------------- */
const ExportView: React.FC<{ project: Project; issues: Issue[]; total: number; update: (fn: (p: Project) => Project, key?: string) => void; onOpenScene: (i: number) => void }> = ({ project: p, issues, total, update, onOpenScene }) => {
  const copy = useCopy();
  const c = counts(issues);
  const name = slug(p.name);
  const file = `${name}.reelstudio.zip`;
  const size = useMemo(() => Math.max(1, Math.round(exportBundle(p).length / 1024)), [p]);
  const cmds = [`uv run reel-studio import ${file}`, `uv run reel-studio run ${name} --from voice --voice-provider none`];
  return (
    <section className="editor" aria-labelledby="ex-h" style={{ gridColumn: "1 / 3" }} id="main">
      <div className="head"><div><h2 id="ex-h" style={{ fontSize: 20, lineHeight: "26px" }}>Export</h2><p className="muted">Download a bundle and render it on your computer. Nothing is uploaded.</p></div></div>
      <div className="export">
        <div className="card">
          <div className="check">
            <Icon name={c.errors ? "alert" : "check"} className={c.errors ? "warnc" : "okc"} style={c.errors ? { stroke: "var(--negative)" } : undefined} />
            <div><b>{c.errors ? "Fix these before exporting" : "Storyboard is valid"}</b>
              <p className="muted num">{p.scenes.length} scenes · {fmtTime(total)} estimated · {c.errors} errors · {c.warnings} warnings</p>
              {issues.length ? <ul className="issues" style={{ marginTop: 8 }}>{issues.map((i, n) => (
                <li key={n} className={i.level}><Icon name="alert" /><span>{i.message} {i.scene ? <button className="link-btn" onClick={() => onOpenScene(i.scene! - 1)}>Open scene {i.scene}</button> : null}</span></li>))}</ul> : null}</div>
            <span />
          </div>
          <div className="check"><Icon name="check" className="okc" /><div><b>Brand</b><p className="muted">{p.brand.name} · {p.brand.handle}</p></div><a className="btn ghost" href={`#/p/${p.id}/brand`}>Change</a></div>
          <div className="check"><Icon name="alert" className="warnc" /><div><b>Voice-over is chosen when you render</b><p className="muted">The commands below make a silent version. For a voice-over, use <code>--voice-provider auto --approve-api</code> with your own Gemini or Sarvam key, or record the narration yourself and run <code>reel-studio narration</code>.</p></div><span /></div>
        </div>
        <div className="card" style={{ display: "grid", gap: 16 }}>
          <h2>Post details (optional)</h2>
          <div className="field"><label htmlFor="x-cover">Cover text</label><input className="input" id="x-cover" maxLength={60} value={p.coverText} placeholder={p.name} onChange={(e) => update((q) => { q.coverText = e.target.value; return q; }, "cover")} /></div>
          <div className="field"><label htmlFor="x-cap">Caption</label><textarea className="input" id="x-cap" rows={3} value={p.caption} onChange={(e) => update((q) => { q.caption = e.target.value; return q; }, "caption")} /></div>
          <div className="field"><label htmlFor="x-tags">Hashtags</label><input className="input" id="x-tags" value={p.hashtags.join(" ")} placeholder="#webdev #python"
            onChange={(e) => update((q) => { q.hashtags = e.target.value.split(/\s+/).filter(Boolean).slice(0, 20); return q; }, "tags")} /></div>
        </div>
        <div className="card dl">
          <div><b>{file}</b><p className="muted num">bundle.json, content.md and render instructions · about {size} KB</p>
            {c.errors ? <p className="err-text">The engine refuses storyboards with errors, so download is off until they are fixed.</p> : null}</div>
          <button className="btn primary" disabled={c.errors > 0} aria-disabled={c.errors > 0} onClick={() => download(exportBundle(p), file)}><Icon name="download" />Download bundle</button>
        </div>
        <div className="card"><h2>Render it</h2>
          {cmds.map((cmd) => <div className="cmd" key={cmd}><span>{cmd}</span><button className="icon-btn" aria-label={`Copy: ${cmd}`} onClick={() => copy(cmd)}><Icon name="copy" /></button></div>)}
          <p className="muted" style={{ marginTop: 12 }}>Needs Python 3.11+, Node.js 20+ and FFmpeg. First time? <a href="https://github.com/Jiiva-G/reel-studio#install" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>Install Reel Studio</a>.</p></div>
      </div>
    </section>
  );
};

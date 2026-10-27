import React, { useCallback, useEffect, useRef, useState } from "react";
import { go } from "./App";
import { Dialog, Icon, Pill, useToast } from "./ui";
import { BundleError, download, exportBackup, importFile } from "../lib/bundle";
import { blankProject, sampleProject } from "../lib/samples";
import { deleteForever, listProjects, purgeExpired, requestPersist, saveProject, usage } from "../lib/storage";
import { sceneTimings, fmtTime } from "../lib/timeline";
import { counts, validateProject } from "../lib/validate";
import type { Project } from "../lib/types";

const when = (t: number) => {
  const d = new Date(t), now = new Date();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return `Today, ${time}`;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `Yesterday, ${time}`;
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
};
const secs = (p: Project) => sceneTimings(p).reduce((a, t) => a + t.seconds, 0);

export const NewProjectDialog: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"sample" | "blank">("sample");
  const [language, setLanguage] = useState<"english" | "tamil" | "tanglish">("english");
  const [duration, setDuration] = useState(45);
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = kind === "sample" ? sampleProject(name || undefined) : blankProject(name || "Untitled reel", language);
    p.language = language;
    p.durationTarget = duration;
    await saveProject(p);
    requestPersist();
    onClose();
    go({ name: "project", id: p.id, step: "storyboard" });
  };
  return (
    <Dialog open={open} onClose={onClose} title="New project">
      <p className="muted">You can change all of this later.</p>
      <form onSubmit={create}>
        <div className="field"><label htmlFor="np-name">Project name</label>
          <input className="input" id="np-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Rate limiting in 40 seconds" maxLength={120} autoFocus /></div>
        <div className="field"><span className="lbl" id="np-start">Start from</span>
          <div className="seg-ctl" role="group" aria-labelledby="np-start">
            <button type="button" aria-pressed={kind === "sample"} onClick={() => setKind("sample")}>Sample project</button>
            <button type="button" aria-pressed={kind === "blank"} onClick={() => setKind("blank")}>Blank</button>
          </div>
          <p className="hint">{kind === "sample" ? "A 7-scene reel about rate limiting in FastAPI that you can edit." : "A hook, one scene and an end card."}</p></div>
        <div className="row2">
          <div className="field"><label htmlFor="np-lang">Narration language</label>
            <select className="input" id="np-lang" value={language} onChange={(e) => setLanguage(e.target.value as typeof language)}>
              <option value="english">English</option><option value="tamil">Tamil</option><option value="tanglish">Tanglish</option></select></div>
          <div className="field"><label htmlFor="np-dur">Target length</label>
            <select className="input" id="np-dur" value={duration} onChange={(e) => setDuration(+e.target.value)}>
              {[15, 30, 45, 60, 90].map((s) => <option key={s} value={s}>{s} seconds</option>)}</select></div>
        </div>
        <p className="hint">Format: 9:16 vertical, 1080 × 1920. Other sizes are planned.</p>
        <div className="actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">Create project</button></div>
      </form>
    </Dialog>
  );
};

export const Dashboard: React.FC = () => {
  const toast = useToast();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [store, setStore] = useState<{ usedKB: number | null; persisted: boolean } | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [confirm, setConfirm] = useState<Project | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    purgeExpired().catch(() => {});
    listProjects().then((ps) => setProjects(ps.sort((a, b) => b.updatedAt - a.updatedAt)), (e) => setFailed(String(e?.message ?? e)));
    usage().then(setStore);
  }, []);
  useEffect(() => { document.title = "Projects — Reel Studio"; load(); }, [load]);

  const live = (projects ?? []).filter((p) => !p.deletedAt);
  const deleted = (projects ?? []).filter((p) => p.deletedAt);
  const needFix = live.filter((p) => counts(validateProject(p)).errors > 0).length;

  const remove = async (p: Project) => {
    await saveProject({ ...p, deletedAt: Date.now() });
    load();
    toast({ text: `Moved "${p.name}" to recently deleted`, action: { label: "Undo", run: async () => { await saveProject({ ...p, deletedAt: undefined }); load(); } } });
  };
  const onImport = async (file: File) => {
    try {
      const got = importFile(new Uint8Array(await file.arrayBuffer()));
      const list = Array.isArray(got) ? got : [got];
      for (const p of list) await saveProject(p);
      toast({ text: list.length === 1 ? `Imported "${list[0].name}"` : `Restored ${list.length} projects` });
      load();
    } catch (e) {
      toast({ text: e instanceof BundleError ? e.message : "That file could not be read." });
    }
  };
  const backup = () => {
    if (!live.length) return toast({ text: "There are no projects to back up yet." });
    download(exportBackup(live), `reel-studio-backup-${new Date().toISOString().slice(0, 10)}.zip`);
  };

  return (
    <div className="shell">
      <aside className="side">
        <a className="brand" href="/" aria-label="Reel Studio home"><i></i>Reel Studio</a>
        <nav className="nav" aria-label="Main">
          <a href="#/" aria-current="page"><Icon name="grid" />Projects</a>
          <a href="https://github.com/Jiiva-G/reel-studio#install" target="_blank" rel="noreferrer"><Icon name="doc" />Render guide</a>
        </nav>
        <div className="bottom">
          <div className="store">Stored in this browser only<br />
            <b className="num">{live.length} project{live.length === 1 ? "" : "s"}{store?.usedKB != null ? ` · ${store.usedKB.toLocaleString()} KB` : ""}</b><br />
            {store?.persisted ? "Protected from automatic clean-up." : "Not synced to any server. Back up regularly."}</div>
          <button className="btn ghost" onClick={backup}><Icon name="download" />Back up all projects</button>
        </div>
      </aside>

      <main className="canvas" id="main">
        <div className="title-row">
          <div><h1>Projects</h1>
            <p>{projects == null ? "Loading…" : `${live.length} project${live.length === 1 ? "" : "s"} in this browser${needFix ? ` · ${needFix} need${needFix === 1 ? "s" : ""} fixes before export` : ""}`}</p></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => fileRef.current?.click()}><Icon name="upload" />Import</button>
            <input ref={fileRef} type="file" accept=".zip,.json,application/zip,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onImport(f); }} />
            <button className="btn primary" onClick={() => setNewOpen(true)}>New project</button>
          </div>
        </div>

        {failed ? (
          <div className="empty" role="alert"><h2>Browser storage is unavailable</h2>
            <p className="muted">{failed} Private windows and some browser settings block storage. Projects cannot be saved until it is available.</p>
            <button className="btn" onClick={() => location.reload()}>Try again</button></div>
        ) : projects == null ? null : live.length === 0 ? (
          <div className="empty">
            <h2>Make your first reel</h2>
            <p className="muted">Start from the sample (a 7-scene reel you can edit) or a blank project. Everything stays in this browser until you export it.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn primary" onClick={async () => { const p = sampleProject(); await saveProject(p); requestPersist(); go({ name: "project", id: p.id, step: "storyboard" }); }}>Start from the sample</button>
              <button className="btn" onClick={() => setNewOpen(true)}>Blank project</button>
            </div>
          </div>
        ) : (
          <div className="projects" role="table" aria-label="Projects">
            <div className="phead" role="row"><span role="columnheader"></span><span role="columnheader">Project</span><span className="r" role="columnheader">Scenes</span><span className="r" role="columnheader">Length</span><span className="r" role="columnheader">Edited</span><span className="r" role="columnheader">Check</span><span role="columnheader"><span className="sr">Actions</span></span></div>
            {live.map((p) => {
              const c = counts(validateProject(p));
              const head = p.scenes[0]?.on_screen.heading ?? p.name;
              return (
                <div className="prow" role="row" key={p.id} onClick={() => go({ name: "project", id: p.id, step: "storyboard" })}>
                  <span className="thumb" style={{ background: p.brand.colors.bg }} aria-hidden="true"><span style={{ color: p.brand.colors.text }}>{head.split(/\*([^*]+)\*/).map((part, i) => i % 2 ? <em key={i} style={{ color: p.brand.colors.accent }}>{part}</em> : part)}</span></span>
                  <span role="cell"><a className="name" href={`#/p/${p.id}/storyboard`} onClick={(e) => e.stopPropagation()}>{p.name}</a><span className="sub m">{p.scenes.length} scenes · {fmtTime(secs(p))} · {when(p.updatedAt)}</span></span>
                  <span className="r num c-scenes" role="cell">{p.scenes.length}</span>
                  <span className="r num c-len" role="cell">{fmtTime(secs(p))}</span>
                  <span className="r c-edited muted" role="cell">{when(p.updatedAt)}</span>
                  <span className="r" role="cell">{c.errors ? <Pill kind="bad">{c.errors} error{c.errors > 1 ? "s" : ""}</Pill> : c.warnings ? <Pill kind="warn">{c.warnings} warning{c.warnings > 1 ? "s" : ""}</Pill> : <Pill kind="ok">Ready to export</Pill>}</span>
                  <span className="r" role="cell"><button className="icon-btn" aria-label={`Delete ${p.name}`} title="Delete" onClick={(e) => { e.stopPropagation(); remove(p); }}><Icon name="x" /></button></span>
                </div>
              );
            })}
          </div>
        )}

        {deleted.length ? (
          <details className="deleted">
            <summary>Recently deleted ({deleted.length}) · kept for 30 days</summary>
            <div className="projects">
              {deleted.map((p) => (
                <div className="prow" key={p.id}>
                  <span className="name">{p.name}</span>
                  <span className="muted">Deleted {when(p.deletedAt!)}</span>
                  <span style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                    <button className="btn" onClick={async () => { await saveProject({ ...p, deletedAt: undefined }); load(); }}>Restore</button>
                    <button className="btn ghost" onClick={() => setConfirm(p)}>Delete forever</button>
                  </span>
                </div>
              ))}
            </div>
          </details>
        ) : null}

        <div className="below">
          <section className="card" aria-labelledby="r-h">
            <h2 id="r-h">Render on your computer</h2>
            <p className="muted" style={{ marginBottom: 12 }}>The editor makes the storyboard; the free, open-source engine renders the MP4 with Python 3.11+, Node.js 20+ and FFmpeg. A silent first render needs no API key.</p>
            <a className="btn" href="https://github.com/Jiiva-G/reel-studio#install" target="_blank" rel="noreferrer">Install guide</a>
          </section>
          <section className="card" aria-labelledby="s-h">
            <h2 id="s-h">Your projects stay here</h2>
            <p className="muted" style={{ marginBottom: 12 }}>Projects are saved in this browser, on this device. Clearing site data removes them. Back up regularly, or export a bundle to keep a copy.</p>
            <button className="btn" onClick={backup}><Icon name="download" />Back up all projects</button>
          </section>
        </div>
      </main>

      <NewProjectDialog open={newOpen} onClose={() => setNewOpen(false)} />
      <Dialog open={!!confirm} onClose={() => setConfirm(null)} title="Delete forever?">
        <p className="muted">"{confirm?.name}" will be removed from this browser. This cannot be undone.</p>
        <form method="dialog" onSubmit={async (e) => { e.preventDefault(); if (confirm) await deleteForever(confirm.id); setConfirm(null); load(); }}>
          <div className="actions"><button type="button" className="btn ghost" onClick={() => setConfirm(null)}>Cancel</button><button className="btn primary">Delete forever</button></div>
        </form>
      </Dialog>
    </div>
  );
};

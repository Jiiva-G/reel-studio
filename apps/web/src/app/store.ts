import { useCallback, useEffect, useRef, useState } from "react";
import { getProject, saveProject } from "../lib/storage";
import type { Project } from "../lib/types";

export type SaveState = "saved" | "saving" | "error";
const HISTORY = 100;
const COALESCE_MS = 800; // typing in one field becomes one undo step

/** One project being edited: autosave to IndexedDB, undo/redo, and a warning before leaving with unsaved work. */
export function useEditor(id: string) {
  const [project, setProject] = useState<Project | null | undefined>(undefined); // undefined = loading, null = not found
  const [save, setSave] = useState<SaveState>("saved");
  const cur = useRef<Project | null>(null);
  const past = useRef<Project[]>([]);
  const future = useRef<Project[]>([]);
  const lastKey = useRef<{ key: string; at: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const saveRef = useRef<SaveState>("saved");

  const setSaveState = (s: SaveState) => { saveRef.current = s; setSave(s); };

  useEffect(() => {
    let alive = true;
    getProject(id).then(
      (p) => { if (!alive) return; const v = p && !p.deletedAt ? p : null; cur.current = v; setProject(v); },
      () => alive && setProject(null));
    return () => { alive = false; };
  }, [id]);

  const pending = useRef<Project | null>(null);
  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    saveProject(p).then(() => { if (!pending.current) setSaveState("saved"); }, () => setSaveState("error"));
  }, []);
  const persist = useCallback((p: Project) => {
    setSaveState("saving");
    pending.current = p;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 150);
  }, [flush]);

  const apply = useCallback((p: Project) => { cur.current = p; setProject(p); persist(p); }, [persist]);

  /** Apply a change. `key` groups rapid edits of one field into a single undo step. */
  const update = useCallback((fn: (p: Project) => Project, key = "edit") => {
    const now_ = cur.current;
    if (!now_) return;
    const now = Date.now();
    const l = lastKey.current;
    if (!(l && l.key === key && now - l.at < COALESCE_MS)) {
      past.current = [...past.current.slice(-HISTORY + 1), now_];
      future.current = [];
    }
    lastKey.current = { key, at: now };
    apply({ ...fn(structuredClone(now_)), updatedAt: now });
  }, [apply]);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!cur.current || !prev) return;
    future.current.push(cur.current);
    lastKey.current = null;
    apply(prev);
  }, [apply]);

  const redo = useCallback(() => {
    const nxt = future.current.pop();
    if (!cur.current || !nxt) return;
    past.current.push(cur.current);
    lastKey.current = null;
    apply(nxt);
  }, [apply]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redo(); }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (saveRef.current !== "saved") { e.preventDefault(); e.returnValue = ""; }
    };
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("keydown", onKey); window.removeEventListener("beforeunload", onLeave);
      window.removeEventListener("pagehide", flush); document.removeEventListener("visibilitychange", onHide); flush();
    };
  }, [undo, redo, flush]);

  const retry = useCallback(() => { if (cur.current) persist(cur.current); }, [persist]);

  return { project, update, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0, save, retry };
}

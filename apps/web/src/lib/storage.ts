// Projects and brand presets in this browser's IndexedDB. Nothing leaves the device.
import type { Preset, Project } from "./types";

const DB = "reel-studio";
const RETENTION_MS = 30 * 24 * 3600 * 1000; // deleted projects can be restored for 30 days

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("projects", { keyPath: "id" });
      req.result.createObjectStore("presets", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open browser storage."));
    req.onblocked = () => reject(new Error("Browser storage is blocked by another tab. Close other Reel Studio tabs and reload."));
  });
  return dbp;
}

function run<T>(store: "projects" | "presets", mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then((d) => new Promise<T>((resolve, reject) => {
    const tx = d.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error ?? new Error("Browser storage error."));
    tx.onabort = () => reject(tx.error ?? new Error("Browser storage is full or unavailable."));
  }));
}

export const listProjects = () => run<Project[]>("projects", "readonly", (s) => s.getAll());
export const getProject = (id: string) => run<Project | undefined>("projects", "readonly", (s) => s.get(id));
export const saveProject = (p: Project) => run("projects", "readwrite", (s) => s.put(p));
export const deleteForever = (id: string) => run("projects", "readwrite", (s) => s.delete(id));
export const listPresets = () => run<Preset[]>("presets", "readonly", (s) => s.getAll());
export const savePreset = (p: Preset) => run("presets", "readwrite", (s) => s.put(p));
export const deletePreset = (id: string) => run("presets", "readwrite", (s) => s.delete(id));

/** Remove projects deleted more than 30 days ago. */
export async function purgeExpired(now = Date.now()) {
  for (const p of await listProjects()) if (p.deletedAt && now - p.deletedAt > RETENTION_MS) await deleteForever(p.id);
}

export async function usage(): Promise<{ usedKB: number | null; persisted: boolean }> {
  const est = await navigator.storage?.estimate?.().catch(() => undefined);
  const persisted = (await navigator.storage?.persisted?.().catch(() => false)) ?? false;
  return { usedKB: est?.usage != null ? Math.round(est.usage / 1024) : null, persisted };
}

/** Ask the browser not to evict our data under storage pressure (it may still say no). */
export const requestPersist = () => navigator.storage?.persist?.().catch(() => false) ?? Promise.resolve(false);

// The project bundle the engine imports with `reel-studio import` (docs/bundle-format.md, version 1),
// plus a whole-browser backup format for moving projects between browsers.
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { DEFAULT_BRAND, uid } from "./samples";
import { RULES, type Brand, type Language, type Project, type Scene, type SceneType } from "./types";

export const FORMAT = "reel-studio.bundle";
export const VERSION = 1;
export const BACKUP_FORMAT = "reel-studio.backup";
const GENERATOR = "Reel Studio web 0.1.0";
const MAX_BYTES = 2 * 1024 * 1024;

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "reel";

export function bundleJson(p: Project) {
  return {
    format: FORMAT, version: VERSION, generator: GENERATOR,
    project: { name: p.name, language: p.language, duration_s: p.durationTarget },
    brand: { name: p.brand.name, handle: p.brand.handle, cta: p.brand.cta, colors: p.brand.colors },
    content: p.content,
    storyboard: {
      title: p.name, cover_text: p.coverText || p.name, caption: p.caption, hashtags: p.hashtags,
      scenes: p.scenes.map((s) => ({
        type: s.type, narration: s.narration, subtitle: s.subtitle || s.narration, on_screen: s.on_screen,
        transition: s.transition, sfx: s.sfx, music_intensity: s.music_intensity, visual: s.visual,
      })),
    },
  };
}

function readme(p: Project) {
  const name = slug(p.name);
  return `# ${p.name}\n\nExported from Reel Studio (https://studio.jeevag.in). Render it on your computer:\n\n` +
    "1. Install Reel Studio once: https://github.com/Jiiva-G/reel-studio#install\n" +
    `2. uv run reel-studio import ${name}.reelstudio.zip\n` +
    `3. uv run reel-studio run ${name} --from voice --voice-provider none\n\n` +
    "Step 3 makes a silent version. For a voice-over, use --voice-provider auto --approve-api with your own\n" +
    `Gemini or Sarvam key, or record the narration and run: uv run reel-studio narration ${name} recording.wav\n`;
}

export function exportBundle(p: Project): Uint8Array {
  return zipSync({
    "bundle.json": strToU8(JSON.stringify(bundleJson(p), null, 2)),
    "content.md": strToU8(p.content || `# ${p.name}\n`),
    "README.md": strToU8(readme(p)),
  });
}

export class BundleError extends Error {}

const LANGS: Language[] = ["english", "tamil", "tanglish"];
const isHex = (v: unknown) => typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);

function brandFrom(b: Record<string, unknown> | undefined): Brand {
  const out = structuredClone(DEFAULT_BRAND);
  if (!b) return out;
  for (const k of ["name", "handle", "cta"] as const) if (typeof b[k] === "string" && (b[k] as string).trim()) out[k] = (b[k] as string).trim().slice(0, 60);
  const colors = (b.colors ?? {}) as Record<string, unknown>;
  for (const k of Object.keys(out.colors) as (keyof Brand["colors"])[]) if (isHex(colors[k])) out.colors[k] = colors[k] as string;
  return out;
}

/** Same whitelist and checks as the engine's bundle.py, so a bundle that opens here also imports there. */
export function projectFromBundle(data: unknown): Project {
  const d = data as Record<string, any>;
  if (!d || d.format !== FORMAT) throw new BundleError("This is not a Reel Studio bundle.");
  if (d.version !== VERSION) throw new BundleError(`Unsupported bundle version ${JSON.stringify(d.version)}; this editor reads version ${VERSION}.`);
  const scenes = d.storyboard?.scenes;
  if (!Array.isArray(scenes) || !scenes.length) throw new BundleError("The bundle's storyboard has no scenes.");
  const now = Date.now();
  return {
    id: uid(), name: String(d.project?.name || d.storyboard?.title || "Imported reel").slice(0, 120),
    language: LANGS.includes(d.project?.language) ? d.project.language : "english",
    durationTarget: typeof d.project?.duration_s === "number" ? d.project.duration_s : 45,
    content: typeof d.content === "string" ? d.content : "", coverText: String(d.storyboard?.cover_text ?? ""),
    caption: String(d.storyboard?.caption ?? ""), hashtags: (d.storyboard?.hashtags ?? []).map(String).slice(0, 20),
    brand: brandFrom(d.brand), createdAt: now, updatedAt: now,
    scenes: scenes.map((s: any, i: number): Scene => {
      if (!s || typeof s !== "object") throw new BundleError(`Scene ${i + 1} is not an object.`);
      return {
        uid: uid(), type: (RULES.scene_types.includes(s.type) ? s.type : "title") as SceneType,
        narration: String(s.narration ?? ""), subtitle: s.subtitle ? String(s.subtitle) : undefined,
        on_screen: typeof s.on_screen === "object" && s.on_screen ? s.on_screen : {},
        transition: RULES.transitions.includes(s.transition) ? s.transition : "fade",
        sfx: Array.isArray(s.sfx) ? s.sfx.filter((x: unknown) => typeof x === "string") : [],
        music_intensity: ["low", "medium", "high"].includes(s.music_intensity) ? s.music_intensity : "medium",
        visual: String(s.visual ?? ""),
      };
    }),
  };
}

export function importFile(bytes: Uint8Array): Project | Project[] {
  if (bytes.length > 20 * MAX_BYTES) throw new BundleError("The file is too large.");
  let text: string;
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const files = unzipSync(bytes, { filter: (f) => f.name === "bundle.json" || f.name === "backup.json" });
    const entry = files["bundle.json"] ?? files["backup.json"];
    if (!entry) throw new BundleError("bundle.json is missing from the zip.");
    if (entry.length > 20 * MAX_BYTES) throw new BundleError("bundle.json is too large.");
    text = strFromU8(entry);
  } else {
    text = strFromU8(bytes);
  }
  let data: any;
  try {
    data = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    throw new BundleError("The file is not valid JSON.");
  }
  if (data?.format === BACKUP_FORMAT) {
    if (!Array.isArray(data.projects)) throw new BundleError("The backup has no projects.");
    return data.projects.map((b: unknown) => projectFromBundle(b));
  }
  return projectFromBundle(data);
}

export function exportBackup(projects: Project[]): Uint8Array {
  const backup = { format: BACKUP_FORMAT, version: VERSION, generator: GENERATOR, projects: projects.map(bundleJson) };
  return zipSync({ "backup.json": strToU8(JSON.stringify(backup)) });
}

export function download(bytes: Uint8Array, filename: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

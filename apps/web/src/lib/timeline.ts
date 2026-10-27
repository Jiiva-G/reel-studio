// Preview timing: port of reelstudio/studio/timeline.py build() with each voice clip's length replaced by the
// engine's pre-voice estimate. The local render recomputes everything from the real voice-over.
import type { ReelProps, Scene as RenderScene } from "@renderer/types";
import { estimateSeconds } from "./validate";
import type { Project } from "./types";

export const FPS = 30;
const LEAD_S = 0.15;
const TAIL_S = 0.3;
const MIN_S: Record<string, number> = { hook: 1.8, endcard: 2.6, code: 4.0, terminal: 4.0, diagram: 3.5, compare: 3.5 };
const CHUNK_WORDS = 5;
const CHUNK_CHARS = 34;

export function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let cur: string[] = [];
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if (cur.length && (cur.length >= CHUNK_WORDS || [...cur, w].join(" ").length > CHUNK_CHARS)) {
      chunks.push(cur.join(" "));
      cur = [];
    }
    cur.push(w);
    if (/[.!?]$/.test(w)) {
      chunks.push(cur.join(" "));
      cur = [];
    }
  }
  if (cur.length) chunks.push(cur.join(" "));
  return chunks;
}

/** Voice length the engine uses for a placeholder (silent) clip: max(1.5, estimate - 0.6) — voice.run(). */
export const voiceSeconds = (narration: string) => Math.max(1.5, estimateSeconds(narration) - 0.6);

export type SceneTiming = { from: number; duration: number; seconds: number };

export function sceneTimings(p: Project): SceneTiming[] {
  let t = 0;
  return p.scenes.map((s) => {
    const vdur = voiceSeconds(s.narration);
    const dur = Math.max(vdur + LEAD_S + TAIL_S, MIN_S[s.type] ?? 2.0);
    const durF = Math.round(dur * FPS);
    const out = { from: t, duration: durF, seconds: durF / FPS };
    t += durF;
    return out;
  });
}

export function toReelProps(p: Project): ReelProps {
  const times = sceneTimings(p);
  const captions: ReelProps["captions"] = [];
  const scenes: RenderScene[] = p.scenes.map((s, i) => {
    const { from, duration } = times[i];
    const vdur = voiceSeconds(s.narration);
    const chunks = chunkText(s.subtitle || s.narration);
    const total = chunks.reduce((a, c) => a + c.length, 0) || 1;
    let t = from / FPS + LEAD_S;
    for (const c of chunks) {
      const d = (vdur * c.length) / total;
      captions.push({ text: c, from: Math.round(t * FPS), to: Math.max(Math.round((t + d) * FPS), Math.round(t * FPS) + 6) });
      t += d;
    }
    return { id: i + 1, type: s.type, from, duration, overlap: 0, transition: s.transition, on_screen: s.on_screen } as RenderScene;
  });
  for (let i = 0; i < captions.length - 1; i++) captions[i].to = Math.min(captions[i].to, captions[i + 1].from);
  const last = times[times.length - 1];
  const durationInFrames = last ? last.from + last.duration : FPS;
  return {
    fps: FPS, width: 1080, height: 1920, durationInFrames,
    brand: { name: p.brand.name, handle: p.brand.handle, cta: p.brand.cta, colors: p.brand.colors },
    scenes, captions, audio: null, showProgress: true, captionStyle: "default",
  };
}

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;

import demo from "../../../../examples/demo/demo_storyboard.json";
import defaultBrand from "../../../../brands/reel-studio.json";
import type { Brand, Language, Project, Scene, SceneType } from "./types";

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

export const DEFAULT_BRAND: Brand = {
  name: defaultBrand.name, handle: defaultBrand.handle, cta: defaultBrand.cta, colors: { ...defaultBrand.colors },
};

export function blankScene(type: SceneType = "title"): Scene {
  const on_screen: Scene["on_screen"] =
    type === "hook" ? { heading: "" } : type === "endcard" ? { heading: "", cta: "Follow" } :
    type === "bullets" ? { heading: "", bullets: [""] } : type === "code" ? { heading: "", filename: "main.py", language: "python", code: "" } :
    type === "terminal" ? { heading: "", terminal_lines: ["$ "], illustrative: true } :
    type === "chat" ? { messages: [{ role: "user", text: "" }, { role: "assistant", text: "" }], illustrative: true } :
    type === "diagram" ? { heading: "", nodes: [{ label: "" }, { label: "" }, { label: "" }] } :
    type === "compare" ? { heading: "", left: { title: "", points: [""] }, right: { title: "", points: [""] } } :
    type === "stat" ? { value: "", label: "" } : type === "quote" ? { quote: "" } : { heading: "" };
  return { uid: uid(), type, narration: "", on_screen, transition: "fade", sfx: [], music_intensity: "medium", visual: "" };
}

function base(name: string, language: Language): Omit<Project, "scenes"> {
  const now = Date.now();
  return { id: uid(), name: name.trim() || "Untitled reel", language, durationTarget: 45, content: "", coverText: "",
    caption: "", hashtags: [], brand: structuredClone(DEFAULT_BRAND), createdAt: now, updatedAt: now };
}

/** The real demo storyboard from examples/demo (a 7-scene reel about rate limiting in FastAPI). */
export function sampleProject(name = "Rate limiting in FastAPI"): Project {
  return {
    ...base(name, "english"),
    content: "Rate limiting in FastAPI with slowapi: one client can flood an endpoint; a Limiter keyed by client IP returns HTTP 429 after 5 requests a minute; in production use Redis and the real client IP.",
    coverText: demo.cover_text,
    hashtags: [...demo.hashtags],
    scenes: demo.scenes.map((s) => ({
      uid: uid(), type: s.type as SceneType, narration: s.narration, subtitle: s.subtitle, on_screen: structuredClone(s.on_screen) as Scene["on_screen"],
      transition: s.transition as Scene["transition"], sfx: [...s.sfx], music_intensity: s.music_intensity as Scene["music_intensity"], visual: s.visual,
    })),
  };
}

export function blankProject(name: string, language: Language = "english"): Project {
  const hook = blankScene("hook");
  const end = blankScene("endcard");
  return { ...base(name, language), scenes: [hook, blankScene("title"), end] };
}

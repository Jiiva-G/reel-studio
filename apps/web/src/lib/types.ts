import rules from "../../../../schema/rules.json";

export type SceneType = (typeof rules.scene_types)[number];
export type Transition = "fade" | "slide" | "zoom" | "wipe" | "clockwipe" | "flip" | "zoomthrough";
export type Language = "english" | "tamil" | "tanglish";

export type OnScreen = {
  heading?: string;
  subheading?: string;
  tag?: string;
  bullets?: string[];
  code?: string;
  filename?: string;
  language?: string;
  highlight_lines?: number[];
  terminal_lines?: string[];
  illustrative?: boolean;
  messages?: { role: "user" | "assistant"; text: string }[];
  nodes?: { label: string; icon?: string; note?: string }[];
  edge_labels?: string[];
  left?: { title: string; points: string[] };
  right?: { title: string; points: string[] };
  value?: string;
  label?: string;
  quote?: string;
  cta?: string;
};

export type Scene = {
  uid: string; // stable id for React keys and reordering; not exported
  type: SceneType;
  narration: string;
  subtitle?: string;
  on_screen: OnScreen;
  transition: Transition;
  sfx: string[];
  music_intensity: "low" | "medium" | "high";
  visual: string;
};

export type BrandColors = {
  bg: string; bg2: string; surface: string; text: string; muted: string;
  accent: string; accent2: string; codeBg: string; success: string; danger: string;
};
export type Brand = { name: string; handle: string; cta: string; colors: BrandColors };

export type Project = {
  id: string;
  name: string;
  language: Language;
  durationTarget: number; // seconds
  content: string; // the user's notes
  coverText: string;
  caption: string;
  hashtags: string[];
  brand: Brand;
  scenes: Scene[];
  createdAt: number;
  updatedAt: number;
  deletedAt?: number; // soft delete: restorable for 30 days
};

export type Preset = { id: string; name: string; brand: Brand };

export const RULES = rules;

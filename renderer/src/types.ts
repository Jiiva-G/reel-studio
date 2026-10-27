export type BrandColors = {
  bg: string;
  bg2: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  codeBg: string;
  success: string;
  danger: string;
};

export type Brand = {
  name: string;
  handle: string;
  colors: BrandColors;
  cta: string;
};

export type CaptionChunk = { text: string; from: number; to: number }; // absolute frames

export type DiagramNode = { label: string; icon?: string; note?: string };

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
  component?: string;
  cues?: Record<string, number>; // frames relative to the scene start, measured from the narration
  nodes?: DiagramNode[];
  edge_labels?: string[];
  left?: { title: string; points: string[] };
  right?: { title: string; points: string[] };
  value?: string;
  label?: string;
  quote?: string;
  cta?: string;
};

export type SceneType =
  | "hook"
  | "title"
  | "bullets"
  | "code"
  | "terminal"
  | "chat"
  | "diagram"
  | "compare"
  | "stat"
  | "quote"
  | "endcard"
  | "custom";

export type Scene = {
  id: number;
  type: SceneType;
  from: number; // absolute start frame
  duration: number; // frames
  transition: "fade" | "slide" | "zoom" | "wipe" | "clockwipe" | "flip" | "zoomthrough";
  overlap?: number; // frames this scene overlaps the next (exit transition)
  on_screen: OnScreen;
};

export type ReelProps = {
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  brand: Brand;
  scenes: Scene[];
  captions: CaptionChunk[];
  audio?: string | null; // file in --public-dir
  showProgress: boolean;
  captionStyle?: "default" | "bottom";
};

export type CoverProps = {
  brand: Brand;
  title: string;
  subtitle?: string;
  tag?: string;
};

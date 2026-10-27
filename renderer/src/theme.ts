import { loadFont as loadHeading } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadBody } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadTamil } from "@remotion/google-fonts/NotoSansTamil";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const heading = loadHeading("normal", { weights: ["500", "700"], subsets: ["latin"] });
const body = loadBody("normal", { weights: ["400", "600", "800"], subsets: ["latin"] });
const mono = loadMono("normal", { weights: ["400", "700"], subsets: ["latin"] });
const tamil = loadTamil("normal", { weights: ["400", "700"], subsets: ["tamil", "latin"] });

// Tamil glyphs fall back to Noto Sans Tamil in every stack.
export const FONT_HEADING = `${heading.fontFamily}, ${tamil.fontFamily}, sans-serif`;
export const FONT_BODY = `${body.fontFamily}, ${tamil.fontFamily}, sans-serif`;
export const FONT_MONO = `${mono.fontFamily}, monospace`;

// Instagram UI safe area for 1080x1920: keep content between these y values.
export const SAFE_TOP = 230;
export const SAFE_BOTTOM = 1300;
export const SIDE = 80;

/** 0 → 1 spring starting at `delay` frames into the current sequence. */
export const useEnter = (delay = 0, damping = 18) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.7 } });
};

/** Linear 0 → 1 progress between two frames (clamped). */
export const useProgress = (start: number, end: number) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [start, Math.max(end, start + 1)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};

// 2D motion-graphics building blocks shared by episode scenes.
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { noise2D } from "@remotion/noise";
import { FONT_BODY, FONT_HEADING, FONT_MONO } from "../theme";

export const K = {
  amber: "#f5b653",
  blue: "#4fa3f7",
  text: "#f5f5f4",
  muted: "#9aa0aa",
  surface: "#1d2027",
  code: "#111318",
  green: "#3fb950",
  red: "#f85149",
  bg: "#0f1115",
};

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const ease = (f: number, a: number, b: number) =>
  interpolate(f, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (t) => 1 - Math.pow(1 - t, 3) });

export const useSpringAt = (at: number, damping = 14) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - at, fps, config: { damping, mass: 0.6 } });
};

/** Camera-shake transform between [start, start+dur). */
export const shake = (frame: number, start: number, dur = 12, amp = 18) => {
  if (frame < start || frame >= start + dur) return "";
  const k = 1 - (frame - start) / dur;
  const x = noise2D("sx", frame * 0.9, 0) * amp * k;
  const y = noise2D("sy", 0, frame * 0.9) * amp * k;
  return `translate(${x}px, ${y}px)`;
};

/** Two-layer drifting particles; `frame` should be the global frame so motion is continuous across scenes. */
export const Particles: React.FC<{ frame: number }> = ({ frame }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    {Array.from({ length: 46 }).map((_, i) => {
      const near = i % 3 === 0;
      const speed = near ? 0.9 : 0.35;
      const bx = (noise2D("px", i, 0) * 0.5 + 0.5) * 1080;
      const by = (noise2D("py", 0, i) * 0.5 + 0.5) * 1920;
      const y = (((by - frame * speed) % 1920) + 1920) % 1920;
      const x = bx + noise2D("wx", i, frame / 120) * 30;
      const r = near ? 5 : 2.5;
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: x,
            top: y,
            width: r * 2,
            height: r * 2,
            borderRadius: r,
            background: near ? K.amber : K.blue,
            opacity: near ? 0.28 : 0.22,
            filter: near ? "blur(1.5px)" : undefined,
          }}
        />
      );
    })}
  </AbsoluteFill>
);

/** Rubber-stamp that slams in at frame `at`. */
export const Stamp: React.FC<{ text: string; color: string; at: number; x: number; y: number; rotate?: number; size?: number }> = ({
  text,
  color,
  at,
  x,
  y,
  rotate = -8,
  size = 70,
}) => {
  const frame = useCurrentFrame();
  const s = useSpringAt(at, 11);
  if (frame < at) return null;
  const scale = interpolate(s, [0, 1], [2.4, 1]);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) rotate(${rotate}deg) scale(${scale})`,
        opacity: clamp01((frame - at) / 3),
        padding: "10px 30px",
        border: `8px solid ${color}`,
        borderRadius: 14,
        color,
        fontFamily: FONT_HEADING,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: 6,
        background: "rgba(15,17,21,0.55)",
        whiteSpace: "nowrap",
        boxShadow: `0 0 40px ${color}55`,
      }}
    >
      {text}
    </div>
  );
};

/** Mouse cursor moving through keyframes, with click ripples. */
export const Cursor: React.FC<{ keys: { f: number; x: number; y: number }[]; clicks?: number[] }> = ({ keys, clicks = [] }) => {
  const frame = useCurrentFrame();
  if (frame < keys[0].f) return null;
  const x = interpolate(frame, keys.map((k) => k.f), keys.map((k) => k.x), {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => t * t * (3 - 2 * t),
  });
  const y = interpolate(frame, keys.map((k) => k.f), keys.map((k) => k.y), {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => t * t * (3 - 2 * t),
  });
  const pressed = clicks.some((c) => frame >= c && frame < c + 5);
  return (
    <>
      {clicks.map((c) =>
        frame >= c && frame < c + 18 ? (
          <div
            key={c}
            style={{
              position: "absolute",
              left: x - 40 * (1 + (frame - c) / 6),
              top: y - 40 * (1 + (frame - c) / 6),
              width: 80 * (1 + (frame - c) / 6),
              height: 80 * (1 + (frame - c) / 6),
              borderRadius: "50%",
              border: `4px solid ${K.amber}`,
              opacity: 1 - (frame - c) / 18,
            }}
          />
        ) : null,
      )}
      <svg width="70" height="80" viewBox="0 0 28 32" style={{ position: "absolute", left: x, top: y, transform: `scale(${pressed ? 0.85 : 1})`, transformOrigin: "0 0", filter: "drop-shadow(0 6px 10px #000a)" }}>
        <path d="M2 2 L2 26 L8 20 L12 30 L16 28 L12 18 L20 18 Z" fill="#fff" stroke="#111" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </>
  );
};

/** RGB-split + jitter glitch while active. */
export const Glitch: React.FC<{ active: boolean; children: React.ReactNode; style?: React.CSSProperties }> = ({ active, children, style }) => {
  const frame = useCurrentFrame();
  const j = active ? noise2D("g", frame * 1.3, 0) * 14 : 0;
  const skew = active && frame % 4 === 0 ? noise2D("gs", frame, 1) * 8 : 0;
  return (
    <div
      style={{
        ...style,
        transform: `${style?.transform ?? ""} translateX(${j}px) skewX(${skew}deg)`,
        filter: active ? "drop-shadow(6px 0 0 rgba(248,81,73,0.85)) drop-shadow(-6px 0 0 rgba(79,163,247,0.85))" : undefined,
      }}
    >
      {children}
    </div>
  );
};

/** Pill label like "LAYER 1 · RETRIEVAL". */
export const Chip: React.FC<{ n?: string; text: string; at?: number; color?: string; y?: number }> = ({ n, text, at = 0, color = K.amber, y = 250 }) => {
  const s = useSpringAt(at);
  return (
    <div
      style={{
        position: "absolute",
        top: y,
        left: 80,
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "12px 28px 12px 14px",
        borderRadius: 999,
        background: `${K.surface}ee`,
        border: `2px solid ${color}`,
        opacity: s,
        transform: `translateX(${(1 - s) * -60}px)`,
      }}
    >
      {n ? (
        <div style={{ width: 52, height: 52, borderRadius: 26, background: color, color: K.bg, display: "grid", placeItems: "center", fontFamily: FONT_HEADING, fontWeight: 700, fontSize: 32 }}>
          {n}
        </div>
      ) : null}
      <div style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 34, letterSpacing: 3, color: K.text }}>{text}</div>
    </div>
  );
};

/** Kinetic headline: words spring in one by one; *emph* words in amber. */
export const Kinetic: React.FC<{ text: string; at: number; size?: number; x?: number; y: number; width?: number; color?: string; align?: "left" | "center" }> = ({
  text,
  at,
  size = 96,
  x = 80,
  y,
  width = 920,
  color = K.text,
  align = "left",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(/\s+/);
  return (
    <div style={{ position: "absolute", left: x, top: y, width, display: "flex", flexWrap: "wrap", gap: "4px 24px", justifyContent: align === "center" ? "center" : "flex-start" }}>
      {words.map((w, i) => {
        const em = w.startsWith("*") || w.endsWith("*") || w.endsWith("*.") || w.endsWith("*?");
        const s = spring({ frame: frame - at - i * 4, fps, config: { damping: 13, mass: 0.6 } });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              fontFamily: FONT_HEADING,
              fontWeight: 700,
              fontSize: size,
              lineHeight: 1.05,
              color: em ? K.amber : color,
              opacity: clamp01(s * 1.5),
              transform: `translateY(${(1 - s) * 60}px) rotate(${(1 - s) * 6}deg)`,
            }}
          >
            {w.replace(/\*/g, "")}
          </span>
        );
      })}
    </div>
  );
};

export const DevAvatar: React.FC<{ size?: number }> = ({ size = 72 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="32" fill="#22324a" />
    <path d="M12 60c2-12 10-18 20-18s18 6 20 18" fill="#2c5f99" />
    <circle cx="32" cy="27" r="12" fill="#c98f63" />
    <path d="M19 25c0-9 6-14 13-14s13 5 13 13c-4-4-9-5-13-5s-9 2-13 6z" fill="#1a1a1a" />
    <rect x="23" y="25" width="7" height="4" rx="2" fill="none" stroke="#111" strokeWidth="1.6" />
    <rect x="34" y="25" width="7" height="4" rx="2" fill="none" stroke="#111" strokeWidth="1.6" />
  </svg>
);

/** Laptop frame; children render inside the screen (920 x 600 area). */
export const Laptop: React.FC<{ x: number; y: number; children: React.ReactNode; scale?: number }> = ({ x, y, children, scale = 1 }) => (
  <div style={{ position: "absolute", left: x, top: y, width: 960, transform: `scale(${scale})`, transformOrigin: "50% 0" }}>
    <div style={{ background: "#2a2d35", borderRadius: "28px 28px 8px 8px", padding: 20, boxShadow: "0 40px 90px #000c" }}>
      <div style={{ position: "relative", height: 600, borderRadius: 10, overflow: "hidden", background: K.code }}>{children}</div>
    </div>
    <div style={{ height: 34, margin: "0 -40px", background: "linear-gradient(#3a3d46, #24272e)", clipPath: "polygon(3% 0, 97% 0, 100% 100%, 0 100%)", borderRadius: "0 0 18px 18px" }} />
  </div>
);

export const Bubble: React.FC<{ role: "user" | "assistant"; children: React.ReactNode; opacity?: number; dy?: number; tint?: string }> = ({
  role,
  children,
  opacity = 1,
  dy = 0,
  tint,
}) => {
  const user = role === "user";
  return (
    <div style={{ display: "flex", justifyContent: user ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 14, opacity, transform: `translateY(${dy}px)` }}>
      {user ? null : null}
      <div
        style={{
          maxWidth: 640,
          padding: "18px 24px",
          borderRadius: 24,
          borderBottomRightRadius: user ? 6 : 24,
          borderBottomLeftRadius: user ? 24 : 6,
          background: user ? `${K.blue}33` : tint ?? "#1b1e25",
          border: `1.5px solid ${user ? K.blue : "#ffffff22"}`,
          fontFamily: FONT_BODY,
          fontSize: 36,
          lineHeight: 1.3,
          color: K.text,
        }}
      >
        {children}
      </div>
      {user ? <DevAvatar size={64} /> : null}
    </div>
  );
};

export const Mono: React.FC<{ children: React.ReactNode; color?: string; size?: number }> = ({ children, color = K.text, size = 32 }) => (
  <div style={{ fontFamily: FONT_MONO, fontSize: size, color, whiteSpace: "pre", lineHeight: 1.5 }}>{children}</div>
);

export const typed = (text: string, frame: number, start: number, cps = 1.4) => text.slice(0, Math.max(0, Math.floor((frame - start) * cps)));

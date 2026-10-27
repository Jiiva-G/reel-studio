import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Brand, CaptionChunk, Scene } from "../types";
import { FONT_BODY, useEnter } from "../theme";

/** Animated background: gradient, faint grid, slowly drifting glow. */
export const Background: React.FC<{ brand: Brand }> = ({ brand }) => {
  const frame = useCurrentFrame();
  const { colors } = brand;
  const gx = 50 + Math.sin(frame / 90) * 18;
  const gy = 35 + Math.cos(frame / 120) * 10;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${colors.bg} 0%, ${colors.bg2} 100%)` }}>
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${colors.text}0d 1px, transparent 1px), linear-gradient(90deg, ${colors.text}0d 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />
      <AbsoluteFill
        style={{ background: `radial-gradient(circle at ${gx}% ${gy}%, ${colors.accent}2e 0%, transparent 45%)` }}
      />
    </AbsoluteFill>
  );
};

/** Wraps a scene with its enter/exit transition and a subtle camera push-in. */
export const SceneFrame: React.FC<{ scene: Scene; children: React.ReactNode }> = ({ scene, children }) => {
  const frame = useCurrentFrame();
  const enter = useEnter(0, 20);
  const lin = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ov = Math.max(scene.overlap ?? 8, 6);
  const exitK = interpolate(frame, [scene.duration - ov, scene.duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = 1 - exitK;
  const push = interpolate(frame, [0, scene.duration], [1, 1.035]);
  let transform = `scale(${push * (1 + 0.06 * exitK)})`;
  let clipPath: string | undefined;
  let maskImage: string | undefined;
  let filter: string | undefined;
  let opacity = Math.min(enter * 1.4, 1) * exit;
  switch (scene.transition) {
    case "slide":
      transform = `translateX(${(1 - enter) * 160}px) scale(${push})`;
      break;
    case "zoom":
      transform = `scale(${(0.9 + 0.1 * enter) * push * (1 + 0.06 * exitK)})`;
      break;
    case "wipe":
      clipPath = `inset(0 ${(1 - lin) * 100}% 0 0)`;
      opacity = exit;
      break;
    case "clockwipe": {
      const deg = lin * 360;
      maskImage = lin >= 1 ? undefined : `conic-gradient(from 0deg at 50% 50%, #000 ${deg}deg, transparent ${deg}deg)`;
      opacity = exit;
      break;
    }
    case "flip":
      transform = `perspective(1800px) rotateY(${(1 - enter) * -70}deg) scale(${push})`;
      break;
    case "zoomthrough":
      transform = `scale(${(1.35 - 0.35 * enter) * push * (1 + 0.25 * exitK)})`;
      filter = enter < 0.98 ? `blur(${(1 - enter) * 12}px)` : undefined;
      break;
  }
  return (
    <AbsoluteFill style={{ opacity, transform, clipPath, maskImage, WebkitMaskImage: maskImage, filter }}>{children}</AbsoluteFill>
  );
};

export const ProgressBar: React.FC<{ brand: Brand; total: number }> = ({ brand, total }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 8, background: `${brand.colors.text}14` }}>
      <div
        style={{
          width: `${(frame / total) * 100}%`,
          height: "100%",
          background: `linear-gradient(90deg, ${brand.colors.accent}, ${brand.colors.accent2})`,
        }}
      />
    </div>
  );
};

export const Watermark: React.FC<{ brand: Brand }> = ({ brand }) => (
  <div
    style={{
      position: "absolute",
      top: 150,
      width: "100%",
      textAlign: "center",
      fontFamily: FONT_BODY,
      fontWeight: 600,
      fontSize: 30,
      letterSpacing: 1,
      color: `${brand.colors.text}99`,
    }}
  >
    {brand.handle}
  </div>
);

/** One caption chunk at a time, popping in, placed above Instagram's bottom UI. */
export const Captions: React.FC<{ brand: Brand; captions: CaptionChunk[]; variant?: "default" | "bottom" }> = ({
  brand,
  captions,
  variant = "default",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cur = captions.find((c) => frame >= c.from && frame < c.to);
  if (!cur) return null;
  const t = Math.min((frame - cur.from) / (fps * 0.15), 1);
  if (variant === "bottom") {
    // Bottom-anchored (grows upward), lower edge at y=1500: clear of the Reels caption/audio bar below and
    // of the like/comment/share column on the right (x > ~930).
    return (
      <div style={{ position: "absolute", left: 70, width: 860, bottom: 420, display: "flex", justifyContent: "center" }}>
        <div
          style={{
            maxWidth: 860,
            padding: "16px 28px",
            borderRadius: 18,
            background: "rgba(10,12,16,0.75)",
            boxShadow: "0 8px 28px rgba(0,0,0,0.45)",
            color: "#ffffff",
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: 44,
            lineHeight: 1.25,
            textAlign: "center",
            textShadow: "0 2px 6px rgba(0,0,0,0.85)",
            opacity: t,
            transform: `translateY(${(1 - t) * 10}px)`,
          }}
        >
          {cur.text}
        </div>
      </div>
    );
  }
  return (
    <div
      style={{
        position: "absolute",
        top: 1340,
        left: 70,
        right: 70,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          maxWidth: 940,
          padding: "18px 30px",
          borderRadius: 22,
          background: `${brand.colors.bg}e6`,
          border: `2px solid ${brand.colors.accent}55`,
          color: brand.colors.text,
          fontFamily: FONT_BODY,
          fontWeight: 700,
          fontSize: 46,
          lineHeight: 1.25,
          textAlign: "center",
          transform: `scale(${0.92 + 0.08 * t})`,
          opacity: t,
          overflowWrap: "anywhere",
        }}
      >
        {cur.text}
      </div>
    </div>
  );
};

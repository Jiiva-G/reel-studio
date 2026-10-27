import React from "react";
import { AbsoluteFill, Html5Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Particles } from "./kit/fx";
import { FontGate } from "./kit/three-kit";
import { CoverProps, ReelProps } from "./types";
import { Background, Captions, ProgressBar, SceneFrame, Watermark } from "./components/Chrome";
import { SceneView } from "./components/Scenes";
import { FONT_BODY, FONT_HEADING, SIDE } from "./theme";

const GlobalParticles: React.FC = () => <Particles frame={useCurrentFrame()} />;

export const Reel: React.FC<ReelProps> = ({ brand, scenes, captions, audio, showProgress, durationInFrames, captionStyle }) => (
  <AbsoluteFill style={{ backgroundColor: brand.colors.bg }}>
    <Background brand={brand} />
    {scenes.some((s) => s.type === "custom") ? <GlobalParticles /> : null}
    <FontGate>
      {scenes.map((scene) => (
        <Sequence key={scene.id} from={scene.from} durationInFrames={scene.duration} name={`scene ${scene.id} · ${scene.type}`}>
          <SceneFrame scene={scene}>
            <SceneView scene={scene} brand={brand} />
          </SceneFrame>
        </Sequence>
      ))}
    </FontGate>
    <Watermark brand={brand} />
    <Captions brand={brand} captions={captions} variant={captionStyle} />
    {showProgress ? <ProgressBar brand={brand} total={durationInFrames} /> : null}
    {audio ? <Html5Audio src={staticFile(audio)} /> : null}
  </AbsoluteFill>
);

export const Cover: React.FC<CoverProps> = ({ brand, title, subtitle, tag }) => (
  <AbsoluteFill style={{ backgroundColor: brand.colors.bg }}>
    <Background brand={brand} />
    <AbsoluteFill
      style={{ left: SIDE, right: SIDE, width: "auto", display: "flex", flexDirection: "column", justifyContent: "center", gap: 40 }}
    >
      {tag ? (
        <div
          style={{
            alignSelf: "flex-start",
            padding: "12px 28px",
            borderRadius: 999,
            border: `3px solid ${brand.colors.accent}`,
            color: brand.colors.accent,
            fontFamily: FONT_BODY,
            fontWeight: 800,
            fontSize: 36,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          {tag}
        </div>
      ) : null}
      <div style={{ fontFamily: FONT_HEADING, fontWeight: 700, fontSize: 120, lineHeight: 1.04, color: brand.colors.text }}>
        {title.split(/(\*[^*]+\*)/g).map((p, i) =>
          p.startsWith("*") ? (
            <span key={i} style={{ color: brand.colors.accent }}>
              {p.slice(1, -1)}
            </span>
          ) : (
            <React.Fragment key={i}>{p}</React.Fragment>
          ),
        )}
      </div>
      {subtitle ? <div style={{ fontFamily: FONT_BODY, fontSize: 48, color: brand.colors.muted }}>{subtitle}</div> : null}
      <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 36, color: `${brand.colors.text}aa` }}>{brand.handle}</div>
    </AbsoluteFill>
  </AbsoluteFill>
);

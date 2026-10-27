import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Brand, OnScreen, Scene } from "../types";
import { FONT_BODY, FONT_HEADING, FONT_MONO, SAFE_BOTTOM, SAFE_TOP, SIDE, useEnter, useProgress } from "../theme";
import { Icon } from "./Icons";
import { EPISODES } from "../episodes";

type SP = { s: OnScreen; brand: Brand; duration: number };

const Area: React.FC<{ children: React.ReactNode; justify?: string; gap?: number }> = ({
  children,
  justify = "center",
  gap = 36,
}) => (
  <AbsoluteFill
    style={{
      top: SAFE_TOP,
      height: SAFE_BOTTOM - SAFE_TOP,
      left: SIDE,
      right: SIDE,
      width: "auto",
      display: "flex",
      flexDirection: "column",
      justifyContent: justify,
      gap,
    }}
  >
    {children}
  </AbsoluteFill>
);

/** Text where *wrapped* words are drawn in the accent color. */
const Emph: React.FC<{ text: string; brand: Brand }> = ({ text, brand }) => (
  <>
    {text.split(/(\*[^*]+\*)/g).map((part, i) =>
      part.startsWith("*") && part.endsWith("*") ? (
        <span key={i} style={{ color: brand.colors.accent }}>
          {part.slice(1, -1)}
        </span>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      ),
    )}
  </>
);

const Tag: React.FC<{ text: string; brand: Brand }> = ({ text, brand }) => {
  const e = useEnter(2);
  return (
    <div
      style={{
        alignSelf: "flex-start",
        padding: "10px 24px",
        borderRadius: 999,
        border: `2px solid ${brand.colors.accent}`,
        color: brand.colors.accent,
        fontFamily: FONT_BODY,
        fontWeight: 800,
        fontSize: 30,
        letterSpacing: 2,
        textTransform: "uppercase",
        opacity: e,
        transform: `translateY(${(1 - e) * 20}px)`,
      }}
    >
      {text}
    </div>
  );
};

const Heading: React.FC<{ text: string; brand: Brand; size?: number; delay?: number }> = ({
  text,
  brand,
  size = 84,
  delay = 4,
}) => {
  const e = useEnter(delay);
  return (
    <div
      style={{
        fontFamily: FONT_HEADING,
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1.08,
        color: brand.colors.text,
        opacity: e,
        transform: `translateY(${(1 - e) * 40}px)`,
        overflowWrap: "anywhere",
      }}
    >
      <Emph text={text} brand={brand} />
    </div>
  );
};

const Sub: React.FC<{ text: string; brand: Brand; delay?: number }> = ({ text, brand, delay = 12 }) => {
  const e = useEnter(delay);
  return (
    <div
      style={{
        fontFamily: FONT_BODY,
        fontSize: 42,
        lineHeight: 1.35,
        color: brand.colors.muted,
        opacity: e,
        transform: `translateY(${(1 - e) * 24}px)`,
      }}
    >
      <Emph text={text} brand={brand} />
    </div>
  );
};

// ---------- hook: kinetic word-by-word reveal ----------
const Hook: React.FC<SP> = ({ s, brand }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = (s.heading ?? "").split(/\s+/).filter(Boolean);
  const size = words.join(" ").length > 40 ? 92 : 112;
  let emph = false;
  return (
    <Area>
      {s.tag ? <Tag text={s.tag} brand={brand} /> : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 26px" }}>
        {words.map((w, i) => {
          const start = emph || w.startsWith("*");
          emph = start && !w.endsWith("*");
          const isEmph = start;
          const delay = i * 4;
          const t = Math.max(0, Math.min(1, (frame - delay) / (fps * 0.25)));
          return (
            <span
              key={i}
              style={{
                fontFamily: FONT_HEADING,
                fontWeight: 700,
                fontSize: size,
                lineHeight: 1.05,
                color: isEmph ? brand.colors.accent : brand.colors.text,
                opacity: t,
                transform: `translateY(${(1 - t) * 50}px) scale(${0.85 + 0.15 * t})`,
                display: "inline-block",
              }}
            >
              {w.replace(/\*/g, "")}
            </span>
          );
        })}
      </div>
      {s.subheading ? <Sub text={s.subheading} brand={brand} delay={words.length * 4 + 6} /> : null}
    </Area>
  );
};

const Title: React.FC<SP> = ({ s, brand }) => (
  <Area>
    {s.tag ? <Tag text={s.tag} brand={brand} /> : null}
    <Heading text={s.heading ?? ""} brand={brand} />
    {s.subheading ? <Sub text={s.subheading} brand={brand} /> : null}
  </Area>
);

const Bullets: React.FC<SP> = ({ s, brand, duration }) => {
  const items = s.bullets ?? [];
  const step = Math.min(18, Math.floor((duration * 0.6) / Math.max(items.length, 1)));
  return (
    <Area gap={40}>
      {s.heading ? <Heading text={s.heading} brand={brand} size={72} delay={0} /> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {items.map((b, i) => (
          <BulletRow key={i} text={b} brand={brand} delay={10 + i * step} />
        ))}
      </div>
    </Area>
  );
};

const BulletRow: React.FC<{ text: string; brand: Brand; delay: number }> = ({ text, brand, delay }) => {
  const e = useEnter(delay);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 26,
        padding: "24px 30px",
        borderRadius: 24,
        background: brand.colors.surface,
        border: `1px solid ${brand.colors.text}14`,
        opacity: e,
        transform: `translateX(${(1 - e) * -60}px)`,
      }}
    >
      <Icon name="check" size={52} color={brand.colors.accent} />
      <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 42, color: brand.colors.text, lineHeight: 1.25 }}>
        <Emph text={text} brand={brand} />
      </div>
    </div>
  );
};

// ---------- code ----------
const KW = new Set(
  "def return from import class async await if else elif for while in not and or try except finally with as lambda None True False const let var function export default new yield raise pass is".split(
    " ",
  ),
);
const TOKEN =
  /(#.*$|\/\/.*$)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?)|(@[\w.]+)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|(\s+)|(.)/g;

const highlight = (line: string, brand: Brand) => {
  const out: React.ReactNode[] = [];
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  let i = 0;
  while ((m = TOKEN.exec(line))) {
    const [tok, comment, str, deco, num, ident] = m;
    let color = brand.colors.text;
    if (comment) color = brand.colors.muted;
    else if (str) color = "#9ece6a";
    else if (deco) color = brand.colors.accent;
    else if (num) color = "#ff9e64";
    else if (ident && KW.has(ident)) color = "#bb9af7";
    else if (ident && line[TOKEN.lastIndex] === "(") color = "#7aa2f7";
    out.push(
      <span key={i++} style={{ color, fontStyle: comment ? "italic" : undefined }}>
        {tok}
      </span>,
    );
  }
  return out;
};

const WindowChrome: React.FC<{ title: string; brand: Brand; children: React.ReactNode; bg?: string }> = ({
  title,
  brand,
  children,
  bg,
}) => {
  const e = useEnter(0);
  return (
    <div
      style={{
        borderRadius: 26,
        overflow: "hidden",
        background: bg ?? brand.colors.codeBg,
        border: `1px solid ${brand.colors.text}1f`,
        boxShadow: `0 30px 80px #0008, 0 0 0 1px ${brand.colors.accent}22`,
        opacity: e,
        transform: `translateY(${(1 - e) * 60}px)`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "18px 24px",
          background: `${brand.colors.text}0a`,
          borderBottom: `1px solid ${brand.colors.text}14`,
        }}
      >
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <div key={c} style={{ width: 18, height: 18, borderRadius: 9, background: c }} />
        ))}
        <div style={{ marginLeft: 16, fontFamily: FONT_MONO, fontSize: 26, color: brand.colors.muted }}>{title}</div>
      </div>
      <div style={{ padding: "26px 26px 30px" }}>{children}</div>
    </div>
  );
};

const fitMono = (lines: string[], maxSize = 36) => {
  const longest = Math.max(10, ...lines.map((l) => l.length));
  const byWidth = 780 / (longest * 0.6);
  const byHeight = 720 / (Math.max(lines.length, 1) * 1.5);
  return Math.max(20, Math.min(maxSize, byWidth, byHeight));
};

const Code: React.FC<SP> = ({ s, brand, duration }) => {
  const frame = useCurrentFrame();
  const lines = (s.code ?? "").replace(/\t/g, "    ").split("\n");
  const fs = fitMono(lines);
  const revealEnd = Math.max(20, duration * 0.55);
  const shown = interpolate(frame, [8, revealEnd], [0, lines.length], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const hl = new Set(s.highlight_lines ?? []);
  const hlOn = useProgress(revealEnd, revealEnd + 12);
  return (
    <Area gap={34}>
      {s.heading ? <Heading text={s.heading} brand={brand} size={60} delay={0} /> : null}
      <WindowChrome title={s.filename ?? "main.py"} brand={brand}>
        <div style={{ fontFamily: FONT_MONO, fontSize: fs, lineHeight: 1.5, whiteSpace: "pre" }}>
          {lines.map((line, i) => {
            const vis = Math.max(0, Math.min(1, shown - i));
            const on = hl.has(i + 1);
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  opacity: vis,
                  transform: `translateX(${(1 - vis) * 20}px)`,
                  background: on ? `${brand.colors.accent}${Math.round(hlOn * 0x33).toString(16).padStart(2, "0")}` : undefined,
                  borderLeft: on ? `4px solid ${on && hlOn > 0 ? brand.colors.accent : "transparent"}` : "4px solid transparent",
                  borderRadius: 6,
                }}
              >
                <span style={{ width: fs * 2.2, textAlign: "right", paddingRight: fs * 0.8, color: `${brand.colors.muted}88` }}>
                  {i + 1}
                </span>
                <span>{s.language === "text" ? <span style={{ color: brand.colors.text }}>{line}</span> : highlight(line, brand)}</span>
              </div>
            );
          })}
        </div>
      </WindowChrome>
      {s.subheading ? <Sub text={s.subheading} brand={brand} delay={Math.round(revealEnd)} /> : null}
    </Area>
  );
};

// ---------- terminal ----------
const Terminal: React.FC<SP> = ({ s, brand, duration }) => {
  const frame = useCurrentFrame();
  const lines = s.terminal_lines ?? [];
  const fs = fitMono(lines, 32);
  const per = Math.max(6, Math.floor((duration * 0.7) / Math.max(lines.length, 1)));
  return (
    <Area gap={34}>
      {s.heading ? <Heading text={s.heading} brand={brand} size={60} delay={0} /> : null}
      <WindowChrome title={s.filename ?? "terminal"} brand={brand} bg="#0b0d12">
        <div style={{ fontFamily: FONT_MONO, fontSize: fs, lineHeight: 1.55, whiteSpace: "pre-wrap", minHeight: fs * 6 }}>
          {lines.map((line, i) => {
            const start = 6 + i * per;
            if (frame < start) return null;
            const isCmd = line.startsWith("$ ") || line.startsWith("> ");
            const chars = isCmd ? Math.floor((frame - start) * 1.6) : line.length;
            const text = line.slice(0, chars);
            const color = /\b(4\d\d|5\d\d|error|fail)/i.test(line)
              ? brand.colors.danger
              : /^(!|warn)/i.test(line)
                ? brand.colors.accent
                : /\b(2\d\d|ok|success|passed)\b/i.test(line)
                  ? brand.colors.success
                  : isCmd
                  ? brand.colors.text
                  : brand.colors.muted;
            return (
              <div key={i} style={{ color }}>
                {isCmd ? <span style={{ color: brand.colors.accent }}>{text.slice(0, 2)}</span> : null}
                {isCmd ? text.slice(2) : text}
                {isCmd && chars < line.length && Math.floor(frame / 8) % 2 === 0 ? "▌" : ""}
              </div>
            );
          })}
        </div>
      </WindowChrome>
      {s.illustrative ? (
        <div style={{ fontFamily: FONT_BODY, fontSize: 26, color: brand.colors.muted, marginTop: -16 }}>
          Illustrative output
        </div>
      ) : null}
      {s.subheading ? <Sub text={s.subheading} brand={brand} delay={Math.round(duration * 0.6)} /> : null}
    </Area>
  );
};

// ---------- chat: fictional assistant conversation ----------
const Chat: React.FC<SP> = ({ s, brand, duration }) => {
  const frame = useCurrentFrame();
  const msgs = (s.messages ?? []).slice(0, 4);
  const per = Math.max(14, Math.floor((duration * 0.6) / Math.max(msgs.length, 1)));
  return (
    <Area gap={30}>
      {s.heading ? <Heading text={s.heading} brand={brand} size={60} delay={0} /> : null}
      <WindowChrome title={s.filename ?? "Company Assistant"} brand={brand} bg={brand.colors.surface}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24, minHeight: 300 }}>
          {msgs.map((m, i) => {
            const start = 6 + i * per;
            if (frame < start) return null;
            const user = m.role === "user";
            const typing = !user && frame < start + 12;
            const t = Math.min(1, (frame - start) / 8);
            return (
              <div key={i} style={{ display: "flex", justifyContent: user ? "flex-end" : "flex-start", opacity: t }}>
                <div
                  style={{
                    maxWidth: 700,
                    padding: "20px 26px",
                    borderRadius: 26,
                    borderBottomRightRadius: user ? 6 : 26,
                    borderBottomLeftRadius: user ? 26 : 6,
                    background: user ? `${brand.colors.accent2}33` : brand.colors.codeBg,
                    border: `1px solid ${user ? brand.colors.accent2 : brand.colors.text + "22"}`,
                    fontFamily: FONT_BODY,
                    fontSize: 38,
                    lineHeight: 1.3,
                    color: brand.colors.text,
                    transform: `translateY(${(1 - t) * 20}px)`,
                  }}
                >
                  {!user ? (
                    <div style={{ fontSize: 24, fontWeight: 700, color: brand.colors.accent, marginBottom: 6 }}>AI Assistant</div>
                  ) : null}
                  {typing ? <span style={{ color: brand.colors.muted }}>{"•".repeat(1 + (Math.floor(frame / 5) % 3))}</span> : <Emph text={m.text} brand={brand} />}
                </div>
              </div>
            );
          })}
        </div>
      </WindowChrome>
      {s.illustrative ? (
        <div style={{ fontFamily: FONT_BODY, fontSize: 26, color: brand.colors.muted, marginTop: -16 }}>
          Fictional example
        </div>
      ) : null}
      {s.subheading ? <Sub text={s.subheading} brand={brand} delay={Math.round(duration * 0.6)} /> : null}
    </Area>
  );
};

// ---------- diagram: vertical flow with travelling packet ----------
const Diagram: React.FC<SP> = ({ s, brand, duration }) => {
  const frame = useCurrentFrame();
  const nodes = (s.nodes ?? []).slice(0, 4);
  const step = Math.min(16, Math.floor((duration * 0.5) / Math.max(nodes.length, 1)));
  const nodeH = 132;
  const gapH = nodes.length > 3 ? 70 : 100;
  return (
    <Area gap={30}>
      {s.heading ? <Heading text={s.heading} brand={brand} size={64} delay={0} /> : null}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {nodes.map((n, i) => {
          const appear = Math.max(0, Math.min(1, (frame - (8 + i * step)) / 10));
          const arrowStart = 8 + (i + 1) * step;
          const arrowP = Math.max(0, Math.min(1, (frame - arrowStart + 6) / 10));
          const loop = ((frame - arrowStart) % 30) / 30;
          return (
            <React.Fragment key={i}>
              <div
                style={{
                  width: 820,
                  height: nodeH,
                  display: "flex",
                  alignItems: "center",
                  gap: 28,
                  padding: "0 34px",
                  borderRadius: 28,
                  background: brand.colors.surface,
                  border: `2px solid ${i === nodes.length - 1 ? brand.colors.accent : brand.colors.text + "22"}`,
                  opacity: appear,
                  transform: `scale(${0.9 + 0.1 * appear})`,
                }}
              >
                <Icon name={n.icon} size={70} color={brand.colors.accent} />
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontFamily: FONT_HEADING, fontWeight: 700, fontSize: 46, color: brand.colors.text }}>{n.label}</div>
                  {n.note ? (
                    <div style={{ fontFamily: FONT_BODY, fontSize: 30, color: brand.colors.muted }}>{n.note}</div>
                  ) : null}
                </div>
              </div>
              {i < nodes.length - 1 ? (
                <div style={{ position: "relative", height: gapH, width: 820, display: "flex", justifyContent: "center" }}>
                  <div
                    style={{
                      width: 6,
                      height: gapH * arrowP,
                      background: `linear-gradient(${brand.colors.accent}, ${brand.colors.accent2})`,
                      borderRadius: 3,
                    }}
                  />
                  {arrowP >= 1 ? (
                    <div
                      style={{
                        position: "absolute",
                        top: loop * (gapH - 18),
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        background: brand.colors.accent2,
                        boxShadow: `0 0 20px ${brand.colors.accent2}`,
                      }}
                    />
                  ) : null}
                  {s.edge_labels?.[i] ? (
                    <div
                      style={{
                        position: "absolute",
                        left: 450,
                        top: gapH / 2 - 22,
                        fontFamily: FONT_MONO,
                        fontSize: 28,
                        color: brand.colors.muted,
                        opacity: arrowP,
                      }}
                    >
                      {s.edge_labels[i]}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </Area>
  );
};

// ---------- compare (stacked for 9:16) ----------
const CompareCard: React.FC<{ title: string; points: string[]; good: boolean; brand: Brand; delay: number }> = ({
  title,
  points,
  good,
  brand,
  delay,
}) => {
  const e = useEnter(delay);
  const c = good ? brand.colors.success : brand.colors.danger;
  return (
    <div
      style={{
        padding: "30px 34px",
        borderRadius: 28,
        background: brand.colors.surface,
        border: `2px solid ${c}88`,
        opacity: e,
        transform: `translateY(${(1 - e) * 40}px)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 18 }}>
        <Icon name={good ? "check" : "cross"} size={56} color={c} />
        <div style={{ fontFamily: FONT_HEADING, fontWeight: 700, fontSize: 50, color: c }}>{title}</div>
      </div>
      {points.map((p, i) => (
        <div key={i} style={{ fontFamily: FONT_BODY, fontSize: 38, color: brand.colors.text, lineHeight: 1.4, paddingLeft: 74 }}>
          • {p}
        </div>
      ))}
    </div>
  );
};

const Compare: React.FC<SP> = ({ s, brand, duration }) => (
  <Area gap={34}>
    {s.heading ? <Heading text={s.heading} brand={brand} size={64} delay={0} /> : null}
    {s.left ? <CompareCard {...s.left} good={false} brand={brand} delay={8} /> : null}
    {s.right ? <CompareCard {...s.right} good brand={brand} delay={Math.round(duration * 0.35)} /> : null}
  </Area>
);

// ---------- stat ----------
const Stat: React.FC<SP> = ({ s, brand, duration }) => {
  const value = s.value ?? "";
  const m = value.match(/^([^\d-]*)(-?\d+(?:\.\d+)?)(.*)$/);
  const p = useProgress(6, Math.min(duration * 0.5, 45));
  const shown = m ? `${m[1]}${(parseFloat(m[2]) * p).toFixed(m[2].includes(".") ? m[2].split(".")[1].length : 0)}${m[3]}` : value;
  const e = useEnter(0);
  return (
    <Area>
      {s.heading ? <Heading text={s.heading} brand={brand} size={60} delay={0} /> : null}
      <div
        style={{
          fontFamily: FONT_HEADING,
          fontWeight: 700,
          fontSize: 220,
          lineHeight: 1,
          color: brand.colors.accent,
          transform: `scale(${0.8 + 0.2 * e})`,
        }}
      >
        {shown}
      </div>
      {s.label ? <Sub text={s.label} brand={brand} delay={10} /> : null}
    </Area>
  );
};

const Quote: React.FC<SP> = ({ s, brand }) => (
  <Area>
    <div style={{ fontFamily: FONT_HEADING, fontSize: 220, lineHeight: 0.6, color: brand.colors.accent, opacity: useEnter(0) }}>“</div>
    <Heading text={s.quote ?? s.heading ?? ""} brand={brand} size={70} />
    {s.subheading ? <Sub text={s.subheading} brand={brand} /> : null}
  </Area>
);

const EndCard: React.FC<SP> = ({ s, brand }) => {
  const frame = useCurrentFrame();
  const pulse = 1 + Math.sin(frame / 6) * 0.03;
  const e = useEnter(10);
  return (
    <Area gap={44}>
      <Heading text={s.heading ?? "Save this for later"} brand={brand} size={88} delay={0} />
      {s.subheading ? <Sub text={s.subheading} brand={brand} delay={8} /> : null}
      <div
        style={{
          alignSelf: "flex-start",
          display: "flex",
          alignItems: "center",
          gap: 20,
          padding: "26px 44px",
          borderRadius: 999,
          background: `linear-gradient(90deg, ${brand.colors.accent}, ${brand.colors.accent2})`,
          color: brand.colors.bg,
          fontFamily: FONT_BODY,
          fontWeight: 800,
          fontSize: 46,
          opacity: e,
          transform: `scale(${(0.85 + 0.15 * e) * pulse})`,
        }}
      >
        {s.cta ?? brand.cta} {brand.handle}
      </div>
    </Area>
  );
};

const MAP: Record<Exclude<Scene["type"], "custom">, React.FC<SP>> = {
  hook: Hook,
  title: Title,
  bullets: Bullets,
  code: Code,
  terminal: Terminal,
  chat: Chat,
  diagram: Diagram,
  compare: Compare,
  stat: Stat,
  quote: Quote,
  endcard: EndCard,
};

export const SceneView: React.FC<{ scene: Scene; brand: Brand }> = ({ scene, brand }) => {
  if (scene.type === "custom") {
    const Custom = EPISODES[scene.on_screen.component ?? ""];
    if (!Custom) throw new Error(`Unknown custom scene component: ${scene.on_screen.component}`);
    return <Custom d={scene.duration} c={scene.on_screen.cues} />;
  }
  const C = MAP[scene.type as Exclude<Scene["type"], "custom">] ?? Title;
  return <C s={scene.on_screen} brand={brand} duration={scene.duration} />;
};

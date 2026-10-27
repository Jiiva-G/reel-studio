// Reusable low-poly 3D objects for @remotion/three scenes. All geometry is procedural (no external models).
import React, { useEffect, useState } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { continueRender, delayRender } from "remotion";
import { FONT_BODY, FONT_HEADING, FONT_MONO } from "../theme";

export const C = {
  blue: "#4fa3f7",
  blueDark: "#2c5f99",
  amber: "#f5b653",
  charcoal: "#0f1115",
  panel: "#1d2027",
  green: "#3fb950",
  red: "#f85149",
  paper: "#f4f1ea",
};

const TEXTURES = new Map<string, THREE.CanvasTexture>();

/** Canvas-drawn texture, built synchronously and cached, so it exists on the very first frame an object
 * appears. Fonts must already be loaded: scenes are mounted inside <FontGate> (see Reel.tsx). */
export const useCanvasTexture = (draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number, key: string) => {
  let t = TEXTURES.get(key);
  if (!t) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    draw(canvas.getContext("2d")!, w, h);
    t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.needsUpdate = true;
    TEXTURES.set(key, t);
  }
  return t;
};

/** Holds rendering until web fonts are loaded, then mounts children (once per render tab). */
export const FontGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [handle] = useState(() => delayRender("fonts for canvas textures"));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    document.fonts.ready.then(() => setReady(true));
  }, []);
  useEffect(() => {
    if (ready) continueRender(handle); // after children have mounted and registered their own waits
  }, [ready, handle]);
  return ready ? <>{children}</> : null;
};

/** Sets the camera every frame (Remotion re-renders per frame). */
export const CameraRig: React.FC<{ pos: [number, number, number]; look: [number, number, number]; fov?: number }> = ({ pos, look, fov }) => {
  const { camera } = useThree();
  camera.position.set(...pos);
  if (fov && (camera as THREE.PerspectiveCamera).fov !== fov) {
    (camera as THREE.PerspectiveCamera).fov = fov;
    camera.updateProjectionMatrix();
  }
  camera.lookAt(...look);
  return null;
};

export const StageLights: React.FC<{ warm?: number }> = ({ warm = 6 }) => (
  <>
    <ambientLight intensity={0.55} />
    <directionalLight position={[3, 5, 4]} intensity={2.1} />
    <pointLight position={[-3, 1.5, 3]} intensity={warm} color={C.amber} />
    <pointLight position={[3, -1, 2]} intensity={3} color={C.blue} />
  </>
);

export const Floor: React.FC<{ y?: number; opacity?: number }> = ({ y = -1.2, opacity = 0.35 }) => (
  <group position={[0, y, 0]}>
    <gridHelper args={[40, 40, C.amber, "#3a3d46"]} material-transparent material-opacity={opacity} />
  </group>
);

// ---------------------------------------------------------------- robot
export type Expr = "idle" | "think" | "nervous" | "error" | "happy";

const Eye: React.FC<{ x: number; expr: Expr; t: number }> = ({ x, expr, t }) => {
  if (expr === "error") {
    return (
      <group position={[x, 0.95, 0.63]}>
        {[0.785, -0.785].map((r) => (
          <mesh key={r} rotation={[0, 0, r]}>
            <boxGeometry args={[0.3, 0.06, 0.02]} />
            <meshStandardMaterial color={C.red} emissive={C.red} emissiveIntensity={1.4} />
          </mesh>
        ))}
      </group>
    );
  }
  if (expr === "happy") {
    return (
      <group position={[x, 0.95, 0.63]}>
        <mesh position={[-0.06, 0, 0]} rotation={[0, 0, 0.75]}>
          <boxGeometry args={[0.17, 0.05, 0.02]} />
          <meshStandardMaterial color={C.amber} emissive={C.amber} emissiveIntensity={1.3} />
        </mesh>
        <mesh position={[0.06, 0, 0]} rotation={[0, 0, -0.75]}>
          <boxGeometry args={[0.17, 0.05, 0.02]} />
          <meshStandardMaterial color={C.amber} emissive={C.amber} emissiveIntensity={1.3} />
        </mesh>
      </group>
    );
  }
  const blink = expr === "idle" && t % 75 < 4 ? 0.15 : 1;
  const dx = expr === "think" ? Math.sin(t / 6) * 0.12 : expr === "nervous" ? Math.sin(t * 0.9) * 0.09 : 0;
  const s = expr === "nervous" ? 0.65 : 1;
  return (
    <mesh position={[x + dx, 0.95 + (expr === "think" ? 0.06 : 0), 0.63]} scale={[s, blink * s, 1]}>
      <boxGeometry args={[0.16, 0.22, 0.02]} />
      <meshStandardMaterial color={C.amber} emissive={C.amber} emissiveIntensity={1.2} />
    </mesh>
  );
};

export const Robot3D: React.FC<{
  expr: Expr;
  t: number;
  position?: [number, number, number];
  scale?: number;
  rotY?: number;
  wave?: boolean;
}> = ({ expr, t, position = [0, 0, 0], scale = 1, rotY = 0, wave = false }) => {
  const jitter = expr === "nervous" ? Math.sin(t * 1.7) * 0.035 : 0;
  const bob = Math.sin(t / 12) * 0.06;
  const flicker = expr === "error" ? (t % 6 < 3 ? 0.55 : 0.12) : 0;
  const tilt = expr === "think" ? 0.12 : expr === "happy" ? Math.sin(t / 8) * 0.06 : 0;
  const armL = expr === "happy" ? -0.5 : 0.15;
  const armR = wave ? -2.5 + Math.sin(t / 3.5) * 0.45 : expr === "happy" ? 0.5 : -0.15;
  return (
    <group position={[position[0] + jitter, position[1] + bob, position[2]]} scale={scale} rotation={[0, rotY, tilt]}>
      {/* head */}
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[1.6, 1.2, 1.2]} />
        <meshStandardMaterial color={C.blue} emissive={C.red} emissiveIntensity={flicker} flatShading roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.9, 0.605]}>
        <boxGeometry args={[1.22, 0.78, 0.02]} />
        <meshStandardMaterial color="#0b0d12" roughness={0.3} />
      </mesh>
      <Eye x={-0.3} expr={expr} t={t} />
      <Eye x={0.3} expr={expr} t={t} />
      {/* antenna */}
      <mesh position={[0, 1.62, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.3, 8]} />
        <meshStandardMaterial color="#9aa0aa" />
      </mesh>
      <mesh position={[0, 1.8, 0]}>
        <sphereGeometry args={[0.11, 10, 10]} />
        <meshStandardMaterial
          color={expr === "error" ? C.red : C.amber}
          emissive={expr === "error" ? C.red : C.amber}
          emissiveIntensity={0.6 + 0.5 * Math.abs(Math.sin(t / 10))}
        />
      </mesh>
      {/* body */}
      <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[1.05, 0.9, 0.8]} />
        <meshStandardMaterial color={C.blueDark} flatShading />
      </mesh>
      <mesh position={[0, -0.15, 0.41]}>
        <boxGeometry args={[0.36, 0.12, 0.02]} />
        <meshStandardMaterial color={C.amber} emissive={C.amber} emissiveIntensity={0.5} />
      </mesh>
      {/* arms (pivot at shoulder) */}
      <group position={[-0.62, 0.12, 0]} rotation={[0, 0, armL]}>
        <mesh position={[0, -0.32, 0]}>
          <boxGeometry args={[0.2, 0.64, 0.24]} />
          <meshStandardMaterial color={C.blueDark} flatShading />
        </mesh>
      </group>
      <group position={[0.62, 0.12, 0]} rotation={[0, 0, armR]}>
        <mesh position={[0, -0.32, 0]}>
          <boxGeometry args={[0.2, 0.64, 0.24]} />
          <meshStandardMaterial color={C.blueDark} flatShading />
        </mesh>
      </group>
      {/* shadow */}
      <mesh position={[0, -0.7 - bob, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.85, 24]} />
        <meshBasicMaterial color="#000" transparent opacity={0.35} />
      </mesh>
    </group>
  );
};

// ---------------------------------------------------------------- paper documents
export type PaperSpec = {
  id: string;
  title: string;
  lines: string[];
  big?: string;
  bigColor?: string;
  ribbon?: { text: string; color: string };
};

const drawPaper = (p: PaperSpec) => (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#e5dfd1";
  ctx.fillRect(0, 0, w, 150);
  ctx.fillStyle = "#1d2027";
  ctx.font = `700 50px ${FONT_HEADING}`;
  ctx.fillText(p.title, 50, 95);
  ctx.fillStyle = "#5c6370";
  ctx.font = `400 34px ${FONT_BODY}`;
  p.lines.forEach((l, i) => ctx.fillText(l, 50, 240 + i * 56));
  ctx.fillStyle = "#c9c2b2";
  for (let i = 0; i < 5; i++) ctx.fillRect(50, 640 + i * 46, w - 100 - (i % 2) * 160, 14);
  if (p.big) {
    ctx.fillStyle = p.bigColor ?? "#1d2027";
    ctx.font = `700 120px ${FONT_HEADING}`;
    ctx.fillText(p.big, 50, 560);
  }
  if (p.ribbon) {
    ctx.save();
    ctx.translate(w - 150, 230);
    ctx.rotate(0.6);
    ctx.fillStyle = p.ribbon.color;
    ctx.fillRect(-260, -42, 520, 84);
    ctx.fillStyle = "#fff";
    ctx.font = `800 40px ${FONT_BODY}`;
    ctx.textAlign = "center";
    ctx.fillText(p.ribbon.text, 0, 14);
    ctx.restore();
  }
};

export const Paper3D: React.FC<{
  spec: PaperSpec;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  opacity?: number;
  ghost?: boolean;
}> = ({ spec, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1, opacity = 1, ghost = false }) => {
  const tex = useCanvasTexture(drawPaper(spec), 768, 1010, spec.id);
  if (ghost) {
    // dashed-looking outline + faint fill: "this document should be here"
    return (
      <group position={position} rotation={rotation} scale={scale}>
        <mesh>
          <planeGeometry args={[2.2, 2.9]} />
          <meshBasicMaterial color={C.blue} transparent opacity={0.08 * opacity} />
        </mesh>
        <lineSegments>
          <edgesGeometry args={[new THREE.PlaneGeometry(2.2, 2.9)]} />
          <lineBasicMaterial color={C.blue} transparent opacity={0.9 * opacity} />
        </lineSegments>
      </group>
    );
  }
  // Mount only once the texture exists: three.js won't recompile a material whose map arrives later.
  if (!tex) return null;
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh position={[0.05, -0.05, -0.02]}>
        <planeGeometry args={[2.2, 2.9]} />
        <meshBasicMaterial color="#000" transparent opacity={0.35 * opacity} />
      </mesh>
      <mesh>
        <planeGeometry args={[2.2, 2.9]} />
        <meshStandardMaterial map={tex} transparent opacity={opacity} side={THREE.DoubleSide} roughness={0.9} />
      </mesh>
    </group>
  );
};

/** Flat text label living in 3D space (stays aligned with its object). */
export const Label3D: React.FC<{
  id: string;
  text: string;
  color?: string;
  height?: number;
  position: [number, number, number];
  pill?: string;
  mono?: boolean;
  opacity?: number;
}> = ({ id, text, color = "#f5f5f4", height = 0.45, position, pill, mono, opacity = 1 }) => {
  const W = 1024;
  const H = 160;
  const tex = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.font = `700 96px ${mono ? FONT_MONO : FONT_HEADING}`;
      const tw = Math.min(ctx.measureText(text).width, w - 60);
      if (pill) {
        ctx.fillStyle = pill;
        const x0 = (w - tw) / 2 - 30;
        ctx.beginPath();
        ctx.roundRect(x0, 12, tw + 60, h - 24, 60);
        ctx.fill();
      }
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.fillText(text, w / 2, 116, w - 60);
    },
    W,
    H,
    `label-${id}-${text}-${color}-${pill ?? "none"}`, // restyle => new texture
  );
  if (!tex) return null;
  return (
    <mesh position={position}>
      <planeGeometry args={[(height * W) / H, height]} />
      <meshBasicMaterial map={tex} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
};

// ---------------------------------------------------------------- database, context panel, props
export const Database3D: React.FC<{ glow: number; color?: string; position?: [number, number, number]; scale?: number; t: number }> = ({
  glow,
  color = C.amber,
  position = [0, 0, 0],
  scale = 1,
  t,
}) => (
  <group position={position} scale={scale} rotation={[0.18, t / 90, 0]}>
    {[0, 0.55, 1.1].map((y, i) => (
      <group key={y} position={[0, y - 0.55, 0]}>
        <mesh>
          <cylinderGeometry args={[1.1, 1.1, 0.42, 32]} />
          <meshStandardMaterial color="#232730" metalness={0.4} roughness={0.45} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.115, 0.035, 8, 48]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.2 + glow * (1.4 + 0.4 * Math.sin(t / 4 + i))}
          />
        </mesh>
      </group>
    ))}
  </group>
);

export const ContextPanel3D: React.FC<{ glow: number; position?: [number, number, number]; scale?: number }> = ({
  glow,
  position = [0, 0, 0],
  scale = 1,
}) => {
  const tex = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = "#111318";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#2a2d35";
      ctx.fillRect(0, 0, w, 70);
      ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(40 + i * 40, 35, 12, 0, Math.PI * 2);
        ctx.fill();
      });
      const rows: [string, string][] = [
        ["SYSTEM:", "#9aa0aa"],
        ["CONTEXT [1] [2]", C.amber],
        ["USER: question", "#9aa0aa"],
      ];
      ctx.font = `700 54px ${FONT_MONO}`;
      rows.forEach(([txt, col], i) => {
        ctx.fillStyle = col;
        ctx.fillText(txt, 50, 170 + i * 110);
      });
    },
    768,
    480,
    "context-panel",
  );
  if (!tex) return null;
  return (
    <group position={position} scale={scale}>
      <mesh>
        <boxGeometry args={[2.6, 1.62, 0.08]} />
        <meshStandardMaterial color="#1d2027" emissive={C.amber} emissiveIntensity={glow * 0.25} />
      </mesh>
      <mesh position={[0, 0, 0.045]}>
        <planeGeometry args={[2.5, 1.56]} />
        <meshBasicMaterial map={tex} />
      </mesh>
    </group>
  );
};

export const Magnifier3D: React.FC<{ position: [number, number, number]; rotZ?: number; scale?: number }> = ({ position, rotZ = 0.5, scale = 1 }) => (
  <group position={position} rotation={[0, 0, rotZ]} scale={scale}>
    <mesh>
      <torusGeometry args={[0.55, 0.08, 12, 40]} />
      <meshStandardMaterial color={C.amber} metalness={0.6} roughness={0.3} emissive={C.amber} emissiveIntensity={0.25} />
    </mesh>
    <mesh>
      <circleGeometry args={[0.52, 32]} />
      <meshStandardMaterial color="#9fd3ff" transparent opacity={0.22} />
    </mesh>
    <mesh position={[0, -0.95, 0]}>
      <cylinderGeometry args={[0.07, 0.09, 0.85, 12]} />
      <meshStandardMaterial color="#3a3d46" />
    </mesh>
  </group>
);

export const Lamp3D: React.FC<{ swing: number; on: boolean }> = ({ swing, on }) => (
  <group position={[0, 3.1, 0]} rotation={[0, 0, swing]}>
    <mesh position={[0, 0.8, 0]}>
      <cylinderGeometry args={[0.02, 0.02, 1.6, 6]} />
      <meshStandardMaterial color="#555" />
    </mesh>
    <mesh>
      <coneGeometry args={[0.75, 0.7, 24, 1, true]} />
      <meshStandardMaterial color="#2a2d35" side={THREE.DoubleSide} metalness={0.5} />
    </mesh>
    <mesh position={[0, -0.25, 0]}>
      <sphereGeometry args={[0.2, 12, 12]} />
      <meshStandardMaterial color="#fff6dc" emissive={C.amber} emissiveIntensity={on ? 2.2 : 0.1} />
    </mesh>
    {on ? <spotLight position={[0, -0.3, 0]} target-position={[0, -6, 0]} angle={0.6} penumbra={0.55} intensity={240} decay={1.2} color="#ffe2a8" /> : null}
  </group>
);

/** Glowing beam between two y-levels; `p` = fill 0..1, packets loop when lit. */
export const Beam3D: React.FC<{ x?: number; y0: number; y1: number; p: number; t: number; color?: string }> = ({
  x = 0,
  y0,
  y1,
  p,
  t,
  color = C.amber,
}) => {
  const len = Math.abs(y1 - y0) * p;
  const dir = Math.sign(y1 - y0);
  return (
    <group>
      <mesh position={[x, y0 + (dir * len) / 2, 0]}>
        <cylinderGeometry args={[0.05, 0.05, Math.max(len, 0.001), 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} />
      </mesh>
      {p >= 1
        ? [0, 0.5].map((o) => {
            const k = ((t / 40 + o) % 1 + 1) % 1;
            return (
              <mesh key={o} position={[x, y0 + (y1 - y0) * k, 0]}>
                <sphereGeometry args={[0.12, 10, 10]} />
                <meshStandardMaterial color={C.blue} emissive={C.blue} emissiveIntensity={2} />
              </mesh>
            );
          })
        : null}
    </group>
  );
};


// ---------------------------------------------------------------- episode #02 additions
/** Deterministic pseudo-random in [0,1) from an integer seed. */
export const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const Key3D: React.FC<{ position?: [number, number, number]; rotation?: [number, number, number]; scale?: number; color?: string; glow?: number }> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  color = C.amber,
  glow = 0.4,
}) => (
  <group position={position} rotation={rotation} scale={scale}>
    <mesh position={[-0.55, 0, 0]}>
      <torusGeometry args={[0.32, 0.1, 12, 32]} />
      <meshStandardMaterial color={color} metalness={0.7} roughness={0.25} emissive={color} emissiveIntensity={glow} />
    </mesh>
    <mesh position={[0.25, 0, 0]}>
      <boxGeometry args={[1.0, 0.14, 0.1]} />
      <meshStandardMaterial color={color} metalness={0.7} roughness={0.25} emissive={color} emissiveIntensity={glow} />
    </mesh>
    {[0.45, 0.7].map((x) => (
      <mesh key={x} position={[x, -0.14, 0]}>
        <boxGeometry args={[0.1, 0.18, 0.1]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.25} emissive={color} emissiveIntensity={glow} />
      </mesh>
    ))}
  </group>
);

export const Island3D: React.FC<{ position: [number, number, number]; edge?: string; glow?: number; scale?: number; children?: React.ReactNode }> = ({
  position,
  edge = C.amber,
  glow = 0,
  scale = 1,
  children,
}) => (
  <group position={position} scale={scale}>
    <mesh>
      <cylinderGeometry args={[1.15, 1.25, 0.28, 40]} />
      <meshStandardMaterial color="#232730" metalness={0.3} roughness={0.6} />
    </mesh>
    <mesh position={[0, 0.145, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[1.15, 0.035, 8, 64]} />
      <meshStandardMaterial color={edge} emissive={edge} emissiveIntensity={0.15 + 1.6 * glow} />
    </mesh>
    {children}
  </group>
);

export const BackupDisc3D: React.FC<{ position?: [number, number, number]; scale?: number; color?: string }> = ({ position = [0, 0, 0], scale = 1, color = C.blue }) => (
  <group position={position} scale={scale}>
    {[0, 0.16].map((y) => (
      <mesh key={y} position={[0, y, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.12, 32]} />
        <meshStandardMaterial color="#2a3240" emissive={color} emissiveIntensity={0.25} metalness={0.4} />
      </mesh>
    ))}
  </group>
);

export const Vault3D: React.FC<{ position?: [number, number, number]; scale?: number; closed: number; color?: string }> = ({
  position = [0, 0, 0],
  scale = 1,
  closed,
  color = C.green,
}) => (
  <group position={position} scale={scale}>
    <mesh>
      <boxGeometry args={[1.3, 1.05, 0.55]} />
      <meshStandardMaterial color="#2a2d35" metalness={0.6} roughness={0.35} />
    </mesh>
    <mesh position={[0, 0.02, 0.29]}>
      <circleGeometry args={[0.16, 24]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3 + 1.2 * closed} />
    </mesh>
    <mesh position={[0, 0.52 + 0.35 * (1 - closed), 0]}>
      <torusGeometry args={[0.38, 0.09, 10, 32, Math.PI]} />
      <meshStandardMaterial color="#9aa0aa" metalness={0.8} roughness={0.2} />
    </mesh>
  </group>
);

/** Burst of small cubes flying out from `origin` after frame `start` (deterministic). */
export const Shatter3D: React.FC<{ t: number; start: number; origin: [number, number, number]; color?: string; count?: number; spread?: number }> = ({
  t,
  start,
  origin,
  color = C.amber,
  count = 70,
  spread = 3.2,
}) => {
  if (t < start) return null;
  const k = (t - start) / 30;
  return (
    <group position={origin}>
      {Array.from({ length: count }).map((_, i) => {
        const th = rnd(i) * Math.PI * 2;
        const ph = (rnd(i + 99) - 0.3) * Math.PI * 0.9;
        const sp = spread * (0.5 + rnd(i + 7));
        const x = Math.cos(th) * Math.cos(ph) * sp * k;
        const y = Math.sin(ph) * sp * k - 2.2 * k * k;
        const z = Math.sin(th) * Math.cos(ph) * sp * k;
        const s = Math.max(0, 0.16 * (1 - k * 0.7)) * (0.5 + rnd(i + 3));
        return (
          <mesh key={i} position={[x, y, z]} rotation={[k * 6 * rnd(i + 5), k * 5 * rnd(i + 6), 0]} scale={s}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={i % 4 === 0 ? C.red : color} emissive={i % 4 === 0 ? C.red : color} emissiveIntensity={0.9} />
          </mesh>
        );
      })}
    </group>
  );
};

/** A glowing beam from a to b, drawn to fraction p (cylinder oriented along the segment). */
export const Ray3D: React.FC<{ a: [number, number, number]; b: [number, number, number]; p: number; color?: string; radius?: number }> = ({
  a,
  b,
  p,
  color = C.red,
  radius = 0.05,
}) => {
  if (p <= 0) return null;
  const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = dir.length() * Math.min(1, p);
  const mid = new THREE.Vector3(a[0], a[1], a[2]).add(dir.clone().normalize().multiplyScalar(len / 2));
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return (
    <mesh position={mid} quaternion={q}>
      <cylinderGeometry args={[radius, radius, len, 10]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
    </mesh>
  );
};

/** Flat glowing ring on the ground plane (blast radius). */
export const Ring3D: React.FC<{ position: [number, number, number]; radius: number; color?: string; opacity?: number }> = ({
  position,
  radius,
  color = C.red,
  opacity = 0.9,
}) => (
  <group position={position} rotation={[-Math.PI / 2, 0, 0]}>
    <mesh>
      <torusGeometry args={[radius, 0.045, 8, 96]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} transparent opacity={opacity} />
    </mesh>
    <mesh>
      <circleGeometry args={[radius, 64]} />
      <meshBasicMaterial color={color} transparent opacity={0.08 * opacity} />
    </mesh>
  </group>
);
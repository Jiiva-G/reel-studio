# Custom scenes

The eleven scene templates cover most explainers. When a reel needs something bespoke (a 3D set piece, a product
UI walkthrough), write a **custom scene**: a React component rendered by Remotion.

## 1. Write the component

```tsx
// renderer/src/episodes/private/my-reel.tsx   (the private/ folder is git-ignored)
import React from "react";
import { useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { CameraRig, Floor, Robot3D, StageLights } from "../../kit/three-kit";
import { Kinetic, Stamp } from "../../kit/fx";

type P = { d: number; c?: Record<string, number> }; // d = scene length in frames, c = cue frames

const Intro: React.FC<P> = ({ d }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", top: 400, width: 1080, height: 800 }}>
        <ThreeCanvas width={1080} height={800}>
          <CameraRig pos={[0, 0.9, 7]} look={[0, 0.5, 0]} fov={40} />
          <StageLights />
          <Robot3D expr={f > d / 2 ? "happy" : "think"} t={f} />
          <Floor y={-0.75} />
        </ThreeCanvas>
      </div>
      <Kinetic text="Meet your *agent*" at={10} size={110} y={300} />
      <Stamp text="SHIPPED" color="#e85450" at={45} x={540} y={1150} />
    </div>
  );
};

export const MY_REEL = { Intro };
```

## 2. Register it

```ts
// renderer/src/episodes/index.ts
import { MY_REEL } from "./private/my-reel";
export const EPISODES: Record<string, EpisodeScene> = { ...MY_REEL };
```

## 3. Use it in a storyboard

```json
{ "type": "custom", "narration": "Meet your agent.", "on_screen": { "component": "Intro" }, "transition": "fade" }
```

`validate` checks that custom scenes name a component; their layout is checked visually in the QA frames.

## Timing to your narration

With your own recording (`reel-studio narration`), each scene gets a frame window aligned to the pauses in your
voice, and `on_screen.cues` can carry frame numbers for key words so animations land on them.

## Kits

- `kit/three-kit.tsx`: Robot3D (expressions idle, think, nervous, error, happy), Paper3D, Label3D, Database3D,
  ContextPanel3D, Magnifier3D, Lamp3D, Beam3D, Key3D, Island3D, Vault3D, Shatter3D, Ring3D, CameraRig, StageLights,
  Floor. Canvas textures are cached synchronously so text never flickers between frames.
- `kit/fx.tsx`: Particles, Stamp, Cursor, Glitch, Chip, Kinetic text, Laptop, Bubble, typing and easing helpers.

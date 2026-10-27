import React from "react";
import { Composition, Still } from "remotion";
import { Cover, Reel } from "./Reel";
import { CoverProps, ReelProps } from "./types";
import demo from "./demo-props.json";

const demoProps = demo as unknown as ReelProps;

export const Root: React.FC = () => (
  <>
    <Composition
      id="Reel"
      component={Reel}
      defaultProps={demoProps}
      durationInFrames={demoProps.durationInFrames}
      fps={demoProps.fps}
      width={demoProps.width}
      height={demoProps.height}
      calculateMetadata={({ props }) => ({
        durationInFrames: props.durationInFrames,
        fps: props.fps,
        width: props.width,
        height: props.height,
      })}
    />
    <Still
      id="Cover"
      component={Cover}
      width={1080}
      height={1920}
      defaultProps={{ brand: demoProps.brand, title: "Demo *cover*", subtitle: "Reel Studio", tag: "demo" } as CoverProps}
    />
  </>
);

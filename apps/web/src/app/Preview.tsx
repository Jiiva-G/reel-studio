import React, { useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { Reel } from "@renderer/Reel";
import { Icon } from "./ui";
import { FPS, fmtTime, sceneTimings, toReelProps } from "../lib/timeline";
import type { Project } from "../lib/types";

/** The real renderer scenes in Remotion Player. Timing is the engine's pre-voice estimate. */
export const Preview: React.FC<{ project: Project; selected: number; onSelect: (i: number) => void; open: boolean; onClose: () => void }> = ({ project, selected, onSelect, open, onClose }) => {
  const props = useMemo(() => toReelProps(project), [project]);
  const times = useMemo(() => sceneTimings(project), [project]);
  const ref = useRef<PlayerRef>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const total = props.durationInFrames;

  useEffect(() => {
    const p = ref.current;
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    p.addEventListener("frameupdate", onFrame);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    return () => { p.removeEventListener("frameupdate", onFrame); p.removeEventListener("play", onPlay); p.removeEventListener("pause", onPause); };
  }, []);

  // jump to the selected scene (a little past its start so the entrance has played)
  useEffect(() => {
    const t = times[selected];
    if (t && ref.current && !ref.current.isPlaying()) ref.current.seekTo(Math.min(t.from + 24, t.from + t.duration - 1));
  }, [selected, times]);

  const sceneAt = (f: number) => Math.max(0, times.findIndex((t) => f >= t.from && f < t.from + t.duration));

  return (
    <aside className={`preview${open ? " open" : ""}`} aria-label="Preview">
      <button className="btn close-preview" onClick={onClose}><Icon name="x" />Close preview</button>
      <div className="player">
        <Player ref={ref} component={Reel} inputProps={props} durationInFrames={Math.max(1, total)} fps={FPS}
          compositionWidth={1080} compositionHeight={1920} style={{ width: "100%", height: "100%" }}
          loop clickToPlay={false} spaceKeyToPlayOrPause={false} />
      </div>
      <div className="ptime">
        <span className="ctl">
          <button className="icon-btn" aria-label={playing ? "Pause" : "Play"} onClick={() => ref.current?.toggle()}><Icon name={playing ? "pause" : "play"} /></button>
          <span className="num">{fmtTime(frame / FPS)}</span>
        </span>
        <span className="num">{fmtTime(total / FPS)}</span>
      </div>
      <div className="timeline" role="group" aria-label="Scenes on the timeline">
        {times.map((t, i) => (
          <button key={project.scenes[i].uid} style={{ flex: t.duration }} aria-current={i === sceneAt(frame)}
            aria-label={`Scene ${i + 1}, ${t.seconds.toFixed(1)} seconds`} onClick={() => { onSelect(i); ref.current?.seekTo(t.from); }}>{i + 1}</button>
        ))}
        <span className="playhead" style={{ left: `${(frame / Math.max(1, total)) * 100}%` }} aria-hidden="true" />
      </div>
      <p className="est">Silent preview. Timing is estimated from narration length; the local render uses the real voice timing.</p>
    </aside>
  );
};

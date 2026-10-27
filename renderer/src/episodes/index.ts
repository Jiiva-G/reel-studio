// Registry of hand-built "custom" scene components, looked up by a storyboard scene's on_screen.component.
// Add your own: create a file here that exports components ({ d: duration in frames, c: cue frames }),
// import it below and spread it into EPISODES. See docs/custom-scenes.md.
import type React from "react";

export type EpisodeScene = React.FC<{ d: number; c?: Record<string, number> }>;

export const EPISODES: Record<string, EpisodeScene> = {};

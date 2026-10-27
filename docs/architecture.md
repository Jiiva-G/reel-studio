# Architecture

```
content.md ──▶ script ──▶ storyboard.json ──▶ validate ──▶ voice ──────────────┐
   (notes)     (Gemini,      (scenes,          (layout     (TTS per scene, or │
               or import)    narration,        limits)     your recording)    ▼
                             on-screen)                               timeline.json (frames, captions,
                                                                      sound-effect times, music curve)
                                                                                 │
                         ┌───────────────────────────────────────────────────────┤
                         ▼                                                       ▼
                  sound (FFmpeg)                                         render (Remotion)
   procedural music + effects, sidechain ducking,           React scene templates → H.264 → FFmpeg re-encode
   two-pass EBU R128 loudnorm to −14 LUFS / −1.5 dBTP         (TV range, BT.709, faststart) + cover.png
                         └──────────────────────────┬────────────────────────────┘
                                                    ▼
                                         qa → render_report.md
```

## Principles

- **Stages are resumable.** Each stage records its status in `project.json`; voice clips are cached by a hash of
  their text and voice settings, so editing one scene re-voices only that scene.
- **Paid calls are gated.** Stages that send data to an API stop until the project is approved (`--approve-api`).
- **One set of storyboard rules.** `reelstudio/studio/script.py` defines scene types, text limits and required
  fields; `schema/rules.json` exports them for the browser editor, and a test keeps the two in sync.
- **Picture and sound share one timeline.** `timeline.json` drives both the Remotion props and the FFmpeg mix, so
  sound effects land on the frames their animations use.
- **The renderer is plain React.** The same scene components run in the CLI render and in the browser editor's
  live preview (Remotion Player); only the voice timing differs.

## Timing modes

| Mode | Source of scene lengths |
|---|---|
| TTS (default) | Each scene lasts as long as its voice clip plus a short lead and tail (`timeline.build`). |
| Your recording | `reel-studio narration` finds scene boundaries in your file (DTW alignment to TTS clips, or script-length estimates snapped to pauses) and stores frame windows and captions (`timeline.build_from_narration`). |
| Browser preview | Estimated from narration length (~14 characters per second). Labelled as an estimate in the editor. |

## QA checks

Output exists, resolution, frame rate, duration against the timeline, H.264/yuv420p and AAC codecs, full decode,
black gaps, narration present (or flagged as a silent placeholder), long silent gaps, clipping (peak ≤ −0.5 dBFS),
audio/video stream sync, narration starting in the hook, captions in every scene, a non-blank end card, and a
contact sheet plus per-scene frames. Visual review of those frames is reported as not automated. The mix's
loudness (−14 LUFS target) is measured during the sound stage and listed in the report.

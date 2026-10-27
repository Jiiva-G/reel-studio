# Reel Studio

Turn written content into a polished 9:16 short video (Instagram Reels, YouTube Shorts, TikTok):
storyboard → voice-over → sound design → [Remotion](https://www.remotion.dev) render → automated QA.

Reel Studio runs **on your machine**. It never needs a server, and it only calls an AI API when you
approve it for a project, using **your own** keys.

> **Status:** v0.1, early release. This repository holds the local engine, the renderer and the free browser
> editor (`apps/web`, to be hosted at <https://studio.jeevag.in>). The editor writes and previews the storyboard;
> the engine renders the video on your machine.

## What it does

| Stage | What happens | Needs |
|---|---|---|
| `script` | Writes a brief, narration and a scene-by-scene storyboard from your notes | Gemini key (or write/import the storyboard yourself) |
| `validate` | Checks every scene against the layout limits (text that would not fit is an error) | — |
| `voice` | Voice-over per scene, or your own recording of the whole script | Gemini or Sarvam key, Edge TTS (opt-in), **or nothing** (your recording / silent) |
| `sound` | Original procedural music bed + sound effects, ducked under the voice, mastered to −14 LUFS | — |
| `render` | 1080×1920 H.264 MP4 (BT.709, faststart) and a cover image, rendered with Remotion | Node.js |
| `qa` | Resolution, codecs, duration, A/V sync, full decode, black gaps, silences, clipping, captions, contact sheet | — |

Scene templates: hook, title, bullets, code, terminal, chat, diagram, compare, stat, quote, end card. All support
captions, transitions and your brand colours.

## Requirements

- **Python 3.11+** and [uv](https://docs.astral.sh/uv/)
- **Node.js 20+** (for the Remotion renderer)
- **FFmpeg** (`ffmpeg` and `ffprobe` on your PATH)
- Windows, macOS or Linux

## Install

```bash
git clone https://github.com/Jiiva-G/reel-studio.git
cd reel-studio
uv sync                       # Python engine + the `reel-studio` command
cd renderer && npm ci && cd ..  # renderer dependencies (Remotion downloads a headless Chrome on first render)
```

## Quick start (no API keys)

```bash
uv run reel-studio demo
```

This renders a short demo reel from `examples/demo/` with silent placeholder narration and prints where the MP4,
cover and QA report are. Nothing leaves your machine.

## Make your own reel

**Option A: write the storyboard with AI (your Gemini key)**

```bash
uv run reel-studio new --content notes.md --approve-api       # drafts script.md + storyboard.json, then stops
# review projects/<project>/script.md and storyboard.md; edit storyboard.json if you like
uv run reel-studio run <project> --from voice --approve-api   # voice, sound, render, QA
```

**Option B: from the browser editor** — write and preview the reel in the browser, export a `.reelstudio.zip`, then:

```bash
uv run reel-studio import my-reel.reelstudio.zip
uv run reel-studio run <project> --from voice --voice-provider none   # silent, or use your own TTS keys
```

**Use your own voice** (WAV/FLAC of the whole script; the original file is never modified):

```bash
uv run reel-studio narration <project> my-recording.wav
uv run reel-studio run <project> --only voice,sound,render,qa
```

`<project>` can be the folder name or any unique part of it. `uv run reel-studio status <project>` shows progress.

## API keys (optional)

| Key | Used for | Get one |
|---|---|---|
| `GEMINI_API_KEY` | script writing, reference analysis, Gemini TTS | <https://aistudio.google.com/apikey> |
| `SARVAM_API_KEY` | Indian-language voices (Tamil, Tanglish) | <https://dashboard.sarvam.ai> |
| `GROQ_API_KEY` | transcribing a reference video (`analyze`) | <https://console.groq.com/keys> |

Reel Studio looks for each key in this order: environment variable → `.env` file (copy `.env.example`) → your OS
keyring (`uv run reel-studio keys` stores them with hidden input). Key values are never printed or logged.

**Approval and cost:** the first stage that sends data to an API stops and asks for `--approve-api`; approval is
stored per project. Free tiers may apply, otherwise usage is billed to your own accounts.

## Voice providers

| `--voice-provider` | Notes |
|---|---|
| `auto` (default) | Sarvam for Tamil/Tanglish when `SARVAM_API_KEY` is set, otherwise Gemini TTS. Never Edge. |
| `gemini`, `sarvam` | Use that provider (key required) |
| `edge` | Microsoft Edge online TTS via [edge-tts](https://github.com/rany2/edge-tts): no key, but an **unofficial** service that may change or stop working. Opt-in only. |
| `none` | Silent placeholder of the estimated length (testing, or add your own recording later) |

## Brands

`brands/reel-studio.json` is the default look. Copy it to `brands/<name>.json`, change the name, handle, colours,
voice and music, and pass `--brand <name>` (or a path to the file). Projects imported from the editor carry
their own `brand.json`.

## Optional extras

- **Scored soundtrack:** `uv run reel-studio score <project> --cinetic <path>` composes music and effects locked
  to the timeline with the MIT-licensed [cinetic](https://github.com/Leonxlnx/cinetic) skill (install it
  separately). Then run `--only sound,render,qa`.
- **Analyse a video you have the rights to:** `uv run reel-studio analyze clip.mp4 --reference` (Groq + Gemini).
  Reel Studio does not download videos from social networks; use local files.
- **Custom scenes:** add React components to `renderer/src/episodes/` and register them in
  `renderer/src/episodes/index.ts` (see [docs/custom-scenes.md](docs/custom-scenes.md)).
- **Claude Code:** [integrations/claude-code](integrations/claude-code/) has a `/reel-studio` skill.

## Development

```bash
uv run python -m unittest discover -s tests -v   # offline tests (no network, APIs mocked)
uv run ruff check .
cd renderer && npm run typecheck
uv run python scripts/smoke_render.py            # renders the demo and checks the MP4 (needs Node + FFmpeg)
```

The browser editor and website live in `apps/web` (Vite + React; the preview uses the renderer's own scenes in
Remotion Player):

```bash
cd apps/web && npm ci
npm run dev          # http://localhost:5173 — website at /, editor at /app/
npm test             # unit tests (validation, timing and bundle format ported from the engine)
npm run build && npm run e2e   # end-to-end and accessibility tests on the production build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/](docs/).

## Troubleshooting

| Problem | Fix |
|---|---|
| `ffmpeg not found` | Install FFmpeg and make sure `ffmpeg` and `ffprobe` are on your PATH. |
| `Renderer dependencies missing` | Run `npm ci` in `renderer/`. |
| Blank or black 3D scenes on Linux servers | Rendering uses SwiftShader (`swangle`) on Linux by default; set `REEL_STUDIO_GL=angle-egl` on a machine with a GPU. |
| `No voice provider available` | Set `GEMINI_API_KEY` or `SARVAM_API_KEY`, or pass `--voice-provider none`. |
| `APPROVAL NEEDED` | The stage would send data to an AI API. Re-run with `--approve-api` if that is OK. |
| Storyboard errors | Messages name the scene and field that is too long or missing; edit `storyboard.json` and run `validate`. |
| Projects in a different folder | Set `REEL_STUDIO_PROJECTS=/path/to/projects`. |

## Licence

Reel Studio is released under the [MIT Licence](LICENSE).

**Remotion has its own licence.** Reel Studio's renderer uses Remotion, which is free for individuals and small
companies but requires a paid company licence for larger organisations. Check
<https://www.remotion.dev/license> before using Reel Studio commercially. Other third-party components are listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

You are responsible for having the rights to the content, recordings, fonts, music and reference videos you use.

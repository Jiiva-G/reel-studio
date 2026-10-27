---
name: reel-studio
description: Produce finished 9:16 short-video MP4s (Reels, Shorts, TikTok) from the user's content with the local Reel Studio pipeline (storyboard, voice-over, sound design, Remotion render, QA). Use when the user wants a reel or short video made from notes, wants to import a Reel Studio editor bundle, use their own narration recording, or revise/re-render a Reel Studio project.
---

# Reel Studio

Copy this folder to `.claude/skills/reel-studio/` in your workspace. Run every command from the Reel Studio
repository root with `uv run reel-studio ...` (see README.md there for all options).

## Hard rules
- Never ask the user to paste API keys into the chat, and never print, echo or write key values. Check with
  `uv run reel-studio keys --status` (Present/Missing only). To add keys, the user edits `.env` (from
  `.env.example`) or runs `uv run reel-studio keys` themselves.
- Before the first API-using stage of a project, tell the user what is sent where (script: content text to
  Gemini; voice: narration text to Gemini or Sarvam; analyze: video to Gemini and audio to Groq) and get a yes.
  Then pass `--approve-api`. Without approval use `--voice-provider none` or an imported recording.
- Reference videos must be local files the user has the right to use. Do not download videos from social
  networks. References are style guidance only: never reuse their audio, footage, narration or logos.
- Never invent facts, statistics or results. Surface the storyboard's `unverified_claims` to the user.
- Report QA results faithfully from `render_report.md`. Never overwrite a previous render: set versioned names
  in `storyboard.json` → `output` (`video`, `cover`, `report`, `qa_dir`) before re-rendering.

## Workflow
1. Save the user's content to a Markdown file, then:
   `uv run reel-studio new --content notes.md --language english --duration 45 [--approve-api]`
   It stops after writing `script.md`, `storyboard.md` and `storyboard.json`. Show the user the script and scene
   table and ask for changes. Edit `storyboard.json` directly for changes, then `uv run reel-studio validate <project>`.
2. After approval: `uv run reel-studio run <project> --from voice [--voice-provider ...] [--approve-api]`.
3. Read `render_report.md`, look at `qa/contact_sheet.png`, and report the MP4 path and QA results.

## Other tasks
- Editor bundle: `uv run reel-studio import file.reelstudio.zip`, then step 2.
- User's own recording: `uv run reel-studio narration <project> recording.wav`, then
  `uv run reel-studio run <project> --only voice,sound,render,qa`.
- Offline check that everything works: `uv run reel-studio demo`.

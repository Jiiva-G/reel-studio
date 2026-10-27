# Project bundle format (v1)

The browser editor exports a project as `<name>.reelstudio.zip`. The engine imports it with:

```bash
uv run reel-studio import my-reel.reelstudio.zip
uv run reel-studio run <project> --from voice --voice-provider none   # or a TTS provider with your keys
```

## Zip contents

| File | Purpose |
|---|---|
| `bundle.json` | Everything the engine needs (below). The only file the engine reads. |
| `README.md` | Human-readable render instructions. |
| `content.md` | Your notes, for reference (a copy is also inside `bundle.json`). |

## `bundle.json`

```json
{
  "format": "reel-studio.bundle",
  "version": 1,
  "generator": "Reel Studio web 0.1.0",
  "project": { "name": "Caching 101", "language": "english", "duration_s": 45 },
  "brand": {
    "name": "Acme", "handle": "@acme", "cta": "Follow",
    "colors": { "bg": "#0b0f0d", "accent": "#e85450" },
    "fonts": { "heading": "Space Grotesk", "body": "Inter", "code": "JetBrains Mono" }
  },
  "content": "# Notes ...",
  "storyboard": {
    "title": "Caching 101",
    "cover_text": "Cache the *hot* path",
    "caption": "Post caption ...",
    "hashtags": ["#webdev"],
    "scenes": [
      {
        "type": "hook",
        "narration": "Your API is slow.",
        "subtitle": "Your API is slow.",
        "on_screen": { "heading": "Your API is *slow*" },
        "transition": "zoom",
        "sfx": ["impact"],
        "music_intensity": "medium",
        "visual": "Optional direction for the scene"
      }
    ]
  }
}
```

### Rules

- `format` must be `reel-studio.bundle` and `version` must be `1`.
- `project.language`: `english`, `tamil` or `tanglish` (anything else becomes `english`).
- `brand`: only `name`, `handle`, `cta`, `colors` (keys `bg`, `bg2`, `surface`, `text`, `muted`, `accent`,
  `accent2`, `codeBg`, `success`, `danger`; values `#rgb` or `#rrggbb`) and `fonts` are read. Missing values come
  from the default brand (`brands/reel-studio.json`), including the voice and music settings.
- `storyboard.scenes`: at least one scene. Scene types, transitions, sound effects, icons, text limits and required
  `on_screen` fields per type are defined in [`schema/rules.json`](../schema/rules.json), the same file the
  editor validates against. Unknown fields are ignored.
- Wrap one or two words of a heading in `*asterisks*` to colour them with the brand accent.

### Safety

The engine parses `bundle.json` (max 2 MB) as data, uses whitelisted fields only, and never extracts files from
the zip, so a bundle cannot write files or point the engine at paths on your machine.

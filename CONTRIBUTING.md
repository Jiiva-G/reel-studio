# Contributing

Thanks for helping improve Reel Studio.

## Set up

```bash
uv sync
cd renderer && npm ci && cd ..
uv run reel-studio demo          # renders without any API key
```

## Before opening a pull request

```bash
uv run ruff check .
uv run python -m unittest discover -s tests -v
cd renderer && npm run typecheck && cd ..
cd apps/web && npm test && npm run build && npm run e2e && cd ../..
uv run python scripts/smoke_render.py     # end-to-end render, about a minute
uv run python scripts/check_repo.py       # no media, secrets or large files in the tree
```

- Tests must not call real APIs: mock them (see `tests/test_offline.py`).
- If you change scene types, limits or required fields in `reelstudio/studio/script.py`, run
  `uv run python scripts/export_rules.py` so the browser editor uses the same rules. The editor's validation
  (`apps/web/src/lib/validate.ts`) and preview timing (`timeline.ts`) are ports of the engine's; keep them in step.
- Never commit API keys, `.env` files, recordings, rendered videos or projects. `.gitignore` covers the usual
  paths and CI scans every push.
- Keep pull requests focused and describe what you verified.

## Project layout

| Path | What |
|---|---|
| `reelstudio/` | Python engine and the `reel-studio` CLI |
| `renderer/` | Remotion compositions: scene templates, captions, transitions, cover, 3D and effects kits |
| `apps/web/` | Website and browser editor (Vite + React); projects in IndexedDB, preview in Remotion Player |
| `schema/rules.json` | Storyboard rules shared with the browser editor (generated) |
| `brands/` | Brand profiles (`reel-studio.json` is the default) |
| `examples/` | Demo storyboard used by `reel-studio demo` |
| `docs/` | Bundle format, custom scenes, architecture |
| `scripts/` | Smoke render, repo checks, rules export, licence report |

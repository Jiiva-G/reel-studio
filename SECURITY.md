# Security

## Reporting a vulnerability

Please report security issues privately through GitHub's
[private vulnerability reporting](https://github.com/Jiiva-G/reel-studio/security/advisories/new)
rather than in a public issue. Include steps to reproduce and the affected version or commit.

## How Reel Studio handles your data

- **API keys** are read from environment variables, a git-ignored `.env` file or your OS keyring. They are never
  printed, logged or written to project files; error messages are passed through a redaction step.
- **AI calls** only happen after you approve them for a project (`--approve-api`), and only with your own keys.
  `reel-studio demo`, `--voice-provider none`, imported bundles and imported recordings work fully offline.
- **Your content** (notes, storyboards, recordings, renders) stays in your local `projects/` folder, which is
  git-ignored. Reel Studio has no server and no telemetry.
- **Reference videos** must be local files you have the right to use. Reel Studio does not download from social
  networks or use any login session.
- **Bundles** from the browser editor are read as data only: one JSON file is parsed with a size limit, only known
  fields are used, and nothing is extracted from the zip to disk.

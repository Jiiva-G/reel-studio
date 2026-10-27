"""API key lookup: environment variables first, then a `.env` file, then the OS keyring.

Key values are never printed. Use `redact()` on any text that might echo a key
(exception messages, API error bodies) before showing or saving it.
"""
from __future__ import annotations

import os
from pathlib import Path

SERVICE = "reel-studio"
KNOWN_KEYS = ("GROQ_API_KEY", "GEMINI_API_KEY", "SARVAM_API_KEY")
ROOT = Path(__file__).resolve().parents[1]

_dotenv_cache: dict[str, str] | None = None


class MissingKeyError(RuntimeError):
    pass


def _dotenv() -> dict[str, str]:
    """KEY=value lines from ./.env or <repo>/.env (first found). Comments and blank lines are ignored."""
    global _dotenv_cache
    if _dotenv_cache is None:
        _dotenv_cache = {}
        for path in (Path.cwd() / ".env", ROOT / ".env"):
            if path.is_file():
                for line in path.read_text(encoding="utf-8").splitlines():
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    k, v = line.split("=", 1)
                    _dotenv_cache[k.strip()] = v.strip().strip('"').strip("'")
                break
    return _dotenv_cache


def _keyring_get(name: str) -> str | None:
    try:
        import keyring

        return keyring.get_password(SERVICE, name)
    except Exception:
        return None


def get_key(name: str) -> str | None:
    for value in (os.environ.get(name), _dotenv().get(name), _keyring_get(name)):
        if value and value.strip():
            return value.strip()
    return None


def key_source(name: str) -> str:
    """'environment', '.env', 'keyring' or 'missing' — never the value."""
    if os.environ.get(name):
        return "environment"
    if _dotenv().get(name):
        return ".env"
    if _keyring_get(name):
        return "keyring"
    return "missing"


def require_key(name: str) -> str:
    value = get_key(name)
    if not value:
        raise MissingKeyError(
            f"{name} is not set. Set it as an environment variable, add it to a .env file (see .env.example), "
            f"or store it in your OS keyring with:  reel-studio keys"
        )
    return value


def redact(text: object) -> str:
    """Replace any known key value appearing in text with a placeholder."""
    out = str(text)
    for name in KNOWN_KEYS:
        value = get_key(name)
        if value and len(value) > 6:
            out = out.replace(value, f"<{name} redacted>")
    return out

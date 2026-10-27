"""Print the licences of installed Python and renderer (npm, production) dependencies as Markdown tables.
Used to refresh THIRD_PARTY_NOTICES.md:  uv run python scripts/third_party.py"""
import json
import re
from importlib import metadata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def py_license(dist) -> str:
    m = dist.metadata
    if m.get("License-Expression"):
        return m["License-Expression"]
    classifiers = [c.split("::")[-1].strip() for c in m.get_all("Classifier") or [] if c.startswith("License ::")]
    if classifiers:
        return ", ".join(classifiers)
    lic = (m.get("License") or "").strip().splitlines()
    return lic[0][:60] if lic else "UNKNOWN"


def main() -> None:
    print("### Python packages (installed with `uv sync`)\n\n| Package | Version | Licence |\n|---|---|---|")
    dists = {re.sub(r"[-_.]+", "-", d.metadata["Name"]).lower(): d for d in metadata.distributions()}
    for name in sorted(dists):
        if name in ("reel-studio", "pip", "ruff"):
            continue
        d = dists[name]
        print(f"| {d.metadata['Name']} | {d.version} | {py_license(d)} |")

    for title, folder in (("Renderer", "renderer"), ("Website and editor", "apps/web")):
        lock = json.loads((ROOT / folder / "package-lock.json").read_text(encoding="utf-8"))
        print(f"\n### {title} packages (npm, production dependencies)\n\n| Package | Version | Licence |\n|---|---|---|")
        for path, info in sorted(lock["packages"].items()):
            if not path or info.get("dev") or "node_modules/" not in path:
                continue
            name = path.split("node_modules/")[-1]
            print(f"| {name} | {info.get('version', '')} | {info.get('license', 'see package')} |")


if __name__ == "__main__":
    main()

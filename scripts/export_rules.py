"""Write schema/rules.json: the storyboard rules (scene types, limits, required fields) shared with the
browser editor. Run after changing reelstudio/studio/script.py; a test fails while the file is stale."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from reelstudio.studio import script  # noqa: E402

out = ROOT / "schema" / "rules.json"
out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps(script.rules(), indent=2) + "\n", encoding="utf-8")
print(f"wrote {out.relative_to(ROOT)}")

"""Offline tests for bundle import, narration import, scoring plan and the shared editor rules. No network."""
from __future__ import annotations

import hashlib
import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest import mock

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from reelstudio.studio import bundle, narration_import, project, score, script, timeline  # noqa: E402

QUIET = lambda m: None  # noqa: E731


def sample_bundle(**over) -> dict:
    data = {
        "format": "reel-studio.bundle", "version": 1, "generator": "test",
        "project": {"name": "Bundle test", "language": "english", "duration_s": 30},
        "brand": {"name": "Acme", "handle": "@acme", "cta": "Subscribe",
                  "colors": {"accent": "#ff0000", "bg": "not-a-colour"}, "music": {"file": "../../secret.wav"}},
        "content": "# Notes\nSome notes.",
        "storyboard": {"title": "Caching 101", "scenes": [
            {"type": "hook", "narration": "Your API is slow.", "on_screen": {"heading": "Your API is *slow*"},
             "transition": "zoom", "sfx": ["impact"], "unexpected": "ignored"},
            {"type": "bullets", "narration": "Cache the hot reads. Expire them on writes.",
             "on_screen": {"heading": "Fix", "bullets": ["Cache hot reads", "Expire on write"]}, "transition": "slide"},
            {"type": "endcard", "narration": "Follow for more.", "on_screen": {"heading": "Ship *faster*", "cta": "Follow"},
             "transition": "fade"}]},
    }
    data.update(over)
    return data


class TempProjects(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)
        self._patch = mock.patch.object(project, "PROJECTS", self.tmp / "projects")
        self._patch.start()

    def tearDown(self):
        self._patch.stop()
        self._tmp.cleanup()


class TestBundle(TempProjects):
    def write_zip(self, data: dict) -> Path:
        path = self.tmp / "my.reelstudio.zip"
        with zipfile.ZipFile(path, "w") as z:
            z.writestr("bundle.json", json.dumps(data))
            z.writestr("../evil.txt", "never extracted")
        return path

    def test_import_round_trip(self):
        proj = bundle.import_bundle(self.write_zip(sample_bundle()), log=QUIET)
        board = proj.load_json("storyboard.json")
        self.assertEqual([s["id"] for s in board["scenes"]], [1, 2, 3])
        self.assertNotIn("unexpected", board["scenes"][0])
        self.assertEqual(script.validate(board)[0], [])
        brand = proj.brand
        self.assertEqual((brand["name"], brand["handle"], brand["cta"]), ("Acme", "@acme", "Subscribe"))
        self.assertEqual(brand["colors"]["accent"], "#ff0000")
        self.assertNotEqual(brand["colors"]["bg"], "not-a-colour")  # invalid colour ignored
        self.assertIsNone(brand["music"].get("file"))  # only whitelisted brand fields are read
        self.assertFalse((self.tmp / "evil.txt").exists())
        self.assertTrue(proj.done("script"))

    def test_rejects_bad_bundles(self):
        for data, msg in ((sample_bundle(format="other"), "Not a Reel Studio bundle"),
                          (sample_bundle(version=99), "Unsupported bundle version"),
                          (sample_bundle(storyboard={"scenes": []}), "no scenes")):
            with self.assertRaises(bundle.BundleError) as cm:
                bundle.import_bundle(self.write_zip(data), log=QUIET)
            self.assertIn(msg, str(cm.exception))
        bad = self.tmp / "bad.json"
        bad.write_text("{not json", encoding="utf-8")
        with self.assertRaises(bundle.BundleError):
            bundle.read(bad)


def speechy_wav(path: Path, parts: list[float], gap: float = 0.6, sr: int = 48000) -> Path:
    """Noise bursts (stand-ins for spoken lines) separated by silences."""
    rng = np.random.default_rng(1)
    chunks = [np.zeros(int(0.3 * sr))]
    for d in parts:
        chunks += [0.2 * rng.standard_normal(int(d * sr)), np.zeros(int(gap * sr))]
    sf.write(str(path), np.concatenate(chunks), sr)
    return path


class TestNarrationImport(TempProjects):
    def test_text_method(self):
        proj = bundle.import_bundle(TestBundle.write_zip(self, sample_bundle()), log=QUIET)
        lens = [len(s["narration"]) / 14 for s in proj.load_json("storyboard.json")["scenes"]]
        wav = speechy_wav(self.tmp / "my take.wav", lens)
        before = hashlib.sha256(wav.read_bytes()).hexdigest()
        info = narration_import.import_wav(proj, wav, "auto", log=QUIET)
        self.assertEqual(info["method"], "text")  # no TTS clips yet
        self.assertEqual(hashlib.sha256(wav.read_bytes()).hexdigest(), before)  # original untouched
        board = proj.load_json("storyboard.json")
        wins = [s["window_f"] for s in board["scenes"]]
        self.assertEqual(wins[0][0], 0)
        self.assertTrue(all(a[1] > b[0] for a, b in zip(wins, wins[1:])))  # contiguous with overlap
        self.assertTrue(board["captions"])
        tl = timeline.build_from_narration(board, 30)  # string sfx are accepted
        self.assertTrue(any(e["name"] == "impact" for e in tl["sfx"]))
        self.assertTrue((proj.dir / "audio" / info["path"]).exists())
        narration_import.import_wav(proj, wav, "text", log=QUIET)  # same file again: no duplicate copy
        self.assertEqual(len(list((proj.dir / "audio").glob("narration_*"))), 1)
        narration_import.clear(proj, log=QUIET)
        self.assertNotIn("narration_audio", proj.load_json("storyboard.json"))

    def test_align_needs_voice_clips(self):
        proj = bundle.import_bundle(TestBundle.write_zip(self, sample_bundle()), log=QUIET)
        wav = speechy_wav(self.tmp / "take.wav", [1, 2, 1])
        with self.assertRaises(ValueError):
            narration_import.import_wav(proj, wav, "align", log=QUIET)


class TestScorePlan(unittest.TestCase):
    def test_plan_sections_cover_every_bar(self):
        board = script.finalize(json.loads((ROOT / "examples" / "demo" / "demo_storyboard.json").read_text("utf-8")), {})
        manifest = {str(s["id"]): {"file": "x.wav", "duration": 3.0, "words": []} for s in board["scenes"]}
        tl = timeline.build(board, manifest, 30)
        cues, sc = score.plan(tl)
        bars = [b for s in sc["sections"] for b in range(s["bars"][0], s["bars"][1] + 1)]
        self.assertEqual(bars, list(range(1, len(sc["chords"]) + 1)))  # contiguous, no gaps or overlaps
        self.assertTrue(all(e["kind"] in score.KIND.values() for e in cues["events"]))
        self.assertLess(cues["cue"]["payoff"], cues["total"])

    def test_missing_cinetic_is_explained(self):
        with mock.patch.dict("os.environ", {}, clear=True):
            with self.assertRaises(score.ScoreError) as cm:
                score.find_score_py(None)
            self.assertIn("REEL_STUDIO_CINETIC", str(cm.exception))


class TestSharedRules(unittest.TestCase):
    def test_rules_file_matches_engine(self):
        rules = json.loads((ROOT / "schema" / "rules.json").read_text(encoding="utf-8"))
        self.assertEqual(rules, script.rules(), "schema/rules.json is stale: run python scripts/export_rules.py")


if __name__ == "__main__":
    unittest.main()

"""Offline tests: no network, no paid API calls (Groq/Gemini are mocked).

Run:  uv run python -m unittest discover -s tests -v
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from reelstudio import analyzer, credentials, media  # noqa: E402
from reelstudio.studio import script, timeline  # noqa: E402

PY = sys.executable
NO_KEYS = {k: v for k, v in os.environ.items() if k not in credentials.KNOWN_KEYS}
DEMO = ROOT / "examples" / "demo" / "demo_storyboard.json"


def no_keys():
    """No API key from any source (environment, .env, keyring)."""
    return (mock.patch.dict(os.environ, NO_KEYS, clear=True), mock.patch.object(credentials, "_keyring_get", return_value=None),
            mock.patch.object(credentials, "_dotenv", return_value={}))


def make_video(path: Path, seconds: int = 3) -> Path:
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"testsrc=size=270x480:rate=30:duration={seconds}",
                    "-f", "lavfi", "-i", f"sine=frequency=440:duration={seconds}", "-shortest", "-pix_fmt", "yuv420p",
                    str(path)], check=True)
    return path


class TestEnvironment(unittest.TestCase):
    def test_ffmpeg_available(self):
        media.require_ffmpeg()

    def test_imports(self):
        import edge_tts  # noqa: F401

    def test_cli_help(self):
        for script_name in ("analyze_reel.py", "create_reel.py"):
            r = subprocess.run([PY, str(ROOT / script_name), "--help"], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn("usage", r.stdout.lower())
        for cmd in ("import", "narration", "score", "keys", "analyze"):
            r = subprocess.run([PY, "-m", "reelstudio.cli", cmd, "--help"], capture_output=True, text=True, cwd=ROOT)
            self.assertEqual(r.returncode, 0, r.stderr)

    def test_reference_url_is_rejected(self):
        r = subprocess.run([PY, "-m", "reelstudio.cli", "new", "--text", "x", "--reference",
                            "https://www.instagram.com/reel/abc/"], capture_output=True, text=True, cwd=ROOT)
        self.assertEqual(r.returncode, 1)
        self.assertIn("local video file", r.stderr)


class TestInputValidation(unittest.TestCase):
    def test_nonexistent_file(self):
        r = subprocess.run([PY, str(ROOT / "analyze_reel.py"), r"C:\does not exist\reel.mp4"],
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 1)
        self.assertIn("Video not found", r.stderr)

    def test_bad_extension(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "notes.txt"
            p.write_text("x")
            with self.assertRaises(media.MediaError):
                media.validate_video(p)


class TestSecrets(unittest.TestCase):
    def test_missing_key_message_has_no_secret(self):
        a, b, c = no_keys()
        with a, b, c:
            with self.assertRaises(credentials.MissingKeyError) as cm:
                credentials.require_key("GROQ_API_KEY")
            self.assertIn(".env", str(cm.exception))
            self.assertEqual(credentials.key_source("GEMINI_API_KEY"), "missing")

    def test_dotenv(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / ".env").write_text("# comment\nGROQ_API_KEY=\"from-dotenv-123456\"\n", encoding="utf-8")
            with mock.patch.dict(os.environ, NO_KEYS, clear=True), mock.patch.object(credentials, "_dotenv_cache", None), \
                    mock.patch.object(credentials, "ROOT", Path(d)), mock.patch("pathlib.Path.cwd", return_value=Path(d)):
                self.assertEqual(credentials.get_key("GROQ_API_KEY"), "from-dotenv-123456")
                self.assertEqual(credentials.key_source("GROQ_API_KEY"), ".env")

    def test_redact(self):
        fake = "fake-test-value-0123456789"
        with mock.patch.dict(os.environ, {"GROQ_API_KEY": fake}):
            self.assertNotIn(fake, credentials.redact(f"401 invalid key {fake}"))

    def test_analyzer_reports_missing_keys_safely(self):
        a, b, c = no_keys()
        with tempfile.TemporaryDirectory() as d, a, b, c:
            video = make_video(Path(d) / "clip with space.mp4")
            code = analyzer.run(video, Path(d) / "out", log=lambda m: None)
            self.assertEqual(code, 1)
            report = (Path(d) / "out" / "analysis.md").read_text(encoding="utf-8")
            self.assertIn("GROQ_API_KEY is not set", report)


class FakeGemini:
    """Stands in for the gemini module inside analyzer."""
    GeminiError = RuntimeError

    def client(self):
        return object()

    def pick_model(self, c, purpose):
        return "fake-model", "test"

    def upload_video(self, c, path, log=print):
        return mock.Mock(name="uploaded")

    def delete_file(self, c, f):
        pass

    def frames_as_parts(self, frames):
        return []

    def generate(self, c, model, contents, schema=None, temperature=0.4, system=None):
        joined = " ".join(x for x in contents if isinstance(x, str))
        if schema:
            return json.dumps({"duration_s": 3, "hook": {"first_3s": "x", "technique": "y", "effectiveness": "z"},
                               "scenes": [{"start_s": 0, "end_s": 3, "purpose": "p", "visual": "v"}],
                               "typography": "t", "color_palette": [{"hex": "#000000", "role": "bg"}],
                               "pacing": {"notes": "n"}, "style_summary": "s", "ending_cta": "e",
                               "strengths": [], "weaknesses": []})
        if "EXACTLY these level-2 headings" in joined:
            return "## 1. Reel Overview\nTest\n## 2. Full Audio Transcript\n{{TRANSCRIPT}}\n## 10. Limitations\n- test"
        return "1. Overall topic: test pattern"


class TestReportGeneration(unittest.TestCase):
    def test_full_report_with_mocks(self):
        fake_tr = {"text": "வணக்கம் test", "language": "tamil", "model": "whisper-large-v3-turbo",
                   "segments": [{"start": 0.0, "end": 2.0, "text": "வணக்கம் test"}], "words": []}
        with tempfile.TemporaryDirectory() as d, \
                mock.patch.object(analyzer, "gemini", FakeGemini()), \
                mock.patch.object(analyzer.groq_audio, "transcribe_video", return_value=fake_tr):
            video = make_video(Path(d) / "reel.mp4")
            out = Path(d) / "out"
            code = analyzer.run(video, out, reference=True, log=lambda m: None)
            self.assertEqual(code, 0)
            report = (out / "analysis.md").read_text(encoding="utf-8")
            self.assertIn("வணக்கம் test", report)  # verbatim transcript inserted, not translated
            self.assertNotIn("{{TRANSCRIPT}}", report)
            self.assertTrue((out / "transcript.txt").exists())
            self.assertTrue((out / "reference_analysis.json").exists())
            self.assertFalse((out / "_tmp").exists())  # temp cleaned up


class TestSarvamVoice(unittest.TestCase):
    def test_request_shape_and_decode(self):
        import base64

        from reelstudio.studio import voice

        with tempfile.TemporaryDirectory() as d:
            wav = Path(d) / "src.wav"
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=300:duration=1",
                            "-ar", "48000", str(wav)], check=True)
            resp = mock.Mock(status_code=200)
            resp.json.return_value = {"audios": [base64.b64encode(wav.read_bytes()).decode()]}
            fake = "fake-sarvam-test-value-123"
            with mock.patch.dict(os.environ, {"SARVAM_API_KEY": fake}), mock.patch("httpx.post", return_value=resp) as post:
                out = Path(d) / "scene_01.wav"
                voice.synth("இந்த FastAPI endpoint", out, "sarvam",
                            {"sarvam_model": "bulbul:v4-flash", "sarvam_speaker": "gokul_ta_narration"})
                body = post.call_args.kwargs["json"]
                self.assertEqual(body["language_code"], "ta-IN")
                self.assertEqual(body["speaker"], "gokul_ta_narration")
                self.assertEqual(post.call_args.kwargs["headers"]["api-subscription-key"], fake)
                self.assertGreater(media.audio_duration(out), 0.9)

    def test_auto_prefers_sarvam_for_tanglish(self):
        from reelstudio.studio import voice

        with mock.patch.dict(os.environ, {"SARVAM_API_KEY": "x" * 12}):
            self.assertEqual(voice.resolve_provider("auto", lambda m: None, "tanglish")[0], "sarvam")

    def test_auto_never_falls_back_to_edge(self):
        from reelstudio.studio import voice

        a, b, c = no_keys()
        with a, b, c:
            with self.assertRaises(voice.VoiceError) as cm:
                voice.resolve_provider("auto", lambda m: None, "english")
            self.assertIn("--voice-provider", str(cm.exception))
            self.assertEqual(voice.resolve_provider("edge", lambda m: None, "english")[0], "edge")


class TestStoryboard(unittest.TestCase):
    def load(self):
        board = json.loads(DEMO.read_text(encoding="utf-8"))
        return script.finalize(board, {"base_hashtags": ["#x"]})

    def test_fixture_validates(self):
        errs, _ = script.validate(self.load())
        self.assertEqual(errs, [])

    def test_validation_catches_overflow(self):
        board = self.load()
        board["scenes"][2]["on_screen"]["code"] = "x" * 80
        board["scenes"][0]["on_screen"]["heading"] = "word " * 20
        errs, _ = script.validate(board)
        self.assertTrue(any("code line too long" in e for e in errs))
        self.assertTrue(any("heading too long" in e for e in errs))

    def test_timeline_and_captions(self):
        board = self.load()
        manifest = {str(s["id"]): {"file": f"scene_{s['id']:02d}.wav", "duration": 2.0, "words": []} for s in board["scenes"]}
        tl = timeline.build(board, manifest, 30)
        self.assertEqual(tl["scenes"][0]["from"], 0)
        for a, b in zip(tl["scenes"], tl["scenes"][1:]):
            self.assertEqual(a["from"] + a["duration"], b["from"])  # no gaps/overlaps
        self.assertEqual(tl["durationInFrames"], tl["scenes"][-1]["from"] + tl["scenes"][-1]["duration"])
        for a, b in zip(tl["captions"], tl["captions"][1:]):
            self.assertLessEqual(a["to"], b["from"])
        self.assertTrue(all(len(c["text"]) <= timeline.CHUNK_CHARS + 20 for c in tl["captions"]))


if __name__ == "__main__":
    unittest.main()

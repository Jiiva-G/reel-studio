"""Local (no API) alignment of a user-supplied narration WAV to the episode's reference voice clips.

The reference clips (one per line, known boundaries) are concatenated and matched to the user's
recording with DTW on normalised MFCCs; each reference line boundary is mapped through the warping
path and snapped to the nearest real pause in the user's audio.
"""
from __future__ import annotations

from pathlib import Path

import librosa
import numpy as np

SR = 16000
HOP = 160  # 10 ms


def _feat(y: np.ndarray) -> np.ndarray:
    m = librosa.feature.mfcc(y=y, sr=SR, n_mfcc=20, hop_length=HOP, n_fft=512)
    m = (m - m.mean(axis=1, keepdims=True)) / (m.std(axis=1, keepdims=True) + 1e-6)
    return m


def line_spans(user_wav: Path, ref_clips: list[Path], gap: float = 0.3, snap: float = 0.6) -> dict:
    from .narration import pauses, speech_bounds  # 48 kHz helpers

    refs = [librosa.load(str(c), sr=SR, mono=True)[0] for c in ref_clips]
    sil = np.zeros(int(gap * SR))
    ref, bounds, t = [], [], 0.0
    for r in refs:
        a, b = librosa.effects.trim(r, top_db=38)[1]
        r = r[a:b]
        bounds.append((t, t + len(r) / SR))
        ref += [r, sil]
        t += len(r) / SR + gap
    ref = np.concatenate(ref)
    user = librosa.load(str(user_wav), sr=SR, mono=True)[0]

    D, wp = librosa.sequence.dtw(X=_feat(ref), Y=_feat(user), metric="cosine")
    wp = wp[::-1]  # (ref_frame, user_frame), increasing
    cost = float(D[-1, -1] / len(wp))

    def map_t(tr: float) -> float:
        fr = int(round(tr * SR / HOP))
        users = wp[wp[:, 0] == min(fr, wp[-1, 0]), 1]
        if not len(users):
            users = wp[np.argmin(np.abs(wp[:, 0] - fr)), 1:2]
        return float(np.median(users)) * HOP / SR

    import soundfile as sf
    x, sr48 = sf.read(str(user_wav), dtype="float64")
    if x.ndim > 1:
        x = x.mean(axis=1)
    if sr48 != 48000:
        x = librosa.resample(x, orig_sr=sr48, target_sr=48000)
    ps = pauses(x, min_s=0.12)
    s0, s1 = speech_bounds(x)

    cuts = []
    for (a0, a1), (b0, b1) in zip(bounds, bounds[1:]):
        guess = (map_t(a1) + map_t(b0)) / 2
        near = [p for p in ps if abs((p[0] + p[1]) / 2 - guess) <= snap]
        if near:
            p = min(near, key=lambda q: abs((q[0] + q[1]) / 2 - guess))
            cuts.append({"guess": round(guess, 3), "pause": [round(p[0], 3), round(p[1], 3)], "snapped": True})
        else:
            cuts.append({"guess": round(guess, 3), "pause": [round(guess, 3), round(guess, 3)], "snapped": False})
    spans, start = [], s0
    for c in cuts:
        spans.append((round(start, 3), c["pause"][0]))
        start = c["pause"][1]
    spans.append((round(start, 3), round(s1, 3)))
    ref_d = [b - a for a, b in bounds]
    return {"spans": spans, "cuts": cuts, "dtw_cost": round(cost, 4), "speech": [round(s0, 3), round(s1, 3)],
            "duration_ratio": [round((e - s) / d, 3) for (s, e), d in zip(spans, ref_d)]}

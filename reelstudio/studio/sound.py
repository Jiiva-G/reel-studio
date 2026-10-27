"""Original procedural sound effects + music bed, and the final mix with ducking.

All sounds here are synthesized with FFmpeg (no third-party audio). To use a licensed
music track instead, put it in assets/music and set brand.music.file to its filename.
"""
from __future__ import annotations

from pathlib import Path

from .. import media
from .project import ASSETS, Project

SR = 48000

SFX_EXPR = {
    "click": ("0.6*sin(2*PI*2400*t)*exp(-70*t)", 0.08, ""),
    "pop": ("0.7*sin(2*PI*(500+1400*t)*t)*exp(-22*t)", 0.2, ""),
    "impact": ("0.9*sin(2*PI*52*t)*exp(-5*t)+0.35*sin(2*PI*104*t)*exp(-8*t)", 0.9, ",lowpass=f=900"),
    "typing": ("0.35*sin(2*PI*1900*t)*exp(-90*mod(t,0.095))*lt(mod(t,0.38),0.3)", 0.9, ",highpass=f=900"),
    "scanner": ("0.28*sin(2*PI*(380*t+900*t*t))*(0.6+0.4*sin(2*PI*22*t))", 0.9, ",highpass=f=250"),
    "stamp": ("0.95*sin(2*PI*70*t)*exp(-16*t)+0.4*sin(2*PI*140*t)*exp(-25*t)", 0.4, ",lowpass=f=700"),
    "chime": ("0.32*sin(2*PI*880*t)*exp(-3.5*t)+0.3*sin(2*PI*1320*(t-0.13))*exp(-3.5*(t-0.13))*gte(t,0.13)", 1.3, ""),
}
# Noise-based effects: (lavfi source, filter chain)
NOISE_SFX = {
    "whoosh": ("anoisesrc=d=0.55:c=pink:r={sr}:a=0.6",
               "highpass=f=400,lowpass=f=5000,afade=t=in:d=0.3:curve=exp,afade=t=out:st=0.3:d=0.25"),
    "glitch": ("anoisesrc=d=0.4:c=white:r={sr}:a=0.45",
               "acrusher=bits=4:samples=24,tremolo=f=28:d=0.95,highpass=f=300,afade=t=out:st=0.25:d=0.15"),
    "rise": ("anoisesrc=d=1.1:c=pink:r={sr}:a=0.5",
             "highpass=f=600,lowpass=f=6000,afade=t=in:d=0.9:curve=exp,afade=t=out:st=0.95:d=0.15"),
}


def ensure_sfx(log=print) -> dict[str, Path]:
    out_dir = ASSETS / "sfx"
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = {}
    for name, (expr, dur, post) in SFX_EXPR.items():
        p = out_dir / f"{name}.wav"
        if not p.exists():
            media.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"aevalsrc='{expr}':s={SR}:d={dur}",
                       "-af", f"afade=t=out:st={dur * 0.7:.3f}:d={dur * 0.3:.3f}{post}", str(p)])
        paths[name] = p
    for name, (src, chain) in NOISE_SFX.items():
        p = out_dir / f"{name}.wav"
        if not p.exists():
            media.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", src.format(sr=SR), "-af", chain, str(p)])
        paths[name] = p
    if not paths or not all(x.exists() for x in paths.values()):
        raise media.MediaError("Could not generate sound effects.")
    return paths


def _note(chord_freqs: list[list[float]], bar: float, voice: int) -> str:
    """Piecewise frequency expression selecting the chord tone for the current bar."""
    n = len(chord_freqs)
    expr = f"{chord_freqs[-1][voice]}"
    for i in range(n - 2, -1, -1):
        expr = f"if(lt(mod(t,{bar * n}),{bar * (i + 1)}),{chord_freqs[i][voice]},{expr})"
    return expr


def procedural_music(duration: float, out: Path) -> Path:
    """Calm original pad + soft pulse (A minor - F - C - G), 96 BPM."""
    chords = [[220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [261.63, 329.63, 392.0], [196.0, 246.94, 293.66]]
    beat = 60 / 96
    bar = beat * 4
    pad = "+".join(f"0.11*sin(2*PI*({_note(chords, bar, v)})*t)+0.05*sin(2*PI*2*({_note(chords, bar, v)})*t)"
                   for v in range(3))
    bass = f"0.16*sin(2*PI*({_note([[c[0] / 2] for c in chords], bar, 0)})*t)*(0.6+0.4*exp(-3*mod(t,{beat})))"
    pulse = f"0.10*sin(2*PI*58*t)*exp(-14*mod(t,{beat}))"
    expr = f"({pad})*(0.85+0.15*sin(2*PI*0.25*t))+{bass}+{pulse}"
    media.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"aevalsrc='{expr}':s={SR}:d={duration + 1:.2f}",
               "-af", "lowpass=f=2200,aecho=0.8:0.6:180:0.25,volume=0.9", "-ac", "2", str(out)])
    return out


def _intensity_expr(curve: list[tuple]) -> str:
    level = {"low": 0.7, "medium": 1.0, "high": 1.25}
    expr = "1"
    for a, b, k in reversed(curve):
        expr = f"if(between(t,{a:.3f},{b:.3f}),{level.get(k, 1.0)},{expr})"
    return expr


def mix(project: Project, timeline: dict, log=print) -> Path:
    brand = project.brand
    overrides = (project.load_json("storyboard.json") or {}).get("mix") or {}
    dur = timeline["duration_s"]
    audio_dir = project.dir / "audio"
    board = project.load_json("storyboard.json") or {}
    soundtrack = audio_dir / board["soundtrack"] if board.get("soundtrack") else None
    log("Sound design: " + ("mixing narration with the scored soundtrack" if soundtrack else "generating effects and music bed"))
    sfx_paths = ensure_sfx(log) if brand.get("sfx", {}).get("enabled", True) and not soundtrack else {}
    music_cfg = brand.get("music", {})
    if soundtrack:
        if not soundtrack.exists():
            raise media.MediaError(f"Soundtrack not found: {soundtrack}")
        music, music_note = soundtrack, f"scored soundtrack (music + effects): {soundtrack.name}"
    elif music_cfg.get("file"):
        music = ASSETS / "music" / music_cfg["file"]
        if not music.exists():
            raise media.MediaError(f"Music file not found: {music}")
        music_note = f"licensed/user track: {music.name}"
    else:
        music = procedural_music(dur, audio_dir / "music_procedural.wav")
        music_note = "procedural original bed (placeholder quality)"

    inputs: list[str] = []
    filters: list[str] = []

    def add(path: Path, loop: bool = False) -> int:
        if loop:
            inputs.extend(["-stream_loop", "-1"])
        inputs.extend(["-i", str(path)])
        return len([x for x in inputs if x == "-i"]) - 1

    v_labels = []
    for k, ev in enumerate(timeline["voice"]):
        i = add(audio_dir / ev["path"] if ev.get("path") else audio_dir / "voice" / ev["file"])
        ms = int(ev["at"] * 1000)
        filters.append(f"[{i}:a]aresample={SR},aformat=channel_layouts=mono,adelay={ms}:all=1[v{k}]")
        v_labels.append(f"[v{k}]")
    if not v_labels:
        raise media.MediaError("No voice clips in timeline.")
    filters.append(f"{''.join(v_labels)}amix=inputs={len(v_labels)}:normalize=0,apad=whole_dur={dur:.3f},"
                   f"atrim=0:{dur:.3f},asplit=3[voice][vsc][vqa]")

    s_labels = []
    sfx_vol = overrides.get("sfx_volume", brand.get("sfx", {}).get("volume", 0.45))
    for k, ev in enumerate(e for e in timeline["sfx"] if e["name"] in sfx_paths):
        i = add(sfx_paths[ev["name"]])
        filters.append(f"[{i}:a]aresample={SR},aformat=channel_layouts=mono,volume={sfx_vol},"
                       f"adelay={int(ev['at'] * 1000)}:all=1[s{k}]")
        s_labels.append(f"[s{k}]")
    if s_labels:
        filters.append(f"{''.join(s_labels)}amix=inputs={len(s_labels)}:normalize=0,apad=whole_dur={dur:.3f},"
                       f"atrim=0:{dur:.3f}[sfx]")

    if soundtrack:  # already scored and mastered quietly (music + effects): duck it gently under the voice
        mi = add(music)
        gain = overrides.get("soundtrack_gain", 1.0)
        filters.append(f"[{mi}:a]aresample={SR},aformat=channel_layouts=stereo,apad=whole_dur={dur:.3f},"
                       f"atrim=0:{dur:.3f},volume={gain}[mus]")
        filters.append("[mus][vsc]sidechaincompress=threshold=0.03:ratio=3:attack=20:release=300:makeup=1[ducked]")
    else:
        mi = add(music, loop=True)
        vol = overrides.get("music_volume", music_cfg.get("volume", 0.2))
        filters.append(f"[{mi}:a]aresample={SR},aformat=channel_layouts=stereo,atrim=0:{dur:.3f},"
                       f"volume='{vol}*{_intensity_expr(timeline['music_curve'])}':eval=frame,"
                       f"afade=t=in:d=0.8,afade=t=out:st={max(dur - 1.5, 0):.3f}:d=1.5[mus]")
        filters.append("[mus][vsc]sidechaincompress=threshold=0.02:ratio=6:attack=15:release=350:makeup=1[ducked]")
    mix_in = "[voice][ducked]" + ("[sfx]" if s_labels else "")
    n = 3 if s_labels else 2
    filters.append(f"{mix_in}amix=inputs={n}:normalize=0:duration=first,aresample={SR},"
                   f"aformat=channel_layouts=stereo[out]")

    pre = audio_dir / "mix_pre.wav"
    out = audio_dir / "mix.wav"
    voice_only = audio_dir / "voice_track.wav"
    media.run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", ";".join(filters),
               "-map", "[out]", "-t", f"{dur:.3f}", str(pre), "-map", "[vqa]", "-t", f"{dur:.3f}", str(voice_only)])
    loudness = normalize(pre, out, target=-14.0, tp=-1.5)
    pre.unlink(missing_ok=True)
    project.write_json("audio/mix_info.json", {"music": music_note, "sfx_events": len(s_labels),
                                               "voice_clips": len(v_labels), "duration_s": dur, "loudness": loudness})
    return out


def normalize(src: Path, dst: Path, target: float = -14.0, tp: float = -1.5, lra: float = 11.0) -> dict:
    """Two-pass EBU R128 loudness normalisation (measure, then apply linearly) to hit the target exactly."""
    import json as _json
    import re as _re

    probe = media.run(["ffmpeg", "-hide_banner", "-i", str(src), "-af",
                       f"loudnorm=I={target}:TP={tp}:LRA={lra}:print_format=json", "-f", "null", "-"], check=False)
    m = _re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", probe.stderr, _re.S)
    if not m:
        raise media.MediaError("Loudness measurement failed.")
    meas = _json.loads(m.group(0))
    af = (f"loudnorm=I={target}:TP={tp}:LRA={lra}:measured_I={meas['input_i']}:measured_TP={meas['input_tp']}:"
          f"measured_LRA={meas['input_lra']}:measured_thresh={meas['input_thresh']}:offset={meas['target_offset']}:"
          f"linear=true,aresample={SR}")
    media.run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-af", af, "-ar", str(SR), str(dst)])
    return {"input_i": float(meas["input_i"]), "target_i": target, "tp": tp}

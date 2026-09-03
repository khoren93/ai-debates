import math
import struct
from pathlib import Path

import pytest

import app.services.media.ffmpeg as ffmpeg_mod
from app.services.media.ffmpeg import (
    FfmpegError,
    concat_offsets,
    envelope_from_pcm,
    normalize_turn,
    parse_ffprobe_duration_ms,
)


def test_concat_offsets() -> None:
    assert concat_offsets([1000, 2000, 500], 600) == [0, 1600, 4200]
    assert concat_offsets([], 600) == []


def test_parse_ffprobe_duration_ms() -> None:
    assert parse_ffprobe_duration_ms(b'{"format": {"duration": "12.345"}}') == 12345
    assert parse_ffprobe_duration_ms(b"{}") == 0


def test_envelope_from_pcm_detects_loud_and_quiet_windows() -> None:
    rate = 8000
    loud = [int(20000 * math.sin(i / 5)) for i in range(rate // 2)]
    quiet = [0] * (rate // 2)
    pcm = struct.pack(f"<{len(loud) + len(quiet)}h", *loud, *quiet)
    levels = envelope_from_pcm(pcm, rate=rate, window_ms=50)
    assert len(levels) == 20
    assert max(levels[:10]) == 1.0
    assert max(levels[10:]) == 0.0
    assert envelope_from_pcm(b"", rate=rate, window_ms=50) == []


def test_normalize_turn_falls_back_to_two_passes_when_ffmpeg_crashes(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    filters: list[str | None] = []

    def fake_ffmpeg(args: list[str], *, timeout_s: int = 600) -> bytes:
        af = args[args.index("-af") + 1] if "-af" in args else None
        filters.append(af)
        if af and "silenceremove" in af and "loudnorm" in af:
            # ffmpeg 7.1 scheduler bug: SIGABRT on the combined chain for some inputs.
            raise FfmpegError("ffmpeg exited with -6: Assertion best_input >= 0 failed", -6)
        Path(args[-1]).write_bytes(b"RIFF")
        return b""

    monkeypatch.setattr(ffmpeg_mod, "ffmpeg", fake_ffmpeg)
    dst = tmp_path / "000.0.wav"
    normalize_turn(tmp_path / "000.0.raw.mp3", dst, target_lufs=-16)

    assert len(filters) == 3
    assert filters[1] is not None and filters[1].startswith("areverse,silenceremove")
    assert filters[2] == "loudnorm=I=-16:TP=-1.5:LRA=11"
    assert dst.read_bytes() == b"RIFF"
    assert not (tmp_path / "000.0.trim.wav").exists()  # intermediate file cleaned up


def test_normalize_turn_does_not_retry_when_ffmpeg_never_ran(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    calls = {"n": 0}

    def fake_ffmpeg(args: list[str], *, timeout_s: int = 600) -> bytes:
        calls["n"] += 1
        raise FfmpegError("ffmpeg timed out after 600s")

    monkeypatch.setattr(ffmpeg_mod, "ffmpeg", fake_ffmpeg)
    with pytest.raises(FfmpegError, match="timed out"):
        normalize_turn(tmp_path / "raw.mp3", tmp_path / "out.wav")
    assert calls["n"] == 1


def test_normalize_turn_raises_last_error_when_every_graph_fails(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    calls = {"n": 0}

    def fake_ffmpeg(args: list[str], *, timeout_s: int = 600) -> bytes:
        calls["n"] += 1
        raise FfmpegError("ffmpeg exited with 1: Invalid data found when processing input", 1)

    monkeypatch.setattr(ffmpeg_mod, "ffmpeg", fake_ffmpeg)
    with pytest.raises(FfmpegError, match="Invalid data"):
        normalize_turn(tmp_path / "raw.mp3", tmp_path / "out.wav")
    assert calls["n"] == 3  # combined chain, two-pass (fails on its first pass), loudnorm only

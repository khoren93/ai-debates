import math
import struct

from app.services.media.ffmpeg import concat_offsets, envelope_from_pcm, parse_ffprobe_duration_ms


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

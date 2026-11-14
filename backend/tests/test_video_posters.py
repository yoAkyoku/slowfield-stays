from pathlib import Path
import subprocess

from app.modules.media.routes import extract_video_poster, video_poster_key


def test_video_poster_key_is_a_stable_sibling() -> None:
    assert video_poster_key("abc123.mp4") == "abc123.poster-v2.jpg"
    assert video_poster_key("abc123.webm") == "abc123.poster-v2.jpg"


def test_extract_video_poster_uses_first_useful_frame(monkeypatch, tmp_path: Path) -> None:
    source = tmp_path / "clip.mp4"
    poster = tmp_path / "clip.poster.jpg"
    source.write_bytes(b"video")
    recorded: list[str] = []

    def fake_run(command, **kwargs):
        recorded.extend(command)
        Path(command[-1]).write_bytes(b"jpeg")

    monkeypatch.setattr(subprocess, "run", fake_run)

    assert extract_video_poster(source, poster) is True
    assert "thumbnail=100" in recorded[recorded.index("-vf") + 1]
    assert recorded[recorded.index("-frames:v") + 1] == "1"


def test_extract_video_poster_failure_is_nonfatal_and_removes_partial_file(monkeypatch, tmp_path: Path) -> None:
    source = tmp_path / "clip.mp4"
    poster = tmp_path / "clip.poster.jpg"
    source.write_bytes(b"video")

    def fake_run(command, **kwargs):
        Path(command[-1]).write_bytes(b"partial")
        raise subprocess.CalledProcessError(1, command)

    monkeypatch.setattr(subprocess, "run", fake_run)

    assert extract_video_poster(source, poster) is False
    assert not poster.exists()

import os
import sys
import tempfile
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from cat_cam.db import EventLog
from cat_cam.report import build_sessions, last_night_window, render_report


def _events(*rows):
    return [
        {"cat_name": cat, "event": ev, "ts": ts, "confidence": None, "snapshot_path": None}
        for cat, ev, ts in rows
    ]


def test_build_sessions_pairs_arrive_and_leave():
    events = _events(
        ("Shadow", "arrived", "2026-06-18T22:00:00"),
        ("Shadow", "left", "2026-06-18T23:30:00"),
    )
    sessions = build_sessions(events, datetime(2026, 6, 19, 8, 0, 0))
    assert len(sessions) == 1
    cat, start, end, still = sessions[0]
    assert cat == "Shadow"
    assert still is False
    assert (end - start).total_seconds() == 90 * 60


def test_open_session_closes_at_window_end():
    events = _events(("Luna", "arrived", "2026-06-19T02:00:00"))
    window_end = datetime(2026, 6, 19, 8, 0, 0)
    sessions = build_sessions(events, window_end)
    assert len(sessions) == 1
    cat, start, end, still = sessions[0]
    assert still is True
    assert end == window_end


def test_render_report_has_leaderboard():
    events = _events(
        ("Shadow", "arrived", "2026-06-18T22:00:00"),
        ("Shadow", "left", "2026-06-18T23:00:00"),
        ("Luna", "arrived", "2026-06-18T22:00:00"),
        ("Luna", "left", "2026-06-19T04:00:00"),
    )
    window = (datetime(2026, 6, 18, 18, 0), datetime(2026, 6, 19, 8, 0))
    out = render_report(events, window)
    assert "Snuggle leaderboard" in out
    # Luna slept longer, so she ranks first.
    assert out.index("Luna") < out.index("Shadow")


def test_render_report_quiet_night():
    window = (datetime(2026, 6, 18, 18, 0), datetime(2026, 6, 19, 8, 0))
    assert "Quiet night" in render_report([], window)


def test_last_night_window_morning_vs_evening():
    morning = datetime(2026, 6, 19, 7, 0)
    start, end = last_night_window(morning)
    assert start == datetime(2026, 6, 18, 18, 0)
    assert end == morning

    evening = datetime(2026, 6, 19, 21, 0)
    start, end = last_night_window(evening)
    assert start == datetime(2026, 6, 18, 18, 0)
    assert end == datetime(2026, 6, 19, 12, 0)


def test_event_log_roundtrip():
    with tempfile.TemporaryDirectory() as d:
        log = EventLog(os.path.join(d, "test.sqlite"))
        log.log("Shadow", "arrived", ts=datetime(2026, 6, 18, 22, 0), confidence=0.8)
        log.log("Shadow", "left", ts=datetime(2026, 6, 18, 23, 0))
        rows = log.events_between(datetime(2026, 6, 18, 0, 0), datetime(2026, 6, 19, 0, 0))
        log.close()
        assert len(rows) == 2
        assert rows[0]["event"] == "arrived"
        assert rows[0]["confidence"] == 0.8

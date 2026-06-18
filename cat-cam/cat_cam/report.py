"""Turn the raw event log into a friendly 'who slept in bed last night' summary."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

# A session is (cat_name, start, end, still_present_at_report_time).
Session = Tuple[str, datetime, datetime, bool]


def last_night_window(now: Optional[datetime] = None) -> Tuple[datetime, datetime]:
    """Return the (start, end) datetimes covering 'last night'.

    Run in the morning (before noon): from 6pm yesterday up to right now.
    Run in the afternoon/evening: the previous 6pm -> noon window, so an
    evening run still reports the night that just passed.
    """
    now = now or datetime.now()
    noon = now.replace(hour=12, minute=0, second=0, microsecond=0)
    if now <= noon:
        start = (now - timedelta(days=1)).replace(hour=18, minute=0, second=0, microsecond=0)
        end = now
    else:
        start = (now - timedelta(days=1)).replace(hour=18, minute=0, second=0, microsecond=0)
        end = noon
    return start, end


def build_sessions(events: List[dict], window_end: datetime) -> List[Session]:
    """Pair 'arrived'/'left' events per cat into sessions.

    A cat still in bed when the report runs gets a session ending at
    ``window_end`` and flagged as still-present.
    """
    open_arrival: Dict[str, datetime] = {}
    sessions: List[Session] = []
    for e in events:
        ts = datetime.fromisoformat(e["ts"])
        cat = e["cat_name"]
        if e["event"] == "arrived":
            open_arrival[cat] = ts
        elif e["event"] == "left" and cat in open_arrival:
            sessions.append((cat, open_arrival.pop(cat), ts, False))
    for cat, start in open_arrival.items():
        sessions.append((cat, start, window_end, True))
    return sessions


def render_report(events: List[dict], window: Tuple[datetime, datetime]) -> str:
    start, end = window
    sessions = build_sessions(events, end)

    lines: List[str] = []
    lines.append(f"Cat-cam report  {start:%a %b %d %I:%M%p} -> {end:%a %I:%M%p}")
    lines.append("=" * 52)

    if not sessions:
        lines.append("No cats detected in the bed zone. Quiet night.")
        return "\n".join(lines)

    totals: Dict[str, timedelta] = {}
    for cat, s, e, _ in sessions:
        totals[cat] = totals.get(cat, timedelta()) + (e - s)

    lines.append("Snuggle leaderboard:")
    for rank, (cat, total) in enumerate(
        sorted(totals.items(), key=lambda kv: kv[1], reverse=True), start=1
    ):
        mins = int(total.total_seconds() // 60)
        lines.append(f"  {rank}. {cat:<14} {mins // 60}h {mins % 60:02d}m in bed")

    lines.append("")
    lines.append("Timeline:")
    for cat, s, e, still in sorted(sessions, key=lambda x: x[1]):
        tag = "  (still there)" if still else ""
        lines.append(f"  {s:%I:%M%p} - {e:%I:%M%p}  {cat}{tag}")

    return "\n".join(lines)

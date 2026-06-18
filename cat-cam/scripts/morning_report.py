#!/usr/bin/env python3
"""Print (and save) last night's 'who slept in bed' report.

    python scripts/morning_report.py            # uses ./config.yaml
    python scripts/morning_report.py path/to/config.yaml
"""
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from cat_cam.config import Config
from cat_cam.db import EventLog
from cat_cam.report import last_night_window, render_report


def main() -> None:
    config_path = sys.argv[1] if len(sys.argv) > 1 else "config.yaml"
    config = Config.load(config_path)

    window = last_night_window()
    log = EventLog(config.database_path)
    try:
        events = log.events_between(*window)
    finally:
        log.close()

    report = render_report(events, window)
    print(report)

    out_dir = Path(config.database_path).resolve().parent / "reports"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"report_{datetime.now():%Y-%m-%d}.txt"
    out_path.write_text(report + "\n", encoding="utf-8")
    print(f"\n(saved to {out_path})")


if __name__ == "__main__":
    main()

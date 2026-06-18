#!/usr/bin/env python3
"""Start the night-watch. Run this in the evening (or leave it running 24/7).

    python scripts/run_monitor.py                # uses ./config.yaml
    python scripts/run_monitor.py path/to/config.yaml
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from cat_cam.config import Config
from cat_cam.monitor import NightWatch


def main() -> None:
    config_path = sys.argv[1] if len(sys.argv) > 1 else "config.yaml"
    config = Config.load(config_path)
    NightWatch(config).run()


if __name__ == "__main__":
    main()

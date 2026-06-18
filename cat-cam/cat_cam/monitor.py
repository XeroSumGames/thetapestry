"""Night-watch loop: watch the bed zone, identify cats, log arrivals/departures."""
from __future__ import annotations

import os
import time
from datetime import datetime
from typing import Dict, Set

import numpy as np

from .capture import FrameSource
from .config import Config
from .db import EventLog
from .detect import CatDetector
from .identify import CatIdentifier
from .zones import box_anchor, point_in_polygon


def within_active_hours(now: datetime, active_hours) -> bool:
    """True if ``now``'s hour falls in the [start, end) night window.

    Handles windows that wrap past midnight (e.g. 21 -> 8).
    """
    start, end = active_hours
    h = now.hour
    if start <= end:
        return start <= h < end
    return h >= start or h < end


class NightWatch:
    def __init__(self, config: Config):
        self.config = config
        self.source = FrameSource(config.camera_source)
        self.detector = CatDetector()
        self.identifier = CatIdentifier(config.reference_photos_dir, config.min_confidence)
        self.log = EventLog(config.database_path)
        self._seen_streak: Dict[str, int] = {}
        self._missing_streak: Dict[str, int] = {}
        self._present: Dict[str, bool] = {}

    def _snapshot(self, frame: np.ndarray, name: str) -> str | None:
        if not self.config.save_event_snapshots:
            return None
        import cv2

        os.makedirs(self.config.snapshot_dir, exist_ok=True)
        filename = f"{name}_{datetime.now():%Y%m%d_%H%M%S}.jpg"
        path = os.path.join(self.config.snapshot_dir, filename)
        cv2.imwrite(path, frame)
        return path

    def process_frame(self, frame: np.ndarray) -> Set[str]:
        """Process a single frame; return the set of cats confirmed in bed."""
        confirm = self.config.presence_confirm_samples
        seen_now: Set[str] = set()

        for box, _det_conf in self.detector.detect(frame):
            if not point_in_polygon(box_anchor(box), self.config.bed_polygon):
                continue
            x1, y1, x2, y2 = (int(v) for v in box)
            crop = frame[max(0, y1):y2, max(0, x1):x2]
            if crop.size == 0:
                continue
            name, id_conf = self.identifier.identify_crop(crop)
            seen_now.add(name)
            self._seen_streak[name] = self._seen_streak.get(name, 0) + 1
            self._missing_streak[name] = 0
            if not self._present.get(name) and self._seen_streak[name] >= confirm:
                self._present[name] = True
                snap = self._snapshot(frame, name)
                self.log.log(name, "arrived", confidence=id_conf, snapshot_path=snap)

        # Anyone previously in bed but not seen this frame is a departure candidate.
        for name, is_present in list(self._present.items()):
            if not is_present or name in seen_now:
                continue
            self._missing_streak[name] = self._missing_streak.get(name, 0) + 1
            self._seen_streak[name] = 0
            if self._missing_streak[name] >= confirm:
                self._present[name] = False
                self.log.log(name, "left")

        return {n for n, present in self._present.items() if present}

    def run(self) -> None:
        interval = self.config.sample_interval_seconds
        print("[cat-cam] night watch started. Ctrl-C to stop.")
        with self.source:
            while True:
                now = datetime.now()
                if not within_active_hours(now, self.config.active_hours):
                    time.sleep(min(interval * 4, 60))
                    continue
                frame = self.source.read()
                if frame is None:
                    time.sleep(interval)
                    continue
                try:
                    in_bed = self.process_frame(frame)
                    if in_bed:
                        print(f"[cat-cam] {now:%H:%M:%S} in bed: {', '.join(sorted(in_bed))}")
                except Exception as exc:  # keep the watch alive through transient errors
                    print(f"[cat-cam] frame error: {exc}")
                time.sleep(interval)

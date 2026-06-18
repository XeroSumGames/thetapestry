"""Load and validate cat-cam configuration from a YAML file."""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import List, Tuple, Union

import yaml


@dataclass
class Config:
    """All the knobs for a cat-cam run, loaded from ``config.yaml``."""

    camera_source: Union[str, int]
    bed_polygon: List[Tuple[float, float]]
    cat_names: List[str]
    min_confidence: float
    active_hours: Tuple[int, int]
    sample_interval_seconds: float
    presence_confirm_samples: int
    database_path: str
    save_event_snapshots: bool
    snapshot_dir: str
    reference_photos_dir: str

    @classmethod
    def load(cls, path: str) -> "Config":
        with open(path, "r", encoding="utf-8") as f:
            raw = yaml.safe_load(f)

        base = os.path.dirname(os.path.abspath(path))

        def resolve(p: str) -> str:
            return p if os.path.isabs(p) else os.path.join(base, p)

        storage = raw.get("storage", {})
        monitor = raw.get("monitor", {})
        identify = raw.get("identify", {})

        return cls(
            camera_source=raw["camera"]["source"],
            bed_polygon=[tuple(pt) for pt in raw["bed_zone"]["polygon"]],
            cat_names=list(raw["cats"]["names"]),
            min_confidence=float(identify.get("min_confidence", 0.55)),
            active_hours=tuple(monitor.get("active_hours", [21, 8])),
            sample_interval_seconds=float(monitor.get("sample_interval_seconds", 5)),
            presence_confirm_samples=int(monitor.get("presence_confirm_samples", 3)),
            database_path=resolve(storage.get("database_path", "data/cat_cam.sqlite")),
            save_event_snapshots=bool(storage.get("save_event_snapshots", True)),
            snapshot_dir=resolve(storage.get("snapshot_dir", "data/snapshots")),
            reference_photos_dir=resolve(raw.get("reference_photos_dir", "reference_photos")),
        )

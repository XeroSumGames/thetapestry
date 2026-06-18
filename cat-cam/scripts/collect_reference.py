#!/usr/bin/env python3
"""Capture cat crops from the live camera to help you build reference photos.

This watches the feed, detects cats, and saves cropped cat images into
``reference_photos/_unsorted/``. You then sort them by hand into one folder
per cat (e.g. reference_photos/Shadow/). Aim for ~15 varied shots per cat.

    python scripts/collect_reference.py                 # uses ./config.yaml
    python scripts/collect_reference.py path/to/config.yaml [max_crops]

(You can also just copy normal phone photos of each cat into the per-cat
folders - this script is only a convenience for grabbing in-situ shots.)
"""
import os
import sys
import time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from cat_cam.config import Config
from cat_cam.capture import FrameSource
from cat_cam.detect import CatDetector


def main() -> None:
    import cv2

    config_path = sys.argv[1] if len(sys.argv) > 1 else "config.yaml"
    max_crops = int(sys.argv[2]) if len(sys.argv) > 2 else 60
    config = Config.load(config_path)

    out_dir = os.path.join(config.reference_photos_dir, "_unsorted")
    os.makedirs(out_dir, exist_ok=True)

    detector = CatDetector()
    saved = 0
    print(f"Collecting up to {max_crops} cat crops into {out_dir} (Ctrl-C to stop)...")

    with FrameSource(config.camera_source) as src:
        while saved < max_crops:
            frame = src.read()
            if frame is None:
                time.sleep(0.5)
                continue
            for box, conf in detector.detect(frame):
                x1, y1, x2, y2 = (int(v) for v in box)
                crop = frame[max(0, y1):y2, max(0, x1):x2]
                if crop.size == 0:
                    continue
                path = os.path.join(out_dir, f"cat_{datetime.now():%Y%m%d_%H%M%S_%f}.jpg")
                cv2.imwrite(path, crop)
                saved += 1
            time.sleep(2)

    print(f"Done. Saved {saved} crops. Now sort them into reference_photos/<CatName>/ folders.")


if __name__ == "__main__":
    main()

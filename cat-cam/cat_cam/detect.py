"""Detect cats in a frame using a pretrained YOLO model.

We only ask YOLO for the COCO 'cat' class (id 15), so there is no training
step here - the model already knows what a cat looks like. The downloaded
weights (``yolov8n.pt``) are cached by ultralytics after the first run.
"""
from __future__ import annotations

from typing import List, Tuple

import numpy as np

COCO_CAT_CLASS = 15

# (x1, y1, x2, y2) box plus the detection confidence.
Detection = Tuple[Tuple[float, float, float, float], float]


class CatDetector:
    def __init__(self, model_name: str = "yolov8n.pt", conf: float = 0.35):
        self.model_name = model_name
        self.conf = conf
        self._model = None

    def _ensure_model(self) -> None:
        if self._model is None:
            from ultralytics import YOLO

            self._model = YOLO(self.model_name)

    def detect(self, frame_bgr: np.ndarray) -> List[Detection]:
        self._ensure_model()
        results = self._model.predict(
            frame_bgr, conf=self.conf, classes=[COCO_CAT_CLASS], verbose=False
        )
        detections: List[Detection] = []
        for r in results:
            for b in r.boxes:
                xyxy = tuple(float(v) for v in b.xyxy[0].tolist())
                detections.append((xyxy, float(b.conf[0])))
        return detections

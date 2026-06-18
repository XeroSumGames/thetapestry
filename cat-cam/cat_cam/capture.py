"""Read frames from an RTSP URL or a USB webcam index via OpenCV."""
from __future__ import annotations

from typing import Optional, Union

import numpy as np


class FrameSource:
    """Thin wrapper over ``cv2.VideoCapture`` for an RTSP URL or webcam index."""

    def __init__(self, source: Union[str, int]):
        self.source = source
        self._cap = None

    def open(self) -> None:
        import cv2

        self._cap = cv2.VideoCapture(self.source)
        if not self._cap.isOpened():
            raise RuntimeError(
                f"Could not open camera source {self.source!r}. "
                "Check the RTSP URL / username / password, or the webcam index."
            )

    def read(self) -> Optional[np.ndarray]:
        """Grab one frame (BGR numpy array), or None if the read failed."""
        if self._cap is None:
            self.open()
        ok, frame = self._cap.read()
        return frame if ok else None

    def release(self) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None

    def __enter__(self) -> "FrameSource":
        self.open()
        return self

    def __exit__(self, *exc) -> None:
        self.release()

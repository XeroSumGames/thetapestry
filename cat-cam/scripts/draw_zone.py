#!/usr/bin/env python3
"""Click out the bed-zone polygon on a live camera frame.

Run this once during setup. It grabs a frame from your camera, you click the
corners of the bed, and it prints the polygon to paste into config.yaml.

    python scripts/draw_zone.py                  # uses ./config.yaml for the camera source
    python scripts/draw_zone.py path/to/config.yaml

Controls:  left-click = add a corner   |   u = undo   |   Enter = finish   |   Esc = cancel
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from cat_cam.config import Config
from cat_cam.capture import FrameSource


def main() -> None:
    import cv2

    config_path = sys.argv[1] if len(sys.argv) > 1 else "config.yaml"
    config = Config.load(config_path)

    with FrameSource(config.camera_source) as src:
        frame = None
        for _ in range(10):  # let the stream warm up
            frame = src.read()
            if frame is not None:
                break
    if frame is None:
        print("Could not read a frame from the camera. Check the source in config.yaml.")
        return

    points = []
    window = "Draw the bed zone - click corners, Enter to finish"

    def redraw():
        canvas = frame.copy()
        for i, p in enumerate(points):
            cv2.circle(canvas, p, 6, (0, 255, 0), -1)
            if i > 0:
                cv2.line(canvas, points[i - 1], p, (0, 255, 0), 2)
        if len(points) > 2:
            cv2.line(canvas, points[-1], points[0], (0, 200, 0), 1)
        cv2.imshow(window, canvas)

    def on_mouse(event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            points.append((x, y))
            redraw()

    cv2.namedWindow(window)
    cv2.setMouseCallback(window, on_mouse)
    redraw()

    while True:
        key = cv2.waitKey(20) & 0xFF
        if key in (13, 10):  # Enter
            break
        if key == 27:  # Esc
            points.clear()
            break
        if key == ord("u") and points:
            points.pop()
            redraw()

    cv2.destroyAllWindows()

    if len(points) < 3:
        print("Need at least 3 corners. Nothing saved.")
        return

    print("\nPaste this into config.yaml under bed_zone:\n")
    print("bed_zone:")
    print("  polygon:")
    for x, y in points:
        print(f"    - [{x}, {y}]")


if __name__ == "__main__":
    main()

"""Geometry helpers for deciding whether a detected cat is on the bed.

Pure Python with no heavy dependencies so this module is trivially testable.
"""
from __future__ import annotations

from typing import Sequence, Tuple

Point = Tuple[float, float]
Box = Tuple[float, float, float, float]  # (x1, y1, x2, y2)


def point_in_polygon(point: Point, polygon: Sequence[Point]) -> bool:
    """Ray-casting point-in-polygon test.

    Returns True if ``point`` lies inside ``polygon`` (a list of (x, y)
    vertices). Points exactly on an edge may return either result - that
    ambiguity does not matter for a bed-sized zone.
    """
    x, y = point
    inside = False
    n = len(polygon)
    if n < 3:
        return False
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        crosses = (yi > y) != (yj > y)
        if crosses:
            x_intersect = (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi
            if x < x_intersect:
                inside = not inside
        j = i
    return inside


def box_center(box: Box) -> Point:
    """Centre point of an (x1, y1, x2, y2) box."""
    x1, y1, x2, y2 = box
    return ((x1 + x2) / 2.0, (y1 + y2) / 2.0)


def box_anchor(box: Box) -> Point:
    """Bottom-centre of a box - where the cat is 'resting'.

    Using the bottom-centre rather than the geometric centre makes the
    in-bed test more accurate: a cat standing at the edge of the bed is
    counted by where its body sits, not where its head pokes out.
    """
    x1, y1, x2, y2 = box
    return ((x1 + x2) / 2.0, y2)

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from cat_cam.zones import box_anchor, box_center, point_in_polygon

SQUARE = [(0, 0), (10, 0), (10, 10), (0, 10)]


def test_point_inside_square():
    assert point_in_polygon((5, 5), SQUARE) is True


def test_point_outside_square():
    assert point_in_polygon((15, 5), SQUARE) is False
    assert point_in_polygon((-1, 5), SQUARE) is False


def test_degenerate_polygon_is_never_inside():
    assert point_in_polygon((0, 0), [(0, 0), (1, 1)]) is False


def test_concave_polygon():
    # An L-shape: the notch should read as outside.
    l_shape = [(0, 0), (10, 0), (10, 4), (4, 4), (4, 10), (0, 10)]
    assert point_in_polygon((2, 2), l_shape) is True
    assert point_in_polygon((8, 8), l_shape) is False


def test_box_center_and_anchor():
    box = (0, 0, 10, 20)
    assert box_center(box) == (5.0, 10.0)
    # anchor is bottom-centre
    assert box_anchor(box) == (5.0, 20.0)

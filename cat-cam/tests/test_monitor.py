import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from cat_cam.monitor import within_active_hours


def test_active_hours_wrapping_midnight():
    window = (21, 8)  # 9pm -> 8am
    assert within_active_hours(datetime(2026, 6, 18, 23, 0), window) is True
    assert within_active_hours(datetime(2026, 6, 19, 2, 0), window) is True
    assert within_active_hours(datetime(2026, 6, 19, 7, 0), window) is True
    assert within_active_hours(datetime(2026, 6, 19, 8, 0), window) is False
    assert within_active_hours(datetime(2026, 6, 18, 15, 0), window) is False


def test_active_hours_same_day():
    window = (9, 17)  # daytime
    assert within_active_hours(datetime(2026, 6, 18, 12, 0), window) is True
    assert within_active_hours(datetime(2026, 6, 18, 20, 0), window) is False

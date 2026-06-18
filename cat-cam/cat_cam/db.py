"""SQLite event log for cat-cam.

We record a row each time a cat is confirmed to have *arrived* in the bed
zone and again when it *left*. The morning report stitches those into
sessions. Plain SQLite keeps it dependency-free and lets you poke at the data
with any SQLite browser.
"""
from __future__ import annotations

import os
import sqlite3
from datetime import datetime
from typing import List, Optional

SCHEMA = """
CREATE TABLE IF NOT EXISTS presence_events (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    cat_name      TEXT NOT NULL,
    event         TEXT NOT NULL CHECK (event IN ('arrived', 'left')),
    ts            TEXT NOT NULL,
    confidence    REAL,
    snapshot_path TEXT
);
CREATE INDEX IF NOT EXISTS idx_presence_ts ON presence_events(ts);
"""


class EventLog:
    def __init__(self, path: str):
        self.path = path
        parent = os.path.dirname(os.path.abspath(path))
        os.makedirs(parent, exist_ok=True)
        self._conn = sqlite3.connect(path)
        self._conn.row_factory = sqlite3.Row
        self._conn.executescript(SCHEMA)
        self._conn.commit()

    def log(
        self,
        cat_name: str,
        event: str,
        ts: Optional[datetime] = None,
        confidence: Optional[float] = None,
        snapshot_path: Optional[str] = None,
    ) -> None:
        ts = ts or datetime.now()
        self._conn.execute(
            "INSERT INTO presence_events (cat_name, event, ts, confidence, snapshot_path) "
            "VALUES (?, ?, ?, ?, ?)",
            (cat_name, event, ts.isoformat(timespec="seconds"), confidence, snapshot_path),
        )
        self._conn.commit()

    def events_between(self, start: datetime, end: datetime) -> List[dict]:
        cur = self._conn.execute(
            "SELECT * FROM presence_events WHERE ts >= ? AND ts <= ? ORDER BY ts",
            (start.isoformat(timespec="seconds"), end.isoformat(timespec="seconds")),
        )
        return [dict(row) for row in cur.fetchall()]

    def close(self) -> None:
        self._conn.close()

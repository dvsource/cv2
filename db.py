import json
import os
import sqlite3
from pathlib import Path

DB_PATH = os.environ.get("CV_DB_PATH", Path(__file__).parent / "cv_history.db")


def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = _connect()
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS cv_versions (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            data       TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
            source     TEXT NOT NULL DEFAULT 'manual'
        )
    """)
    conn.commit()
    conn.close()


def seed_from_json(path):
    conn = _connect()
    count = conn.execute("SELECT COUNT(*) FROM cv_versions").fetchone()[0]
    if count == 0 and Path(path).exists():
        data = Path(path).read_text()
        conn.execute(
            "INSERT INTO cv_versions (data, source) VALUES (?, ?)",
            (data, "import"),
        )
        conn.commit()
    conn.close()


def save_version(data, source="manual"):
    conn = _connect()
    cur = conn.execute(
        "INSERT INTO cv_versions (data, source) VALUES (?, ?)",
        (json.dumps(data, ensure_ascii=False), source),
    )
    version_id = cur.lastrowid
    conn.commit()
    conn.close()
    return version_id


def get_latest():
    conn = _connect()
    row = conn.execute(
        "SELECT data FROM cv_versions ORDER BY id DESC LIMIT 1"
    ).fetchone()
    conn.close()
    if row:
        return json.loads(row["data"])
    return None


def list_versions(limit=50):
    conn = _connect()
    rows = conn.execute(
        "SELECT id, created_at, source FROM cv_versions ORDER BY id DESC LIMIT ?",
        (limit,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_version(version_id):
    conn = _connect()
    row = conn.execute(
        "SELECT id, data, created_at, source FROM cv_versions WHERE id = ?",
        (version_id,),
    ).fetchone()
    conn.close()
    if row:
        return {
            "id": row["id"],
            "data": json.loads(row["data"]),
            "created_at": row["created_at"],
            "source": row["source"],
        }
    return None

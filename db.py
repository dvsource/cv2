import hashlib
import json
import os
import sqlite3
from pathlib import Path

DB_PATH = os.environ.get("CV_DB_PATH", Path(__file__).parent / "cv_history.db")


def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
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
    conn.execute("""
        CREATE TABLE IF NOT EXISTS jobs (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            company      TEXT NOT NULL DEFAULT '',
            company_url  TEXT NOT NULL DEFAULT '',
            role         TEXT NOT NULL DEFAULT '',
            job_url      TEXT NOT NULL DEFAULT '',
            other_links  TEXT NOT NULL DEFAULT '[]',
            description  TEXT NOT NULL DEFAULT '',
            raw_content  TEXT NOT NULL DEFAULT '',
            summary      TEXT NOT NULL DEFAULT '{}',
            status       TEXT NOT NULL DEFAULT 'active',
            created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
            updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS job_cv_versions (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id     INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
            data       TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
            source     TEXT NOT NULL DEFAULT 'manual'
        )
    """)
    conn.commit()
    conn.close()


def _cv_hash(data: dict) -> str:
    """Stable SHA-256 of CV JSON with sorted keys — used to detect identical versions."""
    normalised = json.dumps(data, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(normalised.encode()).hexdigest()


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
    latest = conn.execute(
        "SELECT id, data FROM cv_versions ORDER BY id DESC LIMIT 1"
    ).fetchone()
    if latest and _cv_hash(json.loads(latest["data"])) == _cv_hash(data):
        conn.close()
        return latest["id"]  # identical — no new version needed
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


# ── Jobs ──────────────────────────────────────────────────────


def create_job(company="", company_url="", role="", job_url="",
               other_links=None, description="", raw_content="", summary=None):
    conn = _connect()
    cur = conn.execute(
        """INSERT INTO jobs
           (company, company_url, role, job_url, other_links, description, raw_content, summary)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            company, company_url, role, job_url,
            json.dumps(other_links or []),
            description, raw_content,
            json.dumps(summary or {}),
        ),
    )
    job_id = cur.lastrowid
    conn.commit()
    conn.close()
    return job_id


def list_jobs():
    conn = _connect()
    rows = conn.execute(
        "SELECT id, company, role, status, created_at, updated_at, summary FROM jobs ORDER BY id DESC"
    ).fetchall()
    conn.close()
    return [
        {
            "id": r["id"],
            "company": r["company"],
            "role": r["role"],
            "status": r["status"],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
            "summary": json.loads(r["summary"]),
        }
        for r in rows
    ]


def get_job(job_id):
    conn = _connect()
    row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    conn.close()
    if not row:
        return None
    return {
        "id": row["id"],
        "company": row["company"],
        "company_url": row["company_url"],
        "role": row["role"],
        "job_url": row["job_url"],
        "other_links": json.loads(row["other_links"]),
        "description": row["description"],
        "raw_content": row["raw_content"],
        "summary": json.loads(row["summary"]),
        "status": row["status"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


_ALLOWED_JOB_FIELDS = {
    "company", "company_url", "role", "job_url",
    "other_links", "description", "raw_content", "summary", "status",
}


def update_job(job_id, **fields):
    """Update any subset of job fields. Serialises other_links and summary if present."""
    if not fields:
        return False
    invalid = set(fields) - _ALLOWED_JOB_FIELDS
    if invalid:
        raise ValueError(f"Unknown job fields: {invalid}")
    if "other_links" in fields:
        fields["other_links"] = json.dumps(fields["other_links"])
    if "summary" in fields:
        fields["summary"] = json.dumps(fields["summary"])
    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values())
    values.append(job_id)
    conn = _connect()
    cur = conn.execute(
        f"UPDATE jobs SET {set_clause}, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?",
        values,
    )
    conn.commit()
    conn.close()
    return cur.rowcount > 0


def delete_job(job_id):
    conn = _connect()
    conn.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
    conn.commit()
    conn.close()


# ── Job CV Versions ───────────────────────────────────────────


def save_job_cv_version(job_id, data, source="manual"):
    conn = _connect()
    latest = conn.execute(
        "SELECT id, data FROM job_cv_versions WHERE job_id = ? ORDER BY id DESC LIMIT 1",
        (job_id,),
    ).fetchone()
    if latest and _cv_hash(json.loads(latest["data"])) == _cv_hash(data):
        conn.close()
        return latest["id"]  # identical — no new version needed
    cur = conn.execute(
        "INSERT INTO job_cv_versions (job_id, data, source) VALUES (?, ?, ?)",
        (job_id, json.dumps(data, ensure_ascii=False), source),
    )
    version_id = cur.lastrowid
    conn.commit()
    conn.close()
    return version_id


def get_latest_job_cv(job_id):
    conn = _connect()
    row = conn.execute(
        "SELECT data FROM job_cv_versions WHERE job_id = ? ORDER BY id DESC LIMIT 1",
        (job_id,),
    ).fetchone()
    conn.close()
    return json.loads(row["data"]) if row else None


def list_job_cv_versions(job_id, limit=50):
    conn = _connect()
    rows = conn.execute(
        "SELECT id, created_at, source FROM job_cv_versions WHERE job_id = ? ORDER BY id DESC LIMIT ?",
        (job_id, limit),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_job_cv_version(version_id):
    conn = _connect()
    row = conn.execute(
        "SELECT id, job_id, data, created_at, source FROM job_cv_versions WHERE id = ?",
        (version_id,),
    ).fetchone()
    conn.close()
    if not row:
        return None
    return {
        "id": row["id"],
        "job_id": row["job_id"],
        "data": json.loads(row["data"]),
        "created_at": row["created_at"],
        "source": row["source"],
    }


# ── Deduplication ─────────────────────────────────────────────


def deduplicate_versions() -> int:
    """Remove duplicate general CV versions, keeping the latest of each unique JSON.
    Returns number of rows deleted."""
    conn = _connect()
    rows = conn.execute(
        "SELECT id, data FROM cv_versions ORDER BY id ASC"
    ).fetchall()
    seen: dict[str, int] = {}
    to_delete: list[int] = []
    for row in rows:
        h = _cv_hash(json.loads(row["data"]))
        if h in seen:
            to_delete.append(seen[h])  # older duplicate — queue for deletion
        seen[h] = row["id"]  # keep track of latest id for this hash
    if to_delete:
        conn.execute(
            f"DELETE FROM cv_versions WHERE id IN ({','.join('?' * len(to_delete))})",
            to_delete,
        )
        conn.commit()
    conn.close()
    return len(to_delete)


def deduplicate_job_cv_versions() -> int:
    """Remove duplicate job CV versions across all jobs, keeping the latest of each unique JSON per job.
    Returns number of rows deleted."""
    conn = _connect()
    rows = conn.execute(
        "SELECT id, job_id, data FROM job_cv_versions ORDER BY id ASC"
    ).fetchall()
    seen: dict[tuple, int] = {}
    to_delete: list[int] = []
    for row in rows:
        key = (row["job_id"], _cv_hash(json.loads(row["data"])))
        if key in seen:
            to_delete.append(seen[key])
        seen[key] = row["id"]
    if to_delete:
        conn.execute(
            f"DELETE FROM job_cv_versions WHERE id IN ({','.join('?' * len(to_delete))})",
            to_delete,
        )
        conn.commit()
    conn.close()
    return len(to_delete)

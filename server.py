import json
import re
import tempfile
from pathlib import Path

from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS

from build_cv import build_pdf
from db import init_db, seed_from_json, save_version, get_latest, list_versions, get_version

DIST_DIR = Path(__file__).parent / "web" / "dist"

app = Flask(__name__, static_folder=str(DIST_DIR), static_url_path="")
CORS(app)

CV_PATH = Path(__file__).parent / "cv.json"

MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
_MONTH_MAP = {m.lower(): i + 1 for i, m in enumerate(MONTH_ABBR)}

def _parse_period_side(text: str, is_end: bool) -> dict | str:
    """Parse one side of a period string into {year, month} or 'present'."""
    text = text.strip()
    if text.lower() == "present":
        return "present"
    # "Mar 2022" or "March 2022"
    m = re.match(r"([A-Za-z]+)\s+(\d{4})", text)
    if m:
        month = _MONTH_MAP.get(m.group(1)[:3].lower(), 12 if is_end else 1)
        return {"year": int(m.group(2)), "month": month}
    # bare year "2019"
    m = re.match(r"^(\d{4})$", text)
    if m:
        return {"year": int(m.group(1)), "month": 12 if is_end else 1}
    # fallback: grab first 4-digit number
    m = re.search(r"\d{4}", text)
    if m:
        return {"year": int(m.group()), "month": 12 if is_end else 1}
    raise ValueError(f"Cannot parse period side: {text!r}")


def _migrate_period(value) -> dict:
    """Convert a legacy period string to a structured dict. No-op if already structured."""
    if isinstance(value, dict) and "start" in value and "end" in value:
        return value
    try:
        parts = re.split(r"\s*[-–]\s*", str(value).strip(), maxsplit=1)
        start = _parse_period_side(parts[0], is_end=False)
        if len(parts) > 1:
            end = _parse_period_side(parts[1], is_end=True)
        else:
            # Single-year like "2019" — treat end same year, month 12
            end = _parse_period_side(parts[0], is_end=True)
        return {"start": start, "end": end}
    except (ValueError, AttributeError):
        # Return a safe default rather than crashing the endpoint
        return {"start": {"year": 0, "month": 1}, "end": "present"}


def migrate_periods(data: dict) -> bool:
    """
    Walk experience[].roles[].period and education[].period.
    Convert any legacy string periods to structured dicts in-place.
    Returns True if any migration was performed, False if data was already clean.
    """
    changed = False
    for exp in data.get("experience", []):
        for role in exp.get("roles", []):
            if isinstance(role.get("period"), str):
                role["period"] = _migrate_period(role["period"])
                changed = True
    for edu in data.get("education", []):
        if isinstance(edu.get("period"), str):
            edu["period"] = _migrate_period(edu["period"])
            changed = True
    return changed


init_db()
seed_from_json(CV_PATH)


@app.get("/api/cv")
def get_cv():
    data = get_latest()
    if data is None and CV_PATH.exists():
        data = json.loads(CV_PATH.read_text())
    if data is None:
        data = {
            "contact": {"name": "", "email": "", "phone": "", "website": "", "linkedin": "", "github": ""},
            "summary": "",
            "skills": [],
            "experience": [],
            "projects": [],
            "education": [],
            "interests": [],
        }
    if migrate_periods(data):
        # Persist migrated data so this never runs again
        CV_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
        save_version(data, "migration")
    return jsonify(data)


@app.put("/api/cv")
def save_cv():
    data = request.get_json()
    CV_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    version_id = save_version(data, "manual")
    return jsonify({"ok": True, "version_id": version_id})


@app.post("/api/generate")
def generate():
    data = request.get_json()
    CV_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    save_version(data, "generate")
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        build_pdf(data, tmp.name)
        return send_file(tmp.name, mimetype="application/pdf")


@app.get("/api/versions")
def versions_list():
    return jsonify(list_versions())


@app.get("/api/versions/<int:vid>")
def versions_get(vid):
    v = get_version(vid)
    if v is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(v)


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_spa(path):
    if path and (DIST_DIR / path).is_file():
        return send_from_directory(str(DIST_DIR), path)
    return send_from_directory(str(DIST_DIR), "index.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True, port=5000)

import json
import os
import re
import tempfile
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS

from build_cv import build_pdf
from db import (
    init_db, seed_from_json, save_version, get_latest, list_versions, get_version,
    create_job, list_jobs, get_job, update_job, delete_job,
    save_job_cv_version, get_latest_job_cv, list_job_cv_versions, get_job_cv_version,
    deduplicate_versions, deduplicate_job_cv_versions,
)
from llm import extract_job_info, LLMError

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


def _migrate_period(value):
    """Convert a legacy period string to a structured dict.
    Returns a structured dict on success, or the original value unchanged on failure.
    No-op if already a properly structured dict."""
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
        # Leave unparseable value as-is rather than corrupting with a bad default
        import logging
        logging.getLogger(__name__).warning("Could not parse period value: %r", value)
        return value


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
                migrated = _migrate_period(role["period"])
                if isinstance(migrated, dict):
                    role["period"] = migrated
                    changed = True
    for edu in data.get("education", []):
        if isinstance(edu.get("period"), str):
            migrated = _migrate_period(edu["period"])
            if isinstance(migrated, dict):
                edu["period"] = migrated
                changed = True
    return changed


init_db()
seed_from_json(CV_PATH)
deduplicate_versions()
deduplicate_job_cv_versions()


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


@app.get("/api/jobs")
def jobs_list():
    return jsonify(list_jobs())


@app.post("/api/jobs")
def jobs_create():
    body = request.get_json()
    mode = body.get("mode", "manual")  # "paste" or "manual"

    extracted = {}
    if mode == "paste":
        raw_content = body.get("raw_content", "")
        if raw_content.strip():
            try:
                extracted = extract_job_info(raw_content, fill_company_role=True)
            except LLMError as e:
                return jsonify({"error": f"LLM extraction failed: {e}"}), 502
        company = extracted.get("company") or body.get("company", "")
        role = extracted.get("role") or body.get("role", "")
        description = extracted.get("description") or body.get("description", "")
    else:
        raw_content = ""
        company = body.get("company", "")
        role = body.get("role", "")
        description = body.get("description", "")
        if description.strip():
            try:
                extracted = extract_job_info(description, fill_company_role=False)
            except LLMError as e:
                return jsonify({"error": f"LLM extraction failed: {e}"}), 502

    summary = {
        "tech_skills": extracted.get("tech_skills", []),
        "other_skills": extracted.get("other_skills", []),
        "key_points": extracted.get("key_points", []),
    }

    job_id = create_job(
        company=company,
        company_url=body.get("company_url", ""),
        role=role,
        job_url=body.get("job_url", ""),
        other_links=body.get("other_links", []),
        description=description,
        raw_content=raw_content,
        summary=summary,
    )
    return jsonify({"ok": True, "job_id": job_id, "job": get_job(job_id)}), 201


@app.get("/api/jobs/<int:jid>")
def jobs_get(jid):
    job = get_job(jid)
    if job is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(job)


@app.put("/api/jobs/<int:jid>")
def jobs_update(jid):
    if get_job(jid) is None:
        return jsonify({"error": "not found"}), 404
    body = request.get_json()
    allowed = {"company", "company_url", "role", "job_url", "other_links",
               "description", "raw_content", "status"}
    fields = {k: v for k, v in body.items() if k in allowed}

    if body.get("re_extract") and fields.get("description", "").strip():
        try:
            extracted = extract_job_info(fields["description"], fill_company_role=False)
            fields["summary"] = {
                "tech_skills": extracted.get("tech_skills", []),
                "other_skills": extracted.get("other_skills", []),
                "key_points": extracted.get("key_points", []),
            }
        except LLMError as e:
            return jsonify({"error": f"LLM extraction failed: {e}"}), 502

    update_job(jid, **fields)
    return jsonify({"ok": True, "job": get_job(jid)})


@app.delete("/api/jobs/<int:jid>")
def jobs_delete(jid):
    if get_job(jid) is None:
        return jsonify({"error": "not found"}), 404
    delete_job(jid)
    return jsonify({"ok": True})


@app.get("/api/jobs/<int:jid>/cv")
def job_cv_get(jid):
    if get_job(jid) is None:
        return jsonify({"error": "not found"}), 404
    data = get_latest_job_cv(jid)
    if data is None:
        # Seed from General CV (copy current latest)
        data = get_latest()
        if data is None and CV_PATH.exists():
            data = json.loads(CV_PATH.read_text())
        if data is None:
            data = {
                "contact": {"name": "", "email": "", "phone": "", "website": "", "linkedin": "", "github": ""},
                "summary": "", "skills": [], "experience": [], "projects": [],
                "education": [], "interests": [],
            }
    return jsonify(data)


@app.put("/api/jobs/<int:jid>/cv")
def job_cv_save(jid):
    if get_job(jid) is None:
        return jsonify({"error": "not found"}), 404
    data = request.get_json()
    version_id = save_job_cv_version(jid, data, "manual")
    return jsonify({"ok": True, "version_id": version_id})


@app.post("/api/jobs/<int:jid>/generate")
def job_cv_generate(jid):
    if get_job(jid) is None:
        return jsonify({"error": "not found"}), 404
    data = request.get_json()
    save_job_cv_version(jid, data, "generate")
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        build_pdf(data, tmp.name)
        return send_file(tmp.name, mimetype="application/pdf")


@app.get("/api/jobs/<int:jid>/versions")
def job_cv_versions_list(jid):
    if get_job(jid) is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(list_job_cv_versions(jid))


@app.get("/api/jobs/<int:jid>/versions/<int:vid>")
def job_cv_versions_get(jid, vid):
    v = get_job_cv_version(vid)
    if v is None or v["job_id"] != jid:
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

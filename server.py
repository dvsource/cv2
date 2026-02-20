import json
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
        }
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
    app.run(host="0.0.0.0", debug=True, port=3000)

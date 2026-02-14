import json
import tempfile
from pathlib import Path

from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS

from build_cv import build_pdf

DIST_DIR = Path(__file__).parent / "web" / "dist"

app = Flask(__name__, static_folder=str(DIST_DIR), static_url_path="")
CORS(app)

CV_PATH = Path(__file__).parent / "cv.json"


@app.get("/api/cv")
def get_cv():
    data = json.loads(CV_PATH.read_text())
    return jsonify(data)


@app.put("/api/cv")
def save_cv():
    data = request.get_json()
    CV_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    return jsonify({"ok": True})


@app.post("/api/generate")
def generate():
    data = request.get_json()
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        build_pdf(data, tmp.name)
        return send_file(tmp.name, mimetype="application/pdf")


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_spa(path):
    if path and (DIST_DIR / path).is_file():
        return send_from_directory(str(DIST_DIR), path)
    return send_from_directory(str(DIST_DIR), "index.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True, port=5000)

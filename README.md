# CV Editor

A full-stack CV editor with a React form UI on the left and a live PDF preview on the right. Flask serves the API and built frontend. ReportLab generates ATS-ready PDFs with Noto Sans/Mono fonts.

## Quick Start

### Docker (recommended)

```bash
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000).

### Local Dev

Requires Python 3 with a virtualenv and Node.js.

**Fonts**: Noto Sans and Noto Sans Mono must be installed at `/usr/share/fonts/noto/`.

```bash
# Backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python server.py                # http://localhost:3000

# Frontend (separate terminal)
cd web && npm install
npm run dev                     # http://localhost:5173 (proxies /api → :3000)
```

## Build

```bash
cd web && npm run build         # outputs to web/dist/
```

Flask serves the built frontend from `web/dist/` in production.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cv` | Load CV data |
| PUT | `/api/cv` | Save CV data |
| POST | `/api/generate` | Generate PDF, returns the file |

## Project Structure

```
server.py          Flask API and SPA server
build_cv.py        PDF generation engine (ReportLab)
cv.json            CV data (volume-mounted in Docker)
requirements.txt   Python dependencies
Dockerfile
docker-compose.yml
web/               React + Vite + Tailwind v4 frontend
  src/App.tsx      Single-component editor with form + PDF preview
```

# CV Editor

A full-stack CV editor with a React form UI on the left and a live PDF preview on the right. Flask serves the API and built frontend. ReportLab generates ATS-ready PDFs with Noto Sans/Mono fonts.

## Features

- **Live PDF preview** — edit in the form, generate and preview instantly
- **Professional title** — display a role/title line below your name
- **Structured date fields** — month + year dropdowns with a "Present" toggle
- **Hyperlinked contact links** — email, website, LinkedIn, and GitHub are clickable in the PDF
- **Achievements section** — optional bullet list between Skills and Experience
- **Drag-and-drop section order** — reorder Skills, Achievements, Experience, Projects, Education, and Interests; Summary is always pinned at the top
- **Version history** — every save and PDF generation is stored in SQLite; restore any previous version from the dropdown
- **JSON import / export** — portable CV data in a single file
- **ATS-ready PDF** — Noto Sans/Mono fonts, proper heading hierarchy, hanging-indent bullet points

## Quick Start

### Docker (recommended)

```bash
docker compose up --build
```

Open [http://localhost:5000](http://localhost:5000).

### Local Dev

Requires Python 3 with a virtualenv and Node.js.

**Fonts**: Noto Sans and Noto Sans Mono must be installed at `/usr/share/fonts/noto/`.

```bash
# Backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python server.py                # http://localhost:5000

# Frontend (separate terminal)
cd web && npm install
npm run dev                     # http://localhost:5173 (proxies /api → :5000)
```

## Build

```bash
cd web && npm run build         # outputs to web/dist/
```

Flask serves the built frontend from `web/dist/` in production.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cv` | Load CV data (migrates legacy period strings on first call) |
| PUT | `/api/cv` | Save CV data |
| POST | `/api/generate` | Generate PDF, returns the file |
| GET | `/api/versions` | List version history |
| GET | `/api/versions/<id>` | Fetch a specific version |

## CV Data Shape

```typescript
interface CvData {
  contact: {
    name: string
    title?: string          // e.g. "Full Stack Engineer"
    email, phone, website, linkedin, github: string
  }
  summary: string
  skills: { label: string, items: string }[]
  achievements?: string[]  // optional; omitted = section hidden in PDF
  experience: {
    company: string
    roles: {
      title: string
      period: { start: { year, month }, end: { year, month } | "present" }
      description: string   // newline-separated bullet points
    }[]
    pageBreakAfter?: boolean
  }[]
  projects: { name, description, pageBreakAfter? }[]
  education: {
    institution, degree?: string
    period: { start: { year, month }, end: { year, month } | "present" }
    focus: string[]
    pageBreakAfter?: boolean
  }[]
  interests: string[]
  sectionOrder?: string[]  // default: ["skills","achievements","experience","projects","education","interests"]
}
```

Legacy `period` strings (e.g. `"2022 - 2026"`) are automatically migrated to the structured format on the first `GET /api/cv` call.

## Project Structure

```
server.py          Flask API and SPA server
build_cv.py        PDF generation engine (ReportLab)
cv.json            CV data (volume-mounted in Docker)
db.py              SQLite version history
requirements.txt   Python dependencies
Dockerfile
docker-compose.yml
web/               React + Vite + Tailwind v4 frontend
  src/App.tsx      Single-component editor with form + PDF preview
```

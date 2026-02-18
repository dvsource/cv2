# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A full-stack CV editor: React form UI on the left, live PDF preview on the right. Flask serves the API and built frontend. ReportLab generates ATS-ready PDFs with Noto Sans/Mono fonts.

## Commands

```bash
# Local dev (two terminals)
python server.py                    # Flask backend on :5000
cd web && npm run dev               # Vite dev server on :5173 (proxies /api to :5000)

# Build frontend
cd web && npm run build             # tsc -b && vite build → web/dist/

# Lint
cd web && npm run lint              # ESLint

# Docker
docker compose up --build           # Full stack on :5000, mounts cv.json
```

## Architecture

**Data flow**: `cv.json` ↔ Flask API ↔ React form ↔ POST `/api/generate` → ReportLab → PDF

| File | Role |
|------|------|
| `server.py` | Flask: GET/PUT `/api/cv`, POST `/api/generate`, SPA catch-all serving `web/dist/` |
| `build_cv.py` | PDF engine: `build_pdf(data, output_path)` — fonts, styles, section builders, BaseDocTemplate with zero-padding Frame |
| `web/src/App.tsx` | Single-component editor with all form sections, PDF preview iframe, Tailwind styling |
| `cv.json` | CV data (volume-mounted in Docker) |

**API endpoints**: `GET /api/cv` (load), `PUT /api/cv` (save), `POST /api/generate` (PDF)

## Key Constraints

- **Fonts**: `build_cv.py` expects Noto Sans/Mono at `/usr/share/fonts/noto/`. Dockerfile installs `fonts-noto-core` and copies TTFs there. Locally, fonts must exist at that path.
- **PDF layout**: Uses `BaseDocTemplate` with explicit zero-padding `Frame` (not `SimpleDocTemplate`) to avoid ReportLab's default 6pt frame padding messing up table column widths.
- **Letter-spacing**: Section headers use a custom `SpacedText(Flowable)` that sets the PDF `Tc` operator directly via `canv._code.append()` — ReportLab has no public API for charSpace.
- **Tailwind v4**: Uses `@tailwindcss/vite` plugin and `@import "tailwindcss"` (not v3 directives/config).
- **Vite proxy**: Dev server proxies `/api` to `http://localhost:5000` (configured in `vite.config.ts`).

## CV Data Shape

```typescript
interface CvData {
  contact: { name, email, phone, website, linkedin, github }
  summary: string
  skills: { label: string, items: string[] }[]
  experience: { company, roles: { title, period, description }[], pageBreakAfter? }[]
  projects: { name, description, pageBreakAfter? }[]
  education: { institution, degree?, period, focus: string[], pageBreakAfter? }[]
}
```

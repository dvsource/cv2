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
| `server.py` | Flask: GET/PUT `/api/cv`, POST `/api/generate`, SPA catch-all serving `web/dist/`. Also contains `migrate_periods()` called on GET to convert legacy period strings. |
| `build_cv.py` | PDF engine: `build_pdf(data, output_path)` — fonts, styles, section builders, BaseDocTemplate with zero-padding Frame. Section order is dynamic via `SECTION_BUILDERS` dict + `sectionOrder` field. |
| `web/src/App.tsx` | Single-component editor with all form sections, PDF preview iframe, Tailwind styling. |
| `cv.json` | CV data (volume-mounted in Docker) |
| `db.py` | SQLite version history (WAL mode) + `jobs` and `job_cv_versions` tables with CRUD |
| `llm.py` | GLM 5.1 LLM client; `extract_job_info(text, fill_company_role)` → `{company, role, description, tech_skills, other_skills, key_points}` |
| `web/src/types.ts` | Shared TypeScript types (CV types + Job types: `Job`, `JobListItem`, `JobStatus`, `JobSummary`) |
| `web/src/JobPanel.tsx` | Left overlay panel: job list, create form (paste/manual), job detail + LLM summary |

**API endpoints**:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cv` | Load CV + migrate legacy periods |
| PUT | `/api/cv` | Save CV |
| POST | `/api/generate` | Generate PDF |
| GET | `/api/versions` | List CV versions |
| GET | `/api/versions/<id>` | Get specific CV version |
| GET | `/api/jobs` | List all jobs |
| POST | `/api/jobs` | Create job; mode: `paste` (LLM extracts all fields) or `manual` (LLM enriches description) |
| GET | `/api/jobs/<id>` | Get job detail |
| PUT | `/api/jobs/<id>` | Update job fields; `re_extract: true` re-runs LLM on description |
| DELETE | `/api/jobs/<id>` | Delete job and all its CV versions |
| GET | `/api/jobs/<id>/cv` | Get latest job CV (seeds from General if none exists) |
| PUT | `/api/jobs/<id>/cv` | Save job CV (creates new version) |
| POST | `/api/jobs/<id>/generate` | Generate PDF for job CV |
| GET | `/api/jobs/<id>/versions` | List CV versions for job |
| GET | `/api/jobs/<id>/versions/<vid>` | Get specific job CV version |

## Key Constraints

- **Fonts**: `build_cv.py` expects Noto Sans/Mono at `/usr/share/fonts/noto/`. Dockerfile installs `fonts-noto-core` and copies TTFs there. Locally, fonts must exist at that path.
- **PDF layout**: Uses `BaseDocTemplate` with explicit zero-padding `Frame` (not `SimpleDocTemplate`) to avoid ReportLab's default 6pt frame padding messing up table column widths.
- **Letter-spacing**: Section headers use a custom `SpacedText(Flowable)` that sets the PDF `Tc` operator directly via `canv._code.append()` — ReportLab has no public API for charSpace.
- **Date column width**: Experience and education tables use `date_w = 40 * mm` to fit formatted period strings like `"Jan 2022 – Present"`. Do not reduce below 38mm.
- **Tailwind v4**: Uses `@tailwindcss/vite` plugin and `@import "tailwindcss"` (not v3 directives/config).
- **Vite proxy**: Dev server proxies `/api` to `http://localhost:5000` (configured in `vite.config.ts`).
- **Hyperlinks in PDF**: Contact links use ReportLab `<link href="...">` Paragraph markup. The href is XML-escaped via `_xml_escape`. URLs without a scheme get `https://` prepended.
- **LLM API**: GLM 5.1 via OpenAI-compatible endpoint `https://api.z.ai/api/coding/paas/v4`. Model ID: `"glm-5.1"`. API key loaded from `.env` as `GLM_API_KEY` via `python-dotenv`. Raises `LLMError` on failure; Flask routes return 502.
- **Job context**: `activeJobId: number | null` in App.tsx controls whether save/generate/versions route to `/api/jobs/<id>/...` or `/api/cv`. `switchToJob(id)` loads the correct CV and closes the panel.
- **Job CV seeding**: `GET /api/jobs/<id>/cv` returns the latest job-specific CV version, or seeds from the current General latest if none exists (does not auto-save the seed).
- **JobPanel**: Always mounted in DOM. `open` prop controls `translate-x-0` vs `-translate-x-full`. Three views: `list`, `create`, `detail`.
- **Column allowlist**: `update_job()` in `db.py` validates field names against `_ALLOWED_JOB_FIELDS` set before building dynamic SQL to prevent injection.

## CV Data Shape

```typescript
type Period = { start: { year: number; month: number }; end: { year: number; month: number } | "present" }

interface CvData {
  contact: { name, title?, email, phone, website, linkedin, github: string }
  summary: string
  skills: { label: string, items: string }[]
  achievements?: string[]
  experience: { company, roles: { title, period: Period, description }[], pageBreakAfter? }[]
  projects: { name, description, pageBreakAfter? }[]
  education: { institution, degree?, period: Period, focus: string[], pageBreakAfter? }[]
  interests: string[]
  sectionOrder?: string[]  // default: ["skills","achievements","experience","projects","education","interests"]
}
```

**Period migration**: Legacy `period: "2022 - 2026"` strings are auto-migrated to the structured format by `migrate_periods()` in `server.py` on the first `GET /api/cv`. The migrated data is written back to both SQLite and `cv.json` so the migration only runs once.

## Section Order

`build_pdf()` uses a `SECTION_BUILDERS` dispatch dict and iterates `data.sectionOrder`. Summary is always rendered first (pinned). Any canonical key missing from a stored `sectionOrder` is appended to the end. All builder signatures accept `(data, styles, content_width)`.

## React Form

`normaliseCvData()` is called on every data load path (initial fetch, version restore, JSON import). It ensures `interests` and `achievements` are arrays, `sectionOrder` contains all canonical keys, and any remaining string periods are replaced with `DEFAULT_PERIOD`. Sections are rendered dynamically from `data.sectionOrder` with HTML5 drag-and-drop for reordering.

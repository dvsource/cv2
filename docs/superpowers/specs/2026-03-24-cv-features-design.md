# CV Editor — Feature Set Design Spec
Date: 2026-03-24

## Overview

Six features/fixes to the full-stack CV editor (React form + Flask API + ReportLab PDF generation). All changes must be consistent across the JSON data model, the PDF generator (`build_cv.py`), and the React form (`web/src/App.tsx`).

---

## 1. Professional Title / Subtitle

### Data Model
Add `contact.title: string` (optional) to the CV JSON.

```json
"contact": {
  "name": "Viraj Kaushalye",
  "title": "Full Stack Engineer",
  ...
}
```

### PDF (`build_cv.py`)
- Render `contact.title` on a new line immediately below the name
- Style: smaller font than name (e.g. 11pt), same dark blue `#1B2A4A`, not bold
- Omit the line entirely if `title` is absent or empty

### Form (`web/src/App.tsx`)
- Add a "Title / Role" text input in the Contact section, below the Name field
- Updates `data.contact.title`

### TypeScript
Update the `Contact` interface in `App.tsx` to add `title?: string`.

---

## 2. Hyperlinked Contact Links

### PDF (`build_cv.py`)
Apply ReportLab `<link href="...">` tags in Paragraph markup to make contact items clickable:
- `email` → `mailto:<value>`
- `website`, `linkedin`, `github` → normalise by prepending `https://` if the value has no URL scheme (i.e. does not start with `http://` or `https://`), then link to the normalised URL

Display text remains unchanged (the human-readable URL/handle). Colour and underline style should remain consistent with the existing contact line style.

### Form
No changes needed — values are already stored as full URLs in practice; normalisation is only applied at PDF render time.

---

## 3. Bullet Point Hanging Indent Fix

### Problem
When a bullet point description wraps to a second line, the wrapped text aligns to the left margin instead of indenting under the text of the first line, breaking visual alignment.

### PDF (`build_cv.py`)
Update **both** of the following paragraph styles:
- `bullet` — used for experience role description lines
- `proj_desc` — used for project description lines

For each, set:
- `leftIndent = 12pt` (or equivalent in ReportLab points)
- `firstLineIndent = -8pt` (negative to pull the bullet glyph back)

This creates a true hanging indent: bullet at the left margin, all continuation text aligned under the first character.

---

## 4. Structured Date Fields

### Data Model
Replace the `period: string` field on roles and education entries with a structured object:

```json
"period": {
  "start": { "year": 2022, "month": 3 },
  "end": { "year": 2023, "month": 12 }
}
```

Or when the end date is current:
```json
"period": {
  "start": { "year": 2022, "month": 3 },
  "end": "present"
}
```

- `month` is an integer 1–12. When migrating from a bare-year string (e.g. `"2019"` or `"2006 - 2014"`), default start month to `1` (January) and end month to `12` (December).
- `year` is an integer.
- `end` is either `{ year, month }` or the string `"present"`.

### Migration
Migration is performed in `server.py` in the `GET /api/cv` handler. When loading CV data (from SQLite or cv.json), apply a `migrate_periods(data)` utility that walks all `roles[].period` and `education[].period` fields. Projects do not have a `period` field. For each field that is a plain string:
1. Parse the string: split on `-` or `–`, trim whitespace
2. If the right side is "present" (case-insensitive), set `end = "present"`
3. Parse each side for year (4-digit int) and optionally a 3-letter month abbreviation
4. If no month found, default start month = 1, end month = 12
5. Replace the string with the structured object

After migration, persist the migrated data in two places:
- `save_version(data, source="migration")` — writes a new SQLite row so subsequent DB loads return structured data
- Overwrite `cv.json` on disk with the migrated data — so that if the Docker container restarts with an ephemeral DB, `seed_from_json` re-seeds from an already-migrated file and migration is never triggered again

The migration function is idempotent: if all period fields are already structured objects, it returns immediately without writing anything.

### PDF (`build_cv.py`)
A `format_period(period)` helper function:
- If `period` is a string (legacy, should not occur post-migration), return it as-is
- Otherwise format as `"Mar 2022 – Dec 2023"` or `"Mar 2022 – Present"` using 3-letter month abbreviations

### Form (`web/src/App.tsx`)
Replace the period text input on roles and education entries with:
- **Start**: Month dropdown (Jan–Dec, value 1–12) + Year dropdown (1990–2035)
- **End**: Month dropdown + Year dropdown, plus a "Present" checkbox
- When "Present" is checked: end dropdowns are disabled; `end` is set to `"present"`
- When "Present" is unchecked: restore the last known `end` object if available, otherwise default to current month/year

### TypeScript
Update the `CvData`, `Role`, and `Education` interfaces to reflect the new period shape (projects do not have a period field):
```typescript
type PeriodDate = { year: number; month: number }
type Period = { start: PeriodDate; end: PeriodDate | 'present' }
```

### Known Limitation
The standalone CLI (`python build_cv.py cv.json`) reads raw JSON directly and bypasses server-side migration. If `cv.json` still contains legacy period strings, the PDF builder will call `format_period` on a string and return it as-is (graceful fallback), but the output will be the raw string rather than the formatted version.

---

## 5. Achievements Section

### Data Model
Add optional top-level field:
```json
"achievements": ["Promoted to Tech Lead within 18 months", "..."]
```
Omitted or empty array = section not rendered.

### PDF (`build_cv.py`)
- Section header: "ACHIEVEMENTS" (same style as other section headers)
- Position: between Skills and Experience (controlled by `sectionOrder`)
- Rendered as a plain bullet list — no dates, no labels, same hanging-indent bullet style as Interests
- Skip section entirely if `achievements` is absent or empty

### Form (`web/src/App.tsx`)
- New collapsible section "Achievements" between Skills and Experience (in default order)
- Same UI pattern as Interests: add/remove plain text items
- No date or label fields

### TypeScript
Add `achievements?: string[]` to the `CvData` interface.

---

## 6. Section Reordering

### Data Model
New top-level field:
```json
"sectionOrder": ["skills", "achievements", "experience", "projects", "education", "interests"]
```
- Summary is always pinned first — not included in `sectionOrder`
- If `sectionOrder` is absent, use the default order above
- When rendering (both PDF and form), reconcile against the full set of known section keys: any key present in the canonical list but absent from the stored array is appended to the end. This handles the case where `"achievements"` was added after a user's existing `sectionOrder` was saved.

### TypeScript
Add `sectionOrder?: string[]` to the `CvData` interface.

### PDF (`build_cv.py`)
`build_pdf()` renders summary first (always), then iterates `sectionOrder` to call the appropriate section builder.

To handle differing builder signatures, normalise all builders to accept `(data, styles, content_width)` — builders that don't use `content_width` simply ignore it. The dispatch table:

| Key | Builder |
|-----|---------|
| `skills` | `build_skills(data, styles, content_width)` |
| `achievements` | `build_achievements(data, styles, content_width)` |
| `experience` | `build_experience(data, styles, content_width)` |
| `projects` | `build_projects(data, styles, content_width)` |
| `education` | `build_education(data, styles, content_width)` |
| `interests` | `build_interests(data, styles, content_width)` |

### Form (`web/src/App.tsx`)
- Each section header row (except Summary) has a ⠿ drag handle on the left
- HTML5 drag-and-drop API: `draggable`, `onDragStart`, `onDragOver`, `onDrop` on section wrappers
- Dropping reorders the `data.sectionOrder` array in state; the form re-renders sections in the new order
- Summary section always renders first with no drag handle
- On initial load, if `sectionOrder` is absent or missing keys, apply the same reconciliation (missing keys appended to end)

---

## Affected Files Summary

| File | Changes |
|------|---------|
| `cv.json` | Seed file updated to include `contact.title`, `achievements`, `sectionOrder`; existing `period` strings migrated on first load |
| `build_cv.py` | Title rendering, hyperlink normalisation, hanging indent fix (`bullet` + `proj_desc` styles), `format_period()` helper, `build_achievements()`, normalise all builder signatures to 3 args, section order loop |
| `server.py` | `migrate_periods()` utility called in `GET /api/cv`; migrated data persisted via `save_version` |
| `web/src/App.tsx` | Contact title input, period dropdowns with Present toggle, Achievements section, drag-and-drop section reordering, TypeScript interface updates (`Contact`, `CvData`, `Role`, `Education`, `Period`) |

---

## Out of Scope
- No new API endpoints needed
- No changes to Docker or deployment config
- No changes to the version history UI

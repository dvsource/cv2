# CV Editor — Feature Set Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 features to the CV editor: professional title, hyperlinked contact links, bullet hanging indent fix, structured date fields with migration, achievements section, and drag-and-drop section reordering.

**Architecture:** Backend changes (server.py, build_cv.py) are independent of frontend changes (App.tsx) — they can be worked in sequence. The data model change (structured periods) requires a server-side migration that runs on first GET and persists both to SQLite and cv.json on disk.

**Tech Stack:** Python 3 / Flask / ReportLab, React 19 / TypeScript / Tailwind v4, SQLite

---

## File Map

| File | What Changes |
|------|-------------|
| `server.py` | Add `migrate_periods()` called in `GET /api/cv`; write back to cv.json + SQLite if migration ran |
| `build_cv.py` | Hanging indent styles; `format_period()`; hyperlinked contact; title rendering; `build_achievements()`; normalise all builder signatures to 3 args; section-order dispatch loop |
| `cv.json` | Add `contact.title`, `achievements`, `sectionOrder`; leave periods as legacy strings (migration handles them) |
| `web/src/App.tsx` | New TypeScript types (`Period`, `PeriodDate`); update `Contact`/`Role`/`Education`/`CvData` interfaces; title input in Contact; `PeriodPicker` component; Achievements section; drag-and-drop Section reordering; normalise `sectionOrder`/`achievements` on data load |

---

## Task 1: Period Migration (server.py)

**Files:**
- Modify: `server.py`

- [ ] **Step 1: Add `_parse_period_str()` helper above the Flask routes in `server.py`**

```python
import re

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
    return {"year": int(m.group()), "month": 12 if is_end else 1}


def _migrate_period(value) -> dict:
    """Convert a legacy period string to a structured dict. No-op if already structured."""
    if isinstance(value, dict):
        return value
    parts = re.split(r"\s*[-–]\s*", str(value).strip(), maxsplit=1)
    start = _parse_period_side(parts[0], is_end=False)
    if len(parts) > 1:
        end = _parse_period_side(parts[1], is_end=True)
    else:
        # Single-year like "2019" — treat end same year, month 12
        end = _parse_period_side(parts[0], is_end=True)
    return {"start": start, "end": end}


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
```

- [ ] **Step 2: Call `migrate_periods()` in the `GET /api/cv` handler**

Find the `get_cv()` function (line 22–36 in server.py). Replace it with:

```python
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
```

- [ ] **Step 3: Add `re` import to server.py**

Add `import re` to the top of the file with the other imports.

- [ ] **Step 4: Verify migration works**

Start the server (`python server.py`) and hit `http://localhost:5000/api/cv`. Confirm the response JSON has structured periods like `{"start": {"year": 2022, "month": 1}, "end": {"year": 2026, "month": 12}}` instead of `"2022 - 2026"`. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add server.py
git commit -m "feat: migrate legacy period strings to structured {year, month} objects"
```

---

## Task 2: Update cv.json seed file

**Files:**
- Modify: `cv.json`

- [ ] **Step 1: Add `contact.title`, `achievements`, and `sectionOrder` to cv.json**

Add `"title": "Full Stack Engineer"` inside the `"contact"` object.

Add after the `"summary"` key:
```json
"achievements": [],
"sectionOrder": ["skills", "achievements", "experience", "projects", "education", "interests"],
```

Leave the `period` strings as-is — the migration in Task 1 will convert them on first server load and overwrite this file.

- [ ] **Step 2: Verify the file is valid JSON**

```bash
python -c "import json; json.load(open('cv.json')); print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add cv.json
git commit -m "feat: add title, achievements, and sectionOrder fields to cv.json seed"
```

---

## Task 3: PDF — Bullet Hanging Indent Fix (build_cv.py)

**Files:**
- Modify: `build_cv.py:187-209` (the `bullet` and `proj_desc` styles in `make_styles()`)

- [ ] **Step 1: Update the `bullet` style** (lines 187–193)

```python
s["bullet"] = ParagraphStyle(
    "bullet",
    fontName="NotoSans",
    fontSize=9.5,
    leading=13.5,
    textColor=COLOR_MUTED,
    leftIndent=12,
    firstLineIndent=-8,
)
```

- [ ] **Step 2: Update the `proj_desc` style** (lines 203–209)

```python
s["proj_desc"] = ParagraphStyle(
    "proj_desc",
    fontName="NotoSans",
    fontSize=9.5,
    leading=13,
    textColor=COLOR_MUTED,
    leftIndent=12,
    firstLineIndent=-8,
)
```

- [ ] **Step 3: Verify — generate a PDF and visually check that multi-line bullets align correctly**

```bash
python build_cv.py cv.json --output /tmp/test.pdf
```

Open `/tmp/test.pdf`. Long bullet lines should wrap with their continuation indented to align under the first character, not the left margin.

- [ ] **Step 4: Commit**

```bash
git add build_cv.py
git commit -m "fix: add hanging indent to bullet and proj_desc paragraph styles"
```

---

## Task 4: PDF — format_period() helper + update experience/education (build_cv.py)

**Files:**
- Modify: `build_cv.py`

- [ ] **Step 1: Add `MONTH_ABBR` constant and `format_period()` below the `esc()` helper (after line 76)**

```python
MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]


def format_period(period) -> str:
    """Format a period dict as 'Mar 2022 – Dec 2023' or 'Mar 2022 – Present'.
    Falls back to str(period) for legacy string values."""
    if isinstance(period, str):
        return period
    if not isinstance(period, dict):
        return ""
    start = period.get("start", {})
    end = period.get("end", {})
    sm = start.get("month", 1)
    sy = start.get("year", "")
    start_str = f"{MONTH_ABBR[sm - 1]} {sy}" if sy else ""
    if end == "present":
        end_str = "Present"
    elif isinstance(end, dict):
        em = end.get("month", 12)
        ey = end.get("year", "")
        end_str = f"{MONTH_ABBR[em - 1]} {ey}" if ey else ""
    else:
        end_str = ""
    return f"{start_str} \u2013 {end_str}" if end_str else start_str
```

- [ ] **Step 2: Update `build_experience()` to use `format_period()`**

On line 283, change:
```python
period = esc(role.get("period", ""))
```
to:
```python
period = esc(format_period(role.get("period", {})))
```

- [ ] **Step 3: Update `build_education()` to use `format_period()`**

On line 352, change:
```python
period = esc(edu.get("period", ""))
```
to:
```python
period = esc(format_period(edu.get("period", {})))
```

- [ ] **Step 4: Verify**

```bash
python build_cv.py cv.json --output /tmp/test.pdf
```

After running `server.py` first (to migrate cv.json), stop the server, then run the CLI. Open `/tmp/test.pdf`. Periods like "Jan 2022 – Dec 2026" should appear on a single line in experience and education sections.

- [ ] **Step 5: Commit**

```bash
git add build_cv.py
git commit -m "feat: add format_period() helper and use structured period dicts in PDF"
```

---

## Task 5: PDF — Title/subtitle + Hyperlinked Contact Links (build_cv.py)

**Files:**
- Modify: `build_cv.py`

- [ ] **Step 1: Add a `title` style to `make_styles()` (after the `name` style, around line 134)**

```python
s["title"] = ParagraphStyle(
    "title",
    fontName="NotoSans",
    fontSize=11,
    leading=15,
    textColor=COLOR_DARK,
)
```

- [ ] **Step 2: Update `build_pdf()` to render the title after the name (after line 416)**

Change the name/contact block from:
```python
story.append(Paragraph(esc(data["contact"]["name"]), styles["name"]))
story.append(Spacer(1, 2 * mm))
story.extend(build_contact(data["contact"], styles))
```
to:
```python
story.append(Paragraph(esc(data["contact"]["name"]), styles["name"]))
title = data["contact"].get("title", "").strip()
if title:
    story.append(Paragraph(esc(title), styles["title"]))
story.append(Spacer(1, 2 * mm))
story.extend(build_contact(data["contact"], styles))
```

- [ ] **Step 3: Update `build_contact()` to add hyperlinks**

Replace the entire `build_contact()` function (lines 234–257):

```python
def _normalise_url(url: str) -> str:
    """Prepend https:// if no scheme is present."""
    if url and not url.startswith(("http://", "https://")):
        return "https://" + url
    return url


def build_contact(contact: dict, styles: dict) -> list:
    """Contact info rows with hyperlinks for email, website, linkedin, github."""
    items = []
    sep = f"{NBSP * 2}\xb7{NBSP * 2}"

    def linked(text: str, href: str) -> str:
        return f'<link href="{href}">{esc(text)}</link>'

    row1 = []
    if contact.get("email"):
        row1.append(linked(contact["email"], f'mailto:{contact["email"]}'))
    if contact.get("phone"):
        row1.append(esc(contact["phone"]))
    if contact.get("website"):
        row1.append(linked(contact["website"], _normalise_url(contact["website"])))
    if row1:
        items.append(Paragraph(sep.join(row1), styles["contact"]))

    row2 = []
    if contact.get("linkedin"):
        row2.append(linked(contact["linkedin"], _normalise_url(contact["linkedin"])))
    if contact.get("github"):
        row2.append(linked(contact["github"], _normalise_url(contact["github"])))
    if row2:
        items.append(Paragraph(sep.join(row2), styles["contact"]))

    return items
```

- [ ] **Step 4: Verify**

```bash
python build_cv.py cv.json --output /tmp/test.pdf
```

Open in a PDF viewer that supports hyperlinks (e.g. Evince, Adobe Reader, browser). Click the LinkedIn or website link — it should open in a browser. Confirm the title "Full Stack Engineer" appears below the name.

- [ ] **Step 5: Commit**

```bash
git add build_cv.py
git commit -m "feat: add professional title rendering and hyperlinked contact links in PDF"
```

---

## Task 6: PDF — Achievements + Builder Normalisation + Section Order Loop (build_cv.py)

**Files:**
- Modify: `build_cv.py`

- [ ] **Step 1: Normalise `build_skills()` signature to accept `content_width`**

Change line 260:
```python
def build_skills(skills: list, styles: dict) -> list:
```
to:
```python
def build_skills(skills: list, styles: dict, content_width: float = 0) -> list:
```

- [ ] **Step 2: Normalise `build_projects()` signature**

Change line 326:
```python
def build_projects(projects: list, styles: dict) -> list:
```
to:
```python
def build_projects(projects: list, styles: dict, content_width: float = 0) -> list:
```

- [ ] **Step 3: Normalise `build_interests()` signature**

Change line 393:
```python
def build_interests(interests: list, styles: dict) -> list:
```
to:
```python
def build_interests(interests: list, styles: dict, content_width: float = 0) -> list:
```

- [ ] **Step 4: Add `build_achievements()` after `build_skills()` (around line 273)**

```python
def build_achievements(achievements: list, styles: dict, content_width: float = 0) -> list:
    """Build the achievements section — plain bullet list, no dates or labels."""
    if not achievements:
        return []
    items = section_header("Achievements", styles)
    for achievement in achievements:
        text = achievement.strip() if isinstance(achievement, str) else str(achievement)
        if text:
            items.append(Paragraph(f"\xb7{NBSP * 2}{esc(text)}", styles["bullet"]))
    return items
```

- [ ] **Step 5: Replace the section-building block in `build_pdf()` with a dynamic dispatch loop**

Find these lines in `build_pdf()` (approximately lines 427–441):
```python
# Skills
story.extend(build_skills(data.get("skills", []), styles))

# Experience
story.extend(build_experience(data.get("experience", []), styles, content_width))

# Projects
story.extend(build_projects(data.get("projects", []), styles))

# Education
story.extend(build_education(data.get("education", []), styles, content_width))

# Interests
interests = data.get("interests", [])
if interests:
    story.extend(build_interests(interests, styles))
```

Replace with:

```python
SECTION_BUILDERS = {
    "skills":       lambda d, s, w: build_skills(d.get("skills", []), s, w),
    "achievements": lambda d, s, w: build_achievements(d.get("achievements", []), s, w),
    "experience":   lambda d, s, w: build_experience(d.get("experience", []), s, w),
    "projects":     lambda d, s, w: build_projects(d.get("projects", []), s, w),
    "education":    lambda d, s, w: build_education(d.get("education", []), s, w),
    "interests":    lambda d, s, w: build_interests(d.get("interests", []), s, w) if d.get("interests") else [],
}
DEFAULT_SECTION_ORDER = ["skills", "achievements", "experience", "projects", "education", "interests"]

section_order = data.get("sectionOrder") or DEFAULT_SECTION_ORDER
# Append any canonical keys missing from stored order
for key in DEFAULT_SECTION_ORDER:
    if key not in section_order:
        section_order.append(key)

for key in section_order:
    builder = SECTION_BUILDERS.get(key)
    if builder:
        story.extend(builder(data, styles, content_width))
```

- [ ] **Step 6: Verify**

```bash
python build_cv.py cv.json --output /tmp/test.pdf
```

Open `/tmp/test.pdf`. All sections should appear in the default order (Skills → Achievements [hidden if empty] → Experience → Projects → Education → Interests). No errors.

- [ ] **Step 7: Commit**

```bash
git add build_cv.py
git commit -m "feat: add achievements section, normalise builder signatures, dynamic section order in PDF"
```

---

## Task 7: React — TypeScript Interfaces (web/src/App.tsx)

**Files:**
- Modify: `web/src/App.tsx:1-51`

- [ ] **Step 1: Add `PeriodDate` and `Period` types and update `Contact`, `Role`, `Education`, `CvData`**

Replace lines 1–51 with:

```typescript
import { useState, useEffect, useCallback, useRef } from "react";

type PeriodDate = { year: number; month: number };
type Period = { start: PeriodDate; end: PeriodDate | "present" };

interface Contact {
  name: string;
  title?: string;
  email: string;
  phone: string;
  website: string;
  linkedin: string;
  github: string;
}

interface Role {
  title: string;
  period: Period;
  description: string;
}

interface Experience {
  company: string;
  roles: Role[];
  pageBreakAfter?: boolean;
}

interface Project {
  name: string;
  description: string;
  pageBreakAfter?: boolean;
}

interface Education {
  institution: string;
  degree?: string;
  period: Period;
  focus: string[];
  pageBreakAfter?: boolean;
}

interface Skill {
  label: string;
  items: string;
}

interface CvData {
  contact: Contact;
  summary: string;
  skills: Skill[];
  achievements?: string[];
  experience: Experience[];
  projects: Project[];
  education: Education[];
  interests: string[];
  sectionOrder?: string[];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npm run build 2>&1 | head -40
```

Expected: TypeScript errors about `period` fields being wrong type (because the form still passes string values). These will be fixed in Task 8–9. For now it's OK if there are type errors — just make sure there are no *syntax* errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/App.tsx
git commit -m "feat: update TypeScript interfaces for Period, Contact.title, achievements, sectionOrder"
```

---

## Task 8: React — Data normalisation on load + Contact title field (web/src/App.tsx)

**Files:**
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Add `CANONICAL_SECTIONS` constant and a `normaliseCvData()` helper near the top of App.tsx (after the interface definitions, before `function App()`)**

Add after the last interface and before the icon components:

```typescript
const CANONICAL_SECTIONS = ["skills", "achievements", "experience", "projects", "education", "interests"] as const;
const DEFAULT_PERIOD: Period = { start: { year: new Date().getFullYear(), month: 1 }, end: "present" };

function normaliseCvData(raw: Record<string, unknown>): CvData {
  const d = raw as CvData;
  if (!Array.isArray(d.interests)) d.interests = [];
  if (!Array.isArray(d.achievements)) d.achievements = [];
  // Ensure sectionOrder contains all canonical keys
  const stored = Array.isArray(d.sectionOrder) ? d.sectionOrder : [...CANONICAL_SECTIONS];
  for (const key of CANONICAL_SECTIONS) {
    if (!stored.includes(key)) stored.push(key);
  }
  d.sectionOrder = stored;
  // Ensure periods are structured (fallback for any remaining string periods)
  for (const exp of d.experience ?? []) {
    for (const role of exp.roles ?? []) {
      if (typeof role.period === "string" || !role.period) {
        role.period = DEFAULT_PERIOD;
      }
    }
  }
  for (const edu of d.education ?? []) {
    if (typeof edu.period === "string" || !edu.period) {
      edu.period = DEFAULT_PERIOD;
    }
  }
  return d;
}
```

- [ ] **Step 2: Update data load to use `normaliseCvData()` everywhere data is set from the API**

Find the `useEffect` at line ~251 that loads initial data. Replace:
```typescript
if (!Array.isArray(cvData.interests)) cvData.interests = [];
setData(cvData);
```
with:
```typescript
setData(normaliseCvData(cvData));
```

Find `restoreVersion()` (line ~364). Replace:
```typescript
if (!Array.isArray(version.data.interests)) version.data.interests = [];
setData(version.data);
```
with:
```typescript
setData(normaliseCvData(version.data));
```

Find `importJson()` (line ~392). Replace:
```typescript
if (!Array.isArray(parsed.interests)) parsed.interests = [];
setData(parsed);
```
with:
```typescript
setData(normaliseCvData(parsed));
```

- [ ] **Step 3: Add `title` field to the Contact section in the form**

Find the Contact section form (around line 562–587). The current code iterates over `["name", "email", "phone", "website", "linkedin", "github"]`. Replace this block with:

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
  {(["name", "email", "phone", "website", "linkedin", "github"] as const).map((f) => (
    <label key={f} className="flex flex-col gap-1">
      <span className={labelClasses}>{f}</span>
      <input
        className={inputClasses}
        value={data.contact[f] ?? ""}
        onChange={(e) =>
          update((d) => {
            d.contact[f] = e.target.value;
          })
        }
      />
    </label>
  ))}
  <label className="flex flex-col gap-1 sm:col-span-2">
    <span className={labelClasses}>title / role</span>
    <input
      className={inputClasses}
      placeholder="e.g. Full Stack Engineer"
      value={data.contact.title ?? ""}
      onChange={(e) =>
        update((d) => {
          d.contact.title = e.target.value;
        })
      }
    />
  </label>
</div>
```

- [ ] **Step 4: Verify TypeScript compiles without errors**

```bash
cd web && npm run build 2>&1 | grep -E "error TS" | head -20
```

Fix any remaining type errors before proceeding.

- [ ] **Step 5: Commit**

```bash
git add web/src/App.tsx
git commit -m "feat: add normaliseCvData(), contact title field, and data normalisation on all load paths"
```

---

## Task 9: React — PeriodPicker component + use in Experience/Education (web/src/App.tsx)

**Files:**
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Add constants and `PeriodPicker` component**

Add after `DEFAULT_PERIOD` constant (after normaliseCvData, before the icon components):

```typescript
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const YEARS = Array.from({ length: 46 }, (_, i) => 1990 + i); // 1990-2035

function PeriodPicker({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  const isPresent = period.end === "present";
  const endDate = isPresent ? null : (period.end as PeriodDate);

  const selectClass = `${inputClasses} py-1.5 pr-1 text-sm`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500 w-8 shrink-0">From</span>
        <select
          className={selectClass}
          value={period.start.month}
          onChange={(e) =>
            onChange({ ...period, start: { ...period.start, month: +e.target.value } })
          }
        >
          {MONTH_NAMES.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          className={selectClass}
          value={period.start.year}
          onChange={(e) =>
            onChange({ ...period, start: { ...period.start, year: +e.target.value } })
          }
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500 w-8 shrink-0">To</span>
        <select
          className={selectClass}
          value={endDate?.month ?? 12}
          disabled={isPresent}
          onChange={(e) =>
            onChange({ ...period, end: { year: endDate?.year ?? new Date().getFullYear(), month: +e.target.value } })
          }
        >
          {MONTH_NAMES.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          className={selectClass}
          value={endDate?.year ?? new Date().getFullYear()}
          disabled={isPresent}
          onChange={(e) =>
            onChange({ ...period, end: { year: +e.target.value, month: endDate?.month ?? 12 } })
          }
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs text-gray-600 ml-1 cursor-pointer select-none">
          <input
            type="checkbox"
            className="accent-[#1b2a4a]"
            checked={isPresent}
            onChange={(e) => {
              if (e.target.checked) {
                onChange({ ...period, end: "present" });
              } else {
                const now = new Date();
                onChange({ ...period, end: { year: now.getFullYear(), month: now.getMonth() + 1 } });
              }
            }}
          />
          Present
        </label>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace the period text input in the Experience section with `PeriodPicker`**

Find the period `<label>` in the Experience roles section (around lines 728–740):
```tsx
<label className="flex-1 flex flex-col gap-1">
  <span className={labelClasses}>Period</span>
  <input
    className={inputClasses}
    value={role.period}
    onChange={(e) =>
      update((d) => {
        d.experience[ei].roles[ri].period = e.target.value;
      })
    }
  />
</label>
```
Replace with:
```tsx
<div className="flex flex-col gap-1">
  <span className={labelClasses}>Period</span>
  <PeriodPicker
    period={role.period}
    onChange={(p) =>
      update((d) => {
        d.experience[ei].roles[ri].period = p;
      })
    }
  />
</div>
```

Also update the "Add Role" default object (around line 774) from `{ title: "", period: "", description: "" }` to `{ title: "", period: DEFAULT_PERIOD, description: "" }`.

Also update the "Add Company" default object (around line 806–808) from `roles: [{ title: "", period: "", description: "" }]` to `roles: [{ title: "", period: DEFAULT_PERIOD, description: "" }]`.

- [ ] **Step 3: Replace the period text input in the Education section with `PeriodPicker`**

Find the period `<label>` in the Education section (around lines 916–927):
```tsx
<label className="flex-1 flex flex-col gap-1">
  <span className={labelClasses}>Period</span>
  <input
    className={inputClasses}
    value={edu.period}
    onChange={(e) =>
      update((d) => {
        d.education[ei].period = e.target.value;
      })
    }
  />
</label>
```
Replace with:
```tsx
<div className="flex flex-col gap-1">
  <span className={labelClasses}>Period</span>
  <PeriodPicker
    period={edu.period}
    onChange={(p) =>
      update((d) => {
        d.education[ei].period = p;
      })
    }
  />
</div>
```

Also update the "Add Education" default object (around line 993–999) from `period: ""` to `period: DEFAULT_PERIOD`.

- [ ] **Step 4: Build and verify no TypeScript errors**

```bash
cd web && npm run build 2>&1 | grep -E "error TS"
```

Expected: no errors.

- [ ] **Step 5: Start dev server and verify period pickers render in the form**

```bash
cd web && npm run dev &
# open http://localhost:5173 in browser
# expand Experience section — Period row should show month/year dropdowns + Present toggle
```

- [ ] **Step 6: Commit**

```bash
git add web/src/App.tsx
git commit -m "feat: add PeriodPicker component and replace period text inputs in Experience/Education"
```

---

## Task 10: React — Achievements Section (web/src/App.tsx)

**Files:**
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Add the Achievements section in the form panel**

Find the Skills section closing tag (around line 674 — `</Section>` after the Skills add button). Add the Achievements section immediately after it:

```tsx
{/* Achievements */}
<Section
  title="Achievements"
  count={data.achievements?.length ?? 0}
  open={isOpen("achievements")}
  onToggle={() => toggleSection("achievements")}
>
  {(data.achievements ?? []).map((item, ai) => (
    <div key={ai} className="flex gap-2 items-center mb-3">
      <input
        className={`flex-1 ${inputClasses}`}
        placeholder="Achievement"
        value={item}
        onChange={(e) =>
          update((d) => {
            if (!d.achievements) d.achievements = [];
            d.achievements[ai] = e.target.value;
          })
        }
      />
      <button
        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors duration-150 cursor-pointer shrink-0"
        onClick={() =>
          update((d) => {
            d.achievements?.splice(ai, 1);
          })
        }
        title="Remove achievement"
      >
        <TrashIcon />
      </button>
    </div>
  ))}
  <button
    className={addBtnClasses}
    onClick={() =>
      update((d) => {
        if (!d.achievements) d.achievements = [];
        d.achievements.push("");
      })
    }
  >
    <span className="text-lg leading-none">+</span> Add Achievement
  </button>
</Section>
```

- [ ] **Step 2: Build and verify**

```bash
cd web && npm run build 2>&1 | grep -E "error TS"
```

Start dev server, expand Achievements section, add an item, generate a PDF — confirm the item appears in the PDF under an "ACHIEVEMENTS" section header.

- [ ] **Step 3: Commit**

```bash
git add web/src/App.tsx
git commit -m "feat: add Achievements section to form editor"
```

---

## Task 11: React — Drag-and-Drop Section Reordering (web/src/App.tsx)

**Files:**
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Add a `DragHandleIcon` SVG component** (add alongside the other icon components)

```tsx
function DragHandleIcon() {
  return (
    <svg
      className="w-4 h-4 text-gray-400 cursor-grab active:cursor-grabbing"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}
```

- [ ] **Step 2: Update the `Section` component to accept drag props**

Update the `Section` component definition (line ~175) to add drag-related props:

```tsx
function Section({
  title,
  count,
  open,
  onToggle,
  children,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
}) {
  return (
    <section
      className="mb-5"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 py-2 cursor-pointer group"
      >
        {draggable && (
          <span
            className="shrink-0 opacity-30 group-hover:opacity-70 transition-opacity"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <DragHandleIcon />
          </span>
        )}
        <ChevronIcon open={open} />
        <h2 className="text-base font-semibold text-gray-800 group-hover:text-[#1b2a4a] transition-colors">
          {title}
        </h2>
        {count !== undefined && !open && (
          <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {count}
          </span>
        )}
      </button>
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="pt-2">{children}</div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Add `dragSrcRef` to the `App` component state**

In the `App()` function, alongside the other refs (line ~238), add:
```typescript
const dragSrcRef = useRef<string | null>(null);
```

- [ ] **Step 4: Create a section render map and reorder the form panel to use `sectionOrder`**

Find the form panel content in `App` (starting around line 555 with `{/* Contact */}`). Replace the entire section rendering block (Contact through Interests, lines ~555–1050) with a dynamic version:

The structure is:
1. Contact and Summary sections are pinned at top (no drag handle) — keep them as-is
2. All other sections are rendered in `data.sectionOrder` order with drag handles

Replace the static section blocks (Skills through Interests) with:

```tsx
{/* Dynamic orderable sections */}
{(data.sectionOrder ?? [...CANONICAL_SECTIONS]).map((key) => {
  const dragProps = {
    draggable: true as const,
    onDragStart: () => { dragSrcRef.current = key; },
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: () => {
      const src = dragSrcRef.current;
      if (!src || src === key) return;
      update((d) => {
        const order = [...(d.sectionOrder ?? [...CANONICAL_SECTIONS])];
        const from = order.indexOf(src);
        const to = order.indexOf(key);
        if (from === -1 || to === -1) return;
        order.splice(from, 1);
        order.splice(to, 0, src);
        d.sectionOrder = order;
      });
      dragSrcRef.current = null;
    },
  };

  if (key === "skills") return (
    <Section key="skills" title="Skills" count={data.skills.length} open={isOpen("skills")} onToggle={() => toggleSection("skills")} {...dragProps}>
      {/* ... skills content unchanged ... */}
    </Section>
  );

  if (key === "achievements") return (
    <Section key="achievements" title="Achievements" count={data.achievements?.length ?? 0} open={isOpen("achievements")} onToggle={() => toggleSection("achievements")} {...dragProps}>
      {/* ... achievements content unchanged ... */}
    </Section>
  );

  if (key === "experience") return (
    <Section key="experience" title="Experience" count={data.experience.length} open={isOpen("experience")} onToggle={() => toggleSection("experience")} {...dragProps}>
      {/* ... experience content unchanged ... */}
    </Section>
  );

  if (key === "projects") return (
    <Section key="projects" title="Projects" count={data.projects.length} open={isOpen("projects")} onToggle={() => toggleSection("projects")} {...dragProps}>
      {/* ... projects content unchanged ... */}
    </Section>
  );

  if (key === "education") return (
    <Section key="education" title="Education" count={data.education.length} open={isOpen("education")} onToggle={() => toggleSection("education")} {...dragProps}>
      {/* ... education content unchanged ... */}
    </Section>
  );

  if (key === "interests") return (
    <Section key="interests" title="Interests" count={data.interests.length} open={isOpen("interests")} onToggle={() => toggleSection("interests")} {...dragProps}>
      {/* ... interests content unchanged ... */}
    </Section>
  );

  return null;
})}
```

**Important:** The `{/* ... content unchanged ... */}` placeholders above must be filled with the exact JSX from the current static section blocks. Do NOT remove that content — move it inside the corresponding `if` branch.

- [ ] **Step 5: Build and verify**

```bash
cd web && npm run build 2>&1 | grep -E "error TS"
```

- [ ] **Step 6: Test drag-and-drop in dev server**

Start `python server.py` and `cd web && npm run dev`. Open the form. Try dragging the Skills section below Experience using the ⠿ handle. Generate a PDF — Skills should appear after Experience in the output.

- [ ] **Step 7: Commit**

```bash
git add web/src/App.tsx
git commit -m "feat: drag-and-drop section reordering with pinned Contact/Summary"
```

---

## Task 12: Final Verification

- [ ] **Step 1: Full build check**

```bash
cd web && npm run build
```

Expected: 0 TypeScript errors, successful Vite build outputting to `web/dist/`.

- [ ] **Step 2: Start the full stack and run through all features**

```bash
python server.py &
# Open http://localhost:5000 in browser
```

Checklist:
- [ ] Contact section shows a "title / role" field
- [ ] Filling in title shows it below the name in generated PDF
- [ ] Period fields in Experience and Education show month/year dropdowns + Present toggle
- [ ] Setting a period to "Present" and generating PDF shows "Jan 2022 – Present" on one line
- [ ] PDF: long bullet points wrap with hanging indent (text aligns under first character, not bullet)
- [ ] PDF: LinkedIn, GitHub, website links are clickable hyperlinks
- [ ] Achievements section is present between Skills and Experience
- [ ] Adding an achievement and generating PDF shows it under "ACHIEVEMENTS" header
- [ ] Dragging sections reorders them in the form; generated PDF reflects the new order
- [ ] Export JSON includes `sectionOrder`, `achievements`, `contact.title`, and structured `period` objects
- [ ] Import JSON with those fields restores the UI correctly

- [ ] **Step 3: Stop the server**

```bash
kill %1
```

- [ ] **Step 4: Final commit if any loose files**

```bash
git status
git add -p  # review and stage any remaining changes
git commit -m "feat: complete cv editor feature set"
```

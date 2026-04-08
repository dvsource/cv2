# Changelog

## [v0.1.1] - 2026-04-07

### Added
- **Professional title** — display a role/title line below the name in both the PDF and the form
- **Hyperlinked contact links** — email, website, LinkedIn, and GitHub are clickable in the generated PDF
- **Structured date fields** — period inputs replaced with month + year dropdowns and a "Present" toggle; stored as `{ start: { year, month }, end: { year, month } | "present" }` in JSON
- **Achievements section** — optional bullet list rendered between Skills and Experience; hidden when empty
- **Drag-and-drop section reordering** — reorder Skills, Achievements, Experience, Projects, Education, and Interests via drag handles; Summary is always pinned at the top
- **Version history** — every save and PDF generation stored in SQLite; restore any previous version from the dropdown
- **Legacy period migration** — `GET /api/cv` automatically converts old plain-string periods to the structured format and persists the result

### Fixed
- **Hanging indent on bullet points** — wrapped lines now align under the first character of the bullet text instead of the bullet symbol
- **Empty page between split pages** — date column was too narrow (22 mm) for formatted period strings (~38 mm); widened to 40 mm, eliminating the spurious page break
- **Education date line-breaking** — same root cause as above; both `build_experience` and `build_education` now use `40 * mm` for the date column

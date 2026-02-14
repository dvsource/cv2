#!/usr/bin/env python3
"""Build an ATS-ready CV PDF from a JSON data file.

Usage:
    python build_cv.py cv.json
    python build_cv.py cv.json --output my_cv.pdf
"""

import json
import sys
from datetime import datetime
from pathlib import Path
from xml.sax.saxutils import escape as _xml_escape

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    HRFlowable,
    Table,
    TableStyle,
    PageBreak,
)

# ── Font Registration ─────────────────────────────────────────

FONT_DIR = "/usr/share/fonts/noto"

pdfmetrics.registerFont(TTFont("NotoSans", f"{FONT_DIR}/NotoSans-Regular.ttf"))
pdfmetrics.registerFont(TTFont("NotoSans-Bold", f"{FONT_DIR}/NotoSans-Bold.ttf"))
pdfmetrics.registerFont(TTFont("NotoSans-Italic", f"{FONT_DIR}/NotoSans-Italic.ttf"))
pdfmetrics.registerFont(
    TTFont("NotoSans-BoldItalic", f"{FONT_DIR}/NotoSans-BoldItalic.ttf")
)

pdfmetrics.registerFontFamily(
    "NotoSans",
    normal="NotoSans",
    bold="NotoSans-Bold",
    italic="NotoSans-Italic",
    boldItalic="NotoSans-BoldItalic",
)

# ── Design Tokens ──────────────────────────────────────────────

COLOR_DARK = HexColor("#1B2A4A")
COLOR_TEXT = HexColor("#2D2D2D")
COLOR_LINE = HexColor("#CCCCCC")
COLOR_CONTACT = HexColor("#555555")

MARGIN_LR = 22 * mm
MARGIN_TOP = 18 * mm
MARGIN_BOTTOM = 18 * mm

NBSP = "\xa0"


# ── Helpers ────────────────────────────────────────────────────


def esc(text: str) -> str:
    """XML-escape user text for reportlab Paragraph markup."""
    return _xml_escape(str(text))


def spaced_caps(text: str) -> str:
    """'Professional Summary' -> 'P R O F E S S I O N A L   S U M M A R Y'."""
    words = text.upper().split()
    spaced_words = [(NBSP + " ").join(list(w)) for w in words]
    return (NBSP * 4).join(spaced_words)


def section_header(title: str, styles: dict) -> list:
    """Section title with letter-spaced caps + thin horizontal line."""
    return [
        Spacer(1, 5.5 * mm),
        Paragraph(spaced_caps(title), styles["section"]),
        HRFlowable(
            width="100%",
            thickness=0.5,
            color=COLOR_LINE,
            spaceBefore=1.5 * mm,
            spaceAfter=3 * mm,
        ),
    ]


# ── Styles ─────────────────────────────────────────────────────


def make_styles() -> dict:
    """Create paragraph styles matching the CV design."""
    s = {}

    s["name"] = ParagraphStyle(
        "name",
        fontName="NotoSans-Bold",
        fontSize=26,
        leading=30,
        textColor=COLOR_DARK,
    )

    s["contact"] = ParagraphStyle(
        "contact",
        fontName="NotoSans",
        fontSize=9,
        leading=14,
        textColor=COLOR_CONTACT,
        leftIndent=0,
    )

    s["section"] = ParagraphStyle(
        "section",
        fontName="NotoSans-Bold",
        fontSize=9.5,
        leading=13,
        textColor=COLOR_DARK,
    )

    s["summary"] = ParagraphStyle(
        "summary",
        fontName="NotoSans",
        fontSize=9.5,
        leading=13.5,
        textColor=COLOR_TEXT,
        alignment=TA_JUSTIFY,
    )

    s["body"] = ParagraphStyle(
        "body",
        fontName="NotoSans",
        fontSize=9.5,
        leading=13.5,
        textColor=COLOR_TEXT,
    )

    s["exp_title"] = ParagraphStyle(
        "exp_title",
        fontName="NotoSans-Bold",
        fontSize=10.5,
        leading=14,
        textColor=COLOR_TEXT,
    )

    s["exp_date"] = ParagraphStyle(
        "exp_date",
        fontName="NotoSans",
        fontSize=9.5,
        leading=14,
        textColor=COLOR_TEXT,
        alignment=TA_RIGHT,
    )

    s["bullet"] = ParagraphStyle(
        "bullet",
        fontName="NotoSans",
        fontSize=9.5,
        leading=13.5,
        textColor=COLOR_TEXT,
    )

    s["proj_name"] = ParagraphStyle(
        "proj_name",
        fontName="NotoSans-Bold",
        fontSize=10,
        leading=14,
        textColor=COLOR_TEXT,
    )

    s["proj_desc"] = ParagraphStyle(
        "proj_desc",
        fontName="NotoSans",
        fontSize=9.5,
        leading=13,
        textColor=COLOR_TEXT,
    )

    s["edu_main"] = ParagraphStyle(
        "edu_main",
        fontName="NotoSans",
        fontSize=10,
        leading=14,
        textColor=COLOR_TEXT,
    )

    s["edu_date"] = ParagraphStyle(
        "edu_date",
        fontName="NotoSans",
        fontSize=10,
        leading=14,
        textColor=COLOR_TEXT,
        alignment=TA_RIGHT,
    )

    return s


# ── Section Builders ───────────────────────────────────────────


def build_contact(contact: dict, styles: dict) -> list:
    """Contact info rows with Unicode icon prefixes and middle-dot separators."""
    items = []
    sep = f"{NBSP * 2}\xb7{NBSP * 2}"

    row1 = []
    if contact.get("email"):
        row1.append(esc(contact["email"]))
    if contact.get("phone"):
        row1.append(esc(contact["phone"]))
    if contact.get("website"):
        row1.append(esc(contact["website"]))
    if row1:
        items.append(Paragraph(sep.join(row1), styles["contact"]))

    row2 = []
    if contact.get("linkedin"):
        row2.append(esc(contact["linkedin"]))
    if contact.get("github"):
        row2.append(esc(contact["github"]))
    if row2:
        items.append(Paragraph(sep.join(row2), styles["contact"]))

    return items


def build_skills(skills: list, styles: dict) -> list:
    """Build the skills section."""
    items = section_header("Skills", styles)

    for skill in skills:
        label = esc(skill.get("label", ""))
        vals = skill.get("items", [])
        if label and vals:
            escaped_vals = ", ".join(esc(v) for v in vals)
            items.append(Paragraph(f"<b>{label}:</b> {escaped_vals}", styles["body"]))

    return items


def build_experience(experience: list, styles: dict, content_width: float) -> list:
    """Build the experience section."""
    items = section_header("Experience", styles)

    for exp in experience:
        company = esc(exp["company"])
        for role in exp.get("roles", []):
            title = esc(role["title"])
            period = esc(role.get("period", ""))

            title_p = Paragraph(f"<b>{company} \u2014 {title}</b>", styles["exp_title"])
            date_p = Paragraph(period, styles["exp_date"])

            t = Table(
                [[title_p, date_p]],
                colWidths=[content_width * 0.80, content_width * 0.20],
                hAlign="LEFT",
            )
            t.setStyle(
                TableStyle(
                    [
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 0),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                        ("TOPPADDING", (0, 0), (0, 0), 0),
                        ("TOPPADDING", (1, 0), (1, 0), 1),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                    ]
                )
            )
            items.append(t)

            desc = role.get("description", "")
            if desc:
                sentences = [s.strip() for s in desc.split(". ") if s.strip()]
                for sent in sentences:
                    if not sent.endswith("."):
                        sent += "."
                    items.append(
                        Paragraph(f"\xb7{NBSP * 2}{esc(sent)}", styles["bullet"])
                    )

            items.append(Spacer(1, 2.5 * mm))

        if exp.get("pageBreakAfter"):
            items.append(PageBreak())

    return items


def build_projects(projects: list, styles: dict) -> list:
    """Build the projects section."""
    items = section_header("Projects", styles)

    for proj in projects:
        items.append(Paragraph(f"<b>{esc(proj['name'])}</b>", styles["proj_name"]))
        if proj.get("description"):
            items.append(Paragraph(esc(proj["description"]), styles["proj_desc"]))
        items.append(Spacer(1, 2 * mm))
        if proj.get("pageBreakAfter"):
            items.append(PageBreak())

    return items


def build_education(education: list, styles: dict, content_width: float) -> list:
    """Build the education section."""
    items = section_header("Education", styles)

    for edu in education:
        degree = esc(edu.get("degree", ""))
        institution = esc(edu["institution"])
        period = esc(edu.get("period", ""))
        focus = edu.get("focus", [])

        if degree:
            main_text = f"<b>{degree}</b>"
        else:
            main_text = f"<b>{institution}</b>"

        main_p = Paragraph(main_text, styles["edu_main"])
        date_p = Paragraph(period, styles["edu_date"])

        t = Table(
            [[main_p, date_p]],
            colWidths=[content_width * 0.80, content_width * 0.20],
            hAlign="LEFT",
        )
        t.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ]
            )
        )
        items.append(t)

        if degree:
            items.append(Paragraph(institution, styles["body"]))

        if focus:
            items.append(Paragraph(", ".join(esc(f) for f in focus), styles["body"]))
        items.append(Spacer(1, 2 * mm))
        if edu.get("pageBreakAfter"):
            items.append(PageBreak())

    return items


# ── Main ───────────────────────────────────────────────────────


def build_pdf(data: dict, output_path: str):
    """Generate the CV PDF from structured data."""
    styles = make_styles()
    content_width = A4[0] - 2 * MARGIN_LR
    story = []

    # Name
    story.append(Paragraph(esc(data["contact"]["name"]), styles["name"]))
    story.append(Spacer(1, 2 * mm))

    # Contact info
    story.extend(build_contact(data["contact"], styles))

    # Professional Summary
    story.extend(section_header("Professional Summary", styles))
    story.append(Paragraph(esc(data.get("summary", "")), styles["summary"]))

    # Skills
    story.extend(build_skills(data.get("skills", []), styles))

    # Experience
    story.extend(build_experience(data.get("experience", []), styles, content_width))

    # Projects
    story.extend(build_projects(data.get("projects", []), styles))

    # Education
    story.extend(build_education(data.get("education", []), styles, content_width))

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=MARGIN_LR,
        rightMargin=MARGIN_LR,
        topMargin=MARGIN_TOP,
        bottomMargin=MARGIN_BOTTOM,
        title=f"CV - {data['contact']['name']}",
        author=data["contact"]["name"],
    )
    doc.build(story)


def main():
    if len(sys.argv) < 2:
        print("Usage: python build_cv.py <cv.json> [--output filename.pdf]")
        sys.exit(1)

    json_path = Path(sys.argv[1])
    if not json_path.exists():
        print(f"Error: {json_path} not found")
        sys.exit(1)

    output_path = None
    if "--output" in sys.argv:
        idx = sys.argv.index("--output")
        if idx + 1 < len(sys.argv):
            output_path = sys.argv[idx + 1]

    if not output_path:
        timestamp = datetime.now().strftime("%Y_%m_%d_%H_%M")
        output_path = str(json_path.parent / f"{timestamp}_cv.pdf")

    with open(json_path) as f:
        data = json.load(f)

    build_pdf(data, output_path)
    print(f"CV saved to: {output_path}")


if __name__ == "__main__":
    main()

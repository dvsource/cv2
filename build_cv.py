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
    BaseDocTemplate,
    PageTemplate,
    Frame,
    Flowable,
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

pdfmetrics.registerFont(TTFont("NotoMono", f"{FONT_DIR}/NotoSansMono-Bold.ttf"))

# ── Design Tokens ──────────────────────────────────────────────

COLOR_DARK = HexColor("#1B2A4A")
COLOR_TEXT = HexColor("#2D2D2D")
COLOR_MUTED = HexColor("#4A4A4A")
COLOR_LINE = HexColor("#CCCCCC")
COLOR_CONTACT = HexColor("#555555")

DEFAULT_PDF_OPTS: dict = {
    "marginLR": 22,
    "marginTop": 18,
    "marginBottom": 18,
    "sectionSpacing": 5.5,
    "fontSizeName": 26,
    "fontSizeBody": 9.5,
    "fontSizeSection": 9.5,
    "fontSizeTitle": 10.5,
    "fontSizeContactTitle": 11,
    "mergeSummarySkills": False,
    "mergeSummarySkillsSpacing": 3,
    "hiddenSections": [],
    "hiddenTitles": [],
    "pageBreaks": {},
}


def _get_opts(data: dict) -> dict:
    """Merge user pdfOptions over defaults. Returns a complete opts dict."""
    opts = dict(DEFAULT_PDF_OPTS)
    user = data.get("pdfOptions") or {}
    for k, v in user.items():
        if k in opts and v is not None:
            opts[k] = v
    return opts


NBSP = "\xa0"


# ── Helpers ────────────────────────────────────────────────────


def esc(text: str) -> str:
    """XML-escape user text for reportlab Paragraph markup."""
    return _xml_escape(str(text))


MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]


def format_period(period, opts: dict = None) -> str:
    """Format a period dict as 'Mar 2022 – Dec 2023' or 'Mar 2022 – Present'.
    Falls back to str(period) for legacy string values.
    A month value of 0 means 'no month' — only the year is shown."""
    if isinstance(period, str):
        return period
    if not isinstance(period, dict):
        return ""
    start = period.get("start", {})
    end = period.get("end", {})
    sm = int(start.get("month", 1))
    sy = start.get("year", "")
    start_str = (f"{MONTH_ABBR[max(1, sm) - 1]} {sy}" if sm > 0 else str(sy)) if sy else ""
    if end == "present":
        end_str = "Present"
    elif isinstance(end, dict):
        em = int(end.get("month", 12))
        ey = end.get("year", "")
        end_str = (f"{MONTH_ABBR[max(1, em) - 1]} {ey}" if em > 0 else str(ey)) if ey else ""
    else:
        end_str = ""
    return f"{start_str} \u2013 {end_str}" if end_str else start_str


class SpacedText(Flowable):
    """Draw uppercase text with true letter-spacing via canvas charSpace."""

    def __init__(self, text, font_name, font_size, text_color, char_space=3.5):
        Flowable.__init__(self)
        self.text = text.upper()
        self.font_name = font_name
        self.font_size = font_size
        self.text_color = text_color
        self.char_space = char_space

    def wrap(self, aW, aH):
        self.width = aW
        self.height = self.font_size + 2
        return (self.width, self.height)

    def draw(self):
        c = self.canv
        c.saveState()
        c.setFont(self.font_name, self.font_size)
        c.setFillColor(self.text_color)
        c._code.append(f"{self.char_space} Tc")
        c.drawString(0, 0, self.text)
        c.restoreState()


def section_header(title: str, key: str, styles: dict, opts: dict) -> list:
    """Section title with letter-spaced caps + thin horizontal rule.
    Returns [] if key is in opts['hiddenTitles'] (suppresses title + spacing).
    """
    if key in opts.get("hiddenTitles", []):
        return []
    s = styles["section"]
    spacing = opts.get("sectionSpacing", DEFAULT_PDF_OPTS["sectionSpacing"])
    return [
        Spacer(1, spacing * mm),
        SpacedText(title, s.fontName, s.fontSize, s.textColor),
        HRFlowable(
            width="100%",
            thickness=0.5,
            color=COLOR_LINE,
            spaceBefore=1.5 * mm,
            spaceAfter=1 * mm,
        ),
    ]


# ── Styles ─────────────────────────────────────────────────────


def make_styles(opts: dict) -> dict:
    """Create paragraph styles using opts for font sizes."""
    s = {}
    fn = opts["fontSizeName"]
    fb = opts["fontSizeBody"]
    fs = opts["fontSizeSection"]
    ft = opts["fontSizeTitle"]

    s["name"] = ParagraphStyle(
        "name", fontName="NotoMono", fontSize=fn, leading=fn + 4, textColor=COLOR_DARK,
    )
    fct = opts["fontSizeContactTitle"]
    s["title"] = ParagraphStyle(
        "title", fontName="NotoSans", fontSize=fct, leading=fct + 4, textColor=COLOR_DARK,
    )
    s["contact"] = ParagraphStyle(
        "contact", fontName="NotoSans", fontSize=9, leading=14,
        textColor=COLOR_CONTACT, leftIndent=0,
    )
    s["section"] = ParagraphStyle(
        "section", fontName="NotoMono", fontSize=fs, leading=fs + 3.5, textColor=COLOR_DARK,
    )
    s["summary"] = ParagraphStyle(
        "summary", fontName="NotoSans", fontSize=fb, leading=fb + 4,
        textColor=COLOR_TEXT, alignment=TA_JUSTIFY,
    )
    s["body"] = ParagraphStyle(
        "body", fontName="NotoSans", fontSize=fb, leading=fb + 4, textColor=COLOR_MUTED,
    )
    s["exp_title"] = ParagraphStyle(
        "exp_title", fontName="NotoSans-Bold", fontSize=ft, leading=ft + 3.5, textColor=COLOR_TEXT,
    )
    s["exp_date"] = ParagraphStyle(
        "exp_date", fontName="NotoSans-Bold", fontSize=fb, leading=fb + 4.5,
        textColor=COLOR_MUTED, alignment=TA_RIGHT,
    )
    s["bullet"] = ParagraphStyle(
        "bullet", fontName="NotoSans", fontSize=fb, leading=fb + 4,
        textColor=COLOR_MUTED, leftIndent=12, firstLineIndent=-8,
    )
    s["proj_name"] = ParagraphStyle(
        "proj_name", fontName="NotoSans-Bold", fontSize=ft, leading=ft + 4, textColor=COLOR_TEXT,
    )
    s["proj_desc"] = ParagraphStyle(
        "proj_desc", fontName="NotoSans", fontSize=fb, leading=fb + 3.5,
        textColor=COLOR_MUTED, leftIndent=12, firstLineIndent=-8,
    )
    s["edu_main"] = ParagraphStyle(
        "edu_main", fontName="NotoSans", fontSize=ft, leading=ft + 4, textColor=COLOR_TEXT,
    )
    s["edu_date"] = ParagraphStyle(
        "edu_date", fontName="NotoSans-Bold", fontSize=ft, leading=ft + 4,
        textColor=COLOR_MUTED, alignment=TA_RIGHT,
    )
    return s


# ── Section Builders ───────────────────────────────────────────


def _normalise_url(url: str) -> str:
    """Prepend https:// if no scheme is present."""
    if url and not url.startswith(("http://", "https://")):
        return "https://" + url
    return url


def build_contact(contact: dict, styles: dict, content_width: float = 0) -> list:
    """Contact info rows with hyperlinks for email, website, linkedin, github."""
    items = []
    sep = f"{NBSP * 2}\xb7{NBSP * 2}"

    def linked(text: str, href: str) -> str:
        return f'<link href="{_xml_escape(href)}">{esc(text)}</link>'

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


def build_skills(skills: list, styles: dict, content_width: float = 0, opts: dict = None) -> list:
    """Build the skills section."""
    if opts is None:
        opts = DEFAULT_PDF_OPTS
    items = section_header("Skills", "skills", styles, opts)

    for skill in skills:
        label = esc(skill.get("label", ""))
        vals = skill.get("items", "")
        if isinstance(vals, list):
            vals = ", ".join(vals)
        if label and vals:
            items.append(Paragraph(f"<b>{label}:</b> {esc(vals)}", styles["body"]))
        if skill.get("pageBreakAfter"):
            items.append(PageBreak())

    return items


def build_achievements(achievements: list, styles: dict, content_width: float = 0, opts: dict = None) -> list:
    """Build the achievements section — plain bullet list, no dates or labels."""
    if opts is None:
        opts = DEFAULT_PDF_OPTS
    if not achievements:
        return []
    items = section_header("Achievements", "achievements", styles, opts)
    breaks = set(opts.get("pageBreaks", {}).get("achievements", []))
    for i, achievement in enumerate(achievements):
        text = achievement.strip() if isinstance(achievement, str) else str(achievement)
        if text:
            items.append(Paragraph(f"\xb7{NBSP * 2}{esc(text)}", styles["bullet"]))
        if i in breaks:
            items.append(PageBreak())
    return items


def build_experience(experience: list, styles: dict, content_width: float, opts: dict = None) -> list:
    """Build the experience section."""
    if opts is None:
        opts = DEFAULT_PDF_OPTS
    items = section_header("Experience", "experience", styles, opts)

    for exp in experience:
        company = esc(exp["company"])
        for role in exp.get("roles", []):
            title = esc(role["title"])
            period = esc(format_period(role.get("period", {}), opts))

            title_p = Paragraph(f"<b>{company} - {title}</b>", styles["exp_title"])
            date_p = Paragraph(period, styles["exp_date"])

            date_w = 40 * mm
            t = Table(
                [[title_p, date_p]],
                colWidths=[content_width - date_w, date_w],
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
                lines = [l.strip() for l in desc.split("\n") if l.strip()]
                for line in lines:
                    items.append(
                        Paragraph(f"\xb7{NBSP * 2}{esc(line)}", styles["bullet"])
                    )

            items.append(Spacer(1, 2.5 * mm))

            if role.get("pageBreakAfter"):
                items.append(PageBreak())

        if exp.get("pageBreakAfter"):
            items.append(PageBreak())

    return items


def build_projects(projects: list, styles: dict, content_width: float = 0, opts: dict = None) -> list:
    """Build the projects section."""
    if opts is None:
        opts = DEFAULT_PDF_OPTS
    items = section_header("Projects", "projects", styles, opts)

    for proj in projects:
        items.append(Paragraph(f"<b>{esc(proj['name'])}</b>", styles["proj_name"]))
        if proj.get("description"):
            lines = [l.strip() for l in proj["description"].split("\n") if l.strip()]
            for line in lines:
                items.append(
                    Paragraph(f"\xb7{NBSP * 2}{esc(line)}", styles["proj_desc"])
                )
        items.append(Spacer(1, 2 * mm))
        if proj.get("pageBreakAfter"):
            items.append(PageBreak())

    return items


def build_education(education: list, styles: dict, content_width: float, opts: dict = None) -> list:
    """Build the education section."""
    if opts is None:
        opts = DEFAULT_PDF_OPTS
    items = section_header("Education", "education", styles, opts)

    for edu in education:
        degree = esc(edu.get("degree", ""))
        institution = esc(edu["institution"])
        period = esc(format_period(edu.get("period", {}), opts))
        focus = edu.get("focus", [])

        if degree:
            main_text = f"<b>{degree}</b>"
        else:
            main_text = f"<b>{institution}</b>"

        main_p = Paragraph(main_text, styles["edu_main"])
        date_p = Paragraph(period, styles["edu_date"])

        date_w = 40 * mm
        t = Table(
            [[main_p, date_p]],
            colWidths=[content_width - date_w, date_w],
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


def build_interests(interests: list, styles: dict, content_width: float = 0, opts: dict = None) -> list:
    """Build the interests section."""
    if opts is None:
        opts = DEFAULT_PDF_OPTS
    items = section_header("Interests", "interests", styles, opts)

    breaks = set(opts.get("pageBreaks", {}).get("interests", []))
    for i, interest in enumerate(interests):
        text = interest.strip() if isinstance(interest, str) else str(interest)
        if text:
            items.append(Paragraph(f"\xb7{NBSP * 2}{esc(text)}", styles["bullet"]))
        if i in breaks:
            items.append(PageBreak())

    return items


# ── Main ───────────────────────────────────────────────────────


def build_pdf(data: dict, output_path: str):
    """Generate the CV PDF from structured data."""
    opts = _get_opts(data)
    styles = make_styles(opts)
    margin_lr = opts["marginLR"] * mm
    margin_top = opts["marginTop"] * mm
    margin_bot = opts["marginBottom"] * mm
    content_width = A4[0] - 2 * margin_lr
    hidden = set(opts.get("hiddenSections", []))
    story = []

    # Name
    story.append(Paragraph(esc(data["contact"]["name"]), styles["name"]))
    title_text = data["contact"].get("title", "").strip()
    if title_text:
        story.append(Paragraph(esc(title_text), styles["title"]))
    story.append(Spacer(1, 2 * mm))

    # Contact info
    story.extend(build_contact(data["contact"], styles))
    story.append(HRFlowable(
        width="100%",
        thickness=1,
        color=COLOR_LINE,
        spaceBefore=2 * mm,
        spaceAfter=1 * mm,
    ))

    # Professional Summary (always first, pinned above section order)
    if "summary" not in hidden:
        story.extend(section_header("Summary", "summary", styles, opts))
        summary = esc(data.get("summary", "")).replace("\n", "<br/>")
        story.append(Paragraph(summary, styles["summary"]))

    # If mergeSummarySkills: render skills content directly after summary (no Skills header)
    skip_sections: set = set()
    if opts.get("mergeSummarySkills") and "skills" not in hidden:
        spacing = opts.get("mergeSummarySkillsSpacing", 3)
        story.append(Spacer(1, spacing * mm))
        for skill in data.get("skills", []):
            label = esc(skill.get("label", ""))
            vals = skill.get("items", "")
            if isinstance(vals, list):
                vals = ", ".join(vals)
            if label and vals:
                story.append(Paragraph(f"<b>{label}:</b> {esc(vals)}", styles["body"]))
            if skill.get("pageBreakAfter"):
                story.append(PageBreak())
        skip_sections.add("skills")

    SECTION_BUILDERS = {
        "skills":       lambda d, s, w: build_skills(d.get("skills", []), s, w, opts),
        "achievements": lambda d, s, w: build_achievements(d.get("achievements", []), s, w, opts),
        "experience":   lambda d, s, w: build_experience(d.get("experience", []), s, w, opts),
        "projects":     lambda d, s, w: build_projects(d.get("projects", []), s, w, opts),
        "education":    lambda d, s, w: build_education(d.get("education", []), s, w, opts),
        "interests":    lambda d, s, w: build_interests(d.get("interests", []), s, w, opts) if d.get("interests") else [],
    }
    DEFAULT_SECTION_ORDER = ["skills", "achievements", "experience", "projects", "education", "interests"]

    section_order = list(data.get("sectionOrder") or DEFAULT_SECTION_ORDER)
    for key in DEFAULT_SECTION_ORDER:
        if key not in section_order:
            section_order.append(key)

    for key in section_order:
        if key in hidden or key in skip_sections:
            continue
        builder = SECTION_BUILDERS.get(key)
        if builder:
            story.extend(builder(data, styles, content_width))

    # Strip trailing PageBreaks to avoid a blank last page
    while story and isinstance(story[-1], PageBreak):
        story.pop()

    doc = BaseDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=margin_lr,
        rightMargin=margin_lr,
        topMargin=margin_top,
        bottomMargin=margin_bot,
        title=f"CV - {data['contact']['name']}",
        author=data["contact"]["name"],
    )
    frame = Frame(
        margin_lr,
        margin_bot,
        content_width,
        A4[1] - margin_top - margin_bot,
        leftPadding=0,
        rightPadding=0,
        topPadding=0,
        bottomPadding=0,
    )
    doc.addPageTemplates([PageTemplate(id="cv", frames=[frame])])
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

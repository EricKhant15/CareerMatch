from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


OUTPUT_DIR = Path("output/pdf")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

PURPLE = colors.HexColor("#6329B7")
DARK = colors.HexColor("#211B2A")
MUTED = colors.HexColor("#6F6879")
SOFT = colors.HexColor("#F3EFFA")
LINE = colors.HexColor("#DED3EE")

PROFILES = [
    {
        "slug": "maya-chen",
        "name": "Maya Chen",
        "title": "Software Engineering Student",
        "email": "demo.student@careermatch.test",
        "summary": "Final-year Computer Science student interested in backend services, accessible web applications, and collaborative product development.",
        "skills": "JavaScript, HTML, CSS, Git, SQL",
        "project": "Built a student project tracker with role-based access, REST endpoints, and a responsive dashboard.",
        "experience": "Peer programming mentor - supported introductory web-development workshops and code reviews.",
    },
    {
        "slug": "narin-sutham",
        "name": "Narin Sutham",
        "title": "Cybersecurity Student",
        "email": "narin.sutham.demo@careermatch.test",
        "summary": "Cybersecurity student focused on Linux administration, defensive monitoring, and clear incident documentation.",
        "skills": "Linux, Python, SQL, Git, C",
        "project": "Created a lab-based log analysis workflow that identifies suspicious authentication attempts and produces incident summaries.",
        "experience": "Cybersecurity club volunteer - helped prepare secure configuration and capture-the-flag learning sessions.",
    },
    {
        "slug": "sofia-reyes",
        "name": "Sofia Reyes",
        "title": "Data Science Student",
        "email": "sofia.reyes.demo@careermatch.test",
        "summary": "Data Science student who enjoys translating operational data into understandable reports and actionable recommendations.",
        "skills": "Python, Pandas, SQL, Excel, Git",
        "project": "Analysed a synthetic retail dataset, cleaned inconsistent records, and delivered a dashboard of sales and retention trends.",
        "experience": "Student research assistant - prepared datasets, checked data quality, and documented repeatable analysis steps.",
    },
    {
        "slug": "liam-patel",
        "name": "Liam Patel",
        "title": "UI/UX Design Student",
        "email": "liam.patel.demo@careermatch.test",
        "summary": "Design student interested in inclusive interfaces, structured user research, and prototypes that communicate product decisions.",
        "skills": "Figma, HTML, CSS, JavaScript, Git",
        "project": "Designed and tested a mobile internship-search prototype with task flows, reusable components, and accessibility annotations.",
        "experience": "Design society contributor - facilitated critique sessions and prepared visual assets for student events.",
    },
    {
        "slug": "amina-hassan",
        "name": "Amina Hassan",
        "title": "Cloud Computing Student",
        "email": "amina.hassan.demo@careermatch.test",
        "summary": "Information Technology student developing practical skills in cloud operations, Linux troubleshooting, and deployment automation.",
        "skills": "Linux, Git, Python, SQL, Java",
        "project": "Deployed a containerised class application with automated checks, environment configuration, and monitoring notes.",
        "experience": "IT laboratory assistant - supported workstation setup, user troubleshooting, and technical documentation.",
    },
    {
        "slug": "noah-williams",
        "name": "Noah Williams",
        "title": "Software Engineering Student",
        "email": "noah.williams.demo@careermatch.test",
        "summary": "Software Engineering student interested in maintainable applications, testing practices, and productive team workflows.",
        "skills": "JavaScript, HTML, CSS, Git, SQL",
        "project": "Developed a team scheduling application with validation, automated tests, and documented release procedures.",
        "experience": "Student developer - collaborated in a four-person agile project and maintained issue and pull-request documentation.",
    },
]


def make_styles():
    styles = getSampleStyleSheet()
    return {
        "name": ParagraphStyle("Name", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=25, leading=29, textColor=colors.white, alignment=TA_LEFT, spaceAfter=3),
        "role": ParagraphStyle("Role", parent=styles["Normal"], fontName="Helvetica", fontSize=11, leading=15, textColor=colors.HexColor("#EADDF8")),
        "contact": ParagraphStyle("Contact", parent=styles["Normal"], fontName="Helvetica", fontSize=9, leading=13, textColor=colors.white),
        "heading": ParagraphStyle("Heading", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=PURPLE, spaceBefore=7, spaceAfter=5, uppercase=True),
        "body": ParagraphStyle("Body", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.5, leading=14, textColor=DARK),
        "small": ParagraphStyle("Small", parent=styles["BodyText"], fontName="Helvetica", fontSize=8.5, leading=12, textColor=MUTED),
    }


def build_cv(profile):
    output = OUTPUT_DIR / f"demo-cv-{profile['slug']}.pdf"
    document = SimpleDocTemplate(
        str(output), pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm,
        topMargin=15 * mm, bottomMargin=14 * mm,
        title=f"{profile['name']} - Synthetic Demo CV",
        author="CareerMatch",
    )
    style = make_styles()
    story = []

    header_left = [Paragraph(profile["name"], style["name"]), Paragraph(profile["title"], style["role"])]
    header_right = [
        Paragraph(profile["email"], style["contact"]),
        Paragraph("Bangkok, Thailand", style["contact"]),
        Paragraph("Available 4 days per week", style["contact"]),
    ]
    header = Table([[header_left, header_right]], colWidths=[115 * mm, 55 * mm], hAlign="LEFT")
    header.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PURPLE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 13),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 13),
        ("BOX", (0, 0), (-1, -1), 0.5, PURPLE),
    ]))
    story.extend([header, Spacer(1, 8 * mm)])

    story.extend([
        Paragraph("Profile", style["heading"]),
        Paragraph(profile["summary"], style["body"]),
        Paragraph("Education", style["heading"]),
        Table([
            [Paragraph("Assumption University", style["body"]), Paragraph("Expected graduation: 2027", style["small"])],
            [Paragraph(profile["title"].replace(" Student", ""), style["small"]), Paragraph("Current standing: Final year", style["small"])],
        ], colWidths=[105 * mm, 65 * mm], style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), SOFT),
            ("BOX", (0, 0), (-1, -1), 0.5, LINE),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 9),
            ("RIGHTPADDING", (0, 0), (-1, -1), 9),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ])),
        Paragraph("Technical Skills", style["heading"]),
        Paragraph(profile["skills"], style["body"]),
        Paragraph("Selected Project", style["heading"]),
        Paragraph(profile["project"], style["body"]),
        Paragraph("Experience and Activities", style["heading"]),
        Paragraph(profile["experience"], style["body"]),
        Paragraph("Career Objective", style["heading"]),
        Paragraph(f"Seeking an internship where I can strengthen my {profile['title'].replace(' Student', '').lower()} skills, learn from experienced mentors, and contribute reliably to a professional team.", style["body"]),
        Spacer(1, 9 * mm),
        Table([[Paragraph("SYNTHETIC CAREERMATCH DEMONSTRATION CV - NO REAL PERSON OR CONTACT INFORMATION", style["small"])]], colWidths=[170 * mm], style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFF8DF")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E9CC75")),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ])),
    ])

    document.build(story)
    return output


for item in PROFILES:
    print(build_cv(item))

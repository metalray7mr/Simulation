#!/usr/bin/env python3
"""Generate updated Abhishek Purohit resume as DOCX and PDF (single page, full content)."""

from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle
from reportlab.lib import colors


def add_heading(doc, text, size=9, bold=True, space_after=2, space_before=3):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.bold = bold
    run.font.size = Pt(size)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.space_before = Pt(space_before)
    return p


def add_bullet(doc, text):
    p = doc.add_paragraph(text, style="List Bullet")
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = Pt(10)
    for run in p.runs:
        run.font.size = Pt(8)
    return p


def build_docx(path):
    doc = Document()
    section = doc.sections[0]
    section.top_margin = Inches(0.4)
    section.bottom_margin = Inches(0.4)
    section.left_margin = Inches(0.5)
    section.right_margin = Inches(0.5)

    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title.add_run("Abhishek Purohit")
    run.bold = True
    run.font.size = Pt(14)
    title.paragraph_format.space_after = Pt(0)

    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = subtitle.add_run(
        "Data Engineer & Analyst | +91-7060470209 | abhishek.purohit7ap@gmail.com"
    )
    run.font.size = Pt(8.5)
    subtitle.paragraph_format.space_after = Pt(4)

    add_heading(doc, "PROFILE", size=9)
    profile = (
        "Experienced Data Analyst and Engineer with 8 years of expertise in ETL tools "
        "including PySpark, Python, SQL, Power BI, and Azure. Skilled in data integration, "
        "analysis, modeling, and data warehousing concepts. Proficient in designing and "
        "implementing ETL pipelines, working with big data technologies, and ensuring data "
        "quality. Adept at collaborating with cross-functional teams and communicating "
        "technical information to non-technical stakeholders. Passionate about leveraging "
        "data to drive innovation and optimize business operations."
    )
    p = doc.add_paragraph(profile)
    p.paragraph_format.line_spacing = Pt(10)
    for run in p.runs:
        run.font.size = Pt(8)

    add_heading(doc, "EXPERIENCE", size=9)

    add_heading(doc, "McKinsey & Company | Data Analyst", size=8, bold=True, space_after=0, space_before=2)
    p = doc.add_paragraph("Aug 2021 – Present | Gurgaon, IN")
    p.paragraph_format.space_after = Pt(0)
    for run in p.runs:
        run.font.size = Pt(8)
        run.italic = True

    for text in [
        "Helped clients solve problems and make better decisions using data, advanced "
        "analytics, and technology by leading CPG clients around the globe on data-driven "
        "marketing strategies, with a focus on helping them leverage the latest advances "
        "in tech-enablement to find, deliver, and sustain above-market growth of 16% YOY, "
        "profitability of $57 million, and price management.",
        "Designed and deployed advanced analytics to deeply understand shopper and "
        "consumer behaviour and translate insights into actionable strategies in the areas "
        "of pricing, assortment, innovation, and branding.",
        "Created an automated reporting system using Databricks to accelerate data "
        "governance and outlier detection. This system helped clients visualize critical "
        "KPIs in Power BI dashboards and minimize data anomalies.",
    ]:
        add_bullet(doc, text)

    add_heading(doc, "HCL Technologies | Engineer Programming", size=8, bold=True, space_after=0, space_before=2)
    p = doc.add_paragraph("Jun 2019 – Aug 2021 | Noida, IN")
    p.paragraph_format.space_after = Pt(0)
    for run in p.runs:
        run.font.size = Pt(8)
        run.italic = True

    for text in [
        "Automated data processing using ADF for billions of rows of transactional data "
        "from SQL Server and Splunk to improve real-time reporting of product metrics.",
        "Worked with clients to understand business needs and translate those needs into "
        "actionable reports in Power BI, saving 12 hours of manual work each week.",
        "Implemented an ETL framework using Spark with Python and loaded standardized data "
        "into Synapse and PolyBase tables.",
        "Delivered insights into user productivity and their capacity utilization based on "
        "access card logs, breaking down how much time users spent on hourly, non-billable, "
        "and no-charge hours, which helped identify 800 non-compliant users as per audit "
        "standards.",
    ]:
        add_bullet(doc, text)

    add_heading(doc, "IMSI Pvt Ltd | Associate", size=8, bold=True, space_after=0, space_before=2)
    p = doc.add_paragraph("Apr 2018 – Jun 2019 | Noida, IN")
    p.paragraph_format.space_after = Pt(0)
    for run in p.runs:
        run.font.size = Pt(8)
        run.italic = True

    for text in [
        "Collaborated on hands-on development of the data stack using Python and C# for "
        "maintaining data assets and business reports.",
        "Assisted in engineering and managing data models within the existing Azure and "
        "SSRS cloud environment.",
        "Developed data quality checks to adhere to high standards and scalable code.",
        "Completed a POC with Microsoft for deploying an Azure Data and Analytics solution "
        "with a turnaround of 3 months.",
    ]:
        add_bullet(doc, text)

    table = doc.add_table(rows=1, cols=2)
    left, right = table.rows[0].cells

    left.paragraphs[0].add_run("TECH STACK").bold = True
    for line in [
        "Data: Pandas, NumPy, Alteryx, Power BI, PySpark, Databricks, HDInsight, Snowflake, Azure Data Factory, Airflow, ReactJS",
        "Cloud: Logic App, Azure Functions, ETL, Azure Synapse, Azure Fabric, API",
        "DevOps: CI/CD, Docker, Shell, Splunk, GitLab",
        "Database: PostgreSQL, Vertica DB, Azure Synapse, SQL Server, MongoDB (NoSQL), Delta Lake",
    ]:
        p = left.add_paragraph(line)
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = Pt(10)
        for run in p.runs:
            run.font.size = Pt(8)

    p = left.add_paragraph()
    p.add_run("EDUCATION").bold = True
    for block in [
        ("BITS Pilani | M.Tech", "Oct 2022 | 24 Months", "Data Science and Engineering"),
        ("UTU Tehri | B.Tech", "July 2017 | 48 Months", "Electronics & Communication Engineering"),
    ]:
        p = left.add_paragraph()
        run = p.add_run(block[0])
        run.bold = True
        run.font.size = Pt(8)
        p = left.add_paragraph(block[1])
        p.paragraph_format.space_after = Pt(0)
        for run in p.runs:
            run.font.size = Pt(8)
            run.italic = True
        p = left.add_paragraph(block[2])
        p.paragraph_format.space_after = Pt(0)
        for run in p.runs:
            run.font.size = Pt(8)

    p = left.add_paragraph()
    p.add_run("COURSES").bold = True
    for course in [
        ("Advanced Data Science | IBM", "Feb 2019 | 3 Months"),
        ("Deep Learning | IIT Madras", "Oct 2018 | 4 Months"),
        ("Machine Learning | IIT Madras", "Sep 2018 | 2 Months"),
        ("Node.js Master Class | Pirple", "Apr 2018 | 3 Months"),
    ]:
        p = left.add_paragraph()
        run = p.add_run(course[0])
        run.bold = True
        run.font.size = Pt(8)
        p = left.add_paragraph(course[1])
        p.paragraph_format.space_after = Pt(0)
        for run in p.runs:
            run.font.size = Pt(8)
            run.italic = True

    right.paragraphs[0].add_run("CERTIFICATES").bold = True
    p = right.add_paragraph("DA 100 | DA 900 | AZ 900 | Open Hack | Applied AI")
    for run in p.runs:
        run.font.size = Pt(8)

    p = right.add_paragraph()
    p.add_run("SKILLS").bold = True
    p = right.add_paragraph("Python | JavaScript | C# | SQL")
    for run in p.runs:
        run.font.size = Pt(8)

    p = right.add_paragraph()
    p.add_run("LANGUAGES").bold = True
    p = right.add_paragraph("English | Hindi")
    for run in p.runs:
        run.font.size = Pt(8)

    doc.save(path)


def build_pdf(path):
    styles = getSampleStyleSheet()
    page_w, _ = letter
    margin = 0.38 * inch
    col_w = (page_w - 2 * margin) / 2 - 4

    title_style = ParagraphStyle(
        "Title", parent=styles["Normal"], fontSize=13, alignment=1, spaceAfter=1, leading=14
    )
    subtitle_style = ParagraphStyle(
        "Subtitle", parent=styles["Normal"], fontSize=8, alignment=1, spaceAfter=4, leading=9
    )
    section_style = ParagraphStyle(
        "Section",
        parent=styles["Normal"],
        fontSize=8.5,
        fontName="Helvetica-Bold",
        spaceBefore=3,
        spaceAfter=1,
        leading=10,
    )
    job_style = ParagraphStyle(
        "Job", parent=styles["Normal"], fontSize=7.5, spaceAfter=0, leading=9
    )
    body_style = ParagraphStyle(
        "Body", parent=styles["Normal"], fontSize=7.5, spaceAfter=1, leading=9
    )
    bullet_style = ParagraphStyle(
        "Bullet",
        parent=styles["Normal"],
        fontSize=7.5,
        leftIndent=10,
        bulletIndent=4,
        spaceAfter=0,
        leading=9,
    )

    story = [
        Paragraph("Abhishek Purohit", title_style),
        Paragraph(
            "Data Engineer &amp; Analyst | +91-7060470209 | abhishek.purohit7ap@gmail.com",
            subtitle_style,
        ),
        Paragraph("PROFILE", section_style),
        Paragraph(
            "Experienced Data Analyst and Engineer with 8 years of expertise in ETL tools "
            "including PySpark, Python, SQL, Power BI, and Azure. Skilled in data integration, "
            "analysis, modeling, and data warehousing concepts. Proficient in designing and "
            "implementing ETL pipelines, working with big data technologies, and ensuring data "
            "quality. Adept at collaborating with cross-functional teams and communicating "
            "technical information to non-technical stakeholders. Passionate about leveraging "
            "data to drive innovation and optimize business operations.",
            body_style,
        ),
        Paragraph("EXPERIENCE", section_style),
        Paragraph(
            "<b>McKinsey &amp; Company | Data Analyst</b><br/><i>Aug 2021 – Present | Gurgaon, IN</i>",
            job_style,
        ),
        Paragraph(
            "• Helped clients solve problems and make better decisions using data, advanced analytics, and technology by leading CPG clients around the globe on data-driven marketing strategies, with a focus on helping them leverage the latest advances in tech-enablement to find, deliver, and sustain above-market growth of 16% YOY, profitability of $57 million, and price management.",
            bullet_style,
        ),
        Paragraph(
            "• Designed and deployed advanced analytics to deeply understand shopper and consumer behaviour and translate insights into actionable strategies in the areas of pricing, assortment, innovation, and branding.",
            bullet_style,
        ),
        Paragraph(
            "• Created an automated reporting system using Databricks to accelerate data governance and outlier detection. This system helped clients visualize critical KPIs in Power BI dashboards and minimize data anomalies.",
            bullet_style,
        ),
        Paragraph(
            "<b>HCL Technologies | Engineer Programming</b><br/><i>Jun 2019 – Aug 2021 | Noida, IN</i>",
            job_style,
        ),
        Paragraph(
            "• Automated data processing using ADF for billions of rows of transactional data from SQL Server and Splunk to improve real-time reporting of product metrics.",
            bullet_style,
        ),
        Paragraph(
            "• Worked with clients to understand business needs and translate those needs into actionable reports in Power BI, saving 12 hours of manual work each week.",
            bullet_style,
        ),
        Paragraph(
            "• Implemented an ETL framework using Spark with Python and loaded standardized data into Synapse and PolyBase tables.",
            bullet_style,
        ),
        Paragraph(
            "• Delivered insights into user productivity and their capacity utilization based on access card logs, breaking down how much time users spent on hourly, non-billable, and no-charge hours, which helped identify 800 non-compliant users as per audit standards.",
            bullet_style,
        ),
        Paragraph(
            "<b>IMSI Pvt Ltd | Associate</b><br/><i>Apr 2018 – Jun 2019 | Noida, IN</i>",
            job_style,
        ),
        Paragraph(
            "• Collaborated on hands-on development of the data stack using Python and C# for maintaining data assets and business reports.",
            bullet_style,
        ),
        Paragraph(
            "• Assisted in engineering and managing data models within the existing Azure and SSRS cloud environment.",
            bullet_style,
        ),
        Paragraph(
            "• Developed data quality checks to adhere to high standards and scalable code.",
            bullet_style,
        ),
        Paragraph(
            "• Completed a POC with Microsoft for deploying an Azure Data and Analytics solution with a turnaround of 3 months.",
            bullet_style,
        ),
    ]

    left_col = [
        Paragraph("TECH STACK", section_style),
        Paragraph(
            "Data: Pandas, NumPy, Alteryx, Power BI, PySpark, Databricks, HDInsight, Snowflake, Azure Data Factory, Airflow, ReactJS",
            body_style,
        ),
        Paragraph(
            "Cloud: Logic App, Azure Functions, ETL, Azure Synapse, Azure Fabric, API",
            body_style,
        ),
        Paragraph("DevOps: CI/CD, Docker, Shell, Splunk, GitLab", body_style),
        Paragraph(
            "Database: PostgreSQL, Vertica DB, Azure Synapse, SQL Server, MongoDB (NoSQL), Delta Lake",
            body_style,
        ),
        Paragraph("EDUCATION", section_style),
        Paragraph(
            "<b>BITS Pilani | M.Tech</b> — Oct 2022 | 24 Months — Data Science and Engineering",
            body_style,
        ),
        Paragraph(
            "<b>UTU Tehri | B.Tech</b> — July 2017 | 48 Months — Electronics &amp; Communication Engineering",
            body_style,
        ),
        Paragraph("COURSES", section_style),
        Paragraph("<b>Advanced Data Science | IBM</b> — Feb 2019 | 3 Months", body_style),
        Paragraph("<b>Deep Learning | IIT Madras</b> — Oct 2018 | 4 Months", body_style),
        Paragraph("<b>Machine Learning | IIT Madras</b> — Sep 2018 | 2 Months", body_style),
        Paragraph("<b>Node.js Master Class | Pirple</b> — Apr 2018 | 3 Months", body_style),
    ]

    right_col = [
        Paragraph("CERTIFICATES", section_style),
        Paragraph("DA 100 | DA 900 | AZ 900 | Open Hack | Applied AI", body_style),
        Paragraph("SKILLS", section_style),
        Paragraph("Python | JavaScript | C# | SQL", body_style),
        Paragraph("LANGUAGES", section_style),
        Paragraph("English | Hindi", body_style),
    ]

    bottom = Table([[left_col, right_col]], colWidths=[col_w, col_w])
    bottom.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(bottom)

    doc = SimpleDocTemplate(
        path,
        pagesize=letter,
        rightMargin=margin,
        leftMargin=margin,
        topMargin=margin,
        bottomMargin=margin,
    )
    doc.build(story)


if __name__ == "__main__":
    from pypdf import PdfReader

    pdf_path = "/workspace/resume/Abhishek_Purohit_Data_Engineer.pdf"
    docx_path = "/workspace/resume/Abhishek_Purohit_Data_Engineer.docx"
    build_docx(docx_path)
    build_pdf(pdf_path)
    pages = len(PdfReader(pdf_path).pages)
    print(f"Resume generated successfully. PDF pages: {pages}")

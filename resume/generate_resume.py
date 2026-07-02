#!/usr/bin/env python3
"""Generate updated Abhishek Purohit resume as DOCX and PDF."""

from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors


def add_heading(doc, text, size=11, bold=True, space_after=4):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.bold = bold
    run.font.size = Pt(size)
    p.paragraph_format.space_after = Pt(space_after)
    return p


def add_bullet(doc, text):
    p = doc.add_paragraph(text, style="List Bullet")
    p.paragraph_format.space_after = Pt(2)
    for run in p.runs:
        run.font.size = Pt(10)
    return p


def build_docx(path):
    doc = Document()
    section = doc.sections[0]
    section.top_margin = Inches(0.6)
    section.bottom_margin = Inches(0.6)
    section.left_margin = Inches(0.75)
    section.right_margin = Inches(0.75)

    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title.add_run("Abhishek Purohit")
    run.bold = True
    run.font.size = Pt(18)

    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = subtitle.add_run(
        "Data Engineer & Analyst | +91-7060470209 | abhishek.purohit7ap@gmail.com"
    )
    run.font.size = Pt(10)

    add_heading(doc, "PROFILE", size=11)
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
    for run in p.runs:
        run.font.size = Pt(10)

    add_heading(doc, "EXPERIENCE", size=11)

    add_heading(doc, "McKinsey & Company | Data Analyst", size=10, bold=True, space_after=2)
    p = doc.add_paragraph("Aug 2021 – Present | Gurgaon, IN")
    for run in p.runs:
        run.font.size = Pt(10)
        run.italic = True

    add_bullet(
        doc,
        "Helped clients solve problems and make better decisions using data, advanced "
        "analytics, and technology by leading CPG clients around the globe on data-driven "
        "marketing strategies, with a focus on helping them leverage the latest advances "
        "in tech-enablement to find, deliver, and sustain above-market growth of 16% YOY, "
        "profitability of $57 million, and price management.",
    )
    add_bullet(
        doc,
        "Designed and deployed advanced analytics to deeply understand shopper and "
        "consumer behaviour and translate insights into actionable strategies in the areas "
        "of pricing, assortment, innovation, and branding.",
    )
    add_bullet(
        doc,
        "Created an automated reporting system using Databricks to accelerate data "
        "governance and outlier detection. This system helped clients visualize critical "
        "KPIs in Power BI dashboards and minimize data anomalies.",
    )

    add_heading(doc, "HCL Technologies | Engineer Programming", size=10, bold=True, space_after=2)
    p = doc.add_paragraph("Jun 2019 – Aug 2021 | Noida, IN")
    for run in p.runs:
        run.font.size = Pt(10)
        run.italic = True

    add_bullet(
        doc,
        "Automated data processing using ADF for billions of rows of transactional data "
        "from SQL Server and Splunk to improve real-time reporting of product metrics.",
    )
    add_bullet(
        doc,
        "Worked with clients to understand business needs and translate those needs into "
        "actionable reports in Power BI, saving 12 hours of manual work each week.",
    )
    add_bullet(
        doc,
        "Implemented an ETL framework using Spark with Python and loaded standardized data "
        "into Synapse and PolyBase tables.",
    )
    add_bullet(
        doc,
        "Delivered insights into user productivity and their capacity utilization based on "
        "access card logs, breaking down how much time users spent on hourly, non-billable, "
        "and no-charge hours, which helped identify 800 non-compliant users as per audit "
        "standards.",
    )

    add_heading(doc, "IMSI Pvt Ltd | Associate", size=10, bold=True, space_after=2)
    p = doc.add_paragraph("Apr 2018 – Jun 2019 | Noida, IN")
    for run in p.runs:
        run.font.size = Pt(10)
        run.italic = True

    add_bullet(
        doc,
        "Collaborated on hands-on development of the data stack using Python and C# for "
        "maintaining data assets and business reports.",
    )
    add_bullet(
        doc,
        "Assisted in engineering and managing data models within the existing Azure and "
        "SSRS cloud environment.",
    )
    add_bullet(
        doc,
        "Developed data quality checks to adhere to high standards and scalable code.",
    )
    add_bullet(
        doc,
        "Completed a POC with Microsoft for deploying an Azure Data and Analytics solution "
        "with a turnaround of 3 months.",
    )

    add_heading(doc, "TECH STACK", size=11)
    for line in [
        "Data: Pandas, NumPy, Alteryx, Power BI, PySpark, Databricks, HDInsight, Snowflake, Azure Data Factory, Airflow, ReactJS",
        "Cloud: Logic App, Azure Functions, ETL, Azure Synapse, Azure Fabric, API",
        "DevOps: CI/CD, Docker, Shell, Splunk, GitLab",
        "Database: PostgreSQL, Vertica DB, Azure Synapse, SQL Server, MongoDB (NoSQL), Delta Lake",
    ]:
        p = doc.add_paragraph(line)
        for run in p.runs:
            run.font.size = Pt(10)

    add_heading(doc, "EDUCATION", size=11)
    for block in [
        ("BITS Pilani | M.Tech", "Oct 2022 | 24 Months", "Data Science and Engineering"),
        ("UTU Tehri | B.Tech", "July 2017 | 48 Months", "Electronics & Communication Engineering"),
    ]:
        p = doc.add_paragraph()
        run = p.add_run(block[0])
        run.bold = True
        run.font.size = Pt(10)
        p = doc.add_paragraph(block[1])
        for run in p.runs:
            run.font.size = Pt(10)
            run.italic = True
        p = doc.add_paragraph(block[2])
        for run in p.runs:
            run.font.size = Pt(10)

    add_heading(doc, "COURSES", size=11)
    for course in [
        ("Advanced Data Science | IBM", "Feb 2019 | 3 Months"),
        ("Deep Learning | IIT Madras", "Oct 2018 | 4 Months"),
        ("Machine Learning | IIT Madras", "Sep 2018 | 2 Months"),
        ("Node.js Master Class | Pirple", "Apr 2018 | 3 Months"),
    ]:
        p = doc.add_paragraph()
        run = p.add_run(course[0])
        run.bold = True
        run.font.size = Pt(10)
        p = doc.add_paragraph(course[1])
        for run in p.runs:
            run.font.size = Pt(10)
            run.italic = True

    add_heading(doc, "CERTIFICATES", size=11)
    p = doc.add_paragraph("DA 100 | DA 900 | AZ 900 | Open Hack | Applied AI")
    for run in p.runs:
        run.font.size = Pt(10)

    add_heading(doc, "SKILLS", size=11)
    p = doc.add_paragraph("Python | JavaScript | C# | SQL")
    for run in p.runs:
        run.font.size = Pt(10)
    add_heading(doc, "LANGUAGES", size=11)
    p = doc.add_paragraph("English | Hindi")
    for run in p.runs:
        run.font.size = Pt(10)

    doc.save(path)


def build_pdf(path):
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "Title",
        parent=styles["Heading1"],
        fontSize=16,
        alignment=1,
        spaceAfter=6,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle",
        parent=styles["Normal"],
        fontSize=9,
        alignment=1,
        spaceAfter=12,
    )
    section_style = ParagraphStyle(
        "Section",
        parent=styles["Heading2"],
        fontSize=10,
        spaceBefore=8,
        spaceAfter=4,
        textColor=colors.black,
    )
    job_style = ParagraphStyle(
        "Job",
        parent=styles["Normal"],
        fontSize=9,
        spaceAfter=2,
        leftIndent=0,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontSize=9,
        spaceAfter=4,
        leading=12,
    )
    bullet_style = ParagraphStyle(
        "Bullet",
        parent=styles["Normal"],
        fontSize=9,
        leftIndent=14,
        bulletIndent=6,
        spaceAfter=3,
        leading=12,
    )

    story = []
    story.append(Paragraph("Abhishek Purohit", title_style))
    story.append(
        Paragraph(
            "Data Engineer &amp; Analyst | +91-7060470209 | abhishek.purohit7ap@gmail.com",
            subtitle_style,
        )
    )

    sections = [
        (
            "PROFILE",
            [
                "Experienced Data Analyst and Engineer with 8 years of expertise in ETL tools "
                "including PySpark, Python, SQL, Power BI, and Azure. Skilled in data integration, "
                "analysis, modeling, and data warehousing concepts. Proficient in designing and "
                "implementing ETL pipelines, working with big data technologies, and ensuring data "
                "quality. Adept at collaborating with cross-functional teams and communicating "
                "technical information to non-technical stakeholders. Passionate about leveraging "
                "data to drive innovation and optimize business operations."
            ],
        ),
        (
            "EXPERIENCE",
            [
                "<b>McKinsey &amp; Company | Data Analyst</b><br/><i>Aug 2021 – Present | Gurgaon, IN</i>",
                "• Helped clients solve problems and make better decisions using data, advanced analytics, and technology by leading CPG clients around the globe on data-driven marketing strategies, with a focus on helping them leverage the latest advances in tech-enablement to find, deliver, and sustain above-market growth of 16% YOY, profitability of $57 million, and price management.",
                "• Designed and deployed advanced analytics to deeply understand shopper and consumer behaviour and translate insights into actionable strategies in the areas of pricing, assortment, innovation, and branding.",
                "• Created an automated reporting system using Databricks to accelerate data governance and outlier detection. This system helped clients visualize critical KPIs in Power BI dashboards and minimize data anomalies.",
                "<b>HCL Technologies | Engineer Programming</b><br/><i>Jun 2019 – Aug 2021 | Noida, IN</i>",
                "• Automated data processing using ADF for billions of rows of transactional data from SQL Server and Splunk to improve real-time reporting of product metrics.",
                "• Worked with clients to understand business needs and translate those needs into actionable reports in Power BI, saving 12 hours of manual work each week.",
                "• Implemented an ETL framework using Spark with Python and loaded standardized data into Synapse and PolyBase tables.",
                "• Delivered insights into user productivity and their capacity utilization based on access card logs, breaking down how much time users spent on hourly, non-billable, and no-charge hours, which helped identify 800 non-compliant users as per audit standards.",
                "<b>IMSI Pvt Ltd | Associate</b><br/><i>Apr 2018 – Jun 2019 | Noida, IN</i>",
                "• Collaborated on hands-on development of the data stack using Python and C# for maintaining data assets and business reports.",
                "• Assisted in engineering and managing data models within the existing Azure and SSRS cloud environment.",
                "• Developed data quality checks to adhere to high standards and scalable code.",
                "• Completed a POC with Microsoft for deploying an Azure Data and Analytics solution with a turnaround of 3 months.",
            ],
        ),
        (
            "TECH STACK",
            [
                "Data: Pandas, NumPy, Alteryx, Power BI, PySpark, Databricks, HDInsight, Snowflake, Azure Data Factory, Airflow, ReactJS",
                "Cloud: Logic App, Azure Functions, ETL, Azure Synapse, Azure Fabric, API",
                "DevOps: CI/CD, Docker, Shell, Splunk, GitLab",
                "Database: PostgreSQL, Vertica DB, Azure Synapse, SQL Server, MongoDB (NoSQL), Delta Lake",
            ],
        ),
        (
            "EDUCATION",
            [
                "<b>BITS Pilani | M.Tech</b> — Oct 2022 | 24 Months — Data Science and Engineering",
                "<b>UTU Tehri | B.Tech</b> — July 2017 | 48 Months — Electronics &amp; Communication Engineering",
            ],
        ),
        (
            "COURSES",
            [
                "<b>Advanced Data Science | IBM</b> — Feb 2019 | 3 Months",
                "<b>Deep Learning | IIT Madras</b> — Oct 2018 | 4 Months",
                "<b>Machine Learning | IIT Madras</b> — Sep 2018 | 2 Months",
                "<b>Node.js Master Class | Pirple</b> — Apr 2018 | 3 Months",
            ],
        ),
        (
            "CERTIFICATES",
            ["DA 100 | DA 900 | AZ 900 | Open Hack | Applied AI"],
        ),
        (
            "SKILLS",
            ["Python | JavaScript | C# | SQL"],
        ),
        (
            "LANGUAGES",
            ["English | Hindi"],
        ),
    ]

    for heading, items in sections:
        story.append(Paragraph(heading, section_style))
        for item in items:
            if item.startswith("•"):
                story.append(Paragraph(item, bullet_style))
            elif "<b>" in item and "<br/>" in item:
                story.append(Paragraph(item, job_style))
            else:
                story.append(Paragraph(item, body_style))

    doc = SimpleDocTemplate(
        path,
        pagesize=letter,
        rightMargin=0.65 * inch,
        leftMargin=0.65 * inch,
        topMargin=0.6 * inch,
        bottomMargin=0.6 * inch,
    )
    doc.build(story)


if __name__ == "__main__":
    build_docx("/workspace/resume/Abhishek_Purohit_Data_Engineer.docx")
    build_pdf("/workspace/resume/Abhishek_Purohit_Data_Engineer.pdf")
    print("Resume generated successfully.")

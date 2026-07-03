#!/usr/bin/env python3
"""Update only years of experience in the original resume PDF."""

from pathlib import Path

import fitz

ORIGINAL = Path(__file__).resolve().parent / "Abhishek_Purohit_Data_Engineer_original.pdf"
OUTPUT = Path(__file__).resolve().parent / "Abhishek_Purohit_Data_Engineer.pdf"
OLD_TEXT = "5+ years"
NEW_TEXT = "8 years"
PROFILE_BASELINE_Y = 85.99998474121094
PROFILE_FILL = (231 / 255, 231 / 255, 231 / 255)


def build_pdf(output_path: Path = OUTPUT) -> None:
    doc = fitz.open(ORIGINAL)
    page = doc[0]

    hits = page.search_for(OLD_TEXT)
    if not hits:
        raise ValueError(f"Could not find '{OLD_TEXT}' in the original PDF")

    rect = hits[0]
    page.add_redact_annot(rect, fill=PROFILE_FILL)
    page.apply_redactions()
    page.insert_text(
        (rect.x0, PROFILE_BASELINE_Y),
        NEW_TEXT,
        fontsize=10.0,
        fontname="helv",
        color=(0, 0, 0),
    )

    doc.save(output_path, garbage=4, deflate=True)
    doc.close()


if __name__ == "__main__":
    build_pdf()
    print(f"Updated resume saved to {OUTPUT}")

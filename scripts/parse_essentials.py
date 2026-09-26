"""Extract Essentials 4x workout tables into data/essentials.json.

Outlined text is read with one OCR pass per page. Working-set counts are single
digits the OCR skips, so those are classified from the ink in each cell.
"""

import json
import re
from pathlib import Path

import pymupdf
from PIL import Image
from rapidocr_onnxruntime import RapidOCR

PDF = Path(r"C:\Users\CARL\Downloads\Essentials4x.pdf")
OUT = Path(__file__).resolve().parents[1] / "data" / "essentials.json"

FIRST = 2
LAST = 49
DAY_NAMES = ["Upper A", "Lower A", "Upper B", "Lower B"]
SCALE = 1.3

# Pixel centers at SCALE, from a rendered week-1 page.
BANDS = [
    ("exercise", 180, 460),
    ("warmup", 500, 680),
    ("reps", 800, 950),
    ("rpe", 1000, 1160),
    ("rest", 1160, 1300),
    ("sub1", 1300, 1480),
    ("sub2", 1480, 1680),
    ("notes", 1680, 2300),
]

ocr = RapidOCR()


def clean(text):
    text = text.replace("—", "-").replace("–", "-").replace("−", "-")
    text = re.sub(r"\s+", " ", text).strip(" |")
    text = text.replace("RoW", "Row").replace("Dropthe", "Drop the").replace("Dofirst", "Do first")
    return text


def band_for(x):
    for name, start, end in BANDS:
        if start <= x < end:
            return name
    return None


def working_digits(page):
    height = page.rect.height
    found = []
    for _xref, _name, _inv, bbox in page.get_xobjects():
        x0, y0, x1, y1 = bbox
        if abs(x0 - 542) > 12 or y1 > 900:
            continue
        clip = pymupdf.Rect(x0, height - y1, x1, height - y0)
        pix = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), clip=clip, alpha=False)
        image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        pixels = image.load()
        count = 0
        for y in range(image.height):
            for x in range(image.width):
                red, green, blue = pixels[x, y]
                if red < 140 and green < 140 and blue < 140:
                    count += 1
        if count < 20:
            continue
        digit = "1" if count < 80 else "2" if count < 109 else "3"
        center = (height - (y0 + y1) / 2) * SCALE
        found.append((center, digit))
    return found


def rows_of(page):
    pix = page.get_pixmap(matrix=pymupdf.Matrix(SCALE, SCALE), alpha=False)
    result, _elapsed = ocr(pix.tobytes("png"))
    tokens = []
    for box, text, _score in result or []:
        xs = [point[0] for point in box]
        ys = [point[1] for point in box]
        tokens.append((sum(ys) / 4, sum(xs) / 4, clean(text)))

    anchors = sorted(y for y, x, text in tokens if 180 <= x < 460 and y > 190 and text.upper() not in {"EXERCISE", "UPPER", "LOWER"})
    # Merge wrapped name fragments that sit on the next line of the same cell.
    merged = []
    for y in anchors:
        if merged and y - merged[-1] < 40:
            continue
        merged.append(y)

    rows = []
    digits = working_digits(page)
    for index, y in enumerate(merged):
        top = (merged[index - 1] + y) / 2 if index else y - 50
        bottom = (y + merged[index + 1]) / 2 if index + 1 < len(merged) else y + 90
        grouped = {name: [] for name, _, _ in BANDS}
        for ty, tx, text in tokens:
            if not (top <= ty < bottom):
                continue
            band = band_for(tx)
            if band:
                grouped[band].append((ty, text))
        exercise = " ".join(text for _ty, text in sorted(grouped["exercise"]))
        if not exercise:
            continue
        digit = min(digits, key=lambda item: abs(item[0] - y))[1] if digits else ""
        reps = " ".join(text for _ty, text in sorted(grouped["reps"]))
        drop = "dropset" in reps.lower()
        rows.append(
            {
                "name": exercise,
                "technique": "Drop set" if drop else "N/A",
                "warmupSets": " ".join(text for _ty, text in sorted(grouped["warmup"])),
                "workingSets": digit,
                "repRange": re.sub(r"\(dropset\)", "", reps, flags=re.I).strip(),
                "rpe": " ".join(text for _ty, text in sorted(grouped["rpe"])),
                "rest": " ".join(text for _ty, text in sorted(grouped["rest"])),
                "substitution1": " ".join(text for _ty, text in sorted(grouped["sub1"])),
                "substitution2": " ".join(text for _ty, text in sorted(grouped["sub2"])),
                "notes": " ".join(text for _ty, text in sorted(grouped["notes"])),
                "videoUrl": None,
            }
        )
    return rows


def main():
    doc = pymupdf.open(PDF)
    weeks = []
    for index in range(FIRST, LAST + 1):
        offset = index - FIRST
        week_number = offset // 4 + 1
        day_name = DAY_NAMES[offset % 4]
        if offset % 4 == 0:
            weeks.append({"week": week_number, "days": []})
        exercises = rows_of(doc[index])
        weeks[-1]["days"].append({"name": day_name, "label": day_name, "exercises": exercises})
        print(week_number, day_name, len(exercises), exercises[0]["name"] if exercises else "-", flush=True)

    OUT.write_text(json.dumps({"name": "Upper/Lower", "weeks": weeks}, indent=2), encoding="utf-8")
    print("wrote", OUT, flush=True)


if __name__ == "__main__":
    main()

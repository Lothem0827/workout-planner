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
LINKED = Path(r"C:\Users\CARL\Downloads\Documents\The Essentials Program 4x.pdf")
OUT = Path(__file__).resolve().parents[1] / "data" / "essentials.json"
LINK_PAGE = 19

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


def attach_videos(weeks):
    """Exercise names in the source PDF are YouTube links. The outlined export drops them."""
    if not LINKED.exists():
        return {}
    doc = pymupdf.open(LINKED)
    demos = {}
    flat_days = [day for week in weeks for day in week["days"]]
    bands = ((140, 450), (960, 1130), (1130, 1320))

    def url_in(links, top, bottom, band):
        found = None
        for x, y, uri in links:
            if top <= y < bottom and band[0] <= x < band[1]:
                found = uri
        return found

    for offset, day in enumerate(flat_days):
        page = doc[LINK_PAGE + offset]
        links = []
        for link in page.get_links():
            uri = (link.get("uri") or "").split("&")[0]
            if "youtu" not in uri:
                continue
            rect = link["from"]
            links.append(((rect.x0 + rect.x1) / 2, (rect.y0 + rect.y1) / 2, uri))
        anchors = []
        for x, y, _uri in links:
            if bands[0][0] <= x < bands[0][1]:
                if not anchors or y - anchors[-1] >= 36:
                    anchors.append(y)
        for index, exercise in enumerate(day["exercises"]):
            if index >= len(anchors):
                break
            y = anchors[index]
            top = (anchors[index - 1] + y) / 2 if index else y - 40
            bottom = (y + anchors[index + 1]) / 2 if index + 1 < len(anchors) else y + 70
            video, sub1, sub2 = (url_in(links, top, bottom, band) for band in bands)
            exercise["videoUrl"] = video
            for name, url in (
                (exercise["name"], video),
                (exercise["substitution1"], sub1),
                (exercise["substitution2"], sub2),
            ):
                if name and url:
                    demos.setdefault(name, url)
    return demos


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

    demos = attach_videos(weeks)
    OUT.write_text(
        json.dumps({"name": "Upper/Lower", "demos": demos, "weeks": weeks}, indent=2),
        encoding="utf-8",
    )
    print("wrote", OUT, "demos", len(demos), flush=True)


if __name__ == "__main__":
    main()

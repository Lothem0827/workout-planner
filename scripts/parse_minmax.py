"""Extract Min-Max workout tables from the purchased PDF into data/minmax.json."""

import json
from pathlib import Path

import pymupdf

PDF = Path(r"C:\Users\CARL\Downloads\OceanofPDF.pdf")
OUT = Path(__file__).resolve().parents[1] / "data" / "minmax.json"

COLUMNS = [
    ("exercise", 160, 340),
    ("technique", 340, 500),
    ("warmup", 500, 600),
    ("working", 600, 700),
    ("reps", 700, 800),
    ("rir1", 1150, 1265),
    ("rir2", 1265, 1365),
    ("rest", 1365, 1475),
    ("sub1", 1475, 1608),
    ("sub2", 1608, 1765),
    ("notes", 1765, 2300),
]


def words_of(page):
    items = []
    for word in page.get_text("words"):
        x, y, text = word[0], word[1], word[4]
        if y < 220 or y > 1180 or x < 150:
            continue
        items.append((x, y, text))
    return items


def column_for(x):
    for name, start, end in COLUMNS:
        if start <= x < end:
            return name
    return None


def parse_page(page):
    grouped = {name: [] for name, _, _ in COLUMNS}
    for x, y, text in words_of(page):
        name = column_for(x)
        if name:
            grouped[name].append((y, text))

    anchors = sorted(grouped["reps"], key=lambda item: item[0])
    if not anchors:
        return []

    rows = []
    for index, (y, _) in enumerate(anchors):
        above = anchors[index - 1][0] if index else y - 70
        below = anchors[index + 1][0] if index + 1 < len(anchors) else y + 70
        top = (above + y) / 2
        bottom = (y + below) / 2
        row = {}
        for name, cells in grouped.items():
            parts = [text for cy, text in cells if top <= cy < bottom]
            row[name] = " ".join(parts).replace("  ", " ").strip()
        if row["exercise"]:
            row["videoUrl"] = youtube_in_band(page, 160, 340, top, bottom)
            row["sub1Video"] = youtube_in_band(page, 1475, 1608, top, bottom)
            row["sub2Video"] = youtube_in_band(page, 1608, 1765, top, bottom)
            rows.append(row)
    return rows


def clean_count(value):
    value = value.replace(" ", "")
    if not value or value.upper() == "N/A":
        return value or "N/A"
    return value


def youtube_in_band(page, x0, x1, top, bottom):
    found = None
    for link in page.get_links():
        uri = link.get("uri") or ""
        if "youtu" not in uri:
            continue
        rect = link["from"]
        cx = (rect.x0 + rect.x1) / 2
        cy = (rect.y0 + rect.y1) / 2
        if x0 <= cx < x1 and top <= cy < bottom:
            found = uri.split("&")[0]
    return found


def remember(demos, name, url):
    if name and name != "See Notes" and url:
        demos.setdefault(name, url)


def main():
    doc = pymupdf.open(PDF)
    weeks = []
    demos = {}
    current = None
    day_order = ["Upper", "Lower", "Upper", "Lower", "Arms + Delts"]
    day_index = 0
    for page_number in range(24, 84):
        page = doc[page_number]
        week_words = [
            word[4]
            for word in page.get_text("words")
            if word[4] == "WEEK" or (word[4].isdigit() and word[0] < 220 and word[1] < 200)
        ]
        week_number = None
        for token in week_words:
            if token.isdigit():
                week_number = int(token)
        if current is None or (week_number and current["week"] != week_number):
            current = {"week": week_number, "days": []}
            weeks.append(current)
            day_index = 0
        left = [word[4] for word in page.get_text("words") if word[0] < 150 and 300 < word[1] < 1000]
        label = " ".join(left)
        if label.startswith("Arms"):
            name = "Arms + Delts"
        else:
            name = day_order[day_index] if day_index < 5 else label
        day_index += 1
        exercises = []
        for row in parse_page(page):
            exercises.append(
                {
                    "name": row["exercise"],
                    "technique": row["technique"] or "N/A",
                    "warmupSets": clean_count(row["warmup"]),
                    "workingSets": clean_count(row["working"]),
                    "repRange": row["reps"] or "N/A",
                    "rirSet1": row["rir1"] or "N/A",
                    "rirSet2": row["rir2"] or "N/A",
                    "rest": row["rest"] or "",
                    "substitution1": row["sub1"] or "",
                    "substitution2": row["sub2"] or "",
                    "notes": row["notes"],
                    "videoUrl": row["videoUrl"],
                }
            )
            if row["videoUrl"]:
                demos[row["exercise"]] = row["videoUrl"]
            remember(demos, row["sub1"], row["sub1Video"])
            remember(demos, row["sub2"], row["sub2Video"])
        current["days"].append({"name": name, "label": label, "exercises": exercises})

    missing = [
        exercise["name"]
        for week in weeks
        for day in week["days"]
        for exercise in day["exercises"]
        if not exercise["videoUrl"]
    ]
    OUT.write_text(
        json.dumps({"name": "Min-Max", "demos": demos, "weeks": weeks}, indent=2),
        encoding="utf-8",
    )
    print("demos", len(demos), "missing", len(missing))
    for name in missing[:12]:
        print("  no video", name)
    print("weeks", len(weeks))
    for week in weeks:
        counts = [len(day["exercises"]) for day in week["days"]]
        print(week["week"], counts, [day["name"] for day in week["days"]])
        first = week["days"][0]["exercises"][0]
        print(" ", first["name"], first["workingSets"], first["repRange"], first["rirSet1"], first["rest"])


if __name__ == "__main__":
    main()

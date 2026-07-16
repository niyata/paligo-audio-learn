#!/usr/bin/env python3
"""Build an idiomatic-Thai Dhammapada corpus from the translated PDF.

The source is "พระธัมมปทัฏฐกถาแปล ภาค ๑.pdf" (แปลโดยอรรถ). It uses legacy
Thai presentation characters in the PDF text layer, so this builder normalizes
those glyphs into ordinary Unicode Thai before exposing the text to PiP.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import unicodedata
from pathlib import Path
from typing import Any


DEFAULT_PDF = Path(
    "/Users/iworn/Documents/Claude/Projects/PaliGo/Knowledge-Base/pt4/"
    "Dhammapada-sambandha/Raw-Data-PT4/พระธัมมปทัฏฐกถาแปล ภาค ๑.pdf"
)
DEFAULT_OUT = Path("data/corpora/dhammapadatthakatha-meaning-thai-prototype")
CORPUS_ID = "dhammapadatthakatha-meaning-thai-prototype"
THAI_DIGITS = str.maketrans("0123456789", "๐๑๒๓๔๕๖๗๘๙")
SPACE_RE = re.compile(r"[ \t]+")
FOOTNOTE_START_RE = re.compile(r"^(?:[๐-๙0-9]{1,2}\.|[*])\s+")
HEADER_RE = re.compile(r"^ประโยค[๐-๙0-9๒2 ]+\s*-\s*พระธัมมปทัฏฐกถาแปล ภาค ๑\s*-\s*หน้าที่\s*[๐-๙0-9]+$")
DECORATION_RE = re.compile(r"^(?:[-–—]{3,}|[~=_]{3,})$")

PUA_MAP = {
    "\uf700": "ฐ",
    "\uf701": "ิ",
    "\uf702": "ี",
    "\uf703": "ึ",
    "\uf704": "ื",
    "\uf705": "่",
    "\uf706": "้",
    "\uf709": "์",
    "\uf70a": "่",
    "\uf70b": "้",
    "\uf70c": "๊",
    "\uf70d": "๋",
    "\uf70e": "์",
    "\uf70f": "ญ",
    "\uf710": "ั",
    "\uf711": "ํ",
    "\uf712": "็",
    "\uf713": "่",
    "\uf714": "้",
    "\uf718": "ุ",
    "\uf71a": "ฺ",
    "\uf71b": "",
}


def to_thai_digits(value: int | str) -> str:
    return str(value).translate(THAI_DIGITS)


def normalize_pdf_text(value: str) -> str:
    text = unicodedata.normalize("NFC", value.replace("\u00a0", " "))
    for source, target in PUA_MAP.items():
        text = text.replace(source, target)
    text = text.replace("\ufffd", "")
    text = text.replace("ํา", "ำ")
    text = text.replace("ุผู้", "ผู้")
    text = SPACE_RE.sub(" ", text).strip()
    text = re.sub(r"\s+([ฯ,;:!?])", r"\1", text)
    text = re.sub(r"([([])\s+", r"\1", text)
    return unicodedata.normalize("NFC", text)


def extract_page_text(pdf_path: Path, pdf_page: int) -> str:
    try:
        return subprocess.check_output(
            ["pdftotext", "-f", str(pdf_page), "-l", str(pdf_page), "-layout", str(pdf_path), "-"],
            text=True,
            stderr=subprocess.PIPE,
        )
    except FileNotFoundError as exc:
        raise SystemExit("Missing dependency: pdftotext. Install Poppler first.") from exc


def split_main_and_footnotes(raw_text: str) -> tuple[list[str], list[str], dict[str, int]]:
    raw_lines = raw_text.replace("\f", "").splitlines()
    main_lines: list[str] = []
    footnote_lines: list[str] = []
    in_footnotes = False
    skipped = {"headers": 0, "decorations": 0, "blank": 0}

    for index, raw_line in enumerate(raw_lines):
        line = normalize_pdf_text(raw_line)
        if not line:
            skipped["blank"] += 1
            continue
        if HEADER_RE.match(line):
            skipped["headers"] += 1
            continue
        if DECORATION_RE.match(line):
            skipped["decorations"] += 1
            continue
        if not in_footnotes and FOOTNOTE_START_RE.match(line) and index >= 12 and len(main_lines) >= 3:
            in_footnotes = True

        if in_footnotes:
            footnote_lines.append(line)
        else:
            main_lines.append(line)

    return main_lines, footnote_lines, skipped


def page_report(lines: list[str]) -> dict[str, Any]:
    text = "\n".join(lines)
    pua = sorted({char for char in text if "\ue000" <= char <= "\uf8ff"})
    return {
        "lineCount": len(lines),
        "replacementChars": text.count("\ufffd"),
        "remainingPua": [{"char": char, "codepoint": f"U+{ord(char):04X}"} for char in pua],
    }


def build_corpus(
    pdf_path: Path,
    *,
    content_from_page: int = 5,
    content_to_page: int = 217,
    book_page_offset: int = 2,
    max_pages: int | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    last_pdf_page = content_to_page
    if max_pages:
        last_pdf_page = min(last_pdf_page, content_from_page + max_pages - 1)

    chapter_id = f"{CORPUS_ID}-yamaka"
    corpus: dict[str, Any] = {
        "schema": "paligo.corpus.v1",
        "corpusId": CORPUS_ID,
        "title": "พระธัมมปทัฏฐกถาแปล ภาค ๑ (แปลโดยอรรถ · prototype)",
        "grade": "ป.ธ. ๔",
        "subjectHint": "pali-to-thai",
        "sourceType": "pdf-meaning-thai",
        "languageToggle": True,
        "sourceArtifacts": {
            "sourceFile": str(pdf_path),
            "contentPdfPages": [content_from_page, last_pdf_page],
            "bookPageOffset": book_page_offset,
            "legacyPuaMap": {f"U+{ord(source):04X}": target for source, target in PUA_MAP.items()},
        },
        "chapters": [
            {
                "chapterId": chapter_id,
                "itemId": chapter_id,
                "itemType": "chapter",
                "title": "ยมกวรรค วรรณนา",
                "sourceFile": pdf_path.name,
                "sourcePages": [content_from_page - book_page_offset, last_pdf_page - book_page_offset],
            }
        ],
        "items": [],
    }
    audit_pages: list[dict[str, Any]] = []
    totals = {"mainLineCount": 0, "footnoteLineCount": 0, "replacementChars": 0, "remainingPuaCount": 0}

    for pdf_page in range(content_from_page, last_pdf_page + 1):
        book_page = pdf_page - book_page_offset
        main_lines, footnote_lines, skipped = split_main_and_footnotes(extract_page_text(pdf_path, pdf_page))
        page_item_id = f"{CORPUS_ID}-p{book_page:04d}"
        children = []
        for index, line in enumerate(main_lines, start=1):
            children.append(
                {
                    "itemId": f"{page_item_id}-l{index:03d}",
                    "chapterId": chapter_id,
                    "parentItemId": page_item_id,
                    "itemType": "sentence",
                    "itemNo": index,
                    "sourcePage": book_page,
                    "sourcePageLabel": to_thai_digits(book_page),
                    "pdfPage": pdf_page,
                    "thai": line,
                    "thaiMeaning": line,
                    "thaiLiteral": "",
                    "pali": "",
                }
            )
        page_text = "\n".join(main_lines)
        corpus["items"].append(
            {
                "itemId": page_item_id,
                "chapterId": chapter_id,
                "itemType": "page",
                "itemNo": book_page,
                "sourcePage": book_page,
                "sourcePageLabel": to_thai_digits(book_page),
                "pdfPage": pdf_page,
                "title": f"พระธัมมปทัฏฐกถาแปล ภาค ๑ หน้า {to_thai_digits(book_page)}",
                "thai": page_text,
                "thaiMeaning": page_text,
                "thaiLiteral": "",
                "pali": "",
                "rawText": page_text,
                "text": page_text,
                "footnotes": footnote_lines,
                "children": children,
            }
        )
        audit = page_report(main_lines + footnote_lines)
        audit_pages.append(
            {
                "pdfPage": pdf_page,
                "sourcePage": book_page,
                "sourcePageLabel": to_thai_digits(book_page),
                "mainLineCount": len(main_lines),
                "footnoteLineCount": len(footnote_lines),
                "skipped": skipped,
                **audit,
            }
        )
        totals["mainLineCount"] += len(main_lines)
        totals["footnoteLineCount"] += len(footnote_lines)
        totals["replacementChars"] += audit["replacementChars"]
        totals["remainingPuaCount"] += len(audit["remainingPua"])

    report = {
        "schema": "paligo.meaning-thai-pdf-quality-report.v1",
        "corpusId": CORPUS_ID,
        "title": corpus["title"],
        "pageCount": len(corpus["items"]),
        "sourceArtifacts": corpus["sourceArtifacts"],
        "totals": totals,
        "pages": audit_pages,
    }
    return corpus, report


def write_outputs(corpus: dict[str, Any], report: dict[str, Any], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    corpus_path = out_dir / "corpus.json"
    manifest_path = out_dir / "manifest.json"
    report_path = out_dir / "quality-report.json"
    corpus_path.write_text(json.dumps(corpus, ensure_ascii=False, indent=2), encoding="utf-8")
    manifest = {
        "schema": "paligo.corpus-manifest.v1",
        "title": corpus["title"],
        "grade": corpus["grade"],
        "corpus": "corpus.json",
        "defaultDisplayMode": "page",
        "subjectHint": "pali-to-thai",
        "languageToggle": True,
        "defaultLanguageVisibility": "thaiMeaning",
        "audioAlignment": "",
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {corpus_path}")
    print(f"Wrote {manifest_path}")
    print(f"Wrote {report_path}")
    print(
        "Summary: "
        f"{report['pageCount']} pages, "
        f"{report['totals']['mainLineCount']} main lines, "
        f"{report['totals']['footnoteLineCount']} footnote lines, "
        f"{report['totals']['replacementChars']} replacement chars, "
        f"{report['totals']['remainingPuaCount']} pages with PUA"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Build idiomatic Thai Dhammapada corpus prototype from PDF.")
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--content-from-page", type=int, default=5)
    parser.add_argument("--content-to-page", type=int, default=217)
    parser.add_argument("--book-page-offset", type=int, default=2)
    parser.add_argument("--max-pages", type=int, default=None)
    args = parser.parse_args()

    if not args.pdf.exists():
        raise SystemExit(f"PDF not found: {args.pdf}")

    corpus, report = build_corpus(
        args.pdf,
        content_from_page=args.content_from_page,
        content_to_page=args.content_to_page,
        book_page_offset=args.book_page_offset,
        max_pages=args.max_pages,
    )
    write_outputs(corpus, report, args.out_dir)


if __name__ == "__main__":
    main()

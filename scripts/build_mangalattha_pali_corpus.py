#!/usr/bin/env python3
"""Build a Paligo corpus JSON from the Mangalattha Pali source PDF.

This corpus is for exam reference and translation practice. The source starts
from the first lesson page, and section markers are bracketed kho numbers such
as [๔].
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path


DEFAULT_PDF = Path(
    "/Users/iworn/Documents/Claude/Projects/PaliGo/Knowledge-Base/PT4/"
    "มังคลัตถทีปนีบาลี (ปฐโม ภาโค) วิชาแปล-กลับ/"
    "มังคลัตถทีปนีบาลี (ปฐโม ภาโค).pdf"
)

CORPUS_ID = "mangalattha-pali-pt4-pathamo"
THAI_DIGITS = str.maketrans("0123456789", "๐๑๒๓๔๕๖๗๘๙")
THAI_DIGIT_VALUES = {char: str(index) for index, char in enumerate("๐๑๒๓๔๕๖๗๘๙")}
SPACE_RE = re.compile(r"[ \t]+")
PAGE_COUNT_RE = re.compile(r"^Pages:\s+(\d+)", re.MULTILINE)
KHO_MARKER_RE = re.compile(r"^\s*\[([๐-๙0-9]+)\]\s*(.*)$")
INLINE_KHO_MARKER_RE = re.compile(r"(?=\[[๐-๙0-9]+\])")
PDF_HEADER_RE = re.compile(r"^ประโยค[๐-๙0-9]+\s*-\s*.*หน[้]า")
FOOTNOTE_LINE_RE = re.compile(r"^([๐-๙0-9]+)[.)]\s+(.+)$")
BARE_FOOTNOTE_REF_RE = re.compile(r"^[๐-๙0-9]+$")
TRAILING_FOOTNOTE_REF_RE = re.compile(r"^(.+?)\s+([๐-๙0-9]{1,2})$")


def to_thai_digits(value: int | str) -> str:
    return str(value).translate(THAI_DIGITS)


def normalize_kho_no(value: str) -> str:
    normalized = "".join(THAI_DIGIT_VALUES.get(char, char) for char in value)
    return str(int(normalized)) if normalized.isdigit() else normalized


def run_text(command: list[str]) -> str:
    result = subprocess.run(command, check=True, capture_output=True, text=True)
    return result.stdout


def pdf_page_count(pdf: Path) -> int:
    info = run_text(["pdfinfo", str(pdf)])
    match = PAGE_COUNT_RE.search(info)
    if not match:
        raise RuntimeError(f"Cannot read page count from {pdf}")
    return int(match.group(1))


def extract_page_lines(pdf: Path, page_no: int) -> list[str]:
    raw = run_text(["pdftotext", "-f", str(page_no), "-l", str(page_no), "-layout", str(pdf), "-"])
    lines: list[str] = []
    for line in raw.splitlines():
        clean = SPACE_RE.sub(" ", line).strip()
        if clean:
            lines.append(clean)
    return lines


def clean_pali_page_lines(raw_lines: list[str]) -> dict:
    """Return display-ready lines while preserving PDF artifacts separately."""
    cleaned: list[str] = []
    footnotes: list[dict] = []
    removed_headers: list[str] = []
    removed_refs: list[dict] = []
    joined_breaks: list[dict] = []
    pending_join = ""

    def append_segment(segment: str) -> None:
        nonlocal pending_join
        clean = segment.strip()
        if not clean:
            return
        if pending_join:
            if clean.startswith("["):
                cleaned.append(pending_join)
                pending_join = ""
                append_segment(clean)
                return
            original = f"{pending_join}-{clean}"
            clean = f"{pending_join}{clean}"
            joined_breaks.append({"from": original, "to": clean})
            pending_join = ""
        if clean.endswith("-") and len(clean) > 1 and not clean.endswith("--"):
            pending_join = clean[:-1]
            return
        cleaned.append(clean)

    for line in raw_lines:
        if PDF_HEADER_RE.match(line):
            removed_headers.append(line)
            continue
        if BARE_FOOTNOTE_REF_RE.match(line):
            footnotes.append({"ref": line, "text": "", "kind": "marker"})
            continue

        footnote = FOOTNOTE_LINE_RE.match(line)
        if footnote:
            footnotes.append({"ref": footnote.group(1), "text": footnote.group(2), "kind": "body"})
            continue

        ref = TRAILING_FOOTNOTE_REF_RE.match(line)
        if ref and not line.rstrip().endswith("]"):
            line = ref.group(1).rstrip()
            removed_refs.append({"ref": ref.group(2), "from": ref.group(0), "to": line})

        for segment in INLINE_KHO_MARKER_RE.split(line):
            append_segment(segment)

    if pending_join:
        cleaned.append(pending_join)

    visible_lines: list[str] = []
    for line in cleaned:
        if BARE_FOOTNOTE_REF_RE.match(line):
            footnotes.append({"ref": line, "text": "", "kind": "marker"})
            continue
        ref = TRAILING_FOOTNOTE_REF_RE.match(line)
        if ref and not line.rstrip().endswith("]"):
            line = ref.group(1).rstrip()
            removed_refs.append({"ref": ref.group(2), "from": ref.group(0), "to": line})
        visible_lines.append(line)

    return {
        "lines": visible_lines,
        "footnotes": footnotes,
        "sourceArtifacts": {
            "removedHeaders": removed_headers,
            "removedFootnoteRefs": removed_refs,
            "joinedLineBreaks": joined_breaks,
        },
    }


def make_line_item(chapter_id: str, page_item_id: str, page_no: int, index: int, text: str) -> dict:
    return {
        "itemId": f"{page_item_id}-l{index:03d}",
        "chapterId": chapter_id,
        "parentItemId": page_item_id,
        "itemType": "sentence",
        "itemNo": index,
        "sourcePage": page_no,
        "sourcePageLabel": to_thai_digits(page_no),
        "pali": text,
        "thaiLiteral": "",
        "thaiMeaning": "",
    }


def build_corpus(pdf_path: Path, *, max_pages: int | None = None) -> dict:
    page_count = pdf_page_count(pdf_path)
    if max_pages:
        page_count = min(page_count, max_pages)

    chapter_id = f"{CORPUS_ID}-chapter-main"
    corpus = {
        "schema": "paligo.corpus.v1",
        "corpusId": CORPUS_ID,
        "title": "มังคลัตถทีปนีบาลี (ปฐโม ภาโค)",
        "grade": "ป.ธ. ๔",
        "sourceType": "pdf-text-layer",
        "itemConventions": {
            "itemId": "id หลักของหน่วยเรียน ใช้ในระบบทุกที่",
            "chapterId": "id ของกลุ่ม/บท/ข้อใหญ่ที่ item นั้นสังกัด",
            "itemType": "ชนิดของ item เช่น chapter, kho, sentence, page",
        },
        "chapters": [
            {
                "chapterId": chapter_id,
                "itemId": chapter_id,
                "itemType": "chapter",
                "title": "ปฐโม ภาโค",
                "sourceFile": pdf_path.name,
                "sourcePages": [1, page_count],
            }
        ],
        "items": [],
    }

    kho_items: list[dict] = []
    active_kho: dict | None = None
    last_kho_no_int = 0

    for page_no in range(1, page_count + 1):
        raw_lines = extract_page_lines(pdf_path, page_no)
        clean_page = clean_pali_page_lines(raw_lines)
        lines = clean_page["lines"]
        page_item_id = f"{CORPUS_ID}-p{page_no:04d}"
        page_children = [
            make_line_item(chapter_id, page_item_id, page_no, index, line)
            for index, line in enumerate(lines, start=1)
        ]

        corpus["items"].append(
            {
                "itemId": page_item_id,
                "chapterId": chapter_id,
                "itemType": "page",
                "itemNo": page_no,
                "sourcePage": page_no,
                "sourcePageLabel": to_thai_digits(page_no),
                "title": f"มังคลัตถทีปนีบาลี หน้า {to_thai_digits(page_no)}",
                "rawText": "\n".join(raw_lines),
                "text": "\n".join(lines),
                "footnotes": clean_page["footnotes"],
                "sourceArtifacts": clean_page["sourceArtifacts"],
                "children": page_children,
            }
        )

        for line in lines:
            marker = KHO_MARKER_RE.match(line)
            if marker:
                kho_no_raw = marker.group(1)
                kho_no = normalize_kho_no(kho_no_raw)
                kho_no_int = int(kho_no) if kho_no.isdigit() else None
                if kho_no_int is not None and kho_no_int <= last_kho_no_int:
                    continue
                if kho_no_int is not None:
                    last_kho_no_int = kho_no_int
                active_kho = {
                    "itemId": f"{CORPUS_ID}-kho-{int(kho_no):04d}" if kho_no.isdigit() else f"{CORPUS_ID}-kho-{kho_no}",
                    "chapterId": chapter_id,
                    "itemType": "kho",
                    "itemNo": int(kho_no) if kho_no.isdigit() else kho_no,
                    "khoNo": kho_no,
                    "khoLabel": f"[{to_thai_digits(kho_no)}]",
                    "sourcePage": page_no,
                    "sourcePageLabel": to_thai_digits(page_no),
                    "title": f"ข้อ [{to_thai_digits(kho_no)}]",
                    "lines": [],
                }
                kho_items.append(active_kho)

            if active_kho:
                active_kho["lines"].append(
                    {
                        "sourcePage": page_no,
                        "sourcePageLabel": to_thai_digits(page_no),
                        "text": line,
                    }
                )

    for kho in kho_items:
        kho["text"] = "\n".join(line["text"] for line in kho["lines"])

    corpus["items"].extend(kho_items)
    return corpus


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    parser.add_argument("--out-dir", type=Path, default=Path("data/corpora/mangalattha-pali-pathamo"))
    parser.add_argument("--max-pages", type=int, default=None)
    args = parser.parse_args()

    corpus = build_corpus(args.pdf, max_pages=args.max_pages)
    args.out_dir.mkdir(parents=True, exist_ok=True)
    corpus_path = args.out_dir / "corpus.json"
    manifest_path = args.out_dir / "manifest.json"
    corpus_path.write_text(json.dumps(corpus, ensure_ascii=False, indent=2), encoding="utf-8")
    manifest = {
        "schema": "paligo.corpus-manifest.v1",
        "title": corpus["title"],
        "grade": corpus["grade"],
        "corpus": "corpus.json",
        "defaultDisplayMode": "kho",
        "audioAlignment": "",
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {corpus_path}")
    print(f"Wrote {manifest_path}")


if __name__ == "__main__":
    main()

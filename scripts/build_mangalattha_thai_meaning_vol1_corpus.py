#!/usr/bin/env python3
"""Build the Plai Whisper Thai answer corpus for Mangalattha vol. 1.

The preferred PDF source is scanned/encoded in a way that can produce mojibake
from `pdftotext`. This builder refuses low-quality extraction instead of
shipping noisy suggestions. It can also build from a directory of clean
page-level `.txt`, `.md`, or `.html` files when OCR/text cleanup is available.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


CORPUS_ID = "mangalattha-thai-meaning-vol1"
TITLE = "มังคลัตถทีปนีแปล ภาค ๑ เล่ม ๑ (แปลโดยอรรถ)"
GRADE = "ป.ธ. ๔"
ANSWER_FOR_CORPUS_ID = "mangalattha-pali-pathamo"
DEFAULT_SOURCE_PDF = Path(
    "/Users/iworn/Documents/Claude/Projects/PaliGo/Knowledge-Base/pt4/"
    "มังคลัตถทีปนี ภาค1เล่ม1แปลโดยอรรถ/"
    "ภาค ๑ เล่ม ๑ แปลโดยอรรถ (ไทย-บาลี).pdf"
)
DEFAULT_OUT_DIR = Path("data/corpora/mangalattha-thai-meaning-vol1")

THAI_DIGITS = str.maketrans("0123456789", "๐๑๒๓๔๕๖๗๘๙")
PAGE_COUNT_RE = re.compile(r"^Pages:\s+(\d+)", re.MULTILINE)
SPACE_RE = re.compile(r"[ \t]+")
HTML_TAG_RE = re.compile(r"<[^>]+>")
ASCII_WORD_RE = re.compile(r"[A-Za-z]{3,}")
THAI_CHAR_RE = re.compile(r"[\u0e00-\u0e7f]")
LINE_SPLIT_RE = re.compile(r"[\r\n]+")
PAGE_NUMBER_RE = re.compile(r"^(?:หน้า\s*)?[๐-๙0-9]+$")
DECORATION_RE = re.compile(r"^[.\-–—_•·\s]{6,}$")
HEADER_RE = re.compile(r"^(มังคลัตถทีปนี|ภาค\s*๑|เล่ม\s*๑|แปลโดยอรรถ)")


@dataclass
class PageCandidate:
    source_page: int
    text: str
    source_file: str
    quality: dict


def to_thai_digits(value: int | str) -> str:
    return str(value).translate(THAI_DIGITS)


def run_text(command: list[str]) -> str:
    result = subprocess.run(command, check=True, capture_output=True, text=True)
    return result.stdout


def pdf_page_count(pdf: Path) -> int:
    info = run_text(["pdfinfo", str(pdf)])
    match = PAGE_COUNT_RE.search(info)
    if not match:
        raise RuntimeError(f"Cannot read page count from {pdf}")
    return int(match.group(1))


def extract_pdf_page(pdf: Path, page_no: int) -> str:
    return run_text(["pdftotext", "-f", str(page_no), "-l", str(page_no), "-layout", str(pdf), "-"])


def read_text_file(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    if path.suffix.lower() in {".html", ".htm"}:
        text = HTML_TAG_RE.sub("\n", text)
        text = html.unescape(text)
    return text


def clean_line(line: str) -> str:
    clean = "".join(char for char in line if char == " " or ord(char) >= 32)
    clean = SPACE_RE.sub(" ", clean).strip()
    clean = clean.replace("\u200b", "").replace("\ufeff", "")
    clean = clean.replace("�้ำ", "้ำ").replace("�ำ", "ำ").replace("�า", "ำ").replace("ำ�", "ำ")
    clean = clean.replace("�", "")
    clean = re.sub(r"([ก-ฮ])\s+([ัิีึืุู็่้๊๋์ํ])", r"\1\2", clean)
    clean = re.sub(r"([ัิีึืุู็่้๊๋์ํ])\s+([ก-ฮ])", r"\1\2", clean)
    return clean


def clean_text(raw_text: str) -> str:
    lines: list[str] = []
    for raw_line in LINE_SPLIT_RE.split(raw_text):
        line = clean_line(raw_line)
        if not line or PAGE_NUMBER_RE.match(line) or DECORATION_RE.match(line) or HEADER_RE.match(line):
            continue
        lines.append(line)
    return "\n".join(lines).strip()


def assess_quality(text: str) -> dict:
    total_chars = len(text)
    thai_chars = len(THAI_CHAR_RE.findall(text))
    ascii_words = len(ASCII_WORD_RE.findall(text))
    lines = [line for line in text.splitlines() if line.strip()]
    thai_ratio = thai_chars / total_chars if total_chars else 0
    ascii_word_ratio = ascii_words / max(len(lines), 1)
    return {
        "totalChars": total_chars,
        "thaiChars": thai_chars,
        "thaiRatio": round(thai_ratio, 4),
        "asciiWordRatio": round(ascii_word_ratio, 4),
        "lineCount": len(lines),
        "passes": total_chars >= 160 and thai_ratio >= 0.55 and ascii_word_ratio <= 1.25,
    }


def numeric_stem(path: Path) -> int | None:
    match = re.search(r"(\d+|[๐-๙]+)", path.stem)
    if not match:
        return None
    digits = match.group(1).translate(str.maketrans("๐๑๒๓๔๕๖๗๘๙", "0123456789"))
    return int(digits)


def load_from_text_dir(source_text_dir: Path, *, max_pages: int | None) -> list[PageCandidate]:
    files = sorted(
        [
            path
            for path in source_text_dir.iterdir()
            if path.is_file() and path.suffix.lower() in {".txt", ".md", ".html", ".htm"}
        ],
        key=lambda path: (numeric_stem(path) is None, numeric_stem(path) or 0, path.name),
    )
    if max_pages:
        files = files[:max_pages]
    pages: list[PageCandidate] = []
    for index, path in enumerate(files, start=1):
        page_no = numeric_stem(path) or index
        text = clean_text(read_text_file(path))
        pages.append(PageCandidate(page_no, text, path.name, assess_quality(text)))
    return pages


def load_from_pdf(source_pdf: Path, *, max_pages: int | None) -> list[PageCandidate]:
    page_count = pdf_page_count(source_pdf)
    if max_pages:
        page_count = min(page_count, max_pages)
    pages: list[PageCandidate] = []
    for page_no in range(1, page_count + 1):
        text = clean_text(extract_pdf_page(source_pdf, page_no))
        pages.append(PageCandidate(page_no, text, source_pdf.name, assess_quality(text)))
    return pages


def build_corpus(pages: list[PageCandidate]) -> dict:
    items = []
    usable_pages = [page for page in pages if page.quality["passes"]]
    for page in usable_pages:
        lines = [line for line in page.text.splitlines() if line.strip()]
        children = [
            {
                "itemId": f"{CORPUS_ID}-p{page.source_page:04d}-l{line_no:03d}",
                "parentItemId": f"{CORPUS_ID}-p{page.source_page:04d}",
                "chapterId": f"{CORPUS_ID}-chapter-main",
                "itemType": "line",
                "itemNo": line_no,
                "sourcePage": page.source_page,
                "sourcePageLabel": to_thai_digits(page.source_page),
                "text": line,
                "thaiMeaning": line,
            }
            for line_no, line in enumerate(lines, start=1)
        ]
        items.append(
            {
                "itemId": f"{CORPUS_ID}-p{page.source_page:04d}",
                "chapterId": f"{CORPUS_ID}-chapter-main",
                "itemType": "page",
                "itemNo": page.source_page,
                "sourcePage": page.source_page,
                "sourcePageLabel": to_thai_digits(page.source_page),
                "title": f"{TITLE} หน้า {to_thai_digits(page.source_page)}",
                "text": page.text,
                "thaiMeaning": page.text,
                "sourceArtifacts": {
                    "sourceFile": page.source_file,
                    "quality": page.quality,
                },
                "children": children,
            }
        )

    return {
        "schema": "paligo.corpus.v1",
        "corpusId": CORPUS_ID,
        "title": TITLE,
        "grade": GRADE,
        "subjectHint": "pali-to-thai",
        "sourceType": "page-text",
        "answerForCorpusId": ANSWER_FOR_CORPUS_ID,
        "qualityGate": {
            "status": "pass" if items else "blocked",
            "rule": "Each page must have >=160 chars, Thai char ratio >=0.55, and low ASCII-word noise.",
            "pagesScanned": len(pages),
            "pagesAccepted": len(items),
            "pagesRejected": len(pages) - len(items),
        },
        "chapters": [
            {
                "chapterId": f"{CORPUS_ID}-chapter-main",
                "itemId": f"{CORPUS_ID}-chapter-main",
                "itemType": "chapter",
                "title": TITLE,
                "sourcePages": [
                    min((page.source_page for page in items), default=0),
                    max((page.source_page for page in items), default=0),
                ],
            }
        ],
        "items": items,
    }


def write_outputs(corpus: dict, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest = {
        "schema": "paligo.corpus-manifest.v1",
        "title": corpus["title"],
        "grade": corpus["grade"],
        "corpus": "corpus.json",
        "defaultDisplayMode": "page",
        "subjectHint": corpus["subjectHint"],
        "answerForCorpusId": corpus["answerForCorpusId"],
        "qualityGate": corpus["qualityGate"],
        "audioAlignment": "",
    }
    (out_dir / "corpus.json").write_text(json.dumps(corpus, ensure_ascii=False, indent=2), encoding="utf-8")
    (out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-pdf", type=Path, default=DEFAULT_SOURCE_PDF)
    parser.add_argument("--source-text-dir", type=Path, default=None)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    parser.add_argument("--max-pages", type=int, default=None)
    parser.add_argument("--allow-empty", action="store_true")
    args = parser.parse_args()

    if args.source_text_dir:
        pages = load_from_text_dir(args.source_text_dir, max_pages=args.max_pages)
        source_note = f"text dir: {args.source_text_dir}"
    else:
        pages = load_from_pdf(args.source_pdf, max_pages=args.max_pages)
        source_note = f"pdf text layer: {args.source_pdf}"

    corpus = build_corpus(pages)
    gate = corpus["qualityGate"]
    print(f"Source: {source_note}")
    print(f"Quality: {gate['status']} ({gate['pagesAccepted']}/{gate['pagesScanned']} pages accepted)")
    if gate["status"] != "pass" and not args.allow_empty:
        print("Refusing success: source text is not clean enough for Plai Whisper suggestions.", file=sys.stderr)
        return 2
    write_outputs(corpus, args.out_dir)
    print(f"Wrote {args.out_dir / 'corpus.json'}")
    print(f"Wrote {args.out_dir / 'manifest.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

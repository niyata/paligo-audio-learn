#!/usr/bin/env python3
"""Build a Paligo corpus JSON from local Mangalattha PDF files.

This pass derives clean reading pages for translation practice. It preserves
raw PDF text, but hides front matter, PDF headers/footers, decoration lines,
and common text-layer artifacts from display text.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path


DEFAULT_SOURCE = Path(
    "/Users/iworn/Documents/Claude/Projects/PaliGo/Knowledge-Base/PT4/"
    "มังคลัตถทีปนี-ภาค1-เล่ม1-2ยกศัพท์"
)

PDFS = [
    {
        "volume": "vol1",
        "title": "มังคลัตถทีปนีแปล ภาค ๑ เล่ม ๑",
        "filename": "มังคลทีปนีแปล-ภาค-1-เล่ม-1-บีบอัด.pdf",
    },
    {
        "volume": "vol2",
        "title": "มังคลัตถทีปนีแปล ภาค ๑ เล่ม ๒",
        "filename": "มังคลทีปนีแปล-ภาค-1-เล่ม-2-บีบอัด.pdf",
    },
    {
        "volume": "vol3",
        "title": "มังคลัตถทีปนีแปล ภาค ๑ เล่ม ๓",
        "filename": "มังคลทีปนีแปล-ภาค-1-เล่ม-3-บีบอัด.pdf",
    },
]

THAI_DIGITS = str.maketrans("0123456789", "๐๑๒๓๔๕๖๗๘๙")
SPACE_RE = re.compile(r"[ \t]+")
PAGE_COUNT_RE = re.compile(r"^Pages:\s+(\d+)", re.MULTILINE)
SENTENCE_SPLIT_RE = re.compile(r"(?<=ฯ)\s+")
LESSON_START_PAGE = 61
EXCLUDE_PAGE_START_RE = re.compile(r"^(บรรณานุกรม|ประวัติผู้แปล)\s*$")
PAGE_HEADER_RE = re.compile(
    r"^(\d+\s+ภาค\s+๕|\d+\s+มังคลัตถทีปนีแปล|โครงสร้างในมังคลัตถทีปนี\s*\(\d+\)|\(\d+\)\s+มังคลัตถทีปนีแปล)"
)
FRONT_MARKER_RE = re.compile(r"^\([ก-ฮ]\)$")
DECORATION_RE = re.compile(r"^[.\-–—_]{6,}$")
TOC_LEADER_RE = re.compile(r"\.{4,}")
MOJIBAKE_RE = re.compile(r"[\x80-\xff]")


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


def extract_page_text(pdf: Path, page_no: int) -> str:
    raw = run_text(["pdftotext", "-f", str(page_no), "-l", str(page_no), "-layout", str(pdf), "-"])
    lines = []
    for line in raw.splitlines():
        clean = clean_pdf_line(line)
        if clean:
            lines.append(clean)
    return "\n".join(lines).strip()


def clean_pdf_line(line: str) -> str:
    clean = "".join(char for char in line if char == "\t" or char == " " or ord(char) >= 32)
    clean = SPACE_RE.sub(" ", clean).strip()
    clean = clean.replace("�้ำ", "้ำ").replace("�ำ", "ำ").replace("�า", "ำ").replace("ำ�", "ำ")
    clean = clean.replace("�", "")
    clean = clean.replace("นั ้", "นั้").replace("ทั ้", "ทั้").replace("ฉะนั ้น", "ฉะนั้น")
    clean = clean.replace("เป็ น", "เป็น").replace("ม ี", "มี")
    clean = re.sub(r"([ก-ฮ])\s+([ัิีึืุู็่้๊๋์ํ])", r"\1\2", clean)
    clean = re.sub(r"([ัิีึืุู็่้๊๋์ํ])\s+([ก-ฮ])", r"\1\2", clean)
    return clean


def is_garbage_line(line: str) -> bool:
    if not line:
        return True
    if FRONT_MARKER_RE.match(line) or DECORATION_RE.match(line) or PAGE_HEADER_RE.match(line) or TOC_LEADER_RE.search(line):
        return True
    if len(MOJIBAKE_RE.findall(line)) >= 3:
        return True
    thai_or_pali = sum(1 for char in line if "\u0e00" <= char <= "\u0e7f" or "\uf700" <= char <= "\uf8ff")
    ascii_noise = sum(1 for char in line if char.isascii() and not char.isalnum() and not char.isspace())
    return thai_or_pali == 0 and ascii_noise >= 4


def clean_page_text(raw_text: str) -> dict:
    raw_lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    if raw_lines and EXCLUDE_PAGE_START_RE.match(raw_lines[0]):
        return {
            "text": "",
            "removedLines": raw_lines,
            "excluded": True,
        }
    lines: list[str] = []
    removed: list[str] = []
    for line in raw_lines:
        if is_garbage_line(line):
            removed.append(line)
            continue
        lines.append(line)
    return {
        "text": "\n".join(lines).strip(),
        "removedLines": removed,
        "excluded": False,
    }


def split_sentences(text: str) -> list[str]:
    chunks: list[str] = []
    for paragraph in text.splitlines():
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        parts = [part.strip() for part in SENTENCE_SPLIT_RE.split(paragraph) if part.strip()]
        chunks.extend(parts or [paragraph])
    return chunks


def build_corpus(source_dir: Path, *, max_pages: int | None = None) -> dict:
    corpus_id = "mangalattha-pt4-part1"
    corpus = {
        "schema": "paligo.corpus.v1",
        "corpusId": corpus_id,
        "title": "มังคลัตถทีปนี ภาค ๑",
        "grade": "ป.ธ. ๔",
        "sourceType": "pdf-text-layer",
        "itemConventions": {
            "itemId": "id หลักของหน่วยเรียน ใช้ในระบบทุกที่",
            "chapterId": "id ของกลุ่ม/บท/ข้อใหญ่ที่ item นั้นสังกัด",
            "itemType": "ชนิดของ item เช่น chapter, kho, sentence, page",
        },
        "chapters": [],
        "items": [],
    }

    for pdf_meta in PDFS:
        pdf_path = source_dir / pdf_meta["filename"]
        page_count = pdf_page_count(pdf_path)
        if max_pages:
            page_count = min(page_count, max_pages)

        volume = pdf_meta["volume"]
        chapter_id = f"{corpus_id}-{volume}"
        corpus["chapters"].append(
            {
                "chapterId": chapter_id,
                "itemId": chapter_id,
                "itemType": "chapter",
                "title": pdf_meta["title"],
                "volume": volume,
                "sourceFile": pdf_meta["filename"],
                "sourcePages": [1, page_count],
            }
        )

        for page_no in range(LESSON_START_PAGE, page_count + 1):
            raw_text = extract_page_text(pdf_path, page_no)
            clean_page = clean_page_text(raw_text)
            text = clean_page["text"]
            if clean_page["excluded"] or not text:
                continue
            page_item_id = f"{chapter_id}-p{page_no:04d}"
            sentences = split_sentences(text)
            children = []
            for index, sentence in enumerate(sentences, start=1):
                sentence_id = f"{page_item_id}-s{index:03d}"
                children.append(
                    {
                        "itemId": sentence_id,
                        "chapterId": chapter_id,
                        "parentItemId": page_item_id,
                        "itemType": "sentence",
                        "itemNo": index,
                        "sourcePage": page_no,
                        "sourcePageLabel": to_thai_digits(page_no),
                        "pali": sentence,
                        "thaiLiteral": "",
                        "thaiMeaning": "",
                    }
                )

            corpus["items"].append(
                {
                    "itemId": page_item_id,
                    "chapterId": chapter_id,
                    "itemType": "page",
                    "itemNo": page_no,
                    "sourcePage": page_no,
                    "sourcePageLabel": to_thai_digits(page_no),
                    "title": f"{pdf_meta['title']} หน้า {to_thai_digits(page_no)}",
                    "rawText": raw_text,
                    "text": text,
                    "sourceArtifacts": {
                        "removedLines": clean_page["removedLines"],
                        "hiddenFrontMatterBeforePage": LESSON_START_PAGE,
                    },
                    "children": children,
                }
            )

    return corpus


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--out-dir", type=Path, default=Path("data/corpora/mangalattha-pt4-part1"))
    parser.add_argument("--max-pages", type=int, default=None)
    args = parser.parse_args()

    corpus = build_corpus(args.source_dir, max_pages=args.max_pages)
    args.out_dir.mkdir(parents=True, exist_ok=True)
    corpus_path = args.out_dir / "corpus.json"
    manifest_path = args.out_dir / "manifest.json"
    corpus_path.write_text(json.dumps(corpus, ensure_ascii=False, indent=2), encoding="utf-8")
    manifest = {
        "schema": "paligo.corpus-manifest.v1",
        "title": corpus["title"],
        "grade": corpus["grade"],
        "corpus": "corpus.json",
        "defaultDisplayMode": "page",
        "audioAlignment": "",
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {corpus_path}")
    print(f"Wrote {manifest_path}")


if __name__ == "__main__":
    main()

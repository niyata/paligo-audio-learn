#!/usr/bin/env python3
"""Build a Paligo bilingual corpus from Dhammapadatthakatha Part 1 (Thai–Pali).

Source layout: Thai on the left, Pali on the right.
PDF page 10 == printed book page ๓ (offset 7).

Example:
  python3 scripts/build_dhammapada_bilingual_corpus.py \\
    --pdf "/Users/iworn/Documents/Claude/Projects/PaliGo/Knowledge-Base/pt4/ธรรมบทภาค1-ฉบับ2ภาษา/ธัมมปทัฏฐกถา-ภาคที่ 1 สองภาษา.pdf" \\
    --out-dir data/corpora/dhammapadatthakatha-pt4-book1 \\
    --content-from-page 10 --book-page-offset 7
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from bilingual_pdf_lib import extract_bilingual_page, to_thai_digits  # noqa: E402

DEFAULT_PDF = Path(
    "/Users/iworn/Documents/Claude/Projects/PaliGo/Knowledge-Base/pt4/"
    "ธรรมบทภาค1-ฉบับ2ภาษา/ธัมมปทัฏฐกถา-ภาคที่ 1 สองภาษา.pdf"
)
CORPUS_ID = "dhammapadatthakatha-pt4-book1"
DEFAULT_OUT = Path("data/corpora/dhammapadatthakatha-pt4-book1")


def ensure_pdfplumber():
    try:
        import pdfplumber  # noqa: F401

        return pdfplumber
    except ImportError:
        print("Missing dependency: pdfplumber", file=sys.stderr)
        print("Install with: python3 -m pip install pdfplumber", file=sys.stderr)
        sys.exit(1)


def build_corpus(
    pdf_path: Path,
    *,
    content_from_page: int = 10,
    book_page_offset: int = 7,
    max_pages: int | None = None,
    lang_split: str = "auto",
) -> dict:
    pdfplumber = ensure_pdfplumber()
    chapter_id = f"{CORPUS_ID}-yamaka"

    with pdfplumber.open(pdf_path) as pdf:
        last_pdf_page = len(pdf.pages)
        first = max(1, content_from_page)
        if max_pages:
            last_pdf_page = min(last_pdf_page, first + max_pages - 1)

        corpus = {
            "schema": "paligo.corpus.v1",
            "corpusId": CORPUS_ID,
            "title": "ธัมมปทัฏฐกถา ภาค ๑ (สองภาษา · แปลโดยพยัญชนะ)",
            "grade": "ป.ธ. ๔",
            "subjectHint": "thai-to-pali",
            "sourceType": "pdf-bilingual-columns",
            "itemConventions": {
                "itemId": "id หลักของหน่วยเรียน ใช้ในระบบทุกที่",
                "chapterId": "id ของกลุ่ม/บท/ข้อใหญ่ที่ item นั้นสังกัด",
                "itemType": "ชนิดของ item เช่น chapter, page, sentence",
            },
            "chapters": [
                {
                    "chapterId": chapter_id,
                    "itemId": chapter_id,
                    "itemType": "chapter",
                    "title": "ยมกวรรควัณณนา",
                    "sourceFile": pdf_path.name,
                    "sourcePages": [first - book_page_offset, last_pdf_page - book_page_offset],
                }
            ],
            "items": [],
        }

        for pdf_page in range(first, last_pdf_page + 1):
            page = pdf.pages[pdf_page - 1]
            book_page = pdf_page - book_page_offset
            bilingual = extract_bilingual_page(page, lang_split=lang_split)
            page_item_id = f"{CORPUS_ID}-p{book_page:04d}"
            children = []
            for index, pair in enumerate(bilingual["pairs"], start=1):
                children.append(
                    {
                        "itemId": f"{page_item_id}-s{index:03d}",
                        "chapterId": chapter_id,
                        "parentItemId": page_item_id,
                        "itemType": "sentence",
                        "itemNo": index,
                        "sourcePage": book_page,
                        "sourcePageLabel": to_thai_digits(book_page),
                        "pdfPage": pdf_page,
                        "thai": pair.get("thai") or "",
                        "pali": pair.get("pali") or "",
                        "thaiLiteral": pair.get("thai") or "",
                        "thaiMeaning": "",
                    }
                )

            corpus["items"].append(
                {
                    "itemId": page_item_id,
                    "chapterId": chapter_id,
                    "itemType": "page",
                    "itemNo": book_page,
                    "sourcePage": book_page,
                    "sourcePageLabel": to_thai_digits(book_page),
                    "pdfPage": pdf_page,
                    "title": f"ธัมมปทัฏฐกถา ภาค ๑ หน้า {to_thai_digits(book_page)}",
                    "thai": bilingual["thai"],
                    "pali": bilingual["pali"],
                    "rawText": bilingual["thai"] + "\n\n" + bilingual["pali"],
                    "text": bilingual["thai"],
                    "children": children,
                }
            )

    return corpus


def main() -> None:
    parser = argparse.ArgumentParser(description="Build Dhammapada bilingual corpus for thai-to-pali PiP.")
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--content-from-page", type=int, default=10)
    parser.add_argument("--book-page-offset", type=int, default=7)
    parser.add_argument("--max-pages", type=int, default=None)
    parser.add_argument("--lang-split", choices=("auto", "midpoint"), default="auto")
    args = parser.parse_args()

    if not args.pdf.exists():
        raise SystemExit(f"PDF not found: {args.pdf}")

    corpus = build_corpus(
        args.pdf,
        content_from_page=args.content_from_page,
        book_page_offset=args.book_page_offset,
        max_pages=args.max_pages,
        lang_split=args.lang_split,
    )
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
        "subjectHint": "thai-to-pali",
        "languageToggle": True,
        "defaultLanguageVisibility": "thai",
        "audioAlignment": "",
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    page_count = sum(1 for item in corpus["items"] if item.get("itemType") == "page")
    print(f"Wrote {corpus_path} ({page_count} pages)")
    print(f"Wrote {manifest_path}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Convert PDF book pages into positioned HTML that preserves layout.

Requires:
  python3 -m pip install pdfplumber

Optional (background images, closer to printed page):
  brew install poppler   # provides pdftoppm

Example:
  python3 scripts/pdf_to_book_html.py input.pdf output/book-html --from-page 1 --to-page 5
"""

from __future__ import annotations

import argparse
import html
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from book_verification_lib import (  # noqa: E402
    build_footnote_html,
    build_page_shell,
    default_verification,
    footnote_css,
    write_verification,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert PDF pages to positioned book HTML.")
    parser.add_argument("pdf_path", type=Path, help="Source PDF file")
    parser.add_argument("output_dir", type=Path, help="Output directory")
    parser.add_argument("--from-page", type=int, default=1, help="First page (1-based)")
    parser.add_argument("--to-page", type=int, default=0, help="Last page (1-based, 0 = all)")
    parser.add_argument("--book-id", default="", help="Book identifier for manifest")
    parser.add_argument("--title", default="", help="Book title for manifest")
    parser.add_argument("--with-background", action="store_true", help="Render PNG background via pdftoppm")
    return parser.parse_args()


def ensure_pdfplumber():
    try:
        import pdfplumber  # noqa: F401

        return pdfplumber
    except ImportError:
        print("Missing dependency: pdfplumber", file=sys.stderr)
        print("Install with: python3 -m pip install pdfplumber", file=sys.stderr)
        sys.exit(1)


def pct(value: float, total: float) -> float:
    if total <= 0:
        return 0.0
    return round((value / total) * 100, 4)


def render_backgrounds_pymupdf(
    pdf_path: Path, pages_dir: Path, page_numbers: list[int], dpi: int = 180
) -> dict[int, str]:
    try:
        import fitz
    except ImportError:
        return {}

    pages_dir.mkdir(parents=True, exist_ok=True)
    backgrounds: dict[int, str] = {}
    scale = dpi / 72.0
    matrix = fitz.Matrix(scale, scale)

    with fitz.open(pdf_path) as doc:
        for page_no in page_numbers:
            page = doc[page_no - 1]
            pixmap = page.get_pixmap(matrix=matrix, alpha=False)
            target = pages_dir / f"page-{page_no:04d}.png"
            pixmap.save(target)
            backgrounds[page_no] = f"pages/page-{page_no:04d}.png"

    return backgrounds


def render_backgrounds_pdftoppm(
    pdf_path: Path, pages_dir: Path, page_numbers: list[int]
) -> dict[int, str]:
    if not shutil.which("pdftoppm"):
        return {}

    pages_dir.mkdir(parents=True, exist_ok=True)
    backgrounds: dict[int, str] = {}

    for page_no in page_numbers:
        prefix = pages_dir / f"page-{page_no:04d}"
        cmd = [
            "pdftoppm",
            "-png",
            "-f",
            str(page_no),
            "-l",
            str(page_no),
            "-r",
            "180",
            str(pdf_path),
            str(prefix),
        ]
        subprocess.run(cmd, check=True, capture_output=True)
        generated_files = sorted(pages_dir.glob(f"page-{page_no:04d}-*.png"))
        target = pages_dir / f"page-{page_no:04d}.png"
        if generated_files:
            generated_files[0].replace(target)
            backgrounds[page_no] = f"pages/page-{page_no:04d}.png"

    return backgrounds


def render_backgrounds(pdf_path: Path, pages_dir: Path, page_numbers: list[int]) -> dict[int, str]:
    backgrounds = render_backgrounds_pdftoppm(pdf_path, pages_dir, page_numbers)
    if backgrounds:
        return backgrounds

    backgrounds = render_backgrounds_pymupdf(pdf_path, pages_dir, page_numbers)
    if backgrounds:
        print("Rendered backgrounds with PyMuPDF.", file=sys.stderr)
        return backgrounds

    print(
        "No background renderer found. Install poppler (pdftoppm) or PyMuPDF: "
        "python3 -m pip install pymupdf",
        file=sys.stderr,
    )
    return {}


def group_words_into_lines(words: list[dict], line_tolerance: float = 3.0) -> list[list[dict]]:
    if not words:
        return []

    sorted_words = sorted(words, key=lambda item: (round(item["top"], 1), item["x0"]))
    lines: list[list[dict]] = []
    current_line: list[dict] = []
    current_top: float | None = None

    for word in sorted_words:
        top = float(word["top"])
        if current_top is None or abs(top - current_top) <= line_tolerance:
            current_line.append(word)
            current_top = top if current_top is None else (current_top + top) / 2
            continue

        lines.append(current_line)
        current_line = [word]
        current_top = top

    if current_line:
        lines.append(current_line)

    return lines


def build_page_html(
    page_no: int,
    page_width: float,
    page_height: float,
    lines: list[list[dict]],
    background_path: str | None,
    book_id: str,
    token_count: int,
) -> str:
    spans: list[str] = []

    for line in lines:
        for word in line:
            text = html.escape(str(word.get("text") or "").strip())
            if not text:
                continue

            left = pct(float(word["x0"]), page_width)
            top = pct(float(word["top"]), page_height)
            width = pct(float(word["x1"]) - float(word["x0"]), page_width)
            height = pct(float(word["bottom"]) - float(word["top"]), page_height)
            font_size = max(8, round(float(word.get("height") or 12) * 0.92, 2))

            spans.append(
                f'<span class="book-token" style="left:{left}%;top:{top}%;width:{width}%;'
                f'height:{height}%;font-size:{font_size}px">{text}</span>'
            )

    background = (
        f'  <img class="book-page-bg" src="{html.escape(Path(background_path).name)}" alt="" decoding="async" />'
        if background_path
        else ""
    )
    body_html = f"""{background}
  <div class="book-page-text" aria-label="หน้า {page_no}">
    {"".join(spans)}
  </div>"""
    footnote_html = build_footnote_html(page_no, token_count, book_id, "pending")

    return build_page_shell(page_no, page_width, page_height, body_html, footnote_html)


def extract_source_text(lines: list[list[dict]]) -> str:
    words: list[str] = []
    for line in lines:
        for word in line:
            text = str(word.get("text") or "").strip()
            if text:
                words.append(text)
    return " ".join(words)


def write_assets(output_dir: Path) -> None:
    css = """/* Generated book page layout */
.book-page {
  aspect-ratio: var(--page-ratio, 540 / 756);
  background: #fffaf0;
  border: 1px solid rgba(74, 44, 10, 0.18);
  border-radius: 4px;
  box-shadow: 0 14px 34px rgba(74, 44, 10, 0.12);
  margin: 0 auto;
  max-width: min(100%, 760px);
  overflow: hidden;
  position: relative;
  width: 100%;
}

.book-page-bg {
  height: 100%;
  inset: 0;
  object-fit: fill;
  pointer-events: none;
  position: absolute;
  width: 100%;
  z-index: 0;
}

.book-page-text {
  inset: 0;
  position: absolute;
  z-index: 1;
}

.book-token {
  color: rgba(31, 45, 137, 0.01);
  line-height: 1;
  overflow: hidden;
  position: absolute;
  white-space: pre;
}

.book-page.has-background .book-token {
  color: transparent;
}

.book-page:not(.has-background) .book-token {
  color: rgba(31, 45, 137, 0.88);
}

.book-token:hover,
.book-token:focus-visible {
  background: rgba(255, 240, 168, 0.72);
  color: rgba(31, 45, 137, 0.96);
  outline: none;
  z-index: 2;
}
"""
    css += footnote_css()
    (output_dir / "book.css").write_text(css, encoding="utf-8")


def main() -> int:
    args = parse_args()
    pdfplumber = ensure_pdfplumber()

    if not args.pdf_path.exists():
        print(f"PDF not found: {args.pdf_path}", file=sys.stderr)
        return 1

    output_dir = args.output_dir
    pages_dir = output_dir / "pages"
    pages_dir.mkdir(parents=True, exist_ok=True)

    book_id = args.book_id or args.pdf_path.stem
    title = args.title or args.pdf_path.stem

    manifest_pages: list[dict] = []

    with pdfplumber.open(args.pdf_path) as pdf:
        last_page = args.to_page or len(pdf.pages)
        first_page = max(1, args.from_page)
        last_page = min(last_page, len(pdf.pages))
        page_numbers = list(range(first_page, last_page + 1))

        backgrounds = render_backgrounds(args.pdf_path, pages_dir, page_numbers) if args.with_background else {}

        for page_no in page_numbers:
            page = pdf.pages[page_no - 1]
            words = page.extract_words(use_text_flow=True, keep_blank_chars=False) or []
            lines = group_words_into_lines(words)
            background_path = backgrounds.get(page_no)
            token_count = sum(len(line) for line in lines)
            page_html = build_page_html(
                page_no, page.width, page.height, lines, background_path, book_id, token_count
            )
            page_file = pages_dir / f"page-{page_no:04d}.html"
            page_file.write_text(page_html, encoding="utf-8")

            manifest_pages.append(
                {
                    "page": page_no,
                    "html": f"pages/page-{page_no:04d}.html",
                    "background": background_path,
                    "width": round(page.width, 2),
                    "height": round(page.height, 2),
                    "tokenCount": token_count,
                    "sourceText": extract_source_text(lines),
                }
            )

    write_assets(output_dir)

    try:
        source_pdf_relative = os.path.relpath(args.pdf_path.resolve(), output_dir.resolve())
    except ValueError:
        source_pdf_relative = args.pdf_path.name

    manifest = {
        "schema": "paligo.bookHtmlExport.v1",
        "bookId": book_id,
        "title": title,
        "sourcePdf": args.pdf_path.name,
        "sourcePdfRelative": source_pdf_relative,
        "pageCount": len(manifest_pages),
        "pages": manifest_pages,
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    verification = default_verification(book_id, page_numbers)
    write_verification(output_dir / "verification.json", verification)

    print(f"Wrote {len(manifest_pages)} pages to {output_dir}")
    print("Open book-page-qa.html for PDF/HTML comparison and verification.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

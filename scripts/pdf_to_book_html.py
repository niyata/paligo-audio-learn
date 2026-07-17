#!/usr/bin/env python3
"""
Convert PDF book pages into positioned HTML that preserves layout.

Requires:
  python3 -m pip install pdfplumber

Optional (background images, closer to printed page):
  brew install poppler   # provides pdftoppm

Example:
  python3 scripts/pdf_to_book_html.py input.pdf output/book-html --from-page 1 --to-page 5

Bilingual Thai–Pali (left/right columns):
  python3 scripts/pdf_to_book_html.py book.pdf output/dhamma \\
    --bilingual-columns --content-from-page 10 --book-page-offset 7 \\
    --from-page 10 --to-page 12 --with-background
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

from audio_practice_lib import export_practice_packs, flatten_words  # noqa: E402
from bilingual_pdf_lib import (  # noqa: E402
    extract_bilingual_page,
    group_words_into_lines,
    normalize_thai_pdf_text,
)
from book_fonts import DEFAULT_FONT_STACK, build_font_face_css, copy_font_assets  # noqa: E402
from book_verification_lib import (  # noqa: E402
    build_footnote_html,
    build_page_shell,
    default_verification,
    footnote_css,
    to_thai_digits,
    write_verification,
)
from book_bundle_lib import export_book_bundle  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert PDF pages to positioned book HTML.")
    parser.add_argument("pdf_path", type=Path, help="Source PDF file")
    parser.add_argument("output_dir", type=Path, help="Output directory")
    parser.add_argument("--from-page", type=int, default=1, help="First page (1-based)")
    parser.add_argument("--to-page", type=int, default=0, help="Last page (1-based, 0 = all)")
    parser.add_argument("--book-id", default="", help="Book identifier for manifest")
    parser.add_argument("--title", default="", help="Book title for manifest")
    parser.add_argument("--with-background", action="store_true", help="Render PNG background via pdftoppm")
    parser.add_argument(
        "--bilingual-columns",
        action="store_true",
        help="Tag Thai (left) / Pali (right) tokens for language hide/show",
    )
    parser.add_argument(
        "--content-from-page",
        type=int,
        default=0,
        help="If set with --from-page default, clamp start to this PDF page",
    )
    parser.add_argument(
        "--book-page-offset",
        type=int,
        default=0,
        help="bookPage = pdfPage - offset (e.g. 7 when PDF 10 = book page 3)",
    )
    parser.add_argument(
        "--lang-split",
        choices=("auto", "midpoint"),
        default="auto",
        help="How to classify bilingual tokens (auto uses CordiaBalee vs CordiaNew)",
    )
    parser.add_argument(
        "--default-lang-visibility",
        choices=("both", "thai", "pali"),
        default="both",
        help="Initial hide class on bilingual pages",
    )
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


def build_page_html(
    page_no: int,
    page_width: float,
    page_height: float,
    lines: list[list[dict]],
    background_path: str | None,
    book_id: str,
    token_count: int,
    *,
    bilingual: bool = False,
    default_lang_visibility: str = "both",
    book_page: int | None = None,
) -> str:
    spans: list[str] = []

    for line in lines:
        for word in line:
            raw_text = normalize_thai_pdf_text(str(word.get("text") or ""))
            if not raw_text:
                continue

            text = html.escape(to_thai_digits(raw_text))

            left = pct(float(word["x0"]), page_width)
            top = pct(float(word["top"]), page_height)
            width = pct(float(word["x1"]) - float(word["x0"]), page_width)
            height = pct(float(word["bottom"]) - float(word["top"]), page_height)
            font_size = max(8, round(float(word.get("height") or 12) * 0.92, 2))
            lang = str(word.get("lang") or "").strip()
            lang_attr = f' data-lang="{html.escape(lang)}"' if bilingual and lang else ""

            spans.append(
                f'<span class="book-token"{lang_attr} style="left:{left}%;top:{top}%;width:{width}%;'
                f'height:{height}%;font-size:{font_size}px">{text}</span>'
            )

    background = (
        f'  <img class="book-page-bg" src="{html.escape(Path(background_path).name)}" alt="" decoding="async" />'
        if background_path
        else ""
    )
    masks = ""
    if bilingual and background_path:
        masks = """
  <div class="book-lang-mask book-lang-mask--thai" aria-hidden="true"></div>
  <div class="book-lang-mask book-lang-mask--pali" aria-hidden="true"></div>"""

    label_page = book_page if book_page is not None else page_no
    hide_class = ""
    if bilingual and default_lang_visibility == "thai":
        hide_class = " hide-pali"
    elif bilingual and default_lang_visibility == "pali":
        hide_class = " hide-thai"

    body_html = f"""{background}{masks}
  <div class="book-page-text" aria-label="หน้า {to_thai_digits(label_page)}">
    {"".join(spans)}
  </div>"""
    footnote_html = build_footnote_html(label_page, token_count, book_id, "pending")
    shell = build_page_shell(label_page, page_width, page_height, body_html, footnote_html)
    if bilingual or hide_class:
        # Inject bilingual classes onto the root .book-page element.
        shell = shell.replace(
            'class="book-page',
            f'class="book-page{" bilingual" if bilingual else ""}{hide_class}',
            1,
        )
    return shell


def extract_source_text(lines: list[list[dict]]) -> str:
    words: list[str] = []
    for line in lines:
        for word in line:
            text = normalize_thai_pdf_text(str(word.get("text") or ""))
            if text:
                words.append(to_thai_digits(text))
    return " ".join(words)


def write_assets(output_dir: Path, *, bilingual: bool = False) -> None:
    repo_root = Path(__file__).resolve().parent.parent
    copy_font_assets(repo_root, output_dir)
    font_face = build_font_face_css(output_dir)

    css = font_face + f""".book-page {{
  --book-font-family: {DEFAULT_FONT_STACK};
  --book-font-scale: 1;
  aspect-ratio: var(--page-ratio, 540 / 756);
  background: #fffaf0;
  border: 1px solid rgba(74, 44, 10, 0.18);
  border-radius: 4px;
  box-shadow: 0 14px 34px rgba(74, 44, 10, 0.12);
  font-family: var(--book-font-family);
  margin: 0 auto;
  max-width: min(100%, 760px);
  overflow: hidden;
  position: relative;
  width: 100%;
}}

.book-page-bg {{
  height: 100%;
  inset: 0;
  object-fit: fill;
  pointer-events: none;
  position: absolute;
  width: 100%;
  z-index: 0;
}}

.book-page-text {{
  inset: 0;
  position: absolute;
  z-index: 1;
}}

.book-token {{
  color: rgba(31, 45, 137, 0.01);
  font-family: inherit;
  line-height: 1;
  overflow: hidden;
  position: absolute;
  white-space: pre;
}}

.book-page.has-background .book-token {{
  color: transparent;
}}

.book-page:not(.has-background) .book-token {{
  color: #1f2d89;
}}

.book-token:hover,
.book-token:focus-visible {{
  background: rgba(255, 240, 168, 0.72);
  color: rgba(31, 45, 137, 0.96);
  outline: none;
  z-index: 2;
}}

.book-lang-mask {{
  background: #fffaf0;
  bottom: 7%;
  display: none;
  pointer-events: none;
  position: absolute;
  top: 0;
  z-index: 1;
}}

.book-lang-mask--thai {{
  left: 0;
  right: 50%;
}}

.book-lang-mask--pali {{
  left: 50%;
  right: 0;
}}

.book-page.hide-thai .book-token[data-lang="thai"],
.book-page.hide-pali .book-token[data-lang="pali"] {{
  visibility: hidden;
}}

.book-page.has-background.hide-thai .book-lang-mask--thai,
.book-page.has-background.hide-pali .book-lang-mask--pali {{
  display: block;
}}

.book-page.bilingual:not(.has-background) .book-token[data-lang="thai"] {{
  color: #1f2d89;
}}

.book-page.bilingual:not(.has-background) .book-token[data-lang="pali"] {{
  color: #6b3a12;
}}
"""
    css = "/* Generated book page layout */\n" + css
    css += footnote_css()
    if bilingual:
        css += """
.book-lang-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin: 12px auto 0;
  max-width: min(100%, 760px);
}
.book-lang-toolbar button {
  background: #fffaf0;
  border: 1px solid rgba(74, 44, 10, 0.22);
  border-radius: 8px;
  color: #1f2d89;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  min-height: 36px;
  padding: 6px 12px;
}
.book-lang-toolbar button.is-active {
  background: #fff3d6;
  border-color: #f2a600;
}
"""
    (output_dir / "book.css").write_text(css, encoding="utf-8")
    if bilingual:
        (output_dir / "book-lang-toggle.js").write_text(
            """(() => {
  const apply = (mode) => {
    document.querySelectorAll('.book-page.bilingual').forEach((page) => {
      page.classList.toggle('hide-thai', mode === 'pali');
      page.classList.toggle('hide-pali', mode === 'thai');
    });
    document.querySelectorAll('[data-book-lang]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.bookLang === mode);
    });
  };
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-book-lang]');
    if (!button) return;
    apply(button.dataset.bookLang || 'both');
  });
})();
""",
            encoding="utf-8",
        )


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
    page_words: dict[int, list[dict]] = {}

    with pdfplumber.open(args.pdf_path) as pdf:
        last_page = args.to_page or len(pdf.pages)
        first_page = max(1, args.from_page)
        if args.content_from_page:
            first_page = max(first_page, args.content_from_page)
        last_page = min(last_page, len(pdf.pages))
        page_numbers = list(range(first_page, last_page + 1))

        backgrounds = render_backgrounds(args.pdf_path, pages_dir, page_numbers) if args.with_background else {}

        for page_no in page_numbers:
            page = pdf.pages[page_no - 1]
            book_page = page_no - args.book_page_offset if args.book_page_offset else page_no
            if args.bilingual_columns:
                bilingual = extract_bilingual_page(page, lang_split=args.lang_split)
                words = bilingual["words"]
                lines = group_words_into_lines(words)
                thai_text = bilingual["thai"]
                pali_text = bilingual["pali"]
            else:
                words = page.extract_words(use_text_flow=True, keep_blank_chars=False) or []
                lines = group_words_into_lines(words)
                thai_text = ""
                pali_text = ""
            page_words[page_no] = flatten_words(lines)
            background_path = backgrounds.get(page_no)
            token_count = sum(len(line) for line in lines)
            page_html = build_page_html(
                page_no,
                page.width,
                page.height,
                lines,
                background_path,
                book_id,
                token_count,
                bilingual=args.bilingual_columns,
                default_lang_visibility=args.default_lang_visibility,
                book_page=book_page,
            )
            if background_path and 'class="book-page' in page_html and "has-background" not in page_html:
                page_html = page_html.replace('class="book-page', 'class="book-page has-background', 1)
            page_file = pages_dir / f"page-{page_no:04d}.html"
            page_file.write_text(page_html, encoding="utf-8")

            entry = {
                "page": page_no,
                "bookPage": book_page,
                "html": f"pages/page-{page_no:04d}.html",
                "background": background_path,
                "width": round(page.width, 2),
                "height": round(page.height, 2),
                "tokenCount": token_count,
                "sourceText": extract_source_text(lines),
            }
            if args.bilingual_columns:
                entry["thai"] = thai_text
                entry["pali"] = pali_text
                entry["bilingual"] = True
            manifest_pages.append(entry)

    write_assets(output_dir, bilingual=args.bilingual_columns)

    try:
        source_pdf_relative = os.path.relpath(args.pdf_path.resolve(), output_dir.resolve())
    except ValueError:
        source_pdf_relative = args.pdf_path.name

    practice_index = export_practice_packs(
        output_dir,
        book_id,
        title,
        manifest_pages,
        page_words,
    )

    manifest = {
        "schema": "paligo.bookHtmlExport.v1",
        "bookId": book_id,
        "title": title,
        "sourcePdf": args.pdf_path.name,
        "sourcePdfRelative": source_pdf_relative,
        "pageCount": len(manifest_pages),
        "practiceIndex": "practice/index.json",
        "pages": manifest_pages,
        "bilingualColumns": args.bilingual_columns,
        "bookPageOffset": args.book_page_offset,
        "defaultLanguageVisibility": args.default_lang_visibility if args.bilingual_columns else "both",
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    if args.bilingual_columns:
        bodies = []
        for entry in manifest_pages:
            body = (pages_dir / Path(entry["html"]).name).read_text(encoding="utf-8")
            body = body.replace('src="page-', 'src="pages/page-')
            bodies.append(body)
        index_html = f"""<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{html.escape(title)}</title>
  <link rel="stylesheet" href="book.css" />
  <style>body{{background:#f8f0e3;margin:0;padding:16px;}} .book-page{{margin-bottom:22px;}}</style>
</head>
<body>
  <div class="book-lang-toolbar" role="group" aria-label="แสดงภาษา">
    <button type="button" data-book-lang="thai">ไทย (โจทย์)</button>
    <button type="button" data-book-lang="pali">บาลี (เฉลย)</button>
    <button type="button" data-book-lang="both" class="is-active">ทั้งคู่</button>
  </div>
  {"".join(bodies)}
  <script src="book-lang-toggle.js"></script>
  <script>
    document.querySelector('[data-book-lang="{args.default_lang_visibility}"]')?.click();
  </script>
</body>
</html>
"""
        (output_dir / "index.html").write_text(index_html, encoding="utf-8")
    verification = default_verification(book_id, page_numbers)
    write_verification(output_dir / "verification.json", verification)

    bundle_path = export_book_bundle(output_dir)
    print(f"Wrote book bundle to {bundle_path}")

    print(f"Wrote {len(manifest_pages)} pages to {output_dir}")
    print(f"Wrote {len(practice_index.get('packs', []))} audio practice packs to {output_dir / 'practice'}")
    if args.bilingual_columns:
        print(f"Open {output_dir / 'index.html'} for bilingual hide/show.")
    print("Open pali-audio-hightlight.html?manifest=output/BOOK-ID/manifest.json for audio practice.")
    print("Open book-page-qa.html for PDF/HTML comparison and verification.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

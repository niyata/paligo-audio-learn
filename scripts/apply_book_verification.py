#!/usr/bin/env python3
"""
Apply verification.json statuses to generated book page HTML footnotes.

Example:
  python3 scripts/apply_book_verification.py output/4-MT-29
  python3 scripts/apply_book_verification.py output/4-MT-29 --verification custom.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from book_verification_lib import (  # noqa: E402
    build_footnote_html,
    default_verification,
    load_verification,
    normalize_status,
    patch_page_html,
    write_verification,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sync verification badges into book page HTML.")
    parser.add_argument("output_dir", type=Path, help="Book HTML output directory")
    parser.add_argument("--verification", type=Path, default=None, help="verification.json path")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    output_dir = args.output_dir
    manifest_path = output_dir / "manifest.json"

    if not manifest_path.exists():
        print(f"manifest.json not found in {output_dir}", file=sys.stderr)
        return 1

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    verification_path = args.verification or (output_dir / "verification.json")

    if verification_path.exists():
        verification = load_verification(verification_path)
    else:
        page_numbers = [entry["page"] for entry in manifest.get("pages", [])]
        verification = default_verification(manifest.get("bookId", output_dir.name), page_numbers)
        write_verification(verification_path, verification)

    book_id = manifest.get("bookId", output_dir.name)
    pages_meta = {str(entry["page"]): entry for entry in manifest.get("pages", [])}
    updated = 0

    for page_key, page_state in verification.get("pages", {}).items():
        entry = pages_meta.get(page_key)
        if not entry:
            continue

        page_file = output_dir / entry["html"]
        if not page_file.exists():
            continue

        status = normalize_status(page_state.get("status"))
        note = str(page_state.get("note") or "")
        token_count = int(entry.get("tokenCount") or 0)
        footnote_html = build_footnote_html(int(page_key), token_count, book_id, status, note)
        html_content = page_file.read_text(encoding="utf-8")
        page_file.write_text(patch_page_html(html_content, footnote_html), encoding="utf-8")
        updated += 1

    write_verification(verification_path, verification)
    print(f"Updated {updated} page footnotes in {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""
Export a single paligo.bookBundle.v1 index for an output book folder.

Example:
  python3 scripts/export_book_bundle.py output/4-MT-29
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from audio_practice_lib import read_audio_duration_seconds  # noqa: E402
from book_bundle_lib import export_book_bundle, page_audio_path, practice_audio_path, read_json  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export paligo.bookBundle.v1 for a book folder.")
    parser.add_argument("output_dir", type=Path, help="Book output directory, e.g. output/4-MT-29")
    return parser.parse_args()


def collect_durations(output_dir: Path) -> dict[str, float | None]:
    durations: dict[str, float | None] = {}

    index_path = output_dir / "practice" / "index.json"
    if index_path.is_file():
        index = read_json(index_path)
        for entry in index.get("packs", []):
            pack_id = entry.get("packId")
            if not pack_id:
                continue
            audio_path = practice_audio_path(output_dir, pack_id)
            durations[pack_id] = read_audio_duration_seconds(audio_path) if audio_path.is_file() else None

    manifest_path = output_dir / "manifest.json"
    if manifest_path.is_file():
        manifest = read_json(manifest_path)
        for page_entry in manifest.get("pages", []):
            page_no = int(page_entry["page"])
            audio_path = page_audio_path(output_dir, page_no)
            if audio_path.is_file():
                durations[f"page-{page_no:04d}"] = read_audio_duration_seconds(audio_path)

    return durations


def main() -> int:
    args = parse_args()
    output_dir = args.output_dir.resolve()
    if not (output_dir / "manifest.json").is_file():
        print(f"manifest.json not found in {output_dir}", file=sys.stderr)
        return 1

    bundle_path = export_book_bundle(output_dir, audio_durations=collect_durations(output_dir))
    print(f"Wrote {bundle_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

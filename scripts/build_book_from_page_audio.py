#!/usr/bin/env python3
"""
Attach per-page or per-question MP3 files to an exported book folder.

After pdf_to_book_html.py, place audio files then run:

  # Practice packs (recommended for 4-MT-29)
  output/4-MT-29/practice/q1-pali.mp3
  output/4-MT-29/practice/q2-pali.mp3

  # Optional page-level audio
  output/4-MT-29/audio/page-0001.mp3

Examples:
  python3 scripts/build_book_from_page_audio.py output/4-MT-29
  python3 scripts/build_book_from_page_audio.py output/4-MT-29 --align proportional
  python3 scripts/build_book_from_page_audio.py output/4-MT-29 \\
    --practice-audio-dir ~/recordings/4-MT-29 --align proportional
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from audio_practice_lib import (  # noqa: E402
    apply_pack_audio_update,
    read_audio_duration_seconds,
    sync_practice_index_entry,
)
from book_bundle_lib import (  # noqa: E402
    export_book_bundle,
    page_audio_path,
    practice_audio_path,
    read_json,
    update_manifest_page_audio,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Attach MP3 files to a book export folder.")
    parser.add_argument("output_dir", type=Path, help="Book output directory, e.g. output/4-MT-29")
    parser.add_argument(
        "--practice-audio-dir",
        type=Path,
        default=None,
        help="Copy q*-pali.mp3 files into output/.../practice/",
    )
    parser.add_argument(
        "--page-audio-dir",
        type=Path,
        default=None,
        help="Copy page-NNNN.mp3 files into output/.../audio/",
    )
    parser.add_argument(
        "--align",
        choices=("none", "proportional"),
        default="none",
        help="Generate word timing from MP3 duration (proportional v1)",
    )
    parser.add_argument(
        "--skip-bundle",
        action="store_true",
        help="Do not write book-bundle.json",
    )
    return parser.parse_args()


def copy_matching_files(source_dir: Path, target_dir: Path, pattern: str) -> list[Path]:
    if not source_dir.is_dir():
        print(f"Audio source not found: {source_dir}", file=sys.stderr)
        return []

    target_dir.mkdir(parents=True, exist_ok=True)
    copied: list[Path] = []
    for source in sorted(source_dir.glob(pattern)):
        if not source.is_file():
            continue
        target = target_dir / source.name
        if not target.exists() or source.stat().st_mtime > target.stat().st_mtime:
            shutil.copy2(source, target)
            print(f"Copied {source.name} -> {target.relative_to(target_dir.parent)}")
        copied.append(target)
    return copied


def attach_practice_audio(output_dir: Path, align: str) -> tuple[int, dict[str, float | None]]:
    index_path = output_dir / "practice" / "index.json"
    if not index_path.is_file():
        print("No practice/index.json found; skipping practice audio.", file=sys.stderr)
        return 0, {}

    index = read_json(index_path)
    attached = 0
    durations: dict[str, float | None] = {}

    for entry in index.get("packs", []):
        pack_id = entry.get("packId")
        if not pack_id:
            continue

        audio_path = practice_audio_path(output_dir, pack_id)
        if not audio_path.is_file():
            print(f"Missing practice audio: {audio_path.relative_to(output_dir)}")
            continue

        duration = read_audio_duration_seconds(audio_path)
        durations[pack_id] = duration
        pack_json = output_dir / str(entry.get("file") or f"practice/{pack_id}.json")
        if not pack_json.is_file():
            print(f"Missing practice JSON: {pack_json}", file=sys.stderr)
            continue

        pack = apply_pack_audio_update(
            pack_json,
            audio_rel=f"practice/{audio_path.name}",
            duration=duration,
            align=align if duration is not None else None,
        )
        sync_practice_index_entry(output_dir, pack)
        attached += 1
        duration_label = f"{duration:.1f}s" if duration is not None else "unknown duration"
        status = pack.get("alignmentStatus", "tokens-only")
        print(f"Linked {pack_id}: {audio_path.name} ({duration_label}, {status})")

    return attached, durations


def attach_page_audio(output_dir: Path) -> tuple[int, dict[str, float | None]]:
    manifest_path = output_dir / "manifest.json"
    if not manifest_path.is_file():
        return 0, {}

    manifest = read_json(manifest_path)
    attached = 0
    page_durations: dict[int, float | None] = {}
    duration_lookup: dict[str, float | None] = {}

    for page_entry in manifest.get("pages", []):
        page_no = int(page_entry["page"])
        audio_path = page_audio_path(output_dir, page_no)
        if not audio_path.is_file():
            continue

        duration = read_audio_duration_seconds(audio_path)
        page_durations[page_no] = duration
        duration_lookup[f"page-{page_no:04d}"] = duration
        attached += 1
        duration_label = f"{duration:.1f}s" if duration is not None else "unknown duration"
        print(f"Linked page {page_no}: {audio_path.name} ({duration_label})")

    if page_durations:
        update_manifest_page_audio(output_dir, page_durations)

    return attached, duration_lookup


def main() -> int:
    args = parse_args()
    output_dir = args.output_dir.resolve()
    if not (output_dir / "manifest.json").is_file():
        print(f"manifest.json not found in {output_dir}", file=sys.stderr)
        return 1

    if args.practice_audio_dir:
        copy_matching_files(args.practice_audio_dir, output_dir / "practice", "q*-pali.mp3")

    if args.page_audio_dir:
        copy_matching_files(args.page_audio_dir, output_dir / "audio", "page-*.mp3")

    practice_count, practice_durations = attach_practice_audio(output_dir, args.align)
    page_count, page_durations = attach_page_audio(output_dir)

    if practice_count == 0 and page_count == 0:
        print("No MP3 files found. Expected paths:")
        print(f"  {output_dir / 'practice' / 'q1-pali.mp3'}")
        print(f"  {output_dir / 'audio' / 'page-0001.mp3'}")
        return 1

    if not args.skip_bundle:
        bundle_path = export_book_bundle(
            output_dir,
            audio_durations={**page_durations, **practice_durations},
        )
        print(f"Wrote {bundle_path.relative_to(output_dir.parent.parent)}")
        print("Open pali-audio-hightlight.html?manifest=output/BOOK-ID/manifest.json")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

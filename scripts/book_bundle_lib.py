from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

BUNDLE_SCHEMA = "paligo.bookBundle.v1"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def relative_path(path: Path, base: Path) -> str:
    try:
        return path.resolve().relative_to(base.resolve()).as_posix()
    except ValueError:
        return path.name


def file_meta(path: Path | None) -> dict:
    if path is None or not path.is_file():
        return {"present": False, "path": None, "sizeBytes": None}

    stat = path.stat()
    return {
        "present": True,
        "path": path.name if path.parent.name in {"practice", "audio", "pages"} else path.as_posix(),
        "sizeBytes": stat.st_size,
    }


def page_audio_path(output_dir: Path, page_no: int) -> Path:
    return output_dir / "audio" / f"page-{page_no:04d}.mp3"


def practice_audio_path(output_dir: Path, pack_id: str) -> Path:
    return output_dir / "practice" / f"{pack_id}.mp3"


def build_book_bundle(output_dir: Path, *, audio_durations: dict[str, float | None] | None = None) -> dict:
    output_dir = output_dir.resolve()
    manifest_path = output_dir / "manifest.json"
    if not manifest_path.is_file():
        raise FileNotFoundError(f"manifest.json not found in {output_dir}")

    manifest = read_json(manifest_path)
    book_id = manifest.get("bookId", output_dir.name)
    title = manifest.get("title", book_id)
    audio_durations = audio_durations or {}

    verification_path = output_dir / "verification.json"
    practice_index_path = output_dir / (manifest.get("practiceIndex") or "practice/index.json")

    practice_index = read_json(practice_index_path) if practice_index_path.is_file() else {"packs": []}
    packs_by_page: dict[int, list[str]] = {}
    practice_packs: list[dict] = []

    for entry in practice_index.get("packs", []):
        pack_id = entry.get("packId", "")
        page_no = int(entry.get("page") or 0)
        packs_by_page.setdefault(page_no, []).append(pack_id)

        pack_json_path = output_dir / str(entry.get("file") or f"practice/{pack_id}.json")
        pack_payload = read_json(pack_json_path) if pack_json_path.is_file() else {}
        audio_rel = entry.get("audio") or pack_payload.get("audio") or f"practice/{pack_id}.mp3"
        audio_path = output_dir / audio_rel
        duration_key = pack_id
        practice_packs.append(
            {
                "packId": pack_id,
                "title": entry.get("title") or pack_payload.get("title") or pack_id,
                "file": relative_path(pack_json_path, output_dir) if pack_json_path.is_file() else entry.get("file"),
                "audio": audio_rel,
                "audioFile": file_meta(audio_path),
                "audioDuration": audio_durations.get(duration_key),
                "page": page_no or None,
                "answerPage": entry.get("answerPage") or pack_payload.get("answerPage"),
                "tokenCount": entry.get("tokenCount") or len(pack_payload.get("alignment") or []),
                "alignmentStatus": entry.get("alignmentStatus") or pack_payload.get("alignmentStatus"),
                "alignmentMethod": pack_payload.get("alignmentMethod"),
            }
        )

    pages: list[dict] = []
    for page_entry in manifest.get("pages", []):
        page_no = int(page_entry["page"])
        page_audio = page_audio_path(output_dir, page_no)
        page_key = f"page-{page_no:04d}"
        pages.append(
            {
                "page": page_no,
                "html": page_entry.get("html"),
                "background": page_entry.get("background"),
                "tokenCount": page_entry.get("tokenCount"),
                "audio": f"audio/{page_audio.name}",
                "audioFile": file_meta(page_audio),
                "audioDuration": audio_durations.get(page_key),
                "practicePacks": packs_by_page.get(page_no, []),
            }
        )

    bundle = {
        "schema": BUNDLE_SCHEMA,
        "bookId": book_id,
        "title": title,
        "exportedAt": utc_now_iso(),
        "manifest": "manifest.json",
        "verification": "verification.json" if verification_path.is_file() else None,
        "practiceIndex": relative_path(practice_index_path, output_dir) if practice_index_path.is_file() else None,
        "sourcePdf": manifest.get("sourcePdf"),
        "sourcePdfRelative": manifest.get("sourcePdfRelative"),
        "pageCount": manifest.get("pageCount") or len(pages),
        "assets": {
            "styles": "book.css",
            "fonts": "fonts/",
        },
        "pages": pages,
        "practicePacks": practice_packs,
    }
    return bundle


def export_book_bundle(output_dir: Path, *, audio_durations: dict[str, float | None] | None = None) -> Path:
    bundle = build_book_bundle(output_dir, audio_durations=audio_durations)
    target = output_dir / "book-bundle.json"
    write_json(target, bundle)
    return target


def update_manifest_page_audio(output_dir: Path, page_durations: dict[int, float | None]) -> None:
    manifest_path = output_dir / "manifest.json"
    manifest = read_json(manifest_path)

    pages_by_no = {int(entry["page"]): entry for entry in manifest.get("pages", [])}
    for page_no, duration in page_durations.items():
        entry = pages_by_no.get(page_no)
        if not entry:
            continue
        audio_rel = f"audio/page-{page_no:04d}.mp3"
        audio_path = output_dir / audio_rel
        if audio_path.is_file():
            entry["audio"] = audio_rel
            entry["audioDuration"] = round(duration, 3) if duration is not None else None
        elif "audio" in entry and not audio_path.is_file():
            entry.pop("audio", None)
            entry.pop("audioDuration", None)

    write_json(manifest_path, manifest)

from __future__ import annotations

import shutil
from pathlib import Path

FONT_FACES: list[dict[str, object]] = [
    {"family": "TH Sarabun Bali", "files": ["THSarabunBali.ttf", "THSarabunPali.ttf"]},
    {"family": "Angsana UPC", "files": ["AngsanaUPC.ttf"]},
    {"family": "Cordia UPC", "files": ["CordiaUPC.ttf"]},
]

FONT_OPTIONS: list[dict[str, str]] = [
    {
        "id": "th-sarabun-bali",
        "label": "TH Sarabun Bali",
        "stack": '"TH Sarabun Bali", "TH Sarabun Pali", Sarabun, sans-serif',
    },
    {
        "id": "angsana-upc",
        "label": "Angsana UPC",
        "stack": '"Angsana UPC", Angsana, serif',
    },
    {
        "id": "cordia-upc",
        "label": "Cordia UPC",
        "stack": '"Cordia UPC", Cordia, sans-serif',
    },
]

DEFAULT_FONT_STACK = FONT_OPTIONS[0]["stack"]


def copy_font_assets(repo_root: Path, output_dir: Path) -> list[str]:
    source_dir = repo_root / "fonts"
    target_dir = output_dir / "fonts"
    target_dir.mkdir(parents=True, exist_ok=True)
    copied: list[str] = []

    for face in FONT_FACES:
        for filename in face["files"]:
            source = source_dir / filename
            if not source.exists():
                continue
            target = target_dir / filename
            shutil.copy2(source, target)
            if filename not in copied:
                copied.append(filename)

    return copied


def build_font_face_css(output_dir: Path) -> str:
    blocks: list[str] = []

    for face in FONT_FACES:
        family = str(face["family"])
        for filename in face["files"]:
            font_path = output_dir / "fonts" / filename
            if not font_path.exists():
                continue
            blocks.append(
                f"""@font-face {{
  font-family: "{family}";
  src: url("fonts/{filename}") format("truetype");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}}"""
            )
            break

    if not blocks:
        return ""

    return "\n\n".join(blocks) + "\n\n"

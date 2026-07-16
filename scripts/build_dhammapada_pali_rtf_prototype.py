#!/usr/bin/env python3
"""Build a prototype Paligo Pali corpus from the Dhammapada RTF source.

The source RTF is ANSI/Thai CP874 with a few private-use characters from the
legacy Pali font. This prototype keeps PDF extraction out of the Pali source of
truth so pinthu and niggahita can be rendered with Unicode-aware Pali fonts.
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from pathlib import Path
from typing import Any


DEFAULT_RTF = Path(
    "/Users/iworn/Documents/Claude/Projects/PaliGo/Knowledge-Base/pt4/"
    "Dhammapada-sambandha/Raw-Data-PT4/ธัมมปทัฏฐกถา ปฐโม ภาโค.rtf"
)
DEFAULT_OUT = Path("data/corpora/dhammapadatthakatha-pali-rtf-prototype")
CORPUS_ID = "dhammapadatthakatha-pali-rtf-prototype"
THAI_DIGITS = str.maketrans("0123456789", "๐๑๒๓๔๕๖๗๘๙")
SPACE_RE = re.compile(r"[ \t]+")
HEADER_RE = re.compile(r"^ประโยค[๐-๙0-9]+.*ธมฺมปท.*หน้าที่\s*[๐-๙0-9]+$")
FONT_TABLE_LEAK_RE = re.compile(r"^(Angsana New|Courier New|;){2,}")
DECORATION_RE = re.compile(r"^-{5,}$")

# Legacy private-use characters found in the RTF. The contexts were inspected
# against known Pali spellings: ธมฺมปทฏฺฐกถา, สทฺธมฺมญฺจ, ธมฺมปทํ.
PUA_MAP = {
    "\uf700": "ฐ",
    "\uf70f": "ญ",
    "\uf711": "ํ",
}


def to_thai_digits(value: int | str) -> str:
    return str(value).translate(THAI_DIGITS)


def decode_rtf_unicode_number(value: int) -> str:
    if value < 0:
        value = 65536 + value
    return PUA_MAP.get(chr(value), chr(value))


def decode_rtf_text(path: Path) -> str:
    """Decode the limited RTF syntax used by the source file into Unicode text."""
    source = path.read_text(encoding="latin1")
    output: list[str] = []
    index = 0
    while index < len(source):
        char = source[index]

        if char in "{}":
            index += 1
            continue

        if char == "\n" or char == "\r":
            index += 1
            continue

        if char != "\\":
            output.append(char)
            index += 1
            continue

        if source.startswith("\\'", index) and index + 4 <= len(source):
            try:
                byte = int(source[index + 2 : index + 4], 16)
                output.append(bytes([byte]).decode("cp874"))
                index += 4
                continue
            except ValueError:
                pass

        unicode_match = re.match(r"\\u(-?\d+)", source[index:])
        if unicode_match:
            output.append(decode_rtf_unicode_number(int(unicode_match.group(1))))
            index += len(unicode_match.group(0))
            # The source uses \uc1, so skip one fallback character. In this RTF
            # fallback is commonly encoded as \'3f.
            if source.startswith("\\'", index) and index + 4 <= len(source):
                index += 4
            elif index < len(source):
                index += 1
            continue

        control_match = re.match(r"\\([a-zA-Z]+)(-?\d+)? ?", source[index:])
        if control_match:
            word = control_match.group(1)
            if word in {"par", "line"}:
                output.append("\n")
            elif word == "page":
                output.append("\f")
            elif word == "tab":
                output.append("\t")
            index += len(control_match.group(0))
            continue

        # RTF control symbols.
        symbol = source[index + 1] if index + 1 < len(source) else ""
        if symbol == "~":
            output.append(" ")
        elif symbol == "-":
            output.append("")
        elif symbol in "{}\\":
            output.append(symbol)
        index += 2

    return unicodedata.normalize("NFC", "".join(output))


def clean_line(line: str) -> str:
    clean = line.replace("\u00a0", " ")
    clean = SPACE_RE.sub(" ", clean).strip()
    clean = re.sub(r"\s+([,.;:!?ฯ])", r"\1", clean)
    return clean


def split_pages(text: str) -> list[list[str]]:
    pages: list[list[str]] = []
    for raw_page in text.split("\f"):
        lines: list[str] = []
        for raw_line in raw_page.splitlines():
            line = clean_line(raw_line)
            if not line or DECORATION_RE.match(line) or HEADER_RE.match(line) or FONT_TABLE_LEAK_RE.match(line):
                continue
            lines.append(line)
        if lines:
            pages.append(lines)
    return pages


def glyph_audit(text: str) -> dict[str, Any]:
    pua = sorted({char for char in text if "\ue000" <= char <= "\uf8ff"})
    replacement = text.count("\ufffd")
    pinthu = text.count("\u0e3a")
    niggahita = text.count("\u0e4d")
    return {
        "remainingPua": [{"char": char, "codepoint": f"U+{ord(char):04X}"} for char in pua],
        "replacementChars": replacement,
        "pinthuCount": pinthu,
        "niggahitaCount": niggahita,
    }


def build_corpus(rtf_path: Path, *, max_pages: int | None = None) -> dict[str, Any]:
    decoded = decode_rtf_text(rtf_path)
    pages = split_pages(decoded)
    if max_pages:
        pages = pages[:max_pages]

    chapter_id = f"{CORPUS_ID}-yamaka"
    corpus: dict[str, Any] = {
        "schema": "paligo.corpus.v1",
        "corpusId": CORPUS_ID,
        "title": "ธัมมปทัฏฐกถา ปฐโม ภาโค (บาลี · RTF Unicode prototype)",
        "grade": "ป.ธ. ๔",
        "sourceType": "rtf-cp874-pali",
        "languageToggle": False,
        "itemConventions": {
            "itemId": "id หลักของหน่วยเรียน ใช้ในระบบทุกที่",
            "chapterId": "id ของกลุ่ม/บท/ข้อใหญ่ที่ item นั้นสังกัด",
            "itemType": "ชนิดของ item เช่น chapter, page, sentence",
        },
        "sourceArtifacts": {
            "sourceFile": str(rtf_path),
            "encoding": "RTF ANSI CP874",
            "legacyPuaMap": {f"U+{ord(source):04X}": target for source, target in PUA_MAP.items()},
            "glyphAudit": glyph_audit("\n".join("\n".join(lines) for lines in pages)),
        },
        "chapters": [
            {
                "chapterId": chapter_id,
                "itemId": chapter_id,
                "itemType": "chapter",
                "title": "ยมกวรรควัณณนา",
                "sourceFile": rtf_path.name,
                "sourcePages": [1, len(pages)],
            }
        ],
        "items": [],
    }

    for page_no, page_lines in enumerate(pages, start=1):
        page_item_id = f"{CORPUS_ID}-p{page_no:04d}"
        children = []
        for index, line in enumerate(page_lines, start=1):
            children.append(
                {
                    "itemId": f"{page_item_id}-l{index:03d}",
                    "chapterId": chapter_id,
                    "parentItemId": page_item_id,
                    "itemType": "sentence",
                    "itemNo": index,
                    "sourcePage": page_no,
                    "sourcePageLabel": to_thai_digits(page_no),
                    "pali": line,
                    "thaiLiteral": "",
                    "thaiMeaning": "",
                }
            )
        page_text = "\n".join(page_lines)
        corpus["items"].append(
            {
                "itemId": page_item_id,
                "chapterId": chapter_id,
                "itemType": "page",
                "itemNo": page_no,
                "sourcePage": page_no,
                "sourcePageLabel": to_thai_digits(page_no),
                "title": f"ธัมมปทัฏฐกถา ปฐโม ภาโค หน้า {to_thai_digits(page_no)}",
                "pali": page_text,
                "rawText": page_text,
                "text": page_text,
                "children": children,
            }
        )

    return corpus


def write_outputs(corpus: dict[str, Any], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    corpus_path = out_dir / "corpus.json"
    manifest_path = out_dir / "manifest.json"
    report_path = out_dir / "glyph-report.json"
    corpus_path.write_text(json.dumps(corpus, ensure_ascii=False, indent=2), encoding="utf-8")
    manifest = {
        "schema": "paligo.corpus-manifest.v1",
        "title": corpus["title"],
        "grade": corpus["grade"],
        "corpus": "corpus.json",
        "defaultDisplayMode": "page",
        "subjectHint": "thai-to-pali",
        "languageToggle": False,
        "defaultLanguageVisibility": "pali",
        "audioAlignment": "",
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    report = {
        "schema": "paligo.pali-rtf-glyph-report.v1",
        "corpusId": corpus["corpusId"],
        "title": corpus["title"],
        "pageCount": sum(1 for item in corpus["items"] if item.get("itemType") == "page"),
        "lineCount": sum(len(item.get("children") or []) for item in corpus["items"] if item.get("itemType") == "page"),
        "sourceArtifacts": corpus["sourceArtifacts"],
    }
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {corpus_path}")
    print(f"Wrote {manifest_path}")
    print(f"Wrote {report_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build Dhammapada Pali corpus prototype from RTF.")
    parser.add_argument("--rtf", type=Path, default=DEFAULT_RTF)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--max-pages", type=int, default=None)
    args = parser.parse_args()

    if not args.rtf.exists():
        raise SystemExit(f"RTF not found: {args.rtf}")

    corpus = build_corpus(args.rtf, max_pages=args.max_pages)
    write_outputs(corpus, args.out_dir)


if __name__ == "__main__":
    main()

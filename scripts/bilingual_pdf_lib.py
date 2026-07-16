#!/usr/bin/env python3
"""Helpers for Thai–Pali bilingual PDF pages (left Thai / right Pali)."""

from __future__ import annotations

import re
import unicodedata
from typing import Iterable

THAI_DIGITS = str.maketrans("0123456789", "๐๑๒๓๔๕๖๗๘๙")
REPLACEMENT_RE = re.compile(r"[\ufffd\u0000-\u0008\u000b\u000c\u000e-\u001f]")
COMBINING_DUP_RE = re.compile(r"([\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0e3a])\1+")
SPACE_RE = re.compile(r"[ \t]+")
FOOTER_FONT_HINTS = ("helvetica", "charmonman", "manawika")
PALI_FONT_HINTS = ("balee", "bali")
THAI_FONT_HINTS = ("cordianew", "cordia new", "thsarabun", "sarabun")
THAI_PDF_TEXT_FIXES = (
    ("ซึ่ึง", "ซึ่ง"),
    ("ซึง", "ซึ่ง"),
    ("เคร่อง", "เครื่อง"),
    ("เร่อง", "เรื่อง"),
    ("เน่อ", "เนื้อ"),
    ("อันเป็นค่", "อันเป็นคู่"),
    ("กำาห่นด", "กำหนด"),
    ("กำห่นด", "กำหนด"),
    ("แล่้ว", "แล้ว"),
    ("เม่อง", "เมือง"),
    ("เพ่อ", "เพื่อ"),
    ("เม่อ", "เมื่อ"),
    ("ถ่อ", "ถือ"),
    ("ห่น", "หน"),
    ("ห่รือ", "หรือ"),
    ("ห่ร่อ", "หรือ"),
    ("กำา", "กำ"),
    ("สำา", "สำ"),
    ("จ้ำา", "จำ"),
    ("ล้ำา", "ลำ"),
    ("แล้ว่", "แล้ว"),
    ("ว่า่", "ว่า"),
    ("อย์้่", "อยู่"),
    ("ป็ระ", "ประ"),
    ("บุคุคล", "บุคคล"),
    ("ทกุ่ข์", "ทุกข์"),
    ("ลอ้", "ล้อ"),
    ("หมนุ", "หมุน"),
    ("เทา้", "เท้า"),
    ("ตวั", "ตัว"),
    ("ดงั", "ดัง"),
    ("ไห่น", "ไหน"),
    ("ไห่ว่้", "ไหว้"),
    ("ติรัส", "ตรัส"),
    ("ติรสั", "ตรัส"),
    ("พระธรรมเทศนา นี ว่า", "พระธรรมเทศนานี้ว่า"),
    ("ดังนี", "ดังนี้"),
    ("ในที)", "ในที่)"),
    ("ทีส ดุ", "ที่สุด"),
    ("อนั", "อัน"),
    ("แกุ้", "แก้"),
    ("แกุ่", "แก่"),
    ("กุับ", "กับ"),
    ("ด้ว่ย์", "ด้วย"),
    ("ผู้เจ้ริญ", "ผู้เจริญ"),
    ("เจ้ริญ", "เจริญ"),
    ("ข้าแติ่", "ข้าแต่"),
    ("ย์่อม", "ย่อม"),
    ("กุล่าว", "กล่าว"),
    ("กล้าว", "กล่าว"),
    ("กุล้่าว่", "กล่าว"),
    ("ห่ล้ีกุ", "หลีก"),
    ("ข้อง", "ของ"),
    ("บุติร", "บุตร"),
    ("ติ้น", "ต้น"),
    ("เทว่ดา", "เทวดา"),
    ("ศักุดิ", "ศักดิ์"),
    ("กุระทำา", "กระทำ"),
    ("กุระ", "กระ"),
    ("ข้าพเจ้า จ้ะกล่าว", "ข้าพเจ้าจะกล่าว"),
    ("จ้ักขุ้บาล่", "จักขุบาล"),
    ("จ้ักุ", "จัก"),
    ("จ้ัก", "จัก"),
    ("ขุ้", "ขุ"),
    ("บาล่", "บาล"),
    ("จ้ะ", "จะ"),
    ("ชื่าย์", "ชาย"),
    ("ชื่ัย์", "ชัย"),
    ("ชื่ำา", "ชำ"),
)
THAI_INTERNAL_SPACE_RE = re.compile(r"([\u0e01-\u0e3a\u0e40-\u0e4e])\s+([\u0e01-\u0e3a\u0e40-\u0e4e])")


def to_thai_digits(value: int | str) -> str:
    return str(value).translate(THAI_DIGITS)


def normalize_thai_pdf_text(text: str) -> str:
    """Reduce common digital-PDF doubling artifacts while keeping Pali clusters."""
    cleaned = unicodedata.normalize("NFC", text or "")
    cleaned = REPLACEMENT_RE.sub("", cleaned)
    cleaned = COMBINING_DUP_RE.sub(r"\1", cleaned)
    cleaned = SPACE_RE.sub(" ", cleaned).strip()
    for source, target in THAI_PDF_TEXT_FIXES:
        cleaned = cleaned.replace(source, target)
    cleaned = re.sub(r"อย่(?=\s|$|[ฯ,])", "อยู่", cleaned)
    cleaned = THAI_INTERNAL_SPACE_RE.sub(r"\1\2", cleaned)
    cleaned = re.sub(r"\s+([ฯ,;:!?])", r"\1", cleaned)
    cleaned = re.sub(r"([([])\s+", r"\1", cleaned)
    cleaned = SPACE_RE.sub(" ", cleaned).strip()
    return cleaned


def classify_lang(fontname: str | None, *, x0: float = 0.0, page_width: float = 0.0) -> str:
    name = (fontname or "").lower().replace(" ", "")
    if any(hint in name for hint in PALI_FONT_HINTS):
        return "pali"
    if any(hint in name for hint in THAI_FONT_HINTS):
        return "thai"
    if page_width > 0:
        return "thai" if x0 < page_width * 0.5 else "pali"
    return "unknown"


def is_footer_word(word: dict, page_height: float) -> bool:
    top = float(word.get("top") or 0)
    if page_height > 0 and top >= page_height * 0.92:
        return True
    name = str(word.get("fontname") or "").lower()
    return any(hint in name for hint in FOOTER_FONT_HINTS)


def annotate_words(
    words: Iterable[dict],
    *,
    page_width: float,
    page_height: float,
    lang_split: str = "auto",
) -> list[dict]:
    annotated: list[dict] = []
    midpoint = page_width * 0.5
    for word in words:
        if is_footer_word(word, page_height):
            continue
        text = normalize_thai_pdf_text(str(word.get("text") or ""))
        if not text:
            continue
        fontname = word.get("fontname")
        x0 = float(word.get("x0") or 0)
        if lang_split == "midpoint":
            lang = "thai" if x0 < midpoint else "pali"
        else:
            lang = classify_lang(fontname, x0=x0, page_width=page_width)
            if lang == "unknown":
                lang = "thai" if x0 < midpoint else "pali"
        item = dict(word)
        item["text"] = text
        item["lang"] = lang
        annotated.append(item)
    return annotated


def group_words_into_lines(words: list[dict], line_tolerance: float = 3.0) -> list[list[dict]]:
    if not words:
        return []

    sorted_words = sorted(words, key=lambda item: (round(float(item["top"]), 1), float(item["x0"])))
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


def line_metrics(line: list[dict]) -> dict:
    tops = [float(w["top"]) for w in line]
    bottoms = [float(w["bottom"]) for w in line]
    text = normalize_thai_pdf_text(" ".join(str(w.get("text") or "") for w in line))
    return {
        "top": min(tops) if tops else 0.0,
        "bottom": max(bottoms) if bottoms else 0.0,
        "mid": ((min(tops) + max(bottoms)) / 2) if tops else 0.0,
        "text": text,
        "words": line,
    }


def cluster_paragraphs(lines: list[list[dict]], gap_factor: float = 1.65) -> list[dict]:
    metrics = [line_metrics(line) for line in lines if line]
    metrics = [item for item in metrics if item["text"]]
    if not metrics:
        return []

    heights = [max(1.0, item["bottom"] - item["top"]) for item in metrics]
    median_height = sorted(heights)[len(heights) // 2]
    gap_limit = median_height * gap_factor

    paragraphs: list[dict] = []
    current = [metrics[0]]
    for item in metrics[1:]:
        gap = item["top"] - current[-1]["bottom"]
        if gap > gap_limit:
            paragraphs.append(_merge_paragraph(current))
            current = [item]
        else:
            current.append(item)
    paragraphs.append(_merge_paragraph(current))
    return paragraphs


def _merge_paragraph(lines: list[dict]) -> dict:
    return {
        "top": lines[0]["top"],
        "bottom": lines[-1]["bottom"],
        "mid": (lines[0]["top"] + lines[-1]["bottom"]) / 2,
        "text": "\n".join(line["text"] for line in lines if line["text"]),
        "lines": lines,
    }


def pair_rows(thai_lines: list[list[dict]], pali_lines: list[list[dict]], row_tol: float = 7.0) -> list[dict]:
    """Pair Thai/Pali text that sits on roughly the same horizontal band."""
    items: list[dict] = []
    for line in thai_lines:
        metrics = line_metrics(line)
        if not metrics["text"]:
            continue
        metrics["lang"] = "thai"
        items.append(metrics)
    for line in pali_lines:
        metrics = line_metrics(line)
        if not metrics["text"]:
            continue
        metrics["lang"] = "pali"
        items.append(metrics)
    if not items:
        return []

    items.sort(key=lambda item: item["top"])
    rows: list[list[dict]] = []
    current: list[dict] = []
    current_top: float | None = None
    for item in items:
        if current_top is None or abs(item["top"] - current_top) <= row_tol:
            current.append(item)
            current_top = item["top"] if current_top is None else (current_top + item["top"]) / 2
            continue
        rows.append(current)
        current = [item]
        current_top = item["top"]
    if current:
        rows.append(current)

    pairs: list[dict] = []
    for row in rows:
        thai_parts = [item["text"] for item in row if item["lang"] == "thai"]
        pali_parts = [item["text"] for item in row if item["lang"] == "pali"]
        pairs.append(
            {
                "thai": " ".join(thai_parts).strip(),
                "pali": " ".join(pali_parts).strip(),
                "top": min(item["top"] for item in row),
                "bottom": max(item["bottom"] for item in row),
            }
        )
    return pairs


def pair_paragraphs(thai_paras: list[dict], pali_paras: list[dict]) -> list[dict]:
    """Legacy paragraph zipper kept for callers; prefer pair_rows for bilingual PDFs."""
    if not thai_paras and not pali_paras:
        return []
    if not thai_paras:
        return [{"thai": "", "pali": para["text"], "top": para["top"], "bottom": para["bottom"]} for para in pali_paras]
    if not pali_paras:
        return [{"thai": para["text"], "pali": "", "top": para["top"], "bottom": para["bottom"]} for para in thai_paras]

    thai_sorted = sorted(thai_paras, key=lambda item: item["top"])
    pali_sorted = sorted(pali_paras, key=lambda item: item["top"])
    pairs: list[dict] = []
    for index in range(max(len(thai_sorted), len(pali_sorted))):
        thai = thai_sorted[index] if index < len(thai_sorted) else None
        pali = pali_sorted[index] if index < len(pali_sorted) else None
        pairs.append(
            {
                "thai": thai["text"] if thai else "",
                "pali": pali["text"] if pali else "",
                "top": min(x["top"] for x in (thai, pali) if x),
                "bottom": max(x["bottom"] for x in (thai, pali) if x),
            }
        )
    return pairs


def extract_bilingual_page(
    page,
    *,
    lang_split: str = "auto",
) -> dict:
    """Extract bilingual structure from a pdfplumber page."""
    words = page.extract_words(extra_attrs=["fontname"], use_text_flow=False, keep_blank_chars=False) or []
    annotated = annotate_words(
        words,
        page_width=float(page.width),
        page_height=float(page.height),
        lang_split=lang_split,
    )
    thai_words = [word for word in annotated if word["lang"] == "thai"]
    pali_words = [word for word in annotated if word["lang"] == "pali"]
    thai_lines = group_words_into_lines(thai_words)
    pali_lines = group_words_into_lines(pali_words)
    thai_paras = cluster_paragraphs(thai_lines)
    pali_paras = cluster_paragraphs(pali_lines)
    pairs = pair_rows(thai_lines, pali_lines)
    thai_text = "\n".join(line_metrics(line)["text"] for line in thai_lines if line_metrics(line)["text"])
    pali_text = "\n".join(line_metrics(line)["text"] for line in pali_lines if line_metrics(line)["text"])
    return {
        "words": annotated,
        "thaiWords": thai_words,
        "paliWords": pali_words,
        "thaiLines": thai_lines,
        "paliLines": pali_lines,
        "thaiParagraphs": thai_paras,
        "paliParagraphs": pali_paras,
        "pairs": pairs,
        "thai": thai_text,
        "pali": pali_text,
    }

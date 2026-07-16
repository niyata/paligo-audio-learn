#!/usr/bin/env python3
"""Audit bilingual PDF corpus quality before it is used by PiP/workbook.

This is intentionally a report-only tool. It flags extraction artifacts across
the whole corpus so fixes are driven by page-level evidence instead of one-off
UI replacements.
"""

from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from bilingual_pdf_lib import extract_bilingual_page, normalize_thai_pdf_text  # noqa: E402


DEFAULT_CORPUS = Path("data/corpora/dhammapadatthakatha-pt4-book1/corpus.json")
DEFAULT_OUT = Path("docs/audit/dhammapada-bilingual-corpus/quality-report.json")

SUSPICIOUS_PATTERNS: tuple[tuple[str, str, str], ...] = (
    ("thai_split_sara_am", r"(?:กำ|คำ|ทำ|สำ|จำ|ลำ|น้ำ|ธรรม|นำ)า", "สระอำแตกเป็น า"),
    ("broken_leading_vowel", r"[เแโใไ]\s+", "สระนำหน้าแยกจากพยัญชนะ"),
    ("known_bad_tokens", r"เคร่อง|เร่อง|เน่อ|เม่อง|เพ่อ|เม่อ|ซึ่ึง|แล้ว่|ว่า่|จ้ะ|จ้ัก|ห่น", "คำไทยเพี้ยนที่พบจาก PDF extraction"),
    ("pdf_glyph_order", r"ให่เ|เปน็|ผูม้|ดว้|ตวั|ดงั|อนั|ข้อง|บุติร|ติรัส|ทรพั", "ลำดับ glyph เพี้ยน/พิมพ์ไทยผิดรูป"),
    ("unexpected_ku_artifact", r"กุ(?:ระ|ล่าว|แล้ว|ับ|้|่|าล|รรม)", "กุ แทรกผิดจากฟอนต์ PDF"),
    ("unexpected_yor_artifact", r"ย์(?:่อม|้|์)|ว่ัย์|ชื่าย์", "ย/ไม้เอก/วรรณยุกต์ผิดตำแหน่ง"),
    ("tone_before_consonant", r"[่้๊๋][ก-ฮ]", "วรรณยุกต์นำหน้าพยัญชนะ"),
    ("thai_replacement_char", r"[\ufffd\u25a1]", "replacement/tofu glyph"),
)


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def file_fingerprint(path: Path | None) -> dict[str, Any] | None:
    if not path or not path.exists():
        return None
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return {
        "path": str(path),
        "bytes": path.stat().st_size,
        "sha256": digest.hexdigest(),
    }


def page_text(page: dict[str, Any], field: str) -> str:
    # Corpus pages commonly store both page-level joined text and child rows.
    # Prefer children to avoid double-counting the same PDF text in audits.
    child_chunks: list[str] = []
    for child in page.get("children") or []:
        value = str(child.get(field) or "")
        if value:
            child_chunks.append(value)
    if child_chunks:
        return "\n".join(child_chunks)

    chunks: list[str] = []
    value = str(page.get(field) or "")
    if value:
        chunks.append(value)
    return "\n".join(chunks)


def compact_for_compare(value: str) -> str:
    value = normalize_thai_pdf_text(value)
    value = re.sub(r"\s+", "", value)
    return value


def page_label(page: dict[str, Any]) -> str:
    return str(page.get("sourcePageLabel") or page.get("sourcePage") or page.get("itemId") or "")


def find_suspicious(text: str, *, max_samples: int = 8) -> tuple[list[dict[str, Any]], int]:
    hits: list[dict[str, Any]] = []
    total = 0
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for code, pattern, description in SUSPICIOUS_PATTERNS:
        regex = re.compile(pattern)
        matches = []
        for line_no, line in enumerate(lines, start=1):
            found = regex.findall(line)
            if not found:
                continue
            total += len(found)
            if len(matches) < max_samples:
                matches.append(
                    {
                        "line": line_no,
                        "text": line,
                        "matches": found[:6],
                    }
                )
        if matches:
            hits.append(
                {
                    "code": code,
                    "description": description,
                    "pattern": pattern,
                    "samples": matches,
                }
            )
    return hits, total


def audit_corpus(corpus: dict[str, Any]) -> dict[str, Any]:
    pages = [item for item in corpus.get("items") or [] if item.get("itemType") == "page"]
    page_reports: list[dict[str, Any]] = []

    for page in pages:
        thai = page_text(page, "thai")
        pali = page_text(page, "pali")
        hits, suspicious_count = find_suspicious(thai)
        page_reports.append(
            {
                "itemId": page.get("itemId"),
                "sourcePage": page.get("sourcePage"),
                "sourcePageLabel": page_label(page),
                "pdfPage": page.get("pdfPage"),
                "thaiChars": len(thai),
                "paliChars": len(pali),
                "sentenceCount": len(page.get("children") or []),
                "suspiciousCount": suspicious_count,
                "suspicious": hits,
            }
        )

    source_pages = [int(page.get("sourcePage")) for page in page_reports if page.get("sourcePage") is not None]
    pdf_pages = [int(page.get("pdfPage")) for page in page_reports if page.get("pdfPage") is not None]
    expected_source_pages = list(range(min(source_pages), max(source_pages) + 1)) if source_pages else []
    expected_pdf_pages = list(range(min(pdf_pages), max(pdf_pages) + 1)) if pdf_pages else []
    missing_source_pages = sorted(set(expected_source_pages) - set(source_pages))
    missing_pdf_pages = sorted(set(expected_pdf_pages) - set(pdf_pages))
    empty_thai_pages = [page for page in page_reports if page["thaiChars"] == 0]
    empty_pali_pages = [page for page in page_reports if page["paliChars"] == 0]
    empty_sentence_pages = [page for page in page_reports if page["sentenceCount"] == 0]
    flagged = [page for page in page_reports if page["suspiciousCount"] > 0]
    top = sorted(flagged, key=lambda page: page["suspiciousCount"], reverse=True)[:20]
    return {
        "pages": len(page_reports),
        "structural": {
            "sourcePageRange": [min(source_pages), max(source_pages)] if source_pages else [],
            "pdfPageRange": [min(pdf_pages), max(pdf_pages)] if pdf_pages else [],
            "missingSourcePages": missing_source_pages,
            "missingPdfPages": missing_pdf_pages,
            "totalSentences": sum(page["sentenceCount"] for page in page_reports),
            "emptyThaiPages": [
                {"sourcePage": page["sourcePage"], "pdfPage": page["pdfPage"]} for page in empty_thai_pages
            ],
            "emptyPaliPages": [
                {"sourcePage": page["sourcePage"], "pdfPage": page["pdfPage"]} for page in empty_pali_pages
            ],
            "emptySentencePages": [
                {"sourcePage": page["sourcePage"], "pdfPage": page["pdfPage"]} for page in empty_sentence_pages
            ],
        },
        "flaggedPages": len(flagged),
        "flaggedRatio": round((len(flagged) / len(page_reports)) if page_reports else 0, 4),
        "topFlaggedPages": [
            {
                "sourcePage": page["sourcePage"],
                "sourcePageLabel": page["sourcePageLabel"],
                "pdfPage": page["pdfPage"],
                "suspiciousCount": page["suspiciousCount"],
                "firstIssues": [issue["code"] for issue in page["suspicious"][:5]],
            }
            for page in top
        ],
        "pageReports": page_reports,
    }


def compare_pdf_to_corpus(
    *,
    pdf_path: Path,
    corpus: dict[str, Any],
    max_pages: int | None = None,
    lang_split: str = "auto",
) -> dict[str, Any]:
    try:
        import pdfplumber
    except ImportError as exc:
        return {
            "status": "skipped",
            "reason": f"Missing pdfplumber: {exc}",
        }

    pages = [item for item in corpus.get("items") or [] if item.get("itemType") == "page"]
    if max_pages:
        pages = pages[:max_pages]

    comparisons: list[dict[str, Any]] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pages:
            pdf_page_no = int(page.get("pdfPage") or 0)
            if pdf_page_no < 1 or pdf_page_no > len(pdf.pages):
                comparisons.append(
                    {
                        "sourcePage": page.get("sourcePage"),
                        "pdfPage": pdf_page_no,
                        "status": "missing_pdf_page",
                    }
                )
                continue
            extracted = extract_bilingual_page(pdf.pages[pdf_page_no - 1], lang_split=lang_split)
            corpus_thai = compact_for_compare(page_text(page, "thai"))
            pdf_thai = compact_for_compare(extracted.get("thai") or "")
            ratio = difflib.SequenceMatcher(None, corpus_thai, pdf_thai).ratio() if corpus_thai or pdf_thai else 1.0
            comparisons.append(
                {
                    "sourcePage": page.get("sourcePage"),
                    "sourcePageLabel": page_label(page),
                    "pdfPage": pdf_page_no,
                    "thaiSimilarity": round(ratio, 4),
                    "corpusThaiChars": len(corpus_thai),
                    "pdfThaiChars": len(pdf_thai),
                    "corpusPairCount": len(page.get("children") or []),
                    "extractedPairCount": len(extracted.get("pairs") or []),
                }
            )

    low = [item for item in comparisons if item.get("thaiSimilarity", 1) < 0.985]
    return {
        "status": "ok",
        "note": "This compares corpus against the current extractor, not against human visual truth.",
        "comparedPages": len(comparisons),
        "lowSimilarityPages": len(low),
        "lowestPages": sorted(
            [item for item in comparisons if "thaiSimilarity" in item],
            key=lambda item: item["thaiSimilarity"],
        )[:20],
        "pageComparisons": comparisons,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit bilingual corpus extraction quality.")
    parser.add_argument("--corpus", type=Path, default=DEFAULT_CORPUS)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--pdf", type=Path, default=None)
    parser.add_argument("--compare-pdf", action="store_true")
    parser.add_argument("--max-pages", type=int, default=None)
    parser.add_argument("--lang-split", choices=("auto", "midpoint"), default="auto")
    args = parser.parse_args()

    if not args.corpus.exists():
        raise SystemExit(f"Corpus not found: {args.corpus}")

    corpus = load_json(args.corpus)
    corpus_audit = audit_corpus(corpus)
    report: dict[str, Any] = {
        "schema": "paligo.corpus-quality-report.v1",
        "title": corpus.get("title"),
        "provenance": {
            "corpus": file_fingerprint(args.corpus),
            "pdf": file_fingerprint(args.pdf) if args.pdf else None,
            "scripts": {
                "audit": file_fingerprint(Path(__file__).resolve()),
                "bilingualPdfLib": file_fingerprint(SCRIPT_DIR / "bilingual_pdf_lib.py"),
                "builder": file_fingerprint(SCRIPT_DIR / "build_dhammapada_bilingual_corpus.py"),
            },
            "comparison": {
                "langSplit": args.lang_split,
                "maxPages": args.max_pages,
                "usesCurrentExtractor": bool(args.compare_pdf),
            },
        },
        "corpusAudit": corpus_audit,
    }

    if args.compare_pdf:
        if not args.pdf:
            report["pdfComparison"] = {"status": "skipped", "reason": "No --pdf provided"}
        elif not args.pdf.exists():
            report["pdfComparison"] = {"status": "skipped", "reason": f"PDF not found: {args.pdf}"}
        else:
            report["pdfComparison"] = compare_pdf_to_corpus(
                pdf_path=args.pdf,
                corpus=corpus,
                max_pages=args.max_pages,
                lang_split=args.lang_split,
            )

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    top = corpus_audit["topFlaggedPages"][:5]
    print(
        f"Audited {corpus_audit['pages']} pages; "
        f"flagged {corpus_audit['flaggedPages']} pages "
        f"({corpus_audit['flaggedRatio']:.0%})."
    )
    if top:
        print("Top flagged pages:")
        for page in top:
            print(
                f"- sourcePage {page['sourcePageLabel']} / pdfPage {page['pdfPage']}: "
                f"{page['suspiciousCount']} hits ({', '.join(page['firstIssues'])})"
            )
    print(f"Wrote {args.out}")


if __name__ == "__main__":
    main()

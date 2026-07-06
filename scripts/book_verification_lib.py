from __future__ import annotations

import html
import json
import re
from datetime import datetime, timezone
from pathlib import Path

VERIFY_STATUSES = {
    "pending": "รอตรวจสอบ",
    "verified": "ยืนยันแล้ว",
    "issue": "พบปัญหา",
}

FOOTNOTE_START = "<!-- paligo-verify-footnote -->"
FOOTNOTE_END = "<!-- /paligo-verify-footnote -->"


def normalize_status(status: str | None) -> str:
    if status in VERIFY_STATUSES:
        return status
    return "pending"


def build_footnote_html(
    page_no: int,
    token_count: int,
    book_id: str,
    status: str = "pending",
    note: str = "",
) -> str:
    status = normalize_status(status)
    label = VERIFY_STATUSES[status]
    note_html = (
        f'<span class="book-verify-note">{html.escape(note.strip())}</span>' if note.strip() else ""
    )

    return f"""{FOOTNOTE_START}
  <footer class="book-page-footnote" data-verify-status="{status}" data-page="{page_no}">
    <span class="book-verify-badge book-verify-badge--{status}">{label}</span>
    <span class="book-verify-meta">หน้า {page_no} · {token_count} คำ · {html.escape(book_id)}</span>
    {note_html}
  </footer>
{FOOTNOTE_END}"""


def build_page_shell(
    page_no: int,
    page_width: float,
    page_height: float,
    body_html: str,
    footnote_html: str,
) -> str:
    return f"""<article class="book-page" data-page="{page_no}" style="--page-width:{round(page_width, 2)}pt;--page-height:{round(page_height, 2)}pt;--page-ratio:{round(page_width, 4)} / {round(page_height, 4)}">
{body_html}
{footnote_html}
</article>
"""


def patch_page_html(html_content: str, footnote_html: str) -> str:
    pattern = re.compile(
        rf"{re.escape(FOOTNOTE_START)}.*?{re.escape(FOOTNOTE_END)}",
        re.DOTALL,
    )
    if pattern.search(html_content):
        return pattern.sub(footnote_html, html_content, count=1)

    if "</article>" in html_content:
        return html_content.replace("</article>", f"{footnote_html}\n</article>", 1)

    return html_content + "\n" + footnote_html


def default_verification(book_id: str, page_numbers: list[int]) -> dict:
    return {
        "schema": "paligo.bookVerification.v1",
        "bookId": book_id,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "pages": {
            str(page_no): {
                "status": "pending",
                "note": "",
                "checkedAt": None,
            }
            for page_no in page_numbers
        },
    }


def load_verification(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def write_verification(path: Path, verification: dict) -> None:
    verification["updatedAt"] = datetime.now(timezone.utc).isoformat()
    path.write_text(json.dumps(verification, ensure_ascii=False, indent=2), encoding="utf-8")


def footnote_css() -> str:
    return """
.book-page-footnote {
  align-items: center;
  background: rgba(255, 250, 240, 0.94);
  border-top: 1px solid rgba(74, 44, 10, 0.16);
  bottom: 0;
  display: flex;
  flex-wrap: wrap;
  font-size: 11px;
  gap: 6px 10px;
  justify-content: space-between;
  left: 0;
  line-height: 1.3;
  padding: 5px 10px;
  pointer-events: none;
  position: absolute;
  right: 0;
  z-index: 4;
}

.book-verify-badge {
  border-radius: 999px;
  font-weight: 800;
  padding: 2px 10px;
  white-space: nowrap;
}

.book-verify-badge--pending {
  background: #fff3cd;
  color: #856404;
}

.book-verify-badge--verified {
  background: #d4edda;
  color: #155724;
}

.book-verify-badge--issue {
  background: #f8d7da;
  color: #721c24;
}

.book-verify-meta {
  color: rgba(52, 52, 52, 0.72);
  font-weight: 700;
}

.book-verify-note {
  color: rgba(114, 28, 36, 0.88);
  flex: 1 1 100%;
  font-weight: 700;
}
"""

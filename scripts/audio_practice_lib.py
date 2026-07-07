from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path

from book_verification_lib import to_thai_digits

QUESTION_START = re.compile(r"^[๐-๙0-9]+\.$")
ANNOTATION_START = re.compile(r"^\(")
HEADER_STOPWORDS = {
    "สนามหลวงแผนกบาลี",
    "ปัญหา-เฉลยประโยคบาลีสนามหลวง",
    "ประโยค",
    "ป.ธ.",
    "แปล",
    "มคธเป็นไทย",
    "สอบ",
    "วันที่",
    "มีนาคม",
    "ชั้นประโยค",
    "เฉลย",
}
PALI_TOKEN = re.compile(r"(ฯ$|[ก-ฮ][ฺํ]|โต$|ติ$|นฺติ$|มิ$|สุ$|ํ$|กฺ|ตฺ|ปฺ|มฺ|นฺ|ญฺ|ลฺ|สฺ|วฺ|รฺ|ห$)")


def looks_pali(text: str) -> bool:
    if text in {"ฯ", "ฯเปฯ"}:
        return True
    return bool(PALI_TOKEN.search(text))


def is_answer_page(words: list[dict]) -> bool:
    header_tokens = [word["text"] for word in words[:24]]
    return any(token == "เฉลย" for token in header_tokens)


def is_pali_question_block(tokens: list[dict]) -> bool:
    if len(tokens) < 2:
        return False

    sample = [token["text"] for token in tokens[1:12] if not QUESTION_START.match(token["text"])]
    if not sample:
        return False

    pali_hits = sum(1 for text in sample if looks_pali(text))
    return pali_hits >= max(2, len(sample) // 3)


def flatten_words(lines: list[list[dict]]) -> list[dict]:
    tokens: list[dict] = []
    for line in lines:
        for word in line:
            text = to_thai_digits(str(word.get("text") or "").strip())
            if text:
                tokens.append({**word, "text": text})
    return tokens


def is_header_token(text: str) -> bool:
    if text in HEADER_STOPWORDS:
        return True
    if re.fullmatch(r"[๐-๙0-9]+", text):
        return True
    if text in {"๔", "๖", "๒๕๒๙"}:
        return True
    return False


def extract_question_tokens(words: list[dict], question_no: int) -> list[dict]:
    label = f"{to_thai_digits(question_no)}."
    started = False
    collected: list[dict] = []

    for word in words:
        text = word["text"]
        if not started:
            if text == label:
                started = True
                collected.append(word)
            continue

        if ANNOTATION_START.match(text):
            break
        if QUESTION_START.match(text) and text != label:
            break

        collected.append(word)

    return collected


def group_tokens_into_sentences(tokens: list[dict]) -> list[list[dict]]:
    if not tokens:
        return []

    sentences: list[list[dict]] = []
    current: list[dict] = []

    for token in tokens:
        current.append(token)
        if token["text"].endswith("ฯ") or token["text"] == "ฯ":
            sentences.append(current)
            current = []

    if current:
        sentences.append(current)

    return sentences


def read_audio_duration_seconds(path: Path) -> float | None:
    if not path.is_file():
        return None

    try:
        from mutagen import File as MutagenFile

        audio = MutagenFile(path)
        if audio is not None and audio.info is not None and getattr(audio.info, "length", None):
            return float(audio.info.length)
    except ImportError:
        pass
    except Exception:
        pass

    ffprobe = shutil.which("ffprobe")
    if ffprobe:
        try:
            result = subprocess.run(
                [
                    ffprobe,
                    "-v",
                    "error",
                    "-show_entries",
                    "format=duration",
                    "-of",
                    "default=noprint_wrappers=1:nokey=1",
                    str(path),
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            value = result.stdout.strip()
            if value:
                return float(value)
        except (subprocess.CalledProcessError, ValueError):
            pass

    return None


def is_skippable_alignment_token(text: str) -> bool:
    return bool(QUESTION_START.match(text))


def token_alignment_weight(text: str) -> float:
    if is_skippable_alignment_token(text):
        return 0.0
    return float(max(1, len(text)))


def align_pack_proportional(pack: dict, duration: float, *, lead_in: float = 0.08, tail_pad: float = 0.05) -> dict:
    alignment = list(pack.get("alignment") or [])
    if not alignment or duration <= 0:
        return pack

    weighted_items: list[tuple[int, float]] = []
    total_weight = 0.0
    for index, item in enumerate(alignment):
        weight = token_alignment_weight(str(item.get("pali") or ""))
        if weight <= 0:
            continue
        weighted_items.append((index, weight))
        total_weight += weight

    if total_weight <= 0:
        return pack

    usable = max(0.1, duration - lead_in - tail_pad)
    cursor = lead_in

    sentence_bounds: dict[str, tuple[float, float]] = {}
    for index, weight in weighted_items:
        item = alignment[index]
        span = usable * (weight / total_weight)
        start = round(cursor, 3)
        end = round(min(duration, cursor + span), 3)
        cursor = end

        sid = str(item.get("sid") or "s1")
        item["start"] = start
        item["end"] = end
        bounds = sentence_bounds.get(sid)
        if bounds is None:
            sentence_bounds[sid] = (start, end)
        else:
            sentence_bounds[sid] = (bounds[0], end)

    for item in alignment:
        sid = str(item.get("sid") or "s1")
        if sid in sentence_bounds:
            s_start, s_end = sentence_bounds[sid]
            item["s_start"] = s_start
            item["s_end"] = s_end

    pack = dict(pack)
    pack["alignment"] = alignment
    pack["alignmentStatus"] = "ready"
    pack["alignmentMethod"] = "proportional"
    pack["audioDuration"] = round(duration, 3)
    return pack


def apply_pack_audio_update(
    pack_path: Path,
    *,
    audio_rel: str | None = None,
    duration: float | None = None,
    align: str | None = None,
) -> dict:
    pack = json.loads(pack_path.read_text(encoding="utf-8"))
    if audio_rel:
        pack["audio"] = audio_rel
    if duration is not None:
        pack["audioDuration"] = round(duration, 3)

    if align == "proportional" and duration is not None and duration > 0:
        pack = align_pack_proportional(pack, duration)

    pack_path.write_text(json.dumps(pack, ensure_ascii=False, indent=2), encoding="utf-8")
    return pack


def sync_practice_index_entry(output_dir: Path, pack: dict) -> None:
    index_path = output_dir / "practice" / "index.json"
    if not index_path.is_file():
        return

    index = json.loads(index_path.read_text(encoding="utf-8"))
    pack_id = pack.get("packId")
    updated = False
    for entry in index.get("packs", []):
        if entry.get("packId") != pack_id:
            continue
        entry["alignmentStatus"] = pack.get("alignmentStatus", entry.get("alignmentStatus"))
        entry["audio"] = pack.get("audio", entry.get("audio"))
        if pack.get("audioDuration") is not None:
            entry["audioDuration"] = pack["audioDuration"]
        if pack.get("alignmentMethod"):
            entry["alignmentMethod"] = pack["alignmentMethod"]
        updated = True
        break

    if updated:
        index_path.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")


def build_alignment(tokens_by_sentence: list[list[dict]]) -> list[dict]:
    alignment: list[dict] = []
    word_no = 1

    for sentence_index, sentence in enumerate(tokens_by_sentence, start=1):
        sid = f"s{sentence_index}"
        for token in sentence:
            alignment.append(
                {
                    "mid_code": f"w{word_no:03d}",
                    "sid": sid,
                    "pali": token["text"],
                    "thai_read": "",
                    "start": None,
                    "end": None,
                    "s_start": None,
                    "s_end": None,
                    "tokenIndex": word_no - 1,
                }
            )
            word_no += 1

    return alignment


def detect_questions_on_page(words: list[dict]) -> list[int]:
    numbers: list[int] = []
    for word in words:
        text = word["text"]
        if QUESTION_START.match(text):
            digit_text = text[:-1]
            for src, dst in zip("0123456789", "๐๑๒๓๔๕๖๗๘๙", strict=False):
                digit_text = digit_text.replace(dst, src)
            if digit_text.isdigit():
                numbers.append(int(digit_text))
    return sorted(set(numbers))


def build_practice_pack(
    book_id: str,
    pack_id: str,
    title: str,
    page_no: int,
    page_html: str,
    tokens_by_sentence: list[list[dict]],
    answer_page: int | None = None,
) -> dict:
    alignment = build_alignment(tokens_by_sentence)
    has_timing = any(item.get("start") is not None for item in alignment)

    return {
        "schema": "paligo.audioPracticePack.v1",
        "bookId": book_id,
        "packId": pack_id,
        "title": title,
        "page": page_no,
        "pageHtml": page_html,
        "answerPage": answer_page,
        "audio": f"practice/{pack_id}.mp3",
        "alignmentStatus": "ready" if has_timing else "tokens-only",
        "alignment": alignment,
    }


def export_practice_packs(
    output_dir: Path,
    book_id: str,
    book_title: str,
    page_entries: list[dict],
    page_words: dict[int, list[dict]],
) -> dict:
    practice_dir = output_dir / "practice"
    practice_dir.mkdir(parents=True, exist_ok=True)

    packs_meta: list[dict] = []
    seen_pack_ids: set[str] = set()
    question_answer_map = {
        1: 3,
        2: 4,
    }

    for page_entry in page_entries:
        page_no = int(page_entry["page"])
        words = page_words.get(page_no, [])
        if is_answer_page(words):
            continue

        question_numbers = detect_questions_on_page(words)

        if not question_numbers:
            continue

        for question_no in question_numbers:
            question_tokens = extract_question_tokens(words, question_no)
            if not question_tokens or not is_pali_question_block(question_tokens):
                continue

            pack_id = f"q{question_no}-pali"
            if pack_id in seen_pack_ids:
                continue
            seen_pack_ids.add(pack_id)
            pack = build_practice_pack(
                book_id=book_id,
                pack_id=pack_id,
                title=f"{book_title} · ประโยค {to_thai_digits(question_no)}",
                page_no=page_no,
                page_html=page_entry["html"],
                tokens_by_sentence=group_tokens_into_sentences(question_tokens),
                answer_page=question_answer_map.get(question_no),
            )

            pack_path = practice_dir / f"{pack_id}.json"
            pack_path.write_text(json.dumps(pack, ensure_ascii=False, indent=2), encoding="utf-8")

            packs_meta.append(
                {
                    "packId": pack_id,
                    "title": pack["title"],
                    "file": f"practice/{pack_id}.json",
                    "audio": pack["audio"],
                    "page": page_no,
                    "answerPage": pack["answerPage"],
                    "tokenCount": len(pack["alignment"]),
                    "alignmentStatus": pack["alignmentStatus"],
                }
            )

    index = {
        "schema": "paligo.audioPracticeIndex.v1",
        "bookId": book_id,
        "title": book_title,
        "packs": packs_meta,
    }
    (practice_dir / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")

    active_files = {f"{meta['packId']}.json" for meta in packs_meta}
    for stale_file in practice_dir.glob("q*-pali.json"):
        if stale_file.name not in active_files:
            stale_file.unlink()

    return index

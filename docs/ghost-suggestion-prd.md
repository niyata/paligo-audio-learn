# Ghost Suggestion — พลายกระซิบ (Workbook × PiP)

PRD สำหรับพลายกระซิบ: เสนอคำถัดไปจากเฉลยของหน้า PiP ขณะพิมพ์ในสมุดข้อสอบ

ชื่อผลิตภัณฑ์ใน UI: **พลายกระซิบ** (mascot ช้างผู้ · พลาย)

## Goal

ช่วยผู้เรียนพิมพ์ทีละศัพท์ โดยอิงลำดับเฉลยของหน้า/ช่วงที่เปิดอยู่ใน PiP — ไม่ใช่ autocomplete ทั้งพจนานุกรม และไม่ auto-fill ทั้งคาถา

ผู้ใช้เปิด/ปิดได้ด้วยปุ่ม toggle **พลายกระซิบ** บนแผงควบคุมสมุด (ค่าเริ่มต้น = เปิด · จำใน `localStorage`)

## Subjects

| วิชา | โจทย์ PiP | เฉลยสำหรับกระซิบ | สถานะ |
|------|-----------|------------------|--------|
| `thai-to-pali` (ทม) | `dhammapadatthakatha-meaning-thai-prototype` | `dhammapadatthakatha-pali-rtf-prototype` | พร้อม |
| `pali-to-thai` (มคธ→ไทย) | `mangalattha-pali-pathamo` | `mangalattha-thai-meaning-vol1` (#106) | UI พร้อม · blocked รอ OCR/text source สะอาด |

### Mangalattha Thai Answer Corpus (#106)

- Build script: `scripts/build_mangalattha_thai_meaning_vol1_corpus.py`
- Target output: `data/corpora/mangalattha-thai-meaning-vol1/`
- Current preferred PDF source is scanned/encoded; `pdftotext` produces mojibake, so the builder refuses to ship it as suggestions.
- Use `--source-text-dir <dir>` when clean page-level `.txt`, `.md`, or `.html` files are available. Filenames with numbers map to `sourcePage` so Cursor can pair them with `mangalattha-pali-pathamo`.
- Do not use `mangalattha-pt4-part1-sample` for Plai Whisper; it remains a low-quality OCR sample only.

## User flow (ทม — พร้อมใช้)

1. เปิด PiP ตำราธัมมปท · โหมด **ไทย (อรรถ)**
2. วิชา = **แปลไทยเป็นมคธ** · พลายกระซิบเปิด
3. พิมพ์บาลี → dropdown คำถัดไปจากเฉลย
4. Tab / Enter / คลิก · Esc ปิด

## User flow (มคธ→ไทย — หลัง #106)

1. เปิด PiP มังคลัตถทีปนีบาลี
2. วิชา = **แปลมคธเป็นไทย** · พลายกระซิบเปิด
3. พิมพ์ไทย → dropdown จากเฉลยไทยของหน้าเดียวกัน

## Architecture

```
PiP (page/mode change)
  → postMessage { sourcePage, itemId, languageVisibility, corpusId, answerCorpusId }
Workbook
  → activeReferenceContext + subject
  → load answer corpus (ทม=pali-rtf · มคธ→ไทย=thai-meaning-vol1)
  → suggestNextTokens(prefix + alignment)
  → dropdown at caret
```

## Acceptance

- [x] วิชา `thai-to-pali` + PiP → พิมพ์ prefix แล้วได้ dropdown
- [x] เลือกคำแล้วแทรกที่ caret ได้
- [x] ปิดด้วย Esc / คลิกนอก / ปุ่มพลายกระซิบ
- [x] ปุ่มพลายกระซิบเปิดได้ทั้งสองวิชาแปล
- [ ] วิชา `pali-to-thai` ได้ dropdown จริงหลังมี corpus จาก #106
- [x] annotation ตีเส้นไม่ regression

## Non-goals (MVP)

- AI generate เฉลย
- suggestion ทั้งเล่มแบบ fuzzy นอกหน้า PiP
- auto-fill ทั้งคาถาครั้งเดียว

## Files

- `paligo-ghost-suggestion.js` — token engine + cache
- `pali-reference-pip.html` — context `postMessage`
- `workbook.html` — dropdown UI + ปุ่มพลายกระซิบ

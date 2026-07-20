# Ghost Suggestion — Workbook × PiP (ทม)

PRD สั้นสำหรับ MVP: เสนอคำถัดไปจากเฉลยบาลีของหน้า PiP ขณะพิมพ์ในสมุดข้อสอบวิชา **แปลไทยเป็นมคธ**

## Goal

ช่วยผู้เรียนพิมพ์บาลีทีละศัพท์ โดยอิงลำดับเฉลยของหน้า/ช่วงที่เปิดอยู่ใน PiP — ไม่ใช่ autocomplete ทั้งพจนานุกรม และไม่ auto-fill ทั้งคาถา

## User flow

1. เปิด PiP ตำราธัมมปท · โหมด **ไทย (อรรถ)** ดูโจทย์ (เช่น หน้า ๓)
2. วิชาสมุด = **แปลไทยเป็นมคธ** · พิมพ์บาลีใน `.ruled-editor`
3. พิมพ์ prefix เช่น `มโนปุพฺพงฺ` → dropdown เสนอคำที่ตรง/คำถัดไปจากเฉลยบาลีของช่วงนั้น
4. เลือกทีละศัพท์ (Tab / Enter / คลิก) แล้วพิมพ์ต่อได้

## Data sources

| บทบาท | Corpus |
|--------|--------|
| โจทย์ที่ PiP แสดง | `dhammapadatthakatha-meaning-thai-prototype` |
| เฉลยสำหรับ suggestion | `dhammapadatthakatha-pali-rtf-prototype` |

ไม่ใช้ bilingual PDF OCR เป็นแหล่ง suggestion (คุณภาพโทเคนต่ำ)

## Architecture

```
PiP (page/mode change)
  → postMessage { sourcePage, itemId, languageVisibility, corpusId, answerCorpusId }
Workbook
  → activeReferenceContext
  → load answer page tokens
  → suggestNextTokens(prefix + alignment)
  → dropdown at caret
```

## Acceptance

- [ ] วิชา `thai-to-pali` + PiP เปิดหน้าเฉลย → พิมพ์ prefix แล้วได้ dropdown
- [ ] เลือกคำแล้วแทรกที่ caret ได้
- [ ] ปิดด้วย Esc / คลิกนอก
- [ ] วิชา `pali-to-thai` ไม่แสดง suggestion
- [ ] annotation ตีเส้นไม่ regression

## Non-goals (MVP)

- AI generate เฉลย
- suggestion ทั้งเล่มแบบ fuzzy นอกหน้า PiP
- auto-fill ทั้งคาถาครั้งเดียว
- ghost overlay เทาหลัง cursor ถ้าชน layout เส้นบรรทัด (dropdown ก่อน)

## Files

- `paligo-ghost-suggestion.js` — token engine + cache
- `pali-reference-pip.html` — context `postMessage`
- `workbook.html` — dropdown UI (เฉพาะทม)

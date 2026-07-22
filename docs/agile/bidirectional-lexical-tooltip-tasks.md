# Task Backlog: Bidirectional Lexical Tooltip + PAT Selection Tooltip

วันที่สร้าง: 2026-07-21
อัปเดตล่าสุด: 2026-07-22
Source PRD: [`docs/bidirectional-lexical-tooltip-prd.md`](../bidirectional-lexical-tooltip-prd.md)

---

## Epic

สร้างระบบ tooltip คำศัพท์สองทางและ PAT Selection Tooltip ที่ใช้ซ้ำได้ใน PiP, workbook, audio practice reader และ future course reader

---

## P0 — Interaction Contract

| ID | Task | Owner suggestion | Acceptance |
|----|------|------------------|------------|
| BLT-01 | แยก click-to-lookup ออกจาก selection-to-annotate ใน PiP | Codex / Cursor | ✅ คลิกคำเดียวเปิด lookup tooltip; ลากคลุมคำเปิด PAT Tooltip |
| BLT-02 | เพิ่ม pointer threshold และ guard สำหรับ pencil/eraser/report mode | Codex | ✅ click/drag ไม่ชนกัน และ Escape/reset state ยังทำงาน |
| BLT-03 | เพิ่ม smoke test สำหรับ click lookup และ drag PAT | Cursor / Integrator | ✅ test ยืนยัน `.is-click-lookup` สำหรับ click, ไม่ใช่สำหรับ drag, และ Escape reset ไม่ค้างโหมด |
| BLT-04 | ปรับ tooltip lookup mode ให้ซ่อน action ที่เป็น annotation | Codex | ✅ lookup tooltip ไม่แสดงปุ่มจัดการศัพท์/รายงาน/ออกข้อสอบ |

หมายเหตุ 2026-07-22:

- `pali-reference-pip.html` เพิ่ม pointer threshold + suppress window หลัง drag selection เพื่อกัน click lookup ยิงซ้ำหลังผู้ใช้ลากเลือกข้อความ
- lookup ถูก guard ไม่ให้ทำงานขณะ pencil/eraser mode หรือเมื่อคลิก control/breadcrumb ภายใน reader
- `scripts/audit-production-critical-pages.mjs` เพิ่ม smoke สำหรับ Escape/reset state หลัง click lookup และ selection PAT

---

## P1 — Data Model / Corpus Alignment

| ID | Task | Owner suggestion | Acceptance |
|----|------|------------------|------------|
| BLT-10 | ออกแบบ token schema สำหรับบาลี/ไทย | PALI-AI / Integrator | มี `tokenId`, `surface`, `normalized`, `lemma`, `pageId`, `lineId`, offsets |
| BLT-11 | ออกแบบ lexical alignment schema บาลี <-> ไทย | PALI-AI | รองรับ word-to-word, word-to-phrase, phrase-to-phrase, confidence |
| BLT-12 | สร้าง prototype alignment สำหรับเรื่องพระจักขุบาล | PALI-AI / Claude | คลิกคำตัวอย่างอย่างน้อย 20 จุดแล้วได้คู่แปลที่ตรวจได้ |
| BLT-13 | เพิ่ม worker API สำหรับ lookup token/alignment | Codex | PiP เรียก lookup โดยไม่ block main thread |

---

## P1 — Shared Plugin Architecture

| ID | Task | Owner suggestion | Acceptance |
|----|------|------------------|------------|
| BLT-20 | แยก Lexical Interaction Layer ออกจาก `pali-reference-pip.html` | Integrator | PiP mount plugin ผ่าน config/context provider |
| BLT-21 | ทำ storage/context adapter สำหรับ annotation ที่ผูก corpus/page/line/token | Codex | annotation ไม่ปน corpus/subject |
| BLT-22 | เพิ่ม preset config ต่อวิชา/ชั้นเรียน | Cursor | เพิ่ม grammar tag โดยไม่แก้ core tooltip logic |

---

## P2 — Audio Practice Extension

| ID | Task | Owner suggestion | Acceptance |
|----|------|------------------|------------|
| BLT-30 | สร้าง transcript token timing schema | PALI-AI / Claude | มี `audioId`, `tokenId`, `startMs`, `endMs` |
| BLT-31 | ทำ Audio Practice Reader host prototype | Cursor | playback highlight token ปัจจุบันและคลิก lookup ได้ |
| BLT-32 | เชื่อม selection-to-annotate กับ transcript | Codex | ลากคลุม transcript แล้วเปิด PAT Tooltip พร้อม audio context |

---

## QA / Regression

- `git diff --check`
- syntax check สำหรับ JS/inline script
- smoke: click word -> lookup tooltip
- smoke: drag selection -> PAT Tooltip
- smoke: pencil/eraser/report mode ไม่ทำให้ click lookup ทำงานผิด
- visual check บน desktop และ iPad-ish viewport

---

## Notes

- ห้ามใช้ emoji icon ใน production UI
- PiP เป็น implementation แรก แต่ฟีเจอร์ต้องไม่ hardcode กับ PiP เท่านั้น
- หน้าแปลด้วยเสียงควรเป็น host เพิ่มเมื่อมี time-coded token data ไม่ใช่ fork ของ tooltip logic

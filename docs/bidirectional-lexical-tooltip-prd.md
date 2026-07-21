# PRD: Bidirectional Lexical Tooltip + PAT Selection Tooltip

วันที่สร้าง: 2026-07-21
สถานะ: Draft / near-term feature source of truth
เกี่ยวข้อง: `pali-reference-pip.html`, `paligo-annotation-tools.js`, `paligo-reference-worker.js`, future corpus alignment data

---

## 1. เป้าหมาย

สร้างระบบ tooltip คำศัพท์สองทางสำหรับตำรา Paligo:

1. **Click-to-Lookup**: ผู้ใช้คลิกคำเดียวแล้วเห็น tooltip คำแปลเร็ว
   - คลิกคำบาลี -> เสนอคำแปลไทย
   - คลิกคำไทย -> เสนอคำบาลี
2. **Selection-to-Annotate**: ผู้ใช้ลาก cursor คลุมคำหรือช่วงประโยคแล้วเปิด **PAT Tooltip** เพื่อจัดการศัพท์, ขีดเส้น, ใส่วงเล็บ, รายงานเนื้อหา, และออกข้อสอบ

ฟีเจอร์นี้ต้องไม่ผูกกับหน้า PiP แบบ hardcode แต่ควรเป็น interaction contract ของ reader surfaces ทุกหน้า
เช่น PiP, workbook reader, audio practice reader, และ future course reader

---

## 2. คำศัพท์เทคนิค

| ชื่อ | ความหมาย |
|------|----------|
| Bidirectional Lexical Tooltip | Tooltip คำศัพท์สองทาง บาลี -> ไทย และ ไทย -> บาลี |
| Click-to-Lookup | คลิกคำเดียวเพื่อดูคำแปลเร็ว โดยไม่เข้าโหมดจัดการ annotation |
| Selection-to-Annotate | ลากคลุมข้อความเพื่อเปิด PAT Tooltip |
| PAT Tooltip | Paligo Annotation Tools tooltip สำหรับจัดการศัพท์/ขีดเส้น/รายงาน/ออกข้อสอบ |
| Lexical Alignment | ชั้นข้อมูลที่จับคู่ token/phrase บาลีกับ token/phrase ไทย |

---

## 3. Problem Statement

ก่อนมี feature contract ที่ชัดเจน tooltip มีความเสี่ยงชนกัน:

- คลิกคำเดียวอาจถูกตีความเป็น selection แล้วเปิด PAT Tooltip โดยไม่ตั้งใจ
- ลากคลุมคำเพื่อจัดการศัพท์อาจถูกแย่งด้วย lookup tooltip
- ระบบยังไม่มีชั้นข้อมูลที่บอกว่า token บาลีคำนี้สัมพันธ์กับคำไทยใด และคำไทยนี้สัมพันธ์กับบาลีคำใด
- ฟีเจอร์ใน PiP มีแนวโน้ม hardcode ทำให้ย้ายไปใช้ใน audio practice หรือ workbook reader ยาก

---

## 4. User Stories

1. ใน PiP ผู้ใช้คลิกคำบาลีหนึ่งคำ ระบบแสดง tooltip คำแปลไทยแบบเร็ว และไม่มีปุ่มจัดการศัพท์ให้รบกวน
2. ใน PiP ผู้ใช้คลิกคำไทยหนึ่งคำ ระบบแสดง tooltip เสนอคำบาลีเทียบ พร้อมบอกว่าเป็น mockup หรือ verified alignment
3. ผู้ใช้ลากคลุมคำหรือประโยค ระบบเปิด PAT Tooltip ที่มีเครื่องมือจัดการศัพท์ ขีดเส้น รายงาน และออกข้อสอบ
4. ผู้ใช้เปิดตำราแบบ 2 in 1 แล้วคลิกคำฝั่งไทยหรือบาลี ระบบใช้ breadcrumb/anchor เดียวกันในการ lookup
5. ผู้ใช้เรียนผ่านเสียงในอนาคต แล้วคลิก token ที่กำลังเล่นอยู่เพื่อ lookup หรือ selection เพื่อ annotate ได้ด้วยเครื่องมือเดียวกัน

---

## 5. Interaction Contract

### Click-to-Lookup

Trigger:

- pointer down/up ภายใน threshold เล็ก เช่น 5px
- ไม่มี active text selection
- ไม่อยู่ในโหมดดินสอ, ยางลบ, หรือ report modal

Behavior:

- หา token ใกล้ caret/pointer
- เปิด tooltip แบบ `lookup`
- ซ่อน action ของ PAT เช่น `จัดการศัพท์`, `รายงานเนื้อหา`, `ออกข้อสอบ`
- แสดงทิศทาง lookup:
  - `คำบาลี -> ไทย`
  - `คำไทย -> บาลี`

### Selection-to-Annotate

Trigger:

- pointer movement เกิน threshold หรือ browser selection ไม่ collapsed
- selection อยู่ใน reader surface

Behavior:

- เปิด PAT Tooltip
- แสดง action สำหรับ annotation ตาม preset ของวิชา
- เก็บ context ของ selection เช่น corpus, page, line, startOffset, endOffset, selectedText

---

## 6. Data Requirements

ฟีเจอร์นี้จะสมบูรณ์ได้เมื่อ corpus มีข้อมูล 4 ชั้น:

### 6.1 Canonical Text

- ข้อความบาลีและไทยที่ normalize แล้ว
- พินทุ/นิคคหิต/วรรณยุกต์ไม่เพี้ยน
- เชิงอรรถแยกออกจากเนื้อหาหลัก

### 6.2 Token Index

ตัวอย่าง:

```json
{
  "tokenId": "p14-l17-t08",
  "surface": "ธมฺโม",
  "normalized": "ธมฺโม",
  "lemma": "ธมฺม",
  "language": "pali",
  "pageId": "page-14",
  "lineId": "p14-line-17",
  "startOffset": 120,
  "endOffset": 126
}
```

### 6.3 Lexical Alignment

ตัวอย่าง:

```json
{
  "alignmentId": "aln-000421",
  "sourceTokenIds": ["pali-421"],
  "targetTokenIds": ["thai-lit-991", "thai-meaning-301"],
  "sourceLanguage": "pali",
  "targetLanguage": "thai",
  "type": "word-to-phrase",
  "translationMode": "literal",
  "confidence": "human_verified"
}
```

### 6.4 Lexicon / Grammar Metadata

- lemma
- คำแปลไทยหลายระดับ
- วิภัตติ/ลิงค์/วจนะ/หน้าที่ในประโยค
- ตัวอย่างจากตำรา
- source/confidence

---

## 7. Surface Strategy

### Recommendation

ไม่ควรสร้างฟีเจอร์นี้เป็นหน้าต่างแยกเฉพาะ "แปลด้วยเสียง" ตั้งแต่แรก
ควรทำเป็น **Shared Lexical Interaction Layer** แล้วให้แต่ละหน้าเป็น host:

| Host surface | บทบาท |
|--------------|-------|
| PiP | Reference reader หลักสำหรับ corpus, breadcrumb, tooltip, annotation |
| Workbook | พื้นที่ฝึกเขียนคำตอบ เชื่อม PiP/context และ ghost suggestion |
| Audio Practice Reader | หน้าแปลด้วยเสียงหรือฝึกฟัง ใช้ token timing + shared tooltip |
| Future Course Reader | หน้าเรียนเต็มรูปแบบที่ mount interaction layer เดียวกัน |

ดังนั้นคำตอบคือ: **รวม logic ไว้กับ shared layer, ใช้ PiP เป็น implementation แรก, แล้วสร้างหน้า audio practice เป็น host เพิ่มเมื่อมี time-coded token data**

---

## 8. Audio Translation Extension

ถ้าต้องรองรับการแปลด้วยเสียง ให้ใช้แนวทางนี้:

1. แยก audio transcript เป็น token/line พร้อม `startMs` และ `endMs`
2. map transcript token กับ corpus token ผ่าน `tokenId` หรือ `alignmentId`
3. ระหว่าง playback ให้ highlight token ปัจจุบัน
4. ผู้ใช้คลิก token ที่กำลังเล่น -> Click-to-Lookup
5. ผู้ใช้ลากคลุม transcript -> Selection-to-Annotate

ตัวอย่างข้อมูล:

```json
{
  "audioId": "chakkhupala-page-03",
  "tokenId": "p03-l04-t06",
  "startMs": 18420,
  "endMs": 19110,
  "surface": "ธมฺโม"
}
```

---

## 9. Acceptance Criteria

- คลิกคำเดียวเปิด lookup tooltip และไม่เปิด PAT actions
- ลากคลุมคำเปิด PAT Tooltip และไม่เข้า click lookup mode
- lookup tooltip บอกทิศทาง บาลี -> ไทย หรือ ไทย -> บาลี
- PAT Tooltip ยังรองรับจัดการศัพท์, ขีดเส้น, ใส่วงเล็บ, รายงาน, ออกข้อสอบ
- interaction threshold ป้องกัน click/drag ชนกัน
- ใช้ SVG icon เท่านั้น ไม่มี emoji icon ใน production UI
- ข้อมูล lookup/annotation ผูกกับ corpus/page/line/token context
- มีทางขยายไป audio practice ผ่าน token timing โดยไม่ fork tooltip logic

---

## 10. Non-Goals รอบแรก

- ยังไม่ต้องมี lexical alignment ครบทั้งเล่ม
- ยังไม่ต้องแปลด้วย AI สดทุกคำ
- ยังไม่ต้องทำ audio practice reader production ใน slice แรก
- ยังไม่ต้อง sync annotation ข้ามผู้ใช้แบบ realtime

---

## 11. Open Questions

- ในกรณีคำไทยหนึ่ง phrase จับกับบาลีหลายคำ tooltip ควรเปิดเป็น card เดียวหรือ list หลายคำ
- ถ้า selection ข้าม line/page ควรสร้าง annotation เดียวหรือหลาย segment
- ควรใช้ alignment จากแปลโดยพยัญชนะเป็นหลัก หรือ 2 in 1 เป็นหลัก
- Audio practice reader ควรอยู่ใน PiP modal หรือเป็นหน้าเต็มเมื่อเริ่มมี waveform/transcript

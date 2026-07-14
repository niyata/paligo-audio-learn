# PRD: Lesson/Text Reference Cards → Inbox

วันที่สร้าง: 2026-07-10
สถานะ: Backlog / near-term design source of truth
เกี่ยวข้อง: `exam-inbox.html`, `exam-inbox-tailwind.html`, `book-page-viewer.html`, `pali-reference-pip.html`, `pali-audio-hightlight.html`, `paligo-inbox-chat.js`

---

## 1. เป้าหมาย

Paligo ต้องทำให้ “เนื้อหาบทเรียน” และ “ข้อความในตำรา” กลายเป็นวัตถุที่แชร์เข้า inbox ได้เหมือน card ในแชท ไม่ใช่แค่ copy ข้อความธรรมดา

ฟีเจอร์นี้รองรับ pattern การสอนและออกข้อสอบของครูบาลี:

> ครูเลือกช่วงข้อความจากตำรา เช่น ต้นประโยคของหน้าหนึ่งไปจนถึงท้ายประโยคอีกหน้า แล้วส่งเป็น card เข้า inbox/group เพื่อใช้เป็นข้อสอบ แบบฝึกหัด จุดถาม หรือ reference สำหรับการตรวจ

---

## 2. User Stories

1. ในหน้าบทเรียน ผู้ใช้กดปุ่มแชร์หรือ @mention เพื่อส่งเนื้อหาบทเรียนเป็น card เข้า inbox ได้
2. ในหน้าตำรา ผู้ใช้ลาก/แตะเลือกช่วงข้อความตั้งแต่จุดเริ่มต้นไปจนถึงจุดสิ้นสุด แม้ข้ามหน้า ข้ามข้อ หรือข้ามย่อหน้าได้
3. หลังเลือกข้อความ ผู้ใช้กด `แชร์ไป Inbox` แล้วเลือกผู้รับ เช่น ครู นักเรียน หรือกลุ่มตรวจ
4. ใน inbox ผู้รับเห็น card ที่แสดง handle/pointer ของพิกัดข้อความ ไม่ใช่แค่ข้อความยาว ๆ
5. card ต้องเปิดกลับไปยังตำแหน่งต้นทางในตำราได้ และ highlight ช่วงที่แชร์ไว้

---

## 3. Core Concepts

### Lesson Card

การ์ดบทเรียนทั่วไป เช่น unit, chapter, audio lesson, exercise set หรือ grammar topic

ตัวอย่าง:

```text
บทเรียน: มังคลัตถทีปนี เล่ม ๑ · ป.ธ. ๔
หัวข้อ: การแปลประโยคยาว
ส่งเข้า: กลุ่มประโยค ป.ธ. ๔
```

### Text Reference Card

การ์ดที่อ้างช่วงข้อความเฉพาะจากตำรา โดยต้องมี start anchor และ end anchor

ตัวอย่าง handle ที่ต้องแสดงใน inbox:

```text
>> ข้อสอบ/แบบฝึกหัด หน้าที่ ๑๓ บรรทัดที่ ๕ เริ่มที่ศัพท์ สตฺถา กเถสิ...
 - หน้าที่ ๑๕ บรรทัดที่ ๑๑ จบที่คำศัพท์ ...ธมฺมํ สุตฺวา วนฺเทสิ ฯ <<
```

---

## 4. UX Requirements

### 4.1 Share จากบทเรียน

ทุกหน้าที่เป็นบทเรียนควรมี action มาตรฐาน:

| Action | พฤติกรรม |
|--------|----------|
| `แชร์` | เปิด recipient picker แล้วส่ง lesson card เข้า inbox |
| `@mention` | เปิด inline recipient picker หรือ share sheet เพื่อส่ง reference เข้า thread ที่เลือก |
| `ส่งให้กลุ่ม` | shortcut เมื่อผู้ใช้อยู่ใน group context |

การ์ดใน inbox ต้องมี:

- ชื่อบทเรียน
- corpus / ชั้น / วิชา
- preview สั้น
- ปุ่ม `เปิดบทเรียน`
- sender และ recipient/group
- timestamp

### 4.2 เลือกข้อความในตำรา

รองรับ selection 3 ระดับ:

| ระดับ | ตัวอย่าง |
|-------|----------|
| ประโยค | เลือกหนึ่งประโยคบาลี |
| ช่วงภายในหน้า | หน้า ๑๓ บรรทัด ๕ ถึงหน้า ๑๓ บรรทัด ๑๒ |
| ช่วงข้ามหน้า | หน้า ๑๓ บรรทัด ๕ ถึงหน้า ๑๕ บรรทัด ๑๑ |

หลัง selection ต้องแสดง toolbar แบบไม่บังเนื้อหา:

- `แชร์ไป Inbox`
- `ทำเป็นแบบฝึกหัด`
- `คัดลอกพิกัด`
- `ยกเลิก`

### 4.3 พิกัดข้อความที่ผู้ใช้มองเห็น

UI ต้องแสดง handle แบบมนุษย์อ่านได้:

```text
หน้าที่ ๑๓ บรรทัดที่ ๕ เริ่มที่ศัพท์ สตฺถา กเถสิ...
ถึง หน้าที่ ๑๕ บรรทัดที่ ๑๑ จบที่คำศัพท์ ...ธมฺมํ สุตฺวา วนฺเทสิ ฯ
```

ถ้ามี `chapter`, `kho`, `paragraph` ให้แสดงเพิ่ม:

```text
มังคลัตถทีปนี เล่ม ๑ · ข้อ ๒๔ · หน้า ๑๓:๕ → หน้า ๑๕:๑๑
```

### 4.4 Card UI ใน Inbox

Text reference card ต้องไม่แสดงเนื้อหายาวทั้งก้อนเป็น default แต่ต้อง scan ได้เร็ว:

- badge: `ข้อความตำรา`
- title: ชื่อตำรา / บท / ข้อ
- range handle: หน้า/บรรทัด/คำเริ่มต้น/คำสิ้นสุด
- preview: ต้นข้อความและท้ายข้อความ
- actions:
  - `เปิดตำรา`
  - `เปิดเป็นข้อสอบ`
  - `ส่งต่อ`
  - `บันทึกไว้สอน`

---

## 5. Data Model

### `paligo.lesson.card.v1`

```json
{
  "schema": "paligo.lesson.card.v1",
  "id": "lesson-card-uuid",
  "lessonId": "mangalattha-pt4-book1-unit-001",
  "title": "มังคลัตถทีปนี เล่ม ๑",
  "subject": "pali-to-thai",
  "grade": "pt4",
  "preview": "บทเรียนเรื่องการแปลประโยคยาว...",
  "sourceUrl": "pali-reference-pip.html?lessonId=...",
  "createdAt": "2026-07-10T00:00:00.000Z"
}
```

### `paligo.textReference.card.v1`

```json
{
  "schema": "paligo.textReference.card.v1",
  "id": "text-ref-uuid",
  "corpusId": "mangalattha-dipani-book-1",
  "corpusTitle": "มังคลัตถทีปนี เล่ม ๑",
  "grade": "pt4",
  "subject": "pali-to-thai",
  "range": {
    "start": {
      "page": 13,
      "line": 5,
      "paragraphId": "p13-para-02",
      "tokenIndex": 8,
      "word": "สตฺถา",
      "snippet": "สตฺถา กเถสิ..."
    },
    "end": {
      "page": 15,
      "line": 11,
      "paragraphId": "p15-para-04",
      "tokenIndex": 21,
      "word": "วนฺเทสิ",
      "snippet": "...ธมฺมํ สุตฺวา วนฺเทสิ ฯ"
    }
  },
  "displayHandle": "หน้าที่ ๑๓ บรรทัดที่ ๕ เริ่มที่ศัพท์ สตฺถา กเถสิ... - หน้าที่ ๑๕ บรรทัดที่ ๑๑ จบที่คำศัพท์ ...ธมฺมํ สุตฺวา วนฺเทสิ ฯ",
  "textPreview": {
    "start": "สตฺถา กเถสิ...",
    "end": "...ธมฺมํ สุตฺวา วนฺเทสิ ฯ"
  },
  "sourceUrl": "pali-reference-pip.html?corpusId=mangalattha-dipani-book-1&start=p13l5t8&end=p15l11t21",
  "createdAt": "2026-07-10T00:00:00.000Z"
}
```

---

## 6. Inbox Integration

### Message type

เพิ่ม message/card type ใน `paligo-inbox-chat.js`:

| Type | ใช้กับ |
|------|--------|
| `lesson_card` | แชร์บทเรียนทั้งหน่วย |
| `text_reference_card` | แชร์ช่วงข้อความจากตำรา |
| `exercise_seed_card` | ใช้ช่วงข้อความนั้นสร้างข้อสอบ/แบบฝึกหัด |

### API payload ระยะ MVP

ส่งเป็น `package` หรือ `message attachment` ที่ metadata อยู่ใน inbox item:

```json
{
  "type": "text_reference_card",
  "payload": {
    "schema": "paligo.textReference.card.v1",
    "corpusId": "mangalattha-dipani-book-1",
    "range": {}
  }
}
```

### Group workflow

เมื่อส่งเข้า group:

- card ปรากฏใน group thread
- สมาชิกกลุ่มกดเปิดตำราได้
- ครูสามารถกด `เปิดเป็นข้อสอบ` เพื่อสร้าง exam book draft หรือ assignment จาก reference นั้น
- ระบบเก็บว่า reference นี้ถูกใช้สร้างข้อสอบครั้งใดบ้าง

---

## 7. Selection Engine Requirements

### Anchoring

ห้าม anchor ด้วย plain text อย่างเดียว เพราะตำราอาจมีคำซ้ำจำนวนมาก

ต้องใช้ anchor รวม:

- `corpusId`
- `page`
- `line`
- `paragraphId`
- `tokenIndex`
- `word`
- `textHash` ของบรรทัด/ย่อหน้า

### Cross-page selection

Selection ต้องรองรับ:

1. จุดเริ่มต้นอยู่หน้าปัจจุบัน
2. ผู้ใช้เปลี่ยนหน้าโดย selection ยัง active
3. ผู้ใช้แตะจุดสิ้นสุดในหน้าถัดไป
4. ระบบสร้าง range card ที่มี start/end anchor ถูกต้อง

### Visual behavior

- ช่วงที่เลือกต้อง highlight แบบต่อเนื่อง แม้ข้ามหน้า
- ถ้าเปิดกลับจาก inbox ให้ scroll ไป start anchor และแสดง highlight ทั้ง range
- ถ้าข้อมูลหน้าเปลี่ยนและ anchor resolve ไม่ได้ ให้ fallback ไป corpus/chapter พร้อม warning `ตำแหน่งเดิมอาจเปลี่ยน`

---

## 8. Exam Pattern: ครูบาลีออกข้อสอบ

ฟีเจอร์นี้ต้องรองรับ workflow ของครู:

```mermaid
flowchart LR
  A[เปิดตำรา] --> B[เลือกต้นประโยค]
  B --> C[ลาก/ข้ามหน้าไปท้ายประโยค]
  C --> D[แชร์เข้า Inbox/Group]
  D --> E[นักเรียนเห็น Text Reference Card]
  E --> F[เปิดเป็นแบบฝึกหัดหรือข้อสอบ]
  F --> G[เขียนคำตอบในสมุดข้อสอบ]
```

ตัวอย่าง card ที่ครูคาดหวัง:

```text
ข้อสอบ/แบบฝึกหัด
มังคลัตถทีปนี เล่ม ๑ · ป.ธ. ๔

>> หน้าที่ ๑๓ บรรทัดที่ ๕ เริ่มที่ศัพท์ สตฺถา กเถสิ...
 - หน้าที่ ๑๕ บรรทัดที่ ๑๑ จบที่คำศัพท์ ...ธมฺมํ สุตฺวา วนฺเทสิ ฯ <<

[เปิดตำรา] [เปิดเป็นข้อสอบ] [ส่งต่อ]
```

---

## 9. Phases

### Phase A — Prototype UI

- เพิ่ม card mock ใน `exam-inbox-tailwind.html`
- เพิ่มปุ่ม `แชร์บทเรียน` / `แชร์ข้อความตำรา`
- render card แบบ inbox Tailwind prototype

### Phase B — Static lesson card

- `pali-reference-pip.html` หรือ `book-page-viewer.html` ส่ง `paligo.lesson.card.v1` เข้า local inbox chat
- เปิด card กลับไป source URL ได้

### Phase C — Text range selection

- ทำ selection engine สำหรับ page/line/token
- สร้าง `paligo.textReference.card.v1`
- แสดง handle แบบหน้า/บรรทัด/คำเริ่ม-คำจบ

### Phase D — Cross-page selection

- selection state ข้ามหน้า
- resolve highlight เมื่อเปิดกลับจาก inbox
- fallback เมื่อ anchor หาย

### Phase E — Exercise seed

- ปุ่ม `เปิดเป็นข้อสอบ`
- สร้าง exam book draft จาก text reference
- ผูก reference card กับ book/exam history

---

## 10. Acceptance Criteria

- [ ] ผู้ใช้แชร์บทเรียนเป็น card เข้า inbox ได้
- [ ] card แสดงชื่อบทเรียน วิชา ชั้น preview และปุ่มเปิดกลับ
- [ ] ผู้ใช้เลือกข้อความจากหน้าเดียวกันเป็น text reference card ได้
- [ ] ผู้ใช้เลือกข้อความข้ามหน้าได้
- [ ] card แสดง handle แบบ `หน้า/บรรทัด/คำเริ่มต้น - หน้า/บรรทัด/คำสิ้นสุด`
- [ ] เปิด card จาก inbox แล้วกลับไปตำแหน่งต้นทางพร้อม highlight ได้
- [ ] group inbox รับ text reference card ได้
- [ ] `เปิดเป็นข้อสอบ` สร้างสมุด/assignment จาก reference ได้
- [ ] anchor ไม่พังเมื่อมีคำบาลีซ้ำในหน้าเดียวกัน

---

## 11. Out of Scope รอบแรก

- OCR/สร้าง token จาก PDF ใหม่
- collaborative realtime annotation
- AI สร้างข้อสอบเต็มรูปแบบอัตโนมัติ
- sync ข้อมูลตำราทั้ง corpus ขึ้น server ถ้ายังไม่ผ่าน content/import policy

---

## 12. Open Questions

1. Source of truth ของตำราแต่ละเล่มจะอยู่ใน `data/` หรือดึงจาก PALI-AI corpus?
2. page/line/token จะสร้างระหว่าง import corpus หรือคำนวณจาก layout runtime?
3. card เข้า inbox ควรเป็น message ธรรมดา หรือ package type ใหม่แยกจาก `bookTransfer`?
4. ควรให้ผู้เรียนสร้าง text reference เองได้หรือเฉพาะครู/ผู้ตรวจ?
5. เมื่อ share เข้า group จะ notify สมาชิกทุกคนหรืออยู่ใน thread เฉย ๆ?

---

## 13. Related Docs

- `docs/exam-inbox-v1-spec.md`
- `docs/agile/inbox-sprint-backlog.md`
- `docs/pali-learning-app-prd-roadmap.md`
- `docs/PALI-AI_HANDOFF_v2.md`
- `docs/pali-ai/CURRICULUM-OFFICIAL.md`
- `book-page-viewer.html`
- `pali-reference-pip.html`
- `pali-audio-hightlight.html`

# PRD: Shared Annotation Plugin / Corpus-Scoped Annotation

วันที่สร้าง: 2026-07-16
สถานะ: Draft / near-term feature source of truth
เกี่ยวข้อง: `pali-reference-pip.html`, `workbook.html`, reader/PiP surfaces, future annotation plugin/config

ดูเพิ่ม: `docs/reference-workspace-modes-prd.md` สำหรับโหมดเปิดตำราแบบลอย/ฝังข้าง/ฝังบนล่าง โดยต้องใช้ annotation core เดียวกัน

ฟีเจอร์เฉพาะที่แตกออกจาก PRD นี้:

- [`docs/bidirectional-lexical-tooltip-prd.md`](bidirectional-lexical-tooltip-prd.md) — Bidirectional Lexical Tooltip + PAT Selection Tooltip

---

## 1. เป้าหมาย

สร้างระบบ annotation กลางที่นำไปใช้ซ้ำได้ในหลายตำรา หลายวิชา หลายชั้นเรียน และหลายหน้าจอ เช่น PiP, workbook, reader หรือหน้าเรียน โดยไม่ hardcode เครื่องมือ tooltip ไว้เฉพาะโปรแกรม ป.ธ. ๔

หลักการสำคัญเรียกว่า **Corpus-Scoped Annotation** หรือ **Context-Bound Annotation**:

> annotation ทุกชิ้นต้องผูกกับบริบทตำราที่สร้างมันขึ้นมาเสมอ เช่น course, subject, corpus, page, line, selection และ tool config ที่ใช้ในขณะนั้น

Tooltip เป็นเพียง UI surface สำหรับสร้าง/แก้ annotation เท่านั้น ข้อมูลจริงต้องถูกเก็บคู่กับตำราและตำแหน่งอ้างอิงที่เรียกใช้ tooltip นั้น

---

## 2. ปัญหาที่ต้องแก้

ถ้า tooltip/remark ถูกเขียนแบบ hardcode ต่อหน้าเดียว จะเกิดปัญหา:

- คำศัพท์ที่จำจากตำราหนึ่งอาจไปโผล่ในอีกตำราหนึ่ง
- grammar tag ของวิชาหนึ่งอาจไม่เหมาะกับอีกวิชา
- right bar แสดงรายการจำศัพท์/รายงาน/ขีดเส้นโดยไม่รู้บริบทตำรา
- tooltip หนึ่งหน้าไม่รู้ว่า selection มาจากหน้า บรรทัด หรือ corpus ใด
- ย้ายเครื่องมือไปใช้กับ workbook หรือ course อื่นแล้วต้องแก้โค้ดซ้ำ

---

## 3. User Stories

1. ผู้ใช้เลือกคำใน PiP แล้วกดจำศัพท์ ระบบบันทึกคำพร้อมตำแหน่งในตำรา หน้า และบรรทัดนั้น
2. ผู้ใช้ขีดเส้นใต้คำบาลีด้วย grammar tag เช่น ประธาน กิริยา หรือวิภัตติ แล้วเห็นรายการนั้นใน right bar เฉพาะตำรา/หน้าที่เกี่ยวข้อง
3. ผู้ใช้เปิดตำราอื่นหรือวิชาอื่น แล้วไม่เห็น annotation ที่ไม่เกี่ยวข้อง
4. ผู้พัฒนาสามารถเพิ่มชุด grammar tag สำหรับวิชาใหม่ผ่าน config โดยไม่ต้องแก้ core tooltip logic
5. ผู้ใช้กดรายงานคำผิดจาก tooltip แล้วระบบผูก report กับ selection ตรงคำ/บรรทัดนั้น

---

## 4. Core Concepts

### Annotation Context

ทุก annotation ต้องมี context ขั้นต่ำ:

```json
{
  "schema": "paligo.annotation.v1",
  "id": "ann-uuid",
  "courseId": "pt4",
  "subjectId": "thai-to-pali",
  "corpusId": "dhammapadatthakatha-book1",
  "manifestPath": "data/corpora/dhammapadatthakatha-pali-rtf-prototype/manifest.json",
  "surface": "pip",
  "pageId": "page-14",
  "sourcePage": 14,
  "lineId": "p14-line-17",
  "selection": {
    "text": "เทวมฺนุสฺสานํ",
    "startOffset": 120,
    "endOffset": 132,
    "startTokenId": "p14-l17-t08",
    "endTokenId": "p14-l17-t08"
  },
  "tool": {
    "type": "grammar-tag",
    "presetId": "pt4-pali-grammar",
    "tagId": "b-p"
  },
  "createdAt": "2026-07-16T00:00:00.000Z",
  "schemaVersion": 1
}
```

### Tooltip Surface

Tooltip ต้องรับ context จาก host page ผ่าน API ไม่ควรเดาเองจาก DOM อย่างเดียว:

```js
PaligoAnnotationTools.init({
  host: 'pip',
  readerEl,
  tooltipEl,
  drawerEl,
  contextProvider: () => ({
    courseId,
    subjectId,
    corpusId,
    manifestPath,
    pageId,
    sourcePage
  }),
  preset,
  storageAdapter
});
```

### Config / Preset

แต่ละวิชาใช้ config ของตัวเองได้ เช่น:

```json
{
  "presetId": "pt4-pali-grammar",
  "label": "ป.ธ. ๔ · บาลีไวยากรณ์",
  "features": ["memory", "grammar-tag", "report", "shape"],
  "tags": [
    { "id": "b-p", "label": "ป.", "name": "ประธาน", "color": "#d14343" },
    { "id": "b-v-kit", "label": "กก.", "name": "กิริยากิตก์", "color": "#1f8f5f" }
  ],
  "icons": "paligo-svg-only"
}
```

---

## 5. UX Requirements

- Tooltip ต้องแสดงข้อมูลตาม selection ปัจจุบัน และปิด/รีเซ็ต tool mode ได้ชัดเจน
- Right bar ต้องแสดง list ตามบริบท เช่น หน้าปัจจุบัน, เรื่องปัจจุบัน, corpus ปัจจุบัน หรือทั้ง course
- Reader/PiP ต้องมี **semantic breadcrumb** สำหรับตำราบาลี โดยแสดงลำดับพิกัดตำรา เช่น หน้า → เล่ม/ภาค → วรรค → เรื่อง → ประเด็น
- ปุ่มจำศัพท์ควรเป็น entry point ของเครื่องมือจำ/ขีดเส้น/รายงาน แต่การบันทึกจริงต้องเกิดเมื่อผู้ใช้เลือก action ชัดเจน
- เครื่องมือยางลบต้องลบ annotation ที่ผู้ใช้ชี้/คลิกจริง ไม่ล้างข้อมูลทั้งหน้าโดยไม่ตั้งใจ
- ไอคอนใน UI ต้องใช้ SVG icon ตามระบบของ Paligo เท่านั้น ห้ามใช้ emoji icon ใน production UI

### Semantic Breadcrumb สำหรับตำราบาลี

Breadcrumb ใน reader ไม่ใช่แค่ตัวบอกตำแหน่ง แต่เป็น **semantic index** ของตำรา เพื่อให้ใช้ซ้ำกับการนำทาง lookup, annotation context, share card และ future course/corpus อื่น ๆ

ลำดับมาตรฐาน:

```text
หน้า → เล่ม/ภาค → วรรค → เรื่อง → ประเด็น
```

ตัวอย่างจากธัมมปทัฏฐกถา:

```text
หน้า ๓ → ธัมมปทัฏฐกถาแปล ภาค ๑ หน้า ๓ → ๑. ยมกวรรค วรรณนา → ๑. เรื่องพระจักขุบาลเถระ* → ข้อความเบื้องต้น
```

พฤติกรรมของ breadcrumb:

| ระดับ | เมื่อกด | ขอบเขต lookup |
|-------|--------|---------------|
| หน้า | นำทางหรือคงเป็นตำแหน่งอ้างอิง | หน้าปัจจุบัน |
| เล่ม/ภาค | ใช้เป็นบริบทตำรา | corpus ปัจจุบัน |
| วรรค | แสดงรายการเรื่องในวรรคนั้น | เฉพาะวรรคที่เลือก |
| เรื่อง | แสดงรายการเรื่องทุกเรื่องในเล่ม | corpus ปัจจุบัน |
| ประเด็น | แสดงรายการประเด็นในเรื่องนั้น | เฉพาะเรื่องที่เลือก ห้ามข้ามเรื่อง |

ข้อกำหนดสำคัญ:

- ป้าย `เรื่อง` ต้องเปิดรายการเรื่อง ไม่ใช่รายการประเด็น
- ป้าย `ประเด็น` เช่น `[ข้อความเบื้องต้น]` ต้องเปิดรายการประเด็นภายในเรื่องเดียวกันเท่านั้น
- รายการประเด็นต้องไม่กรองข้ามเรื่อง แม้อยู่หน้าเดียวกันหรือวรรคเดียวกัน
- breadcrumb ต้องเป็นข้อมูลที่ผูกกับ `corpusId`, `pageId`, `sourcePage`, `storyId/episodeId`, และ `topicId`
- การสร้างตำราชั้นอื่นในอนาคตต้องสามารถ map โครงสร้างของตำรานั้นเข้ากับ hierarchy นี้ หรือประกาศ hierarchy เฉพาะ corpus ผ่าน config

---

## 6. Storage Requirements

ระยะ prototype:

- เก็บใน `localStorage` ได้ แต่ key ต้อง namespace ด้วย `corpusId`, `subjectId`, และ schema version
- ห้ามใช้ key กลางที่ทำให้หลายตำราปนกัน

ตัวอย่าง:

```text
paligo.annotations.v1:pt4:thai-to-pali:dhammapadatthakatha-book1
```

ระยะ production:

- ย้ายไป API/storage กลาง เช่น D1/KV/R2 metadata หรือฐานข้อมูลหลัก
- รองรับ user-owned annotations และ teacher/reviewer reports
- รองรับ migration จาก local prototype ไป backend

---

## 7. Acceptance Criteria

- ใช้ plugin เดียวกัน mount ได้อย่างน้อยใน `pali-reference-pip.html` และ `workbook.html`
- annotation จาก corpus หนึ่งไม่แสดงในอีก corpus หนึ่ง
- annotation จาก subject หนึ่งไม่ปนกับอีก subject หนึ่ง ถ้า config กำหนดให้แยก
- right bar filter ได้ตาม current page, current episode/story, current corpus และ current course
- เพิ่ม grammar tag ใหม่ได้ผ่าน config โดยไม่แก้ core renderer
- report จาก tooltip มี page/line/selection reference ครบ
- UI icon ทั้งหมดในเครื่องมือ annotation ใช้ SVG ไม่ใช้ emoji
- `git diff --check` และ syntax check ของไฟล์ที่เกี่ยวข้องต้องผ่านก่อนส่งงาน

---

## 8. Non-Goals รอบแรก

- ยังไม่ทำ real-time sync ระหว่างผู้ใช้หลายคน
- ยังไม่ทำ conflict resolution ระหว่างครู/นักเรียน
- ยังไม่ผูก dictionary จริงทุกคำ
- ยังไม่ทำ cross-corpus alignment ระหว่างบาลี/ไทยแบบสมบูรณ์
- ยังไม่ทำ admin UI สำหรับ preset editor เต็มรูปแบบ

---

## 9. Open Questions

- ถ้า selection ข้ามหน้า ควรเก็บเป็น annotation เดียวหรือหลาย segment
- โหมด 2 in 1 ควรใช้ anchor ฝั่งไทยเป็นหลัก ฝั่งบาลีเป็นหลัก หรือใช้ alignment table กลาง
- report ที่มาจากนักเรียนควรเห็นเฉพาะเจ้าของ ครูประจำกลุ่ม หรือ super admin
- grammar preset ระดับชั้น ป.ธ. ควรแยกจาก preset ระดับวิชาหรือรวมกัน
- ข้อมูลจำศัพท์ควร sync ไปหน้าโปรไฟล์ทันที หรือเก็บใน right bar ก่อนแล้วค่อยรวมเข้าคลังศัพท์

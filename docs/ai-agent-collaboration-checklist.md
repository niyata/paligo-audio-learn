# AI Agent Collaboration Checklist

ใช้ checklist นี้ก่อนให้ AI agent หลายตัวทำงานในโปรเจ็คนี้

## ก่อนเริ่มงาน

- ตรวจ `git status --short --branch`
- อ่านเอกสารเหล่านี้ก่อนแก้ระบบ:
  - `docs/system-architecture-overview.md`
  - `docs/system-flow-map.md`
  - `docs/offline-data-safety-and-book-model.md`
  - `docs/offline-online-sync-boundary.md`
  - `docs/exam-scoring-leaderboard-plan.md`
  - `docs/thai-ui-language-rules.md`
- ระบุ ownership ของไฟล์/โมดูลที่ agent แต่ละตัวรับผิดชอบ
- ห้ามให้ agent สองตัวแก้ไฟล์เดียวกันพร้อมกัน ถ้าไม่จำเป็น

## กฎ Data Safety

- ห้ามเปลี่ยน storage key โดยไม่มี migration
- ห้ามลบ `ownerId`, `bookId`, `schema`, `revision` จาก package ที่ส่งข้ามเครื่อง
- ห้ามให้ draft กลับไปเป็น storage ก้อนเดียวที่ไม่มี `bookId`
- import ข้อมูลต้องตรวจ `schema` ก่อนเสมอ
- ถ้า import id ซ้ำ ต้องมี policy ชัดเจน: replace, keep both, หรือถามผู้ใช้
- scoring ต้องมาจาก `scoreStamps` เท่านั้น
- ห้าม sync draft ส่วนตัวแบบ background
- `ส่งตรวจ` คือ gate สำหรับเปลี่ยน offline draft เป็น submitted package
- online/shared data ต้องรับเฉพาะ submitted/reviewed/public content ตาม policy

## กฎ UI

- ข้อความผู้ใช้เห็นต้องเป็นภาษาไทย
- ชื่อเทคโนโลยีใช้ภาษาอังกฤษได้เท่าที่จำเป็น เช่น `LINE Flex Message`
- ไม่แสดงคำเทคนิค เช่น schema, hash, revision ใน UI หลัก ถ้าไม่จำเป็น
- ปุ่มที่เกี่ยวกับไฟล์ต้องใช้คำต่างกันชัด:
  - `บันทึก`
  - `ส่งตรวจ`
  - `ส่งออก`
  - `นำเข้า`
  - `ส่งคืน`

## Smoke Test Flow

หลังแก้ระบบ ให้ทดสอบอย่างน้อย:

1. เปิดโปรแกรมครั้งแรกและกรอก profile
2. สร้างสมุดใหม่
3. พิมพ์คำตอบและ autosave
4. เปิดหน้า `exam-books.html` แล้วเห็นเล่มใหม่
5. เปิดเล่มเดิมด้วย `bookId`
6. กดส่งตรวจและได้ไฟล์ submission
7. เปิด `exam-reviewer-console.html`
8. นำเข้า submission
9. วาง stamp คะแนน
10. บันทึกการตรวจ
11. เปิด `exam-leaderboard.html` แล้วเห็นคะแนน
12. ส่งออก backup แล้วนำเข้ากลับได้

## งานที่ควรแยกเป็น agent

- Paper Rendering Agent: เส้นบรรทัด, pagination, print fidelity
- Data Safety Agent: schema, import/export, hash, conflict
- Reviewer Agent: stamp tools, read-only answer, review package
- Leaderboard Agent: scoring, filters, dedupe policy
- Delivery Agent: LINE Flex Message, email, Facebook inbox
- QA Agent: smoke test, Thai UI audit, screenshot audit

## Definition of Done

- JS parse ผ่าน
- `git diff --check` ผ่าน
- เอกสารที่เกี่ยวข้องถูกอัปเดต
- ไม่มีข้อความอังกฤษหลุดใน UI ที่ไม่ใช่ชื่อเฉพาะ
- ไม่มี schema/storage change ที่ไร้ migration note
- ระบุ remaining risk ใน final/handoff

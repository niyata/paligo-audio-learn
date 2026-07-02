# Paligo Exam Paper System Architecture

## เป้าหมายระบบ

ระบบนี้เป็นเครื่องมือทำข้อสอบบาลีแบบ offline-first ที่ให้ผู้เรียนสร้างสมุดคำตอบ ตรวจเองหรือส่งให้อาจารย์/ผู้ตรวจ และนำผลคะแนนไปแสดง leaderboard โดยไม่บังคับ login ตั้งแต่ต้น

หลักคิดสำคัญ:

- สมาธิผู้เรียนสำคัญกว่าการ login
- การทำข้อสอบ 1 รอบ = สมุดคำตอบ 1 เล่ม
- คำตอบของนักเรียนต้องแยกจาก annotation ของผู้ตรวจ
- คะแนนต้องนับจาก stamp คะแนน ไม่ใช่กรอกช่องคะแนนอิสระ
- ระบบต้องย้ายเครื่องได้ด้วย export/import
- UI และข้อความแจ้งเตือนต้องเป็นภาษาไทย
- ข้อมูลนักเรียนเป็น offline-first จนกว่าจะกด `ส่งตรวจ`
- `ส่งตรวจ` คือ gate สำหรับเปลี่ยน private offline draft เป็น submitted package ที่ sync/ส่ง online ได้

## Current Runtime

ปัจจุบันเป็น HTML/JavaScript แบบ static และเก็บข้อมูลใน `localStorage`

หน้าหลัก:

- `ruled-lines-card-only-template.html`: กระดาษคำตอบพร้อม autosave, profile wizard, ส่งตรวจ, book id
- `ruled-lines-template.html`: template แบบมี sidebar/lesson panel
- `exam-books.html`: หน้า grid menu สำหรับสมุดข้อสอบหลายเล่ม
- `exam-reviewer-console.html`: console สำหรับอาจารย์/ผู้ตรวจ
- `exam-leaderboard.html`: leaderboard จากผลตรวจ

เอกสารประกอบ:

- `docs/offline-data-safety-and-book-model.md`
- `docs/exam-scoring-leaderboard-plan.md`
- `docs/thai-ui-language-rules.md`
- `docs/pali-learning-app-prd-roadmap.md`

## Domain Model

### Owner

`ownerId` คือเจ้าของข้อมูลแบบ offline ในเครื่อง

หน้าที่:

- ผูกข้อมูลกับเครื่อง/ผู้ใช้โดยไม่ต้อง login
- ใช้ประกอบ backup/export
- อนาคตใช้ใน flow รับโอนเครื่อง

Storage:

```text
paligo-exam-local-owner-id-v1
```

### Profile

ข้อมูลผู้ใช้:

- บทบาทผู้ใช้
- คำนำหน้า
- ชื่อ/นามสกุล/ฉายา
- ชั้น ป.ธ.
- อาจารย์ผู้สอน/ผู้ตรวจ
- ช่องทางส่งตรวจ

Storage:

```text
paligo-exam-student-profile-v1
paligo-exam-reviewer-profile-v1
```

### Answer Book

สมุดคำตอบ 1 เล่มแทนการทำข้อสอบ 1 รอบ

Fields สำคัญ:

- `id`
- `ownerId`
- `title`
- `studentName`
- `grade`
- `status`
- `revision`
- `createdAt`
- `updatedAt`
- `draft`

Storage:

```text
paligo-exam-answer-books-v1
paligo-exam-active-book-id-v1
```

### Submission

แพ็กเกจที่นักเรียนส่งให้อาจารย์/ผู้ตรวจ

Fields สำคัญ:

- `schema: paligo.exam.submission.v1`
- `id`
- `ownerId`
- `bookId`
- `bookRevision`
- `bookTitle`
- `studentName`
- `profile`
- `pickers`
- `pages`
- `annotations`

Storage:

```text
paligo-exam-submissions-v1
```

### Review Result

ผลตรวจที่ผู้ตรวจบันทึก

Fields สำคัญ:

- `schema: paligo.exam.review.v1`
- `submissionId`
- `ownerId`
- `bookId`
- `scoreStamps`
- `errorStamps`
- `score`
- `reviewedAt`

Storage:

```text
paligo-exam-results-v1
```

## Module Boundaries

### Paper Editor

รับผิดชอบ:

- layout กระดาษ
- line alignment
- autosave
- answer book draft
- ส่งตรวจ

ไม่ควรรับผิดชอบ:

- leaderboard ranking
- reviewer stamp logic เชิงลึก
- sync server

### Book Library

รับผิดชอบ:

- list/grid สมุด
- open book by `bookId`
- export/import book
- backup all books

ไม่ควรรับผิดชอบ:

- ตรวจข้อสอบ
- แก้เนื้อหาคำตอบโดยตรง

### Reviewer Console

รับผิดชอบ:

- import submission
- read-only answer view
- stamp คะแนน/ข้อผิด
- save review result
- export review package

ไม่ควรรับผิดชอบ:

- แก้คำตอบนักเรียน
- สร้างสมุดคำตอบใหม่แทนนักเรียน

### Leaderboard

รับผิดชอบ:

- อ่าน review results
- คำนวณคะแนนจาก score stamps
- แสดงผลรายวัน/รายสัปดาห์/สามสัปดาห์/รายเดือน

ไม่ควรรับผิดชอบ:

- รับคะแนน manual
- แก้ผลตรวจ

### Delivery Layer

ระยะปัจจุบัน:

- export/import JSON
- LINE Flex Message เป็นช่องทางหลักใน UI

ระยะต่อไป:

- LIFF `shareTargetPicker` เป็นกลไกเสริมสำหรับส่ง Flex Message
- email
- Facebook inbox

## Target Architecture

### Phase A: Static Offline App

เหมาะกับ prototype และทดสอบ UX:

- HTML + JS
- `localStorage`
- export/import JSON
- ไม่มี server

### Phase B: Offline App With Durable Local DB

เหมาะกับข้อมูลหลายเล่ม:

- ย้ายจาก `localStorage` ไป `IndexedDB`
- เพิ่ม schema migration
- เพิ่ม package hash
- เพิ่ม conflict resolver

### Phase C: Optional Sync Service

ไม่บังคับ login แต่ sync ได้:

- pairing token
- short-lived session
- encrypted package upload/download
- LINE LIFF delivery
- sync เฉพาะ submitted package ไม่ sync draft อัตโนมัติ

### Phase D: Organization/Admin Layer

เมื่อมีห้องเรียนจริง:

- class group
- teacher roster
- reviewer assignment
- audit log
- leaderboard scope ตามห้อง/ชั้น/ช่วงเวลา

## Project Structure ที่แนะนำ

```text
/
  apps/
    paper/
    books/
    reviewer/
    leaderboard/
  src/
    storage/
    domain/
    scoring/
    delivery/
    ui/
  docs/
    architecture/
    flows/
    risk/
  tests/
    fixtures/
    smoke/
```

ระยะปัจจุบันยังเป็น static files ได้ แต่เมื่อ feature โตขึ้นควรค่อย ๆ แยก logic ซ้ำออกจาก HTML

## Architectural Decisions

- ใช้ `bookId` เป็น key หลักของรอบสอบ
- ใช้ `ownerId` เป็น ownership offline
- ใช้ `schema` version ในทุก package ที่ส่งข้ามเครื่อง
- ใช้ stamp เป็น source of truth ของคะแนน
- ไม่ให้ reviewer แก้ answer layer
- UI ภาษาไทยเป็น default
- แยก private offline data ออกจาก shared online data
- ปุ่ม `ส่งตรวจ` เป็น publish/sync gate ของระบบ

## Open Questions

- การตรวจเองควรนับ leaderboard รวมกับการตรวจโดยครูหรือแยกหมวด
- การรับโอนเครื่องควรให้ผู้ใช้ยืนยัน owner เดิมอย่างไร
- LINE Flex Message จะส่งเป็นไฟล์แนบ, link, หรือ compact summary + file
- rubric สนามสอบจริงจะเปลี่ยนน้ำหนัก `๑/๒/๓ ให้` หรือไม่
- ต้องรองรับหลายห้องเรียน/หลายครูในเครื่องเดียวหรือไม่

## Findings From Agent Research

- โครงสร้าง `ownerId + bookId + schema` ถูกทางสำหรับ offline-first แต่ยังต้องมี hash และ conflict handling
- หน้าแต่ละไฟล์ยังเป็น monolith-per-page ทำให้ logic ซ้ำ เช่น Thai number, storage helper, JSON download, scoring
- `localStorage` เหมาะกับ prototype แต่ไม่เหมาะเป็นฐานข้อมูลระยะยาวสำหรับสมุดจำนวนมาก
- LINE Flex Message ต้องเป็น delivery adapter ไม่ใช่ domain model
- leaderboard ตอนนี้เป็น local leaderboard ของเครื่องที่มี result ไม่ใช่ leaderboard กลาง
- self-review ต้องแยก flag ชัดเจน ไม่ควรปนกับ teacher-review โดยไม่บอกผู้ใช้

## Immediate Technical Debt

- แยก shared helpers ออกจาก HTML:
  - Thai formatter
  - storage keys
  - download/import JSON
  - scoring engine
  - schema validators
- เพิ่ม validation เชิงลึกสำหรับ imported packages
- เพิ่ม conflict dialog สำหรับ import book id ซ้ำ
- เพิ่ม review import ฝั่งนักเรียน
- เพิ่ม review edit flow ที่โหลด stamp เดิมกลับมา
- เพิ่ม dedupe policy สำหรับ leaderboard

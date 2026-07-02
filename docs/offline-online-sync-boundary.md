# Offline/Online Sync Boundary

## หลักการ

ข้อมูลของนักเรียนต้องเป็น offline-first โดยค่าเริ่มต้น ส่วนสื่อกลางและข้อมูลที่หลายคนเห็นร่วมกันจึงค่อยเป็น online

จุดเปลี่ยนสถานะจาก offline เป็น online คือ `ส่งตรวจ`

ก่อนผู้เรียนกดส่งตรวจ:

- ข้อมูลเป็น private local data
- อยู่ในเครื่องผู้เรียน
- แก้ไขได้
- autosave ได้
- ไม่ควรถูกส่งออกหรือ sync อัตโนมัติ

หลังผู้เรียนกดส่งตรวจ:

- ระบบสร้าง submission package
- ผู้เรียนตั้งใจเผยแพร่ข้อมูลชุดนั้นให้ครู/ผู้ตรวจ/ระบบกลาง
- package นั้นจึงเข้าสู่ online sync หรือ delivery channel ได้

## Data Classification

### Private Offline Data

ข้อมูลที่ต้องอยู่ในเครื่องนักเรียนเป็นหลัก:

- profile ผู้เรียน
- draft ระหว่างพิมพ์
- answer book ที่ยังไม่ส่งตรวจ
- autosave state
- local owner id
- device-local settings

Storage ปัจจุบัน:

```text
paligo-exam-student-profile-v1
paligo-exam-local-owner-id-v1
paligo-exam-answer-books-v1
paligo-exam-active-book-id-v1
```

### Publishable Submission Data

ข้อมูลที่เผยแพร่ได้เมื่อกดส่งตรวจ:

- submission package
- book metadata
- student display name หรือ alias
- grade
- pages ที่ส่งตรวจ
- pickers/date metadata
- annotations ที่ตั้งใจส่ง
- answer hash ในอนาคต

Schema:

```text
paligo.exam.submission.v1
```

### Shared Online Data

ข้อมูลที่หลายคนเห็นร่วมกันได้:

- สื่อการเรียน
- ข้อสอบกลาง
- rubric
- classroom announcement
- leaderboard ที่ผ่าน policy แล้ว
- review result ที่ครูบันทึกและเผยแพร่กลับ

### Reviewer Local Data

ข้อมูลบนเครื่องผู้ตรวจ:

- imported submissions
- reviewer profile
- local review drafts
- score stamps
- error stamps
- results ก่อน publish

ข้อมูลกลุ่มนี้เป็น offline-first ฝั่งผู้ตรวจ จนกว่าจะกดบันทึก/ส่งคืน/เผยแพร่

## Sync Gate: ส่งตรวจ

ปุ่ม `ส่งตรวจ` ต้องทำหน้าที่เป็น gate:

1. บันทึก draft ล่าสุด
2. freeze snapshot ของคำตอบ
3. สร้าง submitted revision
4. สร้าง `submissionId`
5. แนบ `ownerId`, `bookId`, `bookRevision`, `bookTitle`
6. แนบ `answerHash` ใน phase ถัดไป
7. แสดง preview ก่อนส่ง online ใน phase ถัดไป
8. ส่งผ่าน delivery adapter

Delivery adapter อาจเป็น:

- file export
- LINE Flex Message
- LIFF shareTargetPicker
- email
- Facebook inbox
- server sync

## Online Sync Target

ระบบ online ไม่ควรรับ draft ดิบทั้งหมดโดยอัตโนมัติ

ควรรับเฉพาะ:

- submitted package
- review package
- leaderboard aggregate
- public/shared learning media

## Minimal Sync Architecture

```text
Offline Editor
  -> Answer Book Draft
  -> Submit Gate
  -> Submission Package
  -> Delivery Adapter
  -> Reviewer / Online Sync Inbox
  -> Review Result
  -> Return Package / Leaderboard
```

## Policy

- ไม่มี background sync สำหรับ draft ส่วนตัว
- sync ต้องเกิดจาก user action ที่ชัดเจน
- การกดส่งตรวจต้องถือว่าเป็น consent ในการเผยแพร่ข้อมูลชุดนั้น
- ถ้าจะส่ง online ต้องแสดงว่าจะส่งอะไร
- ข้อมูลกลางออนไลน์ต้องไม่รวม draft ที่ยังไม่ส่งตรวจ
- leaderboard ต้องใช้ข้อมูลหลังการตรวจ ไม่ใช่ draft

## Future Server-Side Components

ถ้ามี server ในอนาคต ควรแยกเป็น:

- Public Content API: สื่อการเรียน/ข้อสอบกลาง
- Submission Inbox API: รับ submission package
- Review API: รับผลตรวจ
- Leaderboard API: aggregate คะแนน
- Sync Pairing API: จับคู่เครื่องแบบไม่ต้อง login

## Privacy Guardrails

- ใช้ alias/nickname ใน leaderboard โดย default
- ไม่ส่ง profile เต็มถ้าไม่จำเป็น
- แยก submitted snapshot ออกจาก draft ที่แก้ต่อ
- ทุก submission ต้องมี `submittedAt`
- ทุก online package ต้องมี hash และ schema version
- ต้องมีปุ่ม export backup แบบ local ที่ไม่ส่ง online

## สิ่งที่ต้องระวัง

- ถ้า sync ก่อนส่งตรวจ จะละเมิดแนวคิด offline-first
- ถ้าส่ง draft ทั้งเล่มขึ้น online อาจเผยข้อมูลที่ผู้เรียนยังไม่ตั้งใจส่ง
- ถ้าไม่มี submitted revision ผู้ตรวจอาจตรวจคำตอบคนละเวอร์ชัน
- ถ้า leaderboard ดึงจากเครื่องผู้ตรวจอย่างเดียว จะไม่ใช่ leaderboard กลาง
- ถ้า LINE Flex Message ใส่ข้อมูลมากเกินไป อาจรั่วในแชตผิดกลุ่ม

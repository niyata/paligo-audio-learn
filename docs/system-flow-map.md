# User Flow, Data Flow, and Admin Flow Map

## User Roles

- `student`: ผู้เรียน ทำข้อสอบและส่งตรวจ
- `teacher`: อาจารย์ผู้สอน ดูแลการเรียนและรับงาน
- `reviewer`: ผู้ตรวจ ใช้เครื่องมือ stamp และบันทึกผล
- `teacher-reviewer`: ผู้สอนที่ตรวจเองได้
- `self-reviewer`: ผู้เรียนที่ตรวจตนเอง ควรเพิ่มเป็น role แยกใน phase ถัดไป

## Student Flow

1. เปิดระบบครั้งแรก
2. กรอก profile wizard
3. เลือกช่องทางส่งตรวจ เช่น LINE Flex Message
4. สร้างสมุดข้อสอบใหม่
5. ทำข้อสอบบนกระดาษ
6. ระบบ autosave เงียบ ๆ
7. เปิดเมนูสมุดข้อสอบเพื่อดูเล่มทั้งหมด
8. กดส่งตรวจ
9. ระบบสร้าง submission package
10. ส่งไฟล์/ข้อมูลผ่านช่องทางที่เลือก
11. รับ review package กลับ
12. เปิดดูผลตรวจและคะแนน

## Reviewer Flow

1. เปิด reviewer console
2. ตั้งค่า profile ผู้ตรวจ
3. นำเข้า submission package
4. ตรวจคำตอบแบบ read-only
5. วาง stamp ข้อผิด:
   - ผิดศัพท์
   - ผิดสัมพันธ์
   - ผิด ป.
6. วาง stamp คะแนน:
   - ๑ ให้
   - ๒ ให้
   - ๓ ให้
7. กดบันทึกการตรวจ
8. ระบบสร้าง review result
9. leaderboard อ่านผลตรวจ
10. ส่ง review package คืนนักเรียน

## Admin Flow ในอนาคต

Admin ไม่จำเป็นใน MVP แรก แต่ควรวางไว้สำหรับระบบจริง

หน้าที่ admin:

- จัดการห้องเรียน
- จัดการรายชื่อผู้เรียน
- จัดการอาจารย์/ผู้ตรวจ
- กำหนด assignment ว่าใครตรวจใคร
- ดู audit log
- export คะแนนรวม
- ตั้งค่ารอบสอบ

## Data Flow

### Offline-First Boundary

```text
ก่อนส่งตรวจ: ข้อมูลอยู่ในเครื่องนักเรียน
กดส่งตรวจ: freeze snapshot + create submission package
หลังส่งตรวจ: package นั้นจึงส่ง online/delivery ได้
```

### Draft

```text
Paper Editor
  -> build draft snapshot
  -> localStorage: paligo-exam-answer-books-v1
  -> active book id
```

### Submission

```text
Answer Book
  -> submit gate
  -> freeze submitted snapshot
  -> submission package
  -> localStorage: paligo-exam-submissions-v1
  -> download .paligo-submission.json
  -> delivery channel
```

### Review

```text
Reviewer Console
  -> import submission
  -> create scoreStamps/errorStamps
  -> save review result
  -> localStorage: paligo-exam-results-v1
  -> download .paligo-review.json
```

### Leaderboard

```text
Review Results
  -> filter by date range
  -> calculate score from scoreStamps
  -> rank
```

## Data Ownership

ข้อมูลแต่ละชุดควรมี:

- `ownerId`
- `bookId`
- `schema`
- `revision`
- `createdAt`
- `updatedAt`

ถ้าเป็นข้อมูลที่ส่งข้ามเครื่องควรเพิ่ม:

- `exportedAt`
- `packageHash`
- `answerHash`
- `sourceDeviceLabel`

## Self Review Flow

ผู้ใช้ที่เป็นทั้งนักเรียนและผู้ตรวจควรมี flow เฉพาะ:

1. เลือก role `นักเรียนและผู้ตรวจตนเอง`
2. ทำข้อสอบ
3. กดตรวจตนเอง
4. ระบบสร้าง review session จากสมุดเล่มเดียวกัน
5. reviewerId = studentId หรือ ownerId
6. result มี `isSelfReview: true`
7. leaderboard แยก filter ได้ว่า รวม/ไม่รวม self review

## Critical Edge Cases

- เปิดสมุดผิดเล่ม
- ส่งตรวจซ้ำหลายครั้ง
- import submission เดิมซ้ำ
- ตรวจ submission revision เก่า
- student แก้คำตอบหลังส่งแล้วผู้ตรวจตรวจไฟล์เก่า
- reviewer ลืมบันทึกก่อนส่งคืน
- localStorage ถูกล้าง
- backup จากเครื่อง A import เข้าเครื่อง B ที่มี bookId ซ้ำ
- คะแนน self review ปน leaderboard ห้องเรียน
- กดสร้างสมุดใหม่แล้วระบบดึง draft เก่ากลับมา
- ผู้ตรวจนำเข้า submission เดิมแล้ว stamp เก่าหายเพราะไม่ได้ load result เดิม
- leaderboard นับหลาย submission จาก book เดียวกันซ้ำ
- ผู้ใช้เข้าใจผิดว่า leaderboard เป็นส่วนกลาง ทั้งที่เป็นข้อมูลในเครื่อง

## UX Rules

- ทุกข้อความผู้ใช้ต้องเป็นภาษาไทย
- ไม่ใช้คำเทคนิคใน UI หลักถ้าไม่จำเป็น
- ต้องแสดงว่าอยู่เล่มไหนเสมอ
- ปุ่มสร้างสมุดใหม่ต้องไม่ลบเล่มเดิม
- ก่อน import ที่จะทับข้อมูล ต้องให้ผู้ใช้ยืนยัน
- leaderboard ต้องบอกช่วงเวลาและเกณฑ์คะแนนชัดเจน
- ปุ่ม `ส่งตรวจ`, `ส่งออก`, `ส่งคืน`, `บันทึก` ต้องมี wording ต่างกันชัดเจน
- หน้า reviewer ต้องแสดงชื่อ, ชั้น, bookTitle, submittedAt, revision ก่อนตรวจ
- ก่อนส่ง online ต้องแสดง preview ว่าข้อมูลใดกำลังจะถูกส่ง

# Offline Data Safety and Answer Book Model

## แนวคิดหลัก

- การทำข้อสอบ 1 รอบ = สร้างสมุดคำตอบ 1 เล่ม
- สมุดแต่ละเล่มต้องมี `bookId` แยกกันเสมอ
- ผู้ใช้ในเครื่องต้องมี `ownerId` แยกจากชื่อ เพื่อใช้ระบุเจ้าของข้อมูลแบบ offline-first
- ข้อมูลทุกชุดที่ส่งข้ามเครื่องต้องมี `schema`, `ownerId`, `bookId`, `revision`, `createdAt`, `updatedAt`
- ห้ามให้ draft หลายรอบสอบเขียนทับ storage key เดียวโดยไม่มี `bookId`

## Storage Keys

- `paligo-exam-local-owner-id-v1`: เจ้าของเครื่อง/ผู้ใช้แบบ offline
- `paligo-exam-answer-books-v1`: รายการสมุดคำตอบหลายเล่ม
- `paligo-exam-active-book-id-v1`: สมุดเล่มที่กำลังแก้ไข
- `paligo-exam-submissions-v1`: ชุดข้อมูลที่ส่งตรวจ
- `paligo-exam-results-v1`: ผลตรวจสำหรับ leaderboard
- `paligo-exam-student-profile-v1`: profile ผู้เรียน
- `paligo-exam-reviewer-profile-v1`: profile ผู้ตรวจ

## ช่องโหว่ที่ข้อมูลอาจพังระหว่างส่งข้ามเครื่อง

1. ส่งไฟล์ผิดเล่ม
   - ถ้าไม่มี `bookId` ผู้ตรวจอาจนำเข้าผิดรอบสอบ
   - ป้องกันด้วยชื่อไฟล์ + `bookId` + `bookTitle`

2. ข้อมูลเก่าทับข้อมูลใหม่
   - ถ้าเครื่อง A และ B แก้สมุดเดียวกันพร้อมกัน อาจเกิด revision conflict
   - ป้องกันด้วย `revision` และ `updatedAt`

3. ไฟล์ส่งไม่ครบ
   - ถ้าส่งเฉพาะข้อความ แต่ไม่มี profile/pickers/annotations จะคืนคะแนนแล้วจับคู่ไม่ได้
   - ป้องกันด้วย export package ที่มี `schema`, `profile`, `pickers`, `pages`, `annotations`

4. นำเข้าไฟล์ผิดชนิด
   - เช่น เอา review package ไป import เป็น answer book
   - ป้องกันด้วย `schema` เช่น `paligo.exam.answerBookExport.v1`

5. เครื่องใหม่ไม่มี owner เดิม
   - ข้อมูลยังเปิดได้ แต่ ownership จะเปลี่ยนบริบท
   - ป้องกันด้วย backup file ที่แนบ `ownerId` เดิม และอนาคตควรมี flow "รับโอนเครื่อง"

6. localStorage เต็มหรือถูกล้าง
   - browser อาจลบข้อมูลได้ โดยเฉพาะ private mode หรือพื้นที่เต็ม
   - ป้องกันด้วยปุ่มส่งออกทั้งหมดและแนะนำ backup เป็นไฟล์

7. ไฟล์ถูกแก้มือ
   - JSON อาจถูกแก้ก่อนส่งต่อ
   - ป้องกันใน phase ถัดไปด้วย `answerHash` และ `packageHash`

8. ส่งผ่านแชตแล้วไฟล์ถูกบีบอัด/เปลี่ยนชื่อ
   - บางช่องทางอาจเปลี่ยนชื่อไฟล์หรือทำให้ผู้ใช้เลือกไฟล์ผิด
   - ป้องกันด้วยข้อมูลในไฟล์ เช่น `bookTitle`, `studentName`, `submittedAt`

## ความพร้อมในการย้ายเครื่อง

พร้อมในระดับพื้นฐานเมื่อใช้หน้า `exam-books.html`:

- ส่งออกสมุดรายเล่มได้
- ส่งออกสมุดทั้งหมดได้
- นำเข้าสมุดกลับเข้าเครื่องใหม่ได้
- เปิดสมุดตาม `bookId` ได้

ยังไม่ใช่ระดับสมบูรณ์จนกว่าจะเพิ่ม:

- `answerHash` สำหรับตรวจว่าคำตอบไม่ถูกแก้หลังส่งตรวจ
- `packageHash` สำหรับตรวจว่าไฟล์ไม่เสียระหว่างส่ง
- conflict dialog เมื่อ import สมุดที่ `bookId` ซ้ำแต่ `revision` ต่างกัน
- IndexedDB แทน localStorage หากข้อมูลหลายเล่มมีขนาดใหญ่

## กฎการออกแบบ UI

- Sidebar หรือ top controls ต้องมีทางเข้า `สมุดข้อสอบ`
- หน้า `exam-books.html` แสดงสมุดเป็นกริด
- แต่ละการ์ดคือสมุด 1 เล่ม
- การเปิดเล่มต้องส่ง `bookId` กลับไปที่ `ruled-lines-card-only-template.html?bookId=...`
- การสร้างเล่มใหม่ต้องใช้ `ruled-lines-card-only-template.html?newBook=1`

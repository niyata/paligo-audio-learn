# Thai UI Language Rules

โปรแกรมนี้เน้นผู้ใช้ภาษาไทยเป็นหลัก

## กฎหลัก

- ข้อความที่ผู้ใช้เห็นต้องเป็นภาษาไทยเสมอ
- ข้อความแจ้งเตือน, validation, toast, tooltip, empty state, modal, button และ status ต้องไม่ปล่อยเป็นภาษาอังกฤษ
- ถ้าต้องใช้ API หรือ browser validation ที่มีข้อความ native เป็นภาษาอังกฤษ ให้ปิด native validation แล้วใส่ custom validation ภาษาไทยเอง
- ชื่อเทคโนโลยีที่เป็นชื่อเฉพาะใช้ภาษาอังกฤษได้ เช่น `LINE Flex Message`, `Facebook inbox`, `localStorage`
- ชื่อ API/implementation เช่น `shareTargetPicker` ไม่ควรแสดงใน UI หลัก เว้นแต่เป็นหน้าสำหรับนักพัฒนา

ดู glossary และ state patterns เพิ่มเติม: `docs/agile/copy-standard.md`

## ตัวอย่างข้อความ validation

- `กรุณาเลือกคำนำหน้า`
- `กรุณากรอกชื่อ`
- `กรุณาเลือกบทบาทผู้ใช้`
- `กรุณาเลือกช่องทางส่งตรวจ`
- `กรุณาเลือกชั้นประโยค ป.ธ.`

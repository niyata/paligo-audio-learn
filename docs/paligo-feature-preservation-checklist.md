# Paligo Feature Preservation Checklist

ใช้ checklist นี้ก่อนจบงานทุกครั้งที่แตะ `workbook.html`, `exam-books.html`, `exam-inbox.html`, profile, หรือ shared UI ของสมุด/แชท เพื่อกันฟีเจอร์ดี ๆ ที่มีอยู่แล้วหายระหว่าง refactor

## Golden Rules

- ห้ามถือว่า prototype คือ production จนกว่าจะย้ายฟีเจอร์เข้าหน้า production แล้ว
- ถ้าเปลี่ยน route เช่น `ruled-lines-card-only-template.html` -> `workbook.html` ต้องตรวจทุกลิงก์และทุก renderer ที่เกี่ยวข้อง
- ถ้าแก้ shared CSS ให้ตรวจทั้ง desktop และ mobile เพราะ grid/flex stretch ทำให้ UI เพี้ยนง่าย
- ถ้าเพิ่มฟีเจอร์ใหม่ ให้เพิ่ม smoke audit หรือ checklist item ในไฟล์นี้ก่อนจบงาน
- ถ้า audit fail ห้ามสรุปว่าเสร็จจนกว่าจะอธิบายได้ว่า fail เพราะ test หรือเพราะ product

## Must Not Regress

### Workbook

- `workbook.html` เป็น production route ของสมุดงาน
- เลขข้อแรกต้องเป็นเลขไทย เช่น `1` -> `๑`
- หลังเลขข้อต้องมีย่อหน้าจริง และ `Tab` ต้องพาไปคอลัมน์ย่อหน้า
- พินทุ `ฺ`, นิคคหิต `ํ`, และ legacy PUA เช่น `` ต้องแสดง/บันทึกได้ถูกต้อง
- เส้นบรรทัดและคอลัมน์เลขข้อห้ามเลื่อนแบบผิดเค้าโครง

Audit:

```bash
node scripts/audit-workbook-pali-text.mjs
node scripts/audit-tab-indent.mjs
```

### Book Covers

- ปกสมุดใน `exam-books.html` ต้องใช้ shared cover renderer เมื่อมี
- รูปโปรไฟล์บนปกต้อง fallback จาก `book.avatarUrl`, `book.profile.avatarUrl`, `book.studentProfile.avatarUrl`, `book.draft.profile.avatarUrl`, และ profile ปัจจุบัน
- card selector/favorite ห้ามทับ avatar บนปก
- ลิงก์เปิดสมุดต้องไป `workbook.html?bookId=...`

Audit:

```bash
node scripts/audit-book-cover-avatar.mjs
```

### Inbox Contacts And Groups

- `exam-inbox.html` เป็น production inbox
- `inbox.html` เป็น compatibility route ได้ แต่ห้ามเป็น source of truth ของ UI
- contact บุคคลและกลุ่มต้องเรียงจากบนลงล่าง ขนาด compact ไม่ยืดเต็ม sidebar
- นักเรียนและครู/ผู้ตรวจต้องกดสร้างกลุ่มได้
- กลุ่มต้องมี thread แยก, ชื่อ, avatar, description, และ local persistence อย่างน้อยใน phase local
- ฟีเจอร์ที่อยู่ใน `exam-inbox-tailwind.html` ต้องถูกย้ายเข้าหน้า production ก่อนนับว่า “ใช้ได้จริง”

Audit:

```bash
node scripts/audit-inbox-group-workflow.mjs
```

### Inbox Book Submit

- นักเรียนต้องเปิด sheet เลือกสมุดเพื่อส่งตรวจได้
- card สมุดในแชทต้องยัง render ปกสมุด
- ยกเลิกส่งตรวจต้องไม่หายเมื่อสมุดยังอยู่ในช่วงที่ cancel ได้
- reviewer/student avatar ใน message หรือ returned result ต้องไม่ fallback เป็นตัวอักษรเมื่อมี avatar จริง
- API loop ต้องยังครบ: student push `to-reviewer` -> reviewer claim -> reviewer push `to-student` -> student claim
- Wrong-role claim ต้องคืน 403 ทั้ง student claim `to-reviewer` และ reviewer claim `to-student`

Audit:

```bash
node scripts/audit-inbox-loop-api.mjs
```

### Account And Offline Mode

- Localhost ต้องทำงานได้แม้ Workers dev server offline ถ้ามี session cache
- Cloudflare Pages ต้องใช้ API production โดยไม่แสดงคำสั่ง `localhost:8788`
- Error message ต้องบอกทางแก้ตาม environment จริง

## Minimum Closeout

ก่อนบอกผู้ใช้ว่าเสร็จ:

- รัน `git diff --check -- <files>`
- รัน `node --check` หรือ inline script syntax สำหรับไฟล์ที่แตะ
- รัน audit ที่สัมพันธ์กับฟีเจอร์ที่แตะ
- แจ้ง audit ที่ผ่าน และ audit ที่ยังไม่ได้รันอย่างตรงไปตรงมา

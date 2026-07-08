# E2E Test Plan — Inbox Loop (Phase 4.4)

**วัตถุประสงค์:** ยืนยันวงจรสมบูรณ์ นักเรียน → ครู → นักเรียน ผ่าน Inbox (ไม่พึ่ง import/export ไฟล์)

**API smoke (อัตโนมัติ):** `bash scripts/smoke-inbox-api.sh` (ต้อง `cd workers && npm run dev`)

---

## สิ่งที่ต้องเตรียม

| รายการ | ค่า |
|--------|-----|
| Static app | `python3 -m http.server 8765` (repo root) |
| Workers API | `cd workers && npm run dev` → `:8788` |
| D1 local | `npx wrangler d1 migrations apply paligo-inbox --local` |
| บัญชีครู | สมัคร reviewer + PIN ทดสอบ |
| บัญชีนักเรียน | สมัคร student + PIN ทดสอบ |
| จับคู่ | ครูสร้างรหัส → นักเรียน join |

---

## ขั้นตอนทดสอบ UI (2 เบราว์เซอร์หรือ 2 โปรไฟล์)

### A — นักเรียนสร้างและส่งตรวจ

1. Login นักเรียนที่ `exam-account.html`
2. เปิด `exam-books.html` → สร้างสมุดใหม่ → เขียนคำตอบอย่างน้อย 1 หน้า
3. เปิด `exam-inbox.html` → กด **📚 สมุดข้อสอบ** → เลือกสมุด → ยืนยันส่งตรวจ
4. **ผ่าน:** card สมุดปรากฏในแชท · สถานะสมุดเป็น submitted/locked

### B — ครูรับและตรวจ

1. Login ครู (เบราว์เซอร์/โปรไฟล์ที่สอง)
2. เปิด `exam-inbox.html` หรือ `exam-reviewer-console.html` → เห็นรายการ pending
3. Claim / รับเข้าคลัง → เปิดโหมดตรวจ (`?mode=review`)
4. Stamp คะแนน · บันทึกการตรวจ · ส่งผลกลับ (push to-student)
5. **ผ่าน:** ไม่ error 403 · ผลถูก push เข้า inbox นักเรียน

### C — นักเรียนรับผล

1. กลับบัญชีนักเรียน → `exam-inbox.html` หรือ `exam-review-results.html`
2. Claim ผลตรวจ
3. **ผ่าน:** สมุดสถานะ reviewed · เห็นคะแนน/stamp · ไม่แก้คำตอบได้

---

## Regression

| # | กรณี | ผลที่คาดหวัง |
|---|------|-------------|
| R1 | นักเรียน claim inbox `to-reviewer` | 403 |
| R2 | Import/export ปิด (ค่าเริ่มต้น) | ไม่เห็นแท็บ「โอนไฟล์ (ขั้นสูง)」 |
| R3 | Super Admin เปิด import/export | เห็นแท็บขั้นสูง |
| R4 | ปิด Inbox API ใน Super Admin | ส่งตรวจ API คืน 503 · หน้า inbox แสดง gate |
| R5 | Push inbox ล้มเหลว | fallback download ยังทำงาน (ถ้าเปิด import/export) |

---

## Definition of Done — Phase 4 E2E

- [ ] ขั้น A–C ผ่านบน localhost ทั้งคู่
- [ ] `scripts/smoke-inbox-api.sh` ผ่าน
- [ ] Regression R1–R2 ผ่าน
- [ ] PO อนุมัติบน board

---

## หลัง E2E ผ่าน → Phase 5

- Deploy Workers + Pages production (`api.paligo.jp`, `app.paligo.jp`)
- ทดสอบซ้ำบน production ด้วยบัญชีจริง 1 คู่

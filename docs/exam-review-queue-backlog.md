# Backlog: ระบบเลขคิวตรวจ (Review Queue)

**สถานะ:** Backlog — รอหลัง Inbox MVP (Phase 4+)  
**Priority:** P2  
**Area:** exam · inbox  
**Design:** Apple HIG — progress ชัด · hierarchy · accessible

---

## ปัญหาที่แก้

หลังมี Inbox แล้ว ครูอาจได้งานหลายเล่มพร้อมกัน · นักเรียนไม่รู้ว่าครูตรวจถึงคิวไหน · ไม่มีภาพรวมความคืบหน้า

---

## เป้าหมาย

| ผู้ใช้ | ได้อะไร |
|--------|---------|
| **ครู** | ตรวจตามลำดับคิว · เห็นงานถัดไป · ไม่ข้ามโดยไม่ตั้งใจ |
| **นักเรียน** | เห็น **เลขคิวของตัวเอง** · สถานะ · คิวกลาง (ทั้งหมด / ตรวจแล้ว / เหลือ) |
| **ทั้งคู่** | แผงสถิติ + progress bar สวยงาม ตามแนว Apple HIG |

---

## User stories (ร่าง)

1. **As a** นักเรียน, **I want** เห็นเลขคิวและสถานะหลังส่งเข้า inbox, **So that** รู้ว่ารออีกนานแค่ไหน
2. **As a** ครู, **I want** รายการคิวเรียงตามเวลาส่ง, **So that** ตรวจเป็นลำดับยุติธรรม
3. **As a** ครู, **I want** กด「รับคิวถัดไป」หรือเปิดจากคิวแรก, **So that** workflow เร็ว
4. **As a** นักเรียน, **I want** เห็น progress กลาง (เช่น ตรวจแล้ว 12/30), **So that** เข้าใจภาพรวมห้องเรียน

---

## สถานะคิว (server)

```text
queued ──→ in_review ──→ reviewed ──→ returned
   │            │
   └ cancelled (ก่อนครูรับ)
```

| สถานะ | แสดงนักเรียน (ตัวอย่าง) |
|--------|-------------------------|
| `queued` | รอคิว · ลำดับที่ N |
| `in_review` | กำลังตรวจ |
| `reviewed` | ตรวจเสร็จ · รอส่งกลับ |
| `returned` | ได้รับผลแล้ว |

---

## เลขคิว

- ออกให้ตอน `POST /v1/packages` (push inbox) สำเร็จ
- Scope ต่อ **ครู 1 คน** (หรือ pairing / ห้อง) — reset ตาม policy (รายวัน / รายเทอม — ตัดสินภายหลัง)
- รูปแบบแสดง: **UI สถานะ = ตัวเลขอารบิก** (ตาม `docs/thai-ui-language-rules.md`) · เนื้อสมุดยังใช้ไทยตามเดิม

---

## API (อนาคต — ร่าง)

| Method | Path | หมายเหตุ |
|--------|------|----------|
| `GET` | `/v1/queue/summary` | ครู + นักเรียน (filter ตาม role) |
| `GET` | `/v1/queue/my` | คิวของนักเรียนที่ login |
| `GET` | `/v1/queue` | ครู — รายการเรียง `queue_number` |
| `POST` | `/v1/queue/{inboxItemId}/start` | ครูเริ่มตรวจคิวนี้ (ล็อก in_review) |
| `POST` | `/v1/queue/next` | ครูรับคิวถัดไปอัตโนมัติ |

### Response ตัวอย่าง `GET /v1/queue/summary`

```json
{
  "total": 30,
  "reviewed": 12,
  "inReview": 1,
  "remaining": 17,
  "percentComplete": 40,
  "myQueueNumber": 15,
  "myStatus": "queued",
  "myPosition": 8
}
```

---

## DB (อนาคต)

ขยายจาก `inbox_items` หรือตาราง `review_queue`:

| คอลัมน์ | หมายเหตุ |
|---------|----------|
| `queue_number` | int ต่อ reviewer |
| `queue_status` | queued / in_review / … |
| `queued_at` | จาก push |
| `started_at` | ครูเริ่มตรวจ |
| `completed_at` | ตรวจเสร็จ |

---

## UI (แนว Apple HIG)

### สถิติกลาง: ทั้งหมด / ตรวจแล้ว / เหลือ + progress bar

- **Summary row:** ตัวเลขสถานะอารบิก (total · reviewed · remaining) ใน compact stat group — hierarchy ชัด ไม่แน่นเกิน
- **Progress bar:** determinate bar เมื่อรู้ total (เช่น 12/30) — สไตล์เรียบ มุมโค้งน้อย สีจาก `paligo-design-tokens.css` ไม่ใช้ Material elevation/shadow
- **Label:** ข้อความไทยสั้น · มี accessibility label อธิบายความคืบหน้า
- **Spacing:** ใช้ rhythm 8pt · ระยะห่างระหว่าง stat กับ bar ชัดเจน

### นักเรียน — การ์ดบน `exam-books.html` หรือ `exam-queue-status.html`

- **Hero:** เลขคิวใหญ่ (เช่น `15`)
- **Subtitle:** สถานะภาษาไทย · «ลำดับในคิว 8 จาก 17»
- **Linear progress:** ตรวจแล้ว 12/30 (determinate bar แบบ Apple HIG)
- **Secondary stats:** compact row — ทั้งหมด · กำลังตรวจ · เหลือ (ไม่ใช้ chip หนาแบบ Material)
- สี/spacing ใช้ `paligo-design-tokens.css` · contrast พอ · ไม่พึ่งสีอย่างเดียว

### ครู — `exam-reviewer-console.html`

- แถบ progress ด้านบน (ห้อง/ครู)
- รายการคิว: # · ชื่อ · วิชา · ส่งเมื่อ · ปุ่ม「เปิดตรวจ」
- ปุ่ม **「คิวถัดไป」** — เปิด submission แรกที่ `queued`
- คิว `in_review` ไฮไลต์ (ไม่ให้สองเล่ม in_review พร้อมกัน — policy)

### หลัก Apple HIG ที่ยึด

- ข้อมูลสำคัญเห็นทันที (เลขคิว + สถานะ)
- Progress แบบ determinate เมื่อรู้ total — ไม่ใช้ indeterminate ถ้าไม่จำเป็น
- ข้อความสั้น · ภาษาไทย · ตัวเลขสถานะอารบิก
- Touch target ≥ 44px · focus ชัด · รองรับ Dynamic Type / ขยายตัวอักษร
- Visual weight เบา — เน้น content ไม่ใช่ decoration

---

## Phase แนะนำ (หลัง Inbox MVP)

| Phase | งาน | ขึ้นกับ |
|-------|-----|---------|
| **Q1** | DB + เลขคิวตอน push + API summary/my | Phase 2–4 |
| **Q2** | UI นักเรียน — การ์ดคิว + progress | Q1 |
| **Q3** | UI ครู — คิวเรียง + ถัดไป + in_review lock | Q1 |
| **Q4** | Realtime/poll (optional) · แจ้งเตือน | Q2–3 |

**อย่าเริ่ม Q1 จน Phase 4 (loop inbox ครบ) ผ่าน QA**

---

## Out of scope (v1 ของฟีเจอร์นี้)

- ข้ามคิวโดยไม่มีเหตุผล / audit skip
- คิวข้ามห้องเรียนรวมศูนย์ (ทำ pairing ก่อน)
- Push notification มือถือ

---

## อ้างอิง

- `docs/agile/inbox-sprint-backlog.md` — Phase 7
- `docs/exam-inbox-v1-spec.md`
- `docs/thai-ui-language-rules.md`
- [Apple HIG — Progress indicators](https://developer.apple.com/design/human-interface-guidelines/progress-indicators)

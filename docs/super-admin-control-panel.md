# Super Admin Control Panel — ออกแบบระบบ

วันที่: 2026-07-08  
สถานะ: **MVP implement แล้ว (สวิตช์ + แผงควบคุม)** · Phase 2–4 ตามแผนด้านล่าง

---

## 1. บัญชี Super Admin (จำลอง)

| อีเมล | บทบาท Inbox | Super Admin |
|--------|-------------|-------------|
| `tha.std@paligo.jo` | นักเรียน (`student`) | ✅ |
| `tha.tc@paligo.jp` | ครู/ผู้ตรวจ (`reviewer`) | ✅ |

- สมัครบัญชีด้วยอีเมลเหล่านี้ → ระบบตั้ง `is_super_admin = 1` อัตโนมัติ
- เข้าแผง: `exam-super-admin.html` (เฉพาะ super admin)
- ลิงก์จากโปรไฟล์เมื่อ login ด้วยบัญชี admin

---

## 2. สิ่งที่ทำแล้ว (MVP)

### 2.1 API

| Endpoint | สิทธิ์ | หน้าที่ |
|----------|--------|---------|
| `GET /v1/platform/flags` | สาธารณะ | อ่านสวิตช์ฟีเจอร์ (ไม่มี secret) |
| `GET /v1/admin/panel` | Super Admin | สถิติ + flags + health |
| `PATCH /v1/admin/settings` | Super Admin | บันทึก flags |

### 2.2 Platform flags (ค่าเริ่มต้น)

```json
{
  "importExportEnabled": false,
  "inboxEnabled": true,
  "lineWebhookEnabled": false,
  "lineMessagingEnabled": false,
  "lineNotifyQueueEnabled": false,
  "notificationsEnabled": true,
  "maintenanceMode": false,
  "debugApiLogs": false
}
```

### 2.3 ซ่อน Import/Export

องค์ประกอบที่มี `data-paligo-import-export` จะถูกซ่อนเมื่อ `importExportEnabled = false`  
**ยกเว้น Super Admin** — เห็นและใช้ได้เสมอ

หน้าที่ถูก gate แล้ว:

- `exam-account.html` — แท็บ「ขั้นสูง」
- `exam-review-results.html` — นำเข้าไฟล์ผลตรวจ
- `exam-reviewer-console.html` — นำเข้า JSON
- `workbook.html` — ดาวน์โหลด submission/transfer
- `book-page-qa.html` — verification import/export

Client: `paligo-platform.js` → `PaligoPlatform.boot()`

---

## 3. โครงแผงควบคุม (Roadmap)

```text
┌─────────────────────────────────────────────────────────────┐
│ Super Admin Panel (exam-super-admin.html)                   │
├──────────────┬──────────────┬──────────────┬────────────────┤
│ ระบบทั่วไป   │ Integrations │ Inbox Ops    │ ผู้ใช้/ความปลอดภัย │
│ (MVP ✅)     │ (Phase 2)    │ (Phase 2)    │ (Phase 3)      │
├──────────────┼──────────────┼──────────────┼────────────────┤
│ Import/Export│ LINE Webhook │ คิว pending  │ รายชื่อ users  │
│ Inbox on/off │ Channel tok  │ claim rate   │ revoke pairing │
│ Maintenance  │ Flex tmpl    │ replay pkg   │ audit log      │
│ Notifications│ LIFF / LINK  │ dead letter  │ role override  │
└──────────────┴──────────────┴──────────────┴────────────────┘
```

---

## 4. Phase 2 — LINE & Webhook

อ้างอิง `docs/phase-line-reply-webhook.md`

### 4.1 แท็บ「LINE Integration」ในแผง Admin

| ฟิลด์ | เก็บที่ | หมายเหตุ |
|-------|---------|----------|
| Channel ID | Workers Secret | ไม่ส่งลง client |
| Channel Secret | Workers Secret | verify webhook signature |
| Channel Access Token | Workers Secret | reply message |
| LIFF ID | `platform_settings` หรือ env | เปิด deep link |
| Webhook URL | แสดง read-only | `https://api.paligo.jp/v1/line/webhook` |
| OA @username | settings JSON | สร้าง deep link |

### 4.2 สวิตช์ (มี stub ใน MVP แล้ว)

- `lineWebhookEnabled` — รับ POST จาก LINE
- `lineMessagingEnabled` — อนุญาต reply Flex
- `lineNotifyQueueEnabled` — คิว `PALIGO SEND {token}`

### 4.3 DB เพิ่ม (Phase 2)

```sql
CREATE TABLE line_user_links (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  line_user_id TEXT NOT NULL UNIQUE,
  linked_at TEXT NOT NULL
);

CREATE TABLE line_notify_queue (
  id TEXT PRIMARY KEY,
  reviewer_user_id TEXT NOT NULL,
  inbox_item_id TEXT,
  token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
```

### 4.4 Flow แจ้งครู (สรุป)

1. นักเรียนส่ง inbox สำเร็จ → สร้าง notify token
2. นักเรียนส่งข้อความ `PALIGO SEND {token}` ใน LINE → reply ยืนยัน (ฟรี)
3. ครูกด Rich Menu「งานใหม่」→ reply Flex carousel จากคิว (ฟรี)

---

## 5. Phase 2 — Inbox Operations

| ฟีเจอร์ในแผง | รายละเอียด |
|--------------|------------|
| สถิติ real-time | pending / claimed / วันนี้ |
| ค้นหา inbox item | by bookId, student, reviewer |
| Replay package | ส่งซ้ำเมื่อ push ล้มเหลว |
| Revoke pairing | ยกเลิกจับคู่ (ครูเท่านั้น) |
| Maintenance banner | เมื่อ `maintenanceMode = true` แสดงทุกหน้า |

API แนะนำ:

- `GET /v1/admin/inbox?status=pending`
- `POST /v1/admin/inbox/{id}/replay`
- `DELETE /v1/admin/pairings/{id}`

---

## 6. Phase 3 — Notifications

| ช่องทาง | เปิดเมื่อ | ผู้รับ |
|---------|-----------|--------|
| In-app (แชท system msg) | `notificationsEnabled` | ทุก role |
| LINE reply | `lineNotifyQueueEnabled` | ครู, นักเรียน (opt-in) |
| Email (optional) | flag แยก | มีอีเมลในบัญชี |

แผง Admin:

- เทมเพลตข้อความ (ไทย)
- ทดสอบส่ง (dry-run)
- ดู log 50 รายการล่าสุด

---

## 7. Phase 3 — ผู้ใช้ & ความปลอดภัย

| ฟีเจอร์ | คำอธิบาย |
|---------|----------|
| รายชื่อ users | ค้นหา · ดู role · super admin badge |
| Force logout session | ลบ session ผู้ใช้ |
| Promote super admin | เพิ่มอีเมลใน allowlist (env/DB) |
| Audit log | ใครเปลี่ยน flag เมื่อไหร่ (`platform_settings.updated_by`) |

**ผู้ช่วยครู (assistant):** Phase 3 — เพิ่ม `reviewer_kind` + ตาราง `reviewer_assistants` (ดูแผนโปรไฟล์)

---

## 8. ไฟล์ใน repo (MVP)

| ไฟล์ | หน้าที่ |
|------|---------|
| `exam-super-admin.html` | แผงควบคุม UI |
| `paligo-platform.js` | feature gate client |
| `workers/src/platform.js` | flags API + super admin check |
| `workers/migrations/0004_super_admin.sql` | schema + seed emails |

---

## 9. วิธีทดสอบ MVP

1. สมัครบัญชี `tha.std@paligo.jo` (นักเรียน) หรือ `tha.tc@paligo.jp` (ครู)
2. Login → เปิด `exam-super-admin.html`
3. เปิดสวิตช์「Import / Export」→ บันทึก
4. เปิด `exam-account.html` ด้วยบัญชีธรรมดา → ไม่เห็นแท็บขั้นสูง
5. เปิดด้วย super admin → เห็นแท็บขั้นสูง

```bash
cd workers && npx wrangler d1 migrations apply paligo-inbox --local
```

---

## 10. ข้อเสนอถัดไป (ให้ผู้ใช้ตัดสินใจ)

1. **Phase 2 ก่อน:** LINE webhook + แท็บเชื่อม LINE ในโปรไฟล์ครู
2. **หรือ Inbox Ops ก่อน:** แผงดูคิว + replay สำหรับ support
3. **Maintenance mode:** banner ทุกหน้าเมื่อปิดระบบชั่วคราว

แนะนำลำดับ: **Import/Export gate (✅) → Inbox Ops → LINE webhook → Notifications**

# Inbox v1 — Sprint Backlog & Phases

**Board:** [Paligo — Scrum Board](https://github.com/users/niyata/projects/14)  
**Epic:** Inbox v1 (Cloudflare MVP → DO migration path)  
**Domain plan:**

| Host | บทบาท |
|------|--------|
| `paligo.jp` | Landing · marketing · เปิดตัว |
| `app.paligo.jp` | Cloudflare Pages — exam app (static HTML/JS) |
| `api.paligo.jp` | Workers (Phase 0–5) → DO API (Phase 6+) |

**Seed issues ลง board:**

```bash
./scripts/seed-inbox-sprint.sh
```

---

## หลักการจัด Phase

ทำ **ทีละ flow ให้จบ** ก่อนขยาย — อย่าเปิด Phase ถัดไปจน acceptance criteria ของ Phase ก่อนหน้าผ่าน QA

> **PALI-AI handoff (Cloud Code)** เป็น track คู่ขนาน — **ไม่แทน** Phase 0–4 ด้านล่าง · ดู [`docs/pali-ai/CLOUD-CODE-ALIGNMENT.md`](../pali-ai/CLOUD-CODE-ALIGNMENT.md)

```text
Phase 0  Foundation     → API ตอบ health · client รู้ apiBase
Phase 1  Auth + Pair    → 2 บัญชีจับคู่ได้
Phase 2  Push → ครู    → ส่งตรวจเข้า inbox ครู
Phase 3  Claim → ตรวจ  → ครูรับเล่ม · เปิด editor review
Phase 4  Push → นักเรียน → ส่งผลกลับ · นักเรียน claim · reviewed
Phase 5  UX polish     → หน้า inbox · ย้าย import/export ไปเพิ่มเติม
Phase 6  Scale prep    → backup D1 · แผนย้าย Postgres บน DO
```

---

## Sprint 2026-W28 (ปัจจุบัน) — Phase 0 Foundation

| # | Issue | Priority | Agent | สถานะเป้า |
|---|-------|----------|-------|-----------|
| 0.1 | Workers API skeleton + `/v1/health` | P0 | cursor-ai | **In Progress → Done** |
| 0.2 | `PALIGO_CONFIG.apiBase` + `PaligoInboxClient` | P0 | cursor-ai | **In Progress → Done** |
| 0.3 | Deploy guide + `wrangler.jsonc` routes `api.paligo.jp` | P1 | cursor-ai | Ready |
| 0.4 | Cloudflare Pages project สำหรับ `app.paligo.jp` | P1 | human | Ready |
| 0.5 | DNS: `app` + `api` CNAME/A ใน Cloudflare | P1 | human | Backlog |
| 0.6 | Smoke: `PaligoInboxClient.healthCheck()` จาก localhost | P1 | cursor-ai | Ready (หลัง 0.1–0.2) |

### Definition of Done — Phase 0

- [x] `cd workers && npm run dev` → `GET http://localhost:8788/v1/health` คืน `{ ok: true }` (smoke: `scripts/smoke-inbox-api.sh`)
- [x] `app` (local 8765) โหลด `paligo-config.js` · `apiBase` ชี้ `localhost:8788`
- [x] CORS อนุญาต `localhost:8765` และ `https://app.paligo.jp`
- [ ] Deploy Workers ไป `api.paligo.jp` (หลัง 0.4–0.5)
- [x] Docs: `workers/README.md` + domain plan

**ไม่เริ่ม Phase 1 จนกว่า PO อนุมัติ Phase 0 Done**

---

## Sprint 2026-W29 — Phase 1 Auth + Pairing

| # | Issue | Priority | Agent |
|---|-------|----------|-------|
| 1.1 | D1 schema: `users`, `sessions`, `pairings` | P0 | cursor-ai |
| 1.2 | `POST /v1/auth/register`, `/login`, `/logout`, `GET /me` | P0 | cursor-ai |
| 1.3 | `POST /v1/pairings/invite`, `/join` (invite code) | P0 | cursor-ai |
| 1.4 | UI: หน้า login/register + จับคู่ครู–นักเรียน | P1 | cursor-ai |
| 1.5 | Session token ใน client (localStorage + Bearer header) | P1 | cursor-ai |

### DoD — Phase 1

- [x] ครู 1 บัญชี + นักเรียน 1 บัญชี register/login ได้
- [x] นักเรียน join ด้วย invite code → `GET /me` แสดง pairing
- [x] ไม่มี draft ถูก sync ขึ้น server

---

## Sprint 2026-W30 — Phase 2 Push → ครู

| # | Issue | Priority | Agent |
|---|-------|----------|-------|
| 2.1 | D1 + R2: `packages`, `inbox_items` | P0 | cursor-ai |
| 2.2 | `POST /v1/packages` (direction `to-reviewer`) | P0 | cursor-ai |
| 2.3 | `GET /v1/inbox` สำหรับ reviewer | P0 | cursor-ai |
| 2.4 | Editor: หลังส่งตรวจ → push inbox (แทน download หลัก) | P0 | cursor-ai |
| 2.5 | `answerHash` validate ฝั่ง server | P1 | cursor-ai |

### DoD — Phase 2

- [x] นักเรียนส่งตรวจ → ครูเห็นรายการ pending ใน inbox
- [x] Payload = `paligo.exam.bookTransfer.v1` ใน D1 (`payload_json` — R2 ภายหลัง)

---

## Sprint 2026-W31 — Phase 3 Claim → ตรวจ

| # | Issue | Priority | Agent |
|---|-------|----------|-------|
| 3.1 | `GET /v1/inbox/{id}`, `POST /v1/inbox/{id}/claim` | P0 | cursor-ai |
| 3.2 | Reviewer console: แท็บ Inbox + รับเข้าคลัง | P0 | cursor-ai |
| 3.3 | `intendedRecipientLabel` แสดงก่อน claim | P1 | cursor-ai |
| 3.4 | Role enforce: เฉพาะ reviewer claim `to-reviewer` | P0 | cursor-ai |

### DoD — Phase 3

- [x] ครู claim → `importBookTransfer()` → เปิด `?mode=review` ได้
- [x] นักเรียน claim inbox `to-reviewer` ไม่ได้ (403)

---

## Sprint 2026-W32 — Phase 4 Push → นักเรียน (flow จบ loop)

| # | Issue | Priority | Agent |
|---|-------|----------|-------|
| 4.1 | `POST /v1/packages` (direction `to-student`) | P0 | cursor-ai |
| 4.2 | นักเรียน claim → status `reviewed` + stamp | P0 | cursor-ai |
| 4.3 | `exam-review-results.html` อ่านจาก inbox | P1 | cursor-ai |
| 4.4 | E2E test plan: student → teacher → student | P0 | human |

### DoD — Phase 4 — **MVP Inbox สมบูรณ์**

- [x] Loop ครบ: ส่งตรวจ → ครูตรวจ → ส่งกลับ (inbox) → นักเรียน claim ผล (API smoke + UI `exam-inbox.html`)
- [x] Import/export ไฟล์ยังใช้ได้ (fallback download เมื่อ push inbox ไม่ได้)

---

## Sprint 2026-W33 — Phase 5 UX + เมนูเพิ่มเติม

| # | Issue | Priority | Agent |
|---|-------|----------|-------|
| 5.1 | หน้า `exam-inbox.html` รวม inbox ทั้งสอง role | P1 | cursor-ai |
| 5.2 | ย้าย import/export ไป **เพิ่มเติม → โอนไฟล์ (ขั้นสูง)** | P1 | cursor-ai |
| 5.3 | `PALIGO_CONFIG.features.inbox = true` production | P1 | cursor-ai |
| 5.4 | Landing `paligo.jp` (แยก epic ได้) | P2 | human |

---

## Phase 6 — Scale prep (ไม่มี sprint กำหนดวัน)

| # | Issue | Priority |
|---|-------|----------|
| 6.1 | D1 export / backup script | P2 |
| 6.2 | Postgres schema บน DO (mirror D1) | P2 |
| 6.3 | API บน DO · DNS `api.*` สลับ · Pages คงที่ | P2 |
| 6.4 | Load test + quota R2 | P2 |

---

## Phase 8 — LINE Flex Webhook (Reply-only · Backlog)

> **อย่าเริ่มจน Inbox loop (Phase 4) ครบ** · สเปคเต็ม: [`docs/phase-line-reply-webhook.md`](../phase-line-reply-webhook.md)

| # | Issue | Priority | Agent |
|---|-------|----------|-------|
| 8.0 | LINE OA + webhook verify (`POST /v1/webhooks/line`) | P2 | cursor-ai |
| 8.1 | ผูก LINE ID ครู (PALIGO LINK) + แท็บเชื่อม LINE ใน exam-account | P2 | cursor-ai |
| 8.2 | Rich Menu ครู + reply Flex คิว pending (ไม่ push) | P2 | cursor-ai |
| 8.3 | Student trigger `PALIGO SEND` หลังส่งตรวจ → line_notify_queue | P2 | cursor-ai |
| 8.4 | LIFF (`exam-line-liff.html`) + script-push badge + แจ้งการส่ง | P2 | cursor-ai |
| 8.5 | Reply Flex ผลตรวจกลับนักเรียน (หลัง Phase 4 to-student) | P3 | cursor-ai |

### ไอเดียสรุป (PO)

- **Reply ฟรี · ไม่ Push** — ครูได้ Flex เมื่อกด Rich Menu / พิมพ์ `คิว` (deferred reply)
- นักเรียน trigger ด้วย `PALIGO SEND {token}` หลัง push inbox
- หน้าตั้งค่าให้ครูเชื่อม LINE ID กับบัญชี Inbox

---

## Phase 7 — ระบบเลขคิวตรวจ (Backlog · จาก PO 2026-07-07)

> **อย่าเริ่มจน Inbox loop (Phase 4) ครบ** · สเปคเต็ม: [`docs/exam-review-queue-backlog.md`](../exam-review-queue-backlog.md)

| # | Issue | Priority | Agent |
|---|-------|----------|-------|
| 7.1 | เลขคิว + สถานะ queue ตอน push inbox (API + DB) | P2 | cursor-ai |
| 7.2 | นักเรียน: การ์ดเลขคิว + สถานะ + progress กลาง | P2 | cursor-ai |
| 7.3 | ครู: รายการคิวเรียงลำดับ + 「คิวถัดไป」 | P2 | cursor-ai |
| 7.4 | สถิติกลาง: ทั้งหมด / ตรวจแล้ว / เหลือ + progress bar (Apple HIG) | P2 | cursor-ai |

### ไอเดียสรุป (PO)

- ครูตรวจตามลำดับคิว
- นักเรียนเห็นเลขคิวตัวเอง + สถานะ + คิวส่วนกลาง
- แสดง ทั้งหมดกี่คิว · ตรวจแล้ว · เหลือ · progress bar สวยตาม Apple HIG

---

## Phase 9–10 — กัลยาณมิตร · ศิษย์ · Feed (Backlog)

> **อย่าเริ่มจน Phase 4 Done** · สเปค: [`docs/phase-social-relations-feed.md`](../phase-social-relations-feed.md) · Backlog ทีม: [`docs/agile/phase-social-sprint-backlog.md`](phase-social-sprint-backlog.md)

| Phase | สรุป | Priority |
|-------|------|----------|
| **9** | เพิ่มกัลยาณมิตร · ฝากตัวเป็นศิษย์ · รับเป็นมิตร · รับตัวเป็นศิษย์ | P1 |
| **10** | Feed กิจกรรม · คะแนนหลังตรวจ · ประกาศ leaderboard | P2 |

### คำศัพท์ UI (PO)

- เพิ่มเพื่อน → **เพิ่มกัลยาณมิตร** · รับ → **รับเป็นมิตร**
- เพิ่มครู → **ฝากตัวเป็นศิษย์** · รับ → **รับตัวเป็นศิษย์**

### ทีม

- **A** Relations API · **B** Social UX · **C** Feed · **D** Seam Audit (matrix §7 ใน spec)

---

## การตัดสินใจของ PO (คุณ)

หลัง seed issues แล้ว ให้ triage บน board:

1. ยืนยัน **Phase 0** issues 0.1–0.2 → **Done** หลัง scaffold merge
2. ย้าย **0.4–0.5** (DNS/Pages) → **Ready** ถ้าพร้อม deploy
3. **อย่า** ลาก Phase 1 เข้า In Progress จน Phase 0 DoD ครบ
4. ติ๊ก `Decision:` ใน issue comment ถ้าเปลี่ยนลำดับ

---

## อ้างอิง

- `docs/exam-inbox-v1-spec.md`
- `docs/exam-inbox-hosting-recommendation.md`
- `docs/exam-review-queue-backlog.md` — Phase 7 คิวตรวจ
- `docs/phase-line-reply-webhook.md` — Phase 8 LINE reply webhook
- `docs/phase-social-relations-feed.md` — Phase 9–10 มิตร/ศิษย์/feed
- `docs/pali-ai/CLOUD-CODE-ALIGNMENT.md` — Paligo web vs Cloud Code PALI-AI (handoff ไม่แทน sprint นี้)
- `docs/agile/SCRUM-WORKFLOW.md`
- `workers/README.md`

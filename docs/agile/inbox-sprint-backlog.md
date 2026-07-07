# Inbox v1 — Sprint Backlog & Phases

**Board:** [Paligo — Scrum Board](https://github.com/users/niyata/projects/14)  
**Epic:** Inbox v1 (Cloudflare MVP → DO migration path)  
**Domain plan:**

| Host | บทบาท |
|------|--------|
| `paligo.com` | Landing · marketing · เปิดตัว |
| `app.paligo.com` | Cloudflare Pages — exam app (static HTML/JS) |
| `api.paligo.com` | Workers (Phase 0–5) → DO API (Phase 6+) |

**Seed issues ลง board:**

```bash
./scripts/seed-inbox-sprint.sh
```

---

## หลักการจัด Phase

ทำ **ทีละ flow ให้จบ** ก่อนขยาย — อย่าเปิด Phase ถัดไปจน acceptance criteria ของ Phase ก่อนหน้าผ่าน QA

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
| 0.3 | Deploy guide + `wrangler.jsonc` routes `api.paligo.com` | P1 | cursor-ai | Ready |
| 0.4 | Cloudflare Pages project สำหรับ `app.paligo.com` | P1 | human | Ready |
| 0.5 | DNS: `app` + `api` CNAME/A ใน Cloudflare | P1 | human | Backlog |
| 0.6 | Smoke: `PaligoInboxClient.healthCheck()` จาก localhost | P1 | cursor-ai | Ready (หลัง 0.1–0.2) |

### Definition of Done — Phase 0

- [ ] `cd workers && npm run dev` → `GET http://localhost:8787/v1/health` คืน `{ ok: true }`
- [ ] `app` (local 8765) โหลด `paligo-config.js` · `apiBase` ชี้ `localhost:8787`
- [ ] CORS อนุญาต `localhost:8765` และ `https://app.paligo.com`
- [ ] Deploy Workers ไป `api.paligo.com` (หลัง 0.4–0.5)
- [ ] Docs: `workers/README.md` + domain plan

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

- [ ] ครู 1 บัญชี + นักเรียน 1 บัญชี register/login ได้
- [ ] นักเรียน join ด้วย invite code → `GET /me` แสดง pairing
- [ ] ไม่มี draft ถูก sync ขึ้น server

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

- [ ] นักเรียนส่งตรวจ → ครูเห็นรายการ pending ใน inbox ภายใน 5s
- [ ] Payload = `paligo.exam.bookTransfer.v1` ใน R2

---

## Sprint 2026-W31 — Phase 3 Claim → ตรวจ

| # | Issue | Priority | Agent |
|---|-------|----------|-------|
| 3.1 | `GET /v1/inbox/{id}`, `POST /v1/inbox/{id}/claim` | P0 | cursor-ai |
| 3.2 | Reviewer console: แท็บ Inbox + รับเข้าคลัง | P0 | cursor-ai |
| 3.3 | `intendedRecipientLabel` แสดงก่อน claim | P1 | cursor-ai |
| 3.4 | Role enforce: เฉพาะ reviewer claim `to-reviewer` | P0 | cursor-ai |

### DoD — Phase 3

- [ ] ครู claim → `importBookTransfer()` → เปิด `?mode=review` ได้
- [ ] นักเรียน claim inbox ของครูไม่ได้ (403)

---

## Sprint 2026-W32 — Phase 4 Push → นักเรียน (flow จบ loop)

| # | Issue | Priority | Agent |
|---|-------|----------|-------|
| 4.1 | `POST /v1/packages` (direction `to-student`) | P0 | cursor-ai |
| 4.2 | นักเรียน claim → status `reviewed` + stamp | P0 | cursor-ai |
| 4.3 | `exam-review-results.html` อ่านจาก inbox | P1 | cursor-ai |
| 4.4 | E2E test plan: student → teacher → student | P0 | human |

### DoD — Phase 4 — **MVP Inbox สมบูรณ์**

- [ ] Loop ครบ: ส่งตรวจ → ครูตรวจ → ส่งกลับ → นักเรียนเห็นผล
- [ ] Import/export ไฟล์ยังใช้ได้ (ยังไม่ย้ายเมนู — Phase 5)

---

## Sprint 2026-W33 — Phase 5 UX + เมนูเพิ่มเติม

| # | Issue | Priority | Agent |
|---|-------|----------|-------|
| 5.1 | หน้า `exam-inbox.html` รวม inbox ทั้งสอง role | P1 | cursor-ai |
| 5.2 | ย้าย import/export ไป **เพิ่มเติม → โอนไฟล์ (ขั้นสูง)** | P1 | cursor-ai |
| 5.3 | `PALIGO_CONFIG.features.inbox = true` production | P1 | cursor-ai |
| 5.4 | Landing `paligo.com` (แยก epic ได้) | P2 | human |

---

## Phase 6 — Scale prep (ไม่มี sprint กำหนดวัน)

| # | Issue | Priority |
|---|-------|----------|
| 6.1 | D1 export / backup script | P2 |
| 6.2 | Postgres schema บน DO (mirror D1) | P2 |
| 6.3 | API บน DO · DNS `api.*` สลับ · Pages คงที่ | P2 |
| 6.4 | Load test + quota R2 | P2 |

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
- `docs/agile/SCRUM-WORKFLOW.md`
- `workers/README.md`

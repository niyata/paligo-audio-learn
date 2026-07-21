# Paligo Inbox API (Cloudflare Workers)

Phase 0 skeleton — `GET /v1/health` + CORS + stub routes

**Production:** `https://api.paligo.jp/v1`  
**Local dev:** `http://localhost:8788/v1` (wrangler) + static app ที่ `localhost:8765`

> Port **8788** มักชนกับ process อื่น — API ใช้ **8788** เป็นค่าเริ่มต้น

Spec: [`docs/exam-inbox-v1-spec.md`](../docs/exam-inbox-v1-spec.md)

---

## Quick start

```bash
# Terminal 1 — API
cd workers
npm install
npm run db:migrate:local
npm run dev

# Terminal 2 — static app (repo root)
python3 -m http.server 8765
```

Verify:

```bash
curl -s http://localhost:8788/v1/health | jq .

# Register reviewer
curl -s -X POST http://localhost:8788/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"role":"reviewer","displayName":"ครูทดสอบ","pin":"123456"}' | jq .

# Login + me (use sessionToken from register)
curl -s http://localhost:8788/v1/me -H "Authorization: Bearer <token>" | jq .
```

Browser: [`exam-account.html`](../exam-account.html) — สมัคร · login · จับคู่

---

## Routes (Phase 1)

| Method | Path | Status |
|--------|------|--------|
| GET | `/v1/health` | 200 |
| POST | `/v1/auth/register` | 201 |
| POST | `/v1/auth/login` | 200 |
| POST | `/v1/auth/logout` | 200 |
| GET | `/v1/me` | 200 (auth) |
| PATCH | `/v1/me` | 200 (auth) — profile sync; CORS ต้องมี PATCH |
| POST | `/v1/pairings/invite` | 201 (reviewer) |
| POST | `/v1/pairings/join` | 201 (student) |
| POST | `/v1/packages` | 201 to-reviewer · to-student |
| GET | `/v1/inbox` | 200 |
| POST | `/v1/inbox/{id}/claim` | 200 |

---

## D1 migrations

```bash
cd workers
npm run db:migrate:local    # dev
npm run db:migrate:remote   # production (after wrangler d1 create)
```

Production: สร้าง DB จริงแล้วอัปเดต `database_id` ใน `wrangler.jsonc`:

```bash
wrangler d1 create paligo-inbox
```

---

## CORS (สำคัญ)

Inbox client ใช้ `PATCH /v1/me` — Workers ต้องตอบ preflight ด้วย:

`Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS`

หลัง deploy ตรวจเสมอ:

```bash
npm run smoke:cors
# หรือ: node ../scripts/smoke-inbox-cors.mjs https://api.paligo.jp/v1
```

อย่าลดรายการ methods กลับเป็นแค่ GET/POST — เบราว์เซอร์จะบล็อกบันทึกโปรไฟล์/จับคู่ครู

---

## Deploy (unchanged)

1. `wrangler login`
2. เพิ่ม zone `paligo.jp` ใน Cloudflare
3. เปิด comment ใน `wrangler.jsonc`:

```jsonc
"routes": [{ "pattern": "api.paligo.jp/*", "zone_name": "paligo.jp" }]
```

4. Deploy:

```bash
cd workers
npm run deploy
```

5. DNS: `api` → Worker route (Cloudflare proxy ON)

---

## Client config

| ไฟล์ | หน้าที่ |
|------|--------|
| `paligo-config.js` | `PALIGO_CONFIG.apiBase` |
| `paligo-inbox-client.js` | `PaligoInboxClient.healthCheck()` |

Local ใช้ `http://localhost:8788/v1` อัตโนมัติ  
Override: `window.PALIGO_API_BASE = "…"` ก่อนโหลด `paligo-config.js`

---

## Phase roadmap

| Phase | งาน |
|-------|-----|
| 0 | skeleton + health + CORS |
| 1 | D1 + auth + pairing |
| 2 | POST packages to-reviewer |
| 3 | inbox list + claim (reviewer) |
| 4 | POST packages to-student + student claim |
| 5 | exam-inbox UX polish |

Smoke (local): `bash scripts/smoke-inbox-api.sh` (ต้อง `cd workers && npm run dev`)

Backlog: [`docs/agile/inbox-sprint-backlog.md`](../docs/agile/inbox-sprint-backlog.md)

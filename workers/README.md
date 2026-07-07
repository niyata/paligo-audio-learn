# Paligo Inbox API (Cloudflare Workers)

Phase 0 skeleton — `GET /v1/health` + CORS + stub routes

**Production:** `https://api.paligo.com/v1`  
**Local dev:** `http://localhost:8787/v1` (wrangler) + static app ที่ `localhost:8765`

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
curl -s http://localhost:8787/v1/health | jq .

# Register reviewer
curl -s -X POST http://localhost:8787/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"role":"reviewer","displayName":"ครูทดสอบ","pin":"123456"}' | jq .

# Login + me (use sessionToken from register)
curl -s http://localhost:8787/v1/me -H "Authorization: Bearer <token>" | jq .
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
| POST | `/v1/pairings/invite` | 201 (reviewer) |
| POST | `/v1/pairings/join` | 201 (student) |
| GET | `/v1/inbox` | 200 empty (Phase 2) |
| POST | `/v1/packages` | 501 Phase 2 |

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

## Deploy (unchanged)

1. `wrangler login`
2. เพิ่ม zone `paligo.com` ใน Cloudflare
3. เปิด comment ใน `wrangler.jsonc`:

```jsonc
"routes": [{ "pattern": "api.paligo.com/*", "zone_name": "paligo.com" }]
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

Local ใช้ `http://localhost:8787/v1` อัตโนมัติ  
Override: `window.PALIGO_API_BASE = "…"` ก่อนโหลด `paligo-config.js`

---

## Phase roadmap

| Phase | งาน |
|-------|-----|
| 0 | skeleton (นี้) | ✅ |
| 1 | D1 + auth + pairing | ✅ |
| 2 | R2 + POST packages |
| 3 | claim + reviewer UI |
| 4 | return to student |
| 5 | exam-inbox.html + เมนูเพิ่มเติม |

Backlog: [`docs/agile/inbox-sprint-backlog.md`](../docs/agile/inbox-sprint-backlog.md)

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
npm run dev

# Terminal 2 — static app (repo root)
python3 -m http.server 8765
```

Verify:

```bash
curl -s http://localhost:8787/v1/health | jq .
curl -s -H "Origin: http://localhost:8765" http://localhost:8787/v1/health -D -
```

Browser (เปิด `exam-books.html`):

```javascript
PaligoInboxClient.healthCheck().then(console.log);
```

---

## Routes (Phase 0)

| Method | Path | Status |
|--------|------|--------|
| GET | `/v1/health` | 200 |
| GET | `/v1/me` | 401 stub |
| GET | `/v1/inbox` | 401 stub |
| POST | `/v1/packages` | 501 Phase 2 |
| POST | `/v1/auth/*` | 501 Phase 1 |
| POST | `/v1/pairings/*` | 501 Phase 1 |

---

## Deploy

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
| 0 | skeleton (นี้) |
| 1 | D1 + auth + pairing |
| 2 | R2 + POST packages |
| 3 | claim + reviewer UI |
| 4 | return to student |
| 5 | exam-inbox.html + เมนูเพิ่มเติม |

Backlog: [`docs/agile/inbox-sprint-backlog.md`](../docs/agile/inbox-sprint-backlog.md)

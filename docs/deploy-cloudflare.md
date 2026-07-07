# Deploy — Cloudflare (Paligo)

Domain plan สำหรับเปิดตัวและ Inbox MVP

| Domain | บริการ | เนื้อหา |
|--------|--------|---------|
| `paligo.com` | Cloudflare Pages (หรือ landing แยก) | Marketing · เปิดตัว |
| `app.paligo.com` | **Cloudflare Pages** | Exam app — repo static HTML |
| `api.paligo.com` | **Cloudflare Workers** | Inbox API (`workers/`) |

ภายหลัง scale: **Pages คงที่** · **API + Postgres ย้าย DO** · DNS `api.*` ชี้ใหม่

---

## 1. Cloudflare Pages — `app.paligo.com`

1. Dashboard → Workers & Pages → Create → Connect Git → `niyata/paligo-audio-learn`
2. Branch: `new-dev` (หรือ `main` ตามที่ ship)
3. Build settings:
   - **Framework preset:** None
   - **Build command:** (ว่าง)
   - **Build output directory:** `/` (root — ไฟล์ `.html` อยู่ root)
4. Custom domain → `app.paligo.com`
5. (Optional) `_headers` สำหรับ cache static assets

Local preview ก่อน deploy:

```bash
python3 -m http.server 8765
# http://localhost:8765/exam-books.html
```

---

## 2. Cloudflare Workers — `api.paligo.com`

ดู [`workers/README.md`](../workers/README.md)

```bash
cd workers && npm install && npm run deploy
```

`wrangler.jsonc` — เปิด routes หลัง zone พร้อม:

```jsonc
"routes": [{ "pattern": "api.paligo.com/*", "zone_name": "paligo.com" }]
```

---

## 3. DNS (Cloudflare zone `paligo.com`)

| Record | Type | Target |
|--------|------|--------|
| `@` | A/CNAME | Pages (landing) หรือ redirect → www |
| `app` | CNAME | `<project>.pages.dev` (Proxied) |
| `api` | ไม่ต้อง CNAME แยกถ้าใช้ Workers route | Worker route bind ใน wrangler |

SSL: **Full (strict)**

---

## 4. Client ↔ API

`paligo-config.js` ตั้งค่าอัตโนมัติ:

| Environment | `apiBase` |
|-------------|-----------|
| localhost:8765 | `http://localhost:8787/v1` |
| app.paligo.com | `https://api.paligo.com/v1` |

CORS อนุญาต: `https://app.paligo.com`, `localhost:8765`, `*.pages.dev`

---

## 5. Landing `paligo.com`

แยก epic ได้ — ตัวเลือก:

- Pages project ที่สอง (โฟลเดอร์ `landing/` ภายหลัง)
- CyberPanel / DO ชั่วคราว redirect → `app.paligo.com`
- Cloudflare redirect rule: `paligo.com` → marketing page

---

## 6. Checklist เปิดตัว

- [ ] Pages deploy · `app.paligo.com` เปิด exam-books
- [ ] Workers deploy · `curl https://api.paligo.com/v1/health`
- [ ] `PaligoInboxClient.healthCheck()` จาก production app
- [ ] Scrum: Phase 0 DoD ใน `docs/agile/inbox-sprint-backlog.md`

---

## อ้างอิง

- [`docs/exam-inbox-hosting-recommendation.md`](./exam-inbox-hosting-recommendation.md)
- [`docs/agile/inbox-sprint-backlog.md`](./agile/inbox-sprint-backlog.md)

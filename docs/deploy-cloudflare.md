# Deploy — Cloudflare (Paligo)

Domain plan สำหรับเปิดตัวและ Inbox MVP

| Domain | บริการ | เนื้อหา |
|--------|--------|---------|
| `paligo.jp` | Cloudflare Pages (หรือ landing แยก) | Marketing · เปิดตัว |
| `app.paligo.jp` | **Cloudflare Pages** | Exam app — repo static HTML |
| `api.paligo.jp` | **Cloudflare Workers** | Inbox API (`workers/`) |

ภายหลัง scale: **Pages คงที่** · **API + Postgres ย้าย DO** · DNS `api.*` ชี้ใหม่

---

## 1. Cloudflare Pages — `app.paligo.jp`

1. Dashboard → Workers & Pages → Create → Connect Git → `niyata/paligo-audio-learn`
2. Branch: `new-dev` (หรือ `main` ตามที่ ship)
3. Build settings:
   - **Framework preset:** None
   - **Build command:** (ว่าง)
   - **Build output directory:** `/` (root — ไฟล์ `.html` อยู่ root)
4. Custom domain → `app.paligo.jp`
5. (Optional) `_headers` สำหรับ cache static assets

Local preview ก่อน deploy:

```bash
python3 -m http.server 8765
# http://localhost:8765/exam-books.html
```

---

## 2. Cloudflare Workers — `api.paligo.jp`

ดู [`workers/README.md`](../workers/README.md)

```bash
cd workers && npm install && npm run deploy
```

`wrangler.jsonc` — เปิด routes หลัง zone พร้อม:

```jsonc
"routes": [{ "pattern": "api.paligo.jp/*", "zone_name": "paligo.jp" }]
```

---

## 3. DNS (Cloudflare zone `paligo.jp`)

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
| localhost:8765 | `http://localhost:8788/v1` |
| app.paligo.jp | `https://api.paligo.jp/v1` |

CORS อนุญาต: `https://app.paligo.jp`, `localhost:8765`, `*.pages.dev`

---

## 5. Landing `paligo.jp`

แยก epic ได้ — ตัวเลือก:

- Pages project ที่สอง (โฟลเดอร์ `landing/` ภายหลัง)
- CyberPanel / DO ชั่วคราว redirect → `app.paligo.jp`
- Cloudflare redirect rule: `paligo.jp` → marketing page

---

## 6. Checklist เปิดตัว

- [ ] Pages deploy · `app.paligo.jp` เปิด exam-books
- [ ] Workers deploy · `curl https://api.paligo.jp/v1/health`
- [ ] `PaligoInboxClient.healthCheck()` จาก production app
- [ ] Privacy gate: ช่วงทดสอบ production ใช้ `robots.txt` + `X-Robots-Tag: noindex`; ก่อนเปิดตัวจริงให้ Super Admin เปิด `crawlerIndexingAllowed` และ deploy robots/header แบบอนุญาต Google
- [ ] Scrum: Phase 0 DoD ใน `docs/agile/inbox-sprint-backlog.md`

---

## 7. Code readiness (ตรวจแล้ว 2026-07-10 — Claude)

สิ่งที่ **พร้อมแล้วฝั่ง code** รอแค่ขั้นตอน Dashboard/DNS (ต้องคนที่มี access Cloudflare ทำ):

| รายการ | สถานะ |
|--------|-------|
| `_headers` cache rules (root) | ✅ เพิ่มแล้ว — conservative TTL เพราะไฟล์ยังไม่มี fingerprint ใน filename |
| CORS ฝั่ง Workers (`workers/src/http.js`) | ✅ อนุญาต `app.paligo.jp`, `localhost:8765`, `*.pages.dev` อยู่แล้ว ตรงกับแผน §4 |
| `paligo-config.js` apiBase/appOrigin resolver | ✅ แยก local/production ถูกต้องแล้ว ไม่ต้องแก้ |
| `wrangler.jsonc` routes (`api.paligo.jp/*`) | ⛔ ยัง **comment ไว้ตามเดิม** — ต้อง uncomment เองหลัง zone `paligo.jp` ขึ้น Cloudflare จริงเท่านั้น (ห้ามเปิดก่อน มิฉะนั้น deploy fail) |

**ยังบล็อกอยู่ (ต้อง PO/คนมี Cloudflare Dashboard access ทำ ไม่ใช่งาน code):**

1. สร้าง Cloudflare Pages project + connect repo (§1)
2. ผูก custom domain `app.paligo.jp` + DNS record `app` → Pages (§3)
3. Deploy Workers + ผูก zone แล้วค่อย uncomment routes ใน `wrangler.jsonc`
4. ยังไม่มี cloudflared tunnel ใดๆ ในโปรเจ็คนี้ — แผนใช้ Cloudflare Pages ปกติ ไม่ใช่ tunnel

---

## อ้างอิง

- [`docs/exam-inbox-hosting-recommendation.md`](./exam-inbox-hosting-recommendation.md)
- [`docs/agile/inbox-sprint-backlog.md`](./agile/inbox-sprint-backlog.md)

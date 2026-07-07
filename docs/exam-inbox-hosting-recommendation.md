# Inbox v1 — การเลือก Hosting

วันที่: 2026-07-07  
Use case: static HTML frontend + REST API + SQL metadata + object storage สำหรับ `bookTransfer` JSON

---

## ความต้องการของ Paligo Inbox

| ความต้องการ | น้ำหนัก |
|-------------|---------|
| Static site (HTML/JS ปัจจุบัน) | สูง |
| REST API (auth, inbox, claim) | สูง |
| เก็บ JSON payload ต่อเล่ม (~50KB–2MB) | สูง |
| PostgreSQL/SQLite สำหรับ inbox metadata | สูง |
| Latency ดีในไทย | กลาง |
| ต้นทุนต่ำช่วง MVP (ห้องเรียน/วัด) | สูง |
| ดูแล server เอง vs managed | ขึ้นกับทีม |
| ข้อมูลสอบอยู่ server (privacy) | กลาง — ต้อง HTTPS + backup |

---

## ตัวเลือกที่เปรียบเทียบ

### A. DigitalOcean + CyberPanel (self-host ที่มีอยู่)

**สถาปัตยกรรมแนะนำบน droplet เดิม**

```text
CyberPanel (OpenLiteSpeed)
  ├── paligo.example     → static files (repo HTML)
  └── api.paligo.example → reverse proxy → Docker: Node/FastAPI + PostgreSQL
Object storage (optional): DO Spaces สำหรับ payload ใหญ่
```

| ข้อดี | ข้อเสีย |
|------|---------|
| มี server อยู่แล้ว · ไม่เพิ่ม vendor | ดูแล SSL, patch, backup, uptime เอง |
| ข้อมูลอยู่ droplet/Spaces ที่ควบคุมได้ | CyberPanel เหมาะ static/PHP — API ควรแยก Docker/systemd |
| DO Spaces ถูก (~$5/250GB) | ไม่มี edge CDN ถ้าไม่ใส่ Cloudflare หน้า |
| PostgreSQL managed หรือใน droplet | Scale แนวนอนต้องออกแบบเอง |

**เหมาะเมื่อ:** ต้องการ sovereignty · คุ้น DO อยู่แล้ว · ยอมดู then server · อาจมีแอปอื่นบนเครื่องเดียวกัน

**ต้นทุนประมาณ MVP:** $6–12/mo (droplet มีแล้ว) + Spaces $5 ถ้า payload เยอะ

---

### B. Cloudflare (Pages + Workers + D1 + R2) — **แนะนำหลัก**

```text
Pages          → exam-books.html, editor, inbox UI
Workers (API)  → /v1/inbox, /v1/packages, auth
D1 (SQLite)    → users, pairings, inbox_items
R2             → bookTransfer JSON blobs
```

| ข้อดี | ข้อเสีย |
|------|---------|
| PoP ในไทย · latency ดี | เรียนรู้ Workers/D1 binding ใหม่ |
| Free tier ใจกว้าง MVP | D1 ยัง SQLite — query ซับซ้อนมากต้องระวัง |
| Static + API ที่เดียว · deploy จาก Git | vendor-specific (แต่ payload เป็น JSON มาตรฐาน) |
| R2 ไม่คิด egress ไป Workers | |
| ไม่ต้อง patch OS | |

**เหมาะเมื่อ:** อยาก MVP เร็ว · ทีมเล็ก · ไม่อยากดู then server · โปรเจกต์ static-first อยู่แล้ว

**ต้นทุนประมาณ MVP:** $0–5/mo (free tier มักพอหลายร้อย submission/เดือน)

---

### C. Vercel (Pages/Static + Serverless Functions)

| ข้อดี | ข้อเสีย |
|------|---------|
| Deploy static ง่ายมาก | Functions ต้องคู่ DB ภายนอก (Neon, Supabase) |
| DX ดี | Payload ใหญ่ + cold start — ไม่ ideal สำหรับ claim ที่ส่ง JSON เต็ม |
| Edge ใกล้ไทย | แยก vendor หลายที่ (Vercel + DB + blob) |

**เหมาะเมื่อ:** ทีมถนัด Next.js อยู่แล้ว — **ไม่ ideal** สำหรับ Paligo ที่เป็น plain HTML + JSON blob ใหญ่

---

### D. Render

| ข้อดี | ข้อเสีย |
|------|---------|
| Web service + PostgreSQL ในแพลตฟอร์มเดียว | Free tier sleep · cold start |
| Dockerfile deploy ตรงๆ | แพงกว่า CF เมื่อ scale |
| ง่ายกว่า self-host | ไม่มี edge ใกล้ไทยเท่า CF |

**เหมาะเมื่อ:** อยาก API แบบ long-running (Python FastAPI) โดยไม่ดู then server เอง · ไม่ใช้ Workers

**ต้นทุนประมาณ MVP:** $7/mo (web) + $7/mo (Postgres starter)

---

### E. Firebase (Hosting + Auth + Firestore + Storage)

| ข้อดี | ข้อเสีย |
|------|---------|
| Auth พร้อม (email, Google) | Firestore ไม่ relational — inbox query ซับซ้อน |
| Realtime listener ได้ | ราคา Firestore reads โตเร็วถ้า poll inbox บ่อย |
| Storage สำหรับ JSON | ผูกกับ Google ecosystem |

**เหมาะเมื่อ:** ต้องการ Auth + mobile app ในอนาคต · **ไม่ ideal** ถ้าอยาก SQL inbox + audit trail ชัด

---

### F. Supabase (Postgres + Auth + Storage + Edge Functions)

| ข้อดี | ข้อเสีย |
|------|---------|
| Postgres ครบ · RLS สำหรับ inbox | Static hosting ไม่ใช่จุดแข็ง — ยังต้อง Pages ที่อื่น |
| Auth + Storage | Edge Functions region อาจไกลไทย |
| Open source · self-host ได้ | |

**เหมาะเมื่อ:** อยาก Postgres จริงจัง + อาจ self-host Supabase บน DO ภายหลัง — **ทางเลือกที่สองที่ดี**

---

## สรุปคะแนน (Paligo Inbox MVP)

| ตัวเลือก | MVP เร็ว | ต้นทุน | ดู then ต่ำ | ไทย latency | ควบคุมข้อมูล | รวม |
|----------|----------|--------|-------------|-------------|--------------|-----|
| **Cloudflare** | ★★★★★ | ★★★★★ | ★★★★★ | ★★★★★ | ★★★☆☆ | **22** |
| **DO + CyberPanel** | ★★★☆☆ | ★★★★☆ | ★★☆☆☆ | ★★★☆☆ | ★★★★★ | 17 |
| **Supabase + CF Pages** | ★★★★☆ | ★★★★☆ | ★★★★☆ | ★★★★☆ | ★★★★☆ | 20 |
| **Render** | ★★★★☆ | ★★★☆☆ | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | 17 |
| **Firebase** | ★★★★☆ | ★★★☆☆ | ★★★★☆ | ★★★★☆ | ★★★☆☆ | 17 |
| **Vercel** | ★★★☆☆ | ★★★☆☆ | ★★★★☆ | ★★★★☆ | ★★★☆☆ | 16 |

---

## คำแนะนำ

### แนะนำหลัก: **Cloudflare (Pages + Workers + D1 + R2)**

เหตุผลสั้นๆ:

1. Frontend เป็น static HTML อยู่แล้ว — Pages วางได้ทันที
2. Inbox = API บางๆ + SQL + blob — ตรง Workers + D1 + R2
3. ต้นทุน MVP ต่ำ · ไม่ sleep · PoP ในไทย
4. ไม่ต้องแตะ CyberPanel config ซับซ้อน

### แนะนำสำรอง: **DigitalOcean ที่มีอยู่** (ถ้าต้องการข้อมูลอยู่ server ตัวเอง 100%)

รูปแบบที่ลดความเสี่ยง:

- **Static:** CyberPanel serve repo (หรือ sync จาก Git)
- **API:** Docker Compose บน droplet เดียวกัน — `api` + `postgres`
- **Payload:** DO Spaces (อย่าเก็บ JSON 2MB ใน Postgres)
- **CDN/WAF:** ใส่ Cloudflare หน้า domain (ฟรี) แม้ API อยู่ DO

### Hybrid ที่ใช้ได้จริง

```text
Cloudflare Pages  (UI)
Cloudflare Workers (API)
D1 + R2
---
ภายหลัง: ย้าย API ไป DO ได้ถ้า policy ต้องการ — client เรียก REST เดิม
```

---

## Phase 0 — สิ่งที่ทำก่อนเลือกแพลตฟอร์ม

1. ตั้ง domain + HTTPS (ทุกตัวเลือกต้องมี)
2. POC: `POST /packages` เก็บ JSON 1 เล่ม · `GET claim` คืน payload
3. ทดสอบ 2 browser profiles (student + reviewer) กับ API จริง
4. วัดขนาด payload เฉลี่ยจากสมุดจริง 3–5 เล่ม → กำหนด quota

---

## การตัดสินใจแบบเร็ว

| ถ้าคุณ… | เลือก |
|---------|-------|
| อยากได้ MVP เร็ว · ทีมเล็ก · ไม่อยากดู then server | **Cloudflare** |
| ต้องการข้อมูลอยู่ DO droplet ของตัวเอง · คุ้น CyberPanel | **DO + Docker API + Spaces** |
| อยาก Postgres + Auth พร้อม · ยอมแยก static host | **Supabase + Cloudflare Pages** |
| อยาก Python monolith ง่ายๆ บน PaaS | **Render** |

**ไม่แนะนำเป็น primary สำหรับ Inbox v1:** Vercel-only, Firebase-only (schema inbox ไม่ fit ดีเท่า SQL)

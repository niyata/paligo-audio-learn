# AGENTS.md — Paligo Audio Learn

คู่มือสำหรับ AI agents ที่ทำงานใน repo นี้

## ก่อนเริ่มทุกครั้ง

1. เปิด **[Paligo Scrum Board](https://github.com/users/niyata/projects/14)**
2. รับงานจาก **Ready** ที่ label `agent:*` ตรงกับตัวเอง
3. ทำ `priority:P0` ก่อน `P1` ก่อน `P2`
4. ย้าย issue → **In Progress** แล้ว comment สั้นๆ

## Repo map

| Area | Path | Docs |
|------|------|------|
| Exam book | `ruled-lines-card-only-template.html`, `paligo-exam-*.js` | `docs/exam-flow-ux-audit.md` |
| Audio / PDF | `scripts/`, `pali-audio-hightlight.html` | `docs/system-architecture-overview.md` |
| Navigation shell | `sidebar-nav.*`, `paligo-nav-config.js` | `docs/navigation-and-shell-prd.md` |
| Agile | `.github/`, `docs/agile/` | `docs/agile/SCRUM-WORKFLOW.md` |
| Inbox API | `workers/`, `paligo-config.js`, `paligo-inbox-client.js` | `docs/agile/inbox-sprint-backlog.md` |

## กฎสำคัญ

- **Minimize scope** — diff เล็ก ตรง issue
- **Change audit** — ก่อนจบงาน ตรวจ regression ฟีเจอร์ที่เกี่ยวข้อง; ห้ามทำโค้ดนอกคำสั่งพัง (ดู `.cursor/rules/paligo-change-audit.mdc`)
- **ไม่ commit** จน user ขอ
- **Shell ทุกหน้า user-facing** — ใช้ `PaligoSidebar.autoInit()`
- **Exam handoff** — ใช้ `paligo-exam-shared.js` + book transfer schemas
- **ตีเส้นบรรทัด** — ห้าม regression ตำแหน่ง/ลบเส้น (ดู `.cursor/rules/paligo-annotation-lines.mdc`)
- **Handoff ข้าม agent** — ใช้ template ใน `docs/agile/AGENT-HANDOFF.md`

## Local dev

```bash
python3 -m http.server 8765
# เปิด http://localhost:8765/exam-books.html

# Inbox API (Phase 0+)
cd workers && npm install && npm run dev
# API: http://localhost:8788/v1/health
# Browser: PaligoInboxClient.healthCheck()
```

Domains: `paligo.jp` (landing) · `app.paligo.jp` (Pages) · `api.paligo.jp` (Workers) — ดู `docs/deploy-cloudflare.md`

## เมื่อจบงาน

- เปิด PR + `Closes #issue`
- Test plan ใน PR template
- Handoff comment บน issue
- อย่า merge เอง unless asked

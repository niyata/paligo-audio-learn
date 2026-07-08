# Phase 9–10 — Sprint Backlog · ทีม & Audit

อ้างอิงสเปคเต็ม: [`docs/phase-social-relations-feed.md`](../phase-social-relations-feed.md)

> **อย่าเริ่ม Phase 9 จน Inbox loop (Phase 4) Done**

---

## คำศัพท์ UI (PO — ห้ามเปลี่ยนในปุ่มหลัก)

| อย่าใช้ | ใช้แทน |
|---------|--------|
| เพิ่มเพื่อน | **เพิ่มกัลยาณมิตร** |
| เพิ่มครู | **ฝากตัวเป็นศิษย์** |
| รับเป็นเพื่อน | **รับเป็นมิตร** |
| รับศิษย์ / รับครู | **รับตัวเป็นศิษย์** |

---

## ทีมและ Issue แนะนำ

### Team A — Relations API

| # | Issue | P |
|---|-------|---|
| 9.A1 | D1: `friendships`, `discipleships` | P0 |
| 9.A2 | `POST/accept/decline` friendship + discipleship | P0 |
| 9.A3 | `GET /v1/relations` | P0 |
| 9.A4 | `POST /v1/packages` รองรับ `reviewerUserId` + discipleship | P0 |
| 9.A5 | Script migrate `pairings` → `discipleships` | P1 |

### Team B — Social UX

| # | Issue | P |
|---|-------|---|
| 9.B1 | `exam-account.html` — แท็บมิตร/ศิษย์ + คำขอรอ | P0 |
| 9.B2 | `exam-inbox.html` — การ์ดคำขอ + ปุ่ม รับเป็นมิตร / รับตัวเป็นศิษย์ | P0 |
| 9.B3 | เลือกครูตอนส่งตรวจ (หลาย discipleship) | P1 |
| 9.B4 | `paligo-nav-config.js` + shell สำหรับ feed/relations | P1 |

### Team C — Feed & Leaderboard

| # | Issue | P |
|---|-------|---|
| 10.C1 | D1: `feed_events`, `feed_recipients` | P0 |
| 10.C2 | `GET /v1/feed` + mark read | P0 |
| 10.C3 | `exam-feed.html` timeline | P1 |
| 10.C4 | Hook `review.score_published` หลัง push ผล | P1 |
| 10.C5 | `leaderboard.announcement` จาก exam-leaderboard | P2 |

### Team D — Seam Audit (ทุก sprint)

| # | Issue | P |
|---|-------|---|
| D.1 | อัปเดต seam matrix §7 หลังแต่ละ merge | P0 |
| D.2 | E2E 2-browser: มิตร + ศิษย์ + ส่งตรวจ + feed | P0 |
| D.3 | Privacy audit: ไม่มี draft/คำตอบใน feed | P0 |
| D.4 | Role matrix 403 ข้ามบทบาท | P1 |

---

## Audit cadence

| เมื่อ | ทำอะไร | ใคร |
|------|---------|-----|
| ก่อนเริ่ม 9.x | อ่าน seam matrix · ยืนยัน Phase 4 Done | PO |
| หลัง 9.A + 9.B | Walkthrough คำขอมิตร/ศิษย์ | Team D |
| หลัง 9.A4 | ส่งตรวจหลายครู · 403 ไม่มีศิษย์ | Team D |
| หลัง 10.C | feed หลังตรวจ + leaderboard | Team D |
| ก่อนปิด Phase 10 | E2E script §9 ใน spec ผ่านครบ | PO + D |

---

## Handoff ระหว่างทีม

เมื่อ A ส่ง API ให้ B:

```markdown
## Handoff A→B
- Endpoints: POST /v1/relations/friendship, discipleship, accept/decline
- ทดสอบ: curl ตัวอย่างใน PR
- UI labels: ใช้คำศัพท์ §ด้านบนเท่านั้น
- Seam: ตรวจ S1 S8 ใน matrix
```

เมื่อ C ส่ง feed ให้ D:

```markdown
## Handoff C→D
- GET /v1/feed?cursor=
- Event types: review.score_published, leaderboard.announcement
- Privacy: payload ไม่มี pages[] — ตรวจ S9
```

---

## อ้างอิง

- `docs/phase-social-relations-feed.md`
- `docs/agile/AGENT-HANDOFF.md`
- `docs/agile/inbox-sprint-backlog.md`

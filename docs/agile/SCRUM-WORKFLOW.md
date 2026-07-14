# Paligo Scrum Workflow

**Board:** [Paligo — Scrum Board](https://github.com/users/niyata/projects/14)  
**Repo:** `niyata/paligo-audio-learn`

---

## เป้าหมาย

ใช้ Agile แบบ startup: โปร่งใส · handoff ชัด · scale ได้เมื่อมีคนและ AI หลายตัว

ผู้มีส่วนร่วม:

| บทบาท | ใคร | หน้าที่ |
|--------|-----|--------|
| **Product Owner** | คุณ (iworn) | จัดลำดับ backlog, อนุมัติ Done, กำหนด P0 |
| **Paligo Integrator** | ผู้ที่ PO มอบหมาย (human หรือ agent) | เคลม/จัดระเบียบงานค้างข้าม agent, แยก diff, ทำ compatibility migration, เตรียม release-safe PR |
| **Dev / AI Agent** | Cursor, Codex, AI อื่น | รับ issue → PR → handoff notes |
| **Reviewer** | คุณ หรือ AI อีกตัว | Review column, QA |

---

## Sprint rhythm (แนะนำ 1 สัปดาห์)

| วัน | กิจกรรม |
|-----|---------|
| จันทร์ | Sprint Planning — ดึงจาก **Ready** → **In Progress** (WIP ≤ 3 ต่อ agent) |
| ทุกวัน | อัปเดต board + comment บน issue |
| ศุกร์ | Review / Retro — ปิด Done, เก็บ P1 ค้าง → Backlog |

---

## คอลัมน์บน Board (Workflow)

```
Backlog → Ready → In Progress → Review → QA → Ready to Release → Done
```

| คอลัมน์ | ความหมาย |
|--------|----------|
| **Backlog** | ไอเดีย / ยังไม่พร้อมทำ |
| **Ready** | มี acceptance criteria + priority + agent แล้ว |
| **In Progress** | กำลัง implement (มี owner ชัด) |
| **Review** | PR เปิดแล้ว รอ code review |
| **QA** | ทดสอบ manual / ตาม test plan |
| **Ready to Release** | ผ่าน QA รอ merge หรือ deploy |
| **Done** | merge แล้ว / ปิด issue |

---

## Priority

| Label | ใช้เมื่อ |
|-------|----------|
| `priority:P0` | blocker, ต้อง ship ก่อน |
| `priority:P1` | sprint ปัจจุบัน |
| `priority:P2` | หลัง sprint |

**กฎ:** ทำ P0 ก่อนเสมอ — AI ทุกตัวอ่าน board ก่อนเริ่ม session

---

## Agent labels

| Label | ใครรับ |
|-------|--------|
| `agent:human` | คุณ — ตัดสินใจ UX, approve |
| `agent:integrator` | Paligo Integrator — เคลมงานค้าง/dirty tree/cross-agent migration |
| `agent:cursor-ai` | Cursor Agent (repo นี้) |
| `agent:codex-ai` | Codex / CLI agent |
| `agent:other-ai` | AI อื่น |

เมื่อส่งมอบข้าม agent: comment `## Handoff` บน issue (ดู `AGENT-HANDOFF.md`)

## Paligo Integrator Workflow

คู่มือปฏิบัติ: [`PALIGO-INTEGRATOR.md`](./PALIGO-INTEGRATOR.md)

ใช้เมื่องานกระทบหลาย agent, working tree dirty, refactor เปลี่ยนชื่อไฟล์/URL,
compatibility route, release prep, หรือมีไฟล์ค้างที่ไม่รู้เจ้าของ

**อำนาจ**

- เคลมไฟล์งานค้างหลังอ่าน diff และระบุเจ้าของ/ที่มาเท่าที่หาได้
- แยกงานเป็น migration slices และกำหนด compatibility path
- เปิด/อัปเดต issue สำหรับ cleanup, rename, release, หรือ cross-agent handoff
- ตัดสินใจว่าไฟล์ใดควร preserve, migrate, split, หรือขอ PO อนุมัติก่อน discard

**ข้อจำกัด**

- ห้ามลบ/revert งานของ user หรือ agent อื่นโดยไม่มี PO approval
- ห้าม commit/push ถ้า PO ยังไม่ขอ
- ห้าม broad rename ใน dirty tree โดยไม่มี migration plan และ validation checklist
- ห้าม merge เอง unless PO สั่งชัด

**ขั้นตอนเคลมไฟล์ค้าง**

1. รัน `git status --short --branch`
2. อ่าน diff ของไฟล์ที่จะเคลม
3. บันทึกใน issue หรือ worklog ว่าไฟล์นั้นถูกเคลมเพื่ออะไร
4. แยกเป็นหนึ่งในสถานะ: `preserve`, `migrate`, `split`, `needs-owner`, `needs-PO-decision`
5. ตรวจอย่างน้อย `git diff --check` และ syntax/test ที่เกี่ยวข้อง
6. ส่ง handoff สั้นๆ พร้อมไฟล์ที่แตะและสิ่งที่ยังไม่ทดสอบ

---

## Definition of Ready (DoR)

Issue ย้าย **Backlog → Ready** เมื่อมีครบ:

- [ ] User story หรือ bug steps ชัด
- [ ] Acceptance criteria (checkbox)
- [ ] Priority + Area + Agent
- [ ] ไม่ block โดย issue อื่น (หรือมี `status:blocked` + เหตุผล)

---

## Definition of Done (DoD)

Issue ย้าย **QA → Done** เมื่อมีครบ:

- [ ] PR merge แล้ว
- [ ] Test plan ใน PR ติ๊กครบ
- [ ] Docs อัปเดต (ถ้าเปลี่ยน flow/schema)
- [ ] Handoff notes สำหรับงานถัดไป (ถ้ามี)

---

## การทำงานกับ AI

1. **เริ่ม session:** เปิด board → เลือก issue ใน **Ready** ที่ `agent:*` ตรงกับตัวเอง
2. **เริ่มงาน:** ย้าย → **In Progress**, ใส่ label `workflow:in-progress`, comment `Starting: …`
3. **เปิด PR:** ลิงก์ `Closes #N`, ย้าย → **Review**, เอา label `workflow:in-progress` ออก
4. **จบ:** PO ย้าย → **Done** หรือ AI comment สรุปแล้วรอ merge

อ่านเพิ่ม: [`AGENT-HANDOFF.md`](./AGENT-HANDOFF.md) · [`AGENTS.md`](../../AGENTS.md)

---

## Milestones = Sprint

สร้าง milestone ชื่อ `Sprint YYYY-Www` (เช่น `Sprint 2026-W28`) แล้ว assign issues ใน sprint นั้น

**Inbox v1 backlog:** [`inbox-sprint-backlog.md`](./inbox-sprint-backlog.md) · seed: `./scripts/seed-inbox-sprint.sh`

---

## Bootstrap ครั้งแรก

```bash
./scripts/bootstrap-scrum-board.sh
```

สร้าง labels, milestone, seed epics/issues, ผูกกับ Project 14

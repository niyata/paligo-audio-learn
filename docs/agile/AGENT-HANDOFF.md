# Agent Handoff Protocol

ใช้เมื่อส่งงานระหว่าง **คุณ ↔ Cursor ↔ Codex ↔ AI อื่น**

---

## Comment template บน GitHub Issue

```markdown
## Handoff

**From:** cursor-ai
**To:** human | codex-ai | other-ai
**Status:** blocked | ready-for-review | needs-decision

### Done
- …

### Not done
- …

### How to verify
1. …

### Files / branches
- Branch: `…`
- Key files: `…`
- Claimed files: `preserve | migrate | split | needs-owner | needs-PO-decision`

### Risks / open questions
- …
```

---

## ก่อนรับงาน (AI ทุกตัว)

1. อ่าน issue + comments ทั้งหมด
2. ดู [Scrum Board](https://github.com/users/niyata/projects/14) — อย่า duplicate งาน In Progress
3. อ่าน `docs/exam-flow-ux-audit.md` ถ้า `area:exam`
4. อ่าน **`docs/pali-ai/CLOUD-CODE-ALIGNMENT.md`** — แยก Track Paligo web vs Cloud Code PALI-AI
5. Handoff Cloud Code: `docs/PALI-AI_HANDOFF_v2.md` · sync status: `docs/pali-ai/HANDOFF-STATUS.md`
6. อย่า commit ถ้า user ไม่ขอ — อัปเดต issue comment แทน

---

## หลังส่งงาน

1. ย้าย issue → **Review** (มี PR) หรือ **Ready** (แค่ spec/decision)
2. เอา label `workflow:in-progress` ออกเมื่อไม่ active แล้ว
3. ใส่ Handoff comment
4. อัปเดต acceptance criteria checkbox ที่ทำแล้ว

---

## Conflict ระหว่าง AI

- **Source of truth:** GitHub issue + board column
- **Code:** branch บน repo — rebase ก่อน PR
- **Dirty tree / ไฟล์ไม่รู้เจ้าของ:** ส่งให้ **Paligo Integrator** เคลมก่อน ห้าม agent ลบ/revert/stage แทนกันเอง
- **ข้อขัดแย้ง:** PO (human) ตัดสินใน issue comment `Decision:`

---

## Paligo Integrator Handoff

ใช้เมื่อส่งงานให้ผู้ถือสิทธิ์เคลมไฟล์ค้างข้าม agent

```markdown
## Integrator Handoff

**Reason:** dirty tree | rename migration | release prep | conflict | abandoned work
**Requested owner:** Paligo Integrator
**Status:** needs-triage | ready-to-split | needs-PO-decision

### Files to claim
- `path` — preserve | migrate | split | needs-owner | needs-PO-decision

### Context
- …

### Validation already run
- …

### Do not touch
- …
```

**กฎ:** Integrator เป็นคนจัดคิวและเคลม แต่ PO ยังเป็น final authority สำหรับการทิ้ง/revert/merge งาน

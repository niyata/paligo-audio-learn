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

### Risks / open questions
- …
```

---

## ก่อนรับงาน (AI ทุกตัว)

1. อ่าน issue + comments ทั้งหมด
2. ดู [Scrum Board](https://github.com/users/niyata/projects/14) — อย่า duplicate งาน In Progress
3. อ่าน `docs/exam-flow-ux-audit.md` ถ้า `area:exam`
4. อย่า commit ถ้า user ไม่ขอ — อัปเดต issue comment แทน

---

## หลังส่งงาน

1. ย้าย issue → **Review** (มี PR) หรือ **Ready** (แค่ spec/decision)
2. ใส่ Handoff comment
3. อัปเดต acceptance criteria checkbox ที่ทำแล้ว

---

## Conflict ระหว่าง AI

- **Source of truth:** GitHub issue + board column
- **Code:** branch บน repo — rebase ก่อน PR
- **ข้อขัดแย้ง:** PO (human) ตัดสินใน issue comment `Decision:`

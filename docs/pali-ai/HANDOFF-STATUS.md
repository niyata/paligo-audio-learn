# สถานะ sync กับ Cloud Code (PALI-AI_HANDOFF_v2)

> **บทบาทไฟล์นี้:** ติดตามว่า handoff สำหรับ **Cloud Code** sync กับ repo แล้วเท่าไหร่ — **ไม่ใช่ sprint backlog หลัก**  
> **Roadmap หลัก repo:** [`docs/agile/inbox-sprint-backlog.md`](../agile/inbox-sprint-backlog.md) Phase 0→4  
> **Alignment เต็ม:** [`CLOUD-CODE-ALIGNMENT.md`](CLOUD-CODE-ALIGNMENT.md)

## ทำแล้ว (ใน repo)

| # | งาน | ไฟล์ |
|---|-----|------|
| 3 | Agent System Prompts | `docs/pali-ai/prompts/*.md` |
| — | กฎเหล็ก · หลักสูตร · ๓ ให้ · KB index | `docs/pali-ai/RULES.md` ฯลฯ |
| — | แก้ ป.ธ.๓: เพิ่ม `sambandha-thai` ใน `SUBJECTS_BY_GRADE` | `paligo-exam-shared.js` |
| — | อัปเดต `ai-examiner-system-prompt.md` → ศ/ส/ป | `docs/ai-examiner-system-prompt.md` |

## ตัดสินแล้ว (PO — 2026-07-08)

| หัวข้อ | การตัดสิน |
|--------|-----------|
| PaliGo LMS stack | **ต่อ static HTML/JS** (Paligo exam) — ยังไม่ Next.js/Supabase |
| ระบบคะแนน | **ศ/ส/ป → ๓ ให้** เป็น canonical (`SCORING-3-HAI.md`, `ai-examiner-system-prompt.md`) |
| KB_02–05 | **Drive เท่านั้น** — agent อ่านจาก Google Drive ไม่ copy ลง repo |

## รอ PO / เลื่อน

| งาน | เหตุผล |
|-----|--------|
| Next.js + Supabase MVP (handoff §7) | PO เลือก static ก่อน |
| iOS SwiftUI vs Paligo web — สินค้าเดียวหรือแยก | ยังไม่ตัดสิน |

## blocked (ไม่มี access / ไม่มีไฟล์)

| # | งาน | สิ่งที่ต้องการ |
|---|-----|----------------|
| 1 | อัปโหลด KB_02–05 ขึ้น Drive | PO จัดการ Drive — agent อ่านจาก [`KB-INDEX.md`](KB-INDEX.md) |
| 2 | สำรวจ Drive folders ใหม่ | OAuth / ผู้ใช้อัปโหลดหรือแชร์ไฟล์ลง repo |
| 4–5 | KB_corpus_ธรรมบท + PoC ๑๐ ประโยค | ต้องมีข้อความจาก Drive `Dhammapada1-8` |

## Schema สำหรับ corpus (เตรียมไว้)

`docs/pali-ai/schemas/corpus-sentence.schema.json` — รอข้อมูลจริงจาก Drive

## ขั้นต่อไปที่แนะนำ

1. อัปโหลด KB_02–05 ขึ้น Drive (PO) แล้วแจ้ง agent ให้ sync index
2. Export ๑๐ ประโยคแรก ธรรมบท ภาค ๑ → JSON ตาม `schemas/corpus-sentence.schema.json` → PoC Audio Sync
3. (Optional) ตัดสิน iOS PRD vs Paligo web เป็นสินค้าเดียวหรือแยก track

# Cloud Code (PALI-AI) ↔ Paligo Repo — Alignment

> **อัปเดต:** 2026-07-08  
> **จุดประสงค์:** [`PALI-AI_HANDOFF_v2.md`](../PALI-AI_HANDOFF_v2.md) เป็น **คำสั่งให้ Cloud Code** (AI agents + KB บน Drive) — **ไม่แทน** roadmap หลักของ repo นี้

---

## 1. สอง track ที่ทำงานคู่กัน

| | **Track A — Paligo Web (repo นี้)** | **Track B — PALI-AI (Cloud Code)** |
|---|-------------------------------------|-------------------------------------|
| **เจ้าของงานหลัก** | Cursor / Codex ใน repo | Cloud Code session + Google Drive KB |
| **เป้าหมายใกล้** | สมุดสอบ · ส่งตรวจ · inbox · leaderboard | สอน/สอบ AI · corpus annotate · Audio Sync PoC |
| **Runtime** | Static HTML/JS · `app.paligo.jp` · Workers | Claude API · Drive · (LMS UI อนาคต) |
| **Roadmap หลัก** | [`docs/agile/inbox-sprint-backlog.md`](../agile/inbox-sprint-backlog.md) Phase **0→4** | Handoff §9 (KB · agents · corpus PoC) |
| **Roadmap ยาว** | Phase 5–10 (UX · LINE · คิว · social) · [`pali-learning-app-prd-roadmap.md`](../pali-learning-app-prd-roadmap.md) (iOS) | Pattern mining · Teacher credentials · Duolingo drills |

**กฎการทำงานร่วมกัน:** Track A **ดำเนินต่อตาม sprint ที่คุยไว้ก่อน handoff** — ไม่หยุดรอ Track B. Track B เติม domain knowledge และ AI; ผลลัพธ์ที่ stabilize แล้ว **sync กลับ repo** เป็น docs/schema/API contract

---

## 2. สิ่งที่ **ตรงกันแล้ว** (ใช้ร่วมได้ทันที)

| หัวข้อ | Paligo repo | Cloud Code handoff | เอกสาร canonical |
|--------|-------------|-------------------|------------------|
| หลักสูตร ป.ธ. + corpus | `paligo-exam-shared.js` `SUBJECTS_BY_GRADE` | §4 หลักสูตร | [`CURRICULUM-OFFICIAL.md`](CURRICULUM-OFFICIAL.md) |
| Error stamp | reviewer: ผิดศัพท์ / ผิดสัมพันธ์ / ผิด ป. | ศ / ส / ป | [`system-flow-map.md`](../system-flow-map.md) §Reviewer |
| คะแนน ๓ ให้ | stamp `1/2/3` → leaderboard | แปลงจากคะแนนรวม ศ/ส/ป | [`SCORING-3-HAI.md`](SCORING-3-HAI.md) · [`exam-scoring-leaderboard-plan.md`](../exam-scoring-leaderboard-plan.md) |
| บาลีอักษรไทย | UI/ข้อความไทย · มคธในกระดาษสอบ | RULE_01 | [`RULES.md`](RULES.md) |
| อัธยาหาร / สพ ป.ธ.๓ | `sambandha-thai` ใน subject list | RULE_08 · KB_06 | PRD § domain · [`KB-INDEX.md`](KB-INDEX.md) |

---

## 3. Seam ที่ต้องออกแบบร่วม (ยังไม่ implement)

จุดเชื่อมเมื่อ Track B พร้อม — **อย่า block Inbox Phase 0–4**

```text
Cloud Code APPROVER  ──?──►  paligo.exam.review.v1 (score stamps + error annotations)
Drive KB_corpus      ──?──►  Audio Sync page / book passages (schema ใน schemas/)
TEACHER hints        ──?──►  ruled-lines template (คำใบ้ ไม่เฉลย — อนาคต)
ORCHESTRATOR phase   ──?──►  ไม่มีใน exam app วันนี้ (learning path แยกจากส่งตรวจ)
```

**Contract ที่แนะนำให้ Cloud Code ส่งกลับ repo (เมื่อ PoC ผ่าน):**

- JSON ตาม [`schemas/corpus-sentence.schema.json`](schemas/corpus-sentence.schema.json)
- APPROVER output ตาม [`prompts/APPROVER_PROMPT.md`](prompts/APPROVER_PROMPT.md) — ให้ map ได้กับ stamp ใน reviewer console

---

## 4. ข้อควรระวัง — สิ่งที่ repo **ยังขาด** (จาก handoff → อย่าสมมติว่ามี)

ใช้เป็น checklist เวลา implement หรือ review PR — **ไม่ใช่สลับ priority จาก Inbox**

| จาก handoff | สถานะใน Paligo repo | ความเสี่ยงถ้าลืม |
|-------------|---------------------|------------------|
| อัธยาหาร — ไม่ penalize คำ implied | มีใน docs · **ยังไม่มี logic ตรวจอัตโนมัติ** | AI/reviewer อาจตัดคะแนนผิด |
| แปลสองชั้น (พยัญชนะ/อรรถ) | PRD + schema · **book model ยังฟิลด์เดียว** | export/review ไม่แยกชั้นแปล |
| Audio Sync + Anaphora `โส(ชโน)` | ไม่มีใน static app | Cloud Code PoC ไม่มีที่ embed |
| ลำดับแปล ๙ ประการ (KB_06) | ไม่มีใน UI | TEACHER agent รู้ — app ไม่รู้ |
| กฎนับบรรทัด ป (คาถา = ๑ บรรทัด) | [`SCORING-3-HAI.md`](SCORING-3-HAI.md) · **stamp ยังไม่คำนวณ ป อัตโนมัติ** | คะแนน ให้ อาจไม่ตรงสนามหลวง |
| ภูมิไม่สมชั้น → ตกได้ | มีใน scoring doc · **reviewer ตัดสินเอง** | APPROVER ต้องสื่อใน feedback |
| KB_02–05 บน Drive | index ใน repo · **เนื้อหาไม่อยู่ repo** | Cursor ห้าม hallucinate กฎไวยากรณ์ |
| Phase gate เรียน (≥ ๒ ให้) | ของ ORCHESTRATOR · **ไม่ใช่ inbox gate** | อย่าปนกับ DoD Phase 4 inbox |
| Next.js + Supabase LMS | **เลื่อน** — PO เลือก static | Cloud Code อย่า scaffold Next ใน repo โดยไม่ถาม |

---

## 5. Roadmap หลัก repo — **ดำเนินต่อ** (ก่อน handoff)

ลำดับจาก [`inbox-sprint-backlog.md`](../agile/inbox-sprint-backlog.md):

1. **Phase 0** Foundation — API health · `PALIGO_CONFIG.apiBase` · deploy
2. **Phase 1** Auth + pairing
3. **Phase 2** Push → ครู
4. **Phase 3** Claim → ตรวจ
5. **Phase 4** Push → นักเรียน (**MVP inbox สมบูรณ์**)

หลัง Phase 4 แล้วค่อย (ตาม backlog เดิม):

- Phase 5 UX · Phase 7 คิวตรวจ · Phase 8 LINE · Phase 9–10 social
- iOS app ตาม [`pali-learning-app-prd-roadmap.md`](../pali-learning-app-prd-roadmap.md) — track แยก

**Cloud Code ทำ parallel:** KB upload · corpus PoC · agent tuning — **ไม่แทนที่** Phase 0–4

---

## 6. สิ่งที่ Cloud Code ควรได้จาก repo นี้

ส่ง/อ้างอิงให้ Cloud Code session อ่าน:

| ไฟล์ | เหตุผล |
|------|--------|
| [`CLOUD-CODE-ALIGNMENT.md`](CLOUD-CODE-ALIGNMENT.md) | บทบาทร่วม · seam |
| [`CURRICULUM-OFFICIAL.md`](CURRICULUM-OFFICIAL.md) · [`SCORING-3-HAI.md`](SCORING-3-HAI.md) | ตรงกับ reviewer UI |
| [`schemas/corpus-sentence.schema.json`](schemas/corpus-sentence.schema.json) | export corpus ให้ repo import ได้ |
| [`exam-inbox-v1-spec.md`](../exam-inbox-v1-spec.md) | อย่าออกแบบ AI ที่ขัด offline-first + ส่งตรวจ |
| [`inbox-sprint-backlog.md`](../agile/inbox-sprint-backlog.md) | PO priority จริง |

---

## 7. สิ่งที่ repo ควรได้จาก Cloud Code (เมื่อมีผล)

| ส่งกลับ | ใส่ที่ |
|---------|--------|
| KB_02–05 uploaded + file IDs | อัปเดต [`KB-INDEX.md`](KB-INDEX.md) |
| ๑๐ ประโยค ธรรมบท ภาค ๑ annotated | `data/corpus/` หรือ sample ใน repo (ถ้า PO อนุญาต) |
| APPROVER JSON ตัวอย่าง | `docs/pali-ai/examples/approver-output.json` |
| Audio timestamp sample | ผูก schema `word_timestamps` |

---

## 8. สรุปหนึ่งบรรทัด

**Handoff = สั่ง Cloud Code · Inbox Phase 0–4 = สั่ง repo นี้ · ใช้ docs ใน `docs/pali-ai/` เป็นสัญญาร่วม — ไม่ใช่การเปลี่ยน roadmap**

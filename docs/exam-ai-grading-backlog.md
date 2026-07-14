# Backlog: AI ตรวจข้อสอบผ่าน Inbox (AI-assisted grading)

**สถานะ:** Backlog — ยังไม่เริ่ม (รอ PO ตัดสินใจ priority)
**Priority:** ยังไม่กำหนด (แนะนำ P2 — หลัง Inbox MVP Phase 0–4)
**Area:** exam · inbox · pali-ai
**ผู้เสนอ:** niyata (2026-07-10) ผ่าน Claude

---

## คำถามตั้งต้น

ใช้ AI ตรวจสมุดข้อสอบที่นักเรียนส่งเข้า inbox ได้เลยไหม (แทน/เสริมครูมนุษย์)?

## สถานะปัจจุบัน (ตรวจโค้ดจริงแล้ว 2026-07-10)

**ยังทำไม่ได้ — ยังไม่มีสายไฟเชื่อมเลย** ระหว่าง Inbox กับ AI:

- Inbox/`workers/src/*` เป็น human-to-human เท่านั้น: นักเรียนส่ง → ครู `claim` → ตรวจเองบนกระดาษ/UI → ส่งกลับ (`docs/exam-inbox-v1-spec.md`, `docs/exam-scoring-leaderboard-plan.md`)
- ไม่มี call ไปหา AI API ใดๆ ใน `workers/src` (grep แล้วไม่เจอ anthropic/openai/claude)
- `paligo-inbox-chat.js` เป็น thread ข้อความ **local-only** (localStorage) ระหว่างคนสองฝั่ง ไม่ใช่ AI chat
- มี **prompt พร้อมใช้** อยู่แล้วคือ `docs/ai-examiner-system-prompt.md` (ระบบให้คะแนน ศ/ส/ป → ๓ ให้ ตาม `docs/pali-ai/SCORING-3-HAI.md`) แต่ prompt นี้ถูกออกแบบไว้สำหรับ **track แยก** คือ Cloud Code / PALI-AI (Google Drive KB) ตาม `docs/pali-ai/CLOUD-CODE-ALIGNMENT.md` — ไม่ใช่ของ repo/inbox นี้โดยตรง
- Reviewer stamp schema ปัจจุบัน (`paligo.exam.review.v1`) ออกแบบมาให้ "ครูกด stamp" ไม่ได้ออกแบบให้รับผลจาก AI มา populate

**สรุป:** มี "สมองที่ใช้ตรวจ" (prompt) พร้อมอยู่แล้ว แต่ไม่มี "ท่อ" เชื่อมจาก inbox → AI → กลับมาเป็นผลตรวจ ต้องสร้างเพิ่ม

---

## สิ่งที่ต้องสเปคเพิ่ม ก่อนเขียนโค้ด

1. **Trust model:** AI ตรวจแล้วส่งตรงถึงนักเรียนเลย หรือต้องผ่านครูกด "ยืนยัน/แก้ไข" ก่อนเสมอ (แนะนำแบบหลัง อย่างน้อยช่วงแรก — prompt เองก็มี "Examiner override" สำหรับกรณีภูมิไม่สมชั้น ซึ่งควรเป็นดุลยพินิจครู)
2. **แหล่งเนื้อหาอ้างอิง (KB):** อัธยาหาร/ไวยากรณ์ต้องเทียบกับต้นฉบับ (ธัมมปทัฏฐกถา ฯลฯ) — ตอนนี้อยู่ Google Drive เท่านั้น (`KB-INDEX.md`) ยังไม่มี pipeline ดึงมาแนบ prompt อัตโนมัติ
3. **Schema ผลตรวจจาก AI:** ต้องแยกให้ชัดว่า stamp ไหน AI ให้ vs ครูให้ (เช่น field `gradedBy: "ai" | "human"`, `aiConfidence`, `humanConfirmedAt`) ไม่ปนกับ leaderboard ถ้ายังไม่ confirm
4. **Trigger point:** ผู้ใช้เลือกส่งให้ "ครู" หรือ "AI ตรวจก่อน" ตอนไหน — เพิ่ม direction ใหม่ใน `packages` (เช่น `to-ai`) หรือเป็น step ก่อน `to-reviewer`?
5. **Cost/rate limit/abuse:** เรียก AI ทุกครั้งที่ส่งตรวจมีต้นทุน ต้องกันสแปม/ซ้ำ (ใช้ `answer_hash` เดิมช่วยได้)
6. **Privacy/prompt-injection:** เนื้อหานักเรียนเป็น input เข้าพรอมต์ — ต้อง sanitize ไม่ให้ข้อความในสมุดสั่งงาน AI แทน

---

## Code ที่ต้องทำ (เมื่อสเปคนิ่งแล้ว)

| ชั้น | งาน |
|------|-----|
| **Workers API** | endpoint ใหม่ เช่น `POST /v1/ai-review` รับ `bookTransfer` payload → ประกอบ prompt (`ai-examiner-system-prompt.md` + เนื้อหาต้นฉบับที่เกี่ยวข้อง) → เรียก Claude API (ต้องเก็บ API key เป็น Worker secret) → parse ผลลัพธ์เป็น stamp JSON ตรง schema `paligo.exam.review.v1` (เพิ่ม field `gradedBy`) |
| **DB** | เพิ่มคอลัมน์ใน `inbox_items`/ผลตรวจ: `graded_by`, `ai_model`, `ai_confidence`, `human_confirmed_at` |
| **Client (ครู)** | หน้า "ตรวจสอบผล AI" ใน `exam-reviewer-console.html` — โชว์ stamp ที่ AI ให้ ให้ครูแก้/ยืนยันก่อนส่งกลับนักเรียน (ห้ามข้าม step นี้ในช่วงแรก) |
| **Client (นักเรียน)** | ปุ่มเลือกช่องทางส่งตรวจ (ครูคนเดิม / AI ช่วยตรวจก่อน) ใน flow ส่งตรวจ |
| **KB pipeline** | อย่างน้อย manual step: ครู/PO แปะ excerpt ต้นฉบับที่เกี่ยวข้องแนบไปกับ request (ยังไม่ full automation จาก Drive) |
| **Leaderboard guard** | กันผลที่ `graded_by=ai` และยังไม่ `human_confirmed_at` ไม่ให้ขึ้น leaderboard (ตาม `exam-scoring-leaderboard-plan.md` หลักการเดิม: ไม่มี stamp = ไม่ขึ้น) |

---

## Out of scope (รอบแรก)

- AI ตรวจแล้วส่งถึงนักเรียนอัตโนมัติโดยไม่ผ่านครู
- ดึง KB จาก Drive อัตโนมัติเต็มรูปแบบ
- ใช้แทนครูทั้งหมด (แนะนำเป็นเครื่องมือช่วยร่นเวลาครู ไม่ใช่ทดแทน)

---

## อ้างอิง

- `docs/exam-inbox-v1-spec.md`
- `docs/exam-scoring-leaderboard-plan.md`
- `docs/ai-examiner-system-prompt.md`
- `docs/pali-ai/CLOUD-CODE-ALIGNMENT.md` · `docs/pali-ai/SCORING-3-HAI.md` · `docs/pali-ai/HANDOFF-STATUS.md`
- `workers/src/inbox.js`, `workers/src/packages.js`

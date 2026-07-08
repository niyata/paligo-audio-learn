# PALI-AI + PaliGo — Project Handoff v2
**วันที่:** 8 กรกฎาคม 2569  
**จาก:** Claude Sonnet (แชทยาว)  
**ถึง:** **Cloud Code** (และ agent ที่อ่าน Drive KB)  
**คำแนะนำ:** อ่านไฟล์นี้ทั้งหมดก่อนตอบคำถามใดๆ

> **⚠️ ไม่ใช่ roadmap หลักของ Git repo** — งาน Paligo web (Inbox Phase 0–4, static exam) ดำเนินตาม [`docs/agile/inbox-sprint-backlog.md`](agile/inbox-sprint-backlog.md)  
> **จุดเชื่อม repo ↔ Cloud Code:** [`docs/pali-ai/CLOUD-CODE-ALIGNMENT.md`](pali-ai/CLOUD-CODE-ALIGNMENT.md)  
> **สถานะ sync ใน repo:** [`docs/pali-ai/HANDOFF-STATUS.md`](pali-ai/HANDOFF-STATUS.md)

---

## 1. ภาพรวมโปรเจกต์

โปรเจกต์นี้มี **2 ส่วนหลัก** ที่เชื่อมกัน:

**ส่วนที่ ๑ — PALI-AI** (AI Agent สอนบาลี)  
AI ที่เรียนและสอนบาลีอักษรไทยตามหลักสูตรพระปริยัติธรรมแผนกบาลีสนามหลวง มี TEACHER / EXAM / APPROVER / ORCHESTRATOR / AUDIT agents

**ส่วนที่ ๒ — PaliGo LMS** (Web App)  
แอปเรียนบาลีแบบ interactive สไตล์ Duolingo สำหรับผู้เรียนชั้น ประโยค ๑-๒ ถึง ป.ธ.๔ มีระบบ Audio Sync + Anaphora injection + ระบบ ๓ ให้

---

## 2. กฎเหล็ก (ห้ามละเมิด ทุก session)

```
RULE_01: บาลีอักษรไทยเท่านั้น — ห้ามใช้โรมัน/IAST เป็นฐานคิดหลัก
RULE_02: ห้ามข้าม Phase จนกว่า APPROVER จะออก verdict=ผ่าน
RULE_03: EXAM ออกข้อเฉพาะจาก corpus ที่สอนแล้ว ตรงชั้นที่เรียนเท่านั้น
RULE_04: วิชาแปลต้องได้ ≥ ๒ ให้ จึงผ่าน
RULE_05: ทุก session เตือน AI ว่านี่คือบาลีอักษรไทยที่ไม่คุ้นเคย
RULE_06: APPROVER ระบุ error code ศ/ส/ป ทุกครั้ง
RULE_07: error เดิมซ้ำ ๓ ครั้ง → หยุด loop → flag → human review
RULE_08: วิชา สพ เริ่มที่ ป.ธ.๓ เท่านั้น / วิชา ทม เริ่มที่ ป.ธ.๔ เท่านั้น
```

---

## 3. ระบบ ๓ ให้ (ฉบับถูกต้องจากระเบียบสนามหลวง)

```
เกณฑ์เก็บคะแนน:
  ผิดศัพท์ ๑ ศัพท์    = เก็บ ๑ คะแนน  (เขียน "ศ" กำกับ)
  ผิดสัมพันธ์ ๑ แห่ง  = เก็บ ๒ คะแนน  (เขียน "ส" กำกับ)
  ผิดประโยค           = เก็บตามบรรทัดในกระดาษข้อสอบ (เขียน "ป" กำกับ)
    ไม่เกิน ๑ บรรทัด  = ๖ คะแนน
    ไม่เกิน ๒ บรรทัด  = ๑๒ คะแนน
    ไม่เกิน ๓ บรรทัด  = ๑๘ คะแนน
    เกิน ๓ บรรทัด     = เกิน ๑๘ คะแนน

แปลงเป็น ให้:
  ผิด ๑–๖    = ๓ ให้ (ผ่านดีมาก)
  ผิด ๗–๑๒   = ๒ ให้ (ผ่าน)
  ผิด ๑๓–๑๘  = ๑ ให้ (ตก)
  ผิดเกิน ๑๘ = ๐ ให้ (ตก)

ประเภทความผิด:
  ผิดศัพท์    = แปลผิดศัพท์ หรือเรียกชื่อสัมพันธ์ผิดในวิภัตติเดียวกัน
  ผิดสัมพันธ์ = แปลเสียสัมพันธ์ หรือเรียกชื่อสัมพันธ์ผิดต่างวิภัตติ
  ผิดประโยค   = สับเลขนอก-เลขใน / ประธาน-กิริยาผิดบุรุษ / แปลผิดจนไม่เป็นรูป

หมายเหตุ: คาถา ๑ บาท = ๑ บรรทัด (แม้มีคำเพียง ๔-๘ คำ)
           ถ้าภูมิไม่สมชั้น แม้คะแนนไม่ถึงเกณฑ์ตก กรรมการตัดสินตกได้
```

---

## 4. หลักสูตรสนามหลวง (ฉบับทางการ)

```
ประโยค ๑-๒:  มท (ธมฺมปทฏฺฐกถา ภาค ๑-๔) + บว
ประโยค ๓:    มท + สพ (ภาค ๕-๘) + บว + บุรพภาค
ป.ธ.๔:       ทม (ธรรมบท ภาค ๑) + มท (มงฺคลตฺถทีปนี ภาค ๑)
ป.ธ.๕:       ทม (ภาค ๒-๔) + มท (มงฺคลตฺถทีปนี ภาค ๒)
ป.ธ.๖:       ทม (ภาค ๕-๘) + มท (ตติยสมนฺตปาสาทิกา)
ป.ธ.๗:       ทม (มงฺคลตฺถทีปนี ภาค ๑) + มท (ปฐม-ทุติยสมนฺตปาสาทิกา)
ป.ธ.๘:       แต่งฉันท์ (๓ ใน ๖) + ทม (ปฐมสมนฺตปาสาทิกา) + มท (วิสุทฺธิมคฺค)
ป.ธ.๙:       แต่งไทยเป็นมคธ + ทม (วิสุทฺธิมคฺค) + มท (อภิธมฺมตฺถวิภาวินี)
```

---

## 5. Knowledge Base — สถานะปัจจุบัน

### ไฟล์ที่อยู่ใน Drive แล้ว (PALI-AI-Knowledge-Base)
Folder ID: `1Vt1W-8hxa7cFfDg02kOyw8uY8wNSQMN-`

| ไฟล์ | Drive ID | สถานะ |
|------|----------|--------|
| KB_00_หลักสูตรสนามหลวง | 1GBaKf0p6AsyIkntcp3T6y76vPurfM07x | ✅ |
| KB_01_อักขรวิธี | 1bCXgB5HsN5qGeBVSiD2frHGXzgiFOl33 | ✅ |
| KB_06_วากยสัมพันธ์ | 1bcgY3Ui0QGdg5Bk5iqJqNqYouUdIfi4q | ✅ |
| KB_feature_AudioSync_AnaphoraResolution | 130TqS6EuDCR1xt8xCjVksoTJ9vJ5mavr | ✅ |
| KB_pattern_iti_ระยะใกล้ | 1HUXa0w-7yTONLjp8EInf6ZPqIKEO6QRi | ✅ |
| KB_corpus_กฎการนับบรรทัด | 15pOTagha-vNkS_b-qMKCsCCfzZjAF6mn | ✅ |
| PALI-AI_Scoring_Rules | 1T-Qlnp_dAWOGVUFG3xME8q0XTFOn4GsQ | ✅ |
| PALI-AI_PROJECT_HANDOFF (v1) | 1ck0PgfqBd71Bdodb3pa8LjSs3YVkZjOm | ✅ |

### KB_02-05 (สร้างแล้ว รออัปโหลด Drive)
KB_02_สนธิ, KB_03_นามศัพท์, KB_04_สมาสตัทธิต, KB_05_อาขยาตกิตก์  
→ อยู่ใน outputs ของ session ก่อน ต้องอัปโหลดขึ้น Drive

### Folders อื่นใน Drive
```
ตำราย่อยหน้า:       1N0vFoPj5xImPMDjtO6JfgRo4W98cpH9E
  (มีไฟล์ 1_01 ถึง 1_13 บาลีไวยากรณ์ทุกหมวด)
Dhammapada1-8:       1nr7nktzhPjJwNWVln7C-y121Yq1uqlKa  ← ใหม่
PaliGo DMS:          1tRavbwLkM6hJ3iJfGrgdTJgJ8uWZgqpL  ← ใหม่
ธรรมบทภาค5-9 ปธ3:   1F0y6oLB3VSOJdV9AOkIQ25HBtgAgYdfm  ← ใหม่
คู่มือ:              196uCa61nmlDiKV9VK2vQ2w3BrgpuZNqa
บาลีไวยากรณ์:       16bzYlgMh1TCysUyFb8tbdu6oQR8dawEI
owner: niyata2206@gmail.com / editor: thaworn.nyt@gmail.com
```

---

## 6. ข้อมูลสำคัญเกี่ยวกับ KB_06 วากยสัมพันธ์

ครอบคลุม:
- ปฐมา: ลิงคัตถะ สยกัตตา เหตุกัตตา วุตตกัมมะ
- ทุติยา: อวุตตกัมมะ สัมปาปณียกัมมะ การิตกัมมะ อัจจันตสังโยค อกถิตกัมมะ กิริยาวิเสสนะ
- ตติยา: กรณะ ตติยาวิเสสนะ อนภิหิตกัตตา เหตุ อัตถมภิต สหัตถตติยา
- จตุตถี: สัมปทาน (แก่/เพื่อ/ต่อ)
- ปัญจมี: อปาทาน (แต่/กว่า) เหตุ
- ฉัฏฐี: สามีสัมพันธะ สมูหสัมพันธะ ภาวาทิสัมพันธะ อนาทร นิทธารณะ ฉัฏฐีกัมมะ
- สัตตมี: ปฏิจฉันนาธาร พยาปกาธาร วิสยาธาร สัมปทาธาร อุปสิเลสิกาธาร กาลสัตตมี นิมิตตสัตตมี ลักขณะ ภินนาธาร
- พิเศษ: วิกติกัตตา วิกติกัมมะ วิเสสนะ กิริยาวิเสสนะ สัมภาวนะ วิเสสลาภ
- **ลำดับการแปล ๙ ประการ**: อาลปนะ → นิบาตต้นข้อความ → กาลสัตตมี → บทประธาน → บทขยายประธาน → กริยาในระหว่าง → บทเนื่องด้วยกริยาในระหว่าง → กริยาคุมพากย์ → บทเนื่องด้วยกริยาคุมพากย์
- **กฎ**: ประธานและกริยาคุมพากย์ ถ้าไม่มีต้องเติมเข้ามาแปลเอง
- **Anaphora**: โส(ชโน) — สรรพนาม: โส สา ตํ เต ตา ตานิ อยํ อิมํ เอโส เอสา
- **เลขนอก-เลขใน**: ห้ามปนกัน

---

## 7. PaliGo LMS — สถานะและ Design

### Brand
- ชื่อ: PaliGo / ปาลิ (mascot ช้างจิ๋ว อ้างอิงปาลิไลยกะ)
- สี: Saffron Gold #C8820A / Forest Green #2D5016 / Dharma Ivory #F5EDD8 / Bodhi Brown #5C3D1E
- Font: Cormorant Garamond (display) + Sarabun (Thai body)

### Tech Stack
```
Frontend:  Next.js 14 (App Router) + TypeScript + Tailwind + Shadcn/ui
Backend:   Supabase (auth + database + storage)
AI:        Claude API (claude-sonnet-4-6)
Audio:     Web Audio API + WhisperX (forced alignment)
Mobile:    React Native (ภายหลัง)
```

### Features หลัก
```
๑. Audio Sync Reading
   - highlight ทีละคำบาลีตาม timestamp
   - เสียงแปลไทยเล่นคู่ขนาน
   - Anaphora injection: โส → โส (ชโน) อัตโนมัติ
   - Controls: Play/Pause / ← ข้ามคำ / ↑↓ ข้ามประโยค / auto-pause ที่ ฯ

๒. Interactive Drill (6 ประเภท)
   เติมช่องว่าง / จับคู่ศัพท์ / เรียงประโยค /
   ทายคำแปล / แต่งประโยค (ทม) / ฟังแล้วพิมพ์

๓. ระบบ ๓ ให้
   - APPROVER ตรวจ error code ศ/ส/ป
   - แสดง badge ๓ ให้ พร้อม breakdown
   - Phase gate: ต้องได้ ≥ ๒ ให้ จึงไปต่อ

๔. Teacher Credential System
   - Upload ใบรับรอง → Admin review → Verified
   - Admin กำหนด field เอกสารที่ต้องการ

๕. Pattern Mining (เปิดหลัง Phase 6)
   - อิติ ระยะใกล้ เฟสแรก (≥5 ตัวอย่าง/pattern จึงยืนยัน)
   - ห้ามใช้แทนการวิเคราะห์จริงในสอบ
```

### AI Agent ทั้ง 5
```
ORCHESTRATOR: state machine / phase gate / cost monitor
TEACHER:      สอนตาม phase / บาลีไทยล้วน
EXAM:         ออกข้อจาก corpus ตรงชั้น
APPROVER:     ตรวจระบบ ๓ ให้ / ตรวจ 3 pass (บริบท→ภูมิ→เนื้อหา)
AUDIT:        ตรวจ output ก่อนส่งผู้เรียน / Script isolation / Loop detection
```

---

## 8. ข้อมูลผู้ใช้

- เคยเรียนพระปริยัติธรรมแผนกบาลีสนามหลวง เรียนซ้ำชั้น
- แปลบาลีอักษรไทยได้ ~60-70%
- เชี่ยวชาญระบบ ๓ ให้ / failure map / กิน ป. กิน ส.
- ใช้ตำราวัดพระธรรมกายเป็นหลัก
- นักคิด นักออกแบบระบบ นักกิจกรรม

---

## 9. งานที่ค้างและต้องทำต่อ (เรียงลำดับ)

### ด่วนที่สุด
```
๑. อัปโหลด KB_02-05 ขึ้น Drive
   (สนธิ / นามศัพท์ / สมาสตัทธิต / อาขยาตกิตก์)
   → ไฟล์อยู่ใน local outputs ของ session ก่อน

๒. สำรวจ folder ใหม่ที่เพิ่งเพิ่ม:
   - Dhammapada1-8 (ID: 1nr7nktzhPjJwNWVln7C-y121Yq1uqlKa)
   - PaliGo DMS (ID: 1tRavbwLkM6hJ3iJfGrgdTJgJ8uWZgqpL)
   - ธรรมบทภาค5-9 ปธ3 (ID: 1F0y6oLB3VSOJdV9AOkIQ25HBtgAgYdfm)
```

### สำคัญ
```
๓. สร้าง Agent System Prompts
   TEACHER_PROMPT.md / EXAM_PROMPT.md /
   APPROVER_PROMPT.md / ORCHESTRATOR_PROMPT.md / AUDIT_PROMPT.md

๔. สร้าง KB_corpus_ธรรมบท
   annotate ประโยคจริง ภาค ๑ บทแรก
   พร้อม sentence_id / anaphora_chain / type (prose/verse)

๕. Proof of Concept
   ทดสอบกับ ๑๐ ประโยคแรกของธรรมบท ภาค ๑
```

### PaliGo LMS
```
๖. วาด UI ใน Google Stitch (prompt อยู่ใน session ก่อน)
๗. Export ไป Google AI Studio แปลงเป็น Next.js code
๘. สร้าง Supabase schema
๙. MVP: Screen Audio Sync + Interactive Drill ก่อน
```

---

## 10. Prompt สำหรับเปิดแชทใหม่

คัดลอก prompt นี้วางเป็นข้อความแรกในแชทใหม่:

```
สวัสดีครับ ผมกำลังทำโปรเจกต์ PALI-AI + PaliGo LMS
โปรดอ่าน Handoff document ใน Google Drive ก่อนเริ่มต้น

Google Drive folder หลัก:
PALI-AI-Knowledge-Base
ID: 1Vt1W-8hxa7cFfDg02kOyw8uY8wNSQMN-

ไฟล์สำคัญที่ต้องอ่านก่อน:
- KB_00_หลักสูตรสนามหลวง_ฉบับทางการ
- PALI-AI_PROJECT_HANDOFF (v2 อยู่ใน outputs)
- KB_06_วากยสัมพันธ์

กฎเหล็ก: บาลีอักษรไทยเท่านั้น ห้ามใช้โรมัน
เป้าหมายวันนี้: [ระบุสิ่งที่อยากทำต่อ]
```

---

*สร้างโดย Claude Sonnet 4.6 — 8 กรกฎาคม 2569*

# Lexical Alignment Data Model

สถานะ: Production contract seed
อัปเดตล่าสุด: 2026-07-25

เอกสารนี้กำหนดทิศทางข้อมูลตำราเพื่อให้ Paligo ทำ **Tap-to-Lookup** และ **Select-to-Annotate** ได้แข็งแรง โดยไม่ hardcode อยู่ใน PiP หน้าเดียว

## หลักการ

Lexical alignment เป็นชั้นข้อมูลกลางที่จับคู่ข้อความบาลีและไทยแบบตรวจสอบย้อนกลับได้ ทุก record ต้องผูกกับ corpus, page, line, token และสถานะการตรวจทาน

ข้อมูลที่ยังเป็นตัวอย่างหรือยังไม่ตรวจครบทั้งเล่มต้องระบุ `status: "seed"` หรือ `confidence: "seed"` เสมอ เพื่อไม่ทำให้ UI หรือทีมภายหลังเข้าใจว่า verified แล้ว

## ไฟล์ในรอบนี้

- `data/corpora/dhammapadatthakatha-pali-rtf-prototype/manifest.json`
  - เพิ่ม `lexicalAlignment` reference
- `data/corpora/dhammapadatthakatha-pali-rtf-prototype/lexical-alignment.seed.json`
  - seed contract สำหรับบาลี -> ไทย (อรรถ/พยัญชนะ) และไทย -> บาลี
- `scripts/audit-lexical-alignment.mjs`
  - production gate สำหรับ schema, token refs, confidence, review status

## Schema หลัก

```json
{
  "schema": "paligo.lexical-alignment.v1",
  "alignmentSetId": "dhammapadatthakatha-pt4-book1-seed",
  "status": "seed",
  "source": {
    "corpusId": "dhammapadatthakatha-pali-rtf-prototype",
    "language": "pali"
  },
  "targets": [
    {
      "corpusId": "dhammapadatthakatha-meaning-thai-prototype",
      "translationMode": "meaning"
    },
    {
      "corpusId": "dhammapadatthakatha-literal-thai-prototype",
      "translationMode": "literal"
    }
  ],
  "tokenIndex": [],
  "alignments": []
}
```

## Token Index

Token ทุกตัวต้องมีอย่างน้อย:

- `tokenId` เป็น ASCII และ unique ภายใน alignment set
- `corpusId`
- `itemId`
- `sourcePage` เป็น integer สำหรับ metadata เว็บ
- `lineNo` เป็น integer
- `tokenNo` เป็น integer
- `language`
- `surface`
- `normalized`

หมายเหตุ: เลขไทยใช้ในเนื้อหาตำราเมื่อแสดงผลได้ แต่ metadata สำหรับเว็บ/โค้ดต้องใช้ integer หรือ ASCII id

## Alignment Record

Alignment ทุก record ต้องมี:

- `alignmentId`
- `sourceTokenIds`
- `targetTokenIds`
- `sourceLanguage`
- `targetLanguage`
- `translationModes`
- `type`
- `confidence`
- `reviewStatus`

ค่า `confidence` ที่อนุญาต:

- `seed`
- `machine`
- `human_reviewed`
- `human_verified`

ค่า `reviewStatus` ที่อนุญาต:

- `needs_human_review`
- `reviewed`
- `verified`

## ทิศทางต่อไป

1. แยก canonical text ออกจากเชิงอรรถและหัวข้อให้ชัด
2. สร้าง token index อัตโนมัติจาก corpus ที่ normalize แล้ว
3. เพิ่ม matcher ระหว่างบาลี, ไทยแบบอรรถ, ไทยแบบพยัญชนะ
4. ทำ UI lookup ให้เลือกผลจาก `human_verified` ก่อน `seed`
5. เพิ่ม workflow ให้ครูหรือผู้ตรวจยืนยัน alignment ได้ทีละจุด

## Definition of Done

- Manifest ที่ใช้ lookup ต้องชี้ไปที่ lexical alignment file
- Alignment file ต้องผ่าน `node scripts/audit-lexical-alignment.mjs`
- Production hardening runner ต้องเรียก audit นี้ก่อน deploy
- UI ต้องแสดง badge หรือ copy ที่บอกได้ว่า alignment เป็น seed/machine/verified

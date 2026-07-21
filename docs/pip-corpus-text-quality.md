# PiP Corpus Text Quality

## Pali Legacy Glyph Rule

ตำรา PiP ที่มาจาก PDF อาจมี glyph legacy ในช่วง Unicode Private Use Area เช่น `` แทนนิคคหิต `ํ` หรือ `` แทนพินทุ `ฺ` ได้ แต่ระบบแสดงผล, search, tokenization และ ghost suggestion ต้อง normalize ก่อนใช้งานทุกครั้ง

กฎตรวจขั้นต่ำก่อนส่งงาน PiP/corpus:

```bash
node scripts/audit-pip-pali-glyphs.mjs
```

Audit นี้ต้องผ่านเมื่อมีการแก้:

- `pali-reference-pip.html`
- `paligo-reference-worker.js`
- `paligo-ghost-suggestion.js`
- `scripts/build_*_corpus.*`
- ไฟล์ใต้ `data/corpora/**`

ถ้า audit พบ glyph PUA ที่ยังไม่มี mapping ให้เพิ่ม mapping อย่างชัดเจนก่อน ไม่ควรปล่อยให้ browser render เป็นกล่องสี่เหลี่ยมใน PiP

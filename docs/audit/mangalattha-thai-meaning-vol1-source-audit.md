# Mangalattha Thai Meaning Vol. 1 Source Audit

Date: 2026-07-20

Issue: [#106](https://github.com/niyata/paligo-audio-learn/issues/106)

## Result

Blocked for production corpus generation.

The preferred source PDF:

`/Users/iworn/Documents/Claude/Projects/PaliGo/Knowledge-Base/pt4/มังคลัตถทีปนี ภาค1เล่ม1แปลโดยอรรถ/ภาค ๑ เล่ม ๑ แปลโดยอรรถ (ไทย-บาลี).pdf`

has a scanned/encoded text layer that is not usable as Thai answer text. `pdftotext -layout` returns mostly mojibake/romanized noise for sample pages, so it is unsafe for Plai Whisper next-token suggestions.

## Checks

- `pdfinfo` reports 124 pages.
- `pdftotext` samples from pages 1, 60, and 61 do not produce clean Thai text.
- `scripts/build_mangalattha_thai_meaning_vol1_corpus.py --max-pages 5` accepts 0/5 pages with the quality gate.

## Unblock

Provide one of these clean sources:

- page-level `.txt`, `.md`, or `.html` files for มังคลัตถทีปนีแปล ภาค ๑ เล่ม ๑ (แปลโดยอรรถ)
- OCR output reviewed enough for Thai word order and tone marks
- a born-digital PDF with extractable Thai text

Then run:

```bash
python3 scripts/build_mangalattha_thai_meaning_vol1_corpus.py \
  --source-text-dir /path/to/clean/page-text \
  --out-dir data/corpora/mangalattha-thai-meaning-vol1
```

Do not use `data/corpora/mangalattha-pt4-part1-sample` for Plai Whisper production suggestions.

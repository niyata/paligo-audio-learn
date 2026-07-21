/**
 * Audit: PiP Pali legacy glyph normalization
 * Run: node scripts/audit-pip-pali-glyphs.mjs
 *
 * Rule: PiP corpus text may contain legacy Private Use Area glyphs from source
 * PDFs, but every known glyph must normalize before display/search/tokenization.
 * Unknown PUA glyphs fail the audit so a new corpus cannot silently render
 * tofu boxes in PiP.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CORPORA_DIR = path.join(ROOT, "data", "corpora");

const LEGACY_PALI_GLYPH_MAP = new Map([
  ["\uF700", "ฐ"],
  ["\uF701", "ิ"],
  ["\uF702", "ี"],
  ["\uF703", "ึ"],
  ["\uF70B", "้"],
  ["\uF70E", "์"],
  ["\uF70F", "ญ"],
  ["\uF711", "ํ"],
  ["\uF718", "ุ"],
  ["\uF71A", "ฺ"],
]);

const PUA_RE = /[\uF000-\uF8FF]/gu;

function walkJsonFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkJsonFiles(fullPath));
    else if (entry.isFile() && entry.name.endsWith(".json")) out.push(fullPath);
  }
  return out;
}

function normalizePaliGlyphs(value) {
  return String(value || "").replace(PUA_RE, (char) => LEGACY_PALI_GLYPH_MAP.get(char) || char);
}

const files = walkJsonFiles(CORPORA_DIR);
const legacyCounts = new Map();
const unknown = new Map();
const normalizedLeaks = [];

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  for (const match of text.matchAll(PUA_RE)) {
    const char = match[0];
    const key = `U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`;
    legacyCounts.set(key, (legacyCounts.get(key) || 0) + 1);
    if (!LEGACY_PALI_GLYPH_MAP.has(char)) {
      unknown.set(key, { file, char });
    }
  }
  const normalized = normalizePaliGlyphs(text);
  const leak = normalized.match(PUA_RE);
  if (leak) normalizedLeaks.push({ file, char: leak[0], codePoint: `U+${leak[0].codePointAt(0).toString(16).toUpperCase()}` });
}

const sample = "พุทฺโธ โย มงฺคลตฺถีน มงฺคล อิติ วิสฺสุโต";
const expected = "พุทฺโธ โย มงฺคลตฺถีนํ มงฺคลํ อิติ วิสฺสุโต";
const samplePass = normalizePaliGlyphs(sample) === expected;

const report = {
  auditedAt: new Date().toISOString(),
  filesScanned: files.length,
  legacyGlyphCounts: Object.fromEntries([...legacyCounts.entries()].sort()),
  unknownGlyphs: [...unknown.entries()].map(([codePoint, value]) => ({
    codePoint,
    char: value.char,
    file: path.relative(ROOT, value.file),
  })),
  normalizedLeaks: normalizedLeaks.map((entry) => ({
    ...entry,
    file: path.relative(ROOT, entry.file),
  })),
  sample,
  expected,
  samplePass,
};

console.log(JSON.stringify(report, null, 2));

if (!samplePass || unknown.size || normalizedLeaks.length) {
  process.exit(1);
}

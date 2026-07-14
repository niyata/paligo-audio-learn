/**
 * Audit: Tab / Space → ย่อหน้าอัตโนมัติ (สมุดข้อสอบ)
 * Run: npx playwright@1.49.0 install chromium && node scripts/audit-tab-indent.mjs
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BOOK_ID = "book-d06b397f-964d-4ea3-9f26-bc31573e19fe";
const TEST_TEXT = "ทดสอบเลื่อนตัวอักษร";
const PALI_LEGACY_TEXT = "พุทฺโธ โย มงฺคลตฺถีน มงฺคล อิติ วิสฺสุโต";
const PALI_NORMALIZED_TEXT = "พุทฺโธ โย มงฺคลตฺถีนํ มงฺคลํ อิติ วิสฺสุโต";
const URL = `http://127.0.0.1:8765/workbook.html?bookId=${BOOK_ID}`;
const OUT_DIR = path.join(ROOT, "docs", "audit", "tab-indent");

function seedLocalStorage() {
  const ownerId = "owner-audit-tab";
  const scope = "legacy";
  const sk = (key) => `${key}::${scope}`;
  const draft = {
    schema: "paligo.exam.answerBookDraft.v1",
    ownerId,
    bookId: BOOK_ID,
    lineHeight: "30",
    page: 0,
    pages: ["", ""],
    pickers: [
      { type: "grade", value: "4" },
      { type: "subject", value: "pali-to-thai" },
    ],
    annotations: [],
    savedAt: new Date().toISOString(),
  };
  const book = {
    id: BOOK_ID,
    schema: "paligo.exam.answerBook.v1",
    ownerId,
    title: "สมุดทดสอบ audit",
    status: "draft",
    revision: 1,
    grade: "4",
    subject: "pali-to-thai",
    draft,
    createdAt: draft.savedAt,
    updatedAt: draft.savedAt,
  };
  return {
    [sk("paligo-exam-local-owner-id-v1")]: ownerId,
    [sk("paligo-exam-active-book-id-v1")]: BOOK_ID,
    [sk("paligo-exam-student-profile-v1")]: JSON.stringify({
      prefix: "นาย",
      firstName: "ทดสอบ",
      lastName: "Audit",
      studentName: "นายทดสอบ Audit",
      grade: "4",
      deliveryMethod: "line",
      teacherRole: "teacher-reviewer",
    }),
    [sk("paligo-exam-answer-books-v1")]: JSON.stringify([book]),
    "ruled-lines-card-only-draft-v1": JSON.stringify(draft),
  };
}

async function measureParagraphStartPx(page) {
  return page.evaluate(() => {
    const editor = document.querySelector('[data-auto-indent="numbered-homework"]');
    if (!editor) return null;
    const styles = getComputedStyle(editor);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.font = `${styles.fontStyle} ${styles.fontVariant} ${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`;
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--number-gutter").trim();
    const gutterCh = Number.parseFloat(raw) || 5;
    const frame = editor.closest(".ruled-editor-frame");
    const frameStyles = frame ? getComputedStyle(frame) : styles;
    const frameCtx = canvas.getContext("2d");
    frameCtx.font = `${frameStyles.fontStyle} ${frameStyles.fontVariant} ${frameStyles.fontWeight} ${frameStyles.fontSize} ${frameStyles.fontFamily}`;
    const marginLinePx = gutterCh * frameCtx.measureText("0").width;
    const charStep = ctx.measureText("ก").width;
    const bodyStartPx = marginLinePx + charStep * 0.5;
    const paragraphStartPx = bodyStartPx + charStep * 5;
    let bodyIndent = "";
    while (ctx.measureText(bodyIndent).width < bodyStartPx) bodyIndent += " ";
    let paragraphIndent = bodyIndent;
    while (ctx.measureText(paragraphIndent).width < paragraphStartPx) paragraphIndent += " ";
    return {
      bodyStartPx,
      paragraphStartPx,
      bodyIndentLen: bodyIndent.length,
      paragraphIndentLen: paragraphIndent.length,
      editorBound: editor.dataset.editorBound === "true",
    };
  });
}

async function textStartPx(page, line) {
  return page.evaluate((lineText) => {
    const editor = document.querySelector('[data-auto-indent="numbered-homework"]');
    const styles = getComputedStyle(editor);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.font = `${styles.fontStyle} ${styles.fontVariant} ${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`;
    const idx = lineText.search(/[^\s\d๐-๙.)]/);
    if (idx < 0) return { textStartPx: 0, idx: -1 };
    return { textStartPx: ctx.measureText(lineText.slice(0, idx)).width, idx, line: lineText };
  }, line);
}

async function runScenario(page, name, afterNumberKeys) {
  await page.evaluate(() => {
    const editor = document.querySelector('[data-auto-indent="numbered-homework"]');
    editor.value = "";
    editor.focus();
    editor.setSelectionRange(0, 0);
  });
  await page.keyboard.type("1");
  for (const key of afterNumberKeys) {
    await page.keyboard.press(key);
  }
  if (!afterNumberKeys.includes("Tab") && !afterNumberKeys.includes("Space")) {
    await page.keyboard.type(TEST_TEXT);
  } else {
    await page.keyboard.type(TEST_TEXT);
  }
  const value = await page.evaluate(() => document.querySelector(".ruled-editor")?.value || "");
  const firstLine = value.split("\n")[0] || "";
  const layout = await measureParagraphStartPx(page);
  const textPos = await textStartPx(page, firstLine);
  const tolerancePx = 4;
  const aligned =
    layout &&
    textPos.idx >= 0 &&
    Math.abs(textPos.textStartPx - layout.paragraphStartPx) <= tolerancePx &&
    firstLine.includes(TEST_TEXT) &&
    firstLine.trimStart().startsWith("๑");
  return { name, firstLine, aligned, layout, textPos, value };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const storage = seedLocalStorage();
  await page.addInitScript((items) => {
    for (const [k, v] of Object.entries(items)) {
      localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
    }
  }, storage);

  await page.goto(URL, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector(".ruled-editor", { timeout: 10000 });

  const dismiss = page.locator("[data-profile-dismiss]").first();
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click();
  }

  await page.waitForTimeout(500);

  const bound = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-auto-indent="numbered-homework"]')).map((el) => ({
      page: el.dataset.pageEditor,
      bound: el.dataset.editorBound === "true",
    }))
  );

  const tabResult = await runScenario(page, "Tab after number", ["Tab"]);
  await page.screenshot({ path: path.join(OUT_DIR, "after-tab.png"), fullPage: false });

  const spaceResult = await runScenario(page, "Space after number", ["Space"]);
  await page.screenshot({ path: path.join(OUT_DIR, "after-space.png"), fullPage: false });

  // Typed Thai after number — first letter triggers auto jump
  await page.evaluate(() => {
    const editor = document.querySelector(".ruled-editor");
    editor.value = "";
    editor.focus();
    editor.setSelectionRange(0, 0);
  });
  await page.keyboard.type(`1${TEST_TEXT}`);
  const charJumpLine = await page.evaluate(() => document.querySelector(".ruled-editor")?.value.split("\n")[0] || "");
  const layoutForChar = await measureParagraphStartPx(page);
  const textPosChar = await textStartPx(page, charJumpLine);
  const charJumpAligned =
    layoutForChar &&
    textPosChar.idx >= 0 &&
    Math.abs(textPosChar.textStartPx - layoutForChar.paragraphStartPx) <= 4 &&
    charJumpLine.includes(TEST_TEXT) &&
    charJumpLine.trimStart().startsWith("๑");

  await page.evaluate(() => {
    const editor = document.querySelector(".ruled-editor");
    editor.value = "";
    editor.focus();
    editor.setSelectionRange(0, 0);
  });
  await page.keyboard.insertText(`1${PALI_LEGACY_TEXT}`);
  const paliLegacyValue = await page.evaluate(() => document.querySelector(".ruled-editor")?.value || "");
  const paliLegacyLine = paliLegacyValue.split("\n")[0] || "";
  const paliLegacyPass =
    paliLegacyLine.includes(PALI_NORMALIZED_TEXT) &&
    !paliLegacyLine.includes("") &&
    paliLegacyLine.includes("ํ") &&
    paliLegacyLine.includes("ฺ") &&
    paliLegacyLine.trimStart().startsWith("๑");

  await page.screenshot({ path: path.join(OUT_DIR, "final-audit-snapshot.png"), fullPage: true });

  const report = {
    auditedAt: new Date().toISOString(),
    url: URL,
    testText: TEST_TEXT,
    editorsBound: bound,
    allEditorsBound: bound.every((e) => e.bound),
    tabScenario: tabResult,
    spaceScenario: spaceResult,
    charJumpScenario: { line: charJumpLine, aligned: charJumpAligned, textPos: textPosChar },
    paliLegacyScenario: {
      input: PALI_LEGACY_TEXT,
      expected: PALI_NORMALIZED_TEXT,
      line: paliLegacyLine,
      pass: paliLegacyPass,
    },
    pass:
      bound.every((e) => e.bound) &&
      tabResult.aligned &&
      spaceResult.aligned &&
      charJumpAligned &&
      paliLegacyPass &&
      charJumpLine.includes(TEST_TEXT),
    snapshots: [
      "docs/audit/tab-indent/after-tab.png",
      "docs/audit/tab-indent/after-space.png",
      "docs/audit/tab-indent/final-audit-snapshot.png",
    ],
  };

  await writeFile(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));

  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  process.exit(report.pass ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});

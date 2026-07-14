/**
 * Audit: Workbook Pali text preservation
 * Run: node scripts/audit-workbook-pali-text.mjs
 */
import { chromium } from "playwright";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "audit", "workbook-pali-text");
const BOOK_ID = "book-audit-workbook-pali";
const URL = `http://127.0.0.1:8765/workbook.html?bookId=${BOOK_ID}`;
const LEGACY_TEXT = "พุทฺโธ โย มงฺคลตฺถีน มงฺคล อิติ วิสฺสุโต";
const NORMALIZED_TEXT = "พุทฺโธ โย มงฺคลตฺถีนํ มงฺคลํ อิติ วิสฺสุโต";

async function launchContext(viewport) {
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "paligo-audit-workbook-pali-"));
  return chromium.launchPersistentContext(userDataDir, { channel: "chrome", viewport });
}

function seedDraft(pageText = "") {
  const now = new Date().toISOString();
  const ownerId = "owner-audit-workbook-pali";
  const draft = {
    schema: "paligo.exam.answerBookDraft.v1",
    ownerId,
    bookId: BOOK_ID,
    lineHeight: "30",
    page: 0,
    pages: [pageText, ""],
    pickers: [
      { type: "grade", value: "4" },
      { type: "subject", value: "pali-to-thai" },
      { type: "day", value: "1" },
      { type: "month", value: "1" },
      { type: "year", value: "2569" },
    ],
    annotations: [],
    savedAt: now,
  };
  const book = {
    id: BOOK_ID,
    schema: "paligo.exam.answerBook.v1",
    ownerId,
    title: "สมุดทดสอบบาลี",
    studentName: "นักเรียนบาลี",
    grade: "4",
    subject: "pali-to-thai",
    status: "draft",
    revision: 1,
    createdAt: now,
    updatedAt: now,
    draft,
  };
  return { ownerId, draft, book };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const context = await launchContext({ width: 1280, height: 900 });
  const page = context.pages()[0] || (await context.newPage());
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const seeded = seedDraft("");
  await page.addInitScript(({ seed }) => {
    const scope = "legacy";
    const sk = (key) => `${key}::${scope}`;
    localStorage.setItem(sk("paligo-exam-local-owner-id-v1"), seed.ownerId);
    localStorage.setItem(sk("paligo-exam-active-book-id-v1"), seed.book.id);
    localStorage.setItem(sk("paligo-exam-answer-books-v1"), JSON.stringify([seed.book]));
    localStorage.setItem(
      sk("paligo-exam-student-profile-v1"),
      JSON.stringify({ prefix: "นาย", firstName: "นักเรียน", lastName: "บาลี", studentName: "นักเรียนบาลี", grade: "4" })
    );
    localStorage.setItem("ruled-lines-card-only-draft-v1", JSON.stringify(seed.draft));
  }, { seed: seeded });

  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector(".ruled-editor", { timeout: 10000 });
  await page.waitForTimeout(400);

  await page.evaluate(() => {
    const editor = document.querySelector(".ruled-editor");
    editor.value = "";
    editor.focus();
    editor.setSelectionRange(0, 0);
  });
  await page.keyboard.insertText(`1${LEGACY_TEXT}`);
  await page.waitForTimeout(300);

  const typed = await page.evaluate((expected) => {
    const line = document.querySelector(".ruled-editor")?.value.split("\n")[0] || "";
    return {
      line,
      includesExpected: line.includes(expected),
      hasLegacy: line.includes(""),
      hasNiggahita: line.includes("ํ"),
      hasPinthu: line.includes("ฺ"),
      startsThaiNumber: line.trimStart().startsWith("๑"),
    };
  }, NORMALIZED_TEXT);

  await context.close();

  const legacyLine = `       ๑               ${LEGACY_TEXT}`;
  const restoreContext = await launchContext({ width: 1280, height: 900 });
  const restorePage = restoreContext.pages()[0] || (await restoreContext.newPage());
  restorePage.on("pageerror", (error) => errors.push(error.message));
  const restoreSeed = seedDraft(legacyLine);
  await restorePage.addInitScript(({ seed }) => {
    const scopes = ["legacy", seed.ownerId];
    scopes.forEach((scope) => {
      const sk = (key) => `${key}::${scope}`;
      localStorage.setItem(sk("paligo-exam-local-owner-id-v1"), seed.ownerId);
      localStorage.setItem(sk("paligo-exam-active-book-id-v1"), seed.book.id);
      localStorage.setItem(sk("paligo-exam-answer-books-v1"), JSON.stringify([seed.book]));
      localStorage.setItem(
        sk("paligo-exam-student-profile-v1"),
        JSON.stringify({ prefix: "นาย", firstName: "นักเรียน", lastName: "บาลี", studentName: "นักเรียนบาลี", grade: "4" })
      );
    });
    localStorage.setItem("ruled-lines-card-only-draft-v1", JSON.stringify(seed.draft));
  }, { seed: restoreSeed });
  await restorePage.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await restorePage.waitForSelector(".ruled-editor", { timeout: 10000 });
  await restorePage.waitForTimeout(400);

  const restored = await restorePage.evaluate((expected) => {
    const line = document.querySelector(".ruled-editor")?.value.split("\n")[0] || "";
    return {
      line,
      includesExpected: line.includes(expected),
      hasLegacy: line.includes(""),
      hasNiggahita: line.includes("ํ"),
      hasPinthu: line.includes("ฺ"),
    };
  }, NORMALIZED_TEXT);

  await restorePage.screenshot({ path: path.join(OUT_DIR, "workbook-pali-text.png"), fullPage: true });
  await restoreContext.close();

  const pass =
    errors.length === 0 &&
    typed.includesExpected &&
    !typed.hasLegacy &&
    typed.hasNiggahita &&
    typed.hasPinthu &&
    typed.startsThaiNumber &&
    restored.includesExpected &&
    !restored.hasLegacy &&
    restored.hasNiggahita &&
    restored.hasPinthu;

  const report = {
    auditedAt: new Date().toISOString(),
    url: URL,
    typed,
    restored,
    errors,
    pass,
  };
  await writeFile(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});

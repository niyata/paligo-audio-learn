/**
 * Audit: Book cover avatar preservation in exam-books.html
 * Run: node scripts/audit-book-cover-avatar.mjs
 */
import { chromium } from "playwright";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "audit", "book-cover-avatar");
const URL = "http://127.0.0.1:8765/exam-books.html?apiPort=9999";
const USER_ID = "audit-cover-avatar-user";
const AVATAR_URL =
  "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20120%20120%22%3E%3Crect%20width%3D%22120%22%20height%3D%22120%22%20rx%3D%2260%22%20fill%3D%22%231f2d89%22%2F%3E%3Ccircle%20cx%3D%2260%22%20cy%3D%2244%22%20r%3D%2224%22%20fill%3D%22%23f4b400%22%2F%3E%3Cpath%20d%3D%22M22%20112c8-34%2068-34%2076%200%22%20fill%3D%22%23fffaf0%22%2F%3E%3C%2Fsvg%3E";

async function launchContext(viewport) {
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "paligo-audit-cover-avatar-"));
  return chromium.launchPersistentContext(userDataDir, { channel: "chrome", viewport });
}

function makeBook() {
  const now = new Date().toISOString();
  return {
    id: "book-audit-cover-avatar",
    schema: "paligo.exam.answerBook.v1",
    ownerId: USER_ID,
    title: "สมุดคำตอบ ป.ธ. 4 · แปลมคธเป็นไทย · 1 ม.ค. 2569",
    studentName: "นักเรียนมีรูป",
    grade: "4",
    subject: "pali-to-thai",
    status: "draft",
    revision: 1,
    createdAt: now,
    updatedAt: now,
    draft: {
      schema: "paligo.exam.answerBookDraft.v1",
      ownerId: USER_ID,
      bookId: "book-audit-cover-avatar",
      profile: {
        studentName: "นักเรียนมีรูป",
        avatarUrl: AVATAR_URL,
      },
      pickers: [
        { type: "grade", value: "4" },
        { type: "subject", value: "pali-to-thai" },
        { type: "day", value: "1" },
        { type: "month", value: "1" },
        { type: "year", value: "2569" },
      ],
      pages: ["คำตอบ"],
      annotations: [],
      savedAt: now,
    },
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const context = await launchContext({ width: 1280, height: 900 });
  const page = context.pages()[0] || (await context.newPage());
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const book = makeBook();
  await page.addInitScript(({ userId, avatarUrl, seededBook }) => {
    localStorage.setItem(
      "paligo-inbox-session-v1",
      JSON.stringify({
        sessionToken: "audit-token",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        user: { id: userId, role: "student", displayName: "นักเรียนมีรูป", email: "", createdAt: new Date().toISOString() },
      })
    );
    localStorage.setItem(
      `paligo-exam-student-profile-v1::${userId}`,
      JSON.stringify({
        prefix: "นาย",
        firstName: "นักเรียน",
        lastName: "มีรูป",
        studentName: "นักเรียนมีรูป",
        grade: "4",
        avatarUrl,
      })
    );
    localStorage.setItem(`paligo-exam-answer-books-v1::${userId}`, JSON.stringify([seededBook]));
    localStorage.setItem(`paligo-exam-active-book-id-v1::${userId}`, seededBook.id);
  }, { userId: USER_ID, avatarUrl: AVATAR_URL, seededBook: book });

  await page.route(/(:8788|:8787|:9999|\/v1\/)/, (route) => route.abort());
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector(".book-card", { timeout: 10000 });
  await page.waitForTimeout(500);

  const result = await page.evaluate(() => {
    const card = document.querySelector(".book-card");
    const cover = card?.querySelector(".book-cover");
    const avatar = cover?.querySelector(".book-cover-avatar");
    const img = avatar?.querySelector("img");
    const selector = card?.querySelector(".book-card-select")?.getBoundingClientRect();
    const avatarRect = avatar?.getBoundingClientRect();
    const overlap =
      selector && avatarRect
        ? !(selector.right < avatarRect.left || selector.left > avatarRect.right || selector.bottom < avatarRect.top || selector.top > avatarRect.bottom)
        : false;
    return {
      cardCount: document.querySelectorAll(".book-card").length,
      hasSharedCover: Boolean(cover),
      hasAvatarClass: Boolean(cover?.classList.contains("has-avatar")),
      hasAvatarImage: Boolean(img),
      avatarSrcIsDataImage: Boolean(img?.src?.startsWith("data:image/")),
      openHref: card?.querySelector('a.button.is-primary')?.getAttribute("href") || "",
      selectorOverlapsAvatar: overlap,
    };
  });

  await page.screenshot({ path: path.join(OUT_DIR, "book-cover-avatar.png"), fullPage: true });
  await context.close();

  const pass =
    errors.length === 0 &&
    result.cardCount === 1 &&
    result.hasSharedCover &&
    result.hasAvatarClass &&
    result.hasAvatarImage &&
    result.avatarSrcIsDataImage &&
    result.openHref.startsWith("workbook.html?bookId=") &&
    !result.selectorOverlapsAvatar;

  const report = {
    auditedAt: new Date().toISOString(),
    url: URL,
    result,
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

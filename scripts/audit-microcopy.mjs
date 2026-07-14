/**
 * Issue #71 — smoke audit for UI microcopy consistency (Apple HIG patterns).
 * Checks banned legacy phrases, required aria-labels, and mobile button overflow.
 */
import { chromium } from "playwright";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

const SCOPE_FILES = [
  "index.html",
  "exam-books.html",
  "workbook.html",
  "exam-profile.html",
  "exam-account.html",
  "exam-inbox.html",
  "exam-reviewer-console.html",
  "exam-review-results.html",
  "exam-leaderboard.html",
  "exam-super-admin.html",
  "book-page-viewer.html",
  "book-page-qa.html",
  "seed-demo-books.html",
  "paligo-exam-shared.js",
  "paligo-exam-submit.js",
  "paligo-inbox-client.js",
  "paligo-inbox-chat.js",
  "paligo-profile.js",
  "paligo-platform.js",
  "sidebar-nav.js",
  "paligo-nav-config.js",
  "paligo-home.js",
];

/** User-facing UI should not use these (cover title template excluded via allowlist). */
const BANNED = [
  { pattern: /เปิดเล่ม/g, label: "เปิดเล่ม → ใช้ เปิดสมุด" },
  { pattern: /เปิด Inbox/g, label: "เปิด Inbox → ใช้ เปิดกล่องข้อความ" },
  { pattern: /ส่ง inbox/gi, label: "ส่ง inbox → ใช้ ส่งตรวจ/ส่งอีกครั้ง" },
  { pattern: /score stamp/gi, label: "score stamp → ใช้ คะแนน" },
  { pattern: /Book Page Viewer/g, label: "Book Page Viewer → ใช้ภาษาไทย" },
  { pattern: /Book Page QA/g, label: "Book Page QA → ใช้ภาษาไทย" },
];

const ALLOW_TITLE_TEMPLATE = /สมุดคำตอบ ป\.ธ\./;

function scanFiles() {
  const hits = [];
  for (const file of SCOPE_FILES) {
    const path = join(ROOT, file);
    let text;
    try {
      text = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    for (const rule of BANNED) {
      const matches = [...text.matchAll(rule.pattern)];
      for (const m of matches) {
        const line = text.slice(0, m.index).split("\n").length;
        const lineText = text.split("\n")[line - 1] || "";
        if (rule.pattern.source.includes("สมุดคำตอบ")) continue;
        if (ALLOW_TITLE_TEMPLATE.test(lineText)) continue;
        hits.push({ file, line, rule: rule.label, excerpt: lineText.trim().slice(0, 100) });
      }
    }
  }
  return hits;
}

async function checkPages(browser) {
  const pages = [
    { url: "http://127.0.0.1:8765/exam-books.html", checks: ["aria"] },
    { url: "http://127.0.0.1:8765/exam-profile.html", checks: ["overflow"] },
    { url: "http://127.0.0.1:8765/exam-account.html", checks: ["overflow"] },
  ];
  const results = [];

  for (const spec of pages) {
    const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
    await page.route("**/v1/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: { id: "u", role: "student", displayName: "ทดสอบ", email: "", createdAt: new Date().toISOString() },
        }),
      })
    );
    await page.addInitScript(() => {
      localStorage.setItem(
        "paligo-inbox-session-v1",
        JSON.stringify({
          sessionToken: "t",
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          user: { id: "u", role: "student", displayName: "ทดสอบ", email: "", createdAt: new Date().toISOString() },
        })
      );
    });
    await page.goto(spec.url, { waitUntil: "networkidle", timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(600);

    const aria = await page.evaluate(() => ({
      bookSelects: [...document.querySelectorAll(".book-card-select")].filter((el) => !el.getAttribute("aria-label")).length,
      bookHearts: [...document.querySelectorAll(".book-card-favorite")].filter((el) => !el.getAttribute("aria-label")).length,
      inboxBookBtn: document.querySelector("[data-open-book-menu]")?.getAttribute("aria-label") || null,
    }));

    const overflow = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll("button, .button, .paligo-btn")];
      const vw = window.innerWidth;
      return buttons
        .filter((el) => el.offsetParent !== null)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { text: (el.textContent || "").trim().slice(0, 30), w: r.width, overflow: r.right > vw + 2 };
        })
        .filter((x) => x.overflow);
    });

    results.push({ url: spec.url, aria, overflow });
    await page.close();
  }
  return results;
}

async function main() {
  const fileHits = scanFiles();
  const browser = await chromium.launch();
  const pageChecks = await checkPages(browser);
  await browser.close();

  const ariaOk = pageChecks.every(
    (p) => p.aria.bookSelects === 0 && p.aria.bookHearts === 0
  );
  const overflowOk = pageChecks.every((p) => p.overflow.length === 0);
  const pass = fileHits.length === 0 && ariaOk && overflowOk;

  console.log(
    JSON.stringify(
      {
        pass,
        fileHits,
        pageChecks,
        ariaOk,
        overflowOk,
      },
      null,
      2
    )
  );
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});

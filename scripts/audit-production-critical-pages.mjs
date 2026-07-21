/**
 * Production-critical visual smoke audit.
 *
 * Run:
 *   python3 -m http.server 8765
 *   node scripts/audit-production-critical-pages.mjs
 */
import { chromium } from "playwright";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "audit", "production-critical-pages");
const BASE_URL = process.env.PALIGO_AUDIT_BASE_URL || "http://127.0.0.1:8765";
const USER_ID = "audit-production-student";
const NOW = new Date().toISOString();

const routes = [
  {
    name: "exam-books",
    path: "/exam-books.html?apiPort=9999",
    required: ["#paligoSidebar", ".paligo-topbar", "[data-book-grid]", "[data-paligo-inbox-feature]"],
  },
  {
    name: "workbook",
    path: "/workbook.html?newBook=1&apiPort=9999",
    required: ["#paligoSidebar", ".paligo-topbar", "[data-line-height-range]"],
  },
  {
    name: "exam-inbox",
    path: "/exam-inbox.html?apiPort=9999",
    required: ["#paligoSidebar", ".paligo-topbar", "[data-inbox-shell], [data-inbox-gate]"],
  },
  {
    name: "exam-account",
    path: "/exam-account.html?tab=pairing&apiPort=9999",
    required: ["#paligoSidebar", ".paligo-topbar", "[data-tab='pairing']", "[data-panel='pairing']"],
  },
  {
    name: "exam-profile",
    path: "/exam-profile.html?apiPort=9999",
    required: ["#paligoSidebar", ".paligo-topbar", "[data-profile-tab='profile']", "[data-profile-tab='connections']"],
  },
  {
    name: "pali-reference-pip",
    path: "/pali-reference-pip.html?corpus=data%2Fcorpora%2Fdhammapadatthakatha-pali-rtf-prototype%2Fmanifest.json&subject=thai-to-pali",
    required: [".pip-toolbar, [data-reference-toolbar]", ".reference-content, [data-reference-content]"],
  },
];

function seedBook() {
  return {
    id: "book-audit-production",
    schema: "paligo.exam.answerBook.v1",
    ownerId: USER_ID,
    title: "สมุด audit production",
    studentName: "นักเรียน Audit",
    grade: "4",
    subject: "thai-to-pali",
    subjectLabel: "แปลไทยเป็นมคธ",
    status: "draft",
    revision: 1,
    createdAt: NOW,
    updatedAt: NOW,
    draft: {
      ownerId: USER_ID,
      bookId: "book-audit-production",
      profile: {
        studentName: "นักเรียน Audit",
        avatarUrl:
          "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20120%20120%22%3E%3Crect%20width%3D%22120%22%20height%3D%22120%22%20rx%3D%2260%22%20fill%3D%22%231f2d89%22%2F%3E%3Ctext%20x%3D%2260%22%20y%3D%2272%22%20font-size%3D%2248%22%20text-anchor%3D%22middle%22%20fill%3D%22%23fffaf0%22%3EA%3C%2Ftext%3E%3C%2Fsvg%3E",
      },
      pickers: [
        { type: "grade", value: "4" },
        { type: "subject", value: "thai-to-pali" },
      ],
      pages: [""],
      annotations: [],
      savedAt: NOW,
    },
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "paligo-audit-production-"));
  let browser;
  try {
    browser = await chromium.launchPersistentContext(userDataDir, {
      viewport: { width: 1280, height: 900 },
    });
  } catch (error) {
    if (!/Executable doesn't exist/i.test(error.message || "")) throw error;
    browser = await chromium.launchPersistentContext(userDataDir, {
      channel: "chrome",
      viewport: { width: 1280, height: 900 },
    });
  }
  const page = browser.pages()[0] || (await browser.newPage());
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.addInitScript(
    ({ userId, now, book }) => {
      localStorage.setItem(
        "paligo-inbox-session-v1",
        JSON.stringify({
          sessionToken: "audit-production-token",
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          user: {
            id: userId,
            role: "student",
            displayName: "นักเรียน Audit",
            email: "audit.std@paligo.jp",
            createdAt: now,
            profileJson: { firstName: "นักเรียน", lastName: "Audit", grade: "4" },
          },
        })
      );
      localStorage.setItem(
        "paligo-inbox-pairing-cache-v1",
        JSON.stringify({
          userId,
          ctx: {
            user: { id: userId, role: "student", displayName: "นักเรียน Audit" },
            pairing: {
              pairingId: "pairing-audit-production",
              reviewerUserId: "reviewer-audit-production",
              reviewerDisplayName: "ครู Audit",
              reviewerRoleLabel: "ครูผู้ตรวจ",
              status: "active",
              createdAt: now,
            },
          },
        })
      );
      localStorage.setItem(`paligo-exam-answer-books-v1::${userId}`, JSON.stringify([book]));
      localStorage.setItem(`paligo-exam-active-book-id-v1::${userId}`, book.id);
    },
    { userId: USER_ID, now: NOW, book: seedBook() }
  );

  const report = {
    auditedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    routes: [],
    errors,
  };

  for (const route of routes) {
    const url = `${BASE_URL}${route.path}`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 25000 });
    const checks = await page.evaluate((selectors) => {
      return selectors.map((selector) => {
        const nodes = Array.from(document.querySelectorAll(selector));
        const visible = nodes.some((node) => {
          const rect = node.getBoundingClientRect();
          const style = window.getComputedStyle(node);
          return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
        });
        return { selector, found: nodes.length > 0, visible };
      });
    }, route.required);
    const failed = checks.filter((check) => !check.found || !check.visible);
    await page.screenshot({ path: path.join(OUT_DIR, `${route.name}.png`), fullPage: true });
    report.routes.push({ name: route.name, url, checks, ok: failed.length === 0 });
  }

  await browser.close();
  await writeFile(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));

  const failures = report.routes.filter((route) => !route.ok);
  if (errors.length || failures.length) {
    console.error(JSON.stringify({ errors, failures }, null, 2));
    process.exit(1);
  }
  console.log(`Production-critical audit passed: ${path.relative(ROOT, OUT_DIR)}/report.json`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

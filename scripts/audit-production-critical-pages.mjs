/**
 * Production-critical visual smoke audit.
 *
 * Run:
 *   python3 -m http.server 8765
 *   node scripts/audit-production-critical-pages.mjs
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "audit", "production-critical-pages");
const BASE_URL = process.env.PALIGO_AUDIT_BASE_URL || "http://127.0.0.1:8765";
const USER_ID = "audit-production-student";
const NOW = new Date().toISOString();

const auditStudent = {
  id: USER_ID,
  role: "student",
  displayName: "นักเรียน Audit",
  email: "audit.std@paligo.jp",
  createdAt: NOW,
  profileJson: { firstName: "นักเรียน", lastName: "Audit", grade: "4" },
};

const auditPairing = {
  pairingId: "pairing-audit-production",
  reviewerUserId: "reviewer-audit-production",
  reviewerDisplayName: "ครู Audit",
  reviewerRoleLabel: "ครูผู้ตรวจ",
  status: "active",
  createdAt: NOW,
};

const auditReadyContract = {
  user: auditStudent,
  pairing: auditPairing,
  appState: "ready_student",
  capabilities: {
    canUseInbox: true,
    canOpenInbox: true,
    canCreateInvite: false,
    canJoinPairing: true,
    needsPairing: false,
    hasVirtualStudent: false,
    hasRealStudents: false,
    isSuperAdmin: false,
  },
};

const auditNeedsPairingContract = {
  user: auditStudent,
  pairing: null,
  appState: "logged_in_no_pairing",
  capabilities: {
    canUseInbox: true,
    canOpenInbox: false,
    canCreateInvite: false,
    canJoinPairing: true,
    needsPairing: true,
    hasVirtualStudent: false,
    hasRealStudents: false,
    isSuperAdmin: false,
  },
};

const routes = [
  {
    name: "exam-books",
    path: "/exam-books.html?apiPort=9999",
    required: ["#paligoSidebar", ".paligo-topbar", "[data-book-grid]", "[data-paligo-inbox-feature]"],
    assert: async (page) => {
      const inboxLabel = await page.locator(".button[data-paligo-inbox-feature]").innerText();
      if (!/กล่องข้อความ|ทดลอง Inbox/.test(inboxLabel)) {
        throw new Error(`exam-books inbox CTA must reflect ready app state, got: ${inboxLabel}`);
      }
    },
  },
  {
    name: "workbook",
    path: "/workbook.html?newBook=1&apiPort=9999",
    required: ["#paligoSidebar", ".paligo-topbar", "[data-line-height-control]"],
  },
  {
    name: "exam-inbox",
    path: "/exam-inbox.html?apiPort=9999",
    required: ["#paligoSidebar", ".paligo-topbar", "[data-inbox-shell], [data-inbox-gate]"],
  },
  {
    name: "exam-account",
    path: "/exam-account.html?tab=pairing&apiPort=9999",
    prepare: async (page) => {
      await page.click("[data-tab='pairing']");
    },
    required: ["#paligoSidebar", ".paligo-topbar", "[data-tab='pairing']", "[data-panel='pairing']"],
  },
  {
    name: "exam-account-no-pairing",
    path: "/exam-account.html?apiPort=9999",
    mockMe: auditNeedsPairingContract,
    required: ["#paligoSidebar", ".paligo-topbar", "[data-account-primary-link]"],
    assert: async (page) => {
      const primary = await page.locator("[data-account-primary-link]").innerText();
      const href = await page.locator("[data-account-primary-link]").getAttribute("href");
      if (!/จับคู่ครู/.test(primary) || !/tab=pairing/.test(href || "")) {
        throw new Error(`first-run no-pairing CTA must point to pairing, got: ${primary} ${href}`);
      }
    },
  },
  {
    name: "exam-profile",
    path: "/exam-profile.html?apiPort=9999",
    required: ["#paligoSidebar", ".paligo-topbar", "[data-profile-tab='profile']", "[data-profile-tab='connections']"],
  },
  {
    name: "pali-reference-pip",
    path: "/pali-reference-pip.html?corpus=data%2Fcorpora%2Fdhammapadatthakatha-pali-rtf-prototype%2Fmanifest.json&subject=thai-to-pali",
    required: [".pip-toolbar, [data-reference-toolbar]", "[data-reader]"],
    assert: async (page) => {
      await page.waitForSelector(".pip-line", { timeout: 10000 });
      const point = await page.evaluate(() => {
        const line = Array.from(document.querySelectorAll(".pip-line"))
          .find((node) => (node.dataset.plainText || node.textContent || "").trim().length > 12);
        if (!line) return null;
        const rect = line.getBoundingClientRect();
        return { x: rect.left + 40, y: rect.top + rect.height / 2, dragX: rect.left + 240 };
      });
      if (!point) throw new Error("PiP audit could not find a selectable line");
      await page.mouse.click(point.x, point.y);
      await page.waitForTimeout(180);
      const clickState = await page.evaluate(() => ({
        hidden: document.querySelector("[data-vocab-tooltip]")?.hidden,
        clickMode: document.querySelector("[data-vocab-tooltip]")?.classList.contains("is-click-lookup"),
        manageVisible: getComputedStyle(document.querySelector("[data-vocab-remember]")).display !== "none",
      }));
      if (clickState.hidden || !clickState.clickMode || clickState.manageVisible) {
        throw new Error(`PiP click-to-lookup failed: ${JSON.stringify(clickState)}`);
      }
      await page.keyboard.press("Escape");
      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
      await page.mouse.move(point.dragX, point.y, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(220);
      const dragState = await page.evaluate(() => ({
        hidden: document.querySelector("[data-vocab-tooltip]")?.hidden,
        clickMode: document.querySelector("[data-vocab-tooltip]")?.classList.contains("is-click-lookup"),
        manageVisible: getComputedStyle(document.querySelector("[data-vocab-remember]")).display !== "none",
      }));
      if (dragState.hidden || dragState.clickMode || !dragState.manageVisible) {
        throw new Error(`PiP selection-to-annotate failed: ${JSON.stringify(dragState)}`);
      }
    },
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
  const browser = await chromium.launch({ channel: "chrome" });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let activeMockMe = auditReadyContract;
  await context.route("http://localhost:9999/v1/health", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await context.route("http://localhost:9999/v1/me", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(activeMockMe) });
  });
  const page = context.pages()[0] || (await context.newPage());
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() !== "error") return;
    if (/Failed to load resource:/i.test(text)) return;
    errors.push(text);
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
          appState: "ready_student",
          capabilities: {
            canUseInbox: true,
            canOpenInbox: true,
            canCreateInvite: false,
            canJoinPairing: true,
            needsPairing: false,
            hasVirtualStudent: false,
            hasRealStudents: false,
            isSuperAdmin: false,
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
    activeMockMe = route.mockMe || auditReadyContract;
    const url = `${BASE_URL}${route.path}`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 25000 });
    if (typeof route.prepare === "function") {
      await route.prepare(page);
    }
    if (typeof route.assert === "function") {
      await route.assert(page);
    }
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

  await context.close();
  if (browser) await browser.close();
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

/**
 * Audit: Inbox group workflow preservation
 * Run: node scripts/audit-inbox-group-workflow.mjs
 */
import { chromium } from "playwright";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "audit", "inbox-group-workflow");
const URL = "http://127.0.0.1:8765/exam-inbox.html?apiPort=9999";
const USER_ID = "audit-inbox-group-user";
const GROUP_NAME = "กลุ่มประโยค ป.ธ. ๔ Audit";

async function launchContext(viewport) {
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "paligo-audit-inbox-group-"));
  return chromium.launchPersistentContext(userDataDir, { channel: "chrome", viewport });
}

function session() {
  return {
    sessionToken: "audit-token",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    user: {
      id: USER_ID,
      email: "audit.std@paligo.jp",
      role: "student",
      displayName: "นักเรียน Audit",
      createdAt: new Date().toISOString(),
    },
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const context = await launchContext({ width: 1440, height: 900 });
  const page = context.pages()[0] || (await context.newPage());
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => {
    const url = request.url();
    if (!url.includes("/v1/") && !url.includes(":9999")) errors.push(`${request.method()} ${url}`);
  });

  await page.addInitScript(({ userSession, userId }) => {
    localStorage.setItem("paligo-inbox-session-v1", JSON.stringify(userSession));
    localStorage.setItem(
      "paligo-inbox-pairing-cache-v1",
      JSON.stringify({
        userId,
        ctx: {
          user: userSession.user,
          pairing: {
            reviewerUserId: "audit-reviewer",
            reviewerDisplayName: "ครูถาวร",
            reviewerRoleLabel: "พระอาจารย์ · ครูผู้สอนและผู้ตรวจ",
          },
        },
      })
    );
    localStorage.removeItem("paligo-inbox-groups-v1");
    localStorage.removeItem("paligo-inbox-invites-v1");
  }, { userSession: session(), userId: USER_ID });

  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("[data-inbox-shell]:not([hidden])", { timeout: 10000 });

  await page.locator("[data-open-group-sheet]").first().click();
  await page.waitForSelector("[data-group-sheet].is-open", { timeout: 5000 });

  const groupSheetLayout = await page.evaluate(() => {
    const rectOf = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return {
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };
    const overlap = (a, b) => {
      if (!a || !b) return true;
      return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    };
    const panel = rectOf("[data-group-sheet] .inbox-group-sheet__panel");
    const name = rectOf("[data-group-name]");
    const owner = rectOf("[data-group-owner-role]");
    const kind = rectOf("[data-group-kind]");
    const theme = rectOf("[data-group-theme]");
    const description = rectOf("[data-group-description]");
    const preview = rectOf("[data-group-preview]");
    const controls = [name, owner, kind, theme, description].filter(Boolean);
    return {
      panel,
      name,
      owner,
      kind,
      theme,
      description,
      preview,
      nameOwnerOverlap: overlap(name, owner),
      kindThemeOverlap: overlap(kind, theme),
      controlsWithinPanel: Boolean(
        panel &&
          controls.length === 5 &&
          controls.every((control) => control.left >= panel.left && control.right <= panel.right)
      ),
      previewBelowDescription: Boolean(description && preview && preview.top >= description.bottom),
    };
  });

  await page.fill("[data-group-name]", GROUP_NAME);
  await page.selectOption("[data-group-owner-role]", "student");
  await page.selectOption("[data-group-kind]", "study");
  await page.click("[data-create-group-submit]");
  await page.waitForTimeout(400);

  await page.locator("[data-open-invite-sheet]").first().click();
  await page.waitForSelector("[data-invite-sheet].is-open", { timeout: 5000 });
  await page.selectOption("[data-invite-mode]", "personal");
  await page.fill("[data-invite-search]", "pete.std");
  await page.click("[data-invite-contact-id='pete.std@paligo.jp']");
  await page.click("[data-confirm-invite]");
  await page.waitForTimeout(300);

  await page.evaluate(() => window.PaligoExamInboxUI.openInviteSheet({ mode: "group" }));
  await page.waitForSelector("[data-invite-sheet].is-open", { timeout: 5000 });
  await page.selectOption("[data-invite-mode]", "group");
  await page.fill("[data-invite-search]", "precha.tc");
  await page.click("[data-invite-contact-id='precha.tc@paligo.in.th']");
  await page.click("[data-confirm-invite]");
  await page.waitForTimeout(300);

  const result = await page.evaluate((expectedName) => {
    const groupSheet = document.querySelector("[data-group-sheet]");
    const list = document.querySelector(".inbox-contact-list");
    const cards = Array.from(document.querySelectorAll(".inbox-contact-card"));
    const groupsRaw = localStorage.getItem("paligo-inbox-groups-v1") || "{}";
    const invitesRaw = localStorage.getItem("paligo-inbox-invites-v1") || "{}";
    let groups = {};
    let invites = {};
    try {
      groups = JSON.parse(groupsRaw);
    } catch {}
    try {
      invites = JSON.parse(invitesRaw);
    } catch {}
    const storedGroups = Array.isArray(groups["audit-inbox-group-user"]) ? groups["audit-inbox-group-user"] : [];
    const inviteRecord = invites["audit-inbox-group-user"] || {};
    return {
      sheetHidden: Boolean(groupSheet?.hidden),
      inviteSheetHidden: Boolean(document.querySelector("[data-invite-sheet]")?.hidden),
      activeTitle: document.querySelector("[data-chat-peer-name]")?.textContent?.trim() || "",
      hasGroupContact: cards.some((card) => card.textContent.includes(expectedName)),
      hasPersonalInviteContact: cards.some((card) => card.textContent.includes("สามเณร Pete")),
      contactCardHeights: cards.map((card) => Math.round(card.getBoundingClientRect().height)),
      listAlignContent: list ? getComputedStyle(list).alignContent : "",
      listGridAutoRows: list ? getComputedStyle(list).gridAutoRows : "",
      storedGroupCount: storedGroups.length,
      storedPersonalInviteCount: Array.isArray(inviteRecord.personal) ? inviteRecord.personal.length : 0,
      storedGroupMemberCount: Array.isArray(storedGroups[0]?.members) ? storedGroups[0].members.length : 0,
      systemText: document.querySelector("[data-chat-thread]")?.textContent || "",
    };
  }, GROUP_NAME);

  await page.screenshot({ path: path.join(OUT_DIR, "inbox-group-workflow.png"), fullPage: true });
  await context.close();

  const pass =
    errors.length === 0 &&
    result.sheetHidden &&
    result.inviteSheetHidden &&
    result.activeTitle === GROUP_NAME &&
    result.hasGroupContact &&
    result.hasPersonalInviteContact &&
    result.storedGroupCount === 1 &&
    result.storedPersonalInviteCount === 1 &&
    result.storedGroupMemberCount === 1 &&
    result.systemText.includes("เชิญ") &&
    result.listAlignContent === "start" &&
    result.listGridAutoRows === "max-content" &&
    result.contactCardHeights.length >= 2 &&
    result.contactCardHeights.every((height) => height <= 100) &&
    groupSheetLayout.controlsWithinPanel &&
    groupSheetLayout.previewBelowDescription &&
    !groupSheetLayout.nameOwnerOverlap &&
    !groupSheetLayout.kindThemeOverlap;

  const report = {
    auditedAt: new Date().toISOString(),
    url: URL,
    groupSheetLayout,
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

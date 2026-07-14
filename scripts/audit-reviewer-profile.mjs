/**
 * Reviewer profileStatus / capability — registration, profile save, search, inbox labels.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatReviewerRoleLabel,
  normalizeReviewerProfileFields,
  publicReviewerProfileFields,
} from "../workers/src/reviewer-profile.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function assertUnit() {
  const legacy = normalizeReviewerProfileFields({ role: "teacher-reviewer" });
  const labeled = formatReviewerRoleLabel({
    profileStatus: "monk_teacher",
    capability: "teach_review",
  });
  const pub = publicReviewerProfileFields({
    profileStatus: "lay_teacher",
    capability: "review",
    email: "secret@x.com",
    pin: "123456",
  });
  return (
    legacy.profileStatus === "monk_teacher" &&
    legacy.capability === "teach_review" &&
    labeled === "พระอาจารย์ · ครูผู้สอนและผู้ตรวจ" &&
    pub.profileStatus === "lay_teacher" &&
    pub.capability === "review" &&
    pub.roleLabel === "อาจารย์ฆราวาส · ผู้ตรวจ" &&
    !("email" in pub)
  );
}

async function runBrowser(browser) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const mockReviewers = [
    {
      id: "rev-a",
      displayName: "พระอาจารย์ทดสอบ",
      institution: "วัดทดสอบ",
      profileStatus: "monk_teacher",
      capability: "teach_review",
      roleLabel: "พระอาจารย์ · สอน·ตรวจ",
      avatarUrl: null,
      isPaired: false,
    },
  ];

  let mePayload = {
    user: {
      id: "user-student",
      role: "student",
      displayName: "นักเรียนทดสอบ",
      email: null,
      profileJson: {},
    },
    pairing: {
      reviewerDisplayName: "พระอาจารย์ทดสอบ",
      reviewerProfileStatus: "monk_teacher",
      reviewerCapability: "teach_review",
      reviewerRoleLabel: "พระอาจารย์ · สอน·ตรวจ",
    },
  };

  await page.route("**/v1/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/reviewers/search")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ reviewers: mockReviewers }),
      });
    }
    if (url.includes("/me") && route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mePayload),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.addInitScript(() => {
    localStorage.setItem(
      "paligo-inbox-session-v1",
      JSON.stringify({
        sessionToken: "t",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        user: {
          id: "user-student",
          role: "student",
          displayName: "นักเรียนทดสอบ",
          email: "",
          createdAt: new Date().toISOString(),
          profileJson: {},
        },
      })
    );
  });

  // Account register wizard
  await page.goto("http://127.0.0.1:8765/exam-account.html", { waitUntil: "networkidle" });
  await page.click('[data-tab="register"]');
  await page.waitForTimeout(200);
  const registerFields = await page.evaluate(() => ({
    hasWizard: !!document.querySelector("[data-register-wizard]"),
    roleTiles: document.querySelectorAll("[data-wizard-role-tiles] .wizard-option").length,
    hasProfile: typeof window.PaligoProfile?.buildProfileJsonFromRegisterWizard === "function",
    labels: window.PaligoProfile?.REVIEWER_PROFILE_STATUS_OPTIONS?.map((item) => item.label) || [],
  }));

  // Profile reviewer fields (reviewer session)
  mePayload = {
    user: {
      id: "user-reviewer",
      role: "reviewer",
      displayName: "พระอาจารย์ทดสอบ",
      email: null,
      profileJson: { profileStatus: "monk_teacher", capability: "teach_review", name: "ทดสอบ" },
    },
    invite: null,
    students: [],
  };
  await page.evaluate(() => {
    localStorage.setItem(
      "paligo-inbox-session-v1",
      JSON.stringify({
        sessionToken: "t2",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        user: {
          id: "user-reviewer",
          role: "reviewer",
          displayName: "พระอาจารย์ทดสอบ",
          email: "",
          createdAt: new Date().toISOString(),
          profileJson: { profileStatus: "monk_teacher", capability: "teach_review" },
        },
      })
    );
  });
  await page.goto("http://127.0.0.1:8765/exam-profile.html", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const profileFields = await page.evaluate(() => {
    const statusTiles = document.querySelectorAll("[data-field-profile-status-tiles] .wizard-option")
      .length;
    const capabilityTiles = document.querySelectorAll("[data-field-capability-tiles] .wizard-option")
      .length;
    return {
      statusTiles,
      capabilityTiles,
      labelFn: typeof window.PaligoProfile?.formatReviewerProfileLabel === "function",
    };
  });

  // Teacher combobox (student session)
  mePayload = {
    user: {
      id: "user-student",
      role: "student",
      displayName: "นักเรียนทดสอบ",
      email: null,
      profileJson: {},
    },
    pairing: {
      reviewerDisplayName: "พระอาจารย์ทดสอบ",
      reviewerProfileStatus: "monk_teacher",
      reviewerCapability: "teach_review",
      reviewerRoleLabel: "พระอาจารย์ · สอน·ตรวจ",
    },
  };
  await page.evaluate(() => {
    localStorage.setItem(
      "paligo-inbox-session-v1",
      JSON.stringify({
        sessionToken: "t",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        user: {
          id: "user-student",
          role: "student",
          displayName: "นักเรียนทดสอบ",
          email: "",
          createdAt: new Date().toISOString(),
          profileJson: {},
        },
      })
    );
  });
  await page.goto("http://127.0.0.1:8765/exam-profile.html", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const teacherInput = page.locator("[data-field-teacher-name]");
  if (await teacherInput.count()) {
    await teacherInput.click();
    await teacherInput.fill("พระ");
    await page.waitForTimeout(400);
  }
  const comboboxMeta = await page.evaluate(() => {
    const meta = document.querySelector(".teacher-combobox__meta");
    return meta?.textContent || "";
  });

  // Inbox peer meta (cached pairing)
  await page.goto("http://127.0.0.1:8765/exam-inbox.html", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const inboxPeer = await page.evaluate(() => ({
    meta: document.querySelector("[data-chat-peer-meta]")?.textContent || "",
    getLabel: typeof window.PaligoProfile?.formatReviewerPeerLabel === "function",
  }));

  await page.close();

  return {
    registerFields,
    profileFields,
    comboboxMeta,
    inboxPeer,
    errors,
  };
}

async function main() {
  const unitOk = assertUnit();
  const html = readFileSync(join(ROOT, "exam-account.html"), "utf8");
  const hasRegisterWizard = html.includes("data-register-wizard");
  const reviewersJs = readFileSync(join(ROOT, "workers/src/reviewers.js"), "utf8");
  const noEmailLeak = reviewersJs.includes("roleLabel") && !reviewersJs.includes("email:");

  const browser = await chromium.launch();
  const browserResult = await runBrowser(browser);
  await browser.close();

  const pass =
    unitOk &&
    hasRegisterWizard &&
    noEmailLeak &&
    browserResult.registerFields.hasWizard &&
    browserResult.registerFields.roleTiles >= 2 &&
    browserResult.registerFields.hasProfile &&
    browserResult.registerFields.labels.includes("สามเณรอาจารย์") &&
    browserResult.registerFields.labels.includes("อาจารย์ฆราวาส") &&
    browserResult.profileFields.statusTiles >= 5 &&
    browserResult.profileFields.capabilityTiles >= 3 &&
    browserResult.profileFields.labelFn &&
    /พระอาจารย์/.test(browserResult.comboboxMeta) &&
    browserResult.inboxPeer.getLabel &&
    browserResult.errors.length === 0;

  console.log(JSON.stringify({ unitOk, browserResult, pass }, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});

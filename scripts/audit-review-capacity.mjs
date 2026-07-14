/**
 * Reviewer capacity / reviewAvailability — profile save, clamp, search badge (#76)
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_REVIEWER_DAILY_LIMIT_MAX,
  formatReviewAvailabilityLabel,
  normalizeReviewAvailability,
  publicReviewAvailabilityFields,
  validateReviewAvailabilityInput,
} from "../workers/src/review-capacity.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function assertUnit() {
  const open = formatReviewAvailabilityLabel({ status: "open", dailyLimit: 10 });
  const clamp = validateReviewAvailabilityInput({ status: "open", dailyLimit: 80 });
  const pub = publicReviewAvailabilityFields({
    reviewAvailability: { status: "limited", dailyLimit: 10, queueSlots: 3, accepts: { homework: true, exam: true } },
    email: "secret@x.com",
    note: "private",
  });
  return (
    DEFAULT_REVIEWER_DAILY_LIMIT_MAX === 60 &&
    open === "พร้อมรับตรวจ · สูงสุด 10 รายการ/วัน" &&
    clamp.ok &&
    clamp.clamped &&
    clamp.value.dailyLimit === 60 &&
    pub.label === "รับได้จำกัด · ว่าง 3 คิว" &&
    !("note" in pub) &&
    !("email" in pub)
  );
}

function assertStatic() {
  const config = readFileSync(join(ROOT, "paligo-config.js"), "utf8");
  const profileHtml = readFileSync(join(ROOT, "exam-profile.html"), "utf8");
  const profileJs = readFileSync(join(ROOT, "paligo-profile.js"), "utf8");
  const reviewersJs = readFileSync(join(ROOT, "workers/src/reviewers.js"), "utf8");
  return (
    config.includes("reviewCapacity") &&
    config.includes("dailyLimitMax: 60") &&
    profileHtml.includes("data-review-availability-fields") &&
    profileHtml.includes("data-field-daily-limit") &&
    profileJs.includes("formatReviewAvailabilityLabel") &&
    profileJs.includes("getReviewerDailyLimitMax") &&
    reviewersJs.includes("reviewAvailability")
  );
}

async function runBrowser(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const mockReviewers = [
    {
      id: "rev-open",
      displayName: "พระอาจารย์พร้อม",
      institution: "วัดทดสอบ",
      profileStatus: "monk_teacher",
      capability: "teach_review",
      roleLabel: "พระอาจารย์ · สอน·ตรวจ",
      reviewAvailability: {
        status: "open",
        dailyLimit: 10,
        queueSlots: 0,
        accepts: ["homework", "exam"],
        label: "พร้อมรับตรวจ · สูงสุด 10 รายการ/วัน",
      },
      avatarUrl: null,
      isPaired: false,
    },
  ];

  let meRole = "reviewer";
  let reviewerProfileJson = {
    profileStatus: "monk_teacher",
    capability: "teach_review",
    reviewAvailability: normalizeReviewAvailability({ status: "closed", dailyLimit: 0 }),
  };

  await page.route("**/v1/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.includes("/reviewers/search")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ schema: "paligo.inbox.reviewers.search.v1", query: "", reviewers: mockReviewers }),
      });
    }
    if (url.includes("/me") && method === "PATCH") {
      try {
        const body = route.request().postDataJSON();
        if (body?.profileJson) reviewerProfileJson = body.profileJson;
      } catch {
        /* ignore */
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "user-reviewer",
            role: "reviewer",
            displayName: "พระอาจารย์ทดสอบ",
            email: null,
            profileJson: reviewerProfileJson,
          },
          invite: null,
          students: [],
        }),
      });
    }
    if (url.includes("/me") && method === "GET") {
      if (meRole === "student") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ user: { id: "user-student", role: "student", displayName: "นักเรียนทดสอบ", email: null, profileJson: {} }, pairing: null }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "user-reviewer",
            role: "reviewer",
            displayName: "พระอาจารย์ทดสอบ",
            email: null,
            profileJson: reviewerProfileJson,
          },
          invite: null,
          students: [],
        }),
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
          id: "user-reviewer",
          role: "reviewer",
          displayName: "พระอาจารย์ทดสอบ",
          email: "",
          createdAt: new Date().toISOString(),
          profileJson: {},
        },
      })
    );
  });

  // Reviewer profile availability controls
  await page.goto("http://127.0.0.1:8765/exam-profile.html", { waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  const reviewerUi = await page.evaluate(() => ({
    hasSection: !!document.querySelector("[data-review-availability-fields]"),
    statusTiles: document.querySelectorAll("[data-field-availability-status-tiles] .wizard-option").length,
    dailyMax: document.querySelector("[data-field-daily-limit]")?.max,
    previewFn: typeof window.PaligoProfile?.formatReviewAvailabilityLabel === "function",
    configMax: window.PALIGO_CONFIG?.reviewCapacity?.dailyLimitMax,
    cardOverflow: (() => {
      const card = document.querySelector(".profile-card");
      if (!card) return false;
      return card.getBoundingClientRect().width > window.innerWidth;
    })(),
  }));

  await page.click('[data-field-availability-status-tiles] [data-value="open"]');
  await page.fill("[data-field-reviewer-name]", "ทดสอบ");
  await page.fill("[data-field-daily-limit]", "10");
  await page.fill("[data-field-queue-slots]", "3");
  await page.click("[data-save-profile]");
  await page.waitForTimeout(500);

  const savedLocal = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("paligo-exam-reviewer-profile-v1::user-reviewer") || "null")
  );

  await page.click('[data-field-availability-status-tiles] [data-value="open"]');
  await page.fill("[data-field-daily-limit]", "80");
  await page.click("[data-save-profile]");
  await page.waitForTimeout(500);
  const clampedValue = await page.inputValue("[data-field-daily-limit]");

  // Student search badge
  meRole = "student";
  await page.evaluate(() => {
    localStorage.setItem(
      "paligo-inbox-session-v1",
      JSON.stringify({
        sessionToken: "t2",
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
  await page.waitForSelector("body.is-role-student", { timeout: 10000 });
  await page.waitForTimeout(500);
  const teacherInput = page.locator("[data-field-teacher-name]");
  await teacherInput.waitFor({ state: "visible", timeout: 10000 });
  await teacherInput.click();
  await teacherInput.fill("พระ");
  await page.waitForTimeout(500);
  const comboboxMeta = await page.evaluate(
    () => document.querySelector(".teacher-combobox__meta")?.textContent || ""
  );

  await page.close();
  return { reviewerUi, savedLocal, clampedValue, comboboxMeta, errors };
}

async function main() {
  const unitOk = assertUnit();
  const staticOk = assertStatic();
  const browser = await chromium.launch();
  const browserResult = await runBrowser(browser);
  await browser.close();

  const pass =
    unitOk &&
    staticOk &&
    browserResult.reviewerUi.hasSection &&
    browserResult.reviewerUi.statusTiles >= 4 &&
    Number(browserResult.reviewerUi.dailyMax) === 60 &&
    browserResult.reviewerUi.configMax === 60 &&
    browserResult.reviewerUi.previewFn &&
    !browserResult.reviewerUi.cardOverflow &&
    browserResult.savedLocal?.reviewAvailability?.dailyLimit === 10 &&
    browserResult.savedLocal?.reviewAvailability?.status === "open" &&
    Number(browserResult.clampedValue) === 60 &&
    /พร้อมรับตรวจ/.test(browserResult.comboboxMeta) &&
    browserResult.errors.length === 0;

  console.log(JSON.stringify({ unitOk, staticOk, browserResult, pass }, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});

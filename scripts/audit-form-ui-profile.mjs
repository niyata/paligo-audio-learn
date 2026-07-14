/**
 * Form UI quality — exam-profile hierarchy, density, mobile/desktop (#77)
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const URL = "http://127.0.0.1:8765/exam-profile.html";

function assertStatic() {
  const rule = readFileSync(join(ROOT, ".cursor/rules/paligo-form-ui-quality.mdc"), "utf8");
  const html = readFileSync(join(ROOT, "exam-profile.html"), "utf8");
  return (
    rule.includes("Form hierarchy") &&
    rule.includes("Density") &&
    rule.includes("Option controls") &&
    html.includes("profile-section") &&
    html.includes("profile-field__label") &&
    html.includes("profile-field__hint") &&
    html.includes("profile-actions--footer") &&
    html.includes("profile-option-grid--compact") &&
    html.includes("ชื่อสาธารณะ") &&
    !html.includes("feed/leaderboard") &&
    html.includes("สถานะโปรไฟล์")
  );
}

async function measureViewport(browser, viewport, role) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const user =
    role === "reviewer"
      ? {
          id: "user-reviewer-ui",
          role: "reviewer",
          displayName: "พระอาจารย์ทดสอบ",
          email: "",
          createdAt: new Date().toISOString(),
          profileJson: { profileStatus: "monk_teacher", capability: "teach_review" },
        }
      : {
          id: "user-student-ui",
          role: "student",
          displayName: "นักเรียนทดสอบ",
          email: "",
          createdAt: new Date().toISOString(),
          profileJson: {},
        };

  await page.addInitScript((sessionUser) => {
    localStorage.setItem(
      "paligo-inbox-session-v1",
      JSON.stringify({
        sessionToken: "ui-audit",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        user: sessionUser,
      })
    );
  }, user);

  await page.route(/\/v1\//, (route) => route.abort());

  await page.goto(URL, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForSelector(role === "reviewer" ? "body.is-role-reviewer" : "body.is-role-student", {
    timeout: 10000,
  });
  await page.waitForTimeout(800);

  const metrics = await page.evaluate(() => {
    const card = document.querySelector(".profile-card");
    const cardRect = card?.getBoundingClientRect();
    const overflowX =
      card && cardRect ? cardRect.right > window.innerWidth + 1 || cardRect.left < -1 : true;

    const textInputs = Array.from(document.querySelectorAll(".profile-input[type='text'], .profile-input:not([type])"))
      .filter((el) => el.offsetParent !== null)
      .map((el) => Math.round(el.getBoundingClientRect().height));

    const tallInputs = textInputs.filter((h) => h > 52);

    const tiles = Array.from(document.querySelectorAll(".profile-option-grid--compact .wizard-option"))
      .filter((el) => el.offsetParent !== null)
      .map((el) => Math.round(el.getBoundingClientRect().height));

    const shortTiles = tiles.filter((h) => h < 44);

    const primaryButtons = Array.from(document.querySelectorAll(".profile-actions--footer .paligo-btn.is-primary"))
      .filter((el) => el.offsetParent !== null);
    const secondaryInFooter = document.querySelectorAll(".profile-actions--footer .profile-actions__secondary .paligo-btn").length;

    const sections = document.querySelectorAll(".profile-section").length;

    let fieldAlignmentOk = true;
    let fieldAlignmentDelta = null;
    const displayGrid = document.querySelector(
      '.profile-section .profile-field-grid.is-2col .profile-field__label'
    )?.closest(".profile-field-grid");
    if (displayGrid && window.innerWidth >= 520) {
      const pair = Array.from(displayGrid.querySelectorAll(":scope > .profile-field")).slice(0, 2);
      if (pair.length === 2) {
        const labelTops = pair.map((f) => f.querySelector(".profile-field__label")?.getBoundingClientRect().top);
        const controlTops = pair.map((f) =>
          f.querySelector(".profile-input, .profile-select, .profile-field__control .profile-input")?.getBoundingClientRect().top
        );
        const labelDelta = Math.abs((labelTops[0] || 0) - (labelTops[1] || 0));
        const controlDelta = Math.abs((controlTops[0] || 0) - (controlTops[1] || 0));
        fieldAlignmentDelta = { labelDelta: Math.round(labelDelta), controlDelta: Math.round(controlDelta) };
        fieldAlignmentOk = labelDelta <= 2 && controlDelta <= 2;
      }
    }

    return {
      overflowX,
      tallInputs,
      shortTiles,
      primaryCount: primaryButtons.length,
      secondaryInFooter,
      sections,
      hasCompactGrid: !!document.querySelector(".profile-option-grid--compact"),
      fieldAlignmentOk,
      fieldAlignmentDelta,
    };
  });

  await page.close();
  return { ...metrics, errors };
}

async function runReviewerSave(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.addInitScript(() => {
    localStorage.setItem(
      "paligo-inbox-session-v1",
      JSON.stringify({
        sessionToken: "save-audit",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        user: {
          id: "user-reviewer-ui",
          role: "reviewer",
          displayName: "พระอาจารย์ทดสอบ",
          email: "",
          createdAt: new Date().toISOString(),
          profileJson: {},
        },
      })
    );
  });

  await page.route(/\/v1\//, (route) => {
    if (route.request().method() === "PATCH") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: { id: "user-reviewer-ui", role: "reviewer", displayName: "พระอาจารย์ทดสอบ" } }),
      });
    }
    return route.abort();
  });

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForSelector("body.is-role-reviewer", { timeout: 10000 });
  await page.waitForTimeout(600);

  await page.click('[data-field-availability-status-tiles] [data-value="open"]');
  await page.fill("[data-field-reviewer-name]", "ทดสอบ");
  await page.fill("[data-field-daily-limit]", "10");
  await page.click("[data-save-profile]");
  await page.waitForTimeout(500);

  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("paligo-exam-reviewer-profile-v1::user-reviewer-ui") || "null")
  );

  const statusTiles = await page.evaluate(
    () => document.querySelectorAll("[data-field-profile-status-tiles] .wizard-option").length
  );

  await page.close();
  return { saved, statusTiles, errors };
}

async function main() {
  const staticOk = assertStatic();
  const browser = await chromium.launch();

  const mobileStudent = await measureViewport(browser, { width: 390, height: 844 }, "student");
  const desktopStudent = await measureViewport(browser, { width: 1280, height: 900 }, "student");
  const mobileReviewer = await measureViewport(browser, { width: 390, height: 844 }, "reviewer");
  const saveCheck = await runReviewerSave(browser);

  await browser.close();

  const pass =
    staticOk &&
    mobileStudent.sections >= 2 &&
    mobileReviewer.sections >= 5 &&
    mobileReviewer.hasCompactGrid &&
    mobileReviewer.primaryCount === 1 &&
    mobileReviewer.secondaryInFooter >= 1 &&
    !mobileStudent.overflowX &&
    !mobileReviewer.overflowX &&
    !desktopStudent.overflowX &&
    desktopStudent.fieldAlignmentOk !== false &&
    mobileStudent.tallInputs.length === 0 &&
    mobileReviewer.tallInputs.length === 0 &&
    mobileReviewer.shortTiles.length === 0 &&
    saveCheck.statusTiles >= 5 &&
    saveCheck.saved?.reviewAvailability?.status === "open" &&
    saveCheck.saved?.reviewAvailability?.dailyLimit === 10 &&
    mobileStudent.errors.length === 0 &&
    mobileReviewer.errors.length === 0 &&
    saveCheck.errors.length === 0;

  console.log(
    JSON.stringify({ staticOk, mobileStudent, desktopStudent, mobileReviewer, saveCheck, pass }, null, 2)
  );
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});

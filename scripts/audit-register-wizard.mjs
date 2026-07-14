/**
 * Register step wizard — mobile progressive disclosure + profile fields.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function assertStatic() {
  const accountHtml = readFileSync(join(ROOT, "exam-account.html"), "utf8");
  const profileJs = readFileSync(join(ROOT, "paligo-profile.js"), "utf8");
  return (
    accountHtml.includes("data-register-wizard") &&
    accountHtml.includes("data-wizard-step=\"reviewer-status\"") &&
    accountHtml.includes("data-wizard-submit") &&
    accountHtml.includes("data-onboarding-mascot") &&
    accountHtml.includes("data-wizard-stepper") &&
    accountHtml.includes("data-goto-login") &&
    accountHtml.includes("is-onboarding") &&
    profileJs.includes("REVIEWER_CAPABILITY_WIZARD_OPTIONS") &&
    profileJs.includes("สามเณรอาจารย์") &&
    profileJs.includes("อาจารย์ฆราวาส") &&
    profileJs.includes("validateRegisterWizardStep")
  );
}

async function runBrowser(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.route("**/v1/**", async (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );

  await page.goto("http://127.0.0.1:8765/exam-account.html", { waitUntil: "networkidle" });
  await page.click('[data-tab="register"]');
  await page.waitForTimeout(200);

  // Focused onboarding chrome (issue #74)
  const focusMode = await page.evaluate(() => {
    const visible = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const shellMounted = document.body.dataset.paligoShell === "ready";
    const stepperSegs = document.querySelectorAll("[data-wizard-stepper] .stepper__seg").length;
    const brokenImg = [...document.querySelectorAll("[data-onboarding-mascot] img")].some(
      (img) => img.complete && img.naturalWidth === 0
    );
    const cardOverflow = (() => {
      const card = document.querySelector(".account-card");
      if (!card) return true;
      return card.getBoundingClientRect().width > window.innerWidth;
    })();
    return {
      onboardingClass: document.body.classList.contains("is-onboarding"),
      shellMounted,
      sidebarVisible: visible(".paligo-sidebar"),
      topbarVisible: visible(".paligo-topbar"),
      tabRowVisible: visible(".tab-row"),
      apiStatusVisible: visible("[data-api-status]"),
      loginFormVisible: visible("[data-login-form]"),
      hasSecondaryLogin: !!document.querySelector("[data-goto-login]"),
      stepperSegs,
      brokenImg,
      cardOverflow,
    };
  });

  // Secondary "already have an account" link exits onboarding back to login
  await page.click("[data-goto-login]");
  await page.waitForTimeout(150);
  const afterLoginLink = await page.evaluate(() => ({
    onboardingClass: document.body.classList.contains("is-onboarding"),
    loginVisible: (() => {
      const el = document.querySelector("[data-login-form]");
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    })(),
  }));

  await page.goto("http://127.0.0.1:8765/exam-account.html", { waitUntil: "networkidle" });
  await page.click('[data-tab="register"]');
  await page.waitForTimeout(200);

  const studentFlow = await page.evaluate(async () => {
    const wizard = document.querySelector("[data-register-wizard]");
    const clickNext = () => document.querySelector("[data-wizard-next]")?.click();
    const visibleStep = () =>
      [...wizard.querySelectorAll("[data-wizard-step]")].find((node) => !node.hidden)?.dataset
        .wizardStep || "";
    const progress = document.querySelector("[data-wizard-progress]")?.textContent || "";
    const roleTiles = wizard.querySelectorAll("[data-wizard-role-tiles] .wizard-option").length;
    document.querySelector('[data-wizard-role-tiles] [data-value="student"]')?.click();
    clickNext();
    await new Promise((r) => setTimeout(r, 50));
    const studentStep = visibleStep();
    const prefixTiles = wizard.querySelectorAll("[data-wizard-prefix-tiles] .wizard-option").length;
    document.querySelector('[data-wizard-prefix-tiles] [data-value="พระ"]')?.click();
    document.querySelector("[data-wizard-first-name]").value = "ทดสอบ";
    clickNext();
    await new Promise((r) => setTimeout(r, 50));
    const accountStep = visibleStep();
    return { progress, roleTiles, studentStep, prefixTiles, accountStep };
  });

  await page.goto("http://127.0.0.1:8765/exam-account.html", { waitUntil: "networkidle" });
  await page.click('[data-tab="register"]');
  await page.waitForTimeout(200);

  const reviewerFlow = await page.evaluate(async () => {
    const wizard = document.querySelector("[data-register-wizard]");
    const clickNext = () => document.querySelector("[data-wizard-next]")?.click();
    const visibleStep = () =>
      [...wizard.querySelectorAll("[data-wizard-step]")].find((node) => !node.hidden)?.dataset
        .wizardStep || "";
    document.querySelector('[data-wizard-role-tiles] [data-value="reviewer"]')?.click();
    clickNext();
    await new Promise((r) => setTimeout(r, 50));
    const statusStep = visibleStep();
    const statusTiles = wizard.querySelectorAll("[data-wizard-status-tiles] .wizard-option").length;
    document.querySelector('[data-wizard-status-tiles] [data-value="monk_teacher"]')?.click();
    clickNext();
    await new Promise((r) => setTimeout(r, 50));
    const capabilityStep = visibleStep();
    const capabilityTiles = wizard.querySelectorAll("[data-wizard-capability-tiles] .wizard-option")
      .length;
    document.querySelector('[data-wizard-capability-tiles] [data-value="teach_review"]')?.click();
    clickNext();
    await new Promise((r) => setTimeout(r, 50));
    const accountStep = visibleStep();
    document.querySelector("[data-wizard-display-name]").value = "พระอาจารย์ทดสอบ";
    document.querySelector("[data-wizard-pin]").value = "123456";
    clickNext();
    await new Promise((r) => setTimeout(r, 50));
    const reviewStep = visibleStep();
    const submitVisible = !document.querySelector("[data-wizard-submit]")?.hidden;
    const payload = window.PaligoProfile.buildProfileJsonFromRegisterWizard({
      role: "reviewer",
      profileStatus: "monk_teacher",
      capability: "teach_review",
      displayName: "พระอาจารย์ทดสอบ",
    });
    return {
      statusStep,
      statusTiles,
      capabilityStep,
      capabilityTiles,
      accountStep,
      reviewStep,
      submitVisible,
      payload,
    };
  });

  await page.close();
  return { focusMode, afterLoginLink, studentFlow, reviewerFlow, errors };
}

async function main() {
  const staticOk = assertStatic();
  const browser = await chromium.launch();
  const browserResult = await runBrowser(browser);
  await browser.close();

  const fm = browserResult.focusMode;
  const focusPass =
    fm.onboardingClass &&
    fm.shellMounted &&
    !fm.sidebarVisible &&
    !fm.topbarVisible &&
    !fm.tabRowVisible &&
    !fm.apiStatusVisible &&
    !fm.loginFormVisible &&
    fm.hasSecondaryLogin &&
    fm.stepperSegs >= 4 &&
    !fm.brokenImg &&
    !fm.cardOverflow &&
    !browserResult.afterLoginLink.onboardingClass &&
    browserResult.afterLoginLink.loginVisible;

  const pass =
    staticOk &&
    focusPass &&
    browserResult.studentFlow.roleTiles >= 2 &&
    browserResult.studentFlow.studentStep === "student" &&
    browserResult.studentFlow.prefixTiles >= 4 &&
    browserResult.studentFlow.accountStep === "account" &&
    browserResult.reviewerFlow.statusStep === "reviewer-status" &&
    browserResult.reviewerFlow.statusTiles >= 5 &&
    browserResult.reviewerFlow.capabilityStep === "reviewer-capability" &&
    browserResult.reviewerFlow.capabilityTiles >= 3 &&
    browserResult.reviewerFlow.reviewStep === "review" &&
    browserResult.reviewerFlow.submitVisible &&
    browserResult.reviewerFlow.payload?.profileStatus === "monk_teacher" &&
    browserResult.reviewerFlow.payload?.capability === "teach_review" &&
    browserResult.errors.length === 0;

  console.log(JSON.stringify({ staticOk, browserResult, pass }, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});

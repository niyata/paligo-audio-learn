/**
 * Issue #80 — prefix row collapse/expand + selection behavior
 */
import { chromium } from "playwright";

const REVIEWER = {
  sessionToken: "prefix-audit",
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  user: {
    id: "user-reviewer-prefix",
    role: "reviewer",
    displayName: "พระทดสอบ",
    email: "",
    createdAt: new Date().toISOString(),
    profileJson: { prefix: "พระ", profileStatus: "monk_teacher", capability: "teach_review" },
  },
};

const STUDENT = {
  sessionToken: "prefix-audit-stu",
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  user: {
    id: "user-student-prefix",
    role: "student",
    displayName: "สามเณรทดสอบ",
    email: "",
    createdAt: new Date().toISOString(),
    profileJson: { prefix: "สามเณร" },
  },
};

async function prefixState(page, group) {
  return page.evaluate((groupName) => {
    const host = document.querySelector(`[data-prefix-group="${groupName}"]`);
    const checked = host?.querySelector('input[type="radio"]:checked');
    const visible = host
      ? Array.from(host.querySelectorAll(".profile-prefix")).filter((el) => el.offsetParent !== null).length
      : 0;
    return {
      collapsed: host?.classList.contains("is-collapsed") ?? false,
      expanded: host?.classList.contains("is-expanded") ?? false,
      value: checked?.value || "",
      visible,
      total: host?.querySelectorAll(".profile-prefix").length ?? 0,
    };
  }, group);
}

async function clickPrefixLabel(page, group, value) {
  await page.evaluate(
    ({ groupName, val }) => {
      const host = document.querySelector(`[data-prefix-group="${groupName}"]`);
      const input = Array.from(host?.querySelectorAll('input[type="radio"]') || []).find((el) => el.value === val);
      input?.click();
    },
    { groupName: group, val: value }
  );
  await page.waitForTimeout(120);
}

async function expandCollapsedPrefix(page, group) {
  const value = await page.evaluate(
    (groupName) => document.querySelector(`[data-prefix-group="${groupName}"] input:checked`)?.value || "",
    group
  );
  await clickPrefixLabel(page, group, value);
}

async function keyboardSelectPrefix(page, group, fieldName, direction = "ArrowLeft") {
  await page.locator(`[data-prefix-group="${group}"] input[name="${fieldName}"]:checked`).focus();
  await page.keyboard.press(direction);
  await page.waitForTimeout(120);
}

async function testReviewerPrefix(browser, errors) {
  const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
  page.on("pageerror", (e) => errors.push(`reviewer: ${e.message}`));

  await page.addInitScript((session) => {
    localStorage.setItem("paligo-inbox-session-v1", JSON.stringify(session));
  }, REVIEWER);
  await page.route(/\/v1\//, (r) => r.abort());

  await page.goto("http://127.0.0.1:8765/exam-profile.html", { waitUntil: "networkidle" });
  await page.waitForSelector("body.is-role-reviewer", { timeout: 10000 });
  await page.waitForTimeout(500);

  const results = {};

  results.initial = await prefixState(page, "reviewer");
  if (!results.initial.collapsed || results.initial.value !== "พระ") {
    errors.push("reviewer: initial collapsed พระ");
  }

  await clickPrefixLabel(page, "reviewer", "พระ");
  results.collapsedSameExpands = await prefixState(page, "reviewer");
  if (!results.collapsedSameExpands.expanded || results.collapsedSameExpands.visible < 4) {
    errors.push("reviewer: collapsed+same should expand");
  }

  await clickPrefixLabel(page, "reviewer", "พระ");
  results.expandedSameCollapses = await prefixState(page, "reviewer");
  if (!results.expandedSameCollapses.collapsed) {
    errors.push("reviewer: expanded+same should collapse");
  }

  await clickPrefixLabel(page, "reviewer", "พระ");
  const expandedAgain = await prefixState(page, "reviewer");
  if (!expandedAgain.expanded) {
    errors.push("reviewer: collapsed+same should expand again");
  }

  await page.getByRole("radio", { name: "พระมหา", exact: true }).click();
  await page.waitForTimeout(120);
  results.expandedOtherSelects = await prefixState(page, "reviewer");
  if (results.expandedOtherSelects.value !== "พระมหา" || !results.expandedOtherSelects.collapsed) {
    errors.push("reviewer: expanded+other should select and collapse");
  }

  await page.evaluate(() => {
    const input = document.querySelector('[data-prefix-group="reviewer"] input[name="reviewerPrefix"]:checked');
    input?.focus();
    input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  await page.waitForTimeout(120);
  results.keyboardExpand = await prefixState(page, "reviewer");
  if (!results.keyboardExpand.expanded) {
    errors.push("reviewer: Enter on collapsed checked should expand");
  }

  await page.fill("[data-field-reviewer-name]", "ทดสอบ prefix");
  await page.click("[data-save-profile]");
  await page.waitForTimeout(400);

  results.saved = await page.evaluate(() => {
    const raw = localStorage.getItem("paligo-exam-reviewer-profile-v1::user-reviewer-prefix");
    return raw ? JSON.parse(raw) : null;
  });
  if (results.saved?.prefix !== "พระมหา") {
    errors.push("reviewer: save did not persist prefix");
  }

  await page.close();
  return results;
}

async function testStudentPrefix(browser, errors) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (e) => errors.push(`student: ${e.message}`));

  await page.addInitScript((session) => {
    localStorage.setItem("paligo-inbox-session-v1", JSON.stringify(session));
  }, STUDENT);
  await page.route(/\/v1\//, (r) => r.abort());

  await page.goto("http://127.0.0.1:8765/exam-profile.html", { waitUntil: "networkidle" });
  await page.waitForSelector("body.is-role-student", { timeout: 10000 });
  await page.waitForTimeout(500);

  const results = {};

  await clickPrefixLabel(page, "student", "สามเณร");
  results.studentExpand = await prefixState(page, "student");
  if (!results.studentExpand.expanded) {
    errors.push("student: collapsed+same should expand");
  }

  await page.getByRole("radio", { name: "กัลฯ", exact: true }).click();
  await page.waitForTimeout(120);
  results.after = await prefixState(page, "student");
  if (results.after.value !== "กัลฯ" || !results.after.collapsed) {
    errors.push("student: expanded+other should select กัลฯ and collapse");
  }

  await page.close();
  return results;
}

async function main() {
  const errors = [];
  const browser = await chromium.launch();

  const reviewer = await testReviewerPrefix(browser, errors);
  const student = await testStudentPrefix(browser, errors);

  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:8765/exam-profile.html", { waitUntil: "networkidle" });
  const inference = await page.evaluate(() => ({
    novice: window.PaligoProfile.inferProfileStatusFromPrefix("สามเณร"),
    monk: window.PaligoProfile.inferProfileStatusFromPrefix("พระ"),
    normalized: window.PaligoProfile.normalizeReviewerProfile({ prefix: "สามเณร", capability: "teach" })
      .profileStatus,
  }));
  await page.close();
  await browser.close();

  if (inference.novice !== "novice_teacher" || inference.monk !== "monk_teacher") {
    errors.push("profileStatus inference broken");
  }
  if (inference.normalized !== "novice_teacher") {
    errors.push("normalizeReviewerProfile prefix inference broken");
  }

  const pass = errors.length === 0;
  console.log(JSON.stringify({ reviewer, student, inference, errors, pass }, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});

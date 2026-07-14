/**
 * Reviewer console lifecycle — claim → review → save → return → refresh
 */
import { chromium } from "playwright";

const REVIEWER = {
  sessionToken: "workflow-audit",
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  user: {
    id: "user-reviewer-workflow",
    role: "reviewer",
    displayName: "ผู้ตรวจ workflow",
    email: "",
    createdAt: new Date().toISOString(),
    profileJson: { prefix: "พระ", name: "ทดสอบ workflow", capability: "teach_review" },
  },
};

const SUBMISSION_ID = "submission-workflow-audit-1";
const BOOK_ID = "book-workflow-audit-1";

function seedReviewerStorage() {
  const scope = "user-reviewer-workflow";
  const submission = {
    schema: "paligo.exam.submission.v1",
    id: SUBMISSION_ID,
    bookId: BOOK_ID,
    bookRevision: 1,
    bookTitle: "สมุดทดสอบ workflow",
    studentName: "นักเรียนทดสอบ",
    grade: "3",
    submittedAt: new Date().toISOString(),
    pages: [{ text: "คำตอบทดสอบ" }],
    annotations: [],
  };
  localStorage.setItem(`paligo-exam-submissions-v1::${scope}`, JSON.stringify([submission]));
  localStorage.setItem(
    `paligo-exam-answer-books-v1::${scope}`,
    JSON.stringify([
      {
        id: BOOK_ID,
        title: "สมุดทดสอบ workflow",
        status: "under_review",
        revision: 1,
        draft: { pages: [{ text: "คำตอบทดสอบ" }] },
      },
    ])
  );
  localStorage.removeItem(`paligo-exam-review-workflow-v1::${scope}`);
  localStorage.removeItem(`paligo-exam-results-v1::${scope}`);
}

async function main() {
  const errors = [];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  await page.addInitScript((session) => {
    localStorage.setItem("paligo-inbox-session-v1", JSON.stringify(session));
    if (sessionStorage.getItem("workflow-audit-seeded") === "1") return;
    sessionStorage.setItem("workflow-audit-seeded", "1");
    const scope = session.user.id;
    const submission = {
      schema: "paligo.exam.submission.v1",
      id: "submission-workflow-audit-1",
      bookId: "book-workflow-audit-1",
      bookRevision: 1,
      bookTitle: "สมุดทดสอบ workflow",
      studentName: "นักเรียนทดสอบ",
      grade: "3",
      submittedAt: new Date().toISOString(),
      pages: [{ text: "คำตอบทดสอบ" }],
      annotations: [],
    };
    localStorage.setItem(`paligo-exam-submissions-v1::${scope}`, JSON.stringify([submission]));
    localStorage.setItem(
      `paligo-exam-answer-books-v1::${scope}`,
      JSON.stringify([
        {
          id: "book-workflow-audit-1",
          title: "สมุดทดสอบ workflow",
          status: "under_review",
          revision: 1,
          draft: { pages: [{ text: "คำตอบทดสอบ" }] },
        },
      ])
    );
    localStorage.removeItem(`paligo-exam-review-workflow-v1::${scope}`);
    localStorage.removeItem(`paligo-exam-results-v1::${scope}`);
  }, REVIEWER);

  await page.route(/\/v1\//, (r) => r.abort());
  await page.goto("http://127.0.0.1:8765/exam-reviewer-console.html", { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.PaligoExamShared?.markWorkflowClaimed);
  await page.waitForSelector("[data-reviewer-shell]:not([hidden])", { timeout: 10000 });

  const switchWorkflowTab = async (tab) => {
    const segment = page.locator("[data-workflow-segment]");
    if (await segment.isVisible()) {
      await segment.selectOption(tab);
      return;
    }
    await page.click(`[data-workflow-tab="${tab}"]`);
  };

  const results = {};

  results.tabs = await page.evaluate(() => ({
    hasLifecycle: Boolean(document.querySelector("[data-workflow-tabs]")),
    hasSegment: Boolean(document.querySelector("[data-workflow-segment]")),
    tabCount: document.querySelectorAll("[data-workflow-tab]").length,
  }));

  if (!results.tabs.hasLifecycle || results.tabs.tabCount < 5) {
    errors.push("missing lifecycle tabs");
  }

  // Claim simulation via shared API
  results.claimed = await page.evaluate(() => {
    const shared = window.PaligoExamShared;
    shared.markWorkflowClaimed("submission-workflow-audit-1", { bookId: "book-workflow-audit-1" });
    return shared.getReviewWorkflow("submission-workflow-audit-1");
  });

  if (results.claimed?.phase !== "in_review") {
    errors.push(`claim should mark in_review, got ${results.claimed?.phase}`);
  }

  await page.reload({ waitUntil: "networkidle" });

  results.afterReloadInReview = await page.evaluate(() => {
    const shared = window.PaligoExamShared;
    return {
      inReview: shared.listReviewerSubmissionsByPhase("in_review").length,
      waiting: shared.listReviewerSubmissionsByPhase("waiting_review").length,
      phase: shared.getReviewWorkflow("submission-workflow-audit-1")?.phase,
    };
  });

  if (results.afterReloadInReview.inReview < 1) {
    errors.push("claimed submission not in in_review queue after reload");
  }

  // Select + save review
  await switchWorkflowTab("in_review");
  await page.click("[data-queue-in-review] .submission-item");
  await page.click("[data-score-stamp='1']");
  await page.click("[data-save-review]");
  await page.waitForTimeout(200);

  results.afterSave = await page.evaluate(() => {
    const shared = window.PaligoExamShared;
    return {
      phase: shared.getReviewWorkflow("submission-workflow-audit-1")?.phase,
      ready: shared.listReviewerSubmissionsByPhase("reviewed_ready").length,
      hasResult: Boolean(shared.getSavedReviewForSubmission("submission-workflow-audit-1")),
    };
  });

  if (results.afterSave.phase !== "reviewed_ready") {
    errors.push(`save should mark reviewed_ready, got ${results.afterSave.phase}`);
  }

  // Return with offline fallback (API aborted)
  await page.click("[data-return-package]");
  await page.waitForTimeout(300);

  results.afterReturn = await page.evaluate(() => {
    const shared = window.PaligoExamShared;
    return {
      phase: shared.getReviewWorkflow("submission-workflow-audit-1")?.phase,
      returned: shared.listReviewerSubmissionsByPhase("returned").length,
      active: shared.listActiveSubmissions().map((s) => s.id),
      readonly: document.querySelector("[data-review-actions]")?.classList.contains("is-disabled"),
      banner: !document.querySelector("[data-review-readonly-banner]")?.hidden,
    };
  });

  if (results.afterReturn.phase !== "returned") {
    errors.push(`return should mark returned, got ${results.afterReturn.phase}`);
  }
  if (results.afterReturn.active.includes("submission-workflow-audit-1")) {
    errors.push("returned submission still in active queue");
  }
  if (!results.afterReturn.readonly) {
    errors.push("review actions not disabled for returned submission");
  }

  await page.reload({ waitUntil: "networkidle" });

  results.afterSecondReload = await page.evaluate(() => {
    const shared = window.PaligoExamShared;
    return {
      waiting: shared.listReviewerSubmissionsByPhase("waiting_review").length,
      inReview: shared.listReviewerSubmissionsByPhase("in_review").length,
      returned: shared.listReviewerSubmissionsByPhase("returned").length,
      active: shared.listActiveSubmissions().map((s) => s.id),
    };
  });

  if (results.afterSecondReload.active.includes("submission-workflow-audit-1")) {
    errors.push("after refresh returned book back in active queue");
  }
  if (results.afterSecondReload.inReview > 0) {
    errors.push("returned book still in in_review after refresh");
  }
  if (results.afterSecondReload.returned < 1) {
    errors.push("returned tab empty after refresh");
  }

  const counts = await page.evaluate(() => {
    const badges = {};
    document.querySelectorAll("[data-wf-count]").forEach((el) => {
      badges[el.dataset.wfCount] = el.textContent;
    });
    return badges;
  });
  results.counts = counts;

  await browser.close();

  const pass = errors.length === 0;
  console.log(JSON.stringify({ results, errors, pass }, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});

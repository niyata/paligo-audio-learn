#!/usr/bin/env node
/**
 * Production-grade Inbox API loop audit.
 *
 * Requires Workers dev/preview API to be running:
 *   cd workers && npm run dev
 *
 * Optional:
 *   PALIGO_API_BASE=http://localhost:8788/v1 node scripts/audit-inbox-loop-api.mjs
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const apiBase = (process.env.PALIGO_API_BASE || "http://localhost:8788/v1").replace(/\/$/, "");
const reportDir = path.resolve("docs/audit/inbox-loop-api");
const reportPath = path.join(reportDir, "report.json");
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const report = {
  schema: "paligo.audit.inboxLoopApi.v1",
  apiBase,
  startedAt: new Date().toISOString(),
  status: "running",
  steps: [],
  assertions: [],
};

function pushStep(name, detail = {}) {
  report.steps.push({
    name,
    at: new Date().toISOString(),
    ...detail,
  });
}

function assert(condition, message, detail = {}) {
  const assertion = {
    message,
    passed: Boolean(condition),
    detail,
  };
  report.assertions.push(assertion);
  if (!assertion.passed) {
    const error = new Error(message);
    error.detail = detail;
    throw error;
  }
}

async function saveReport(status, error = null) {
  report.status = status;
  report.finishedAt = new Date().toISOString();
  if (error) {
    report.error = {
      message: error.message,
      detail: error.detail || null,
    };
  }
  await mkdir(reportDir, { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function requestJson(pathname, options = {}) {
  const {
    method = "GET",
    token = "",
    body,
    expectedStatus = 200,
    allowStatus = [],
  } = options;
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (body !== undefined) headers.set("Content-Type", "application/json");

  let response;
  try {
    response = await fetch(`${apiBase}${pathname}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(
      `ต่อ Inbox API ไม่ได้ที่ ${apiBase} — ต้องรัน 'cd workers && npm run dev' ก่อน (${error.message})`
    );
  }

  const text = await response.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }

  const accepted = [expectedStatus, ...allowStatus].includes(response.status);
  if (!accepted) {
    const error = new Error(`${method} ${pathname} expected ${expectedStatus}, got ${response.status}`);
    error.detail = { status: response.status, body: json };
    throw error;
  }

  return {
    status: response.status,
    json,
  };
}

function avatarData(label, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="28" fill="${color}"/><text x="48" y="58" text-anchor="middle" font-family="Arial" font-size="34" font-weight="700" fill="#fff">${label}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function makeTransfer({ direction, bookId, submissionId, reviewId = null }) {
  const base = {
    schema: "paligo.exam.bookTransfer.v1",
    direction,
    transferredAt: new Date().toISOString(),
    book: {
      id: bookId,
      title: "สมุด audit inbox loop",
      subject: "แปลมคธเป็นไทย",
      grade: "ป.ธ. ๔",
      revision: 1,
    },
    submission: {
      schema: "paligo.exam.submission.v1",
      id: submissionId,
      bookId,
      bookRevision: 1,
      bookTitle: "สมุด audit inbox loop",
      subject: "แปลมคธเป็นไทย",
      grade: "ป.ธ. ๔",
      answerHash: `hash-${stamp}`,
      pages: [
        {
          index: 0,
          text: "พุทฺโธ โย มงฺคลตฺถีนํ มงฺคลํ อิติ วิสฺสุโต",
        },
      ],
      profile: {
        displayName: "สามเณร Audit",
        avatarUrl: avatarData("ส", "#243199"),
      },
    },
  };

  if (direction === "to-student") {
    base.book.status = "reviewed";
    base.review = {
      schema: "paligo.exam.review.v1",
      id: reviewId,
      bookId,
      submissionId,
      bookTitle: "สมุด audit inbox loop",
      subject: "แปลมคธเป็นไทย",
      grade: "ป.ธ. ๔",
      scoreStamps: [{ page: 1, line: 1, value: 2 }],
      errorStamps: [],
      score: { earned: 2, max: 3, percent: 66.7 },
      reviewedAt: new Date().toISOString(),
    };
  }

  return base;
}

async function main() {
  const studentEmail = `student-loop-${stamp}@paligo.test`;
  const reviewerEmail = `reviewer-loop-${stamp}@paligo.test`;
  const bookId = `book-loop-${stamp}`;
  const submissionId = `sub-loop-${stamp}`;
  const reviewId = `review-loop-${stamp}`;

  pushStep("health");
  const health = await requestJson("/health");
  assert(health.json?.ok === true, "Inbox API health must be ok", health.json);

  pushStep("register reviewer", { email: reviewerEmail });
  const reviewer = await requestJson("/auth/register", {
    method: "POST",
    expectedStatus: 201,
    body: {
      role: "reviewer",
      displayName: "ครู Audit",
      email: reviewerEmail,
      pin: "222222",
      profileJson: {
        avatarUrl: avatarData("คร", "#243199"),
        honorific: "พระอาจารย์",
      },
    },
  });
  const reviewerToken = reviewer.json?.sessionToken;
  assert(Boolean(reviewerToken), "Reviewer registration returns session token");

  pushStep("register student", { email: studentEmail });
  const student = await requestJson("/auth/register", {
    method: "POST",
    expectedStatus: 201,
    body: {
      role: "student",
      displayName: "สามเณร Audit",
      email: studentEmail,
      pin: "111111",
      profileJson: {
        avatarUrl: avatarData("ส", "#f5b700"),
      },
    },
  });
  const studentToken = student.json?.sessionToken;
  assert(Boolean(studentToken), "Student registration returns session token");

  pushStep("reviewer creates invite");
  const invite = await requestJson("/pairings/invite", {
    method: "POST",
    token: reviewerToken,
    expectedStatus: 201,
    allowStatus: [200],
  });
  const inviteCode = invite.json?.inviteCode;
  assert(typeof inviteCode === "string" && inviteCode.length >= 6, "Reviewer invite code is available", invite.json);

  pushStep("student joins pairing", { inviteCode });
  const pairing = await requestJson("/pairings/join", {
    method: "POST",
    token: studentToken,
    body: { inviteCode },
    expectedStatus: 201,
    allowStatus: [200],
  });
  assert(Boolean(pairing.json?.reviewerUserId), "Student pairing returns reviewer user id", pairing.json);

  pushStep("student pushes book to reviewer", { bookId });
  const toReviewer = await requestJson("/packages", {
    method: "POST",
    token: studentToken,
    body: makeTransfer({ direction: "to-reviewer", bookId, submissionId }),
    expectedStatus: 201,
  });
  const reviewerInboxId = toReviewer.json?.inboxItemId;
  assert(Boolean(reviewerInboxId), "Push to reviewer returns inbox item id", toReviewer.json);

  pushStep("reviewer lists pending inbox");
  const reviewerInbox = await requestJson("/inbox", {
    token: reviewerToken,
  });
  const pendingReviewerItem = reviewerInbox.json?.items?.find((item) => item.id === reviewerInboxId);
  assert(Boolean(pendingReviewerItem), "Reviewer sees student submission in inbox", reviewerInbox.json);
  assert(pendingReviewerItem?.direction === "to-reviewer", "Reviewer inbox item direction is to-reviewer", pendingReviewerItem);
  assert(Boolean(pendingReviewerItem?.fromAvatarUrl), "Reviewer inbox item includes sender avatar", pendingReviewerItem);

  pushStep("student cannot claim reviewer inbox item", { inboxItemId: reviewerInboxId });
  const studentWrongClaim = await requestJson(`/inbox/${reviewerInboxId}/claim`, {
    method: "POST",
    token: studentToken,
    expectedStatus: 403,
  });
  assert(studentWrongClaim.status === 403, "Student claim of to-reviewer inbox is forbidden", studentWrongClaim.json);

  pushStep("reviewer claims student submission", { inboxItemId: reviewerInboxId });
  const claimedSubmission = await requestJson(`/inbox/${reviewerInboxId}/claim`, {
    method: "POST",
    token: reviewerToken,
  });
  assert(claimedSubmission.json?.bookTransfer?.direction === "to-reviewer", "Reviewer claim returns to-reviewer transfer");
  assert(claimedSubmission.json?.bookTransfer?.book?.id === bookId, "Reviewer claim returns expected book id");
  assert(Boolean(claimedSubmission.json?.fromAvatarUrl), "Reviewer claim includes sender avatar");

  pushStep("reviewer pushes result to student", { bookId });
  const toStudent = await requestJson("/packages", {
    method: "POST",
    token: reviewerToken,
    body: makeTransfer({ direction: "to-student", bookId, submissionId, reviewId }),
    expectedStatus: 201,
  });
  const studentInboxId = toStudent.json?.inboxItemId;
  assert(Boolean(studentInboxId), "Push to student returns inbox item id", toStudent.json);

  pushStep("student lists pending result");
  const studentInbox = await requestJson("/inbox", {
    token: studentToken,
  });
  const pendingStudentItem = studentInbox.json?.items?.find((item) => item.id === studentInboxId);
  assert(Boolean(pendingStudentItem), "Student sees reviewed result in inbox", studentInbox.json);
  assert(pendingStudentItem?.direction === "to-student", "Student inbox item direction is to-student", pendingStudentItem);
  assert(Boolean(pendingStudentItem?.fromAvatarUrl), "Student result item includes reviewer avatar", pendingStudentItem);

  pushStep("reviewer cannot claim student inbox item", { inboxItemId: studentInboxId });
  const reviewerWrongClaim = await requestJson(`/inbox/${studentInboxId}/claim`, {
    method: "POST",
    token: reviewerToken,
    expectedStatus: 403,
  });
  assert(reviewerWrongClaim.status === 403, "Reviewer claim of to-student inbox is forbidden", reviewerWrongClaim.json);

  pushStep("student claims reviewed result", { inboxItemId: studentInboxId });
  const claimedResult = await requestJson(`/inbox/${studentInboxId}/claim`, {
    method: "POST",
    token: studentToken,
  });
  assert(claimedResult.json?.bookTransfer?.direction === "to-student", "Student claim returns to-student transfer");
  assert(claimedResult.json?.bookTransfer?.review?.score?.earned === 2, "Student result includes review score");
  assert(claimedResult.json?.bookTransfer?.book?.status === "reviewed", "Returned book status is reviewed");

  pushStep("student inbox item disappears after claim");
  const studentInboxAfterClaim = await requestJson("/inbox", {
    token: studentToken,
  });
  const stillPending = studentInboxAfterClaim.json?.items?.some((item) => item.id === studentInboxId);
  assert(stillPending === false, "Claimed result is no longer pending in student inbox", studentInboxAfterClaim.json);

  await saveReport("passed");
  console.log(`✓ Inbox loop API audit passed: ${reportPath}`);
}

main().catch(async (error) => {
  await saveReport("failed", error);
  console.error(`✗ Inbox loop API audit failed: ${error.message}`);
  console.error(`  report: ${reportPath}`);
  process.exitCode = 1;
});

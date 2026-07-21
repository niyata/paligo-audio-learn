/**
 * Production hardening contract tests for app-state and API errors.
 *
 * Run:
 *   node scripts/test-production-contracts.mjs
 */
import assert from "node:assert/strict";

import { buildAppState } from "../workers/src/db.js";
import { canonicalErrorCode, errorResponse } from "../workers/src/http.js";

const student = { id: "student-1", role: "student", displayName: "สามเณรทดสอบ" };
const reviewer = { id: "reviewer-1", role: "reviewer", displayName: "ครูทดสอบ" };
const superAdmin = { id: "admin-1", role: "student", isSuperAdmin: true };

assert.equal(buildAppState(null).appState, "guest");

const noPairing = buildAppState(student);
assert.equal(noPairing.appState, "logged_in_no_pairing");
assert.equal(noPairing.capabilities.needsPairing, true);
assert.equal(noPairing.capabilities.canOpenInbox, false);

const readyStudent = buildAppState(student, { pairing: { pairingId: "pairing-1" } });
assert.equal(readyStudent.appState, "ready_student");
assert.equal(readyStudent.capabilities.canOpenInbox, true);
assert.equal(readyStudent.capabilities.needsPairing, false);

const trialReviewer = buildAppState(reviewer, {
  students: [{ studentUserId: "virtual-student:onboarding", isVirtual: true }],
});
assert.equal(trialReviewer.appState, "ready_reviewer_trial");
assert.equal(trialReviewer.capabilities.hasVirtualStudent, true);
assert.equal(trialReviewer.capabilities.hasRealStudents, false);

const readyReviewer = buildAppState(reviewer, {
  students: [{ studentUserId: "student-real", isVirtual: false }],
});
assert.equal(readyReviewer.appState, "ready_reviewer");
assert.equal(readyReviewer.capabilities.hasRealStudents, true);

const adminState = buildAppState(superAdmin);
assert.equal(adminState.appState, "super_admin");
assert.equal(adminState.capabilities.isSuperAdmin, true);

assert.equal(canonicalErrorCode("not_authenticated"), "NOT_AUTHENTICATED");
assert.equal(canonicalErrorCode("invalid_pin"), "INVALID_INPUT");
assert.equal(canonicalErrorCode("PERMISSION_DENIED"), "PERMISSION_DENIED");
assert.equal(canonicalErrorCode("custom-error"), "CUSTOM_ERROR");

const request = new Request("https://api.paligo.jp/v1/test", {
  headers: { Origin: "https://app.paligo.jp" },
});
const response = errorResponse(request, "no_pairing", "ยังไม่ได้จับคู่ครู", 409);
const payload = await response.json();
assert.equal(response.status, 409);
assert.equal(payload.error, "no_pairing");
assert.equal(payload.code, "NO_PAIRING");
assert.equal(payload.message, "ยังไม่ได้จับคู่ครู");

console.log("Production contracts passed");

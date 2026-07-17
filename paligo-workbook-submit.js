/**
 * paligo-workbook-submit.js — app-grade facade over paligo-exam-submit.js
 *
 * Namespace Slice 4 (docs/url-naming-refactor-plan.md) — Issue #90.
 *
 * Canonical going forward: `PaligoWorkbookSubmit` (this alias).
 * Legacy / current source of truth: `PaligoExamSubmit` (paligo-exam-submit.js) —
 * still owns all submit-gate logic. This file adds NO new behavior; it only
 * re-exposes the existing module under the app-grade name.
 *
 * PO decision (2026-07-17): schema/localStorage names stay `paligo.exam.*`
 * until a later major migration — do not rename keys here.
 *
 * Load order: this script must load AFTER paligo-exam-submit.js.
 */
(function () {
  if (typeof window === "undefined") return;

  if (!window.PaligoExamSubmit) {
    console.warn(
      "[paligo-workbook-submit] window.PaligoExamSubmit not found — " +
        "load paligo-exam-submit.js before paligo-workbook-submit.js."
    );
    return;
  }

  window.PaligoWorkbookSubmit = window.PaligoExamSubmit;
})();

/**
 * paligo-workbook-shared.js — app-grade facade over paligo-exam-shared.js
 *
 * Namespace Slice 4 (docs/url-naming-refactor-plan.md) — Issue #90.
 *
 * Canonical going forward: `PaligoWorkbookShared` (this alias).
 * Legacy / current source of truth: `PaligoExamShared` (paligo-exam-shared.js) —
 * still owns all logic, storage keys, and schema. This file adds NO new
 * behavior; it only re-exposes the existing module under the app-grade name
 * so future workbook/book code can depend on a name that isn't "exam".
 *
 * PO decision (2026-07-17): schema/localStorage names stay `paligo.exam.*`
 * until a later major migration — do not rename keys here or anywhere else
 * as part of this facade.
 *
 * Load order: this script must load AFTER paligo-exam-shared.js.
 */
(function () {
  if (typeof window === "undefined") return;

  if (!window.PaligoExamShared) {
    console.warn(
      "[paligo-workbook-shared] window.PaligoExamShared not found — " +
        "load paligo-exam-shared.js before paligo-workbook-shared.js."
    );
    return;
  }

  window.PaligoWorkbookShared = window.PaligoExamShared;
})();

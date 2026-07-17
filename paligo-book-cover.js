/**
 * paligo-book-cover.js — app-grade facade over paligo-exam-book-cover.js
 *
 * Namespace Slice 4 (docs/url-naming-refactor-plan.md) — Issue #90.
 *
 * Canonical going forward: `PaligoBookCover` (this alias).
 * Legacy / current source of truth: `PaligoExamBookCover`
 * (paligo-exam-book-cover.js) — still owns all cover-rendering logic. This
 * file adds NO new behavior; it only re-exposes the existing module under
 * the app-grade name ("book" is broader than "exam" per the naming policy).
 *
 * PO decision (2026-07-17): schema/localStorage names stay `paligo.exam.*`
 * until a later major migration — do not rename keys here.
 *
 * Load order: this script must load AFTER paligo-exam-book-cover.js.
 */
(function () {
  if (typeof window === "undefined") return;

  if (!window.PaligoExamBookCover) {
    console.warn(
      "[paligo-book-cover] window.PaligoExamBookCover not found — " +
        "load paligo-exam-book-cover.js before paligo-book-cover.js."
    );
    return;
  }

  window.PaligoBookCover = window.PaligoExamBookCover;
})();

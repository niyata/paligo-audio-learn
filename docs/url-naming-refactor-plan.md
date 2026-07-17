# Paligo URL & Namespace Refactor Plan

Status: draft policy for upcoming refactors

## Goal

Paligo is growing from an exam-only web flow into a learning app. File names,
URLs, and module prefixes should describe the product domain, not early
implementation details.

This plan keeps current production flows safe while moving toward cleaner URLs.

## Naming Taxonomy

Use these prefixes by domain:

| Prefix | Use for | Avoid using for |
| --- | --- | --- |
| `exam-*` | Exam-specific review workflow, grading, submissions, leaderboard | General chat, account, lesson, textbook reading |
| `workbook-*` | Student answer books, practice books, editable notebooks | App-wide shell, auth, inbox |
| `book-*` | Generic book/card rendering, cover UI, library surfaces | Review-only behavior |
| `inbox-*` | Chat, message threads, contacts, groups, attachments | Exam submission internals |
| `learn-*` / `study-*` | Lessons, practice, textbook learning, audio-assisted study | Review queue or grading |
| `account-*` / `profile-*` | User identity, login, profile, role setup | Exam-specific settings |
| `admin-*` | System/admin control surfaces | User-facing learning flows |

## Terminology & Code Abbreviations

Paligo code should prefer domain terms that are readable to engineers who do
not know Thai classroom shorthand.

| Concept | User-facing Thai | Preferred code term | Avoid in new code |
| --- | --- | --- | --- |
| หน่วยข้อ / ตอนย่อยของตำรา | ข้อ | `episode`, `ep` | `kho`, `khoNo`, `khoLabel` |

Rules:

1. Use `episode` for schema fields, function names, data model names, and
   comments where clarity matters.
2. Use `ep` only for compact IDs, route/query params, CSS hooks, or generated
   item ids where brevity is important.
3. Keep visible UI copy as Thai (`ข้อ`) when that is what the learner expects.
   The naming rule is for code and data contracts, not user-facing text.
4. Treat existing `kho*` names as legacy compatibility until a focused
   migration slice exists. Do not rename persisted localStorage keys or corpus
   JSON fields without a migration plan.
5. When touching old code, new aliases should read from both names during the
   transition, for example `episodeNo ?? khoNo`.

## URL Direction

Short term static URLs can stay `.html`, but new aliases should be meaningful:

| Current | Preferred alias | Reason |
| --- | --- | --- |
| `ruled-lines-card-only-template.html` | `workbook.html` | The page is the production workbook/answer-book surface; ruled lines are implementation detail |
| `exam-books.html` | `workbooks.html` | Library of answer/practice books, not only exams |
| `exam-inbox.html` | `inbox.html` | Chat/inbox should not be scoped to exam |
| `exam-account.html` | `account.html` | Account is app-wide |
| `exam-profile.html` | `profile.html` | Profile is app-wide |
| `exam-reviewer-console.html` | `review-console.html` | Review is broader than exam but still review workflow |
| `exam-review-results.html` | `review-results.html` | Results belong to review workflow |
| `exam-leaderboard.html` | `leaderboard.html` | Leaderboard can later include learning activity |
| `exam-super-admin.html` | `admin.html` | Admin is app-wide |

`exam-editor.html` is acceptable if the surface remains strictly exam-only, but
`workbook-editor.html` is the better app-grade name for Paligo’s likely future.

## Refactor Rules

1. Do not rename a production file without adding a compatibility path or
   redirect first.
2. Update links in `paligo-nav-config.js`, page anchors, docs, and audit scripts
   in the same migration slice.
3. Keep localStorage keys stable during URL refactors unless there is an
   explicit data migration plan. Keys like `paligo-exam-answer-books-v1` are
   persistence contracts, not just naming.
4. Keep `paligo-exam-*` modules temporarily when they own the current schema.
   Introduce app-grade aliases only after tests prove the old import path still
   works.
5. Prefer additive aliases before destructive renames:
   - create/serve new URL
   - update navigation to new URL
   - keep old URL working
   - update internal references gradually
   - remove old URL only in a later cleanup release
6. For CSS variables such as `--paligo-exam-blue`, rename only when the design
   token itself is app-wide. Until then, treat it as a legacy token.

## Suggested Migration Slices

### Slice 1 — Routing Aliases

- Add `workbook-editor.html` as the canonical editor route.
- Keep `ruled-lines-card-only-template.html` as a legacy backup/compatibility route.
- Update navigation to point to `workbook-editor.html`.

### Slice 2 — Inbox Alias

- Add `inbox.html` as canonical app inbox route.
- Keep `exam-inbox.html` as compatibility.
- Move new production-grade contact/thread UI under inbox naming.

Status 2026-07-12: first compatibility slice started.

- Added `inbox.html` as an app-grade entry route that forwards to the existing
  `exam-inbox.html` implementation while preserving query string and hash.
- Updated `paligo-nav-config.js` menu links to point at `inbox.html`.
- Kept `exam-inbox.html` in the page registry so legacy/direct links remain
  recognized.
- Did not rename the implementation file because the working tree is dirty and
  many direct references still exist in pages, docs, and audit scripts.

### Slice 3 — Account/Profile Aliases

- Add `account.html` and `profile.html`.
- Keep `exam-account.html` and `exam-profile.html`.
- Update topbar/sidebar links.

### Slice 4 — Module Names

- Introduce app-grade facades:
  - `paligo-workbook-shared.js` wraps current `paligo-exam-shared.js`
  - `paligo-workbook-submit.js` wraps current `paligo-exam-submit.js`
  - `paligo-book-cover.js` wraps current `paligo-exam-book-cover.js`
- Migrate call sites only after compatibility is verified.

Status 2026-07-17: facade files added (Issue #90).

- Added `paligo-workbook-shared.js`, `paligo-workbook-submit.js`,
  `paligo-book-cover.js` as pure alias wrappers (`window.PaligoWorkbookShared
  = window.PaligoExamShared`, etc.) — no logic duplicated or changed.
- Not wired into any HTML page yet — no `<script>` tag added anywhere, so no
  existing page load order or behavior changes. This is intentionally
  additive-only; call-site migration is a separate, later slice.
- `paligo-exam-shared.js`, `paligo-exam-submit.js`, `paligo-exam-book-cover.js`,
  `paligo-exam-paper.js` untouched.
- PO decision recorded: schema/localStorage names remain `paligo.exam.*`
  until a later major migration; these facades alias module/global names only.

### Slice 5 — Storage/Data Migration

- Decide whether storage keys should remain legacy forever or move to
  `paligo-workbook-*`.
- If moving, write one-time migration with backup and rollback path.

## Current Decision

Use `exam-*` only when the feature is truly exam/review specific. Use
`workbook-*`, `book-*`, `inbox-*`, `learn-*`, and app-wide names for everything
else.

Do not perform a broad rename while the working tree is dirty. Each migration
slice should have its own focused diff and validation checklist.

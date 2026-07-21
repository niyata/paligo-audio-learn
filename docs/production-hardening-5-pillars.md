# Paligo Production Hardening — 5 Pillars

Status: current hardening slice complete

Last updated: 2026-07-21

This document is the shared source of truth for the five hardening tasks that move
Paligo from late prototype toward production grade.

## Progress Matrix

| Pillar | Status | Current evidence | Next closure work |
| --- | --- | --- | --- |
| 1. Auth / Session / Pairing State | Complete (current slice) | `GET /v1/me` exposes `appState`/`capabilities`; inbox/account/books gates now consume the shared state instead of forcing page-specific login loops | Add authenticated E2E against `api.paligo.jp` after production credentials are finalized |
| 2. First-Run Onboarding Fallbacks | Complete (current slice) | Student no-pairing and reviewer virtual-trial states have explicit CTAs; visual smoke now covers the no-pairing account path | Replace remaining mock/virtual onboarding copy with D1-backed invite telemetry |
| 3. Visual Smoke Regression | Complete (current slice) | `scripts/audit-production-critical-pages.mjs` now asserts first-run CTA behavior plus PiP click lookup vs selection annotation behavior | Run full visual smoke before each production-candidate deploy and add mobile viewport coverage |
| 4. Backend Contract And Error Codes | Complete (current slice) | `scripts/test-production-contracts.mjs` verifies canonical app states and error-code payloads | Expand contract tests to every mutating Workers endpoint when inbox D1 schema stabilizes |
| 5. Deployment Discipline | Complete (current slice) | `docs/deploy-production-checklist.md`, `scripts/check-deploy-discipline.mjs`, and `.github/workflows/production-hardening.yml` cover pre-launch gates | Add real Cloudflare Pages deployment status checks once branch mapping is finalized |

Rule for every hardening pass:

- Work one pillar at a time.
- Update this matrix whenever a pillar changes status.
- Commit and push the document with the related code or script change.
- Do not stage unrelated dirty-tree artifacts from other agents.

## 1. Auth / Session / Pairing State

Issue: #99

All user-facing pages should derive login and onboarding state from one app-state
contract instead of inferring from role checks alone.

Canonical states:

- `guest` — no valid session.
- `logged_in_no_pairing` — student is logged in but has no active teacher pairing.
- `ready_student` — student can use books and inbox.
- `ready_reviewer` — reviewer has real students.
- `ready_reviewer_trial` — reviewer has only the virtual trial student.
- `super_admin` — super admin can access gated admin surfaces.
- `feature_disabled` — authenticated, but inbox/platform feature is disabled.
- `logged_in_offline` — cached session is available while API is offline.

Frontend source:

- `PaligoInboxClient.buildAppState(...)`
- `PaligoInboxClient.getAppState(...)`

Backend source:

- `GET /v1/me`
- `PATCH /v1/me`

Live readiness:

- `scripts/audit-live-api-readiness.mjs` checks `https://api.paligo.jp/v1`
  health, CORS, unauthenticated error contracts, and optional login `/me`
  contracts when credential environment variables are present.

Backend responses keep existing fields and add:

```json
{
  "appState": "ready_student",
  "capabilities": {
    "canUseInbox": true,
    "canOpenInbox": true,
    "canCreateInvite": false,
    "canJoinPairing": true,
    "needsPairing": false,
    "hasVirtualStudent": false
  }
}
```

## 2. First-Run Onboarding Fallbacks

Issue: #98

New users must never dead-end after signup.

- New students without a real teacher must see a pairing CTA, not a login CTA.
- New reviewers without real students get a virtual trial student.
- Virtual users must be visibly labeled as trial data.

Implementation notes:

- `exam-inbox.html` shows a pairing CTA for `logged_in_no_pairing` instead of
  forcing another login.
- `exam-account.html` labels `ready_reviewer_trial` and points reviewers to
  trial inbox workflow until they have real students.

## 3. Visual Smoke Regression

Issue: #101

Critical pages need screenshot smoke checks before deploy:

- `exam-books.html`
- `workbook.html`
- `exam-inbox.html`
- `exam-account.html`
- `exam-profile.html`
- `pali-reference-pip.html`

Required checks include visible book-cover avatar, inbox group creation, compact
composer buttons, working profile/inbox topbar, unclipped PiP tooltip, and stable
annotation footer tools.

Implementation notes:

- Run `node scripts/audit-production-critical-pages.mjs` while the static server
  is available at `http://127.0.0.1:8765`.
- The script opens Chrome and writes screenshots/report to
  `docs/audit/production-critical-pages/`.
- Generated audit artifacts are ignored by git; commit them only when a human
  asks for a visual evidence bundle.

## 4. Backend Contract And Error Codes

Issue: #102

Workers should return stable machine-readable codes and capabilities. UI copy can
change, but clients should branch on codes/states.

Preferred canonical error codes:

- `NOT_AUTHENTICATED`
- `SESSION_EXPIRED`
- `NO_PAIRING`
- `FEATURE_DISABLED`
- `PERMISSION_DENIED`
- `API_OFFLINE`
- `INVALID_INPUT`

During migration, existing lowercase codes may continue to appear; new client
logic should normalize codes before branching.

Implementation notes:

- `workers/src/http.js` owns server-side `canonicalErrorCode(...)`.
- Error responses now include both `error` (legacy lowercase) and `code`
  (canonical uppercase).
- `paligo-inbox-client.js` owns `normalizeErrorCode(...)` and attaches
  `error.code` / `error.legacyCode` to thrown API errors.

## 5. Deployment Discipline

Issue: #100

Until launch:

- `paligo.pages.dev` is staging / temporary test surface.
- `app.paligo.jp` is production candidate.
- Pages should default to `noindex,nofollow` unless super admin allows indexing.
- Deploys must run `git diff --check`, syntax checks, and dirty-tree review.
- Do not include audit screenshots or large media files in deploy archives.

Implementation notes:

- Use `docs/deploy-production-checklist.md` as the human release checklist.
- Run `node scripts/check-deploy-discipline.mjs` before production-candidate
  deploys.
- `_headers` and `robots.txt` remain locked to noindex/disallow during pre-launch.

## Multi-Agent Rule

If the working tree contains unrelated changes, preserve them and claim only the
files required for the current issue. Dirty tree cleanup and mixed release slices
belong to `agent:integrator`.

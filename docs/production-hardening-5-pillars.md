# Paligo Production Hardening — 5 Pillars

Status: pre-production hardening

Last updated: 2026-07-21

This document is the shared source of truth for the five hardening tasks that move
Paligo from late prototype toward production grade.

## Progress Matrix

| Pillar | Status | Current evidence | Next closure work |
| --- | --- | --- | --- |
| 1. Auth / Session / Pairing State | In Progress | `workers/src/auth.js` returns `/v1/me`; `paligo-inbox-client.js` stores sessions; UI still has page-specific gates | Add shared `appState`/`capabilities` contract in backend and client; update inbox/account/books gates to read it |
| 2. First-Run Onboarding Fallbacks | In Progress | Reviewer virtual trial student exists and is labeled; account/inbox gates now show pairing or trial CTAs from `appState` | Extend visual smoke to assert these first-run states and add equivalent copy to any remaining entry pages |
| 3. Visual Smoke Regression | In Progress | `scripts/audit-production-critical-pages.mjs` covers critical page selectors and screenshots | Track the script, run it before deploy, and keep generated screenshots out of routine commits unless requested |
| 4. Backend Contract And Error Codes | Not Started | Existing API returns lowercase `error` values such as `not_authenticated` and `no_pairing` | Normalize canonical error codes server/client-side while keeping legacy values compatible |
| 5. Deployment Discipline | In Progress | Branch push and `git diff --check` are used manually; privacy gate doc exists | Add repeatable deploy checklist/noindex verification and ensure audit artifacts are excluded from deploy commits |

Rule for this hardening pass:

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

## 5. Deployment Discipline

Issue: #100

Until launch:

- `paligo.pages.dev` is staging / temporary test surface.
- `app.paligo.jp` is production candidate.
- Pages should default to `noindex,nofollow` unless super admin allows indexing.
- Deploys must run `git diff --check`, syntax checks, and dirty-tree review.
- Do not include audit screenshots or large media files in deploy archives.

## Multi-Agent Rule

If the working tree contains unrelated changes, preserve them and claim only the
files required for the current issue. Dirty tree cleanup and mixed release slices
belong to `agent:integrator`.

# Claude Worklog

Session log ที่ Claude (Cowork) ใช้เอง เพื่อทำงานร่วมกับ **Cursor** และ **Codex** ใน repo นี้ตาม
[`SCRUM-WORKFLOW.md`](./SCRUM-WORKFLOW.md) และ [`AGENT-HANDOFF.md`](./AGENT-HANDOFF.md)

**Board:** [Paligo — Scrum Board](https://github.com/users/niyata/projects/14)
**Agent label:** ยังไม่มี `agent:claude-ai` แยกในบอร์ด — ใช้ `agent:other-ai` จนกว่า PO จะเพิ่ม label ใหม่

---

## วิธีใช้ (สำหรับ Claude เอง — อ่านทุก session)

**ก่อนเริ่มงาน:**
1. เปิด [Scrum Board](https://github.com/users/niyata/projects/14) เช็ค column ปัจจุบัน — อย่าจับ issue ที่คนอื่น (Cursor/Codex) กำลัง In Progress
2. อ่าน entry ล่าสุดใน "Session log" ด้านล่าง — ดูว่า session ก่อนหน้าค้างอะไรไว้
3. ถ้า issue เกี่ยว `area:exam` อ่าน `docs/exam-flow-ux-audit.md`; ถ้าเกี่ยว inbox อ่าน `docs/agile/inbox-sprint-backlog.md`; ถ้าเกี่ยว Cloud Code/PALI-AI อ่าน `docs/pali-ai/CLOUD-CODE-ALIGNMENT.md`

**ระหว่างทำงาน:**
- ย้าย issue → In Progress, comment `Starting: …` (ตาม AGENT-HANDOFF.md)
- ไม่ commit/push เว้นแต่ user ขอ

**จบ session:**
- เพิ่มแถวใหม่ใน "Session log" ด้านล่าง (บนสุด = ล่าสุด)
- ถ้าส่งต่องานให้ agent อื่น ใส่ comment `## Handoff` บน issue ตาม template ใน AGENT-HANDOFF.md
- ถ้า user ขอ commit ให้ทำ; ถ้าไม่ขอ ให้สรุปไว้ในนี้พอ

---

## Session log

<!-- แถวใหม่ล่าสุดไว้บนสุด -->

| Date | Issues touched | Status | Summary | Handoff / next |
|------|-----------------|--------|---------|-----------------|
| 2026-07-20 | [#103](https://github.com/niyata/paligo-audio-learn/issues/103) | in-progress | Ghost suggestion MVP (ทม × PiP): PRD `docs/ghost-suggestion-prd.md`; branch `feat/ghost-suggestion-thai-to-pali`; PiP context postMessage + `paligo-ghost-suggestion.js` + workbook dropdown for thai-to-pali from pali-rtf answer tokens. Did **not** touch unrelated dirty tree (audit pngs / other WIP). | Smoke: PiP page ๓ · type `มโนปุพ` → `มโนปุพฺพงฺคมา`; confirm pali-to-thai / annotation unaffected; open PR when PO asks |
| 2026-07-17 | — | handoff | Prepared status handoff for Claude Code CLI. `main`==`new-dev`==`cc99685` (PR #90/#95/#96/#97 chain all merged). Found local checkout on `fix/issue-59-tab-space-indent` is messy: exam-account.html/exam-inbox.html diffs are stale-branch noise (0 diff vs origin/main), but **`exam-profile.html` has real 85-line uncommitted WIP (profile save → server sync UX) — not mine, do not discard.** `chakkhupala.mp3` still modified (LFS pointer vs 75MB real file, unresolved). 11 orphaned audit screenshots (onboarding-390, profile-77/78/79) still untracked, unverified provenance. Leftover untracked/staged files (paligo-workbook-*.js, paligo-book-cover.js, docs/shared-annotation-plugin-prd.md, docs/url-naming-refactor-plan.md) are safe to ignore — already merged upstream via a different branch lineage | Told user: whoever picks this up should `git checkout main && git pull` for a clean base rather than fighting this branch's stale/mixed working tree. Did not touch exam-profile.html or chakkhupala.mp3 |
| 2026-07-17 | [#90](https://github.com/niyata/paligo-audio-learn/issues/90) → [PR #95](https://github.com/niyata/paligo-audio-learn/pull/95) merged (66a617f), issue auto-closed; integrator work → [PR #96](https://github.com/niyata/paligo-audio-learn/pull/96) merged (02d8842) | done | Both PRs merged into `new-dev`. Synced via [PR #97](https://github.com/niyata/paligo-audio-learn/pull/97) (merge commit `cc99685`) — `main` now matches `new-dev`. Both branches pushed by user from their machine (main had moved 1 commit — `11286aa Fix inbox auth return flow`, no file overlap, so pushed as normal branches instead of force-to-main). Opened both PRs against `new-dev` with full descriptions/test plans. Cursor/Codex out of tokens for the day — user asked me to take over Codex's handoff. Found #90 (Namespace Slice 4: module facade aliases) was the only real open agent:codex-ai work (issue #87 is an empty/malformed LINE-bot artifact, ignored). Asked PO the 2 blocking decisions on #90 (do it now vs wait for route aliases; keep paligo.exam.* schema names) — both resolved. Implemented: `paligo-workbook-shared.js`, `paligo-workbook-submit.js`, `paligo-book-cover.js` as pure alias wrappers, not wired into any HTML page. Updated `docs/url-naming-refactor-plan.md` Slice 4 status. Committed on branch `90-module-facade-aliases` (commit `b3f3880`, based on main @ `3a63f68`) via git plumbing (same HEAD.lock/index.lock workaround as before). Posted Handoff comment on #90 | Push blocked (no sandbox GitHub creds): user runs `git push origin 90-module-facade-aliases` then opens PR (Closes #90). Route-alias slices #91-93 remain for Cursor |
| 2026-07-17 | — | ready-for-review | Claimed dirty tree as Integrator. Reviewed uncommitted corpus/PDF-converter/audit files, split into 3 commits on branch `paligo-integrator-work` (based on origin/main 3a63f68): (1) `75d1161` bilingual Dhammapada corpus tooling/data, (2) `0154d4f` shared annotation plugin PRD, (3) `9b07709` missing audit screenshots for 3 already-committed audit reports. `git diff --check` clean across full range; all touched JSON validated (`json.load`); `pdf_to_book_html.py` + `build_dhammapada_bilingual_corpus.py` pass `py_compile`. **Excluded on purpose:** `chakkhupala.mp3` (working tree has full 75MB audio replacing the 133-byte Git LFS pointer in HEAD — git-lfs not available in this env, do not commit without it), `docs/audit/onboarding-390-*.png` + `profile-77/78/79*.png` (11 files, no matching report.json or script reference — provenance unverified), `docs/agile/CLAUDE-WORKLOG.md` itself (out of scope of the 3 requested buckets). **Note:** sandbox git had a stuck `.git/HEAD.lock`/`.git/index.lock` (FUSE mount unlink bug) — worked around via plumbing (`commit-tree`/`update-ref`/temp `GIT_INDEX_FILE`) instead of `git commit`/`git add`, real branch `fix/issue-59-tab-space-indent` only carries commit 1 as a side-effect | **Push blocked:** sandbox has no GitHub credentials. User must run `git push origin paligo-integrator-work:main` from their own machine. Confirmed safe: origin/main == origin/new-dev == base commit, no CI deploys on push, no Pages project connected yet |
| 2026-07-16 | Cursor #77–#80 + reviewer workflow + inbox sticky; Codex #86/#88–#93 + pali/ref/deploy | handoff | Combined Cursor↔Codex handoff for new chat. Dirty tree: `workbook.html` (Pali reference swap by grade/subject) + untracked `data/corpora/dhammapadatthakatha-pt4-book1/` + audit PNGs. Branch `fix/issue-59-tab-space-indent` @ `5f4508b`. Do **not** broad-commit; Integrator owns claim. | Paste `docs/agile/CLAUDE-WORKLOG.md` § Latest combined handoff into new Cursor/Codex chat; continue only on PO-chosen slice |
| 2026-07-12 | [#86](https://github.com/niyata/paligo-audio-learn/issues/86) | implementation | Started P0 Integrator slice for inbox naming compatibility. Added `inbox.html` as the app-grade inbox route forwarding to existing `exam-inbox.html`, updated `paligo-nav-config.js` menu links to use `inbox.html`, and recorded the Slice 2 status in `docs/url-naming-refactor-plan.md`. | Next: validate `inbox.html` locally and decide whether to update direct hardcoded page links in a second slice |
| 2026-07-12 | — | deployed | Locked LINE Issue Bot to the two `LINE_ALLOWED_USER_IDS` from `.dev.vars`: uploaded secrets with `wrangler secret bulk`, verified fake user receives `unauthorized`, verified one allowed user returns `menu`, and added LIFF profile gating so `/liff` disables controls for non-allowlisted users. Deployed Worker version `c662b42b-1cb4-403d-a0e0-300fa90e068d`; production `/liff` reports `liffRequiresAuth=true`. | Next: configure official LINE OA Rich Menu actions or add GitHub Project auto-add |
| 2026-07-11 | — | deployed | Upgraded `/liff` from a command picker into an AI workflow console: added Workflow process (Capture/Triage/Confirm/Execute), AI roles for Integrator/Codex/Cursor/Claude/Human, and command templates where the user edits only the task prompt before sending to LINE. Deployed Worker version `5be26ca2-ea17-47fa-bac3-06615531362a`; production `/liff` includes all new markers. | `LINE_ALLOWED_USER_IDS` still does not appear active on production; fake user `menu` smoke still returns `status:"menu"` |
| 2026-07-11 | — | deployed | Added LINE user allowlist support to Issue Bot. `LINE_ALLOWED_USER_IDS` now gates all effectful commands and postbacks when configured, while `whoami` remains available so a user can retrieve their LINE `userId`. Documented setup in `docs/line-issue-chatbot.md`. Deployed Worker version `c0ed0277-bd3e-46c2-bf6e-118cef9eeb87`; production smoke for `whoami` and `menu` returned 200. | `LINE_ALLOWED_USER_IDS` is not present in local `.dev.vars` yet, so production remains open until the owner userId is added as a secret |
| 2026-07-11 | — | deployed | Upgraded LINE Issue Bot UX toward rich-menu workflow: added chat command `menu` with an 8-button Flex menu, added `issues`/`status` to show recent issues created for the LINE user, records created issues in KV, and redesigned `/liff` as an 8-action mobile control panel instead of a single preset picker. Deployed Worker version `51c185bf-51fc-48e0-9d3a-1280d31f50fb`; signed production smoke for `menu`, `issues`, and `status` returned 200, and `/liff` renders the 8-button panel. | Optional next: create an official LINE OA Rich Menu image/action mapping that opens `/liff` and sends `menu`, `draft`, `issues` |
| 2026-07-11 | — | deployed | Clarified multi-repo usage for LINE Issue Bot: added in-chat `repos` command, expanded `help` text for `repo:<alias>`, and documented how to update `ISSUE_BOT_REPOS_JSON` when switching project/repo. Deployed Worker version `06b49644-d749-47b2-984c-49e07cf8a8aa`; signed production smoke for `help` and `repos` returned 200. | To add a new target repo, update `ISSUE_BOT_REPOS_JSON`, ensure `GITHUB_ISSUE_BOT_TOKEN` has Issues read/write for that repo, then bulk upload secrets |
| 2026-07-11 | — | verified | Fixed GitHub issue creation failure by replacing `GITHUB_ISSUE_BOT_TOKEN` secret with a token that has issue write access. Deployed Worker version `03ec594e-3db9-41bf-a51a-ab7fcdf93e61`. Production signed webhook E2E succeeded: draft created with `draftStored:true`, `confirm_issue:{draftId}` created GitHub issue #85, then smoke issue was closed. | Real LINE QA can proceed: send `/issue`, send image, confirm Flex card |
| 2026-07-11 | — | deployed | Hardened and deployed LINE Issue Bot version `c50bce4c-061d-41c0-aae7-2a5e2e215fcf`: added text commands `help`, `draft`, `cancel`; added GitHub create retry without labels when target repo rejects unknown labels, preserving suggested labels in issue body. Signed production smoke for `help` and `draft` returned 200. | Next real-world QA: enable LINE webhook in Developers console and send actual image + confirm Flex button |
| 2026-07-11 | — | deployed | Added and deployed production-grade media draft flow for LINE Issue Bot: created R2 bucket `line-issue-bot-assets`, KV namespace `LINE_ISSUE_DRAFTS`, added `/assets/*` serving, image message handling, LINE image download/storage, pending draft persistence, Flex confirmation cards, and postback handlers `confirm_issue:{draftId}` / `cancel_issue:{draftId}`. Deployed Worker version `fb1f8dd2-0a18-47c1-b9ae-9cb8c454437a`; `/health?t=storage` reports `drafts:true`, `assets:true`; signed webhook text smoke returned `draftStored:true`. | Test with real LINE image event after LINE webhook is enabled in LINE Developers |
| 2026-07-11 | — | deployed | Deployed standalone LINE Issue Bot Worker with Cloudflare Worker Custom Domain `chat.paligo.jp`. Wrangler reported deployment `ea687aaa-6ba0-4052-877e-fbbbbde5c74c`; Cloudflare DNS now returns A/AAAA/HTTPS records for `chat.paligo.jp`; `GET /health` and `GET /liff` work when resolving via Cloudflare DNS. | Set production secrets: `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `GITHUB_ISSUE_BOT_TOKEN`, `LINE_LIFF_ID`, `LINE_OA_ID`; then configure LINE webhook URL `https://chat.paligo.jp/webhook` |
| 2026-07-11 | — | implementation | Bound standalone LINE Issue Bot Worker config to Cloudflare route `chat.paligo.jp/*` and documented production LINE endpoints: webhook `https://chat.paligo.jp/webhook`, LIFF `https://chat.paligo.jp/liff`, health `https://chat.paligo.jp/health`. | Requires Cloudflare zone/DNS access and Wrangler secrets before actual deploy |
| 2026-07-11 | — | implementation | Added `GET /liff` to the standalone LINE Issue Bot worker. The LIFF page exposes a selectable preset for `/issue repo:paligo p:0 agent:integrator area:inbox refactor inbox naming และ compatibility route`, editable command text, `liff.sendMessages()`, copy fallback, and LINE OA deep link fallback. | Configure `LINE_LIFF_ID` and `LINE_OA_ID`; set the LIFF endpoint URL to the deployed `/liff` route |
| 2026-07-11 | — | implementation | Refactored LINE Issue Chatbot into portable monorepo shape: `packages/line-issue-bot-core` contains Paligo-free logic, `apps/line-issue-bot-worker` is a standalone Cloudflare Worker app, and `workers/src/line-issue-bot.js` remains a compatibility adapter for the Paligo API route. | Next: configure secrets in the standalone app and decide whether to remove the Paligo compatibility route after LINE OA points to `/webhook` |
| 2026-07-10 | — | implementation | Started LINE Issue Chatbot first production slice: `POST /v1/line/issues/webhook` verifies LINE signature, previews rule-based GitHub issue triage, and creates issues only with explicit `/issue create ... --yes` plus configured GitHub token. Added setup docs in `docs/line-issue-chatbot.md`. | Next: configure LINE OA webhook URL + secrets, then add optional GitHub Project v2 item insertion if board automation is insufficient |
| 2026-07-10 | — | workflow | PO approved adding **Paligo Integrator** role into workflow. Updated `SCRUM-WORKFLOW.md`, `AGENT-HANDOFF.md`, and `AGENTS.md` so dirty tree / abandoned files / broad rename / compatibility migration are claimed through Integrator instead of individual agents guessing ownership. Created GitHub label `agent:integrator` and added `docs/agile/PALIGO-INTEGRATOR.md` checklist. | Use Integrator Handoff template for cross-agent cleanup; Integrator still cannot delete/revert/merge without PO approval |
| 2026-07-10 | [#83](https://github.com/niyata/paligo-audio-learn/issues/83) | ready-for-review | User ถามว่ามี Cloudflare tunnel ทดสอบ `app.paligo.jp` หรือยัง — ตรวจแล้ว: **ยังไม่มี** deploy/Pages/DNS ใดๆ เกิดขึ้นจริง (`wrangler.jsonc` routes ยัง comment, ไม่มี Pages project, ไม่มี tunnel config). เตรียม code-level readiness: เพิ่ม `_headers` (cache rules), ยืนยัน CORS ใน `workers/src/http.js` และ `paligo-config.js` ถูกต้องแล้ว, เพิ่ม §7 "Code readiness" ใน `docs/deploy-cloudflare.md`. เปิด GitHub issue แจ้ง Cursor/Codex ให้รับทราบสถานะ + สิ่งที่ยังบล็อกอยู่ (ต้องคนมี Cloudflare Dashboard access ทำต่อ) | รอ PO/ผู้มี Cloudflare access ทำ: สร้าง Pages project, ผูก custom domain, DNS, แล้วค่อย uncomment wrangler routes — ไม่ใช่งาน code แล้ว |
| 2026-07-10 | — | research | User ถามว่าใช้ AI ตรวจข้อสอบผ่าน inbox ได้ไหม — ตรวจโค้ดจริง: inbox/`workers/src` เป็น human-to-human ล้วน ไม่มี AI API call ใดๆ, `ai-examiner-system-prompt.md` มี prompt พร้อมแต่ผูกกับ track Cloud Code/PALI-AI แยกต่างหาก ไม่ได้ต่อกับ inbox นี้ สร้าง backlog `docs/exam-ai-grading-backlog.md` สรุป gap + สเปคที่ต้องตัดสินก่อน + code ที่ต้องทำ | ยังไม่ implement — รอ PO ตัดสินใจ trust model (AI ตรงถึงนักเรียน vs ผ่านครูยืนยัน) และ priority ก่อนเริ่ม |
| 2026-07-10 | — | architecture | User เลือกแนวทาง namespace refactor: จำกัด `exam-*` เฉพาะ exam/review workflow และใช้ `workbook-*`, `book-*`, `inbox-*`, `learn-*` สำหรับโดเมนอื่น สร้าง `docs/url-naming-refactor-plan.md` เป็น policy/migration map | ยังไม่ rename production files — ต้องทำเป็น migration slices พร้อม compatibility routes เพราะ references กระจายทั่ว nav/docs/scripts/UI |
| 2026-07-10 | — | setup | สร้างไฟล์ worklog นี้ (แรกเริ่ม); เช็คบอร์ด — ทุก issue #1–#25 ยังอยู่ **Todo**, ยังไม่มี sprint/milestone เริ่ม, ไม่มีใคร In Progress. ช่วย user รัน local dev (`python3 -m http.server 8765` + `workers: npm run dev`) | ยังไม่ได้รับ issue ไหนมาทำ — รอ user สั่งหรือดึงจาก Ready เมื่อมี |

---

## Latest combined handoff (2026-07-16) — paste into new Cursor/Codex chat

```markdown
## Handoff

**From:** cursor-ai (+ merged Codex/Claude context)
**To:** human | cursor-ai | codex-ai
**Status:** needs-decision · dirty tree — do not broad commit
**Repo:** `/Users/iworn/Documents/Claude/Projects/paligo-audio-learn`
**Branch:** `fix/issue-59-tab-space-indent` @ `5f4508b` (“Prepare production domains and gated inbox invites”)
**Board:** https://github.com/users/niyata/projects/14
**Rules:** `AGENTS.md` · `docs/agile/AGENT-HANDOFF.md` · `docs/agile/PALIGO-INTEGRATOR.md` · `.cursor/rules/paligo-change-audit.mdc`
**Prior chats:** [Cursor exam/UI](49ee11a9-f684-457c-bd01-ac44561da084) · Codex Jul-12 pali PUA (read-only)

### Repo state (source of truth)
- **Committed HEAD** includes production prep, inbox group workflow, form-ui rules, reviewer console lifecycle, import/export hide, profile polish, LINE issue bot apps/, corpora sample, `inbox.html` alias.
- **Dirty — claim via Integrator before stage/commit:**
  - `M workbook.html` — switches Pali reference PiP by exam (`4:pali-to-thai` → mangalattha; `4:thai-to-pali` → `dhammapadatthakatha-pt4-book1`); uncommitted.
  - `?? data/corpora/dhammapadatthakatha-pt4-book1/` — small corpus + manifest (paired with workbook change).
  - `?? docs/audit/**/*.png` — audit screenshots (profile/inbox/workbook); OK to keep untracked or commit separately with PO OK.
- **Do not** `git add .` · **Do not** revert/overwrite dirty paths belonging to other agents.

### Done (Cursor — this thread / nearby commits)
1. **Profile form UI #77–#79** — grouped cards, field grid, alignment; audits `scripts/audit-form-ui-profile.mjs`.
2. **Import/Export hide #78** — `IMPORT_EXPORT_UI_TEMPORARILY_HIDDEN=true` in `paligo-platform.js`; gate in super-admin/account; audits `audit-import-export-gate.mjs`. Flip flag to re-enable.
3. **Prefix selector #80** — `bindPrefixRow()` in `exam-profile.html`: collapsed+same→expand, collapsed+other→select, expanded+same→collapse, expanded+other→select+collapse; handles label→input double-click + missing mousedown; `scripts/audit-prefix-row.mjs` pass.
4. **Reviewer Console lifecycle** — tabs: รอรับงาน / รอตรวจ / กำลังตรวจ / รอส่งคืน / ส่งคืนแล้ว; localStorage `paligo-exam-review-workflow-v1` keyed by `submissionId`; claim→`in_review`, save→`reviewed_ready`, return/fallback download→`returned`; returned excluded from active queue + read-only; mobile segment; `scripts/audit-reviewer-workflow.mjs` pass. Paper return also marks returned (`ruled-lines-card-only-template.html`).
5. **Inbox composer pin** — sticky tools+chat+send in `paligo-exam-ui.css` without cropping (`100dvh` max-height on layout, no main `overflow:hidden` clip); verified mobile/desktop.

### Done (Codex / Claude / Integrator — recent)
1. **#86 Slice 2 (partial)** — `inbox.html` → redirect `exam-inbox.html`; nav uses `inbox.html` (`paligo-nav-config.js`). Still: hard-coded `exam-inbox.html` links elsewhere.
2. **Namespace refactor board** — Epic [#88](https://github.com/niyata/paligo-audio-learn/issues/88); slices [#89](https://github.com/niyata/paligo-audio-learn/issues/89)–[#93](https://github.com/niyata/paligo-audio-learn/issues/93); plan `docs/url-naming-refactor-plan.md`. Several blocked on **PO route decision**.
3. **Production** — Pages asset limits, D1 binding, domains/gated invites (`5f4508b`); docs `docs/deploy-cloudflare.md`. Human Cloudflare Dashboard still authoritative for live DNS/Pages verify.
4. **LINE Issue Bot** — standalone `apps/line-issue-bot-worker`, `chat.paligo.jp`, LIFF workflow console, allowlist; worklog entries 2026-07-11+.
5. **Codex Jul-12 (read-only)** — Pali tofu boxes = legacy **PUA** `U+F711` (not `ํ` U+0E4D); fix should be targeted map in `workbook.html` `normalizeValue` before layout normalize — **not implemented**.
6. **Codex earlier audits** — profile field drop risk (`avatarUrl` local save); reviewer lifecycle design (Cursor implemented).

### Not done / Next choices (PO pick one)
1. **Commit/split dirty tree** — Integrator: claim `workbook.html` + dhamma corpus; write test via `scripts/audit-workbook-pali-text.mjs`; separate commit from audit PNGs.
2. **Pali PUA normalize** — implement Codex map in `workbook.html` without breaking true combining marks (`ฺ` U+0E3A).
3. **Namespace slices** — unblock #92/#93/#91 after PO decides alias URLs.
4. **E2E inbox** — claim→review→return on real API (`python3 -m http.server 8765` + `workers` `npm run dev`).
5. **Reviewer Console UX polish** — numbers on badges are Thai (audit); status/tech may want Arabic per change-audit rule — confirm with PO.
6. **Import/Export re-enable** — only when product ready: set `IMPORT_EXPORT_UI_TEMPORARILY_HIDDEN=false`.

### How to verify
```bash
python3 -m http.server 8765
node scripts/audit-prefix-row.mjs
node scripts/audit-reviewer-workflow.mjs
node scripts/audit-inbox-offline.mjs
node scripts/audit-form-ui-profile.mjs
node scripts/audit-import-export-gate.mjs
node scripts/audit-sidebar.mjs http://127.0.0.1:8765/exam-inbox.html
# Manual: exam-profile.html · exam-reviewer-console.html · exam-inbox.html / inbox.html · workbook.html Pali PiP by subject
```

### Key files
- Profile/prefix: `exam-profile.html`, `paligo-profile.js`, `.cursor/rules/paligo-form-ui-quality.mdc`
- Workflow: `paligo-exam-shared.js` (`KEYS.reviewWorkflow`, `REVIEW_WORKFLOW_PHASE`), `exam-reviewer-console.html`
- Inbox UI: `exam-inbox.html`, `inbox.html`, `paligo-exam-ui.css` (composer sticky)
- Gate IE: `paligo-platform.js`, `exam-super-admin.html`, `exam-account.html`
- Dirty: `workbook.html`, `data/corpora/dhammapadatthakatha-pt4-book1/*`
- Claiming: `docs/agile/PALIGO-INTEGRATOR.md`, `docs/agile/CLAUDE-WORKLOG.md`

### Risks / open questions
- Dirty tree mixes Cursor UI work (mostly committed) with uncommitted workbook corpus switch — risk of overwrite if another agent cleans “stray” files.
- `workbook.html` vs `ruled-lines-card-only-template.html` — production is `workbook.html`; keep legacy backup until compatibility plan done.
- Badge numerals Thai vs Arabic in reviewer console lifecycle.
- Whether dhamma corpus should stay small sample or grow (Pages size — Codex already removed large mangalattha pt4 corpus once).

### Suggested first message for new chat
“Continue Paligo from handoff 2026-07-16. Preflight git status. Do not commit unless I ask. Prefer Integrator if claiming dirty `workbook.html`+corpus. Next task: <PO picks # above>.”
```

---

## Board snapshot (ref เท่านั้น — ของจริงดูที่บอร์ด)

ณ 2026-07-10: 25 items (#1–#25) ทั้งหมดอยู่ Todo — ยังไม่ตั้ง Sprint milestone, ยังไม่มี Ready/In Progress/Review รายการใด บอร์ดเพิ่ง seed (`bootstrap-scrum-board.sh`) ยังไม่ได้เริ่ม sprint แรก

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

## Board snapshot (ref เท่านั้น — ของจริงดูที่บอร์ด)

ณ 2026-07-10: 25 items (#1–#25) ทั้งหมดอยู่ Todo — ยังไม่ตั้ง Sprint milestone, ยังไม่มี Ready/In Progress/Review รายการใด บอร์ดเพิ่ง seed (`bootstrap-scrum-board.sh`) ยังไม่ได้เริ่ม sprint แรก

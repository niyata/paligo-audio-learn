#!/usr/bin/env bash
# Seed backlog ideas onto GitHub Issues + Project 14 (Workflow=Backlog)
set -euo pipefail

REPO="${REPO:-niyata/paligo-audio-learn}"
PROJECT_OWNER="${PROJECT_OWNER:-niyata}"
PROJECT_NUMBER="${PROJECT_NUMBER:-14}"
PROJECT_ID="PVT_kwHOABMkPs4BcriO"
FIELD_WORKFLOW="PVTSSF_lAHOABMkPs4BcriOzhXSh90"
FIELD_PRIORITY="PVTSSF_lAHOABMkPs4BcriOzhXSh94"
FIELD_AGENT="PVTSSF_lAHOABMkPs4BcriOzhXSh98"
OPT_BACKLOG="b7f1ad00"
OPT_P0="79a1ffcd"
OPT_P1="2c9e72ec"
OPT_P2="bffc69fb"
OPT_CURSOR="827cc540"
OPT_HUMAN="9ff75438"
OPT_CODEX="27ce9936"
OPT_UNASSIGNED="02b08215"

add_to_board() {
  local url="$1"
  local priority_opt="$2"
  local agent_opt="$3"
  local item_id
  item_id=$(gh project item-add "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --url "$url" --format json --jq .id)
  gh project item-edit --id "$item_id" --project-id "$PROJECT_ID" \
    --field-id "$FIELD_WORKFLOW" --single-select-option-id "$OPT_BACKLOG" >/dev/null
  gh project item-edit --id "$item_id" --project-id "$PROJECT_ID" \
    --field-id "$FIELD_PRIORITY" --single-select-option-id "$priority_opt" >/dev/null
  gh project item-edit --id "$item_id" --project-id "$PROJECT_ID" \
    --field-id "$FIELD_AGENT" --single-select-option-id "$agent_opt" >/dev/null
  echo "$url"
}

create_if_missing() {
  local search="$1"
  local existing
  existing=$(gh issue list --repo "$REPO" --search "$search" --json number --jq '.[0].number' 2>/dev/null || true)
  if [[ -n "$existing" && "$existing" != "null" ]]; then
    echo "skip: #$existing $search"
    gh issue view "$existing" --repo "$REPO" --json url --jq .url
    return
  fi
  shift
  gh issue create --repo "$REPO" "$@"
}

echo "==> Seeding Paligo backlog ideas to Project $PROJECT_NUMBER"

# --- Epic: Online sync ---
URL=$(create_if_missing "Epic: Online sync" \
  --title "[Epic] Online sync and multi-device handoff" \
  --label "type:epic,area:exam,priority:P1" \
  --body "## Goal
เลิกพึ่งไฟล์ JSON ด้วยมือ — ส่ง submission/review ระหว่างเครื่องได้จริง

## Scope
- API หรือ storage กลาง (R2/D1/Workers)
- pairing ครู–นักเรียน
- ยัง offline-first จนกดส่งตรวจ

## Ref
\`docs/offline-online-sync-boundary.md\`")
add_to_board "$URL" "$OPT_P1" "$OPT_HUMAN"

# --- Exam / transfer ---
URL=$(create_if_missing "packageHash" \
  --title "[Story] packageHash validation on book transfer import" \
  --label "type:story,area:exam,priority:P1,agent:cursor-ai" \
  --body "## User Story
**As a** reviewer, **I want** ระบบตรวจความสมบูรณ์ของแพ็กเกจโอน, **So that** ไฟล์ไม่ถูกแก้ระหว่างทาง

## Acceptance Criteria
- [ ] \`packageHash\` ใน \`paligo.exam.bookTransfer.v1\`
- [ ] import แจ้งเตือนเมื่อ hash ไม่ตรง
- [ ] docs อัปเดต

Parent: #1")
add_to_board "$URL" "$OPT_P1" "$OPT_CURSOR"

URL=$(create_if_missing "student annotations on reviewer" \
  --title "[Story] Show student ruler annotations on reviewer paper" \
  --label "type:story,area:exam,priority:P2,agent:cursor-ai" \
  --body "## User Story
**As a** reviewer, **I want** เห็นเส้นเน้นที่นักเรียนตีบนกระดาษ, **So that** บริบทการตรวจครบ

## Acceptance Criteria
- [ ] โหลด \`submission.annotations\` ใน paper review mode
- [ ] แสดง overlay read-only คู่กับ stamp layer

Parent: #1")
add_to_board "$URL" "$OPT_P2" "$OPT_CURSOR"

URL=$(create_if_missing "isSelfReview" \
  --title "[Story] isSelfReview flag and leaderboard filtering" \
  --label "type:story,area:exam,priority:P1,agent:cursor-ai" \
  --body "## Acceptance Criteria
- [ ] flag ใน review.v1 เมื่อตรวจเอง
- [ ] leaderboard กรอง/แยก self-review
- [ ] UI บอกชัดเมื่อเป็น self-review

Ref: \`docs/exam-scoring-leaderboard-plan.md\`")
add_to_board "$URL" "$OPT_P1" "$OPT_CURSOR"

URL=$(create_if_missing "LINE Flex" \
  --title "[Story] LINE Flex Message adapter for submission delivery" \
  --label "type:story,area:exam,priority:P1,agent:human" \
  --body "## User Story
**As a** student, **I want** ส่งตรวจผ่าน LINE จริง, **So that** ไม่ต้องดาวน์โหลด JSON เอง

## Acceptance Criteria
- [ ] Flex template จาก submission metadata
- [ ] ไม่ over-promise ใน UI ถ้ายังไม่ตั้งค่า LINE
- [ ] fallback ดาวน์โหลด JSON ยังอยู่

Ref: \`docs/exam-scoring-leaderboard-plan.md\`")
add_to_board "$URL" "$OPT_P1" "$OPT_HUMAN"

URL=$(create_if_missing "Revision audit trail" \
  --title "[Story] Revision audit trail on book status changes" \
  --label "type:story,area:exam,priority:P2,agent:cursor-ai" \
  --body "## Acceptance Criteria
- [ ] log chain: draft → under_review → reviewed → draft (revision N)
- [ ] แสดงใน book bar หรือ export metadata
- [ ] ไม่ให้แก้ย้อนหลังเงียบ ๆ

Parent: #1")
add_to_board "$URL" "$OPT_P2" "$OPT_CURSOR"

URL=$(create_if_missing "Teacher-student pairing" \
  --title "[Story] Teacher-student pairing codes" \
  --label "type:story,area:exam,priority:P2,agent:cursor-ai" \
  --body "## User Story
**As a** teacher, **I want** รหัสจับคู่กับนักเรียน, **So that** submission ไปถึงครูที่ถูกต้อง

## Acceptance Criteria
- [ ] สร้าง/ใส่ pairing code ใน profile
- [ ] filter submission queue ตามครู
- [ ] docs handoff อัปเดต")
add_to_board "$URL" "$OPT_P2" "$OPT_CURSOR"

URL=$(create_if_missing "resume=1 redirect" \
  --title "[Story] Redirect when resume=1 but no active book" \
  --label "type:story,area:exam,priority:P2,agent:cursor-ai" \
  --body "## Acceptance Criteria
- [ ] \`?resume=1\` ไม่มี active book → redirect \`exam-books.html\` + ข้อความ
- [ ] ไม่สร้าง book id ใหม่เงียบ ๆ")
add_to_board "$URL" "$OPT_P2" "$OPT_CURSOR"

URL=$(create_if_missing "Print stylesheet" \
  --title "[Story] Print stylesheet for ruled exam paper" \
  --label "type:story,area:exam,priority:P2,agent:cursor-ai" \
  --body "## Acceptance Criteria
- [ ] โหมดพิมพ์ซ่อน sidebar/controls
- [ ] stamp + ลายเซ็นพิมพ์ออกครบ
- [ ] ทดสอบ Chrome print preview")
add_to_board "$URL" "$OPT_P2" "$OPT_CURSOR"

# --- Spike: sync ---
URL=$(create_if_missing "Spike: Cloudflare" \
  --title "[Spike] Cloudflare Workers + R2 for submission packages" \
  --label "type:spike,area:pipeline,priority:P1,agent:codex-ai" \
  --body "## Question
Workers + R2 เหมาะเป็น sync layer สำหรับ \`paligo.exam.*.v1\` ไหม?

## Deliverable
- ADR 1 หน้า: cost, auth, offline boundary
- prototype upload/download endpoint")
add_to_board "$URL" "$OPT_P1" "$OPT_CODEX"

# --- Audio / pipeline ---
URL=$(create_if_missing "MP3 alignment QA" \
  --title "[Story] MP3 proportional alignment UX and errors" \
  --label "type:story,area:audio,priority:P2,agent:cursor-ai" \
  --body "## Acceptance Criteria
- [ ] ข้อความชัดเมื่อไม่มี mutagen/ffprobe
- [ ] แสดง progress ระหว่าง align
- [ ] doc ใน README/scripts

Ref: \`scripts/build_book_from_page_audio.py\`")
add_to_board "$URL" "$OPT_P2" "$OPT_CURSOR"

URL=$(create_if_missing "book bundle UI" \
  --title "[Story] Book bundle export/import UI" \
  --label "type:story,area:pipeline,priority:P2,agent:cursor-ai" \
  --body "## Acceptance Criteria
- [ ] ปุ่ม export \`paligo.bookBundle.v1\` จาก viewer/QA
- [ ] import bundle กลับเข้า output folder
- [ ] ผูก audio pack กับหน้าเล่ม")
add_to_board "$URL" "$OPT_P2" "$OPT_CURSOR"

URL=$(create_if_missing "Audio practice progress" \
  --title "[Story] Audio practice session progress tracking" \
  --label "type:story,area:audio,priority:P2,agent:cursor-ai" \
  --body "## User Story
**As a** learner, **I want** จำหน้าที่ฝึกค้าง, **So that** เปิดมาทำต่อได้

## Acceptance Criteria
- [ ] localStorage progress ต่อ pack/page
- [ ] แสดงใน sidebar เรียนวันนี้
- [ ] ไม่ sync online จนกว่าจะมี account")
add_to_board "$URL" "$OPT_P2" "$OPT_CURSOR"

# --- Nav / UX ---
URL=$(create_if_missing "Mobile sidebar audit" \
  --title "[Story] Mobile sidebar off-canvas UX audit" \
  --label "type:story,area:nav,priority:P2,agent:cursor-ai" \
  --body "## Acceptance Criteria
- [ ] ทดสอบ iPhone Safari + Android Chrome
- [ ] focus trap / ESC ปิด drawer
- [ ] checklist ใน \`docs/navigation-and-shell-prd.md\`")
add_to_board "$URL" "$OPT_P2" "$OPT_CURSOR"

URL=$(create_if_missing "Thai UI audit" \
  --title "[Story] Thai UI language audit all pages" \
  --label "type:story,area:docs,priority:P2,agent:human" \
  --body "## Acceptance Criteria
- [ ] ไม่มี title/UI ภาษาอังกฤษค้าง (ยกเว้น technical)
- [ ] สอดคล้อง \`docs/thai-ui-language-rules.md\`
- [ ] spreadsheet รายการหน้าที่แก้")
add_to_board "$URL" "$OPT_P2" "$OPT_HUMAN"

URL=$(create_if_missing "Focus mode study pages" \
  --title "[Story] Focus mode hides sidebar on study pages" \
  --label "type:story,area:nav,priority:P2,agent:cursor-ai" \
  --body "## Acceptance Criteria
- [ ] \`focusMode: true\` ใน nav config ซ่อน sidebar อัตโนมัติ
- [ ] ปุ่มกลับเมนูยังเข้าถึงได้
- [ ] audio + book viewer ใช้งานได้")
add_to_board "$URL" "$OPT_P2" "$OPT_CURSOR"

# --- Learning product (PRD) ---
URL=$(create_if_missing "Epic: Declension tables" \
  --title "[Epic] Interactive Pali declension and conjugation tables" \
  --label "type:epic,area:docs,priority:P2" \
  --body "## Goal
ตารางวิภัตติ/กิต interactive ตาม PRD

Ref: \`docs/pali-learning-app-prd-roadmap.md\` §1")
add_to_board "$URL" "$OPT_P2" "$OPT_UNASSIGNED"

URL=$(create_if_missing "Spike: Pali dictionary" \
  --title "[Spike] Offline Pali-Thai dictionary search MVP" \
  --label "type:spike,area:docs,priority:P2,agent:other-ai" \
  --body "## Deliverable
- โครง dataset + search 500 คำ
- หน้า HTML prototype
- ประเมินขนาด bundle offline

Ref: PRD §2")
add_to_board "$URL" "$OPT_P2" "$OPT_UNASSIGNED"

# --- DevOps / agile meta ---
URL=$(create_if_missing "CI Python smoke" \
  --title "[Task] CI smoke test for Python scripts" \
  --label "type:task,area:pipeline,priority:P2,agent:codex-ai" \
  --body "## Acceptance Criteria
- [ ] GitHub Action: \`python -m py_compile scripts/*.py\`
- [ ] optional: pytest ถ้ามี test
- [ ] badge ใน README")
add_to_board "$URL" "$OPT_P2" "$OPT_CODEX"

URL=$(create_if_missing "Project label automation" \
  --title "[Task] Automate workflow:in-progress label from Project status" \
  --label "type:task,area:docs,priority:P2,agent:codex-ai" \
  --body "## Acceptance Criteria
- [ ] GitHub Project workflow rule หรือ Action
- [ ] In Progress → add label; ออกจาก column → remove
- [ ] docs agile อัปเดต")
add_to_board "$URL" "$OPT_P2" "$OPT_CODEX"

URL=$(create_if_missing "Book QA CI gate" \
  --title "[Task] Book page QA CI gate for sample manifest" \
  --label "type:task,area:pipeline,priority:P2,agent:cursor-ai" \
  --body "## Acceptance Criteria
- [ ] sample manifest ใน repo (generated fixture)
- [ ] CI รัน verification script
- [ ] fail PR ถ้า text drift เกิน threshold")
add_to_board "$URL" "$OPT_P2" "$OPT_CURSOR"

# --- Human / product ---
URL=$(create_if_missing "Exam flow user testing" \
  --title "[Task] User test: exam submit → review → import loop" \
  --label "type:task,area:exam,priority:P1,agent:human" \
  --body "## Script
1. นักเรียนสร้างสมุด → ส่งตรวจ
2. โอนไฟล์ไปเครื่องครู (หรือ same device)
3. ตรวจบนกระดาษ → ส่งคืน
4. นักเรียนนำเข้าผลตรวจ

## Output
- บันทึก pain points เป็น issues ใหม่
- อัปเดต audit doc")
add_to_board "$URL" "$OPT_P1" "$OPT_HUMAN"

URL=$(create_if_missing "Prioritize Sprint" \
  --title "[Task] Sprint planning: prioritize backlog for next week" \
  --label "type:task,priority:P1,agent:human" \
  --body "## Checklist
- [ ] ย้าย P1 จาก Backlog → Ready (ไม่เกิน 5 stories)
- [ ] กำหนด agent ต่อ issue
- [ ] ปิด/อัปเดต #1 epic ตามความคืบหน้า
- [ ] Retro 3 bullet จาก sprint ที่แล้ว")
add_to_board "$URL" "$OPT_P1" "$OPT_HUMAN"

echo ""
echo "==> Backlog seed complete: https://github.com/users/$PROJECT_OWNER/projects/$PROJECT_NUMBER"

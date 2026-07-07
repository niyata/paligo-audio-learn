#!/usr/bin/env bash
# Bootstrap Paligo Scrum Board — labels, milestone, seed issues, link to Project 14
set -euo pipefail

REPO="${REPO:-niyata/paligo-audio-learn}"
PROJECT_NUMBER="${PROJECT_NUMBER:-14}"
PROJECT_OWNER="${PROJECT_OWNER:-niyata}"
SPRINT="${SPRINT:-Sprint 2026-W28}"

echo "==> Repo: $REPO | Project: $PROJECT_OWNER/$PROJECT_NUMBER | Sprint: $SPRINT"

create_label() {
  local name="$1" color="$2" description="${3:-}"
  gh label create "$name" --repo "$REPO" --color "$color" --description "$description" --force
}

echo "==> Creating labels..."
create_label "priority:P0" "d73a4a" "Blocker / must ship first"
create_label "priority:P1" "fbca04" "Current sprint"
create_label "priority:P2" "0e8a16" "Later"
create_label "agent:human" "1d76db" "Product owner / human"
create_label "agent:cursor-ai" "5319e7" "Cursor agent"
create_label "agent:codex-ai" "b60205" "Codex / CLI agent"
create_label "agent:other-ai" "d4c5f9" "Other AI"
create_label "type:epic" "3e4b9e" "Epic"
create_label "type:story" "0052cc" "User story"
create_label "type:task" "cfd3d7" "Task"
create_label "type:spike" "e99695" "Spike / research"
create_label "area:exam" "1f2d89" "Exam book system"
create_label "area:audio" "24715b" "Audio practice"
create_label "area:nav" "9a6a10" "Navigation shell"
create_label "area:pipeline" "6f42c1" "PDF / build pipeline"
create_label "area:docs" "0075ca" "Documentation"
create_label "workflow:in-progress" "5319e7" "On Scrum board: In Progress column"
create_label "status:blocked" "b60205" "Blocked"
create_label "status:ready-for-dev" "0e8a16" "Ready for development"

echo "==> Creating milestone: $SPRINT"
gh api "repos/$REPO/milestones" -f title="$SPRINT" -f description="Paligo sprint — exam transfer + scale" -f state=open 2>/dev/null || true

echo "==> Setting project readme..."
gh project edit "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --description "Shared Scrum board for Paligo — founder, Cursor AI, and other agents." --readme "$(cat <<'EOF'
# Paligo — Scrum Board

**Repo:** https://github.com/niyata/paligo-audio-learn

## Workflow columns

`Backlog` → `Ready` → `In Progress` → `Review` → `QA` → `Ready to Release` → `Done`

## Rules

1. **P0 before P1 before P2**
2. **WIP limit:** max 3 items *In Progress* per agent
3. **Every PR** links an issue (`Closes #N`)
4. **AI agents** read `AGENTS.md` + update this board at session start

## Fields

| Field | Values |
|-------|--------|
| Workflow | Backlog … Done |
| Priority | P0, P1, P2 |
| Agent | human, cursor-ai, codex-ai, other-ai, unassigned |

## Docs

- [SCRUM-WORKFLOW.md](https://github.com/niyata/paligo-audio-learn/blob/new-dev/docs/agile/SCRUM-WORKFLOW.md)
- [AGENT-HANDOFF.md](https://github.com/niyata/paligo-audio-learn/blob/new-dev/docs/agile/AGENT-HANDOFF.md)
EOF
)"

create_issue() {
  local title="$1" body="$2" labels="$3"
  gh issue create --repo "$REPO" --title "$title" --body "$body" --label "$labels"
}

add_to_project() {
  local issue_url="$1"
  gh project item-add "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --url "$issue_url"
}

echo "==> Creating seed epics & stories (skip if already exist)..."

if ! gh issue list --repo "$REPO" --search "Epic: Exam book transfer" --json number --jq '.[0].number' 2>/dev/null | grep -q .; then
  EPIC1=$(create_issue "[Epic] Exam book transfer & permissions" "$(cat <<'EOF'
## Goal
โอนสมุดสองทาง นักเรียน ↔ ผู้ตรวจ — มองเห็นร่วม สิทธิ์ต่างกัน stamp/ลายเซ็นบนกระดาษ

## Child issues
- (link stories below)

See: `docs/exam-flow-ux-audit.md`
EOF
)" "type:epic,area:exam,priority:P0")
  add_to_project "$EPIC1"
  echo "Created: $EPIC1"
fi

seed_story() {
  local title="$1" body="$2" labels="$3"
  local url
  url=$(create_issue "$title" "$body" "$labels")
  add_to_project "$url"
  echo "Created: $url"
}

seed_story "[Story] Validate answerHash on submission import" "$(cat <<'EOF'
**As a** reviewer, **I want** ระบบตรวจว่าคำตอบไม่ถูกแก้หลังส่ง, **So that** ความน่าเชื่อถือของการตรวจ

## Acceptance Criteria
- [ ] `answerHash` คำนวณตอน submit
- [ ] import submission แจ้งเตือนถ้า hash ไม่ตรง
- [ ] docs อัปเดต

## Ref
`docs/exam-flow-ux-audit.md` — ช่องโหว่ answerHash
EOF
)" "type:story,area:exam,priority:P1,agent:cursor-ai,status:ready-for-dev"

seed_story "[Story] Unify reviewer stamp: paper-only source of truth" "$(cat <<'EOF'
**As a** reviewer, **I want** stamp บนกระดาษ sync กับ console/leaderboard, **So that** ไม่สับสนสอง channel

## Acceptance Criteria
- [ ] stamp จาก paper mode เป็น canonical
- [ ] console อ่านจาก results เดียวกัน
- [ ] deprecate หรือ sync ตาราง console

## Ref
Paper mode: `?mode=review&submissionId=`
EOF
)" "type:story,area:exam,priority:P1,agent:cursor-ai,status:ready-for-dev"

seed_story "[Story] Draggable reviewer signature on paper" "$(cat <<'EOF'
**As a** reviewer, **I want** ลากลายเซ็นไปวางบนบรรทัด, **So that** ตรงกับสมุดจริง

## Acceptance Criteria
- [ ] ลาก/วางลายเซ็นบนกระดาษ
- [ ] เก็บ page/line/x ใน review.v1
- [ ] นักเรียนเห็นตำแหน่งเดียวกัน read-only
EOF
)" "type:story,area:exam,priority:P2,agent:cursor-ai"

seed_story "[Story] Navigation shell on all legacy pages" "$(cat <<'EOF'
**As a** learner, **I want** sidebar เหมือนกันทุกหน้า, **So that** ไม่หลงทาง

## Acceptance Criteria
- [ ] `ruled-lines-template.html` มี shell
- [ ] checklist ใน `docs/navigation-and-shell-prd.md` ครบ
EOF
)" "type:story,area:nav,priority:P2,agent:cursor-ai"

echo ""
echo "==> Done. Open board:"
echo "    https://github.com/users/$PROJECT_OWNER/projects/$PROJECT_NUMBER"
echo ""
echo "Next: push .github/ + docs/ to repo, then triage Ready column."

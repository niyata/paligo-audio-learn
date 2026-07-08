#!/usr/bin/env bash
# Seed Review Queue epic (Phase 7) → GitHub Project 14
set -euo pipefail

REPO="${REPO:-niyata/paligo-audio-learn}"
PROJECT_NUMBER="${PROJECT_NUMBER:-14}"
PROJECT_OWNER="${PROJECT_OWNER:-niyata}"

create_label() {
  gh label create "$1" --repo "$REPO" --color "$2" --description "${3:-}" --force 2>/dev/null || true
}

create_label "phase:inbox-7" "0e8a16" "Phase 7 — Review queue"
create_label "area:queue" "006b75" "Review queue system"

create_issue() {
  gh issue create --repo "$REPO" --title "$1" --body "$2" --label "$3"
}

add_to_project() {
  gh project item-add "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --url "$1"
}

seed() {
  local url
  url=$(create_issue "$1" "$2" "$3")
  add_to_project "$url"
  echo "  $url"
}

if ! gh issue list --repo "$REPO" --search "Epic: Review queue" --json number --jq '.[0].number' 2>/dev/null | grep -q .; then
  echo "==> Epic..."
  EPIC=$(create_issue "[Epic] Review queue — เลขคิวตรวจ + progress (Phase 7)" "$(cat <<'EOF'
## Goal
ครูตรวจตามลำดับคิว · นักเรียนเห็นเลขคิวและสถานะ · แผงสถิติ progress ตาม HIG

## Spec
`docs/exam-review-queue-backlog.md`

## Depends on
Inbox MVP Phase 4 Done

## PO note (2026-07-07)
- เลขคิวส่วนกลาง + ของตัวเอง
- total / ตรวจแล้ว / เหลือ
- progress bar สวยงาม Apple HIG
EOF
)" "type:epic,area:queue,area:inbox,priority:P2")
  add_to_project "$EPIC"
  echo "  $EPIC"
fi

echo "==> Phase 7 stories (Backlog)..."
seed "[Queue Q7.1] เลขคิว + queue status ตอน push inbox" "**Phase 7** · API + DB\n\n- ออก queue_number ตอน POST /packages\n- สถานะ queued → in_review → reviewed\n\nSee \`docs/exam-review-queue-backlog.md\`" "type:story,area:queue,priority:P2,agent:cursor-ai,phase:inbox-7"

seed "[Queue Q7.2] UI นักเรียน — การ์ดคิว + progress กลาง" "**Phase 7**\n\n- เลขคิว · สถานะ · ลำดับในคิว\n- Linear progress ตรวจแล้ว/ทั้งหมด\n- HIG / paligo-design-tokens" "type:story,area:queue,priority:P2,agent:cursor-ai,phase:inbox-7"

seed "[Queue Q7.3] UI ครู — คิวเรียง + คิวถัดไป" "**Phase 7**\n\n- รายการ FIFO\n- ปุ่มรับคิวถัดไป · in_review lock" "type:story,area:queue,priority:P2,agent:cursor-ai,phase:inbox-7"

seed "[Queue Q7.4] สถิติกลาง — total/reviewed/remaining (Apple HIG)" "**Phase 7**\n\n- Summary API + progress bar แบบ Apple HIG\n- สถิติกลาง: ทั้งหมด / ตรวจแล้ว / เหลือ\n- ตัวเลขสถานะอารบิก · ข้อความไทย · paligo-design-tokens\n\nSee \`docs/exam-review-queue-backlog.md\`" "type:story,area:queue,priority:P2,agent:cursor-ai,phase:inbox-7"

echo ""
echo "==> Done. Board: https://github.com/users/$PROJECT_OWNER/projects/$PROJECT_NUMBER"

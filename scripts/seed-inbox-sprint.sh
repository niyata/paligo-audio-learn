#!/usr/bin/env bash
# Seed Inbox v1 epic + phased issues → GitHub Project 14
set -euo pipefail

REPO="${REPO:-niyata/paligo-audio-learn}"
PROJECT_NUMBER="${PROJECT_NUMBER:-14}"
PROJECT_OWNER="${PROJECT_OWNER:-niyata}"
SPRINT="${SPRINT:-Sprint 2026-W28}"

echo "==> Inbox sprint seed | Repo: $REPO | Sprint: $SPRINT"

create_label() {
  gh label create "$1" --repo "$REPO" --color "$2" --description "${3:-}" --force
}

echo "==> Labels..."
create_label "area:inbox" "8250df" "Exam inbox / server sync"
create_label "phase:inbox-0" "bfdadc" "Inbox Phase 0 — Foundation"
create_label "phase:inbox-1" "bfd4f2" "Inbox Phase 1 — Auth + Pairing"
create_label "phase:inbox-2" "d4c5f9" "Inbox Phase 2 — Push to reviewer"
create_label "phase:inbox-3" "fef2c0" "Inbox Phase 3 — Claim + review"
create_label "phase:inbox-4" "c5def5" "Inbox Phase 4 — Return to student"
create_label "phase:inbox-5" "0366d6" "Inbox Phase 5 — UX polish"
create_label "phase:inbox-6" "7057ff" "Inbox Phase 6 — Scale / DO migration"

gh api "repos/$REPO/milestones" -f title="$SPRINT" \
  -f description="Inbox v1 Phase 0 — Workers skeleton + PALIGO_CONFIG" -f state=open 2>/dev/null || true

create_issue() {
  gh issue create --repo "$REPO" --title "$1" --body "$2" --label "$3" --milestone "$SPRINT"
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

if gh issue list --repo "$REPO" --search "Epic: Inbox v1" --json number --jq '.[0].number' 2>/dev/null | grep -q .; then
  echo "==> Epic already exists — creating phase issues only if missing (manual check)"
else
  echo "==> Epic..."
  EPIC=$(create_issue "[Epic] Inbox v1 — Cloudflare MVP" "$(cat <<'EOF'
## Goal
ส่งเล่มผ่าน web inbox แทนไฟล์โอน (flow หลัก) · import/export เป็นเมนูเพิ่มเติม

## Domain
- `paligo.com` — landing
- `app.paligo.com` — Cloudflare Pages
- `api.paligo.com` — Workers → DO ภายหลัง

## Phases
See `docs/agile/inbox-sprint-backlog.md`

## Spec
`docs/exam-inbox-v1-spec.md`
EOF
)" "type:epic,area:inbox,priority:P0")
  add_to_project "$EPIC"
  echo "  $EPIC"
fi

echo "==> Phase 0 (Sprint W28)..."
seed "[Inbox P0.1] Workers API skeleton + /v1/health" "$(cat <<'EOF'
**Phase 0** · **Agent:** cursor-ai

## Acceptance Criteria
- [ ] `workers/` + `wrangler.jsonc` + `npm run dev`
- [ ] `GET /v1/health` → `{ ok, service, version }`
- [ ] CORS สำหรับ `localhost:8765` และ `https://app.paligo.com`
- [ ] Stub routes: `/v1/me`, `/v1/inbox`, `POST /v1/packages` (501)

## Verify
```bash
cd workers && npm install && npm run dev
curl -s http://localhost:8787/v1/health
```

## Ref
`workers/README.md`
EOF
)" "type:story,area:inbox,priority:P0,agent:cursor-ai,phase:inbox-0,status:ready-for-dev"

seed "[Inbox P0.2] PALIGO_CONFIG.apiBase + PaligoInboxClient" "$(cat <<'EOF'
**Phase 0** · **Agent:** cursor-ai

## Acceptance Criteria
- [ ] `paligo-config.js` — `apiBase` local vs production
- [ ] `paligo-inbox-client.js` — `healthCheck()`, `request()`
- [ ] โหลดก่อน `paligo-exam-shared.js` ในหน้า exam หลัก
- [ ] `features.inbox` default false (เปิด Phase 2)

## Verify
เปิด `exam-books.html` → console `PaligoInboxClient.healthCheck()` (Workers dev ต้องรัน)

## Ref
`paligo-config.js`, `paligo-inbox-client.js`
EOF
)" "type:story,area:inbox,priority:P0,agent:cursor-ai,phase:inbox-0,status:ready-for-dev"

seed "[Inbox P0.3] Deploy guide + api.paligo.com routes" "$(cat <<'EOF'
**Phase 0** · **Agent:** cursor-ai

## Acceptance Criteria
- [ ] `workers/README.md` ครบ: dev, deploy, secrets
- [ ] `wrangler.jsonc` routes comment/document สำหรับ `api.paligo.com`
- [ ] `wrangler deploy` สำเร็จ (หลัง DNS)

## Blocked by
P0.5 DNS
EOF
)" "type:task,area:inbox,priority:P1,agent:cursor-ai,phase:inbox-0"

seed "[Inbox P0.4] Cloudflare Pages — app.paligo.com" "$(cat <<'EOF'
**Phase 0** · **Agent:** human

## Acceptance Criteria
- [ ] Pages project จาก repo branch `new-dev` (หรือ main)
- [ ] Build: none (static) · output = repo root
- [ ] `app.paligo.com` custom domain

## Ref
`docs/deploy-cloudflare.md`
EOF
)" "type:task,area:inbox,priority:P1,agent:human,phase:inbox-0"

seed "[Inbox P0.5] DNS: paligo.com / app / api" "$(cat <<'EOF'
**Phase 0** · **Agent:** human

## Acceptance Criteria
- [ ] `paligo.com` → landing (Pages หรือ DO ชั่วคราว)
- [ ] `app.paligo.com` → Pages
- [ ] `api.paligo.com` → Workers route
- [ ] SSL Full (strict) บน Cloudflare

## Domain plan
ดู `docs/deploy-cloudflare.md`
EOF
)" "type:task,area:inbox,priority:P1,agent:human,phase:inbox-0"

seed "[Inbox P0.6] Smoke: healthCheck จาก exam-books" "$(cat <<'EOF'
**Phase 0** · **Agent:** cursor-ai

## Acceptance Criteria
- [ ] `PaligoInboxClient.healthCheck()` ผ่านจาก localhost:8765 → localhost:8787
- [ ] ไม่ regression หน้า exam-books / editor

## Depends on
P0.1, P0.2
EOF
)" "type:task,area:inbox,priority:P1,agent:cursor-ai,phase:inbox-0,status:ready-for-dev"

echo "==> Phase 1–5 (Backlog — ยังไม่ sprint)..."
for body in \
  "[Inbox P1.1] D1 schema users/sessions/pairings|phase:inbox-1|D1 migrations ตาม exam-inbox-v1-spec.md §3" \
  "[Inbox P1.2] Auth endpoints register/login/me|phase:inbox-1|POST /v1/auth/* GET /v1/me" \
  "[Inbox P1.3] Pairing invite/join|phase:inbox-1|ครูสร้าง code · นักเรียน join" \
  "[Inbox P2.1] D1+R2 packages/inbox_items|phase:inbox-2|เก็บ bookTransfer ใน R2" \
  "[Inbox P2.2] POST /v1/packages to-reviewer|phase:inbox-2|push หลังส่งตรวจ" \
  "[Inbox P3.1] Claim inbox item|phase:inbox-3|POST /v1/inbox/{id}/claim" \
  "[Inbox P3.2] Reviewer console Inbox tab|phase:inbox-3|claim → importBookTransfer" \
  "[Inbox P4.1] POST /v1/packages to-student|phase:inbox-4|ส่งผลกลับนักเรียน" \
  "[Inbox P4.2] Student claim → reviewed|phase:inbox-4|E2E loop ครบ" \
  "[Inbox P5.1] exam-inbox.html|phase:inbox-5|หน้า inbox รวม" \
  "[Inbox P5.2] ย้าย import/export ไปเมนูเพิ่มเติม|phase:inbox-5|advance channel only"
do
  IFS='|' read -r title phase desc <<< "$body"
  seed "$title" "**Backlog** — เริ่มหลัง Phase ก่อนหน้า Done\n\n$desc\n\nSee \`docs/agile/inbox-sprint-backlog.md\`" "type:story,area:inbox,priority:P1,agent:cursor-ai,$phase"
done

echo ""
echo "==> Done. Triage on board:"
echo "    https://github.com/users/$PROJECT_OWNER/projects/$PROJECT_NUMBER"
echo "    Backlog doc: docs/agile/inbox-sprint-backlog.md"

#!/usr/bin/env bash
# Smoke test Inbox API loop (Phase 0–4) — ต้องรัน workers dev ก่อน: cd workers && npm run dev
set -euo pipefail

API="${PALIGO_API_BASE:-http://localhost:8788/v1}"

echo "→ GET /health"
curl -sf "$API/health" | grep -q '"ok":true' && echo "  ok"

echo "→ register student"
STU=$(curl -sf -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"role":"student","displayName":"นักเรียนทดสอบ","pin":"111111"}')
STU_TOKEN=$(echo "$STU" | python3 -c "import sys,json; print(json.load(sys.stdin)['sessionToken'])")

echo "→ register reviewer"
REV=$(curl -sf -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"role":"reviewer","displayName":"ครูทดสอบ","pin":"222222"}')
REV_TOKEN=$(echo "$REV" | python3 -c "import sys,json; print(json.load(sys.stdin)['sessionToken'])")

echo "→ pairing invite + join"
INV=$(curl -sf -X POST "$API/pairings/invite" -H "Authorization: Bearer $REV_TOKEN")
CODE=$(echo "$INV" | python3 -c "import sys,json; print(json.load(sys.stdin)['inviteCode'])")
curl -sf -X POST "$API/pairings/join" \
  -H "Authorization: Bearer $STU_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"inviteCode\":\"$CODE\"}" >/dev/null

BOOK_ID="book-smoke-$(date +%s)"
SUB_ID="sub-smoke-1"

PAYLOAD=$(cat <<EOF
{
  "schema": "paligo.exam.bookTransfer.v1",
  "direction": "to-reviewer",
  "transferredAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "book": { "id": "$BOOK_ID", "title": "สมุด smoke", "grade": "4", "revision": 1 },
  "submission": {
    "schema": "paligo.exam.submission.v1",
    "id": "$SUB_ID",
    "bookId": "$BOOK_ID",
    "bookRevision": 1,
    "bookTitle": "สมุด smoke",
    "grade": "4",
    "answerHash": "abc",
    "pages": [{ "index": 0, "text": "ทดสอบ" }]
  }
}
EOF
)

echo "→ push to-reviewer"
PUSH=$(curl -sf -X POST "$API/packages" \
  -H "Authorization: Bearer $STU_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")
INBOX_ID=$(echo "$PUSH" | python3 -c "import sys,json; print(json.load(sys.stdin)['inboxItemId'])")

echo "→ reviewer claim"
curl -sf -X POST "$API/inbox/$INBOX_ID/claim" -H "Authorization: Bearer $REV_TOKEN" >/dev/null

RETURN_PAYLOAD=$(cat <<EOF
{
  "schema": "paligo.exam.bookTransfer.v1",
  "direction": "to-student",
  "transferredAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "book": { "id": "$BOOK_ID", "title": "สมุด smoke", "grade": "4", "revision": 1, "status": "reviewed" },
  "submission": {
    "schema": "paligo.exam.submission.v1",
    "id": "$SUB_ID",
    "bookId": "$BOOK_ID",
    "bookRevision": 1,
    "bookTitle": "สมุด smoke",
    "grade": "4"
  },
  "review": {
    "schema": "paligo.exam.review.v1",
    "id": "review-smoke-1",
    "bookId": "$BOOK_ID",
    "submissionId": "$SUB_ID",
    "bookTitle": "สมุด smoke",
    "grade": "4",
    "scoreStamps": [{ "page": 1, "line": 1, "value": 2 }],
    "errorStamps": [],
    "score": { "earned": 2, "max": 3, "percent": 66.7 },
    "reviewedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  }
}
EOF
)

echo "→ push to-student"
RET=$(curl -sf -X POST "$API/packages" \
  -H "Authorization: Bearer $REV_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$RETURN_PAYLOAD")
RET_INBOX=$(echo "$RET" | python3 -c "import sys,json; print(json.load(sys.stdin)['inboxItemId'])")

echo "→ student claim result"
curl -sf -X POST "$API/inbox/$RET_INBOX/claim" -H "Authorization: Bearer $STU_TOKEN" >/dev/null

echo "✓ Inbox loop smoke passed"

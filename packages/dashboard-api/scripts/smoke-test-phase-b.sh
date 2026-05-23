#!/usr/bin/env bash
# Phase B behavioral smoke test — API Keys + CombinedAuthGuard + RequiresPermission
#
# Prerequisites:
#   - dashboard-api running on $BASE (default: http://localhost:3005)
#   - A workspace accessible to the test user
#
# Usage:
#   BASE=http://localhost:3005 WS_ID=<uuid> bash scripts/smoke-test-phase-b.sh
#
# The script self-registers a fresh user if needed and cleans up all test keys on exit.

set -uo pipefail

BASE="${BASE:-http://localhost:3005}"
WS_ID="${WS_ID:-}"
PASS=0
FAIL=0

pass() { echo "  ✅ PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌ FAIL: $1 — $2"; FAIL=$((FAIL+1)); }
check_http() { local label="$1" expected="$2" got="$3"; [ "$got" = "$expected" ] && pass "$label (HTTP $got)" || fail "$label" "expected $expected, got $got"; }
extract() { python3 -c "import sys,json; d=json.load(sys.stdin); exec(\"print(d$1)\")" 2>/dev/null || true; }

echo "Phase B smoke test — $BASE"
echo ""

# ── Register / login ──────────────────────────────────────────────────────────
TEST_EMAIL="smoke-phb-$$@wasphere.test"
TEST_PASS="SmokeTest1!"

REG=$(curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\"}" 2>/dev/null || echo "")

JWT=$(echo "$REG" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])" 2>/dev/null || echo "")

if [ -z "$JWT" ]; then
  LOGIN=$(curl -s -X POST "$BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\"}" 2>/dev/null || echo "")
  JWT=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])" 2>/dev/null || echo "")
fi

if [ -n "$JWT" ]; then
  pass "S2: JWT login"
else
  fail "S2: JWT login" "no accessToken"
  exit 1
fi

# If no workspace provided, use the one from registration
if [ -z "$WS_ID" ]; then
  WS_ID=$(echo "$REG" | python3 -c "import sys,json; print(json.load(sys.stdin)['workspace']['id'])" 2>/dev/null || echo "")
fi

if [ -n "$WS_ID" ]; then
  pass "S1: server up, WS=$WS_ID"
else
  fail "S1: workspace" "no workspace ID — pass WS_ID=<uuid> env var"
  exit 1
fi

# ── Cleanup trap ──────────────────────────────────────────────────────────────
cleanup() {
  curl -s "$BASE/workspaces/$WS_ID/api-keys" \
    -H "Authorization: Bearer $JWT" 2>/dev/null | \
    python3 -c "import sys,json; [print(k['id']) for k in json.load(sys.stdin) if 'smoke' in k['name']]" 2>/dev/null | \
    while read id; do
      curl -s -X DELETE "$BASE/workspaces/$WS_ID/api-keys/$id" \
        -H "Authorization: Bearer $JWT" >/dev/null 2>&1 || true
    done
}
trap cleanup EXIT

# ── S3: Create full-permission key ────────────────────────────────────────────
echo ""
echo "=== S3: Create full-permission API key ==="
S3=$(curl -s -X POST "$BASE/workspaces/$WS_ID/api-keys" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"name":"smoke-full","permissions":["*"]}')
FULL_KEY=$(echo "$S3" | python3 -c "import sys,json; print(json.load(sys.stdin).get('key',''))" 2>/dev/null || echo "")
FULL_ID=$(echo "$S3" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
[[ "$FULL_KEY" =~ ^wsk_[A-Za-z0-9]{43}$ ]] && pass "S3: wsk_ key format correct (${FULL_KEY:0:16}...)" || fail "S3: key format" "$FULL_KEY"
[ -z "$(echo "$S3" | python3 -c "import sys,json; print(json.load(sys.stdin).get('keyHash',''))" 2>/dev/null)" ] && \
  pass "S3: keyHash not in response" || fail "S3: hash exposure" "keyHash present in response"

# ── S4: API key on GET /workspaces/:id ────────────────────────────────────────
echo ""
echo "=== S4: API key Bearer → GET /workspaces/:id ==="
S4=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/workspaces/$WS_ID" \
  -H "Authorization: Bearer $FULL_KEY")
check_http "S4: API key accepted on workspace read" "200" "$S4"

# ── S5: JWT on GET /workspaces/:id ────────────────────────────────────────────
echo ""
echo "=== S5: JWT Bearer → GET /workspaces/:id ==="
S5=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/workspaces/$WS_ID" \
  -H "Authorization: Bearer $JWT")
check_http "S5: JWT still works (no regression)" "200" "$S5"

# ── S6: Invalid wsk_ Bearer ───────────────────────────────────────────────────
echo ""
echo "=== S6: Invalid wsk_ token ==="
S6=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/workspaces/$WS_ID" \
  -H "Authorization: Bearer wsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
check_http "S6: invalid API key rejected" "401" "$S6"

# ── S7: Limited key permission enforcement ────────────────────────────────────
echo ""
echo "=== S7: Permission enforcement (workspace:read key cannot DELETE) ==="
S7_JSON=$(curl -s -X POST "$BASE/workspaces/$WS_ID/api-keys" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"name":"smoke-limited","permissions":["workspace:read"]}')
LIM_KEY=$(echo "$S7_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('key',''))" 2>/dev/null || echo "")

# Limited key on workspace:read endpoint → 200
S7_READ=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/workspaces/$WS_ID" \
  -H "Authorization: Bearer $LIM_KEY")
check_http "S7a: limited key on workspace:read endpoint" "200" "$S7_READ"

# Limited key on DELETE (requires workspace:write) → 403
S7_DEL=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/workspaces/$WS_ID" \
  -H "Authorization: Bearer $LIM_KEY")
check_http "S7b: limited key blocked on DELETE (403 permission enforced)" "403" "$S7_DEL"

# ── S8: Rotate key lifecycle ──────────────────────────────────────────────────
echo ""
echo "=== S8: Rotate key ==="
ROT_JSON=$(curl -s -X POST "$BASE/workspaces/$WS_ID/api-keys" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"name":"smoke-rotate","permissions":["*"]}')
OLD_KEY=$(echo "$ROT_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('key',''))" 2>/dev/null || echo "")
ROT_ID=$(echo "$ROT_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")

NEW_ROT=$(curl -s -X POST "$BASE/workspaces/$WS_ID/api-keys/$ROT_ID/rotate" \
  -H "Authorization: Bearer $JWT")
NEW_KEY=$(echo "$NEW_ROT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('key',''))" 2>/dev/null || echo "")

S8_OLD=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/workspaces/$WS_ID" \
  -H "Authorization: Bearer $OLD_KEY")
check_http "S8a: old key rejected after rotate" "401" "$S8_OLD"

S8_NEW=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/workspaces/$WS_ID" \
  -H "Authorization: Bearer $NEW_KEY")
check_http "S8b: new key accepted after rotate" "200" "$S8_NEW"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "────────────────────────────────────────"
echo "Phase B smoke test: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && echo "✅ ALL PASS" || echo "❌ FAILURES — fix before Phase C"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1

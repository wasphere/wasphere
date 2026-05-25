#!/usr/bin/env bash
# Phase C behavioral smoke test — multi-webhook CRUD
# Usage: bash scripts/smoke-test-phase-c.sh
set -uo pipefail

BASE="http://localhost:3000"
PASS=0
FAIL=0

pass() { echo "  PASS S$1: $2"; PASS=$((PASS+1)); }
fail() { echo "  FAIL S$1: $2 — got: $3"; FAIL=$((FAIL+1)); }

check_status() {
  local scenario=$1 label=$2 expected=$3 actual=$4
  if [ "$actual" = "$expected" ]; then
    pass "$scenario" "$label"
  else
    fail "$scenario" "$label" "HTTP $actual (expected $expected)"
  fi
}

# --- Setup: register user and grab workspace ---------------------------------
REGISTER=$(curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke-c-'"$(date +%s)"'@test.com","password":"SmokePass1!"}')
JWT=$(echo "$REGISTER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['accessToken'])" 2>/dev/null || echo "")
WS_ID=$(echo "$REGISTER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['workspace']['id'])" 2>/dev/null || echo "")

if [ -z "$JWT" ] || [ -z "$WS_ID" ]; then
  echo "SETUP FAILED: could not register or parse token/workspace"
  exit 1
fi

AUTH="Authorization: Bearer $JWT"
echo "Workspace: $WS_ID"

# Register a second user (for cross-workspace test)
REGISTER2=$(curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke-c2-'"$(date +%s)"'@test.com","password":"SmokePass1!"}')
JWT2=$(echo "$REGISTER2" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['accessToken'])" 2>/dev/null || echo "")
WS_ID2=$(echo "$REGISTER2" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['workspace']['id'])" 2>/dev/null || echo "")

echo ""
echo "=== Phase C Webhook Behavioral Smoke Test ==="
echo ""

# S1: Unauthenticated list → 401
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/workspaces/$WS_ID/webhooks")
check_status 1 "Unauthenticated GET /webhooks → 401" "401" "$STATUS"

# S2: Authenticated list on empty workspace → 200 with []
RESP=$(curl -s -w "\n%{http_code}" -H "$AUTH" "$BASE/workspaces/$WS_ID/webhooks")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -1)
if [ "$STATUS" = "200" ]; then
  COUNT=$(echo "$BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "-1")
  if [ "$COUNT" = "0" ]; then
    pass 2 "Authenticated GET /webhooks empty workspace → 200 []"
  else
    fail 2 "Authenticated GET /webhooks empty workspace → 200 []" "count=$COUNT"
  fi
else
  fail 2 "Authenticated GET /webhooks empty workspace → 200 []" "HTTP $STATUS"
fi

# S3: Create webhook → 201, signingSecret present in response
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/workspaces/$WS_ID/webhooks" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"name":"Test Hook","url":"http://localhost:9999/recv","events":["message.received"]}')
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -1)
WH_ID=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null || echo "")
HAS_SECRET=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('signingSecret') else 'no')" 2>/dev/null || echo "no")
if [ "$STATUS" = "201" ] && [ -n "$WH_ID" ] && [ "$HAS_SECRET" = "yes" ]; then
  pass 3 "Create webhook → 201 with signingSecret"
else
  fail 3 "Create webhook → 201 with signingSecret" "HTTP $STATUS id=$WH_ID secret=$HAS_SECRET"
fi

# S4: List after create → 200, signingSecret NOT in list response
RESP=$(curl -s -w "\n%{http_code}" -H "$AUTH" "$BASE/workspaces/$WS_ID/webhooks")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -1)
if [ "$STATUS" = "200" ]; then
  HAS_SECRET=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d[0].get('signingSecret') else 'no')" 2>/dev/null || echo "no")
  if [ "$HAS_SECRET" = "no" ]; then
    pass 4 "List webhooks → signingSecret NOT exposed"
  else
    fail 4 "List webhooks → signingSecret NOT exposed" "signingSecret present in list"
  fi
else
  fail 4 "List webhooks → signingSecret NOT exposed" "HTTP $STATUS"
fi

# S5: Create with invalid event → 400
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/workspaces/$WS_ID/webhooks" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"name":"Bad Hook","url":"http://localhost:9999/recv","events":["not.a.real.event.xyz"]}')
check_status 5 "Create with invalid event → 400" "400" "$STATUS"

# S6: Create with wildcard event ["*"] → 201
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/workspaces/$WS_ID/webhooks" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"name":"Wildcard Hook","url":"http://localhost:9999/wildcard","events":["*"]}')
STATUS=$(echo "$RESP" | tail -1)
check_status 6 "Create with wildcard events [*] → 201" "201" "$STATUS"

# S7: Update webhook name → 200
if [ -n "$WH_ID" ]; then
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/workspaces/$WS_ID/webhooks/$WH_ID" \
    -H "$AUTH" -H "Content-Type: application/json" \
    -d '{"name":"Updated Hook Name"}')
  check_status 7 "PATCH webhook name → 200" "200" "$STATUS"
else
  fail 7 "PATCH webhook name → 200" "no webhook ID from S3"
fi

# S8: Cross-workspace access → 403 (user2 accesses user1 workspace)
if [ -n "$JWT2" ] && [ -n "$WH_ID" ]; then
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $JWT2" \
    "$BASE/workspaces/$WS_ID/webhooks")
  check_status 8 "Cross-workspace GET /webhooks → 403" "403" "$STATUS"
else
  fail 8 "Cross-workspace GET /webhooks → 403" "no second user JWT"
fi

# S9: Test-fire → 200 with {success, statusCode, error} shape (receiver offline = success:false is ok)
if [ -n "$WH_ID" ]; then
  RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/workspaces/$WS_ID/webhooks/$WH_ID/test" \
    -H "$AUTH")
  STATUS=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | head -1)
  if [ "$STATUS" = "200" ]; then
    HAS_SHAPE=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if 'success' in d and 'statusCode' in d and 'error' in d else 'no')" 2>/dev/null || echo "no")
    if [ "$HAS_SHAPE" = "yes" ]; then
      pass 9 "Test-fire → 200 with {success, statusCode, error}"
    else
      fail 9 "Test-fire → 200 with {success, statusCode, error}" "shape mismatch: $BODY"
    fi
  else
    fail 9 "Test-fire → 200 with {success, statusCode, error}" "HTTP $STATUS"
  fi
else
  fail 9 "Test-fire → 200 with {success, statusCode, error}" "no webhook ID from S3"
fi

# S10: Delete webhook → 200, then list returns one fewer
if [ -n "$WH_ID" ]; then
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/workspaces/$WS_ID/webhooks/$WH_ID" \
    -H "$AUTH")
  if [ "$STATUS" = "200" ]; then
    RESP=$(curl -s -w "\n%{http_code}" -H "$AUTH" "$BASE/workspaces/$WS_ID/webhooks")
    LIST_STATUS=$(echo "$RESP" | tail -1)
    BODY=$(echo "$RESP" | head -1)
    COUNT=$(echo "$BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "-1")
    # wildcard hook still exists → count should be 1
    if [ "$LIST_STATUS" = "200" ] && [ "$COUNT" = "1" ]; then
      pass 10 "DELETE webhook → 200, list count decrements"
    else
      fail 10 "DELETE webhook → 200, list count decrements" "list HTTP $LIST_STATUS count=$COUNT"
    fi
  else
    fail 10 "DELETE webhook → 200, list count decrements" "DELETE returned HTTP $STATUS"
  fi
else
  fail 10 "DELETE webhook → 200, list count decrements" "no webhook ID from S3"
fi

echo ""
echo "=== Results: $PASS/10 passed, $FAIL/10 failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1

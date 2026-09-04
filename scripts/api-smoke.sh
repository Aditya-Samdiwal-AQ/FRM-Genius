#!/usr/bin/env bash
# API smoke test — Plan.md §9 Phase 4, §13.
# Exercises every endpoint end-to-end against a running dev server:
#   1. GET  /api/payer-changes?status=open
#   2. GET  /api/payer-changes/:id
#   3. GET  /api/materials?change_type=...
#   4. GET  /api/accounts
#   5. POST /api/payer-changes/:id/resolve
#   6. POST /api/payer-changes/:id/notify   (mock transport → data/outbox/*.eml)
#   7. GET  /api/payer-changes/:id/audit
#   8. POST /api/dev/reset                  (restores pristine state)
#
# Usage: npm run smoke   (expects `npm run dev` on :3000)

set -u -o pipefail

BASE="${1:-http://localhost:3000}"
PASS=0
FAIL=0
BODY_FILE=/tmp/frm-smoke-body
STATUS_FILE=/tmp/frm-smoke-status

say()  { printf '\n\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; PASS=$((PASS+1)); }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$1"; FAIL=$((FAIL+1)); }

# curl wrapper: body -> $BODY_FILE, status -> $STATUS_FILE, body on stdout
req() { # method path [body]
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -s -o "$BODY_FILE" -w '%{http_code}' -X "$method" \
      -H 'Content-Type: application/json' -d "$body" "$BASE$path" > "$STATUS_FILE"
  else
    curl -s -o "$BODY_FILE" -w '%{http_code}' -X "$method" "$BASE$path" > "$STATUS_FILE"
  fi
  cat "$BODY_FILE"
}

# call + capture: sets BODY and HTTP_STATUS in the current shell
call() { # method path [body]
  BODY=$(req "$@")
  HTTP_STATUS=$(cat "$STATUS_FILE")
}

expect_status() { # expected actual label
  if [ "$2" = "$1" ]; then ok "$3 (HTTP $2)"; else bad "$3 (expected $1, got $2)"; fi
  return 0
}

json() { # node expression over $BODY_FILE; empty string on parse failure
  node -e "try{const d=JSON.parse(require('fs').readFileSync('$BODY_FILE','utf8'));console.log($1)}catch{console.log('')}" 2>/dev/null
}

say "1. GET /api/payer-changes?status=open"
call GET "/api/payer-changes?status=open"
expect_status 200 "$HTTP_STATUS" "list open changes"
FIRST_ID=$(json 'd.groups?.[0]?.changes[0]?.id ?? ""')
OPEN_COUNT=$(json 'd.open_count ?? ""')
[ -n "$FIRST_ID" ] && ok "first open change: $FIRST_ID (open_count=$OPEN_COUNT)" || bad "no open changes found"

say "2. GET /api/payer-changes?status=resolved (empty at seed)"
call GET "/api/payer-changes?status=resolved"
expect_status 200 "$HTTP_STATUS" "list resolved changes"
[ "$(json 'd.total ?? -1')" = "0" ] && ok "0 resolved at seed" || bad "expected 0 resolved at seed"

say "3. GET /api/payer-changes/:id"
call GET "/api/payer-changes/$FIRST_ID"
expect_status 200 "$HTTP_STATUS" "change detail"
ACCT_COUNT=$(json 'd.accounts?.length ?? ""')
MAT_COUNT=$(json 'd.suggested_materials?.length ?? ""')
[ -n "$ACCT_COUNT" ] && ok "detail: $ACCT_COUNT accounts, $MAT_COUNT suggested materials" || bad "detail missing accounts/materials"
FIRST_MAT=$(json 'd.suggested_materials?.[0]?.id ?? ""')

say "4. GET /api/payer-changes/nonexistent (404)"
call GET "/api/payer-changes/nonexistent"
expect_status 404 "$HTTP_STATUS" "unknown id returns 404"

say "5. GET /api/materials?change_type=site_of_care_restriction"
call GET "/api/materials?change_type=site_of_care_restriction"
expect_status 200 "$HTTP_STATUS" "materials filtered"
ok "$(json 'd.total ?? "?"') matching material(s)"

say "6. GET /api/accounts"
call GET "/api/accounts"
expect_status 200 "$HTTP_STATUS" "accounts list"
ok "$(json 'd.total ?? "?"') accounts"

say "7. POST /api/payer-changes/:id/resolve (invalid body → 400)"
call POST "/api/payer-changes/$FIRST_ID/resolve" '{"corrected_path_source":"Bogus"}'
expect_status 400 "$HTTP_STATUS" "Zod rejects invalid body"

say "8. POST /api/payer-changes/:id/resolve"
call POST "/api/payer-changes/$FIRST_ID/resolve" \
  '{"corrected_path_source":"MMIT","corrected_path_value":"Physician Office only"}'
expect_status 200 "$HTTP_STATUS" "resolve change"
[ "$(json 'd.change?.status ?? ""')" = "resolved" ] && ok "status flipped to resolved" || bad "status not resolved"

say "9. POST /api/payer-changes/:id/notify"
call POST "/api/payer-changes/$FIRST_ID/notify" "{\"material_ids\":[\"$FIRST_MAT\"]}"
expect_status 200 "$HTTP_STATUS" "notify accounts"
TRANSPORT=$(json 'd.notification?.transport ?? ""')
[ "$TRANSPORT" = "mock" ] && ok "mock transport used (SMTP not configured)" || ok "transport: ${TRANSPORT:-?}"
if ls data/outbox/*.eml >/dev/null 2>&1; then
  ok ".eml written to data/outbox/ ($(ls data/outbox/*.eml | wc -l | tr -d ' ') file(s))"
else
  bad "outbox not cleared"
fi

say "10. GET /api/payer-changes/:id/audit"
call GET "/api/payer-changes/$FIRST_ID/audit"
expect_status 200 "$HTTP_STATUS" "audit trail"
EVENTS=$(json 'd.audit_events?.length ?? ""')
[ -n "$EVENTS" ] && ok "$EVENTS audit events recorded" || bad "no audit events"
node -e "
try{
  const d=JSON.parse(require('fs').readFileSync('$BODY_FILE','utf8'));
  const types=new Set(d.audit_events.map(e=>e.event_type));
  const need=['corrected_path_selected','accounts_resolved','materials_attached','path_communicated','resolution_recorded'];
  const missing=need.filter(t=>!types.has(t));
  if(missing.length){console.error('  ✗ missing audit events: '+missing.join(', '));process.exit(1);}
  console.log('  ✓ all expected audit event types present');
}catch(e){console.error('  ✗ audit check failed: '+e.message);process.exit(1);}
" && PASS=$((PASS+1)) || FAIL=$((FAIL+1))

say "11. POST /api/dev/reset"
call POST "/api/dev/reset"
expect_status 200 "$HTTP_STATUS" "dev reset"
ok "$(json '"reset: "+(d.total_changes ?? "?")+" changes, "+(d.open_changes ?? "?")+" open"')"
[ "$(ls data/outbox/*.eml 2>/dev/null | wc -l | tr -d ' ')" = "0" ] \
  && ok "outbox cleared" || bad "outbox not cleared"

say "12. GET /api/payer-changes?status=open (after reset — back to pristine)"
call GET "/api/payer-changes?status=open"
expect_status 200 "$HTTP_STATUS" "list after reset"
[ "$(json 'd.open_count ?? -1')" = "$OPEN_COUNT" ] \
  && ok "open_count restored to $OPEN_COUNT" || bad "open_count mismatch after reset"

printf '\n\033[1mResults: %d passed, %d failed\033[0m\n' "$PASS" "$FAIL"
[ "$FAIL" = "0" ]

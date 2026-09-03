#!/usr/bin/env bash
#
# End-to-end smoke test against the Firebase emulators.
#
# This never touches production. It mints throwaway users from the auth
# emulator, so no Google sign-in is needed, and every write lands in the local
# Firestore emulator.
#
# Prerequisites (none of these is installed by this repo):
#   - a JDK, which the Firestore emulator needs
#   - firebase-tools:  npm i -g firebase-tools
#   - Docker, for the Redis the API requires
#
# Run, from the repository root:
#   docker compose up -d redis
#   firebase emulators:start --only auth,firestore --project saturnalia-dev
#
# then, in a second shell:
#   cd backend
#   FIRESTORE_EMULATOR_HOST=localhost:8081 \
#   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
#   FIREBASE_PROJECT_ID=saturnalia-dev \
#   QR_SIGNING_SECRET=smoke-secret \
#   REDIS_URL=redis://localhost:6379/0 \
#   go run ./cmd/api
#
# then, in a third shell:
#   ./scripts/smoke.sh

set -uo pipefail

API=${API:-http://localhost:6767/api/v1}
AUTH_HOST=${FIREBASE_AUTH_EMULATOR_HOST:-localhost:9099}
FS_HOST=${FIRESTORE_EMULATOR_HOST:-localhost:8081}
PROJECT=${FIREBASE_PROJECT_ID:-saturnalia-dev}

pass=0
fail=0

# ---------------------------------------------------------------- helpers ---

jget() { python -c "import json,sys;d=json.load(sys.stdin);print(eval('d'+'$1') if '$1' else d)" 2>/dev/null; }

# call METHOD PATH [TOKEN] [BODY] -> sets $STATUS and $BODY
call() {
  local method=$1 path=$2 token=${3:-} body=${4:-}
  local args=(-s -X "$method" -o /tmp/smoke.out -w '%{http_code}' -H 'Content-Type: application/json')
  [[ -n $token ]] && args+=(-H "Authorization: Bearer $token")
  [[ -n $body ]] && args+=(-d "$body")
  STATUS=$(curl "${args[@]}" "$API$path")
  BODY=$(cat /tmp/smoke.out)
}

# expect DESCRIPTION EXPECTED_STATUS
expect() {
  local what=$1 want=$2
  if [[ $STATUS == "$want" ]]; then
    printf '  ok    %-58s %s\n' "$what" "$STATUS"
    pass=$((pass + 1))
  else
    printf '  FAIL  %-58s got %s want %s\n' "$what" "$STATUS" "$want"
    printf '        %s\n' "${BODY:0:300}"
    fail=$((fail + 1))
  fi
}

# mkuser EMAIL -> echoes "idToken uid"
mkuser() {
  curl -s -X POST \
    "http://$AUTH_HOST/identitytoolkit.googleapis.com/v1/accounts:signUp?key=any" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"smoke-password\",\"returnSecureToken\":true}" |
    python -c "import json,sys;d=json.load(sys.stdin);print(d['idToken'],d['localId'])"
}

# Role lives on the user document, so promoting an admin is a direct emulator
# write rather than an API call.
promote_admin() {
  curl -s -o /dev/null -X PATCH \
    "http://$FS_HOST/v1/projects/$PROJECT/databases/(default)/documents/users/$1?updateMask.fieldPaths=roles" \
    -H 'Content-Type: application/json' \
    -d '{"fields":{"roles":{"arrayValue":{"values":[{"stringValue":"user"},{"stringValue":"admin"}]}}}}'
}

complete_profile() {
  call PATCH /me "$1" '{"displayName":"Smoke Tester","phoneNumber":"9999999999","rollNumber":"102203999","collegeName":"Thapar Institute of Engineering and Technology","gender":"Male","graduationYear":"2029"}'
}

section() { printf '\n%s\n' "$1"; }

# ------------------------------------------------------------------ setup ---

echo "smoke test against $API"
curl -sf -m 3 "${API%/api/v1}/healthz" >/dev/null || {
  echo "the API is not answering on ${API%/api/v1}/healthz"
  exit 1
}

read -r ADMIN_TOKEN ADMIN_UID < <(mkuser "admin-$RANDOM@thapar.edu")
read -r LEADER_TOKEN LEADER_UID < <(mkuser "leader-$RANDOM@thapar.edu")
read -r MEMBER_TOKEN MEMBER_UID < <(mkuser "member-$RANDOM@thapar.edu")
read -r OUTSIDER_TOKEN OUTSIDER_UID < <(mkuser "outsider-$RANDOM@gmail.com")

FUTURE=$(python -c "import datetime;print((datetime.datetime.now(datetime.UTC)+datetime.timedelta(days=30)).strftime('%Y-%m-%dT%H:%M:%S.000Z'))")
PAST=$(python -c "import datetime;print((datetime.datetime.now(datetime.UTC)-datetime.timedelta(days=1)).strftime('%Y-%m-%dT%H:%M:%S.000Z'))")

section "session and profile"
for t in "$ADMIN_TOKEN" "$LEADER_TOKEN" "$MEMBER_TOKEN" "$OUTSIDER_TOKEN"; do
  call POST /auth/session "$t"
  expect "POST /auth/session" 201
done

call GET /me "$LEADER_TOKEN"
expect "GET /me before completing the profile" 200

section "profile gate"
call POST /events/anything/register "$LEADER_TOKEN"
expect "register with an incomplete profile is refused" 403

for t in "$ADMIN_TOKEN" "$LEADER_TOKEN" "$MEMBER_TOKEN" "$OUTSIDER_TOKEN"; do
  complete_profile "$t"
  expect "PATCH /me completes the profile" 200
done

promote_admin "$ADMIN_UID"

section "admin event CRUD"
call POST /admin/events "$LEADER_TOKEN" '{"title":"Nope","category":"Technical","eventType":"individual"}'
expect "a non-admin cannot create an event" 403

SOLO=$(cat <<JSON
{"title":"Smoke Solo Event","category":"Technical","eventType":"individual",
 "startDateTime":"$FUTURE","endDateTime":"$FUTURE","registrationDeadline":"$FUTURE",
 "isPublic":true,"maxParticipants":2,"registrationFee":{"host":0,"other":0}}
JSON
)
call POST /admin/events "$ADMIN_TOKEN" "$SOLO"
expect "admin creates an individual event" 201
SOLO_ID=$(echo "$BODY" | jget "['event']['id']")

TEAM=$(cat <<JSON
{"title":"Smoke Team Event","category":"Cultural","eventType":"team",
 "startDateTime":"$FUTURE","endDateTime":"$FUTURE","registrationDeadline":"$FUTURE",
 "isPublic":true,"minTeamSize":2,"maxTeamSize":2}
JSON
)
call POST /admin/events "$ADMIN_TOKEN" "$TEAM"
expect "admin creates a team event" 201
TEAM_ID=$(echo "$BODY" | jget "['event']['id']")

call POST /admin/events "$ADMIN_TOKEN" "$SOLO"
expect "a duplicate title is refused" 409

call POST /admin/events "$ADMIN_TOKEN" '{"title":"Bad Category","category":"Nonsense","eventType":"individual"}'
expect "an unknown category is refused" 400

call POST /admin/events "$ADMIN_TOKEN" "{\"title\":\"Bad Dates\",\"category\":\"Technical\",\"eventType\":\"individual\",\"startDateTime\":\"$PAST\",\"endDateTime\":\"$PAST\",\"registrationDeadline\":\"$FUTURE\"}"
expect "a deadline after the start is refused" 400

call PATCH "/admin/events/$SOLO_ID" "$ADMIN_TOKEN" '{"shortDescription":"edited"}'
expect "admin edits an event" 200

section "browsing"
call GET "/events?category=Technical" ""
expect "anonymous list with a category filter" 200
call GET "/events?q=smoke" ""
expect "search by substring" 200
call GET /events/categories ""
expect "category list" 200
call GET "/events/$SOLO_ID" "$LEADER_TOKEN"
expect "event detail" 200

section "individual registration"
call POST "/events/$SOLO_ID/register" "$LEADER_TOKEN"
expect "leader registers" 201
REG_ID=$(echo "$BODY" | jget "['registration']['registrationId']")
QR=$(echo "$BODY" | jget "['registration']['qrToken']")
[[ $REG_ID == "${SOLO_ID}_${LEADER_UID}" ]] &&
  { printf '  ok    %-58s %s\n' "registration ID follows the live convention" "$REG_ID"; pass=$((pass + 1)); } ||
  { printf '  FAIL  %-58s %s\n' "registration ID follows the live convention" "$REG_ID"; fail=$((fail + 1)); }
[[ -n $QR && $QR == *.* ]] &&
  { printf '  ok    %-58s\n' "QR token is signed"; pass=$((pass + 1)); } ||
  { printf '  FAIL  %-58s %s\n' "QR token is signed" "$QR"; fail=$((fail + 1)); }

call POST "/events/$SOLO_ID/register" "$LEADER_TOKEN"
expect "double registration is refused" 409

call GET "/registrations/$REG_ID" "$MEMBER_TOKEN"
expect "another user cannot read the registration" 403

call GET /me/events "$LEADER_TOKEN"
expect "GET /me/events" 200

call POST "/events/$SOLO_ID/teams" "$LEADER_TOKEN" '{"teamName":"Wrong Endpoint"}'
expect "team endpoint refuses an individual event" 400

section "capacity"
call POST "/events/$SOLO_ID/register" "$MEMBER_TOKEN"
expect "second registration fills the event" 201
call POST "/events/$SOLO_ID/register" "$OUTSIDER_TOKEN"
expect "a full event is refused" 409

section "teams"
call POST "/events/$TEAM_ID/teams" "$LEADER_TOKEN" '{"teamName":"Smoke Squad"}'
expect "leader creates a team" 201
CODE=$(echo "$BODY" | jget "['inviteCode']")
TEAM_REF=$(echo "$BODY" | jget "['team']['teamId']")

call POST "/events/$TEAM_ID/register" "$MEMBER_TOKEN"
expect "individual endpoint refuses a team event" 400

call POST /teams/join "$MEMBER_TOKEN" "{\"inviteCode\":\"$CODE\"}"
expect "member joins by invite code" 200

call POST /teams/join "$MEMBER_TOKEN" "{\"inviteCode\":\"$CODE\"}"
expect "joining twice is refused" 409

call POST /teams/join "$OUTSIDER_TOKEN" "{\"inviteCode\":\"$CODE\"}"
expect "a full team is refused" 409

call POST /teams/join "$OUTSIDER_TOKEN" '{"inviteCode":"ZZZZZZ"}'
expect "an unknown invite code is refused" 404

call GET "/teams/$TEAM_REF" "$MEMBER_TOKEN"
expect "member reads the team" 200

call POST "/teams/$TEAM_REF/leave" "$LEADER_TOKEN"
expect "the leader cannot leave while members remain" 409

call DELETE "/teams/$TEAM_REF" "$LEADER_TOKEN"
expect "the leader cannot delete a team with members" 409

call DELETE "/teams/$TEAM_REF/members/$MEMBER_UID" "$MEMBER_TOKEN"
expect "a member cannot remove another member" 403

call POST "/teams/$TEAM_REF/leave" "$MEMBER_TOKEN"
expect "member leaves the team" 200

call DELETE "/teams/$TEAM_REF" "$LEADER_TOKEN"
expect "leader deletes the now-empty team" 204

call GET "/teams/$TEAM_REF" "$LEADER_TOKEN"
expect "the deleted team is gone" 404

section "remove-member path"
call POST "/events/$TEAM_ID/teams" "$LEADER_TOKEN" '{"teamName":"Second Squad"}'
expect "leader creates another team" 201
CODE2=$(echo "$BODY" | jget "['inviteCode']")
REF2=$(echo "$BODY" | jget "['team']['teamId']")

call POST /teams/join "$MEMBER_TOKEN" "{\"inviteCode\":\"$CODE2\"}"
expect "member joins" 200
call DELETE "/teams/$REF2/members/$LEADER_UID" "$LEADER_TOKEN"
expect "the leader cannot remove themselves" 400
call DELETE "/teams/$REF2/members/$MEMBER_UID" "$LEADER_TOKEN"
expect "leader removes the member" 200
call POST "/teams/$REF2/transfer-leader" "$LEADER_TOKEN" "{\"userId\":\"$MEMBER_UID\"}"
expect "cannot transfer to a non-member" 400
call DELETE "/teams/$REF2" "$LEADER_TOKEN"
expect "leader deletes the team" 204

section "restricted and closed events"
call POST /admin/events "$ADMIN_TOKEN" "{\"title\":\"Smoke Host Only\",\"category\":\"Technical\",\"eventType\":\"individual\",\"registrationDeadline\":\"$FUTURE\",\"isPublic\":true,\"sameCollegeOnly\":true}"
expect "admin creates a host-only event" 201
HOST_ONLY=$(echo "$BODY" | jget "['event']['id']")
call POST "/events/$HOST_ONLY/register" "$OUTSIDER_TOKEN"
expect "an external user is refused on a host-only event" 403
call POST "/events/$HOST_ONLY/register" "$LEADER_TOKEN"
expect "a host student is accepted" 201

call POST /admin/events "$ADMIN_TOKEN" "{\"title\":\"Smoke Closed\",\"category\":\"Technical\",\"eventType\":\"individual\",\"registrationDeadline\":\"$PAST\",\"isPublic\":true}"
expect "admin creates a closed event" 201
CLOSED=$(echo "$BODY" | jget "['event']['id']")
call POST "/events/$CLOSED/register" "$MEMBER_TOKEN"
expect "registering past the deadline is refused" 409

call POST /admin/events "$ADMIN_TOKEN" "{\"title\":\"Smoke External\",\"category\":\"Technical\",\"eventType\":\"externalLink\",\"externalUrl\":\"https://example.test\",\"registrationDeadline\":\"$FUTURE\",\"isPublic\":true}"
expect "admin creates an externalLink event" 201
EXTERNAL=$(echo "$BODY" | jget "['event']['id']")
call POST "/events/$EXTERNAL/register" "$MEMBER_TOKEN"
expect "an externalLink event cannot be registered for" 400

section "deletion"
call DELETE "/admin/events/$SOLO_ID" "$ADMIN_TOKEN"
expect "deleting an event with registrations is refused" 409
call DELETE "/admin/events/$SOLO_ID?force=true" "$ADMIN_TOKEN"
expect "force unpublishes instead" 200
call DELETE "/admin/events/$EXTERNAL" "$ADMIN_TOKEN"
expect "an event with no registrations is deleted" 204

section "auth"
call GET /me "" ""
expect "no token is refused" 401
call GET /me "not-a-real-token"
expect "a bad token is refused" 401

# ----------------------------------------------------------------- result ---

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[[ $fail -eq 0 ]]

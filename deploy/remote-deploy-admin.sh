#!/usr/bin/env bash
#
# Runs ON THE SERVER, started by the GitHub Actions workflow. The admin panel is plain files that
# nginx serves, so this swaps the folder and nothing is restarted. Puts the old files back if the
# panel doesn't answer afterwards.
#
# Expects: INCOMING (the uploaded dist), ADMIN_DIR (the folder nginx serves), ADMIN_HOST, COMMIT.
set -euo pipefail

: "${INCOMING:?}" "${ADMIN_DIR:?}" "${ADMIN_HOST:?}"
STAMP="$(date +%F-%H%M%S)"
STAGE="${ADMIN_DIR}.new"
PREVIOUS="${ADMIN_DIR}.before-${STAMP}"
KEEP=3

say()  { printf '\n==> %s\n' "$*"; }
fail() { printf '\nFAILED: %s\n' "$*" >&2; exit 1; }

exec 9>/tmp/panchayat-admin-deploy.lock
flock -n 9 || fail "Another admin deploy is running."

say "Checks (commit ${COMMIT:-unknown})"
[ -f "$INCOMING/index.html" ] || fail "The upload has no index.html."
[ -d "$ADMIN_DIR" ] || fail "$ADMIN_DIR doesn't exist."
[ -w "$(dirname "$ADMIN_DIR")" ] || fail "$(dirname "$ADMIN_DIR") isn't writable by $(id -un)."

say "Switching over"
rm -rf "$STAGE"
cp -a "$INCOMING" "$STAGE"
chmod -R a+rX "$STAGE"
mv "$ADMIN_DIR" "$PREVIOUS"
mv "$STAGE" "$ADMIN_DIR"

# Ask nginx for the panel itself, on this machine
CODE="$(curl -s -k -m 8 -o /dev/null -w '%{http_code}' --resolve "${ADMIN_HOST}:443:127.0.0.1" "https://${ADMIN_HOST}/" || true)"
if [ "$CODE" != 200 ]; then
  mv "$ADMIN_DIR" "${ADMIN_DIR}.failed-${STAMP}"
  mv "$PREVIOUS" "$ADMIN_DIR"
  fail "The panel answered $CODE after the switch, so the old files are back."
fi

# Tidying up must never fail a deploy that worked (ls exits 2 when nothing matches)
{ ls -1dt "${ADMIN_DIR}".before-* 2>/dev/null || true; } | tail -n +$((KEEP + 1)) | xargs -r rm -rf || true
{ ls -1dt "${ADMIN_DIR}".failed-* 2>/dev/null || true; } | tail -n +2 | xargs -r rm -rf || true
say "Admin panel deployed (previous files kept as $PREVIOUS)"

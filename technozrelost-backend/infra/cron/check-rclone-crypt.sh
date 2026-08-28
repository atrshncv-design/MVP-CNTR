#!/bin/sh
# Безопасная проверка rclone-target без вывода содержимого конфигурации.
set -eu

REMOTE="${1:-${BACKUP_OFFSITE_REMOTE:-}}"
if [ -z "$REMOTE" ]; then
  exit 0
fi

case "$REMOTE" in
  *:*) ;;
  *) exit 1 ;;
esac

command -v rclone >/dev/null 2>&1 || exit 1
RCLONE_CONFIG="${RCLONE_CONFIG:-}"
[ -n "$RCLONE_CONFIG" ] && [ -s "$RCLONE_CONFIG" ] || exit 1

REMOTE_NAME="${REMOTE%%:*}"
[ -n "$REMOTE_NAME" ] && [ "$REMOTE_NAME" != "$REMOTE" ] || exit 1

CONFIG_OUTPUT="$(mktemp "${TMPDIR:-/tmp}/tz-rclone-guard.XXXXXX")"
if ! rclone --config "$RCLONE_CONFIG" config show "$REMOTE_NAME" >"$CONFIG_OUTPUT" 2>/dev/null; then
  rm -f -- "$CONFIG_OUTPUT"
  exit 1
fi

REMOTE_TYPE="$(sed -n \
  's/^[[:space:]]*type[[:space:]]*=[[:space:]]*//p' "$CONFIG_OUTPUT")" || {
  rm -f -- "$CONFIG_OUTPUT"
  exit 1
}
[ "$REMOTE_TYPE" = "crypt" ] || {
  rm -f -- "$CONFIG_OUTPUT"
  exit 1
}

NO_DATA_ENCRYPTION="$(awk '
  /^[[:space:]]*no_data_encryption[[:space:]]*=/ {
    sub(/^[^=]*=/, "")
    gsub(/[[:space:]]/, "")
    print tolower($0)
    exit
  }
' "$CONFIG_OUTPUT")" || {
  rm -f -- "$CONFIG_OUTPUT"
  exit 1
}
rm -f -- "$CONFIG_OUTPUT"
case "$NO_DATA_ENCRYPTION" in
  true|1|yes|on) exit 1 ;;
esac

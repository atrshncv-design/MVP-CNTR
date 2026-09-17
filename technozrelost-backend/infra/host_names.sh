#!/usr/bin/env bash
# Общие проверки имён публичного контура (таск 07: sslip.io + R08: свой домен).
# Sourcing-библиотека для tls_issue.sh, tls_renew.sh, render_legacy_redirect.sh
# и deploy.sh (все уже делают cd в свой каталог, подключают как `. ./host_names.sh`).
#
# PUBLIC_HOST / LEGACY_PUBLIC_HOST — один из двух форматов:
#   - техническое имя `<ipv4>.sslip.io` (октеты точками или дефисами,
#     разделители единообразны, октеты 0..255) — старт без покупки домена;
#   - собственный домен (FQDN): метки LDH длиной 1..63, минимум две метки,
#     TLD — буквы (минимум 2) либо punycode `xn--...`; итого не длиннее
#     253 символов; подзона sslip.io сюда не входит (это технический формат).
# `vash-domen.ru` — плейсхолдер из документации: формат проходит, но как
# значение запрещён везде (fail-closed — впишите купленное имя).
#
# Почему свой домен (R08): репутационные фильтры мобильных операторов
# к wildcard-DNS — с телефонов платформа без VPN открывается только
# на собственном имени.
#
# Bash 3.2-совместимо (macOS): без ассоциативных массивов, без ${var,,},
# регэкспы — через переменные без кавычек, массивы только непустые.

# Guard от двойного подключения.
if [ -n "${HOST_NAMES_SH_LOADED:-}" ]; then
  return 0 2>/dev/null || exit 0
fi
HOST_NAMES_SH_LOADED=1

HOST_OWN_PLACEHOLDER="vash-domen.ru"

_host_lower() {
  printf '%s' "${1:-}" | LC_ALL=C tr '[:upper:]' '[:lower:]'
}

# host_is_sslip <host> — техническое имя <ipv4>.sslip.io (rc 0 — да).
host_is_sslip() {
  local lowered="$(_host_lower "${1:-}")"
  local ip o1 o2 o3 o4 rest octet
  [ -n "$lowered" ] || return 1
  if [[ $lowered =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.sslip\.io$ ]]; then
    ip="${lowered%.sslip.io}"
  elif [[ $lowered =~ ^[0-9]{1,3}-[0-9]{1,3}-[0-9]{1,3}-[0-9]{1,3}\.sslip\.io$ ]]; then
    ip="${lowered%.sslip.io}"
    ip="${ip//-/.}"
  else
    return 1
  fi
  IFS='.' read -r o1 o2 o3 o4 rest <<< "$ip"
  if [ -n "${rest:-}" ]; then
    return 1
  fi
  for octet in "$o1" "$o2" "$o3" "$o4"; do
    if [[ ! $octet =~ ^[0-9]+$ ]] || (( 10#$octet > 255 )); then
      return 1
    fi
  done
  return 0
}

# host_is_own <host> — собственный домен FQDN (rc 0 — да).
host_is_own() {
  local host="${1:-}"
  local lowered tld_re tld
  [ -n "$host" ] || return 1
  [ "${#host}" -le 253 ] || return 1
  lowered="$(_host_lower "$host")"
  case "$lowered" in
    *localhost* | *127.0.0.1* | *0.0.0.0*) return 1 ;;
  esac
  case "$lowered" in
    *.sslip.io) return 1 ;;
  esac
  [ "$lowered" != "$HOST_OWN_PLACEHOLDER" ] || return 1
  tld_re='^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$'
  [[ $host =~ $tld_re ]] || return 1
  tld="${host##*.}"
  tld_re='^[A-Za-z]{2,}$'
  if [[ $tld =~ $tld_re ]]; then
    return 0
  fi
  case "$(_host_lower "$tld")" in
    xn--*) ;;
    *) return 1 ;;
  esac
  tld_re='^[A-Za-z0-9-]+$'
  [[ $tld =~ $tld_re ]] || return 1
  return 0
}

# host_is_valid <host> — любой из двух форматов, плейсхолдер запрещён.
host_is_valid() {
  local lowered="$(_host_lower "${1:-}")"
  [ -n "$lowered" ] || return 1
  [ "$lowered" != "$HOST_OWN_PLACEHOLDER" ] || return 1
  case "$lowered" in
    *localhost* | *127.0.0.1* | *0.0.0.0*) return 1 ;;
  esac
  if host_is_sslip "${1:-}"; then
    return 0
  fi
  if host_is_own "${1:-}"; then
    return 0
  fi
  return 1
}

# host_require_valid <KIND> <value> — проверка с понятной ошибкой в stderr.
# Сообщение держит префикс «должен быть техническим именем <ipv4>.sslip.io»:
# на него завязаны тесты валидации выпуска.
host_require_valid() {
  local kind="${1:-PUBLIC_HOST}" value="${2:-}"
  if [ -z "$value" ]; then
    echo "ОШИБКА: $kind должен быть техническим именем <ipv4>.sslip.io или собственным доменом (сейчас пуст)." >&2
    return 1
  fi
  if [ "$(_host_lower "$value")" = "$HOST_OWN_PLACEHOLDER" ]; then
    echo "ОШИБКА: $kind — плейсхолдер $HOST_OWN_PLACEHOLDER, впишите купленное имя (см. infra/README-OWN-DOMAIN.md)." >&2
    return 1
  fi
  if host_is_valid "$value"; then
    return 0
  fi
  echo "ОШИБКА: $kind должен быть техническим именем <ipv4>.sslip.io или собственным доменом." >&2
  return 1
}

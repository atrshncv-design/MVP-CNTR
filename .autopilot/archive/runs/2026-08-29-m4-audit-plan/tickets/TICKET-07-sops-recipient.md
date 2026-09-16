# TICKET-07: SOPS recipient (I-03)

- **Спека:** SPEC-04
- **Проблемы:** I-03 (`.sops.yaml:7` `age1ql3z7…placeholder` — шифрование не рабочее для прод)
- **Приоритет:** P3
- **Критичность:** Info
- **Сложность:** S
- **Зависимости:** —
- **Можно параллельно с:** TICKET-06,12

## Проблема
`.sops.yaml:7` `age: >- age1ql3z7…placeholder` — `secrets.enc.env` шифрован placeholder-ключом, `sops exec-env` на проде без `age-keygen` не сработает. `docs/SOPS.md` уже есть но ключ placeholder — для пилота `0600 .env` ок, для B2G нужен реальный `age1`.

## Требуемый результат
`docs/SOPS.md` раздел «Прод B2G» явно: pilot `0600 .env` допустим, prod `age-keygen -o age.key && sops --encrypt --age age1… secrets.enc.env` — placeholder остаётся в репо, реальный ключ в 1Password — отложено до B2G (P3).

## Объём работ
- `read .sops.yaml` + `docs/SOPS.md`.
- Добавить в `docs/SOPS.md` секцию «Отложено до B2G: placeholder ключ заменить `age-keygen`» с командами `age-keygen -o age.key` + `sops --encrypt --age age1… --in-place secrets.enc.env`.
- Не перешифровывать сейчас (pilot `0600` ок), только доку.

## Не входит
Code, `CVD` (TICKET-06).

## Компоненты
- Файлы: `.sops.yaml`, `docs/SOPS.md`, `technozrelost-backend/secrets.enc.env`

## План
1. `read docs/SOPS.md`.
2. Edit: добавить секцию «Отложено».
3. `grep age1` в `.sops.yaml` остаётся placeholder — доку.

## Пограничные случаи
- `secrets.enc.env` не содержит plaintext — `security_check` PASS.

## Тесты
- Нет, доку.

## Критерии приёмки
- [ ] `docs/SOPS.md` секция I-03 pilot 0600 / B2G age-keygen.
- [ ] `grep placeholder` в `.sops.yaml` остаётся (не реальный ключ в git).

## Команды проверки
- `cat docs/SOPS.md | grep -A5 "Отложено"`
- `grep -n age1 technozrelost-backend/.sops.yaml`

## Риски
- Реальный ключ не коммитить — только 1Password.

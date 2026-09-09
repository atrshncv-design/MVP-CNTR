"""Единый каталог пользовательских ошибок API (таск 01, R03).

Почему отдельный модуль: 100+ зашитых русских строк разбросаны по
app/api и app/services; единый источник даёт стабильные коды, тексты
ru/en и подстановки параметрами вместо склейки в местах вызова.

Контракт для следующих тасков: вызывать ``raise raise_error(...)`` —
код уходит в заголовок ``X-Error-Code``, тело ``detail`` остаётся
строкой (фронт понимает только строку), язык — из ``Accept-Language``
запроса, умолчание русское (текущее поведение сохраняется).
"""

from __future__ import annotations

from typing import Any, TypedDict

from fastapi import HTTPException

ERROR_HEADER = "X-Error-Code"
DEFAULT_LOCALE = "ru"
SUPPORTED_LOCALES = ("ru", "en")


class ErrorEntry(TypedDict):
    status: int
    ru: str
    en: str


CATALOG: dict[str, ErrorEntry] = {
    "AUTH_REQUIRED": ErrorEntry(
        status=401, ru="Не авторизован", en="Authentication required"
    ),
    "AUTH_INVALID_TOKEN": ErrorEntry(
        status=401, ru="Невалидный токен", en="Invalid token"
    ),
    "AUTH_USER_INACTIVE": ErrorEntry(
        status=401, ru="Пользователь неактивен", en="User is inactive"
    ),
    "AUTH_FORBIDDEN": ErrorEntry(
        status=403, ru="Недостаточно прав", en="Insufficient permissions"
    ),
    "AUTH_INVALID": ErrorEntry(
        status=401,
        ru="Неверный email или пароль",
        en="Invalid email or password",
    ),
    "AUTH_REGISTER_LIMIT": ErrorEntry(
        status=429,
        ru="Слишком много попыток регистрации",
        en="Too many registration attempts, please try again later",
    ),
    "AUTH_CNTR_ROLE_FORBIDDEN": ErrorEntry(
        status=403,
        ru="Роли работников ЦНТР назначаются администратором центра",
        en="CNTR staff roles are assigned by the center administrator",
    ),
    "AUTH_PRIVILEGED_ROLE_FORBIDDEN": ErrorEntry(
        status=403,
        ru="Привилегированная роль назначается администратором",
        en="Privileged roles are assigned by the administrator",
    ),
    "AUTH_UNKNOWN_ROLE": ErrorEntry(
        status=400, ru="Неизвестная роль: {role}", en="Unknown role: {role}"
    ),
    "AUTH_EMAIL_EXISTS": ErrorEntry(
        status=409,
        ru="Пользователь с таким email уже существует",
        en="A user with this email already exists",
    ),
    "AUTH_LOGIN_LIMIT": ErrorEntry(
        status=429,
        ru="Слишком много попыток входа",
        en="Too many login attempts, please try again later",
    ),
    "AUTH_ACCOUNT_DISABLED": ErrorEntry(
        status=403, ru="Аккаунт деактивирован", en="Account is deactivated"
    ),
    "AUTH_REFRESH_INVALID": ErrorEntry(
        status=401, ru="Невалидный refresh-токен", en="Invalid refresh token"
    ),
    "AUTH_REFRESH_REVOKED": ErrorEntry(
        status=401,
        ru="Refresh-токен отозван или не найден",
        en="Refresh token has been revoked or not found",
    ),
    "AUTH_REFRESH_EXPIRED": ErrorEntry(
        status=401, ru="Refresh-токен истёк", en="Refresh token has expired"
    ),
    "AUTH_WRONG_PASSWORD": ErrorEntry(
        status=401,
        ru="Неверный текущий пароль",
        en="Current password is incorrect",
    ),
    "USER_NOT_FOUND": ErrorEntry(
        status=404, ru="Пользователь не найден", en="User not found"
    ),
    "USER_UNKNOWN_ROLES": ErrorEntry(
        status=400, ru="Неизвестные роли: {roles}", en="Unknown roles: {roles}"
    ),
    "REGISTRY_RATE_LIMITED": ErrorEntry(
        status=429,
        ru="Слишком много запросов к реестру, попробуйте позже",
        en="Too many registry requests, please try again later",
    ),
    "ORG_NOT_FOUND": ErrorEntry(
        status=404, ru="Организация не найдена", en="Organization not found"
    ),
    "NIOKTR_CARD_NOT_FOUND": ErrorEntry(
        status=404, ru="Карточка НИОКТР не найдена", en="R&D card not found"
    ),
    "FILE_NOT_FOUND": ErrorEntry(
        status=404, ru="Файл не найден", en="File not found"
    ),
    "FILE_BLOCKED_INFECTED": ErrorEntry(
        status=409,
        ru="Файл заблокирован антивирусом",
        en="File is blocked by antivirus",
    ),
    "FILE_SCAN_PENDING": ErrorEntry(
        status=409,
        ru="Антивирусная проверка не пройдена — скачивание недоступно",
        en="Antivirus check has not passed — download is unavailable",
    ),
    "FILE_TOO_LARGE": ErrorEntry(
        status=422,
        ru="Файл превышает лимит {limit} МБ",
        en="File exceeds the {limit} MB limit",
    ),
    # Пара к FILE_TOO_LARGE: тот же текст, но 413 — поток чтения оборван
    # на лимите ДО записи (read_upload_limited → FileSizeExceeded), а 422 —
    # валидация уже прочитанного (store_* → ValueError). Статусы разные
    # исторически (история 5: тот же статус, что раньше, в каждой ветке).
    "FILE_UPLOAD_TOO_LARGE": ErrorEntry(
        status=413,
        ru="Файл превышает лимит {limit} МБ",
        en="File exceeds the {limit} MB limit",
    ),
    "FILE_BAD_FORMAT": ErrorEntry(
        status=422,
        ru="Недопустимый формат: разрешены PDF, DOCX, XLSX, PNG, JPEG",
        en="Invalid format: PDF, DOCX, XLSX, PNG, JPEG are allowed",
    ),
    "STORAGE_UNAVAILABLE": ErrorEntry(
        status=503,
        ru="MinIO недоступен: {detail}",
        en="MinIO is unavailable: {detail}",
    ),
    "STORAGE_OBJECT_MISSING": ErrorEntry(
        status=404, ru="Объект не найден", en="Object not found"
    ),
    "DOC_INVALID_TYPE": ErrorEntry(
        status=400,
        ru="Неверный тип документа. Допустимые: {valid_types}",
        en="Invalid document type. Allowed: {valid_types}",
    ),
    "DOC_TEMPLATE_MISSING": ErrorEntry(
        status=404,
        ru="Шаблон типа '{doc_type}' не найден в RAG-базе",
        en="Template of type '{doc_type}' was not found in the RAG database",
    ),
    "PROJECT_NOT_FOUND": ErrorEntry(
        status=404, ru="Проект не найден", en="Project not found"
    ),
    "PROJECT_NOT_PUBLISHED": ErrorEntry(
        status=409,
        ru="Проект ещё не опубликован менеджером",
        en="Project has not been published by a manager yet",
    ),
    "PROJECT_MAX_LEVEL": ErrorEntry(
        status=409,
        ru="Проект достиг максимального УГТ 9",
        en="Project has reached the maximum TRL 9",
    ),
    "PROJECT_STAGE_INVALID": ErrorEntry(
        status=400,
        ru="Требование не относится к текущему этапу проекта",
        en="Requirement does not belong to the current project stage",
    ),
    "PROJECT_REQUEST_MISSING": ErrorEntry(
        status=409,
        ru="Заявка не создана — загрузите документы этапа",
        en="Request is not created — upload the stage documents",
    ),
    "PROJECT_STAGE_UNKNOWN": ErrorEntry(
        status=409, ru="Этап не найден в словаре", en="Stage was not found"
    ),
    "PROJECT_ARCHIVED": ErrorEntry(
        status=409, ru="Проект уже в архиве", en="Project is already archived"
    ),
    "PROJECT_OWNER_ONLY": ErrorEntry(
        status=403, ru="Только владелец", en="Owner only"
    ),
    "PROJECT_DELETE_DRAFT_ONLY": ErrorEntry(
        status=409,
        ru=(
            "Удалить можно только пустой черновик без документов; "
            "верифицированный проект архивируется"
        ),
        en=(
            "Only an empty draft without documents can be deleted; "
            "a verified project is archived instead"
        ),
    ),
    "PROJECT_PUBLISH_FORBIDDEN": ErrorEntry(
        status=403,
        ru="Публикация доступна только администратору проекта или менеджеру",
        en="Publishing is available only to the project admin or a manager",
    ),
    "PROJECT_PUBLISH_NEEDS_CONFIRM": ErrorEntry(
        status=409,
        ru="Публикация требует подтверждения УГТ (авто для 1-2, менеджер для 3-9)",
        en="Publishing requires TRL confirmation (auto for 1-2, manager for 3-9)",
    ),
    "PROJECT_KT_FORBIDDEN": ErrorEntry(
        status=403,
        ru="Недостаточно прав для решения по КТ",
        en="Insufficient permissions for a checkpoint decision",
    ),
    "CONTROL_POINT_NOT_FOUND": ErrorEntry(
        status=404,
        ru="Контрольная точка не найдена",
        en="Checkpoint not found",
    ),
    "PROJECT_JOIN_REQUIRED": ErrorEntry(
        status=403,
        ru="Сначала присоединитесь к проекту по токену TZ-XXXXXX",
        en="Join the project with a TZ-XXXXXX token first",
    ),
    "STORED_FILE_MISSING": ErrorEntry(
        status=404,
        ru="Файл не найден в хранилище",
        en="File was not found in storage",
    ),
    "REQUEST_NOT_FOUND": ErrorEntry(
        status=404, ru="Заявка не найдена", en="Request not found"
    ),
    "REQUEST_NOT_FOUND_OR_DECIDED": ErrorEntry(
        status=404,
        ru="Заявка не найдена или уже рассмотрена",
        en="Request was not found or has already been decided",
    ),
    "REQUEST_CLOSED": ErrorEntry(
        status=409,
        ru="Заявка подтверждена — комментарии закрыты",
        en="Request is confirmed — comments are closed",
    ),
    "REQUEST_EMPTY_COMMENT": ErrorEntry(
        status=422, ru="Пустой комментарий", en="Empty comment"
    ),
    "REQUEST_CONCLUSION_PENDING": ErrorEntry(
        status=409,
        ru="Заключение доступно после решения менеджера",
        en="Conclusion is available after the manager decision",
    ),
    "REQUEST_VERSIONS_FORBIDDEN": ErrorEntry(
        status=403,
        ru="Очистка версий доступна администратору проекта или менеджеру",
        en="Version cleanup is available only to the project admin or a manager",
    ),
    "ASSESS_REEVAL_FORBIDDEN": ErrorEntry(
        status=403,
        ru="Переоценка недоступна — проект уже оценён; доработка идёт уровнями N→N+1.",
        en="Re-assessment is unavailable — the project is already assessed; "
        "improve it level by level (N to N+1).",
    ),
    "ASSESS_EMPTY": ErrorEntry(
        status=422,
        ru="Нужно заполнить экспресс-оценку.",
        en="Please complete the express assessment.",
    ),
    "ASSESS_STALE_TEMPLATE": ErrorEntry(
        status=409,
        ru="Версия анкеты устарела — обновите страницу и заполните актуальный шаблон.",
        en="Questionnaire version is outdated — refresh the page and fill in "
        "the current template.",
    ),
    "ASSESS_NA_NEEDS_REASON": ErrorEntry(
        status=422,
        ru="Для ответа «Неприменимо» нужно указать обоснование.",
        en="An answer 'Not applicable' requires justification.",
    ),
    "MEMBERSHIP_MODERATION_FORBIDDEN": ErrorEntry(
        status=403,
        ru="Недостаточно прав для модерации вступления",
        en="Insufficient permissions to moderate join requests",
    ),
    "MEMBERSHIP_TOKEN_INVALID": ErrorEntry(
        status=404, ru="Токен недействителен", en="Token is invalid"
    ),
    "MEMBERSHIP_ALREADY_PENDING": ErrorEntry(
        status=409,
        ru="Заявка уже отправлена на рассмотрение",
        en="Request has already been submitted for review",
    ),
    "MEMBERSHIP_EXCLUDED": ErrorEntry(
        status=409,
        ru="Вы были исключены из проекта",
        en="You have been removed from the project",
    ),
    "MEMBERSHIP_ALREADY_DECIDED": ErrorEntry(
        status=409, ru="Заявка уже рассмотрена", en="Request has already been decided"
    ),
    "MEMBERSHIP_ACTIVE_MISSING": ErrorEntry(
        status=404,
        ru="Активный участник не найден",
        en="Active member not found",
    ),
    "PROFILE_BAD_STATE_EDIT": ErrorEntry(
        status=409,
        ru=(
            "Профиль в состоянии «{state}» нельзя редактировать. "
            "Дождитесь решения или верните его в черновик."
        ),
        en=(
            "Profile in the '{state}' state cannot be edited. "
            "Wait for the decision or return it to draft."
        ),
    ),
    "PROFILE_BAD_STATE_SUBMIT": ErrorEntry(
        status=409,
        ru="Нельзя отправить профиль в состоянии «{state}».",
        en="Cannot submit a profile in the '{state}' state.",
    ),
    "PROFILE_HEADLINE_REQUIRED": ErrorEntry(
        status=422,
        ru="Укажите должность (headline)",
        en="Please provide the headline (position)",
    ),
    "PROFILE_NOT_FOUND": ErrorEntry(
        status=404, ru="Профиль не найден", en="Profile not found"
    ),
    "ORG_ALREADY_MEMBER": ErrorEntry(
        status=409,
        ru="Вы уже состоите в этой организации",
        en="You are already a member of this organization",
    ),
    "ORG_EDIT_FORBIDDEN": ErrorEntry(
        status=403,
        ru="Редактировать может только администратор организации",
        en="Only the organization administrator can edit",
    ),
    "ORG_NOT_EDITABLE": ErrorEntry(
        status=409,
        ru="Организация в состоянии «{state}» — редактирование закрыто",
        en="Organization in the '{state}' state is closed for editing",
    ),
    "ORG_SUBMIT_FORBIDDEN": ErrorEntry(
        status=403,
        ru="Отправить на проверку может администратор организации",
        en="Only the organization administrator can submit for review",
    ),
    "ORG_SUBMIT_BAD_STATE": ErrorEntry(
        status=409,
        ru="Нельзя отправить организацию в состоянии «{state}»",
        en="Cannot submit an organization in the '{state}' state",
    ),
    "REVIEW_BAD_STATUS": ErrorEntry(
        status=409,
        ru="Объект не в статусе pending (сейчас «{state}»)",
        en="Object is not in the pending status (now '{state}')",
    ),
    "INVITE_ADMIN_REQUIRED": ErrorEntry(
        status=403,
        ru="Требуется полномочие project_admin",
        en="The project_admin permission is required",
    ),
    "INVITE_NOT_FOUND": ErrorEntry(
        status=404, ru="Приглашение не найдено", en="Invite not found"
    ),
    "INVITE_REVOKED": ErrorEntry(
        status=409, ru="Приглашение отозвано", en="Invite has been revoked"
    ),
    "INVITE_EXPIRED": ErrorEntry(
        status=409, ru="Срок приглашения истёк", en="Invite has expired"
    ),
    "INVITE_LIMIT": ErrorEntry(
        status=409,
        ru="Лимит использований приглашения исчерпан",
        en="Invite usage limit is exhausted",
    ),
    "INVITE_ROLE_NOT_ALLOWED": ErrorEntry(
        status=403,
        ru="Роль «{role}» не разрешена приглашением",
        en="Role '{role}' is not allowed by the invite",
    ),
    "INVITE_ALREADY_MEMBER": ErrorEntry(
        status=409,
        ru="Вы уже состоите в проекте",
        en="You are already a project member",
    ),
    "INVITE_ALREADY_REVOKED": ErrorEntry(
        status=409,
        ru="Приглашение уже отозвано",
        en="Invite has already been revoked",
    ),
    "INVITE_MEMBER_MISSING": ErrorEntry(
        status=404,
        ru="Участник не найден в проекте",
        en="Member was not found in the project",
    ),
    "MANAGER_DRAFT_MISSING": ErrorEntry(
        status=404, ru="Черновик не найден", en="Draft not found"
    ),
    "MANAGER_LEVEL_MIN": ErrorEntry(
        status=400,
        ru="Официальный уровень не может быть ниже УГТ 2",
        en="Official level cannot be below TRL 2",
    ),
    "MANAGER_LEVEL_ABOVE": ErrorEntry(
        status=400,
        ru="Нельзя подтвердить уровень выше предварительного (заявленного)",
        en="Cannot confirm a level above the preliminary (claimed) one",
    ),
    "MANAGER_LEVEL_CHANGED": ErrorEntry(
        status=409,
        ru="Уровень проекта изменился — переоформите заявку (N→N+1)",
        en="Project level has changed — resubmit the request (N to N+1)",
    ),
    "MANAGER_LEVEL_NEXT_ONLY": ErrorEntry(
        status=409,
        ru="Подтверждается только следующий уровень (N→N+1)",
        en="Only the next level can be confirmed (N to N+1)",
    ),
    "MANAGER_ONLY": ErrorEntry(
        status=403, ru="Только менеджеры", en="Managers only"
    ),
    "TASK_NOT_FOUND": ErrorEntry(
        status=404, ru="Задача не найдена", en="Task not found"
    ),
    "TASK_TAKEN": ErrorEntry(
        status=409,
        ru="Задача уже взята другим менеджером",
        en="Task has already been taken by another manager",
    ),
    "MANAGER_MISSING": ErrorEntry(
        status=404, ru="Менеджер не найден", en="Manager not found"
    ),
    "NEWS_NOT_FOUND": ErrorEntry(
        status=404, ru="Новость не найдена", en="News post not found"
    ),
    "NEWS_CATEGORY_MISSING": ErrorEntry(
        status=422, ru="Категория не найдена", en="Category not found"
    ),
    "NEWS_OWN_ONLY": ErrorEntry(
        status=403,
        ru="Можно управлять только своими новостями",
        en="You can manage only your own news posts",
    ),
    "NEWS_STATUS_INVALID": ErrorEntry(
        status=422,
        ru="status должен быть draft|scheduled|published",
        en="status must be draft|scheduled|published",
    ),
    "NEWS_SOURCE_MANUAL_ONLY": ErrorEntry(
        status=422,
        ru="source должен быть 'manual': auto/api зарезервированы для шлюза контент-завода",
        en="source must be 'manual': auto/api are reserved for the content gateway",
    ),
    "NEWS_AUTO_GATEWAY_ONLY": ErrorEntry(
        status=422,
        ru="created_automatically выставляется только шлюзом контент-завода",
        en="created_automatically is set only by the content gateway",
    ),
    "NEWS_SCHEDULED_AT_REQUIRED": ErrorEntry(
        status=422,
        ru="Для статуса scheduled укажите scheduled_at",
        en="For the scheduled status, provide scheduled_at",
    ),
    "NEWS_SCHEDULED_FUTURE": ErrorEntry(
        status=422,
        ru="scheduled_at должен быть в будущем",
        en="scheduled_at must be in the future",
    ),
    "NEWS_STATUS_CONFLICT": ErrorEntry(
        status=409, ru="Некорректный статус", en="Invalid status"
    ),
    "NEWS_RESCHEDULE_CONFLICT": ErrorEntry(
        status=409,
        ru="Опубликованную новость нельзя запланировать — сначала снимите с публикации",
        en="A published post cannot be scheduled — unpublish it first",
    ),
    "NEWS_MEDIA_KIND_INVALID": ErrorEntry(
        status=422,
        ru="kind должен быть inline|attachment|gallery|cover",
        en="kind must be inline|attachment|gallery|cover",
    ),
    "NEWS_MEDIA_MISSING": ErrorEntry(
        status=404, ru="Медиа не найдено", en="Media not found"
    ),
    "NOTIFICATION_NOT_FOUND": ErrorEntry(
        status=404, ru="Уведомление не найдено", en="Notification not found"
    ),
    "SSE_TICKET_INVALID": ErrorEntry(
        status=401,
        ru="Недействительный или просроченный ticket",
        en="Invalid or expired ticket",
    ),
    "SSE_TOKEN_IN_URL": ErrorEntry(
        status=400,
        ru="Токен в URL запрещён — получите одноразовый ticket",
        en="Token in URL is forbidden — issue a one-time ticket",
    ),
    "RAG_ADMIN_ONLY": ErrorEntry(
        status=403,
        ru="Только администраторы ЦНТР могут загружать шаблоны",
        en="Only CNTR administrators can upload templates",
    ),
    "AI_RATE_LIMITED": ErrorEntry(
        status=429,
        ru=(
            "Слишком много запросов к AI-консультанту — подождите минуту "
            "или задайте вопрос более конкретно."
        ),
        en=(
            "Too many requests to the AI assistant — wait a minute "
            "or ask a more specific question."
        ),
    ),
    "STAGE_KIT_UNCHANGED": ErrorEntry(
        status=409,
        ru="Комплект не изменён после отклонения — загрузите исправленные документы",
        en="Package is unchanged after rejection — upload the corrected documents",
    ),
    "READINESS_UNKNOWN_STATUS": ErrorEntry(
        status=422,
        ru="Неизвестный статус ответа: {status}",
        en="Unknown answer status: {status}",
    ),
}


class TextEntry(TypedDict):
    ru: str
    en: str


# Пользовательские тексты оценки готовности (Решения §4): отдаются через API
# (template_payload/checkpoint_results), поэтому живут в том же каталоге.
# Ошибки выше несут HTTP-статус; здесь его нет — только ru/en пары.
READINESS_TEXTS: dict[str, TextEntry] = {
    "READINESS_ANSWER_NOT_STARTED": TextEntry(ru="Не начато", en="Not started"),
    "READINESS_ANSWER_IN_PROGRESS": TextEntry(ru="В работе", en="In progress"),
    "READINESS_ANSWER_FORMED": TextEntry(ru="Сформировано", en="Formed"),
    "READINESS_ANSWER_DOCUMENTED": TextEntry(
        ru="Выполнено и документировано", en="Completed and documented"
    ),
    "READINESS_ANSWER_VERIFIED": TextEntry(ru="Подтверждено", en="Verified"),
    "READINESS_ANSWER_NOT_APPLICABLE": TextEntry(
        ru="Неприменимо", en="Not applicable"
    ),
    "READINESS_EVIDENCE_MISSING": TextEntry(ru="Отсутствует", en="Missing"),
    "READINESS_EVIDENCE_DRAFT": TextEntry(ru="Черновик", en="Draft"),
    "READINESS_EVIDENCE_READY": TextEntry(ru="Готово", en="Ready"),
    "READINESS_EVIDENCE_VERIFIED": TextEntry(ru="Проверено", en="Verified"),
    "READINESS_DIM_SCIENTIFIC": TextEntry(ru="Научная", en="Scientific"),
    "READINESS_DIM_TECHNICAL": TextEntry(ru="Техническая", en="Technical"),
    "READINESS_DIM_ORGANIZATIONAL": TextEntry(
        ru="Организационная", en="Organizational"
    ),
    "READINESS_DIM_PRODUCTION": TextEntry(ru="Производственная", en="Production"),
    "READINESS_CP_R01_TITLE": TextEntry(
        ru="Выявлены и задокументированы фундаментальные принципы технологии",
        en="Fundamental technology principles identified and documented",
    ),
    "READINESS_CP_R01_EXPL": TextEntry(
        ru="Базовые принципы технологии сформулированы и зафиксированы "
        "в едином документе.",
        en="The basic technology principles are formulated and recorded "
        "in a single document.",
    ),
    "READINESS_CP_R02_TITLE": TextEntry(
        ru="Сформулировано и проанализировано техническое решение проблемы",
        en="Technical solution to the problem formulated and analyzed",
    ),
    "READINESS_CP_R02_EXPL": TextEntry(
        ru="Рассмотрены варианты решения, преимущества и ограничения, выбран "
        "предпочтительный вариант и зафиксированы риски.",
        en="Solution options, advantages and limitations reviewed; preferred "
        "option selected and risks recorded.",
    ),
    "READINESS_CP_R03_TITLE": TextEntry(
        ru="Сформулирована технологическая концепция",
        en="Technology concept formulated",
    ),
    "READINESS_CP_R03_EXPL": TextEntry(
        ru="Концепция содержит варианты применения, архитектуру, целевые "
        "метрики и ограничения.",
        en="The concept covers application options, architecture, target "
        "metrics and limitations.",
    ),
    "READINESS_CP_R04_TITLE": TextEntry(
        ru="Обоснована цель разработки технологии",
        en="Technology development goal justified",
    ),
    "READINESS_CP_R04_EXPL": TextEntry(
        ru="Цель разработки связана с потребностью заказчика или "
        "индустриального партнёра.",
        en="The development goal is linked to a customer or industrial "
        "partner need.",
    ),
    "READINESS_CP_R05_TITLE": TextEntry(
        ru="Подтверждена обоснованность концепции",
        en="Concept validity confirmed",
    ),
    "READINESS_CP_R05_EXPL": TextEntry(
        ru="Квалифицированные специалисты оценили концепцию и её реализуемость.",
        en="Qualified specialists have assessed the concept and its feasibility.",
    ),
    "READINESS_CP_R06_TITLE": TextEntry(
        ru="Доказана эффективность применения технического решения",
        en="Technical solution effectiveness proven",
    ),
    "READINESS_CP_R06_EXPL": TextEntry(
        ru="Расчёты, допущения, доступные материалы, оборудование и компетенции "
        "подтверждают достижимость целевых метрик.",
        en="Calculations, assumptions, available materials, equipment and "
        "competencies confirm the achievability of the target metrics.",
    ),
    "READINESS_CP_R07_TITLE": TextEntry(ru="Получен макет", en="Mock-up obtained"),
    "READINESS_CP_R07_EXPL": TextEntry(
        ru="Создан макет, на котором проверяются отдельные характеристики "
        "и правильность технических решений.",
        en="A mock-up has been built to verify individual characteristics "
        "and the validity of technical solutions.",
    ),
    "READINESS_CP_R08_TITLE": TextEntry(
        ru="Проведены испытания", en="Tests conducted"
    ),
    "READINESS_CP_R08_EXPL": TextEntry(
        ru="Испытания проведены по утверждённой методике с критериями приёмки "
        "и отчётом о результатах.",
        en="Tests were conducted under an approved methodology with acceptance "
        "criteria and a results report.",
    ),
    "READINESS_CP_R09_TITLE": TextEntry(
        ru="Отобраны образцы с лучшими показателями",
        en="Best-performing samples selected",
    ),
    "READINESS_CP_R09_EXPL": TextEntry(
        ru="Результаты сопоставлены с целевыми значениями, отклонения разобраны, "
        "дальнейшие действия согласованы.",
        en="Results compared against target values, deviations analyzed, "
        "further actions agreed.",
    ),
    "READINESS_CP_R10_TITLE": TextEntry(
        ru="Получен лабораторный образец и подготовлен лабораторный стенд",
        en="Laboratory sample obtained and laboratory bench prepared",
    ),
    "READINESS_CP_R10_EXPL": TextEntry(
        ru="Лабораторный образец создан для проверки работоспособности концепции "
        "и ключевых характеристик в контролируемых условиях.",
        en="A laboratory sample has been built to verify the concept performance "
        "and key characteristics under controlled conditions.",
    ),
    "READINESS_CP_R11_TITLE": TextEntry(
        ru="Проведена верификация", en="Verification conducted"
    ),
    "READINESS_CP_R11_EXPL": TextEntry(
        ru="Есть объективные свидетельства соответствия образца установленным "
        "требованиям и воспроизводимости результатов.",
        en="Objective evidence exists of the sample's compliance with the stated "
        "requirements and of result reproducibility.",
    ),
    "READINESS_CP_R12_TITLE": TextEntry(
        ru="Получен экспериментальный образец",
        en="Experimental sample obtained",
    ),
    "READINESS_CP_R12_EXPL": TextEntry(
        ru="Физический прототип создан для проверки ключевых идей в условиях, "
        "приближённых к реальным.",
        en="A physical prototype has been built to verify key ideas "
        "under near-real conditions.",
    ),
    "READINESS_CP_R13_TITLE": TextEntry(
        ru="Проведена внутренняя валидация образца",
        en="Internal sample validation conducted",
    ),
    "READINESS_CP_R13_EXPL": TextEntry(
        ru="Организация проверила работоспособность образца и готовность "
        "к созданию репрезентативного образца.",
        en="The organization has verified the sample performance and readiness "
        "to build a representative sample.",
    ),
    "READINESS_CP_R14_TITLE": TextEntry(
        ru="Получен репрезентативный образец",
        en="Representative sample obtained",
    ),
    "READINESS_CP_R14_EXPL": TextEntry(
        ru="Образец отражает ключевые характеристики исследуемой технологии "
        "и готов к демонстрации в приближённых к эксплуатационным условиях.",
        en="The sample reflects the key characteristics of the technology under "
        "study and is ready for demonstration under near-operational conditions.",
    ),
    "READINESS_CP_R15_TITLE": TextEntry(
        ru="Проведена внешняя валидация образца",
        en="External sample validation conducted",
    ),
    "READINESS_CP_R15_EXPL": TextEntry(
        ru="Работоспособность образца подтверждена при внешней демонстрации, "
        "а результаты можно обобщить.",
        en="Sample performance confirmed during an external demonstration, "
        "and the results can be generalized.",
    ),
    "READINESS_CP_R16_TITLE": TextEntry(
        ru="Получен опытный образец", en="Pilot sample obtained"
    ),
    "READINESS_CP_R16_EXPL": TextEntry(
        ru="Опытный образец готов для типовых испытаний и пилотной эксплуатации.",
        en="The pilot sample is ready for standard tests and pilot operation.",
    ),
    "READINESS_CP_R17_TITLE": TextEntry(
        ru="Проведена валидация в эксплуатационных условиях",
        en="Validation under operational conditions conducted",
    ),
    "READINESS_CP_R17_EXPL": TextEntry(
        ru="Работа подтверждена в реальных условиях по программе, протоколам "
        "и показателям надёжности.",
        en="Performance confirmed under real conditions per program, protocols "
        "and reliability indicators.",
    ),
    "READINESS_CP_R18_TITLE": TextEntry(
        ru="Получен контрольный образец", en="Reference sample obtained"
    ),
    "READINESS_CP_R18_EXPL": TextEntry(
        ru="Контрольный образец соответствует серийной спецификации и готов "
        "к квалификационным испытаниям.",
        en="The reference sample complies with the serial specification "
        "and is ready for qualification tests.",
    ),
    "READINESS_CP_R19_TITLE": TextEntry(
        ru="Получены разрешительные документы и проведены "
        "квалификационные испытания",
        en="Permits obtained and qualification tests conducted",
    ),
    "READINESS_CP_R19_EXPL": TextEntry(
        ru="Квалификационные испытания завершены, результаты сопоставлены "
        "с требованиями и отраслевыми стандартами.",
        en="Qualification tests completed; results compared against requirements "
        "and industry standards.",
    ),
    "READINESS_CP_R20_TITLE": TextEntry(
        ru="Запущено установочной серией", en="Pilot batch launched"
    ),
    "READINESS_CP_R20_EXPL": TextEntry(
        ru="Установочная серия подтверждает готовность к серийному изготовлению "
        "и поставкам.",
        en="The pilot batch confirms readiness for serial manufacturing "
        "and deliveries.",
    ),
    "READINESS_CP_R21_TITLE": TextEntry(
        ru="Запущено серийное производство", en="Serial production launched"
    ),
    "READINESS_CP_R21_EXPL": TextEntry(
        ru="Серийное производство и эксплуатация сопровождаются показателями "
        "надёжности, инцидентами и экономическими результатами.",
        en="Serial production and operation are tracked with reliability "
        "indicators, incidents and economic results.",
    ),
    "READINESS_CP_R22_TITLE": TextEntry(
        ru="Разработана стратегия улучшения продукта или технологии",
        en="Product or technology improvement strategy developed",
    ),
    "READINESS_CP_R22_EXPL": TextEntry(
        ru="Определены дальнейшие этапы масштабирования, модернизации, выхода "
        "на новые рынки, ресурсы и риски.",
        en="Further scaling, modernization and new-market stages defined, "
        "with resources and risks.",
    ),
    "READINESS_EV_R01_E1": TextEntry(
        ru="Паспорт научно-технического задела",
        en="R&D background data sheet",
    ),
    "READINESS_EV_R01_E2": TextEntry(
        ru="Описание проблемы и потребности",
        en="Problem and need description",
    ),
    "READINESS_EV_R01_E3": TextEntry(
        ru="Акт экспертной оценки научно-технического задела",
        en="R&D background expert assessment report",
    ),
    "READINESS_EV_R02_E1": TextEntry(
        ru="Сравнение вариантов технического решения",
        en="Technical solution options comparison",
    ),
    "READINESS_EV_R02_E2": TextEntry(
        ru="Матрица ограничений и рисков",
        en="Limitations and risks matrix",
    ),
    "READINESS_EV_R03_E1": TextEntry(
        ru="Концепция технологической реализации",
        en="Technology implementation concept",
    ),
    "READINESS_EV_R03_E2": TextEntry(
        ru="Обзор аналогов и лучших практик",
        en="Analogues and best practices review",
    ),
    "READINESS_EV_R03_E3": TextEntry(
        ru="Матрица целевых характеристик и критериев приёмки",
        en="Target characteristics and acceptance criteria matrix",
    ),
    "READINESS_EV_R04_E1": TextEntry(
        ru="Письмо, протокол встречи или предварительное ТЗ заказчика",
        en="Customer letter, meeting minutes or preliminary requirements",
    ),
    "READINESS_EV_R05_E1": TextEntry(
        ru="Экспертная оценка концепции", en="Concept expert assessment"
    ),
    "READINESS_EV_R06_E1": TextEntry(
        ru="Расчётно-пояснительная записка",
        en="Calculation and explanatory note",
    ),
    "READINESS_EV_R06_E2": TextEntry(
        ru="Расчёты, ссылки на аналоги и ресурсы",
        en="Calculations, analogue references and resources",
    ),
    "READINESS_EV_R07_E1": TextEntry(
        ru="Акт приёмки макетного образца", en="Mock-up acceptance report"
    ),
    "READINESS_EV_R07_E2": TextEntry(
        ru="Спецификация макета", en="Mock-up specification"
    ),
    "READINESS_EV_R07_E3": TextEntry(
        ru="Фотофиксация и ведомость комплектации",
        en="Photo records and configuration list",
    ),
    "READINESS_EV_R08_E1": TextEntry(
        ru="Программа и методика испытаний",
        en="Test program and methodology",
    ),
    "READINESS_EV_R08_E2": TextEntry(
        ru="План-график испытаний", en="Test schedule"
    ),
    "READINESS_EV_R08_E3": TextEntry(ru="Отчёт по испытаниям", en="Test report"),
    "READINESS_EV_R09_E1": TextEntry(
        ru="Анализ отклонений и план корректирующих мероприятий",
        en="Deviation analysis and corrective action plan",
    ),
    "READINESS_EV_R09_E2": TextEntry(
        ru="Протокол согласования с квалифицированным заказчиком",
        en="Qualified customer approval minutes",
    ),
    "READINESS_EV_R10_E1": TextEntry(
        ru="Акт приёмки лабораторного образца",
        en="Laboratory sample acceptance report",
    ),
    "READINESS_EV_R10_E2": TextEntry(
        ru="Спецификация лабораторного образца",
        en="Laboratory sample specification",
    ),
    "READINESS_EV_R10_E3": TextEntry(
        ru="Фотофиксация и ведомость комплектации",
        en="Photo records and configuration list",
    ),
    "READINESS_EV_R11_E1": TextEntry(ru="Протоколы испытаний", en="Test minutes"),
    "READINESS_EV_R11_E2": TextEntry(
        ru="Матрица целевых и достигнутых характеристик",
        en="Target vs achieved characteristics matrix",
    ),
    "READINESS_EV_R11_E3": TextEntry(
        ru="Отчёт о воспроизводимости и статистике",
        en="Reproducibility and statistics report",
    ),
    "READINESS_EV_R11_E4": TextEntry(
        ru="Анализ отклонений и корректирующие мероприятия",
        en="Deviation analysis and corrective actions",
    ),
    "READINESS_EV_R12_E1": TextEntry(
        ru="Акт приёмки экспериментального образца",
        en="Experimental sample acceptance report",
    ),
    "READINESS_EV_R12_E2": TextEntry(
        ru="Спецификация экспериментального образца",
        en="Experimental sample specification",
    ),
    "READINESS_EV_R12_E3": TextEntry(
        ru="Фотофиксация и ведомость комплектации",
        en="Photo records and configuration list",
    ),
    "READINESS_EV_R13_E1": TextEntry(ru="Протоколы испытаний", en="Test minutes"),
    "READINESS_EV_R13_E2": TextEntry(
        ru="Матрица целевых и достигнутых характеристик",
        en="Target vs achieved characteristics matrix",
    ),
    "READINESS_EV_R13_E3": TextEntry(
        ru="Отчёт об устойчивости и статистике",
        en="Robustness and statistics report",
    ),
    "READINESS_EV_R13_E4": TextEntry(
        ru="Анализ отклонений и корректирующие мероприятия",
        en="Deviation analysis and corrective actions",
    ),
    "READINESS_EV_R14_E1": TextEntry(
        ru="Акт приёмки репрезентативного образца",
        en="Representative sample acceptance report",
    ),
    "READINESS_EV_R14_E2": TextEntry(
        ru="Спецификация репрезентативного образца",
        en="Representative sample specification",
    ),
    "READINESS_EV_R14_E3": TextEntry(
        ru="Фотофиксация и ведомость комплектации",
        en="Photo records and configuration list",
    ),
    "READINESS_EV_R15_E1": TextEntry(
        ru="Протоколы испытаний или демонстраций",
        en="Test or demonstration minutes",
    ),
    "READINESS_EV_R15_E2": TextEntry(
        ru="Матрица целевых и достигнутых характеристик",
        en="Target vs achieved characteristics matrix",
    ),
    "READINESS_EV_R15_E3": TextEntry(
        ru="Акт экспертной оценки результатов",
        en="Results expert assessment report",
    ),
    "READINESS_EV_R15_E4": TextEntry(
        ru="Протокол согласования с заказчиком",
        en="Customer approval minutes",
    ),
    "READINESS_EV_R16_E1": TextEntry(
        ru="Акт приёмки опытного образца",
        en="Pilot sample acceptance report",
    ),
    "READINESS_EV_R16_E2": TextEntry(
        ru="Спецификация опытного образца",
        en="Pilot sample specification",
    ),
    "READINESS_EV_R16_E3": TextEntry(
        ru="Фотофиксация и ведомость комплектации",
        en="Photo records and configuration list",
    ),
    "READINESS_EV_R17_E1": TextEntry(
        ru="Программа и методика эксплуатации",
        en="Operation program and methodology",
    ),
    "READINESS_EV_R17_E2": TextEntry(
        ru="План-график пилотной эксплуатации",
        en="Pilot operation schedule",
    ),
    "READINESS_EV_R17_E3": TextEntry(
        ru="Протоколы эксплуатации по циклам или сменам",
        en="Operation minutes by cycles or shifts",
    ),
    "READINESS_EV_R17_E4": TextEntry(
        ru="Отчёт по эксплуатационной надёжности",
        en="Operational reliability report",
    ),
    "READINESS_EV_R18_E1": TextEntry(
        ru="Акт приёмки контрольного образца",
        en="Reference sample acceptance report",
    ),
    "READINESS_EV_R18_E2": TextEntry(
        ru="Спецификация контрольного образца",
        en="Reference sample specification",
    ),
    "READINESS_EV_R18_E3": TextEntry(
        ru="Фотофиксация и ведомость комплектации",
        en="Photo records and configuration list",
    ),
    "READINESS_EV_R19_E1": TextEntry(
        ru="Программа и методика квалификационных испытаний",
        en="Qualification test program and methodology",
    ),
    "READINESS_EV_R19_E2": TextEntry(
        ru="План-график квалификационных испытаний",
        en="Qualification test schedule",
    ),
    "READINESS_EV_R19_E3": TextEntry(
        ru="Протоколы квалификационных испытаний",
        en="Qualification test minutes",
    ),
    "READINESS_EV_R19_E4": TextEntry(
        ru="Разрешительные документы", en="Permits"
    ),
    "READINESS_EV_R19_E5": TextEntry(
        ru="Отчёт по воспроизводимости и надёжности",
        en="Reproducibility and reliability report",
    ),
    "READINESS_EV_R20_E1": TextEntry(
        ru="Акт экспертной оценки результатов испытаний",
        en="Test results expert assessment report",
    ),
    "READINESS_EV_R20_E2": TextEntry(
        ru="Протокол согласования с квалифицированным заказчиком",
        en="Qualified customer approval minutes",
    ),
    "READINESS_EV_R20_E3": TextEntry(
        ru="План-график установочной серии", en="Pilot batch schedule"
    ),
    "READINESS_EV_R21_E1": TextEntry(
        ru="Отчёты по эксплуатации и журналы инцидентов",
        en="Operation reports and incident logs",
    ),
    "READINESS_EV_R21_E2": TextEntry(
        ru="Матрица целевых и достигнутых характеристик",
        en="Target vs achieved characteristics matrix",
    ),
    "READINESS_EV_R21_E3": TextEntry(
        ru="Отчёт по надёжности и экономическим показателям",
        en="Reliability and economic indicators report",
    ),
    "READINESS_EV_R22_E1": TextEntry(
        ru="Акт оценки технологической и коммерческой зрелости",
        en="Technology and commercial maturity assessment report",
    ),
    "READINESS_EV_R22_E2": TextEntry(
        ru="Актуализированный план развития технологии",
        en="Updated technology development plan",
    ),
}


def readiness_text(key: str, locale: str = DEFAULT_LOCALE) -> str:
    """Текст оценки готовности на языке запроса; умолчание русское."""
    entry = READINESS_TEXTS[key]
    return entry["en"] if locale == "en" else entry["ru"]


def resolve_locale(accept_language: str | None) -> str:
    """Язык из заголовка Accept-Language; всё не-английское — русское.

    Почему так: поддерживаются только ru/en, а текущие клиенты заголовка
    не шлют — умолчание обязано сохранять русское поведение.
    """
    if not accept_language:
        return DEFAULT_LOCALE
    first = accept_language.split(",")[0].strip().split(";")[0].strip().lower()
    if first.startswith("en"):
        return "en"
    return DEFAULT_LOCALE


def locale_from_request(request: Any) -> str:
    """Достаёт Accept-Language из Starlette-запроса; без запроса — русский."""
    headers = getattr(getattr(request, "headers", None), "get", None)
    if headers is None:
        return DEFAULT_LOCALE
    try:
        value = headers("accept-language")
    except TypeError:
        value = headers("accept-language", None)
    if not isinstance(value, str):
        return DEFAULT_LOCALE
    return resolve_locale(value)


def get_message(
    code: str, locale: str = DEFAULT_LOCALE, params: dict[str, object] | None = None
) -> str:
    """Локализованный текст с подстановкой параметров (без склейки).

    Почему fail-closed без params: сырой шаблон с ``{плейсхолдер}`` —
    внутренняя деталь, пользователю её отдавать нельзя.
    """
    entry = CATALOG[code]
    template = entry["en"] if locale == "en" else entry["ru"]
    if params:
        return template.format(**params)
    if "{" in template and "}" in template:
        raise KeyError(f"{code}: шаблон требует params, отдавать сырым запрещено")
    return template


def raise_error(
    code: str,
    params: dict[str, object] | None = None,
    *,
    request: Any = None,
    accept_language: str | None = None,
    locale: str | None = None,
) -> HTTPException:
    """Строит HTTPException: стабильный код в заголовке, строка — в detail.

    Вызывать как ``raise raise_error(...)``. Приоритет языка: явный
    ``locale`` → ``accept_language`` → заголовок ``request`` → русский.
    Статус всегда из каталога (шов interfaces.md) — переопределений нет,
    иначе коды ответов разъедутся между местами вызова.
    """
    if locale is None:
        if accept_language is not None:
            locale = resolve_locale(accept_language)
        elif request is not None:
            locale = locale_from_request(request)
        else:
            locale = DEFAULT_LOCALE
    entry = CATALOG[code]
    detail = get_message(code, locale, params)
    return HTTPException(
        status_code=entry["status"],
        detail=detail,
        headers={ERROR_HEADER: code},
    )

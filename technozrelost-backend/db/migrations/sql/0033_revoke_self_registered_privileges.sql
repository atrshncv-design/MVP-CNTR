-- 0033_revoke_self_registered_privileges: отзыв самозарегистрированных привилегий (R04i, таск 03).
-- До закрытия allowlist (auth.py: SELF_REGISTER_ALLOWED_SLUGS) роли auditor /
-- regulating_organization (+ legacy ugt_expert до переименования 0010) / investor
-- выдавались через POST /auth/register любому встречному. Миграция отзывает такие
-- назначения у обычных пользователей; суперпользователей и роли персонала ЦНТР
-- (cntr_admin/cntr_manager — до этого уже были закрыты 403 и выдавались только
-- администратором) не трогает. Пользователям без оставшихся ролей назначается
-- fallback gk_customer как primary. Идемпотентно: повторный прогон — no-op
-- (аудит-дедуп по details, fallback только для роле-лесс пользователей).

-- 1. Аудит отзыва (append-only): одна запись на каждое отзываемое назначение,
-- дедуп по (target_user_id, role), чтобы повторный upgrade не дублировал.
INSERT INTO public.audit_trail (project_id, user_id, action, details)
SELECT NULL, NULL, 'user.role.revoked',
       jsonb_build_object('target_user_id', u.id, 'role', r.slug,
                          'reason', 'self_registered_revoked_0033')
FROM public.users u
JOIN public.user_roles ur ON ur.user_id = u.id
JOIN public.roles r ON r.id = ur.role_id
WHERE r.slug IN ('auditor', 'regulating_organization', 'ugt_expert', 'investor')
  AND COALESCE(u.is_superuser, FALSE) IS NOT TRUE
  AND NOT EXISTS (
      SELECT 1 FROM public.audit_trail a
      WHERE a.action = 'user.role.revoked'
        AND (a.details ->> 'target_user_id')::bigint = u.id
        AND a.details ->> 'role' = r.slug
  );

-- 2. Отзыв назначений привилегированных ролей у обычных пользователей.
DELETE FROM public.user_roles ur
USING public.users u, public.roles r
WHERE ur.user_id = u.id
  AND ur.role_id = r.id
  AND r.slug IN ('auditor', 'regulating_organization', 'ugt_expert', 'investor')
  AND COALESCE(u.is_superuser, FALSE) IS NOT TRUE;

-- 3. Fallback: пользователям без единой роли — gk_customer как primary.
INSERT INTO public.user_roles (user_id, role_id, is_primary)
SELECT u.id, r.id, TRUE
FROM public.users u
CROSS JOIN (SELECT id FROM public.roles WHERE slug = 'gk_customer') r
WHERE COALESCE(u.is_superuser, FALSE) IS NOT TRUE
  AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id);

-- 4. Инвариант одной primary-роли: у кого после отзыва остались строки, но нет
-- primary (снесли primary-флаг вместе со строкой) — поднять одну в primary.
UPDATE public.user_roles ur
SET is_primary = TRUE
WHERE ur.is_primary IS NOT TRUE
  AND NOT EXISTS (
      SELECT 1 FROM public.user_roles other
      WHERE other.user_id = ur.user_id AND other.is_primary IS TRUE
  )
  AND ur.role_id = (
      SELECT MIN(inner_ur.role_id) FROM public.user_roles inner_ur
      WHERE inner_ur.user_id = ur.user_id
  );

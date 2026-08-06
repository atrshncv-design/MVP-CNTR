-- 0009_control_point_decision_width.sql
-- Решения по контрольным точкам длиннее 16 символов.

ALTER TABLE public.control_points
    ALTER COLUMN decision TYPE VARCHAR(255);

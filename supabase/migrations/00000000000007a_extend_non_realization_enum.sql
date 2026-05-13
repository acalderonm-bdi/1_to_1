-- F2 — Justificación: extender enum non_realization_reason con dos motivos adicionales.
-- ALTER TYPE ... ADD VALUE no es transaccional con otros DDL, por eso vive en archivo aparte.

alter type public.non_realization_reason add value if not exists 'emergencia';
alter type public.non_realization_reason add value if not exists 'vacaciones';

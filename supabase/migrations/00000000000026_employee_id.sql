-- Identificador corporativo estable para el org-sync.
--
-- El re-sync (altas/bajas/cambios de líder) matchea por employee_id (el ID del
-- directorio de RH, p.ej. '0006') en vez de por email, que puede cambiar y que
-- en algunos casos no existe. Nullable + índice único parcial: los usuarios sin
-- employee_id (p.ej. admins creados a mano) no chocan entre sí.
-- Ver src/lib/sync/org-sync.ts.

alter table public.users add column if not exists employee_id text;

create unique index if not exists idx_users_employee_id
  on public.users(employee_id)
  where employee_id is not null;

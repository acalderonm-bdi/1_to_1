-- [Reconciliación feat->main 2026-07-13] Renumerada desde feat/acceso-relacional
-- migración 00000000000027. ADAPTADA (D2): la columna de ID de RH es
-- `hr_employee_id` (la de main, ya en prod), NO `employee_id`.
--
-- Hardening de seguridad previo a abrir el SSO a ~400 empleados.
--
-- (1) handle_new_user solo provisiona public.users para correos del dominio
--     corporativo. Cualquier cuenta Google puede completar el OAuth; sin esto,
--     externos quedaban en el directorio. El callback además cierra sesión y
--     borra el auth.user fuera de dominio (defensa en capas).
--     NOTA: el INSERT es idéntico al handle_new_user actual de prod; esta versión
--     solo AÑADE el guard de dominio arriba.
-- (2) Trigger BEFORE UPDATE que impide que un usuario no-RH se auto-promueva
--     cambiando columnas privilegiadas. La policy users_update_self solo acota
--     la FILA (auth.uid() = id), no las COLUMNAS, así que vía PostgREST un
--     colaborador podía hacer update users set role='hr'. El service_role
--     (admin client de crons/org-sync) tiene auth.uid() nulo y queda permitido.

-- (1) handle_new_user con guard de dominio --------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- No provisionar usuarios fuera del dominio corporativo.
  if new.email is null or lower(new.email) not like '%@b-drive.com.mx' then
    return new;
  end if;

  insert into public.users (id, email, full_name, avatar_url, google_id)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'sub'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- (2) Guard de columnas privilegiadas -------------------------------------------
create or replace function public.guard_privileged_user_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role (admin client de crons/org-sync) no tiene auth.uid(): permitido.
  if auth.uid() is null then
    return new;
  end if;
  -- RH puede administrar usuarios.
  if public.is_hr() then
    return new;
  end if;
  -- Resto: no pueden tocar columnas privilegiadas (sí su avatar, slack_user_id,
  -- google_calendar_token, full_name vía users_update_self).
  if new.role is distinct from old.role
     or new.is_active is distinct from old.is_active
     or new.hr_employee_id is distinct from old.hr_employee_id
     or new.department_id is distinct from old.department_id then
    raise exception 'No autorizado: solo RH puede modificar role/is_active/hr_employee_id/department_id';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_privileged_user_columns on public.users;
create trigger trg_guard_privileged_user_columns
  before update on public.users
  for each row execute procedure public.guard_privileged_user_columns();

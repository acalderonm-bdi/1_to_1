-- Minutas compartidas: una sola minuta por 1:1, editable por ambos participantes.
-- Antes: una minuta por autor (privadas paralelas). Confuso para el usuario.

-- Limpia minutas existentes para evitar violar el nuevo unique.
delete from public.minutes;

-- Drop unique (one_on_one_id, author_id) y reemplaza por unique en one_on_one_id
drop index if exists public.idx_minutes_oneonone_author;
create unique index idx_minutes_oneonone on public.minutes(one_on_one_id);

-- RLS: cualquier participante puede actualizar (no solo el autor original).
-- El campo author_id ahora representa "última persona que editó".
drop policy if exists "minutes_update_author" on public.minutes;
create policy "minutes_update_participants" on public.minutes
  for update using (public.is_participant(one_on_one_id));

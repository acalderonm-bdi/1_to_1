-- Invalidación de VoBos cuando cambian los acuerdos de una 1:1.
--
-- Razón: el VoBo significa "apruebo los acuerdos extraídos". Si la lista de
-- acuerdos cambia después de que alguien aprobó, su consentimiento queda
-- desactualizado y debe re-firmar.
--
-- Trigger: al INSERT/DELETE/UPDATE (que cambie descripción, responsable o fecha)
-- en agreements, se borran los vobos de la 1:1 afectada y se revierte el status
-- a 'agendada' si había sido cerrado.

create or replace function public.invalidate_vobos_on_agreement_change()
returns trigger
language plpgsql
security definer
as $$
declare
  v_target uuid;
  v_changed boolean := false;
  v_reason text;
begin
  if tg_op = 'INSERT' then
    v_target := new.one_on_one_id;
    v_changed := true;
    v_reason := 'agreement_created';
  elsif tg_op = 'DELETE' then
    v_target := old.one_on_one_id;
    v_changed := true;
    v_reason := 'agreement_deleted';
  elsif tg_op = 'UPDATE' then
    v_target := new.one_on_one_id;
    -- Solo invalida si cambió la "estructura" del acuerdo, no su status de seguimiento.
    if old.description is distinct from new.description
       or old.responsible_id is distinct from new.responsible_id
       or old.due_date is distinct from new.due_date then
      v_changed := true;
      v_reason := 'agreement_edited';
    end if;
  end if;

  if v_changed then
    -- Borra VoBos previos
    delete from public.vobos where one_on_one_id = v_target;

    -- Revierte status si la 1:1 ya estaba cerrada por consenso anterior
    update public.one_on_ones
    set status = 'agendada'
    where id = v_target
      and status in ('realizada', 'no_realizada', 'en_disputa');

    -- Audit log (best-effort, sin user_id porque corre en trigger)
    insert into public.audit_logs (user_id, action, resource_type, resource_id, metadata)
    values (
      null,
      'vobos_invalidated',
      'one_on_one',
      v_target,
      jsonb_build_object('reason', v_reason)
    );
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_invalidate_vobos on public.agreements;
create trigger trg_invalidate_vobos
  after insert or update or delete on public.agreements
  for each row execute function public.invalidate_vobos_on_agreement_change();

-- RLS: permitir DELETE de acuerdos a participantes (ya existe SELECT/INSERT/UPDATE,
-- pero hay que verificar que delete esté contemplado).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agreements' and policyname = 'agreements_delete_participants'
  ) then
    create policy "agreements_delete_participants" on public.agreements
      for delete using (
        public.is_participant(one_on_one_id)
      );
  end if;
end $$;

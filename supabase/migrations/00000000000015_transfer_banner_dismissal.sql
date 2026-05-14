-- F4 — Histórico: timestamp para que el líder dismisse el banner de transferencia,
-- más un trigger que lo auto-dismisse al primer vobo registrado en la nueva relación.

alter table public.leadership_relations
  add column transfer_banner_dismissed_at timestamptz;

create or replace function public.auto_dismiss_transfer_banner()
returns trigger
language plpgsql
security definer
as $$
declare
  v_leader_id uuid;
  v_collaborator_id uuid;
begin
  select leader_id, collaborator_id into v_leader_id, v_collaborator_id
  from public.one_on_ones where id = new.one_on_one_id;

  if v_leader_id is null then
    return new;
  end if;

  update public.leadership_relations
  set transfer_banner_dismissed_at = now()
  where leader_id = v_leader_id
    and collaborator_id = v_collaborator_id
    and ended_at is null
    and transfer_banner_dismissed_at is null;

  return new;
end;
$$;

drop trigger if exists trg_auto_dismiss_transfer_banner on public.vobos;
create trigger trg_auto_dismiss_transfer_banner
  after insert on public.vobos
  for each row execute procedure public.auto_dismiss_transfer_banner();

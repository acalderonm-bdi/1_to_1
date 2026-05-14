-- F1 — Lineamientos: columnas de calidad para acuerdos + índice parcial de bajos
-- + re-creación de la vista open_agreements_by_collaborator para exponerlas.

alter table public.agreements
  add column ai_quality_score numeric(2,1) check (ai_quality_score is null or ai_quality_score between 0 and 5),
  add column ai_quality_warnings text[] not null default '{}'::text[];

create index idx_agreements_quality_low
  on public.agreements(ai_quality_score)
  where ai_quality_score is not null and ai_quality_score < 3;

-- Re-create the view to include the new quality columns.
-- Postgres restriction: CREATE OR REPLACE VIEW must keep the existing columns
-- in the same order/names; new columns MUST be appended at the end.
create or replace view public.open_agreements_by_collaborator as
select
  a.id,
  a.one_on_one_id,
  a.description,
  a.responsible_id,
  a.due_date,
  a.status,
  a.ai_generated,
  a.ai_confidence,
  a.created_at,
  a.updated_at,
  o.leader_id as original_leader_id,
  o.collaborator_id,
  current_lr.leader_id as current_leader_id,
  (o.leader_id <> current_lr.leader_id) as is_transferred,
  o.scheduled_at as session_scheduled_at,
  a.ai_quality_score,
  a.ai_quality_warnings
from public.agreements a
join public.one_on_ones o on o.id = a.one_on_one_id
left join public.leadership_relations current_lr
  on current_lr.collaborator_id = o.collaborator_id
  and current_lr.ended_at is null
where a.status in ('pendiente', 'parcial');

grant select on public.open_agreements_by_collaborator to authenticated;

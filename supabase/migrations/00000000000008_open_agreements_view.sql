-- F4 — Histórico: vista de acuerdos abiertos por colaborador con marca de transferencia.
-- Une acuerdos a la sesión donde se originaron y a la relación de liderazgo vigente,
-- para detectar si el líder original ya no es el actual (is_transferred).
-- Las columnas ai_quality_score / ai_quality_warnings se incorporan en migration 10
-- mediante create or replace view.

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
  o.scheduled_at as session_scheduled_at
from public.agreements a
join public.one_on_ones o on o.id = a.one_on_one_id
left join public.leadership_relations current_lr
  on current_lr.collaborator_id = o.collaborator_id
  and current_lr.ended_at is null
where a.status in ('pendiente', 'parcial');

grant select on public.open_agreements_by_collaborator to authenticated;

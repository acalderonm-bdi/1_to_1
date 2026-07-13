-- [Reconciliación feat->main 2026-07-13] Renumerada desde feat/acceso-relacional
-- migración 00000000000028 (base prod aplica hasta la 28 de main). Contenido idéntico.
--
-- Fundamentos del north star: una fuente única de "pares atrasados" y métricas
-- de cumplimiento sin doble-conteo.
--
-- (1) overdue_relations: por cada relación activa, su cadencia EFECTIVA
--     (relation > department > global > 14) y si está atrasada. El cron y la
--     pantalla de RH leen ESTO (sin N+1, sin lógica de cadencia duplicada en TS).
-- (2) compliance_metrics: corrige el doble-conteo (antes unía leader OR
--     collaborator → cada 1:1 cross-área contaba 2 veces). Ahora atribuye cada
--     1:1 al área del COLABORADOR (se cuenta una sola vez). Mismas columnas y
--     escala 0-100 → consumidores (mapa-calor, panel, exports) intactos.
-- (3) compliance_metrics_by_leader: cumplimiento por líder (unidad natural de
--     responsabilidad del north star) para el drill-down de RH.
--
-- security_invoker en las vistas nuevas: RH (is_hr) ve todo; un líder/colab solo
-- lo suyo (RLS de las tablas base aplica). El cron usa service_role (bypassa RLS).

-- (1) Índice que cubre el filtro+orden de "último 1:1 realizado por par" ---------
-- Extiende el patrón de idx_oneonones_leader_collab_scheduled (migración 5)
-- añadiendo status (no se recrea el existente).
create index if not exists idx_oneonones_pair_realized_scheduled
  on public.one_on_ones (leader_id, collaborator_id, scheduled_at desc)
  where status = 'realizada';

-- (2) Vista overdue_relations ---------------------------------------------------
create or replace view public.overdue_relations
with (security_invoker = true) as
select
  base.*,
  case
    when base.last_meeting_at is null then null
    else floor(extract(epoch from (now() - base.last_meeting_at)) / 86400)::int
  end as days_since,
  (
    base.last_meeting_at is null
    or base.last_meeting_at < now() - make_interval(days => base.cadence_days)
  ) as is_overdue
from (
  select
    lr.id            as relation_id,
    lr.leader_id,
    lr.collaborator_id,
    lead.full_name   as leader_name,
    lead.email       as leader_email,
    lead.slack_user_id as leader_slack_user_id,
    col.full_name    as collaborator_name,
    col.department_id,
    dept.name        as department_name,
    lm.last_at       as last_meeting_at,
    coalesce(rc.frequency_days, dc.frequency_days, gc.frequency_days, 14) as cadence_days
  from public.leadership_relations lr
  join public.users lead on lead.id = lr.leader_id
  join public.users col  on col.id  = lr.collaborator_id
  left join public.departments dept on dept.id = col.department_id
  left join (
    select leader_id, collaborator_id, max(scheduled_at) as last_at
    from public.one_on_ones
    where status = 'realizada'
    group by leader_id, collaborator_id
  ) lm on lm.leader_id = lr.leader_id and lm.collaborator_id = lr.collaborator_id
  left join public.cadence_configs rc on rc.scope_type = 'relation'   and rc.scope_id = lr.id
  left join public.cadence_configs dc on dc.scope_type = 'department' and dc.scope_id = col.department_id
  left join lateral (
    select frequency_days from public.cadence_configs where scope_type = 'global' limit 1
  ) gc on true
  where lr.ended_at is null
    and col.is_active
    and lead.is_active
) base;

-- (3) compliance_metrics: atribuir cada 1:1 al área del COLABORADOR -------------
create or replace view public.compliance_metrics as
select
  d.id   as department_id,
  d.name as department_name,
  count(distinct o.id) as total_meetings,
  count(distinct o.id) filter (where o.status = 'realizada')   as realized_meetings,
  count(distinct o.id) filter (where o.status = 'no_realizada') as missed_meetings,
  count(distinct o.id) filter (where o.status = 'en_disputa')  as disputed_meetings,
  count(distinct a.id) as total_agreements,
  count(distinct a.id) filter (where a.status = 'cumplido')     as fulfilled_agreements,
  count(distinct a.id) filter (where a.status = 'no_cumplido')  as unfulfilled_agreements,
  case
    when count(distinct o.id) > 0
    then round(
      count(distinct o.id) filter (where o.status = 'realizada')::numeric
      / count(distinct o.id) * 100, 2
    )
    else 0
  end as compliance_rate
from public.departments d
left join public.users col on col.department_id = d.id
left join public.one_on_ones o on o.collaborator_id = col.id
left join public.agreements a on a.one_on_one_id = o.id
group by d.id, d.name;

-- (4) Cumplimiento por líder ----------------------------------------------------
create or replace view public.compliance_metrics_by_leader
with (security_invoker = true) as
select
  lr.leader_id,
  lead.full_name      as leader_name,
  lead.department_id,
  count(distinct lr.collaborator_id) as direct_reports,
  count(distinct o.id) as total_meetings,
  count(distinct o.id) filter (where o.status = 'realizada') as realized_meetings,
  case
    when count(distinct o.id) > 0
    then round(
      count(distinct o.id) filter (where o.status = 'realizada')::numeric
      / count(distinct o.id) * 100, 2
    )
    else 0
  end as compliance_rate
from public.leadership_relations lr
join public.users lead on lead.id = lr.leader_id
left join public.one_on_ones o
  on o.leader_id = lr.leader_id and o.collaborator_id = lr.collaborator_id
where lr.ended_at is null
group by lr.leader_id, lead.full_name, lead.department_id;

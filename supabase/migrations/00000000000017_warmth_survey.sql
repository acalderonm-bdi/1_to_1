-- F6 — Calidez: encuesta breve del colaborador al cerrar la sesión + opt-in para
-- compartir comentarios con AH + vistas agregadas por líder/departamento/mes.

-- Opt-in del colaborador para que AH pueda leer sus comentarios libres
alter table public.users
  add column allow_share_warmth_comments boolean not null default false;

-- Tabla principal
create table public.meeting_warmth_responses (
  id uuid primary key default gen_random_uuid(),
  one_on_one_id uuid not null references public.one_on_ones(id) on delete cascade,
  collaborator_id uuid not null references public.users(id),
  felt_heard smallint not null check (felt_heard between 1 and 5),
  comfortable_sharing smallint not null check (comfortable_sharing between 1 and 5),
  leader_engaged smallint not null check (leader_engaged between 1 and 5),
  conversation_quality smallint not null check (conversation_quality between 1 and 5),
  clarity_after_session smallint not null check (clarity_after_session between 1 and 5),
  free_comment text check (free_comment is null or length(free_comment) <= 1000),
  created_at timestamptz not null default now()
);

create unique index idx_warmth_one_per_meeting
  on public.meeting_warmth_responses(one_on_one_id);

create index idx_warmth_collaborator on public.meeting_warmth_responses(collaborator_id);

-- RLS
alter table public.meeting_warmth_responses enable row level security;

create policy "warmth_collaborator_insert"
  on public.meeting_warmth_responses
  for insert
  to authenticated
  with check (collaborator_id = auth.uid());

create policy "warmth_collaborator_select_own"
  on public.meeting_warmth_responses
  for select
  to authenticated
  using (collaborator_id = auth.uid());

create policy "warmth_hr_select_all"
  on public.meeting_warmth_responses
  for select
  to authenticated
  using ((select role from public.users where id = auth.uid()) = 'hr');

-- Vistas agregadas
create or replace view public.warmth_metrics_by_leader as
select
  o.leader_id,
  count(*) as response_count,
  avg(w.felt_heard) as avg_felt_heard,
  avg(w.comfortable_sharing) as avg_comfortable_sharing,
  avg(w.leader_engaged) as avg_leader_engaged,
  avg(w.conversation_quality) as avg_conversation_quality,
  avg(w.clarity_after_session) as avg_clarity_after_session,
  avg((w.felt_heard + w.comfortable_sharing + w.leader_engaged + w.conversation_quality + w.clarity_after_session)::numeric / 5) as avg_overall
from public.meeting_warmth_responses w
join public.one_on_ones o on o.id = w.one_on_one_id
group by o.leader_id;

create or replace view public.warmth_metrics_by_department as
select
  u.department_id,
  d.name as department_name,
  count(*) as response_count,
  avg((w.felt_heard + w.comfortable_sharing + w.leader_engaged + w.conversation_quality + w.clarity_after_session)::numeric / 5) as avg_overall
from public.meeting_warmth_responses w
join public.one_on_ones o on o.id = w.one_on_one_id
join public.users u on u.id = o.collaborator_id
left join public.departments d on d.id = u.department_id
group by u.department_id, d.name;

create or replace view public.warmth_trend_by_leader_month as
select
  o.leader_id,
  date_trunc('month', w.created_at) as month,
  count(*) as response_count,
  avg((w.felt_heard + w.comfortable_sharing + w.leader_engaged + w.conversation_quality + w.clarity_after_session)::numeric / 5) as avg_overall
from public.meeting_warmth_responses w
join public.one_on_ones o on o.id = w.one_on_one_id
group by o.leader_id, date_trunc('month', w.created_at)
order by month desc;

grant select on public.warmth_metrics_by_leader to authenticated;
grant select on public.warmth_metrics_by_department to authenticated;
grant select on public.warmth_trend_by_leader_month to authenticated;

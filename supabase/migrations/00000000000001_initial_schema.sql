-- =============================================================================
-- EXTENSIONES
-- =============================================================================
create extension if not exists "pgcrypto";

-- =============================================================================
-- ENUMS
-- =============================================================================
create type user_role as enum ('collaborator', 'leader', 'hr');
create type meeting_modality as enum ('virtual', 'presencial');
create type meeting_status as enum ('agendada', 'realizada', 'no_realizada', 'en_disputa');
create type non_realization_reason as enum ('reagendada', 'cancelada_cargas', 'ausencia', 'sin_justificacion');
create type agreement_status as enum ('pendiente', 'cumplido', 'parcial', 'no_cumplido');
create type notification_channel as enum ('in_app', 'email', 'slack');
create type ai_report_severity as enum ('info', 'warning', 'critical');
create type cadence_scope as enum ('global', 'department', 'relation');

-- =============================================================================
-- TABLAS
-- =============================================================================

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references public.departments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text not null,
  avatar_url text,
  google_id text unique,
  department_id uuid references public.departments(id) on delete set null,
  role user_role not null default 'collaborator',
  slack_user_id text,
  is_active boolean not null default true,
  google_calendar_token jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_users_department on public.users(department_id);
create index idx_users_role on public.users(role);
create index idx_users_email on public.users(email);

create table public.leadership_relations (
  id uuid primary key default gen_random_uuid(),
  leader_id uuid not null references public.users(id) on delete cascade,
  collaborator_id uuid not null references public.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint no_self_lead check (leader_id <> collaborator_id)
);

create unique index idx_relations_active_collaborator
  on public.leadership_relations(collaborator_id)
  where ended_at is null;

create index idx_relations_leader on public.leadership_relations(leader_id) where ended_at is null;

create table public.cadence_configs (
  id uuid primary key default gen_random_uuid(),
  scope_type cadence_scope not null,
  scope_id uuid,
  frequency_days integer not null check (frequency_days > 0),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_cadence_global on public.cadence_configs((1)) where scope_type = 'global';
create unique index idx_cadence_scope on public.cadence_configs(scope_type, scope_id) where scope_id is not null;

create table public.one_on_ones (
  id uuid primary key default gen_random_uuid(),
  leader_id uuid not null references public.users(id),
  collaborator_id uuid not null references public.users(id),
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 30,
  modality meeting_modality not null,
  location text,
  meet_link text,
  google_calendar_event_id text,
  status meeting_status not null default 'agendada',
  non_realization_reason non_realization_reason,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_oneonones_leader on public.one_on_ones(leader_id);
create index idx_oneonones_collaborator on public.one_on_ones(collaborator_id);
create index idx_oneonones_scheduled on public.one_on_ones(scheduled_at);
create index idx_oneonones_status on public.one_on_ones(status);

create table public.agenda_items (
  id uuid primary key default gen_random_uuid(),
  one_on_one_id uuid not null references public.one_on_ones(id) on delete cascade,
  author_id uuid not null references public.users(id),
  content text not null,
  created_at timestamptz not null default now()
);

create index idx_agenda_oneonone on public.agenda_items(one_on_one_id);

create table public.minutes (
  id uuid primary key default gen_random_uuid(),
  one_on_one_id uuid not null references public.one_on_ones(id) on delete cascade,
  author_id uuid not null references public.users(id),
  raw_content text not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_minutes_oneonone_author on public.minutes(one_on_one_id, author_id);

create table public.agreements (
  id uuid primary key default gen_random_uuid(),
  one_on_one_id uuid not null references public.one_on_ones(id) on delete cascade,
  description text not null,
  responsible_id uuid not null references public.users(id),
  due_date date,
  status agreement_status not null default 'pendiente',
  ai_generated boolean not null default false,
  ai_confidence numeric(3,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_agreements_oneonone on public.agreements(one_on_one_id);
create index idx_agreements_responsible on public.agreements(responsible_id);
create index idx_agreements_status on public.agreements(status);
create index idx_agreements_due_date on public.agreements(due_date) where status = 'pendiente';

create table public.agreement_followups (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  reported_by_id uuid not null references public.users(id),
  reported_status agreement_status not null,
  justification text,
  reported_in_one_on_one_id uuid references public.one_on_ones(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_followups_agreement on public.agreement_followups(agreement_id);

create table public.vobos (
  id uuid primary key default gen_random_uuid(),
  one_on_one_id uuid not null references public.one_on_ones(id) on delete cascade,
  user_id uuid not null references public.users(id),
  confirmed boolean not null,
  confirmed_at timestamptz not null default now()
);

create unique index idx_vobos_unique on public.vobos(one_on_one_id, user_id);

create table public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  leader_id uuid not null references public.users(id),
  collaborator_id uuid not null references public.users(id),
  one_on_one_id uuid references public.one_on_ones(id) on delete cascade,
  type text not null,
  content jsonb not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_insights_leader on public.ai_insights(leader_id);
create index idx_insights_collaborator on public.ai_insights(collaborator_id);

create table public.ai_reports (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null,
  scope_id uuid not null,
  title text not null,
  content text not null,
  severity ai_report_severity not null default 'info',
  reviewed boolean not null default false,
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_reports_severity on public.ai_reports(severity, reviewed);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  channel notification_channel not null,
  title text not null,
  content text not null,
  link text,
  read boolean not null default false,
  sent boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_user on public.notifications(user_id, read);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_user on public.audit_logs(user_id, created_at desc);

-- =============================================================================
-- TRIGGER: updated_at automático
-- =============================================================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_users_updated_at before update on public.users
  for each row execute procedure update_updated_at_column();
create trigger update_departments_updated_at before update on public.departments
  for each row execute procedure update_updated_at_column();
create trigger update_oneonones_updated_at before update on public.one_on_ones
  for each row execute procedure update_updated_at_column();
create trigger update_minutes_updated_at before update on public.minutes
  for each row execute procedure update_updated_at_column();
create trigger update_agreements_updated_at before update on public.agreements
  for each row execute procedure update_updated_at_column();
create trigger update_cadence_updated_at before update on public.cadence_configs
  for each row execute procedure update_updated_at_column();

-- =============================================================================
-- TRIGGER: sincronizar auth.users → public.users al registrarse
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================================================
-- TRIGGER: actualizar status de 1:1 según VoBos recibidos
-- =============================================================================
create or replace function public.update_meeting_status_on_vobo()
returns trigger
language plpgsql
security definer
as $$
declare
  v_confirmed_count int;
  v_denied_count int;
  v_total_count int;
begin
  select
    count(*) filter (where confirmed = true),
    count(*) filter (where confirmed = false),
    count(*)
  into v_confirmed_count, v_denied_count, v_total_count
  from public.vobos
  where one_on_one_id = new.one_on_one_id;

  if v_total_count >= 2 then
    if v_confirmed_count = 2 then
      update public.one_on_ones set status = 'realizada' where id = new.one_on_one_id;
    elsif v_denied_count = 2 then
      update public.one_on_ones set status = 'no_realizada' where id = new.one_on_one_id;
    elsif v_confirmed_count = 1 and v_denied_count = 1 then
      update public.one_on_ones set status = 'en_disputa' where id = new.one_on_one_id;
    end if;
  end if;

  return new;
end;
$$;

create trigger update_meeting_on_vobo
  after insert or update on public.vobos
  for each row execute procedure public.update_meeting_status_on_vobo();

-- =============================================================================
-- FUNCIONES HELPER para RLS
-- =============================================================================
create or replace function public.is_hr()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'hr'
  );
$$;

create or replace function public.is_participant(p_one_on_one_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.one_on_ones
    where id = p_one_on_one_id
      and (leader_id = auth.uid() or collaborator_id = auth.uid())
  );
$$;

create or replace function public.is_leader_of(p_collaborator_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.leadership_relations
    where leader_id = auth.uid()
      and collaborator_id = p_collaborator_id
      and ended_at is null
  );
$$;

-- =============================================================================
-- VISTA: métricas de cumplimiento por departamento
-- =============================================================================
create or replace view public.compliance_metrics as
select
  d.id as department_id,
  d.name as department_name,
  count(distinct o.id) as total_meetings,
  count(distinct o.id) filter (where o.status = 'realizada') as realized_meetings,
  count(distinct o.id) filter (where o.status = 'no_realizada') as missed_meetings,
  count(distinct o.id) filter (where o.status = 'en_disputa') as disputed_meetings,
  count(distinct a.id) as total_agreements,
  count(distinct a.id) filter (where a.status = 'cumplido') as fulfilled_agreements,
  count(distinct a.id) filter (where a.status = 'no_cumplido') as unfulfilled_agreements,
  case
    when count(distinct o.id) > 0
    then round(
      count(distinct o.id) filter (where o.status = 'realizada')::numeric
      / count(distinct o.id) * 100, 2
    )
    else 0
  end as compliance_rate
from public.departments d
left join public.users u on u.department_id = d.id
left join public.one_on_ones o on (o.leader_id = u.id or o.collaborator_id = u.id)
left join public.agreements a on a.one_on_one_id = o.id
group by d.id, d.name;

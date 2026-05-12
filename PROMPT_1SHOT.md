# Sistema 1:1 — Especificación completa para reconstrucción 1-shot

> **Cómo usar**: pega este documento entero como primer mensaje a Claude Code (u otro agente con tooling). El objetivo es que el agente construya el sistema completo en una sola sesión, sin necesidad de iterar pidiendo aclaraciones.
>
> El sistema descrito está en producción en B-Drive (empresa de ~400 personas). Esta spec captura **decisiones de diseño, gotchas reales encontrados durante el desarrollo, y trade-offs UX** — no es solo un wireframe.

---

## 0. Propósito del sistema

Plataforma web interna para profesionalizar la práctica de reuniones uno a uno (1:1) entre líder ↔ colaborador en una organización de ~400 personas. Resuelve tres problemas:

1. **Las 1:1s pasan sin trazabilidad** → trackear cumplimiento de cadencia (cada cuánto se hacen, si efectivamente se realizan).
2. **Los acuerdos se pierden en notas privadas** → IA los estructura desde texto libre a compromisos accionables con responsable + fecha.
3. **RH no ve patrones** → dashboards globales, mapa de calor por área, reportes IA de anomalías, gestión de disputas.

**Filosofía**:
- La minuta es **privada** entre líder y colab (RH NO la lee).
- Los acuerdos son **compartidos** y visibles para RH.
- El sistema **estructura sin imponer estilo de conversación**.

---

## 1. Stack técnico exacto

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | Next.js (App Router, Server Components, Server Actions) | `14.2.18` |
| Lenguaje | TypeScript estricto | `5.6.x` |
| Runtime | Node | `>=20` |
| Auth + BD + Realtime | Supabase (Postgres 17, GoTrue, Realtime) | hosted |
| IA | Anthropic Claude SDK | `@anthropic-ai/sdk ^0.39` |
| Modelo IA | `claude-sonnet-4-5` | |
| Calendar | Google Calendar API v3 (via provider_token de Supabase Auth) | |
| Estilos | Tailwind + custom CSS variables | `tailwindcss ^3.4` |
| Iconos | lucide-react | `^0.460` |
| Formularios | react-hook-form + zod | |
| Email | Resend (opcional) | |
| Slack | @slack/web-api (opcional) | |
| Package manager | pnpm | |

**Tooling de desarrollo**:
- `supabase` CLI para migrations
- `tsx` para scripts de seed/admin/verify

---

## 2. Roles y modelo de permisos

Tres roles mutuamente excluyentes en `users.role`:

| Rol | Acceso UI | Acciones |
|---|---|---|
| `collaborator` | `/colaborador/*` | Ver sus 1:1s, sus acuerdos, su historial, su config. **No puede agendar.** |
| `leader` | `/lider/*` + `/colaborador/1to1/nueva` | Todo lo anterior + dashboard de equipo + perfil por colab + agendar 1:1 |
| `hr` | `/arquitectura-humana/*` | Acceso global: usuarios, mapa de calor, disputas, reportes IA, estructura, cadencias |

Una persona puede ser **leader Y colab simultáneamente** (a través de leadership_relations, no de roles múltiples). El rol determina qué dashboard ve, pero las queries respetan las relaciones reales.

---

## 3. Modelo de datos completo

### 3.1 Enums Postgres

```sql
create type user_role as enum ('collaborator', 'leader', 'hr');
create type meeting_modality as enum ('virtual', 'presencial');
create type meeting_status as enum ('agendada', 'realizada', 'no_realizada', 'en_disputa');
create type non_realization_reason as enum ('reagendada', 'cancelada_cargas', 'ausencia', 'sin_justificacion');
create type agreement_status as enum ('pendiente', 'cumplido', 'parcial', 'no_cumplido');
create type notification_channel as enum ('in_app', 'email', 'slack');
create type ai_report_severity as enum ('info', 'warning', 'critical');
create type cadence_scope as enum ('global', 'department', 'relation');
```

### 3.2 Tablas

#### `departments`
```sql
id uuid pk default gen_random_uuid()
name text not null
parent_id uuid references departments(id) on delete set null
created_at timestamptz not null default now()
```

Seed: `Tecnología`, `Producto`, `Diseño`, `Arquitectura Humana`, `Ventas`, `Operaciones`.

#### `users` (FK a `auth.users` de Supabase via trigger `handle_new_user`)
```sql
id uuid pk references auth.users(id) on delete cascade
email text not null unique
full_name text not null
avatar_url text
google_id text
department_id uuid references departments(id) on delete set null
role user_role not null default 'collaborator'
slack_user_id text
is_active boolean not null default true
google_calendar_token text -- reservado para refresh tokens (no implementado aún)
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Índices: `(department_id)`, `(role)`, `(email)`.

**Trigger `handle_new_user`**: al insertarse un row en `auth.users`, crea automáticamente un row en `public.users` con `role='collaborator'` por default. Esto es crítico — el primer login con Google crea el usuario en ambas tablas.

#### `leadership_relations`
```sql
id uuid pk default gen_random_uuid()
leader_id uuid not null references users(id) on delete cascade
collaborator_id uuid not null references users(id) on delete cascade
started_at timestamptz not null default now()
ended_at timestamptz
created_at timestamptz not null default now()

constraint no_self_lead check (leader_id <> collaborator_id)
```

Índices:
- `unique (collaborator_id) where ended_at is null` — un colab solo tiene UN líder activo
- `(leader_id) where ended_at is null`

**Decisión**: cambios de líder NO modifican rows existentes — se cierra la anterior (`ended_at=now()`) y se crea nueva. Historial completo preservado.

#### `cadence_configs`
```sql
id uuid pk default gen_random_uuid()
scope_type cadence_scope not null
scope_id uuid  -- null para 'global', department_id para 'department', user_id para 'relation'
frequency_days integer not null check (frequency_days > 0)
created_by uuid references users(id) on delete set null
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Índices:
- `unique ((1)) where scope_type='global'` — solo puede haber una cadencia global
- `unique (scope_type, scope_id) where scope_id is not null`

#### `one_on_ones`
```sql
id uuid pk default gen_random_uuid()
leader_id uuid not null references users(id)
collaborator_id uuid not null references users(id)
scheduled_at timestamptz not null
duration_minutes integer not null default 30
modality meeting_modality not null
location text  -- solo si presencial
meet_link text  -- solo si virtual (lo llena la integración de Calendar)
google_calendar_event_id text  -- id del evento creado en Calendar primary del líder
status meeting_status not null default 'agendada'
non_realization_reason non_realization_reason
created_by uuid references users(id)
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Índices: `(leader_id)`, `(collaborator_id)`, `(scheduled_at)`, `(status)`, **composite `(leader_id, collaborator_id, scheduled_at desc)` para perfil de colab**.

#### `agenda_items`
```sql
id uuid pk default gen_random_uuid()
one_on_one_id uuid not null references one_on_ones(id) on delete cascade
content text not null
author_id uuid not null references users(id)
created_at timestamptz not null default now()
```

#### `minutes` ⚠️ Decisión crítica de UX
```sql
id uuid pk default gen_random_uuid()
one_on_one_id uuid not null references one_on_ones(id) on delete cascade
author_id uuid not null references users(id)  -- último que editó
raw_content text not null
processed_at timestamptz
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

**Unique index**: `(one_on_one_id)` — **UNA minuta por 1:1**, no una por autor. Ambos participantes editan el mismo texto. El `author_id` es solo "última persona que guardó".

> **Por qué**: el modelo "una minuta por autor" probado en V1 generaba confusión severa: líder veía "sin minuta" aunque el colab ya había escrito. La minuta es **compartida** entre los dos, pero **invisible para RH**.

#### `agreements`
```sql
id uuid pk default gen_random_uuid()
one_on_one_id uuid not null references one_on_ones(id) on delete cascade
description text not null
responsible_id uuid not null references users(id)
due_date date  -- nullable: no todos los acuerdos tienen fecha
status agreement_status not null default 'pendiente'
ai_generated boolean not null default false
ai_confidence numeric(3,2)  -- 0.00 - 1.00, lo que devuelve la IA
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Índices: `(one_on_one_id)`, `(responsible_id)`, `(status)`, `(due_date) where status='pendiente'`, **composite `(responsible_id, status)`**.

#### `agreement_followups`
```sql
id uuid pk default gen_random_uuid()
agreement_id uuid not null references agreements(id) on delete cascade
reported_in_one_on_one_id uuid references one_on_ones(id) on delete set null
reported_status agreement_status not null
justification text
reported_by uuid not null references users(id)
created_at timestamptz not null default now()
```

#### `vobos` (visto-bueno / aprobación de acuerdos)
```sql
id uuid pk default gen_random_uuid()
one_on_one_id uuid not null references one_on_ones(id) on delete cascade
user_id uuid not null references users(id)
confirmed boolean not null  -- true = apruebo, false = no apruebo
confirmed_at timestamptz not null default now()
```

Unique: `(one_on_one_id, user_id)`.

**Significado redefinido**: el VoBo NO es "se realizó la reunión" — es **"apruebo los acuerdos registrados"**. Aprobar implica que la reunión se realizó (sino, ¿de dónde salen los acuerdos?). Esto simplifica el flujo de un binario a una aprobación con sentido.

#### `ai_insights` (sugerencias de IA al líder pre-1:1, opcional)
```sql
id uuid pk default gen_random_uuid()
leader_id uuid not null references users(id)
collaborator_id uuid not null references users(id)
one_on_one_id uuid references one_on_ones(id) on delete cascade
type text not null  -- 'suggested_questions', etc.
content jsonb not null
used boolean not null default false
created_at timestamptz not null default now()
```

> **Nota**: esta tabla **puede omitirse** si no se va a implementar el módulo de "sugerencias pre-1:1". En la versión actual NO se cablea (la feature fue removida por no aportar valor demostrable).

#### `ai_reports` (patrones detectados a nivel organizacional, para RH)
```sql
id uuid pk default gen_random_uuid()
scope_type text not null  -- 'department' | 'user' | 'global'
scope_id uuid not null
title text not null
content text not null
severity ai_report_severity not null default 'info'
reviewed boolean not null default false
reviewed_by uuid references users(id)
reviewed_at timestamptz
created_at timestamptz not null default now()
```

Índice: `(severity, reviewed)`.

#### `notifications`
```sql
id uuid pk default gen_random_uuid()
user_id uuid not null references users(id) on delete cascade
channel notification_channel not null
title text not null
content text not null
link text
read boolean not null default false
sent boolean not null default false
created_at timestamptz not null default now()
```

Índice: `(user_id, read)`.

#### `audit_logs`
```sql
id uuid pk default gen_random_uuid()
user_id uuid references users(id) on delete set null
action text not null  -- 'role_changed', 'leader_assigned', 'dispute_resolved', 'vobos_invalidated', etc.
resource_type text not null  -- 'user', 'one_on_one', 'agreement'
resource_id uuid
metadata jsonb
created_at timestamptz not null default now()
```

Índice: `(user_id, created_at desc)`.

### 3.3 Vista materializada para mapa de calor

```sql
create view compliance_metrics as
select
  d.id as department_id,
  d.name as department_name,
  count(distinct oo.id) filter (where oo.scheduled_at >= date_trunc('month', now())) as total_meetings,
  count(distinct oo.id) filter (where oo.status = 'realizada' and oo.scheduled_at >= date_trunc('month', now())) as realized_meetings,
  count(distinct oo.id) filter (where oo.status = 'en_disputa') as disputed_meetings,
  count(distinct ag.id) as total_agreements,
  count(distinct ag.id) filter (where ag.status = 'cumplido') as fulfilled_agreements,
  case
    when count(distinct oo.id) filter (where oo.scheduled_at >= date_trunc('month', now())) > 0
    then round(100.0 * count(distinct oo.id) filter (where oo.status = 'realizada' and oo.scheduled_at >= date_trunc('month', now())) / count(distinct oo.id) filter (where oo.scheduled_at >= date_trunc('month', now())), 2)
    else 0
  end as compliance_rate
from departments d
left join users u on u.department_id = d.id
left join one_on_ones oo on oo.leader_id = u.id or oo.collaborator_id = u.id
left join agreements ag on ag.one_on_one_id = oo.id
group by d.id, d.name;
```

---

## 4. Triggers y functions críticos

### 4.1 `handle_new_user` (auto-crear public.users desde auth.users)
```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.users (id, email, full_name, role, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'collaborator',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### 4.2 `update_meeting_status_on_vobo` (transición automática de status)
```sql
create or replace function public.update_meeting_status_on_vobo()
returns trigger
language plpgsql
as $$
declare
  v_total_count int;
  v_confirmed_count int;
  v_denied_count int;
begin
  select count(*), count(*) filter (where confirmed), count(*) filter (where not confirmed)
  into v_total_count, v_confirmed_count, v_denied_count
  from public.vobos where one_on_one_id = new.one_on_one_id;

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
  for each row execute function public.update_meeting_status_on_vobo();
```

### 4.3 `invalidate_vobos_on_agreement_change` ⚠️ Trigger crítico de integridad

```sql
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
    -- Solo invalida si cambia estructura, NO si solo cambia status
    if old.description is distinct from new.description
       or old.responsible_id is distinct from new.responsible_id
       or old.due_date is distinct from new.due_date then
      v_changed := true;
      v_reason := 'agreement_edited';
    end if;
  end if;

  if v_changed then
    delete from public.vobos where one_on_one_id = v_target;
    update public.one_on_ones
      set status = 'agendada'
      where id = v_target
        and status in ('realizada', 'no_realizada', 'en_disputa');
    insert into public.audit_logs (user_id, action, resource_type, resource_id, metadata)
    values (null, 'vobos_invalidated', 'one_on_one', v_target, jsonb_build_object('reason', v_reason));
  end if;

  return coalesce(new, old);
end;
$$;

create trigger trg_invalidate_vobos
  after insert or update or delete on public.agreements
  for each row execute function public.invalidate_vobos_on_agreement_change();
```

> **Por qué importa**: si alguien cambia los acuerdos después de que el otro aprobó, ese consentimiento queda desactualizado. El trigger lo invalida automáticamente, forzando re-aprobación. Sin esto, los acuerdos podrían modificarse silenciosamente después del cierre.

### 4.4 Funciones helper para RLS

```sql
create or replace function public.is_hr() returns boolean
language sql security definer stable
as $$
  select exists(select 1 from public.users where id = auth.uid() and role = 'hr');
$$;

create or replace function public.is_participant(p_one_on_one_id uuid) returns boolean
language sql security definer stable
as $$
  select exists(
    select 1 from public.one_on_ones
    where id = p_one_on_one_id
      and (leader_id = auth.uid() or collaborator_id = auth.uid())
  );
$$;
```

---

## 5. RLS Policies (todas las tablas tienen RLS habilitado)

### `users`
- SELECT: cualquier autenticado puede ver datos básicos.
- UPDATE: el propio user (campos limitados) o HR.

### `leadership_relations`
- SELECT: si soy líder, colab, o HR.
- ALL: solo HR (los cambios pasan por server action).

### `one_on_ones`
- SELECT: si soy participante o HR.
- INSERT/UPDATE: participantes (la action valida que sea líder/hr).
- DELETE: solo HR.

### `minutes`
- SELECT/INSERT/UPDATE: cualquier participante. RH **NO** tiene acceso.

### `agreements`
- SELECT: participantes O HR (visibles para HR — son los compromisos formales).
- INSERT/UPDATE/DELETE: participantes.

### `vobos`
- SELECT: participantes y HR.
- INSERT/UPDATE: solo el propio user puede crear/cambiar su voto.

### `ai_insights`
- SELECT: solo el líder destinatario.

### `ai_reports`
- SELECT/UPDATE: solo HR.

### `notifications`
- SELECT/UPDATE: el propio usuario destinatario.

### `audit_logs`
- SELECT: solo HR.

---

## 6. Migraciones SQL en orden

```
00000000000001_initial_schema.sql       -- todo lo anterior
00000000000002_rls_policies.sql         -- policies
00000000000003_shared_minutes.sql       -- unique(one_on_one_id) en minutes + delete old data
00000000000004_realtime_publication.sql -- agrega minutes, agreements, vobos, agenda_items a supabase_realtime publication
00000000000005_perf_and_cleanup.sql     -- índices compuestos + dedup ai_reports
00000000000006_vobo_invalidation.sql    -- trigger trg_invalidate_vobos + policy delete agreements
```

### `00000000000003_shared_minutes.sql`
```sql
delete from public.minutes;
drop index if exists public.idx_minutes_oneonone_author;
create unique index idx_minutes_oneonone on public.minutes(one_on_one_id);
drop policy if exists "minutes_update_author" on public.minutes;
create policy "minutes_update_participants" on public.minutes
  for update using (public.is_participant(one_on_one_id));
```

### `00000000000004_realtime_publication.sql`
```sql
alter publication supabase_realtime add table public.minutes;
alter publication supabase_realtime add table public.agreements;
alter publication supabase_realtime add table public.vobos;
alter publication supabase_realtime add table public.agenda_items;
```

### `00000000000005_perf_and_cleanup.sql`
```sql
create index if not exists idx_oneonones_leader_collab_scheduled
  on public.one_on_ones (leader_id, collaborator_id, scheduled_at desc);

create index if not exists idx_agreements_responsible_status
  on public.agreements (responsible_id, status);

delete from public.ai_reports
where id in (
  select id from (
    select id, row_number() over (partition by scope_type, scope_id, title order by created_at desc) as rn
    from public.ai_reports
  ) d
  where rn > 1
);
```

### `00000000000006_vobo_invalidation.sql`
Ver código en sección 4.3 + policy `agreements_delete_participants`.

---

## 7. Configuración Supabase Auth

### 7.1 Google OAuth provider (Supabase Dashboard → Auth → Providers → Google)
- Habilitado
- Client ID + Client Secret de Google Cloud Console
- `skip_nonce_check = true` (necesario para sign in local con Google)

### 7.2 Site URL + Redirect URLs (Auth → URL Configuration)
- Site URL: `http://localhost:3000` (en prod: dominio real)
- Additional Redirect URLs:
  - `http://localhost:3000`
  - `http://localhost:3000/api/auth/callback`
  - `http://localhost:3000/**`

### 7.3 Configuración del proveedor en Google Cloud Console
- Crear OAuth Client ID (Web app)
- Authorized Redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
- Scopes requeridos al loguear: `email`, `profile`, `openid`, `https://www.googleapis.com/auth/calendar`
- APIs habilitadas: **Google Calendar API**, **Google People API**

### 7.4 Frontend invoca el OAuth con scopes
```ts
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${origin}/api/auth/callback`,
    scopes: 'https://www.googleapis.com/auth/calendar',
    queryParams: { access_type: 'offline', prompt: 'consent' },
  },
})
```

### 7.5 Toda la config de auth versionable
La config relevante de Supabase Auth se almacena en `supabase/config.toml` (provider Google con env var para el secret) y se aplica con `supabase config push`.

---

## 8. Variables de entorno (`.env.local`) — **valores reales de test**

> ⚠️ **Estos son accesos de un entorno de prueba, ya están publicados intencionalmente en este prompt para reproducibilidad. NO uses estos valores en producción — rota todo antes de cualquier deploy real.**

```bash
# ========================================
# SUPABASE
# ========================================
NEXT_PUBLIC_SUPABASE_URL=https://mlmpjeneeckfdyqavwgj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sbXBqZW5lZWNrZmR5cWF2d2dqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwODM4MjYsImV4cCI6MjA5MzY1OTgyNn0.ao9XAz7xCOHGaPdCSRlYZwmaVgk8foznGHBmtb9fTCQ
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sbXBqZW5lZWNrZmR5cWF2d2dqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA4MzgyNiwiZXhwIjoyMDkzNjU5ODI2fQ.pIfzuH_K9bS07G7hYMqep0Nz1jAKlWKPDPVkTfDrLDg
SUPABASE_PROJECT_REF=mlmpjeneeckfdyqavwgj
SUPABASE_DB_PASSWORD=Elmata09060101.

# ========================================
# ADMIN INICIAL (lo crea el script create-admin)
# ========================================
ADMIN_EMAIL=admin@b-drive.com
ADMIN_PASSWORD=admin
ADMIN_FULL_NAME=Administrador del Sistema

# ========================================
# GOOGLE OAUTH
# (estos valores se configuran en Supabase Dashboard → Auth → Providers → Google.
#  La app NO los lee directamente; Supabase maneja el OAuth. Las env vars son solo
#  para que el script verify.ts compruebe que están seteados.)
# ========================================
GOOGLE_CLIENT_ID=98483174330-kl5vlf4h8glopfp4vse0dg48gvrep60d.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback

# ========================================
# ANTHROPIC CLAUDE
# ========================================
ANTHROPIC_API_KEY=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

# ========================================
# OPCIONALES — vacíos a propósito en el entorno de test.
# Si quieres habilitar Slack/Resend, crea las cuentas y pega aquí.
# Si no, los módulos correspondientes (notify.ts, email/client.ts) detectan
# la ausencia y se vuelven no-ops sin romper nada.
# ========================================
SLACK_BOT_TOKEN=
SLACK_DEFAULT_CHANNEL=
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# ========================================
# APP
# ========================================
NEXT_PUBLIC_APP_URL=http://localhost:3000
# CRON_SECRET vacío en test — para prod, generar un string aleatorio largo
# (>32 chars) y configurar headers Authorization: Bearer <CRON_SECRET> en
# los jobs que llamen a /api/cron/*
CRON_SECRET=

# ========================================
# SEED
# ========================================
SEED_DEMO_DATA=true
```

**Variable adicional para `supabase config push`** (no va en `.env.local`, se exporta inline):

```bash
# El nombre se mapea con env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET) en
# supabase/config.toml. Es el mismo valor que GOOGLE_CLIENT_SECRET.
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=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

# Uso típico:
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET="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" supabase config push --yes
```

**URLs derivadas que vas a necesitar**:
- Callback de Google → Supabase: `https://mlmpjeneeckfdyqavwgj.supabase.co/auth/v1/callback`
- Callback final de Supabase → app: `http://localhost:3000/api/auth/callback`
- Dashboard Supabase del proyecto: `https://supabase.com/dashboard/project/mlmpjeneeckfdyqavwgj`
- Auth Providers: `https://supabase.com/dashboard/project/mlmpjeneeckfdyqavwgj/auth/providers`
- URL Configuration: `https://supabase.com/dashboard/project/mlmpjeneeckfdyqavwgj/auth/url-configuration`
- DB connection string: `postgresql://postgres.mlmpjeneeckfdyqavwgj:Elmata09060101.@aws-0-us-west-1.pooler.supabase.com:6543/postgres` (pooler, transaction mode)

---

## 9. Server Actions (TypeScript, `'use server'`)

### `src/lib/actions/one-on-ones.ts`

**`scheduleOneOnOne({ collaboratorId, scheduledAt, durationMinutes, modality, location? })`**
- Auth required
- **Defense**: valida que `users.role` del caller sea `'leader' | 'hr'`. Si es `collaborator` devuelve error.
- INSERT en `one_on_ones` con `leader_id = currentUser.id`
- Si `session.provider_token` existe: llama `createCalendarEvent` con ese token. Si éxito, UPDATE `google_calendar_event_id` y `meet_link`.
- Si Calendar falla: loggea warning pero NO falla la operación (la 1:1 ya quedó creada).
- `revalidatePath('/lider')`, `revalidatePath('/colaborador')`

**`cancelOneOnOne({ oneOnOneId, reason })`**
- Auth required
- UPDATE status → `'no_realizada'` con razón
- Lee `google_calendar_event_id`, si existe + provider_token → `deleteCalendarEvent`
- Audit log

### `src/lib/actions/minutes.ts`

**`saveMinute({ oneOnOneId, rawContent })` → `{ extractedCount, aiError? }`**
- Auth required
- UPSERT en `minutes` con `onConflict: 'one_on_one_id'` (UNA minuta por 1:1)
- **Auto-extracción IA**:
  - Lee leader y collaborator de la 1:1
  - Llama `extractAgreements({ rawMinute, leader, collaborator })`
  - Si devuelve acuerdos:
    - DELETE acuerdos previos con `ai_generated=true AND status='pendiente'` (idempotencia — solo borra pendientes, no clobbea seguimiento posterior)
    - INSERT nuevos con `responsible_id` mapeado del email (lookup contra leader/collaborator emails), `ai_confidence` del modelo
- Si IA falla: minuta sí se guarda, devuelve `aiError` informativo
- `revalidatePath` de las 4 rutas afectadas

### `src/lib/actions/agreements.ts`

- **`createAgreement({ oneOnOneId, description, responsibleId, dueDate?, aiGenerated?, aiConfidence? })`**
- **`updateAgreementStatus({ agreementId, status })`** — para seguimiento
- **`deleteAgreement({ agreementId })`** — auth participante, audit log, revalidate
- **`reportAgreementFollowup({ agreementId, reportedStatus, justification?, reportedInOneOnOneId? })`**

### `src/lib/actions/vobos.ts`

**`submitVobo({ oneOnOneId, confirmed })`**
- Auth + verifica participante
- UPSERT en `vobos` con `onConflict: 'one_on_one_id,user_id'`
- El trigger `update_meeting_on_vobo` se encarga del status automáticamente

### `src/lib/actions/disputes.ts`

**`resolveDispute({ oneOnOneId, resolution, reason? })`** — HR only
- Auth + valida role='hr'
- UPDATE `status` → 'realizada' o 'no_realizada' (solo si status era 'en_disputa')
- Audit log

### `src/lib/actions/reports.ts`

**`markReportReviewed({ reportId })`** — HR only
- UPDATE `reviewed=true, reviewed_by=user.id, reviewed_at=now()`

### `src/lib/actions/users.ts` — todas HR-only, todas con audit_log

**`updateUserRole({ userId, role })`**
**`updateUserActive({ userId, isActive })`**
**`assignLeader({ collaboratorId, newLeaderId? })`** — cierra relación previa con `ended_at`, crea nueva. Si `newLeaderId=null`, deja al colab sin líder.

---

## 10. Integración con IA (Anthropic)

### 10.1 Cliente — **lazy init obligatorio**

```ts
// src/lib/ai/client.ts
import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null

export function getAIClient() {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY no está configurada en el server')
    _client = new Anthropic({ apiKey })
  }
  return _client
}
```

> **Gotcha real**: si instancias el cliente al **import time del módulo** (`const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })`), en Next.js prod `process.env` puede no estar listo cuando carga el módulo. El cliente queda construido con `apiKey: undefined` y SIEMPRE falla con "Could not resolve authentication method", aunque la env var aparezca después. **Lazy init lo resuelve.**

### 10.2 Función `extractAgreements({ rawMinute, leader, collaborator })`

Llama `claude-sonnet-4-5` con prompt:

```
Eres un asistente que extrae acuerdos estructurados de minutas de 1:1.

Participantes:
- Líder: {leader.name} ({leader.email})
- Colaborador: {collaborator.name} ({collaborator.email})

Minuta:
{rawMinute}

Extrae los acuerdos concretos (compromisos accionables) en JSON sin markdown:
{
  "agreements": [
    {
      "description": "Descripción clara del compromiso",
      "responsible_email": "email del responsable (líder o colab)",
      "due_date": "YYYY-MM-DD o null si no se menciona fecha",
      "confidence": 0.0 a 1.0
    }
  ]
}

Reglas:
- Solo extrae acuerdos explícitos
- No inventes responsables ni fechas
- Devuelve { "agreements": [] } si no hay
```

Devuelve `{ agreements: ExtractedAgreement[], error?: string }`. El try/catch externo **debe loggear el error** (no swallow silencioso) y devolver error legible al usuario.

### 10.3 Otras funciones de IA (opcionales)
- `analyzePatterns(...)` — para `/api/ai/analyze-patterns` (genera ai_reports)
- `generateFollowupPlan(...)` — plan post-1:1 para el líder

---

## 11. Integración con Google Calendar

### 11.1 `src/lib/google/calendar.ts`

```ts
export async function createCalendarEvent({
  summary, description, startIso, endIso, attendeeEmails, modality, accessToken,
}): Promise<{ success, eventId?, meetLink?, error? }> {
  const body: any = {
    summary,
    description,
    start: { dateTime: startIso, timeZone: 'America/Mexico_City' },
    end: { dateTime: endIso, timeZone: 'America/Mexico_City' },
    attendees: attendeeEmails.map(email => ({ email })),
  }

  if (modality === 'virtual') {
    body.conferenceData = {
      createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } },
    }
  }

  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
    { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  )
  // ...returns { eventId, meetLink (extraído de conferenceData.entryPoints[type='video'].uri) }
}

export async function deleteCalendarEvent(eventId, accessToken)
export async function updateCalendarEvent(eventId, updates)  // para reschedule (no implementado aún)
```

### 11.2 De dónde viene el `accessToken`

```ts
const { data: { session } } = await supabase.auth.getSession()
const accessToken = session?.provider_token  // Google access token con scope Calendar
```

> **Gotchas**:
> - El `provider_token` solo existe si el usuario se logueó **con Google** (no con email/password). Si es admin con password, no hay token → Calendar no se crea.
> - Expira en **1 hora**. No hay refresh automático (la columna `google_calendar_token` está reservada pero no se cablea aún).
> - Para demos: re-loguear con Google justo antes de mostrar.

---

## 12. Rutas / Vistas

### 12.1 Rutas top-level
```
/                       → redirect según rol (middleware)
/login                  → form email/pw + botón "Continuar con Google"
/api/auth/callback      → exchange code → session, redirect a home según rol
/api/ai/extract-agreements      → POST { oneOnOneId, rawContent }
/api/ai/analyze-patterns        → POST (opcional, para ai_reports)
/api/cron/check-cadence         → GET con Bearer CRON_SECRET, manda notifs
/api/cron/notify-due-agreements → GET con Bearer CRON_SECRET
```

### 12.2 Layout dashboard `(dashboard)/layout.tsx`
Server component que:
1. Verifica auth, redirect a `/login` si no
2. Lee `users.role` y `full_name`
3. Renderiza `<AppShell>` (client component) con sidebar + header + main

### 12.3 Sidebar — items por rol

```ts
collaborator: [
  { Inicio, /colaborador },
  { Mis acuerdos, /colaborador/acuerdos },
  { Historial, /colaborador/historial },
  { Configuración, /colaborador/configuracion },
]

leader: [
  { Resumen, /lider },
  { Mi equipo, /lider/equipo },
  { Agendar 1:1, /colaborador/1to1/nueva },
  { Configuración, /lider/configuracion },
]

hr: [
  { Panel general, /arquitectura-humana },
  { Mapa de calor, /arquitectura-humana/mapa-calor },
  { Reportes IA, /arquitectura-humana/reportes },
  { Disputas, /arquitectura-humana/disputas },
  { Cadencias, /arquitectura-humana/cadencias },
  { Estructura, /arquitectura-humana/estructura },
  { Usuarios, /arquitectura-humana/usuarios },
  { Configuración, /arquitectura-humana/configuracion },
]
```

### 12.4 Vistas específicas con contenido

#### `/colaborador` (inicio del colab)
- 3 KPIs: Próximas 1:1s, Acuerdos cumplidos, 1:1s realizadas
- **Banda amber "Esperan tu confirmación"** (si hay 1:1s pasadas sin VoBo del usuario): lista con botón "Confirmar"
- "Próximas reuniones" (filtro: status='agendada', scheduled_at >= startOfToday)
- "Acuerdos pendientes" (responsible_id=user.id, status='pendiente')

#### `/colaborador/acuerdos`
- 4 KPIs: Total / Pendientes / Cumplidos / No cumplidos
- **Chips de filtro** por status
- Lista con cada acuerdo:
  - Texto, chip "IA" si aplica
  - "Creado [fecha]" + link a 1:1 origen ("1:1 con [líder] · [fecha]")
  - **Status pill clickeable** que abre dropdown para cambiar status (optimistic UI con rollback)
  - Si vencido (due_date < now y pendiente): badge "Vencido" rojo en vez de "Pendiente"

#### `/colaborador/historial`
- Lista de últimas 50 1:1s del colab con filtros por status

#### `/colaborador/1to1/[id]`
- Validar que el user es participante; sino redirect
- Header con info de la 1:1 + chip de status
- Avatares líder ↔ colab
- Botón "Unirse a Meet" si hay `meet_link`
- **Componente `<AgendaList>`** (agregar/ver temas previos)
- Si `isPastMeeting`: **`<DetailInteraction>`** con minuta + acuerdos + VoBo

#### `/colaborador/1to1/nueva`
- Defensa: redirect si role !== 'leader' && role !== 'hr'
- Form con: counterpart (select de colabs del líder), fecha, hora, duración (chips 15/30/45/60), modalidad (Virtual/Presencial), location si presencial
- Submit → `scheduleOneOnOne` action

#### `/lider` (resumen)
- 3 KPIs: Colaboradores a cargo, 1:1s este mes (con realizadas), Cumplimiento %
- **Banda amber "Esperan tu confirmación"** (1:1s pasadas sin VoBo del líder)
- "Mi equipo" — fila por colab con próxima 1:1 y botón "Ver"
- **"1:1s recientes"** — últimas 5 1:1s (cualquier status) con badge status, conteo de acuerdos, badge "Sin notas" si pasada y sin minuta

#### `/lider/equipo`
- Cards de colaboradores **clickeables** (link a `/lider/colaborador/[id]`)
- Avatar + nombre + email + badge "N pendientes"
- Si tiene pendientes: lista compacta de cada acuerdo con status

#### `/lider/colaborador/[id]` ⭐ Vista crítica
- Defensa: validar que el líder tiene relación activa con este colab, o que es HR. Sino redirect.
- Header: avatar grande, nombre, email, depto, "Reporta a...", botón "Agendar 1:1"
- 4 KPIs: cumplimiento de cadencia, total 1:1s, acuerdos pendientes, días desde última 1:1
- **Compromisos del colab** (responsable de): lista con badge status, fecha vencimiento, link a 1:1 origen
- **Historial de 1:1s** con este colab: lista con status, modality, duración, ratio de acuerdos cumplidos

#### `/lider/configuracion`
- Tabs: Perfil · Cuenta · Notificaciones · Preferencias 1:1 · Integraciones · Apariencia

#### `/arquitectura-humana` (panel HR)
- KPIs grandes: Cumplimiento % global, No realizadas este mes, En disputa, Reportes IA sin revisar, Acuerdos pendientes / cumplidos / total
- **Cumplimiento por área** (barras horizontales con compliance_metrics view)

#### `/arquitectura-humana/mapa-calor`
- Grid 2x3-4 de cards por área con compliance_rate
- Colores: verde ≥80%, amber 60-79, orange 40-59, red <40
- **Cards clickeables** → `/arquitectura-humana/usuarios?department=<id>`

#### `/arquitectura-humana/reportes`
- Lista de `ai_reports` con título, severity badge, contenido
- Botón **"Marcar como revisado"** por reporte (HR action)
- Reportes revisados quedan opacos

#### `/arquitectura-humana/disputas`
- Lista de 1:1s con `status='en_disputa'`
- Por cada una: ambos VoBos contradictorios visualizados
- **`<DisputeResolver>`** — botones "Sí se realizó / No se realizó" con confirmación

#### `/arquitectura-humana/cadencias`
- "Cadencia global" = N días entre 1:1s (lee/edita cadence_configs con scope_type='global')
- Opcional: cadencias por área / por relación

#### `/arquitectura-humana/estructura`
- Lista agrupada por área: líder → colab activos

#### `/arquitectura-humana/usuarios`
- 4 KPIs (Total, HR, Líderes, Colaboradores)
- **Filtros por rol y por área** (chips clickeables que actualizan querystring)
- Lista de usuarios **clickeables** (link a `/arquitectura-humana/usuarios/[id]`)
- Avatar + nombre + email + depto + badge rol

#### `/arquitectura-humana/usuarios/[id]` ⭐ Vista crítica
- Defensa: role='hr' required
- Header con info + badges (rol, inactivo si aplica)
- 4 KPIs: cumplimiento, total 1:1s, acuerdos pendientes, disputas abiertas
- **Compromisos como responsable** (lista)
- **Historial de 1:1s** (donde sea líder o colab — etiquetar el rol en cada fila)
- Panel derecho: **`<UserAdminControls>`**
  - Cambiar rol (select)
  - Asignar líder (select)
  - Toggle activo/inactivo
  - Botón "Guardar cambios" (dirty tracking)
  - Cada cambio queda en `audit_logs`
- **Auditoría reciente** — últimos 10 cambios sobre este usuario

---

## 13. Componentes UI clave

### `<AppShell>` (client)
- Provee context: drawer (mobile sidebar), Cmd+K (command palette)
- Detecta atajos: `g h` home, `g a` agendar (solo leader), `g e` equipo (leader), `g k` acuerdos (colab), etc.
- ⌘K abre command palette con búsqueda fuzzy

### `<MinuteEditor>` (client)
- Textarea + contador palabras/chars
- Único botón **"Guardar minuta"** que dispara save + auto-extracción
- Spinner durante guardado (~5-7s mientras corre IA)
- Mensaje resultado: "✓ Se extrajeron N acuerdos" o aiError
- **Indicador "En vivo"** (pulse verde) cuando hay realtime subscription activa
- **Resolución de conflictos**: si llega update del otro participante mientras edito, mostrar banner amber "La otra persona guardó cambios" con botón "Ver versión nueva". Si NO estoy editando, sincronizar silenciosamente.

### `<AgreementList>` (client)
- Usado dentro del detalle de 1:1
- Lista de acuerdos con: descripción, responsable (avatar+nombre), fecha vencimiento, chip "IA"
- **NO muestra status pill aquí** (todos los acuerdos nacen "pendiente" — el seguimiento se hace en `/colaborador/acuerdos`)
- Botón **🗑 Eliminar** prominente alineado verticalmente con el texto del acuerdo (no abajo). Padding generoso, hover rojo. Confirmación nativa avisando que se invalidarán VoBos.
- Botón "Agregar manualmente" abre form inline (descripción, responsable, fecha)
- Sincronización: cuando llega update por realtime, hace `setAgreements(initialAgreements)` pero **preserva filas con id que empieza con `temp-`** (optimistic local).

### `<AgreementStatusPill>` (client) — solo en `/colaborador/acuerdos`
- Badge clickeable que abre dropdown con 4 opciones
- Optimistic update con rollback en error
- Si overdue: badge muestra "Vencido" rojo en lugar del status real, pero la opción real sigue siendo "pendiente"

### `<VoboButton>` (client) ⭐ Componente crítico

Pregunta: **"¿Apruebas los acuerdos registrados?"** (NO "se realizó")

Props: `userVobo, partnerVobo, partnerName, agreementsCount`

Estados:
1. **Sin acuerdos** (`agreementsCount === 0`): bloqueado con mensaje "Aún no hay acuerdos registrados"
2. **No voté** (`userVobo === null`): muestra contador `{0|1}/2 aprobaciones`, contexto ("[partnerName] ya aprobó — falta tu confirmación", o "indicó que no aprueba — si tú lo haces, se levantará una disputa") + 2 botones "Sí, apruebo" / "No estoy de acuerdo"
3. **Voté**: card con avatar verde/rojo, status mío, contador, mensaje contextual:
   - Ambos true → "✓ Ambos aprobaron — la reunión se marcó como realizada"
   - Ambos false → "✗ Reunión marcada como no realizada"
   - Mixto → "⚠ Discrepancia — la 1:1 entró en disputa"
   - Solo yo voté → "Esperando aprobación de [partnerFirstName]"
   - Botón "Cambiar" para volver a estado 2

### `<DisputeResolver>` (client, solo HR)
- Footer en card de disputa con 2 botones: "Sí se realizó" (success), "No se realizó" (danger)
- `confirm()` nativo antes de ejecutar

### `<UserAdminControls>` (client, solo HR)
- Form con role select, leader select, isActive checkbox
- Dirty tracking + botón "Guardar cambios" deshabilitado si no hay cambios
- Mensajes de éxito/error inline

### `<DetailInteraction>` (client) — wrapper de minuta+acuerdos+vobo
- Usa hook `useRealtimeMeeting(oneOnOneId, currentUserId)` para suscribirse a cambios en `minutes/agreements/vobos/agenda_items` con filter `one_on_one_id=eq.X`
- Cada cambio del **otro participante** dispara `router.refresh()` (ignora cambios propios)
- Indicador visual de "En vivo" pulsante

---

## 14. Hook `useRealtimeMeeting`

```ts
'use client'
export function useRealtimeMeeting(oneOnOneId: string, currentUserId: string) {
  const router = useRouter()
  useEffect(() => {
    const supabase = createClient()
    function trigger(actorId: string | null) {
      if (actorId && actorId === currentUserId) return // ignorar cambios propios
      router.refresh()
    }
    const channel = supabase
      .channel(`meeting:${oneOnOneId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'minutes',     filter: `one_on_one_id=eq.${oneOnOneId}` }, p => trigger((p.new as any)?.author_id ?? (p.old as any)?.author_id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agreements',  filter: `one_on_one_id=eq.${oneOnOneId}` }, () => trigger(null))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vobos',       filter: `one_on_one_id=eq.${oneOnOneId}` }, p => trigger((p.new as any)?.user_id ?? (p.old as any)?.user_id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_items',filter: `one_on_one_id=eq.${oneOnOneId}` }, p => trigger((p.new as any)?.author_id ?? (p.old as any)?.author_id))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [oneOnOneId, currentUserId, router])
}
```

---

## 15. Middleware (`src/middleware.ts`)

- Inyecta `x-pathname` header (para que server components sepan la ruta)
- Si no autenticado y ruta protegida (`/colaborador`, `/lider`, `/arquitectura-humana`): redirect a `/login`
- Si autenticado y va a `/login`: redirect a home según rol (`hr` → `/arquitectura-humana`, `leader` → `/lider`, else `/colaborador`)
- El callback OAuth (`/api/auth/callback`) está excluido del matcher

---

## 16. Design system

### Variables CSS clave (`src/app/globals.css`)

```css
:root {
  /* Brand */
  --accent-50..900   /* índigo / cobalto eléctrico */
  --lime-50..700     /* lima signature */
  --green/amber/red/orange/violet-50..700  /* funcional */
  --slate-50..950
  --warm-50..200     /* fondos cálidos */

  /* Surfaces */
  --bg-app, --bg-card (#fff), --bg-sidebar (#0a0a0c), --bg-muted, --bg-subtle
  --border-c, --border-strong
  --text-c, --text-muted, --text-subtle

  /* Radii: --r-sm 6, --r-md 8, --r-lg 12, --r-xl 16, --r-2xl 20 */
  /* Shadows con tinte de brand (--shadow-xs, sm, md, lg, popover, glow, brand) */
  /* Easing: --ease-out, --ease-in-out, --ease-spring */
}

[data-theme="dark"] {
  /* Bg dark + overrides de TODOS los *-50, *-100, *-200 a versiones tinteadas oscuras */
  /* Ejemplo: --green-50 → color-mix(in oklab, var(--green-500) 10%, #131316) */
  /* Texto sobre tintes: --green-700 → color-mix con white para legibilidad */
}
```

> **Gotcha real**: en V1 los `*-50/100/200` no tenían dark mode overrides, así que badges y heat-cards quedaban con fondo blanco en dark. El fix fue agregar overrides con `color-mix(in oklab, X 10-30%, #131316)`. **Y `--orange-200` estaba indefinido** (la paleta original tenía 50/100/500/600/700 pero no 200). Agregar `--orange-200: #fed7aa`.

### Tipografía
- Display/Headings: Source Serif 4 (variable, font-weight 500, letter-spacing -0.022em a -0.024em)
- Body: Inter (variable)
- Mono: JetBrains Mono (variable)
- Anti-flicker init script en `<head>` para dark mode antes del paint

### Componentes CSS estándar
- `.ui-card`, `.ui-card__head`, `.ui-card__body`, `.ui-card__title`, `.ui-card__desc`
- `.ui-btn` con variantes `--accent`, `--lime`, `--ghost`, `--outline`, `--success`, `--danger-outline`, sizes `--sm`, `--lg`, `--icon`
- `.ui-badge` con `--blue/green/amber/red/orange/lime/violet/slate`
- `.ui-input`, `.ui-textarea`, `.ui-select`, `.ui-label`
- `.kpi` con `.kpi__icon`, `.kpi__label`, `.kpi__value`, `.kpi__delta`
- `.avatar` con `.avatar--sm/md/lg` y `.av-blue/violet/pink/green/amber/orange/teal/rose/slate/lime`
- `.heat-card` con variantes tonales
- `.list-row` (flex moderna), `.up-row` (grid 88px 1fr auto para fechas)
- `.ai-card`, `.ai-chip` (estilo IA con accent)
- `.popover` (con shadow popover)
- `.vobo` (card de aprobación)
- `.spinner` (loader rotando)

### Animaciones
- `.anim-fade-in`, `.anim-fade-in-up`, `.anim-stagger`, `.anim-scale-in`
- `keyframes`: spin, fade-in, fade-in-up, fade-in-down, scale-in, shimmer, pulse-soft, pulse-ring, shine, float-soft, drawer-in, backdrop-in, cmdk-in

### Density mode
- `[data-density="compact|cozy|comfortable"]` modula `--density-pad-card`, `--density-gap`, etc.

### Mobile
- Sidebar → drawer overlay <960px
- Header colapsa, búsqueda → icono
- KPI grids reflow a 1-2 columnas

---

## 17. Flujos críticos end-to-end

### 17.1 Login + redirect según rol

1. Usuario abre `/`
2. Middleware ve no auth → redirect `/login`
3. Login con Google → OAuth flow → `/api/auth/callback` → exchangeCodeForSession
4. Callback lee `users.role` → redirect a `/lider | /colaborador | /arquitectura-humana`

### 17.2 Agendar una 1:1 (líder con Google session)

1. Líder en `/colaborador/1to1/nueva` → elige colab, fecha, hora, modalidad → submit
2. Action `scheduleOneOnOne`:
   - Defensa rol (`leader|hr`)
   - INSERT en `one_on_ones`
   - Lee `session.provider_token` (Google access token)
   - Si existe: llama `createCalendarEvent` con summary `"1:1 [Líder] ↔ [Colab]"`, atendees ambos, conferenceData si virtual
   - UPDATE `meet_link` + `google_calendar_event_id`
3. Redirect a `/lider/1to1/[id]`
4. La 1:1 aparece en Google Calendar del líder con Meet link generado automático

### 17.3 Realizar 1:1 y aprobar acuerdos

1. Día de la 1:1 — ambos abren `/{rol}/1to1/[id]`
2. Cualquiera escribe en la **minuta compartida** (textarea)
3. Realtime: lo que tipea uno aparece para el otro al guardar (con resolución de conflictos si hay ediciones paralelas)
4. Al hacer clic en "Guardar minuta":
   - UPSERT minuta
   - Server llama IA → extrae 3-5 acuerdos
   - Borra acuerdos AI-generados pendientes previos (idempotencia)
   - Inserta nuevos con responsibles mapeados
5. Aparece tarjeta `<AgreementList>` con los acuerdos. Cualquiera puede:
   - Eliminar (🗑 con confirmación que avisa que invalidará VoBos)
   - Agregar manualmente
6. **VoBo aparece**: "¿Apruebas los acuerdos?" con `0/2`
7. Uno aprueba → trigger no actualiza status aún (solo 1/2). UI muestra "Esperando a [otro]"
8. El otro aprueba → trigger `update_meeting_on_vobo` ve 2/2 confirmed=true → status='realizada'
9. UI muestra "Ambos aprobaron — marcada como realizada"

### 17.4 Modificación post-aprobación → invalidación

1. 1:1 ya está en `realizada` (2/2 aprobados)
2. Alguien decide que un acuerdo está mal → clic 🗑 Eliminar → confirma
3. DELETE en `agreements`
4. Trigger `trg_invalidate_vobos`:
   - DELETE todos los `vobos` de esa 1:1
   - UPDATE one_on_ones SET status='agendada' (revierte cierre)
   - INSERT en audit_logs con `reason='agreement_deleted'`
5. Realtime: ambos ven la lista actualizada sin ese acuerdo y el VoBo reseteado a 0/2
6. Ciclo: ambos deben re-aprobar

### 17.5 Disputa → resolución HR

1. Líder vota "Sí apruebo", colab vota "No estoy de acuerdo"
2. Trigger detecta 1/1 mixto → status='en_disputa'
3. Disputa aparece en `/arquitectura-humana/disputas`
4. HR clic "Sí se realizó" en el resolver
5. Action `resolveDispute` verifica role='hr', UPDATE status='realizada', audit log
6. Notificación a ambos (opcional)

### 17.6 Cambio de líder por HR

1. HR abre `/arquitectura-humana/usuarios/[id]` del colab
2. En el panel admin elige nuevo líder en select
3. Submit → action `assignLeader`:
   - UPDATE leadership_relations SET ended_at=now() WHERE collaborator_id=X AND ended_at IS NULL
   - INSERT new row {leader_id=newLeaderId, collaborator_id=X}
   - Audit log
4. El antiguo líder ya no ve a este colab en su equipo. El nuevo sí.

---

## 18. Decisiones de diseño no-obvias (¿por qué así?)

| Decisión | Razón |
|---|---|
| **Una sola minuta por 1:1 (compartida)** | V1 tuvo minutas privadas por autor: líder veía "Sin minuta" aunque colab escribió. UX inentendible. RH sigue sin acceso, eso preserva privacidad real. |
| **VoBo = "apruebas acuerdos" no "se realizó"** | Aprobar implica que se realizó. Reduce 2 votos a 1. Forza revisión consciente de los acuerdos antes de cerrar. |
| **Invalidación automática al cambiar acuerdos** | Sin esto, líder podría modificar compromisos post-firma silenciosamente. Trigger + audit hacen ético el flujo. Solo cambios estructurales (texto/responsable/fecha) — los cambios de status son seguimiento posterior y NO invalidan. |
| **Auto-extracción IA al guardar minuta (no botón aparte)** | El botón "Extraer con IA" era olvidable. Auto-extracción significa que escribir notas SIEMPRE produce acuerdos para revisar. Idempotencia: re-guardar mismo texto reemplaza acuerdos AI-generated pendientes, no clobbea status de seguimiento. |
| **Lazy init del cliente Anthropic** | `process.env` en Next.js prod NO está siempre listo al import time. Init eager → cliente muerto para siempre. Lazy init lo soluciona. |
| **Status pill solo en `/colaborador/acuerdos`, no en detalle 1:1** | El status de un acuerdo es seguimiento en el tiempo. Mostrarlo en el momento de la 1:1 (todos nacen pendientes) es ruido visual. Separar contextos: 1:1 = decidir compromisos, /acuerdos = seguir compromisos. |
| **Colaboradores no pueden agendar** | UX/política: el líder es el responsable del ritmo. Eliminada del sidebar, comand palette, shortcut, dashboard, y bloqueada en server action (defense in depth). |
| **`/lider/insights` removida** | La feature de "sugerencias pre-1:1" estaba codificada pero sin trigger automático ni botón de "generar". Mostrar una vista vacía es peor que no tenerla. Si se reactiva, requiere cron diario o on-demand button. |
| **Realtime via `router.refresh()` (no manual setState)** | Más simple, evita race conditions con optimistic UI, deja al server ser source of truth. Editor y AgreementList tienen useEffect que sincronizan props con state respetando `temp-` IDs optimistic. |
| **Filtros vía querystring (`?filter=X`)** | URLs shareables, back/forward funcionan, sin necesidad de state global. |

---

## 19. Gotchas conocidos y cómo evitarlos

1. **`process.env.ANTHROPIC_API_KEY` undefined al cargar módulo** → siempre lazy init del SDK.
2. **`provider_token` no existe sin Google login** → si user es admin/password, Calendar API silenciosamente no se ejecuta. Documentar.
3. **Provider token expira en 1h** → no hay refresh; demos requieren re-login. (Mejora futura: usar `provider_refresh_token` guardado en `users.google_calendar_token`.)
4. **Filtro `>= new Date()` en queries** → 1:1s del mismo día con hora ya pasada quedan invisibles. Usar `>= startOfToday()` para "próximas + hoy".
5. **Dark mode vars** → `*-50/100/200` necesitan overrides en `[data-theme="dark"]`. Sin esto, todo lo que use tints (badges, heat-cards, vobo bg) queda blanco.
6. **Tabla `agreements` no tiene `created_by`** → solo `created_at`. Si necesitas saber quién lo creó, agrega columna en migración.
7. **`agenda_items` y `minutes` están en supabase_realtime publication** → asegurar en migration 04.
8. **`useState` no reacciona a prop changes** → en client components que reciben datos server-fetched, agregar `useEffect` que sincronice state con props cuando cambien por `router.refresh()`.
9. **`no_self_lead` check en BD** → no permite leader_id = collaborator_id. Imposible "ser tu propio jefe". Si necesitas ese flujo para demo, crear 3 cuentas distintas.
10. **Trigger handle_new_user puede no haber corrido aún** → tras `auth.admin.createUser`, hacer una espera o verificar antes de UPDATE en public.users.
11. **`status-select` clase vs nueva `list-row`** → la primera espera grid 88px+1fr+auto (con date card). Para listas sin date card, usar `list-row` flex.
12. **Eslint no se queja de unused imports** → mantener importas limpios manualmente al refactorizar.

---

## 20. Scripts utilitarios (`/scripts`)

- `setup.ts` — primer arranque: chequea env vars, valida conexión Supabase
- `seed.ts` — siembra demo data (6 departamentos, 10 usuarios demo, 50+ 1:1s con vobos/agreements/minutas)
- `create-admin.ts` — crea/promueve usuario a rol HR (usa `ADMIN_EMAIL`, `ADMIN_PASSWORD`)
- `verify.ts` — checks: Supabase conectado, 14 tablas existen, admin existe con rol hr, Anthropic responde, Google OAuth configurado (warn si no), Slack/Resend opcionales

Comandos `package.json`:
```json
"setup": "tsx scripts/setup.ts"
"db:push": "supabase db push"
"db:reset": "supabase db reset --linked"
"db:types": "supabase gen types typescript --linked > src/types/database.types.ts"
"db:seed": "tsx scripts/seed.ts"
"db:create-admin": "tsx scripts/create-admin.ts"
"verify": "tsx scripts/verify.ts"
```

---

## 21. Cómo verificar al terminar

1. `pnpm build` → debe pasar sin warnings ni errores TS
2. `pnpm lint` → 0 warnings
3. `pnpm verify` → todos los checks obligatorios en verde
4. Login con Google → redirige a dashboard del rol correcto
5. Crear 1:1 desde líder → aparece evento en Google Calendar (si scope Calendar otorgado)
6. Escribir minuta en 1:1 pasada → al guardar, aparecen 2-5 acuerdos en <10s
7. Aprobar ambos VoBos → status pasa a realizada automáticamente
8. Eliminar un acuerdo → VoBos se invalidan, status vuelve a agendada (verificable en audit_logs)
9. HR navega a `/arquitectura-humana/usuarios/[id]` → puede cambiar rol/líder
10. Cards de mapa-calor son clickeables → llevan a usuarios filtrados por área

---

## 22. Estructura de archivos sugerida

```
src/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   └── login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── colaborador/
│   │   │   ├── page.tsx
│   │   │   ├── acuerdos/page.tsx
│   │   │   ├── historial/page.tsx
│   │   │   ├── configuracion/page.tsx
│   │   │   └── 1to1/
│   │   │       ├── nueva/page.tsx
│   │   │       └── [id]/page.tsx
│   │   ├── lider/
│   │   │   ├── page.tsx
│   │   │   ├── equipo/page.tsx
│   │   │   ├── colaborador/[id]/page.tsx
│   │   │   ├── configuracion/page.tsx
│   │   │   └── 1to1/[id]/page.tsx
│   │   └── arquitectura-humana/
│   │       ├── page.tsx
│   │       ├── mapa-calor/page.tsx
│   │       ├── reportes/page.tsx
│   │       ├── disputas/page.tsx
│   │       ├── cadencias/page.tsx
│   │       ├── estructura/page.tsx
│   │       ├── usuarios/page.tsx
│   │       ├── usuarios/[id]/page.tsx
│   │       └── configuracion/page.tsx
│   ├── api/
│   │   ├── auth/callback/route.ts
│   │   ├── ai/extract-agreements/route.ts
│   │   ├── ai/analyze-patterns/route.ts
│   │   └── cron/
│   │       ├── check-cadence/route.ts
│   │       └── notify-due-agreements/route.ts
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── layout/
│   │   ├── app-shell.tsx
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   └── command-palette.tsx
│   ├── one-on-one/
│   │   ├── meeting-form.tsx
│   │   ├── agenda-list.tsx
│   │   ├── minute-editor.tsx
│   │   ├── agreement-list.tsx
│   │   ├── agreement-status-pill.tsx
│   │   ├── vobo-button.tsx
│   │   ├── detail-interaction.tsx
│   │   └── followup-modal.tsx
│   ├── arquitectura-humana/
│   │   ├── dispute-resolver.tsx
│   │   ├── report-review-button.tsx
│   │   └── user-admin-controls.tsx
│   ├── settings/settings-shell.tsx
│   └── shared/
│       ├── empty-state.tsx
│       ├── page-skeleton.tsx
│       ├── sparkline.tsx
│       ├── loading-spinner.tsx
│       └── confirm-dialog.tsx
├── hooks/
│   ├── use-realtime-meeting.ts
│   ├── use-realtime-notifications.ts
│   ├── use-keyboard-shortcuts.ts
│   └── use-toast.ts
├── lib/
│   ├── supabase/{client.ts, server.ts, admin.ts}
│   ├── actions/{one-on-ones.ts, minutes.ts, agreements.ts, vobos.ts, disputes.ts, reports.ts, users.ts}
│   ├── ai/{client.ts, prompts.ts, extract-agreements.ts, analyze-patterns.ts, followup-plan.ts}
│   ├── google/calendar.ts
│   ├── slack/{client.ts, notify.ts}
│   ├── email/{client.ts, templates/*.tsx}
│   ├── utils/{cn.ts, dates.ts, audit.ts}
│   └── constants.ts
├── types/{domain.ts, database.types.ts}
└── middleware.ts
supabase/
├── config.toml
└── migrations/
    ├── 00000000000001_initial_schema.sql
    ├── 00000000000002_rls_policies.sql
    ├── 00000000000003_shared_minutes.sql
    ├── 00000000000004_realtime_publication.sql
    ├── 00000000000005_perf_and_cleanup.sql
    └── 00000000000006_vobo_invalidation.sql
scripts/{setup.ts, seed.ts, create-admin.ts, verify.ts}
```

---

## 23. Checklist de entrega

Al terminar la implementación 1-shot, validar:

- [ ] `pnpm install && pnpm build` pasa
- [ ] `pnpm lint` 0 warnings
- [ ] `pnpm verify` todo verde (excepto Slack/Resend si no se configuraron)
- [ ] 6 migrations aplicadas en remoto Supabase
- [ ] Trigger `handle_new_user` funciona (signup → row en public.users)
- [ ] Trigger `update_meeting_on_vobo` funciona (2/2 → realizada)
- [ ] Trigger `trg_invalidate_vobos` funciona (delete agreement → vobos borrados + status agendada)
- [ ] Login con Google funciona end-to-end (con scope Calendar)
- [ ] Crear 1:1 desde líder genera evento real en Calendar primary
- [ ] Guardar minuta extrae acuerdos en <10s
- [ ] Aprobar VoBo de ambos lados → status realizada automático
- [ ] HR puede resolver disputa
- [ ] HR puede cambiar rol/líder de usuario
- [ ] Dark mode no muestra fondos blancos
- [ ] Realtime: editar minuta de un lado refleja en el otro sin reload manual
- [ ] Cards en `/lider/equipo`, `/arquitectura-humana/usuarios`, `/arquitectura-humana/mapa-calor` son clickeables
- [ ] `audit_logs` registra: role_changed, leader_assigned, dispute_resolved, vobos_invalidated, agreement_deleted

---

## 24. Output esperado del agente

Al terminar:
1. Resumen estructurado de qué se construyó (no esperar que el usuario lea todos los archivos)
2. Comandos exactos para arrancar (`pnpm install`, `supabase db push --yes`, `pnpm db:create-admin`, `pnpm dev`)
3. Credenciales del admin para primer login
4. Lista de pendientes conocidos (Slack/Resend si no se cablearon, refresh token de Google, etc.)
5. Honestidad sobre qué NO se implementó si quedó algo fuera del tiempo

---

---

## 25. Cuentas de prueba (credenciales reales del entorno de test)

> ⚠️ Todas estas credenciales corresponden al proyecto Supabase `mlmpjeneeckfdyqavwgj` que es de TEST. Si vas a montar tu propio entorno, crea cuentas nuevas.

### 25.1 Cuentas principales

| Rol | Email | Password | Notas |
|---|---|---|---|
| **HR (Administrador)** | `admin@b-drive.com` | `admin` | Creado por `scripts/create-admin.ts`. Acceso global. |
| **Líder real (Google SSO)** | `acalderonm@b-drive.com.mx` | (sin password — solo Google OAuth) | Cuenta del dueño del proyecto. Tiene a `ariel@demo.com` como colab. Úsala para demos de Google Calendar (porque tiene `provider_token` válido). |
| **Colab demo** | `ariel@demo.com` | `demo` | Reporta a `acalderonm@b-drive.com.mx`. Usado para demostrar el flujo colab end-to-end. |

### 25.2 Cuentas del seed (todas con password `Demo1234!`)

**Líderes**:
| Email | Nombre | Departamento |
|---|---|---|
| `lider.tech@demo.com` | Carolina Méndez | Tecnología |
| `lider.producto@demo.com` | Roberto Silva | Producto |
| `lider.diseno@demo.com` | Ana Patricia Ruiz | Diseño |

**Colaboradores** (cada uno con su líder asignado):
| Email | Nombre | Departamento | Líder |
|---|---|---|---|
| `dev1@demo.com` | Luis Hernández | Tecnología | Carolina |
| `dev2@demo.com` | María González | Tecnología | Carolina |
| `dev3@demo.com` | Pedro Ramírez | Tecnología | Carolina |
| `pm1@demo.com` | Sofía Vargas | Producto | Roberto |
| `pm2@demo.com` | Diego Morales | Producto | Roberto |
| `designer1@demo.com` | Valentina López | Diseño | Ana Patricia |
| `designer2@demo.com` | Jorge Castillo | Diseño | Ana Patricia |

Total seed: 10 usuarios + admin + acalderonm + ariel = **13 usuarios**.

### 25.3 Google OAuth (Cloud Console)

Las APIs habilitadas en este proyecto Google son:
- Google Calendar API
- Google People API

OAuth consent screen en modo **Externo / Testing**. Los usuarios `acalderonm@b-drive.com.mx` y cualquier otro tester deben estar agregados como **Test Users** en `console.cloud.google.com → APIs & Services → OAuth consent screen`.

**Authorized redirect URI registrada en Google Cloud**:
```
https://mlmpjeneeckfdyqavwgj.supabase.co/auth/v1/callback
```

### 25.4 Comandos para arrancar desde cero

```bash
# 1. Clonar y entrar
git clone <repo>
cd 1_to_1

# 2. Crear .env.local con los valores de la sección 8

# 3. Instalar
pnpm install

# 4. Aplicar migraciones (las 6 ya están en supabase/migrations/)
supabase link --project-ref mlmpjeneeckfdyqavwgj
supabase db push --yes

# 5. Crear admin
pnpm db:create-admin

# 6. (Opcional) Sembrar 10 usuarios demo + 50 1:1s + vobos + agreements
pnpm db:seed

# 7. Verificar todo
pnpm verify
# Output esperado:
# ✅ Conexión a Supabase
# ✅ Tablas creadas (14)
# ✅ Usuario admin existe
# ✅ API Anthropic responde
# ✅ Google OAuth configurado
# ⚠️  Slack configurado (opcional)
# ⚠️  Resend configurado (opcional)

# 8. Levantar dev
pnpm dev

# 9. Probar:
#    - http://localhost:3000/login con admin@b-drive.com / admin → HR dashboard
#    - http://localhost:3000/login con ariel@demo.com / demo → Colab dashboard
#    - http://localhost:3000/login con lider.tech@demo.com / Demo1234! → Líder dashboard
#    - http://localhost:3000/login con Google (cuenta acalderonm@b-drive.com.mx) → Líder con Calendar habilitado
```

### 25.5 Notas de seguridad (para producción real)

Cuando este sistema salga de demo a producción real:

1. **Rotar TODAS las credenciales** publicadas en este documento (Anthropic key, Google OAuth client secret, Supabase service role).
2. **Cambiar `ADMIN_PASSWORD`** a algo robusto y rotarlo.
3. **OAuth consent screen** debe pasar de "Testing" a "In production" + verificación de Google.
4. **Supabase project** debe estar en plan Pro mínimo (Realtime tiene límites estrictos en free).
5. **Configurar SMTP propio** para emails de signup/recovery (default de Supabase no es para prod).
6. **CRON_SECRET** debe ser un string aleatorio largo (≥32 chars) — los endpoints `/api/cron/*` se autentican contra él.
7. **Habilitar 2FA** en Supabase, GitHub, Google Cloud, Anthropic.
8. **Revisar RLS** en cada tabla manualmente — verificar que ningún role pueda leer/escribir más de lo permitido.
9. **Logs sanitizados**: el catch de `extractAgreements` ya loggea solo los primeros 120 chars del mensaje de error para no filtrar datos sensibles. Verificar lo mismo en cualquier otro try/catch.

---

**Fin de la especificación.** Esta es una reconstrucción honesta de un sistema en producción con sus decisiones, errores cometidos y correcciones. Implementarlo bien toma ~4-8 horas de Claude Code en un solo flujo si tiene acceso a Supabase y Google Cloud Console preconfigurados.

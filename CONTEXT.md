# Contexto del sistema 1to1

> Documento de referencia para entender el sistema completo y para guiar una **reescritura del frontend** preservando backend, schema, AI e integraciones.

---

## 1. Resumen ejecutivo

Plataforma interna para una organización de ~400 personas. Profesionaliza la práctica de 1:1s entre líderes y colaboradores con **visibilidad controlada para Arquitectura Humana** sobre cumplimiento, acuerdos y disputas. Diferenciador: **VoBo independiente** (ambas partes confirman si la reunión se realizó) + **IA** que estructura acuerdos y detecta patrones.

---

## 2. Roles y permisos

| Rol | Qué hace | Qué ve |
|---|---|---|
| `collaborator` | Agenda 1:1s con su líder, captura acuerdos, da VoBo, reporta cumplimiento | Sus 1:1s, sus acuerdos, su histórico |
| `leader` | Todo lo del colaborador + dashboard de equipo + insights IA | Todo lo suyo + 1:1s y acuerdos de su equipo directo |
| `hr` (Arquitectura Humana) | Configura cadencias, gestiona usuarios y estructura, resuelve disputas | Acuerdos estructurados, métricas, mapas de calor, reportes IA. **NO ve minutas crudas ni agendas previas.** |

**Regla de privacidad clave:** RH ve metadata + acuerdos formales, NO el contenido íntimo de las conversaciones (minuta cruda, agenda pre-reunión).

---

## 3. Stack

- **Frontend/SSR**: Next.js 14 App Router + TypeScript + React 18
- **UI**: Tailwind + shadcn/ui (Radix) + tokens CSS propios ("Editorial Slate + Serif")
- **DB / Auth**: Supabase (Postgres + RLS + Auth)
- **AI**: Anthropic Claude (`@anthropic-ai/sdk`)
- **Calendario**: Google Calendar/Meet (OAuth 2.0)
- **Notifs**: Slack Web API + Resend (email) + in-app
- **Forms/Validación**: react-hook-form + zod
- **Hosting**: Vercel

---

## 4. Modelo de datos (Postgres)

### Enums

```
user_role               = collaborator | leader | hr
meeting_modality        = virtual | presencial
meeting_status          = agendada | realizada | no_realizada | en_disputa
non_realization_reason  = reagendada | cancelada_cargas | ausencia | sin_justificacion
agreement_status        = pendiente | cumplido | parcial | no_cumplido
notification_channel    = in_app | email | slack
ai_report_severity      = info | warning | critical
cadence_scope           = global | department | relation
```

### Tablas (campos clave)

- **departments** `(id, name, parent_id?)` — jerarquía de áreas
- **users** `(id=auth.users.id, email, full_name, avatar_url, google_id, department_id, role, slack_user_id, is_active, google_calendar_token jsonb)`
- **leadership_relations** `(id, leader_id, collaborator_id, started_at, ended_at?)` — un colaborador tiene **un líder activo a la vez** (índice único parcial donde `ended_at is null`)
- **cadence_configs** `(id, scope_type, scope_id?, frequency_days, created_by)` — cadencia global, por área o por relación
- **one_on_ones** `(id, leader_id, collaborator_id, scheduled_at, duration_minutes=30, modality, location?, meet_link?, google_calendar_event_id?, status='agendada', non_realization_reason?, created_by)`
- **agenda_items** `(id, one_on_one_id, author_id, content)` — **privado a participantes**
- **minutes** `(id, one_on_one_id, author_id, raw_content, processed_at?)` — **privado a participantes** · UNIQUE `(one_on_one_id, author_id)` (cada uno escribe la suya)
- **agreements** `(id, one_on_one_id, description, responsible_id, due_date?, status='pendiente', ai_generated, ai_confidence)` — **visible para RH**
- **agreement_followups** `(id, agreement_id, reported_by_id, reported_status, justification?, reported_in_one_on_one_id?)` — historial de seguimiento
- **vobos** `(id, one_on_one_id, user_id, confirmed bool, confirmed_at)` — UNIQUE `(one_on_one_id, user_id)`
- **ai_insights** `(id, leader_id, collaborator_id, one_on_one_id?, type, content jsonb, used)` — sugerencias IA, **solo el líder las ve**
- **ai_reports** `(id, scope_type, scope_id, title, content, severity, reviewed, reviewed_by?, reviewed_at?)` — patrones detectados, **solo RH**
- **notifications** `(id, user_id, channel, title, content, link?, read, sent)`
- **audit_logs** `(id, user_id?, action, resource_type, resource_id?, metadata jsonb)` — **solo RH lee**

### Triggers automáticos

1. **`handle_new_user`**: al insertar en `auth.users`, crea fila en `public.users` con rol `collaborator` por defecto
2. **`update_meeting_status_on_vobo`**: cuando hay 2 VoBos:
   - Ambos `confirmed=true` → status `realizada`
   - Ambos `confirmed=false` → `no_realizada`
   - 1+1 contradictorio → `en_disputa`
3. **`update_updated_at_column`**: timestamps automáticos

### Vista útil

- **`compliance_metrics`**: agrega por departamento total/realizadas/no realizadas/en disputa + acuerdos cumplidos/incumplidos + `compliance_rate` (%)

### Helpers RLS

```sql
is_hr()                          -- ¿soy HR?
is_participant(one_on_one_id)    -- ¿soy líder o colab de esa 1:1?
is_leader_of(collaborator_id)    -- ¿soy líder activo de esa persona?
```

### Resumen de RLS por tabla

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| departments | autenticados | HR | HR | HR |
| users | autenticados | (trigger) | self / HR | HR |
| leadership_relations | involucrados / HR | HR | HR | HR |
| one_on_ones | participantes / HR | participantes | participantes / HR | HR |
| **agenda_items** | **solo participantes** | participantes | autor | autor |
| **minutes** | **solo participantes** | participantes | autor | — |
| agreements | participantes / HR | participantes | participantes / HR | participantes |
| agreement_followups | involucrados / HR | involucrados | — | — |
| vobos | participantes / HR | self+participante | self | — |
| ai_insights | solo líder | (server) | líder | — |
| ai_reports | solo HR | (server) | HR | — |
| notifications | self | (server) | self | — |
| audit_logs | solo HR | (server) | — | — |

---

## 5. Flujo canónico de una 1:1

```
[1] AGENDADO
    Colab o líder → form → INSERT one_on_ones (status=agendada)
                  → Google Calendar API crea evento (Meet auto si virtual)
                  → notifications + email a la otra parte

[2] PRE-REUNIÓN
    Cualquiera de los 2 → INSERT agenda_items (texto libre)
    AI prepara insights para el líder (basado en historial)

[3] DURANTE
    Sin intervención del sistema (la app no graba)

[4] POST-REUNIÓN — Captura
    Cada uno → INSERT/UPDATE minutes (raw_content propio)
    Botón "Procesar con IA" → extractAgreementsPrompt → INSERT agreements

[5] POST-REUNIÓN — VoBo independiente
    Cada uno → INSERT vobos (confirmed: true/false)
    Trigger update_meeting_status_on_vobo → status final automático

[6] ENTRE 1:1s — Cadencia + acuerdos
    Cron job: si pasó frequency_days sin nueva 1:1 agendada → Slack alert
    Acuerdos cerca de due_date → email recordatorio
    AI puede generar ai_reports si detecta patrones

[7] SIGUIENTE 1:1 — Seguimiento
    Antes del VoBo de la nueva, sistema pregunta por acuerdos previos
    INSERT agreement_followups (cumplido/parcial/no_cumplido + justificación)
    UPDATE agreements.status
```

---

## 6. AI: 4 prompts (todos en `src/lib/ai/prompts.ts`)

Todos retornan **JSON estricto** sin markdown.

1. **`extractAgreementsPrompt(rawMinute, {leader, collaborator})`**
   → `{ agreements: [{description, responsible_email, due_date|null, confidence}] }`
   - Reglas: solo compromisos verificables, no inventar, responsible debe ser uno de los dos.

2. **`suggestQuestionsPrompt({collaboratorName, recentMeetings, pendingAgreements})`**
   → `{ questions: [{question, rationale, category}] }` (5 preguntas)
   - Categorías: `desempeño | desarrollo | bienestar | seguimiento | feedback`
   - Solo abiertas, contextuales, en español.

3. **`generateFollowupPlanPrompt({collaboratorName, meetingDate, agreements})`**
   → `{ summary, actions: [{action, timeline, importance}] }` (max 5)
   - El plan es **para el líder**, no el colaborador.

4. **`analyzePatternsPrompt({relationshipMonths, totalMeetings, missedMeetings, disputedMeetings, agreements, recentHistory})`**
   → `{ pattern_detected, severity, title, description, recommendations: [] }` (max 3 recs)
   - Solo si hay patrón real preocupante. Si no, `severity: 'info'`, `pattern_detected: false`.

---

## 7. Integraciones (server-only)

| Integración | Para qué | Variables |
|---|---|---|
| **Google OAuth** | SSO + token para Calendar | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` |
| **Google Calendar/Meet** | crear/editar/borrar eventos, link Meet auto | usa el token guardado en `users.google_calendar_token` |
| **Anthropic Claude** | los 4 prompts | `ANTHROPIC_API_KEY` |
| **Slack** | alertas de incumplimiento por DM o canal | `SLACK_BOT_TOKEN`, `SLACK_DEFAULT_CHANNEL` (opcional) |
| **Resend** | emails transaccionales | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (opcional) |
| **Cron** | sweep de cadencia incumplida | `CRON_SECRET` (Vercel Cron) |

---

## 8. Estructura de rutas (App Router)

```
src/app/
├── (auth)/login                         — split layout serif + form
├── (dashboard)/                         — layout con sidebar role-aware + header
│   ├── colaborador/
│   │   ├── page.tsx                    — inicio con KPIs, pendientes VoBo, próximas, acuerdos pendientes
│   │   ├── 1to1/nueva                  — form agendar
│   │   ├── 1to1/[id]                   — detalle: agenda, minuta, VoBo, acuerdos
│   │   ├── acuerdos                    — historial filtrable
│   │   └── configuracion
│   ├── lider/
│   │   ├── page.tsx                    — KPIs equipo + cumplimiento + cards por colaborador
│   │   ├── equipo                      — lista de colaboradores con su estado
│   │   ├── insights                    — sugerencias IA
│   │   ├── 1to1/[id]                   — vista líder de la 1:1
│   │   └── configuracion
│   └── arquitectura-humana/
│       ├── page.tsx                    — panel global: KPIs + cumplimiento por área
│       ├── mapa-calor                  — heatcards por área
│       ├── reportes                    — patrones IA con severidad y categoría
│       ├── disputas                    — 1:1s contradictorias con CTA Resolver
│       ├── cadencias                   — config global/área/relación
│       ├── estructura                  — árbol jerárquico líder→reportes
│       ├── usuarios                    — directorio + roles
│       └── configuracion
└── api/
    ├── auth/{login,callback,signout}
    ├── google/{calendar/sync,...}
    ├── ai/{extract,suggest,...}
    └── cron/{cadence-check,reminders}
```

---

## 9. Server Actions (`src/lib/actions/`)

- `one-on-ones.ts`: crear/reagendar/cancelar 1:1, sync Calendar
- `minutes.ts`: guardar minuta + disparar `extractAgreements`
- `agreements.ts`: CRUD acuerdos + followups
- `vobos.ts`: `submitVobo({oneOnOneId, confirmed})` — el trigger SQL hace el resto

---

## 10. Design System (mantener si rehaces frontend)

Tokens en `src/app/globals.css`:

- **Tipografía**: Inter (UI) + Source Serif 4 (títulos) + JetBrains Mono
- **Paleta**: slate base, accent azul (`#2563eb`), semánticos verde/amber/red/orange/violet
- **Componentes**: `.ui-card`, `.kpi`, `.heat-card`, `.ui-badge`, `.ui-btn--{primary|accent|outline|ghost|success|danger-outline}`, `.agreement`, `.agenda-item`, `.vobo`, `.privacy-banner`, `.ai-card`, `.ai-chip`
- **Variantes**: `kpi--empty`, `heat-card--slate` para estados sin datos (no rojos)
- **Density modes**: `[data-density="compact|cozy"]` con vars
- **Dark mode**: `[data-theme="dark"]`
- **Animaciones**: `anim-fade-in`, `anim-fade-in-up`, `anim-stagger`, `anim-scale-in`

---

## 11. Lecciones aprendidas — decisiones validadas

Quien rehaga el sistema debe respetar:

1. **No usar eyebrows azules redundantes** sobre el título serif. El sidebar + título identifican la sección.
2. **Empty states ≠ 0%**. Cuando no hay datos, mostrar `—` y tono neutral (slate), nunca rojo alarmante.
3. **Sidebar role-aware por URL**, no por rol fijo. El rol determina ACCESO; la URL determina QUÉ NAV mostrar. Role-switcher arriba del sidebar para users con multi-acceso (HR ve los 3, líder ve 2, colab ve 1).
4. **Estructura organizacional como árbol**: el líder aparece UNA vez con sus reportes anidados. NO una fila por par.
5. **Disputas necesitan CTA visible "Resolver"** — los badges informativos no deben parecer botones.
6. **Reportes IA con badge de categoría** (Cumplimiento/Cadencia/Disputa/Acuerdos/Engagement) + border-left por severidad para escaneo rápido.
7. **Dashboard del colaborador necesita sección "Pendientes de confirmar"** (1:1s pasadas sin VoBo del usuario) — flujo crítico que estaba faltando.
8. **Otra parte ≠ siempre líder**. Cuando un líder ve sus 1:1s en `/colaborador`, el otro participante es el COLABORADOR, no el líder. Calcular dinámicamente.
9. **Formato de %**: helper `formatPct` siempre. Nada de `33.33%`.
10. **Login button** primary `accent` (azul vivo), no `slate-900`.

---

## 12. Lo que falta o está débil hoy

- Cadencias casi vacías visualmente, falta UI editable por área + calendario
- Insights del asistente sin onboarding ejemplos
- Sin filtros chip en "Mis acuerdos"
- HR home sin sparklines de tendencia
- 1:1 detalle (`/colaborador/1to1/[id]`, `/lider/1to1/[id]`) — flujo de minuta + VoBo + agreements ya existe pero no ha sido auditado
- Cron y notificaciones implementadas pero no testeadas E2E
- Google SSO/Calendar configurado pero requiere deploy/dominio para OAuth real
- Seed actual tiene reportes IA duplicados (3 idénticos) — variar al re-seedear

---

## 13. Variables de entorno

```env
# OBLIGATORIAS
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PROJECT_REF=
SUPABASE_DB_PASSWORD=
ADMIN_EMAIL=
ADMIN_PASSWORD=               # opcional; si vacío genera una
ADMIN_FULL_NAME=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=          # http://localhost:3000/api/auth/callback en dev
ANTHROPIC_API_KEY=
NEXT_PUBLIC_APP_URL=

# OPCIONALES
SLACK_BOT_TOKEN=
SLACK_DEFAULT_CHANNEL=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
CRON_SECRET=
SEED_DEMO_DATA=true
```

---

## 14. Scripts útiles

```bash
pnpm dev                  # Next dev server
pnpm db:push              # aplica migraciones a Supabase remoto
pnpm db:reset             # reset completo (destructivo)
pnpm db:types             # regenera src/types/database.types.ts
pnpm db:seed              # carga 9 usuarios demo + relaciones + 1:1s + acuerdos
pnpm db:create-admin      # crea admin con role=hr
pnpm verify               # smoke test
pnpm exec tsx scripts/ux-screenshots.ts   # capturas auto de todas las pantallas
```

---

## 15. Plan para reescribir SOLO el frontend

### A conservar tal cual

| Path | Por qué |
|---|---|
| `supabase/migrations/*.sql` | Schema + RLS probados |
| `src/lib/supabase/{client,server,middleware}.ts` | Auth helpers |
| `src/lib/actions/*.ts` | Server actions del dominio |
| `src/lib/ai/*.ts` | Prompts y client de Claude |
| `src/lib/google/*.ts` | OAuth y Calendar |
| `src/lib/slack/*.ts`, `src/lib/email/*.ts` | Notificaciones |
| `src/lib/validations/*.ts` | Schemas zod |
| `src/lib/constants.ts`, `src/lib/utils/*.ts` | Labels, helpers |
| `src/types/{database,domain}.ts` | Tipos generados + dominio |
| `src/middleware.ts` | Guard de rutas |
| `scripts/{setup,seed,create-admin,verify,reset-password,ux-screenshots}.ts` | Tooling |
| `.env.example`, `package.json`, `next.config.js`, `tsconfig.json` | Config base |

### A rehacer

| Path | Notas |
|---|---|
| `src/app/(auth)/login/page.tsx` | Mantener split + serif quote |
| `src/app/(dashboard)/layout.tsx` | Sidebar + header |
| `src/app/(dashboard)/**/page.tsx` | Todas las páginas (~17) |
| `src/components/{layout,one-on-one,hr,settings,shared}/*` | Recomponer |
| `src/components/ui/*` | shadcn — regenerar si quieres |
| `src/app/globals.css` | **Decisión**: si quieres mantener el DS, conserva los tokens (líneas 1-200); rehaz solo las clases de componentes |

### Estrategia recomendada

1. **NO empezar de cero el repo**. Crea una rama `frontend-v2`.
2. **Borra** `src/app/(dashboard)`, `src/components/{layout,one-on-one,hr,settings,shared}` y reescribe.
3. **Conserva** `src/components/ui` (shadcn) si te sirve.
4. **Conserva** los tokens CSS (variables `:root`) y rehaz solo las clases si quieres. O si prefieres Tailwind puro, reescribe usando los tokens como `theme.extend.colors`.
5. **Rebuild gradual**: empieza por `(auth)/login` → `(dashboard)/layout` → 1 sección a la vez.
6. **Verifica con screenshots** después de cada sección: `pnpm exec tsx scripts/ux-screenshots.ts`.
7. **No toques** server actions, AI ni schema hasta que el nuevo frontend funcione completo contra los mismos endpoints.

---

## 16. Capturas de referencia

Todas las pantallas actuales están capturadas en:
- `/tmp/ux-shots/` — estado original
- `/tmp/ux-shots-s1/` — después de Sprint 1 (eyebrows fuera, formatPct, empty states)
- `/tmp/ux-shots-s2/` — después de Sprint 2 (estructura árbol, sidebar role-aware, disputas con CTA)
- `/tmp/ux-shots-vobo/` — con sección "Pendientes de confirmar"

Para regenerar: `pnpm exec tsx scripts/ux-screenshots.ts`

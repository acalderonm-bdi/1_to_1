# 1to1

Sistema interno de B-Drive para gestionar reuniones 1:1 entre líderes y colaboradores, registrar acuerdos, monitorear cumplimiento y dar visibilidad a Arquitectura Humana (RH). Aproximadamente 400 usuarios, single-tenant.

Stack: Next.js 14 (App Router) + Supabase (Postgres + Auth + Realtime + RLS) sobre Vercel. La lógica de negocio vive en **server actions** (`src/lib/actions/`), no hay capa REST. Crons en Vercel disparan notificaciones a Slack/Email. IA (Anthropic Claude) se usa para extraer acuerdos del minuta y sugerir preguntas al líder.

Este README está pensado para un dev que entra al equipo y va a mantener el código. Para el spec funcional original ver el git history. Para el plan de hardening activo ver [`docs/HARDENING_PLAN.md`](docs/HARDENING_PLAN.md).

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 14.2 (App Router, Server Actions, RSC) |
| UI | Tailwind v3 + shadcn/ui (Radix primitives) |
| DB / Auth / Realtime | Supabase (Postgres + RLS + `@supabase/ssr` + supabase-js Realtime) |
| Notificaciones | Slack Web API (`@slack/web-api`), Resend (email) |
| IA | Anthropic SDK (`@anthropic-ai/sdk`, modelo Claude) |
| Observabilidad | Sentry (`@sentry/nextjs`) |
| Calendar | Google Calendar API (OAuth scope adicional al SSO) |
| Forms / Validación | react-hook-form + zod |
| Tests | Vitest (unit) + Playwright (E2E) |
| Hosting | Vercel (incluye crons via `vercel.json`) |

## Estructura del repo

| Path | Qué hay ahí |
|---|---|
| `src/app/(auth)/` | Login page (Supabase Auth con magic link / Google SSO) |
| `src/app/(dashboard)/colaborador/` | Vistas del colaborador: 1:1, acuerdos, historial, configuración |
| `src/app/(dashboard)/lider/` | Vistas del líder: agenda, equipo, colaborador detalle |
| `src/app/(dashboard)/arquitectura-humana/` | Vistas RH: cadencias, disputas, mapa de calor, reportes, notificaciones, parámetros, sincronización, usuarios |
| `src/app/api/auth/callback/` | OAuth callback (Google → Supabase Auth) |
| `src/app/api/cron/` | 4 endpoints disparados por Vercel cron, protegidos con `CRON_SECRET` |
| `src/app/api/ai/` | Endpoints de IA: extract-agreements, suggest-questions, analyze-patterns, agreement-quality |
| `src/app/api/exports/[type]/` | Exports CSV/PDF |
| `src/app/api/health/` | Health check público (DB + Slack + email config) |
| `src/lib/actions/` | **Toda la lógica de negocio.** Server actions (`'use server'`). Una file por dominio: `one-on-ones`, `agreements`, `vobos`, `disputes`, `warmth`, `cadence`, `minutes`, `users`, `departments`, `notification-rules`, `scheduled-reports`, `reports`, `org-settings`, `exports` |
| `src/lib/supabase/` | Clientes Supabase: `client.ts` (browser), `server.ts` (RSC/actions), `admin.ts` (service role, bypass RLS, solo crons y scripts) |
| `src/lib/slack/` | `client.ts` (singleton) + `notify.ts` (helpers tipados por trigger) |
| `src/lib/email/` | `client.ts` (Resend) + `notify.ts` + `templates/` |
| `src/lib/google/calendar.ts` | Crear/borrar eventos Calendar y obtener Meet link |
| `src/lib/ai/` | Prompts y clients Anthropic |
| `src/lib/exports/` | Generación de CSV/PDF |
| `src/components/ui/` | shadcn primitives |
| `src/components/{one-on-one,arquitectura-humana,layout,shared,settings}/` | Componentes de dominio |
| `src/hooks/` | `use-realtime-meeting`, `use-realtime-notifications`, `use-user`, `use-toast`, `use-keyboard-shortcuts` |
| `src/types/database.types.ts` | Generado por `pnpm db:types` — no editar a mano |
| `src/types/domain.ts` | Tipos de dominio (`ActionResult<T>`, `OneOnOne`, etc.) |
| `src/middleware.ts` | Auth gate + inyección de `x-pathname` |
| `supabase/migrations/` | SQL versionado (numerado `0000000000NNNN_*.sql`). Source of truth del schema |
| `scripts/` | Setup, seed, QA visual, helpers Slack, verify |
| `docs/` | Auditorías, runbooks y plan de hardening |
| `sentry.*.config.ts` | Configs Sentry (client/server/edge) |
| `instrumentation.ts` | Hook de instrumentación de Next |
| `vercel.json` | Definición de los 4 crons |

## Setup local

### Prerequisitos

- Node 20 LTS
- pnpm 9 (`corepack enable && corepack prepare pnpm@9 --activate`)
- Supabase CLI (`brew install supabase/tap/supabase` o ver [supabase.com/docs/guides/local-development/cli](https://supabase.com/docs/guides/local-development/cli))
- Google Chrome estable instalado (los scripts QA en `scripts/qa-*.ts` y `scripts/screenshot.ts` usan Chrome del sistema porque chromium-de-playwright no anda confiable en Ubuntu 26.04)
- Acceso al proyecto Supabase de B-Drive (pedirle a Ariel/lead técnico)

### Pasos

1. Clonar e instalar:

   ```bash
   git clone <repo-url> 1to1
   cd 1to1
   pnpm install
   ```

2. Copiar y rellenar env vars:

   ```bash
   cp .env.example .env.local
   ```

   Los secrets reales están en 1Password/Bitwarden del equipo. Variables obligatorias mínimas: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_ID/SECRET`, `ANTHROPIC_API_KEY`, `CRON_SECRET`. Slack/Resend/Sentry son opcionales (el sistema degrada silenciosamente si faltan — ver `/api/health`).

3. Linkear CLI al proyecto remoto y aplicar migrations:

   ```bash
   pnpm supabase link --project-ref $SUPABASE_PROJECT_REF
   pnpm supabase migration list --linked        # ver qué falta aplicar
   pnpm supabase db push --linked               # si trabajás contra remote dev
   pnpm db:types                                # regenerar src/types/database.types.ts
   ```

4. Levantar:

   ```bash
   pnpm dev
   ```

   App en http://localhost:3000.

5. Login con usuarios demo (seedeados por `pnpm db:seed`):

   - `lider.tech@demo.com` — líder con equipo (3 colaboradores)
   - `dev3@demo.com` — colaborador
   - `admin@b-drive.com.mx` — RH/Arquitectura Humana (creado por `pnpm db:create-admin` usando `ADMIN_EMAIL/ADMIN_PASSWORD` de `.env.local`)

   Password demo: `Demo1234!` (ver `scripts/seed.ts`).

## Comandos comunes

```bash
# Desarrollo
pnpm dev                       # Next.js dev server, hot reload
pnpm build                     # build de producción
pnpm start                     # corre el build (post-build)

# Calidad
pnpm tsc -b                    # typecheck en build mode (mismo que CI — usa este, no --noEmit)
pnpm lint                      # next lint (eslint-config-next)
pnpm test                      # vitest run (unit)
pnpm test:watch                # vitest watch
pnpm test:e2e                  # playwright test
pnpm test:e2e:ui               # playwright en modo UI

# DB
pnpm db:types                  # regenera src/types/database.types.ts desde el schema remoto
pnpm db:push                   # supabase db push (aplica migrations locales)
pnpm db:reset                  # supabase db reset --linked (DESTRUCTIVO)
pnpm db:seed                   # corre scripts/seed.ts (depts + users demo + cadencia + agreements de prueba)
pnpm db:create-admin           # crea/promueve a HR el usuario ADMIN_EMAIL

pnpm supabase migration list --linked     # ver qué migrations están aplicadas en remote
pnpm supabase db push --linked            # push de migrations al remote linkeado
pnpm supabase db pull                     # baja schema remoto a migration nueva

# Verificación y QA
pnpm verify                    # scripts/verify.ts: chequea env + DB + roles
pnpm screenshot                # captura set de screenshots con Chrome del sistema
```

CI corre `pnpm tsc -b` y `pnpm test`. Localmente conviene correr lo mismo antes de commit; `--noEmit` puede pasar y `-b` fallar por imports muertos / referencias rotas.

## Deploy

Hosting en Vercel, branch `main` → production. Cualquier push a `main` triggea deploy.

- **Env vars**: gestionadas en Vercel dashboard (Production scope). Para el procedimiento de rotación de cada secret, ver [`docs/runbook-rotation.md`](docs/runbook-rotation.md).
- **Crons**: definidos en `vercel.json` (4 jobs). Vercel los expone en su dashboard con su próxima ejecución.
- **Health check**: `https://<host>/api/health` retorna 200 si DB + Slack + email están OK. Servirlo a un uptime monitor externo.
- **Sentry**: source maps se suben en build cuando `SENTRY_AUTH_TOKEN/ORG/PROJECT` están seteadas en el environment de CI/Vercel.

Staging: existe (o debería existir post Fase 5.3) un proyecto Vercel + Supabase paralelo `1to1-staging.b-drive.com.mx`. Branch dedicada o preview deploys.

## Troubleshooting

**`vendor-chunks not found` o errores raros de webpack al hacer `pnpm dev`.** Cache de `.next` corrupto, típicamente porque corriste `pnpm build` mientras `pnpm dev` estaba activo (o viceversa). Fix:

```bash
rm -rf .next
pnpm dev
```

**`tsc errors` en código que tocaste después de una migration de Supabase** (ej. columna nueva, tipo cambiado). El generated `database.types.ts` está desactualizado:

```bash
pnpm db:types
pnpm tsc -b
```

Si después de regenerar siguen errores con `as never`, es el problema documentado en `docs/types-audit.md` — el tipo `Database` está mal inferido para algunos `Insert`/`Update`. Ver allí el workaround.

**Login no funciona / 500 al loguearse / `users` table no encontrada.** Probable que la DB esté en otro estado del schema que el código espera. Validá:

```bash
pnpm supabase migration list --linked
```

Si hay rows con `Local | Remote` desfaseado, hacé `pnpm supabase db push --linked` (si tu local va adelante) o reseteá tu local. Después regenerá types.

**Slack DM no llega aunque el código dice `success`.** El user destinatario probablemente no tiene `slack_user_id` cargado en `public.users`. Correr `pnpm tsx scripts/sync-slack-ids.ts` (matchea por email). El dispatcher hace `skipped: true` silencioso si falta.

**Google Calendar no crea el evento al agendar.** El líder tiene que haber loggeado con Google OAuth (no magic link) en la sesión actual. El `provider_token` solo lo da Google SSO y vive solo durante esa sesión. Si llegaron por magic link, no hay token y el agendado funciona pero sin Calendar (ver `scheduleOneOnOne` en `src/lib/actions/one-on-ones.ts`).

**Tests Playwright no abren browser en WSL/Ubuntu 26.04.** Usar Chrome del sistema, no chromium-bundled. Los scripts QA en `scripts/qa-*.ts` ya están configurados así; para Playwright tests propios, setear `channel: 'chrome'` en el config.

## Documentación adicional

| Documento | Propósito |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Diagrama de componentes + flujos críticos + decisiones arquitectónicas |
| [`docs/HARDENING_PLAN.md`](docs/HARDENING_PLAN.md) | Plan vigente para llegar a prod-ready (fases 0–7, olas) |
| [`docs/runbook-rotation.md`](docs/runbook-rotation.md) | Cuándo y cómo rotar cada secret sin downtime |
| [`docs/rls-audit.md`](docs/rls-audit.md) | Auditoría de policies RLS vs server actions |
| [`docs/notif-matrix.md`](docs/notif-matrix.md) | Matriz trigger × channel del dispatcher de notificaciones |
| [`docs/types-audit.md`](docs/types-audit.md) | Inventario de `as never` y plan de eliminación |
| [`docs/layout-state-audit.md`](docs/layout-state-audit.md) | Auditoría de `currentPath` server-side en componentes client |
| [`docs/OLA-1-SPEC.md`](docs/OLA-1-SPEC.md) | Spec de la ola actual de trabajo paralelo |

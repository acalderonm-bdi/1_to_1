# Arquitectura 1to1

Vista de alto nivel del sistema, los flujos críticos y las decisiones que tomamos. Es un complemento del `README.md` (setup, comandos, troubleshooting) — acá solo arquitectura.

## Componentes

```
┌────────────────────────────────────────────────────────────────┐
│                         BROWSER (Client)                       │
│  React Server Components + Client Components ('use client')    │
│  Tailwind v3 + shadcn/ui · realtime via supabase-js            │
└─────────────────────────┬──────────────────────────────────────┘
                          │ HTTPS
┌─────────────────────────▼──────────────────────────────────────┐
│                      VERCEL (Next.js 14)                       │
│  ┌─────────────────┐  ┌──────────────┐  ┌─────────────────┐    │
│  │ Server Actions  │  │ API Routes   │  │ Cron Jobs       │    │
│  │ ('use server')  │  │ /api/health  │  │ check-cadence   │    │
│  │ scheduleOneOnOne│  │ /api/ai/*    │  │ check-thresholds│    │
│  │ markNonRealiz   │  │ /api/exports │  │ notify-due-agr  │    │
│  │ submitVobo …    │  │ /api/auth    │  │ send-scheduled  │    │
│  └────────┬────────┘  └──────┬───────┘  └────────┬────────┘    │
└───────────┼──────────────────┼───────────────────┼─────────────┘
            │                  │                   │
            ▼                  ▼                   ▼
   ┌────────────────┐   ┌─────────────┐    ┌──────────────┐
   │ SUPABASE       │   │ Slack API   │    │ Resend API   │
   │ Postgres + RLS │   │ Web Client  │    │ (Email)      │
   │ Auth + JWT     │   │ chat.post   │    │              │
   │ Storage        │   │ users.lookup│    │              │
   │ Realtime       │   └─────────────┘    └──────────────┘
   └────────────────┘
                                ┌──────────────┐
                                │ Anthropic    │
                                │ Claude API   │
                                │ (AI extract) │
                                └──────────────┘

   ┌──────────────┐   ┌──────────────┐
   │ Sentry       │   │ Google Cal   │
   │ Errors+Perf  │   │ (OAuth)      │
   └──────────────┘   └──────────────┘
```

Notas sobre el diagrama:

- **No hay backend separado.** El "server" es Next.js corriendo en Vercel functions. Las server actions (`src/lib/actions/`) son la API de facto — se invocan directo desde RSC o desde client components con form actions.
- **Supabase es la única DB.** Postgres + RLS + Auth + Realtime + Storage, todo en un solo proyecto. El service role solo se usa desde crons y scripts (`src/lib/supabase/admin.ts`); el resto va por RLS con el JWT del user.
- **Slack y Resend son opcionales.** Si `SLACK_BOT_TOKEN` o `RESEND_API_KEY` faltan, las funciones de notificación retornan `{ sent: false, skipped: true }` y el flujo principal sigue. `/api/health` los reporta como `skipped` (no como falla).
- **Google Calendar se cablea al SSO.** El `provider_token` que devuelve Google OAuth se reusa para crear eventos. Magic link no da provider_token → sin Calendar.
- **Anthropic** se llama desde routes `/api/ai/*` (no desde server actions) para aislar timeouts y permitir streaming si hace falta.

## Flujos críticos

### Login y routing por rol

```
Browser ──GET /─▶ middleware.ts
                     │
                     │ supabase.auth.getUser()
                     ▼
              ┌──────────────┐    not authed     ┌──────────┐
              │ has session? │──────────────────▶│ /login   │
              └──────┬───────┘                   └──────────┘
                     │ yes
                     ▼
              path == /login?
                     │ yes
                     ▼
            SELECT role FROM users WHERE id = auth.uid()
                     │
       ┌─────────────┼────────────────┐
       ▼             ▼                ▼
  role=hr       role=leader     role=collaborator
       │             │                │
       ▼             ▼                ▼
  /arquitectura-   /lider         /colaborador
   humana
```

`src/middleware.ts` corre en cada request, protege `/colaborador`, `/lider`, `/arquitectura-humana`, e inyecta `x-pathname` en headers para que los RSC puedan leerlo (Next 14 no lo expone nativamente). El layout de cada rol además valida defensivamente que el `users.role` coincida con la ruta — defense in depth contra usuarios con cookies viejas / link compartido.

### Agendar 1:1

```
Líder UI                Server Action               Supabase            Google Cal       Realtime
   │                         │                         │                    │                │
   │ submit form             │                         │                    │                │
   ├────────────────────────▶│ scheduleOneOnOne()      │                    │                │
   │                         │ zod parse + role check  │                    │                │
   │                         ├────────────────────────▶│ INSERT one_on_ones │                │
   │                         │                         │                    │                │
   │                         │ has provider_token?     │                    │                │
   │                         ├──────────────────────────────────────────────▶ create event   │
   │                         │                         │                    │  + Meet link   │
   │                         │◀──────────────────────────────────────────────┤                │
   │                         ├────────────────────────▶│ UPDATE meet_link   │                │
   │                         │                         │                    │                │
   │                         │                         │ Realtime publica   │                │
   │                         │                         ├────────────────────┼───────────────▶│ colaborador
   │                         │                         │                    │                │ ve la nueva 1:1
   │                         │ revalidatePath()        │                    │                │ sin recargar
   │◀────────────────────────┤                         │                    │                │
```

Código: `scheduleOneOnOne` en `src/lib/actions/one-on-ones.ts`. La realtime publication (`supabase/migrations/00000000000004_realtime_publication.sql`) hace que el colaborador vea la sesión nueva en su dashboard sin recargar — el hook `useRealtimeMeeting` se suscribe a la tabla `one_on_ones` filtrando por `collaborator_id`.

### Notificación de cadencia vencida

```
Vercel cron (lunes 09:00) ──GET /api/cron/check-cadence──▶ Next route
                                                              │
                                            authz: Bearer CRON_SECRET
                                                              │
                                                              ▼
                                              SELECT cadence_configs (global o dept)
                                                              │
                                                              ▼
                                              SELECT leadership_relations WHERE ended_at IS NULL
                                                              │
                                                ┌─────────────┴─────────────┐
                                                ▼                           ▼
                                       per relación:                  per relación:
                                       last realizada > N días?       no hay ninguna realizada?
                                                │                           │
                                                └─────────────┬─────────────┘
                                                              ▼
                                                líder.slack_user_id existe?
                                                              │ yes
                                                              ▼
                                                  notifyMissedMeeting()
                                                              │
                                                              ▼
                                                  Slack chat.postMessage
                                                              │
                                                              ▼
                                                  DM al líder
```

Frecuencia: `0 9 * * 1` (lunes 9am, ver `vercel.json`). Auth: header `Authorization: Bearer ${CRON_SECRET}`. Si el líder no tiene `slack_user_id` (no sincronizado), se hace skip silencioso — correr `scripts/sync-slack-ids.ts` para resolver.

Crons relacionados:

| Endpoint | Schedule | Qué hace |
|---|---|---|
| `/api/cron/check-cadence` | `0 9 * * 1` | DM al líder si excedió N días sin 1:1 |
| `/api/cron/notify-due-agreements` | `0 8 * * *` | Notifica acuerdos próximos a vencer |
| `/api/cron/check-thresholds` | `*/30 * * * *` | Dispatcher de `notification_rules`: chequea triggers configurables (calidez baja, vobo pendiente, etc.) |
| `/api/cron/send-scheduled-reports` | `0 * * * *` | Envía reportes RH programados (CSV/PDF por email) |

### Disputa de no-realización

```
Colaborador                                    Líder
  marca "no realizada"                             marca "no realizada"
  con reason=A                                     con reason=B
        │                                                │
        ▼                                                ▼
   markNonRealization()                            markNonRealization()
        │                                                │
        ▼                                                ▼
   UPDATE one_on_ones                              SELECT one_on_ones
   set non_realization_reason=A                    previousReason=A, newReason=B
   status='no_realizada'                                  │
                                                          ▼
                                              goToDispute = previousReason !== newReason
                                                          │
                                                          ▼
                                              UPDATE status='en_disputa'
                                                          │
                                                          ▼
                                              SELECT org_settings.hr_slack_channel
                                                          │
                                                          ▼
                                              notifyDispute()
                                                          │
                                                          ▼
                                              Slack: canal #rh-disputas
                                              "Hay discrepancia en la 1:1 X"
                                              + deep link a /arquitectura-humana/disputas
```

Código: `markNonRealization` en `src/lib/actions/one-on-ones.ts`. La discrepancia se detecta cuando el segundo en marcar lo hace con `non_realization_reason` distinto al primero. Solo en ese caso se notifica al canal de RH (no DM al líder/colaborador — la conversación es entre RH y ambas partes). El canal destino sale de `org_settings.hr_slack_channel` configurable en `/arquitectura-humana/parametros`.

## Decisiones arquitectónicas

1. **Server Actions en lugar de tRPC / REST.** Vienen built-in con App Router, type-safe sin codegen extra, integración nativa con `revalidatePath`/`revalidateTag`, y los inputs se validan con `zod` en el mismo lugar donde se ejecutan. Costo: lock-in a Next.js, harder de testear en aislamiento que un endpoint puro. Beneficio: ~zero boilerplate, un archivo por dominio en `src/lib/actions/`.

2. **RLS en Postgres además de checks en server actions.** Defense in depth. Las actions validan rol antes de hacer queries (`profile.role !== 'leader'` → reject), pero no podemos confiar solo en eso: un bug futuro, un import accidental del admin client, o una server action mal escrita podría saltearse el check. Con RLS, incluso si un dev se equivoca, el JWT del user no le da permiso de leer/escribir filas que no le corresponden. La auditoría `docs/rls-audit.md` valida que cada INSERT/UPDATE/DELETE en actions tiene policy correspondiente.

3. **Slack DM + canal según destinatario.** DMs para notificaciones personales accionables (líder con cadencia vencida, colaborador con VoBo pendiente). Canal para visibilidad colectiva de RH (disputas, alertas de mapa de calor). No mezclamos: nadie quiere ver disputas ajenas en su DM, y RH no quiere recibir un DM por cada caso individual. Mapeo trigger → channel en `docs/notif-matrix.md`.

4. **Crons en Vercel.** Managed, configurables en `vercel.json`, sin infra propia. Auth con `CRON_SECRET` en header. Limitaciones: granularidad mínima 1 minuto, sin retry automático, sin observabilidad fina más allá de los logs de Vercel — para eso confiamos en Sentry capturando errores y en el dashboard de notificaciones (Fase 7.F) midiendo delivery rate. Si en el futuro necesitamos crons más confiables (ej. delivery retry con backoff complejo), evaluar pg_cron en Supabase o un orquestador externo.

5. **Sentry para errores en server + client.** Sin Sentry, los errores en server actions terminan en logs de Vercel que se pierden a los 7 días y nadie revisa. Con Sentry: alerta inmediata, stack trace, breadcrumbs, ID que el usuario puede reportar. Configurado para no enviar PII (filtros en `sentry.*.config.ts`). Opt-out: si `NEXT_PUBLIC_SENTRY_DSN` está vacío, Sentry no se inicializa.

6. **Migrations versionadas como source of truth.** Nada de cambios al schema directo en Supabase Studio. Cada cambio entra como `supabase/migrations/0000000000NNNN_descripcion.sql`. `pnpm db:types` regenera el archivo de tipos después de cada migration aplicada. El pre-commit hook (Fase 4.3 del hardening plan, pendiente) va a fallar si `database.types.ts` está desincronizado con el schema linkeado.

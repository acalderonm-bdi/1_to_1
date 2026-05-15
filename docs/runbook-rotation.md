# Runbook — Rotación de tokens/secrets en 1to1

> Cuándo rotar, cómo rotar sin downtime, y dónde quedan los secrets viejos.

## Tabla de secrets

| Secret | Dónde se usa | Rotación recomendada | Impacto si se compromete |
|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Server actions con `createAdminClient()` + crons + scripts | Cada 90 días o al sospechar | Acceso total a DB, bypass RLS — **crítico** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client (browser) + server | Solo si la URL del project cambia | Bajo (RLS protege) |
| `SLACK_BOT_TOKEN` | `src/lib/slack/*.ts` (3 helpers + cron check-cadence) | Cada 90 días o al ver `auth.test()` fallar | DMs/canal en nombre del bot |
| `RESEND_API_KEY` | `src/lib/email/notify.ts` (cuando esté seteada) | Cada 90 días | Envío de emails con dominio configurado |
| `CRON_SECRET` | Auth de `/api/cron/*` endpoints | Cada 90 días o al sospechar | Disparar crons (notificaciones falsas) |
| `ANTHROPIC_API_KEY` | `src/app/api/ai/*` routes | Cada 90 días | Uso facturado de Claude API |
| `GOOGLE_CALENDAR_*` (OAuth) | `src/lib/google/calendar.ts` | Si Google reporta abuse | Crear/borrar eventos de calendarios autenticados |
| `NEXT_PUBLIC_SENTRY_DSN` | `sentry.*.config.ts` | Solo si se compromete | Bajo (solo error reporting) |
| `SENTRY_AUTH_TOKEN` | CI/build (source maps upload) | Cada 90 días | Upload de source maps fake |

## Procedimiento general

1. **Generar nuevo secret** en el proveedor (Supabase dashboard, Slack OAuth & Permissions, Resend dashboard, etc.)
2. **Actualizar Vercel env var** (`Production` scope) — NO borrar el viejo todavía
3. **Re-deploy de Vercel** (cualquier deploy nuevo recoge la env var actualizada)
4. **Verificar `/api/health`** retorna 200 — confirma DB+Slack+email funcionan con nuevo secret
5. **Revocar el secret viejo** en el proveedor
6. **Actualizar `.env.local`** de cada dev (compartir el nuevo vía 1Password/Bitwarden)
7. **Documentar fecha de rotación** en `docs/rotation-log.md` (crear si no existe)

## Procedimientos específicos por secret

### SUPABASE_SERVICE_ROLE_KEY

1. Supabase dashboard → Project Settings → API → "Reset service_role secret"
2. Copiar el nuevo
3. Vercel → Settings → Environment Variables → `SUPABASE_SERVICE_ROLE_KEY` → Edit (Production scope)
4. Trigger deploy: `vercel --prod` o push a `main`
5. Verificar `/api/health` → DB check `ok:true`
6. (No hay "revocar viejo" — el reset ya lo invalida)

### SLACK_BOT_TOKEN

1. Slack: `api.slack.com/apps/[YOUR_APP]` → OAuth & Permissions → "Reinstall to Workspace"
2. Copiar nuevo Bot User OAuth Token
3. Vercel → env var update → deploy
4. Verificar `/api/health` → Slack check `ok:true`
5. (Reinstall invalida el viejo)

### CRON_SECRET

1. Local: `openssl rand -hex 32`
2. Vercel → env var update → deploy
3. **Importante**: si tenés crons configurados en `vercel.json`, los headers `Authorization` se actualizan automáticamente. Si tenés cron en pg_cron de Supabase u otro orquestador externo, **hay que actualizarlo manualmente** y puede haber ~1 ejecución que falle con 401.
4. Verificar dispatch manual:
   ```bash
   curl -H "Authorization: Bearer NEW_SECRET" https://1to1.b-drive.com.mx/api/cron/check-cadence
   ```

### RESEND_API_KEY

1. Resend dashboard → API Keys → Create new
2. Vercel env → deploy
3. Verificar `/api/health` → email check `ok:true` (cuando esté implementado el health check de email beyond skipped)
4. Borrar la key vieja en Resend

### ANTHROPIC_API_KEY

1. console.anthropic.com → API Keys → Create → asignar a workspace 1to1
2. Vercel env → deploy
3. Verificar con request manual a `/api/ai/suggest-questions`
4. Borrar key vieja

## Calendario de rotación

Configurar recordatorio recurrente (Google Calendar / Notion):

- **Trimestral (cada 90 días)**: rotación rutinaria de todos los secrets sensibles
- **Anual**: revisar permisos OAuth de Google Calendar, validar que sigan vigentes los scopes
- **Ad-hoc**: si un dev sale del equipo, rotar TODOS los secrets de servicio (no solo los que ese dev usaba)

## En caso de compromiso

Si sospechás que un secret fue expuesto (chat, repo público, log expuesto):

1. **Rotá inmediatamente** sin esperar al ciclo normal
2. **Auditá logs** del proveedor (Supabase, Slack, Resend) para detectar uso no autorizado
3. **Documentá** en `docs/incidents.md` (crear si no existe): qué pasó, cuánto duró el exposure, qué se vio en logs
4. **Si fue commit a git**: incluso después de rotar, considerar `git filter-repo` para borrar del history (especialmente si el repo es público o se sincroniza con upstream)

## Scripts útiles

```bash
# Verificar qué env vars están en Vercel
vercel env ls

# Pull env vars de Vercel a local (cuidado con sobrescribir)
vercel env pull .env.local.production

# Generar CRON_SECRET nuevo
openssl rand -hex 32

# Validar token Slack
pnpm tsx scripts/slack-test-auth.ts
```

## Quién es responsable

- **Service role + DB**: lead técnico (Ariel) — único acceso al Supabase dashboard
- **Slack bot**: lead técnico + un backup designado del equipo IT
- **Resend + Anthropic**: lead técnico
- **Sentry**: lead técnico (no crítico)
- **Vercel env vars**: lead técnico + cualquier maintainer con acceso al proyecto

Para rotaciones programadas: agendar 30 min en calendar, hacer durante hora laboral (no de noche/fin de semana) para reaccionar rápido si algo rompe.

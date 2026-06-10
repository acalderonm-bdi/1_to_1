# Runbook de Deploy — 1to1

> Guía para llevar cambios desde una rama feature hasta producción en Vercel.
> Pensado para un dev que entra nuevo al equipo.

---

## Prerrequisitos y accesos necesarios

Antes de hacer tu primer deploy asegurate de tener:

| Acceso | Dónde pedirlo | Para qué |
|---|---|---|
| GitHub repo `acalderonm-bdi/1_to_1` | Lead técnico (Ariel) | Push de ramas, abrir PRs |
| Vercel proyecto `1-to-1-test` (`acalderonm-7321s-projects`) | Lead técnico | Ver logs, env vars, historial de deployments |
| Supabase proyecto `mlmpjeneeckfdyqavwgj` (us-west-2) | Lead técnico | Dashboard DB, migrations, backups |
| 1Password / Bitwarden del equipo | Lead técnico | Obtener valores reales de env vars |

Herramientas locales requeridas:

```bash
# Node 20 LTS
node --version   # debe mostrar v20.x.x

# pnpm 9
corepack enable && corepack prepare pnpm@9 --activate
pnpm --version   # debe mostrar 9.x.x

# Supabase CLI
brew install supabase/tap/supabase   # macOS
# o ver https://supabase.com/docs/guides/local-development/cli

# Vercel CLI (opcional, útil para ver logs y env vars)
pnpm add -g vercel
```

---

## Variables de entorno requeridas

Las env vars se gestionan en **Vercel → Settings → Environment Variables** (scope `Production`).
Para desarrollo local se copian en `.env.local` (nunca commitear este archivo).

```bash
cp .env.example .env.local
# Rellenar con valores reales de 1Password/Bitwarden
```

### Obligatorias (el sistema no arranca sin estas)

| Variable | Descripción | Dónde obtenerla |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL pública del proyecto Supabase | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | API key pública (sujeta a RLS) | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypass RLS — mantener secreto) | Supabase → Project Settings → API |
| `SUPABASE_PROJECT_REF` | ID del proyecto (`mlmpjeneeckfdyqavwgj`) | Supabase → Project Settings → General |
| `SUPABASE_DB_PASSWORD` | Password de la DB Postgres | Supabase → Project Settings → Database |
| `GOOGLE_CLIENT_ID` | ID de la OAuth App de Google | Google Cloud Console → APIs & Services → Credentials |
| `GOOGLE_CLIENT_SECRET` | Secret de la OAuth App de Google | Google Cloud Console → APIs & Services → Credentials |
| `GOOGLE_REDIRECT_URI` | URL de callback OAuth (`https://<host>/api/auth/callback`) | Debe coincidir con la registrada en Google Cloud |
| `ANTHROPIC_API_KEY` | API key de Claude para features de IA | console.anthropic.com → API Keys |
| `CRON_SECRET` | Secret para autenticar los endpoints `/api/cron/*` | Generar con `openssl rand -hex 32` |
| `NEXT_PUBLIC_APP_URL` | URL pública de la app (`https://1to1.b-drive.com.mx`) | El dominio configurado en Vercel |

### Opcionales (el sistema degrada silenciosamente si faltan)

| Variable | Descripción | Dónde obtenerla |
|---|---|---|
| `SLACK_BOT_TOKEN` | Bot User OAuth Token para enviar mensajes a Slack | api.slack.com → Your Apps → OAuth & Permissions |
| `SLACK_DEFAULT_CHANNEL` | Canal por defecto para notificaciones (`#canal`) | Slack workspace |
| `RESEND_API_KEY` | API key para envío de emails transaccionales | resend.com → API Keys |
| `RESEND_FROM_EMAIL` | Email de origen para Resend | resend.com (debe estar verificado) |
| `EMAIL_FROM` | Sender con formato RFC 5322 (`"1to1 <noreply@b-drive.com.mx>"`) | Debe coincidir con dominio verificado en Resend |
| `NEXT_PUBLIC_SENTRY_DSN` | DSN de Sentry para error tracking en browser/server | sentry.io → [project] → Settings → Client Keys |
| `SENTRY_AUTH_TOKEN` | Token para subir source maps en build | sentry.io → Settings → Auth Tokens |
| `SENTRY_ORG` | Slug de la organización en Sentry | sentry.io → Settings |
| `SENTRY_PROJECT` | Slug del proyecto en Sentry | sentry.io → Settings → Projects |

### Solo para scripts locales (no van a Vercel)

| Variable | Descripción |
|---|---|
| `ADMIN_EMAIL` | Email del primer usuario Arquitectura Humana (setup inicial) |
| `ADMIN_PASSWORD` | Password del usuario admin (si vacío se genera automáticamente) |
| `ADMIN_FULL_NAME` | Nombre completo del admin |
| `SEED_DEMO_DATA` | `true` para crear datos demo al correr `pnpm db:seed` |

---

## Flujo de deploy: feature → PR → main → Vercel

```
 feature/mi-cambio
        │
        ▼
  git push origin feature/mi-cambio
        │
        ▼
  PR en GitHub → revisión + CI pass
        │
        ▼
  Merge a main
        │
        ▼
  Vercel auto-deploy (≈ 2-4 min)
        │
        ▼
  Verificar /api/health
```

### Paso a paso

**1. Crear rama feature desde main actualizado**

```bash
git checkout main
git pull origin main
git checkout -b feature/nombre-descriptivo
```

**2. Desarrollar y commitear**

```bash
# Antes de commitear, correr chequeos locales
pnpm tsc -b          # typecheck (misma config que CI — usar este, no --noEmit)
pnpm lint            # next lint
pnpm test            # vitest unit tests

git add src/...
git commit -m "feat: descripción del cambio"
git push origin feature/nombre-descriptivo
```

**3. Abrir Pull Request en GitHub**

- Base: `main`
- Verificar que el CI (GitHub Actions) pase: `tsc -b` + `vitest` + `lint`
- El PR genera automáticamente un **preview deploy** en Vercel (URL única por PR)
- Solicitar revisión al lead técnico

**4. Merge a main**

Cuando el PR es aprobado y el CI está verde, hacer merge (preferir "Squash and merge" para mantener historial limpio).

**5. Deploy automático en Vercel**

Vercel detecta el push a `main` y dispara el deploy automáticamente. El proceso toma entre 2 y 4 minutos. Podés seguirlo en:

- Vercel dashboard → proyecto `1-to-1-test` → Deployments
- O por CLI: `vercel logs --follow`

---

## Cómo verificar que el deploy fue exitoso

### 1. Health check

```bash
curl https://1to1.b-drive.com.mx/api/health
```

Respuesta esperada (`200 OK`):

```json
{
  "ok": true,
  "checks": {
    "database": { "ok": true, "latency_ms": 42 },
    "slack": { "ok": true, "latency_ms": 120 },
    "email": { "ok": true }
  },
  "timestamp": "2026-06-10T09:00:00.000Z"
}
```

- `ok: true` en el objeto raíz confirma que DB + Slack + email están funcionando.
- Un check con `"skipped": true` significa que esa integración no está configurada (no es un error si fue intencional).
- `503` en el status HTTP indica que algún check falló — revisar `checks` para identificar cuál.

### 2. Revisar logs en Vercel

```bash
# Ver logs del deployment más reciente
vercel logs --follow

# O en el dashboard: Vercel → Deployments → [último deploy] → Functions / Build Logs
```

Buscar errores `500`, excepciones no capturadas, o warnings de env vars faltantes.

### 3. Smoke test manual

Entrar a la app y verificar el flujo básico:
- Login con Google SSO funciona
- El panel del colaborador carga
- El panel del líder carga
- Arquitectura Humana (RH) carga

---

## Rollback: revertir a un deployment anterior

Vercel mantiene el historial completo de deployments. Para volver a uno anterior:

**Opción A — Dashboard (recomendada)**

1. Ir a Vercel → proyecto `1-to-1-test` → **Deployments**
2. Encontrar el deployment al que querés volver (están ordenados por fecha)
3. Click en los tres puntos (`...`) → **Promote to Production**
4. Confirmar — el deployment anterior se convierte en el activo inmediatamente

**Opción B — CLI**

```bash
# Listar deployments recientes
vercel ls

# Promover un deployment específico a producción
vercel promote <deployment-url-o-id>
```

**Opción C — Git revert (si el problema fue un cambio de código)**

```bash
git revert HEAD          # revierte el último commit sin borrar historial
git push origin main     # triggea nuevo deploy automático
```

Nota: si el rollback incluye cambios de schema de DB (migrations), hacer `git revert` solo no es suficiente — ver la sección de migrations abajo.

---

## Migrations de base de datos

Las migrations viven en `supabase/migrations/` y son el source of truth del schema.

### Crear una migration nueva

```bash
# Crear archivo de migration con timestamp
pnpm supabase migration new nombre-descriptivo
# Editar el archivo SQL generado en supabase/migrations/
```

### Aplicar migrations al remote

```bash
# Linkear CLI al proyecto remoto (solo una vez por repo clonado)
pnpm supabase link --project-ref mlmpjeneeckfdyqavwgj

# Ver qué migrations están pendientes de aplicar
pnpm supabase migration list --linked

# Aplicar migrations pendientes
pnpm supabase db push --linked

# Regenerar los tipos TypeScript después de cambios de schema
pnpm db:types
```

### Importante: orden de operaciones con migrations

Si tu PR incluye una migration de schema:

1. Aplicar la migration **antes** de hacer deploy del código que la usa
2. Verificar `pnpm supabase migration list --linked` — la migration debe aparecer como aplicada en remote
3. Regenerar `database.types.ts` y commitear el archivo actualizado junto con el código
4. **No incluir** `database.types.ts` desactualizado en el PR (el CI typecheck fallará)

### Rollback de una migration

Supabase no soporta rollback automático de migrations. Si necesitás revertir:

```bash
# Opción: escribir una migration inversa
pnpm supabase migration new revert-nombre-de-la-migration
# Escribir el SQL inverso (DROP TABLE, ALTER TABLE, etc.)
pnpm supabase db push --linked
```

Para cambios críticos, coordiná con el lead técnico antes de aplicar al remote de producción.

---

## Limitaciones del plan Hobby y cómo escalar a Pro

### Plan Hobby actual

| Limitación | Detalle |
|---|---|
| Máximo 2 cron jobs | Solo podés agendar 2 rutas en `vercel.json` |
| Frecuencia mínima: 1 vez al día | No hay soporte para crons sub-diarios (ej. cada hora) |
| Sin SLA de uptime | Los functions pueden tener cold starts más frecuentes |

**Crons agendados actualmente** (en `vercel.json`):

| Path | Schedule | Descripción |
|---|---|---|
| `/api/cron/check-cadence` | `0 9 * * 1` | Lunes a las 9am — verifica cadencias |
| `/api/cron/check-thresholds` | `0 9 * * *` | Todos los días a las 9am — thresholds + acuerdos por vencer + reportes diarios |

Las otras 2 rutas cron (`/api/cron/notify-due-agreements` y `/api/cron/send-scheduled-reports`) son invocables manualmente con `CRON_SECRET` pero no están agendadas en Vercel.

**Para ejecutar un cron manualmente:**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://1to1.b-drive.com.mx/api/cron/check-thresholds
```

### Upgrade a Vercel Pro

Si se necesita:
- Más de 2 crons agendados
- Crons sub-diarios (ej. cada hora para drain de notificaciones)
- SLA de uptime garantizado
- Edge functions sin límite de duración

Pasos para el upgrade:
1. Vercel dashboard → `acalderonm-7321s-projects` → Billing → Upgrade to Pro
2. Una vez en Pro, agregar los 4 crons en `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/check-cadence", "schedule": "0 9 * * 1" },
    { "path": "/api/cron/check-thresholds", "schedule": "0 9 * * *" },
    { "path": "/api/cron/notify-due-agreements", "schedule": "0 8 * * *" },
    { "path": "/api/cron/send-scheduled-reports", "schedule": "0 8 * * 1" }
  ]
}
```

---

## Checklist pre-deploy

Antes de mergear a `main`, verificar:

- [ ] `pnpm tsc -b` pasa sin errores
- [ ] `pnpm lint` pasa sin errores
- [ ] `pnpm test` pasa (vitest unit tests)
- [ ] Si hubo cambios de schema: `pnpm supabase migration list --linked` muestra la migration aplicada en remote
- [ ] Si hubo cambios de schema: `database.types.ts` regenerado y commiteado
- [ ] Si se agregaron env vars nuevas: agregadas en Vercel → Environment Variables antes del deploy
- [ ] Preview deploy del PR revisado en browser
- [ ] El CI de GitHub Actions está verde en el PR
- [ ] Si hay cambios de RLS: verificado contra server actions en `src/lib/actions/` (ver `docs/rls-audit.md`)

Post-deploy:
- [ ] `GET /api/health` retorna `200` con `ok: true`
- [ ] Smoke test: login → panel colaborador → panel líder → sin errores en consola
- [ ] Vercel Deployments muestra el build como "Ready"

---

## Staging environment

Post Fase 5.3 del hardening plan, existe un ambiente de staging paralelo:

- **URL**: `https://1to1-staging.b-drive.com.mx`
- **Supabase**: proyecto staging separado
- **Vercel**: proyecto Vercel separado con preview deploys de la rama `staging`

El flujo con staging:

```
feature/* → PR → merge a staging → auto-deploy staging → smoke test → promote a main → prod
```

Hasta que staging esté activo, los preview deploys de los PRs sirven como sustituto.

# Runbook — Rotación de tokens y secrets

> Inventario completo de todos los secrets del sistema 1to1, cómo rotar cada uno sin downtime,
> y la frecuencia recomendada de rotación.
>
> Este documento reemplaza y expande `docs/runbook-rotation.md`.

---

## Inventario de secrets

| Secret | Tipo | Criticidad | Rotación recomendada |
|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Key de servicio DB | Crítica | Cada 90 días o ante sospecha |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Key pública DB | Baja | Solo si cambia el proyecto |
| `SLACK_BOT_TOKEN` | OAuth Bot Token | Alta | Cada 90 días |
| `ANTHROPIC_API_KEY` | API Key de IA | Alta | Cada 90 días |
| `GOOGLE_CLIENT_SECRET` | OAuth App Secret | Alta | Cada 90 días o si Google reporta abuso |
| `CRON_SECRET` | HMAC Secret interno | Alta | Cada 90 días |
| GitHub PAT | Personal Access Token | Media | Cada 90 días |
| Vercel Token | API Token de Vercel | Media | Cada 90 días |
| Supabase Access Token | Token CLI de Supabase | Media | Cada 90 días |
| `RESEND_API_KEY` | API Key de email | Media | Cada 90 días |
| `SENTRY_AUTH_TOKEN` | Token build CI | Baja | Cada 90 días |

---

## Principio de rotación sin downtime

El orden siempre es: **generar nuevo → actualizar en Vercel → deploy → verificar → revocar viejo**.

Nunca revocar el secret viejo antes de confirmar que el nuevo funciona en producción.

```
1. Generar nuevo secret en el proveedor
         │
         ▼
2. Actualizar env var en Vercel (NO borrar el viejo todavía)
         │
         ▼
3. Trigger de redeploy en Vercel
         │
         ▼
4. Verificar /api/health → ok: true
         │
         ▼
5. Revocar secret viejo en el proveedor
         │
         ▼
6. Actualizar .env.local en todas las máquinas de devs (vía 1Password/Bitwarden)
         │
         ▼
7. Registrar fecha en docs/rotation-log.md
```

---

## Procedimientos específicos por secret

### `SUPABASE_SERVICE_ROLE_KEY`

**Impacto si se compromete:** acceso total a la DB con bypass de RLS — el más crítico del sistema.

**Dónde rotarlo:**
1. Ir a [supabase.com/dashboard](https://supabase.com/dashboard) → proyecto `mlmpjeneeckfdyqavwgj`
2. **Settings → API → Service Role Secret → "Reset"**
3. Copiar la nueva key generada

**Dónde actualizarlo:**
- Vercel → proyecto `1-to-1-test` → **Settings → Environment Variables** → `SUPABASE_SERVICE_ROLE_KEY` → Edit (scope `Production`)

**Requiere redeploy:** Sí. Trigger manual o push vacío a `main`:
```bash
git commit --allow-empty -m "chore: trigger redeploy for secret rotation"
git push origin main
```

**Verificar:**
```bash
curl https://1to1.b-drive.com.mx/api/health
# Esperado: "database": { "ok": true }
```

**Nota:** el "Reset" en Supabase invalida la key anterior automáticamente — no hay paso separado de revocación.

---

### `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Impacto si se compromete:** bajo — la anon key es pública por diseño y RLS protege los datos. Solo escalar si se sospecha que alguien está abusando de la API directamente.

**Dónde rotarlo:**
- Supabase → Settings → API → no tiene "Reset" directo. La anon key cambia solo si se rota el JWT secret del proyecto (Settings → API → JWT Settings → "Generate a new secret") — esto también invalida todas las sesiones activas de usuarios.

**Requiere redeploy:** Sí, y fuerza re-login de todos los usuarios.

**Recomendación:** Solo rotar si hay evidencia de abuso. Es una operación disruptiva.

---

### `SLACK_BOT_TOKEN`

**Impacto si se compromete:** el bot puede enviar mensajes al workspace en nombre de los usuarios configurados. Revocar inmediatamente si se sospecha.

**Dónde rotarlo:**
1. Ir a [api.slack.com/apps](https://api.slack.com/apps) → seleccionar la app del bot
2. **OAuth & Permissions → "Reinstall to Workspace"**
3. Autorizar → copiar el nuevo **Bot User OAuth Token** (`xoxb-...`)

**Dónde actualizarlo:**
- Vercel → `SLACK_BOT_TOKEN` → Edit (scope `Production`)

**Requiere redeploy:** Sí.

**Verificar:**
```bash
curl https://1to1.b-drive.com.mx/api/health
# Esperado: "slack": { "ok": true }

# O invocar el test directamente
pnpm tsx scripts/slack-test-auth.ts
```

**Nota:** Reinstall invalida el token anterior automáticamente.

---

### `ANTHROPIC_API_KEY`

**Impacto si se compromete:** uso facturado de Claude API en la cuenta de B-Drive. Revocar inmediatamente y revisar uso en el dashboard de Anthropic.

**Dónde rotarlo:**
1. Ir a [console.anthropic.com](https://console.anthropic.com) → **API Keys**
2. Click en **"+ Create Key"** — asignar nombre descriptivo (ej. `1to1-prod-2026-06`)
3. Copiar la nueva key

**Dónde actualizarlo:**
- Vercel → `ANTHROPIC_API_KEY` → Edit (scope `Production`)

**Requiere redeploy:** Sí.

**Verificar:**
```bash
# Hacer una request a cualquier endpoint de IA
curl -X POST https://1to1.b-drive.com.mx/api/ai/suggest-questions \
  -H "Content-Type: application/json" \
  -d '{"oneOnOneId": "test"}' \
  -w "\nHTTP Status: %{http_code}\n"
# Esperado: 200 o 400 (no 500 por key inválida)
```

**Paso final:** ir a [console.anthropic.com](https://console.anthropic.com) → API Keys → borrar la key vieja.

---

### `GOOGLE_CLIENT_SECRET`

**Impacto si se compromete:** acceso OAuth a la cuenta de Google de cualquier usuario que haya autenticado con la app. El atacante no obtiene tokens existentes, pero puede crear una app falsa que solicite los mismos scopes.

**Dónde rotarlo:**
1. Ir a [console.cloud.google.com](https://console.cloud.google.com) → proyecto de B-Drive
2. **APIs & Services → Credentials → OAuth 2.0 Client IDs**
3. Seleccionar el client ID de la app 1to1
4. Click en **"Reset Secret"** → copiar el nuevo secret

**Dónde actualizarlo:**
- Vercel → `GOOGLE_CLIENT_SECRET` → Edit (scope `Production`)
- También actualizar en Supabase: **Authentication → Providers → Google → Client Secret**

**Requiere redeploy:** Sí (Vercel). Supabase se actualiza inmediatamente.

**Impacto en usuarios:** las sesiones activas NO se invalidan — solo los nuevos logins y re-autenticaciones usan el nuevo secret. No hay downtime para usuarios activos.

**Verificar:**
```bash
# Hacer un logout y login con Google SSO en la app
# Verificar que el flujo completa sin error en /api/auth/callback
```

---

### `CRON_SECRET`

**Impacto si se compromete:** alguien puede disparar los cron jobs manualmente, causando notificaciones falsas o ejecución duplicada de jobs.

**Dónde generarlo:**
```bash
openssl rand -hex 32
# Guarda el output — es el nuevo CRON_SECRET
```

**Dónde actualizarlo:**
- Vercel → `CRON_SECRET` → Edit (scope `Production`)

**Requiere redeploy:** Sí.

**Nota importante:** Vercel inyecta automáticamente el header `Authorization: Bearer <CRON_SECRET>` al ejecutar los crons definidos en `vercel.json`. No hay configuración adicional para los crons de Vercel. Si hubiera crons externos (pg_cron en Supabase u otro orquestador), hay que actualizarlos manualmente — pueden fallar con `401` en la próxima ejecución programada.

**Verificar:**
```bash
# Invocar un cron manualmente con el nuevo secret
curl -H "Authorization: Bearer <NUEVO_CRON_SECRET>" \
  https://1to1.b-drive.com.mx/api/cron/check-thresholds
# Esperado: 200 (no 401)
```

---

### GitHub PAT (Personal Access Token)

**Uso:** acceso al repositorio `acalderonm-bdi/1_to_1` para CI, scripts de automatización, o acceso programático desde máquinas de staging/CI.

**Dónde rotarlo:**
1. Ir a [github.com/settings/tokens](https://github.com/settings/tokens) → cuenta `acalderonm`
2. Encontrar el token en uso → **"Regenerate"** o crear uno nuevo con los mismos scopes
3. Scopes mínimos recomendados: `repo` (para clonado y push en CI)

**Dónde actualizarlo:**
- Si se usa en GitHub Actions: **repo → Settings → Secrets and variables → Actions → `GITHUB_TOKEN`** (o el nombre que tenga)
- Si se usa en scripts locales: actualizar en `.env.local` de cada dev
- Si se usa en Vercel para builds: Vercel → Settings → Git → actualizar la integración

**Requiere redeploy:** Depende del uso. Si solo se usa en CI, solo afecta el próximo PR build.

---

### Vercel Token

**Uso:** autenticación de la Vercel CLI para comandos de deploy, env pull, y logs desde la terminal. No se usa en runtime de la app.

**Dónde rotarlo:**
1. Ir a [vercel.com/account/tokens](https://vercel.com/account/tokens) → cuenta `acalderonm-7321s-projects`
2. Identificar el token activo → **"Delete"**
3. **"Create"** → nombrar (ej. `cli-2026-Q3`) → asignar scope al proyecto `1-to-1-test`
4. Copiar el nuevo token

**Dónde actualizarlo:**
- En `.env.local` de cada dev que use Vercel CLI: `VERCEL_TOKEN=...`
- O autenticar de nuevo: `vercel logout && vercel login`

**Requiere redeploy:** No — no se usa en runtime.

---

### Supabase Access Token

**Uso:** autenticación del Supabase CLI para correr `supabase link`, `supabase db push`, `supabase migration list`, etc.

**Dónde rotarlo:**
1. Ir a [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens)
2. Identificar el token activo → **"Revoke"**
3. **"Generate new token"** → nombrar (ej. `cli-2026-Q3`)
4. Copiar el nuevo token

**Dónde actualizarlo:**
- Autenticar el CLI: `pnpm supabase login` → pegar el nuevo token
- O setear en la shell: `export SUPABASE_ACCESS_TOKEN=...`
- Actualizar en `.env.local` si se usa en scripts

**Requiere redeploy:** No — solo se usa en CLI, no en runtime.

---

### `RESEND_API_KEY`

**Impacto si se compromete:** envío de emails con el dominio `b-drive.com.mx` en nombre de la app. Revocar y revisar actividad en Resend dashboard.

**Dónde rotarlo:**
1. Ir a [resend.com](https://resend.com) → **API Keys**
2. **"Create API Key"** → nombrar y asignar permisos `Sending access`
3. Copiar la nueva key

**Dónde actualizarlo:**
- Vercel → `RESEND_API_KEY` → Edit (scope `Production`)

**Requiere redeploy:** Sí.

**Verificar:**
```bash
curl https://1to1.b-drive.com.mx/api/health
# Esperado: "email": { "ok": true }
```

**Paso final:** ir a Resend → API Keys → **Delete** la key vieja.

---

### `SENTRY_AUTH_TOKEN`

**Impacto si se compromete:** un atacante puede subir source maps a tu proyecto de Sentry, potencialmente obfuscando errores o viendo source maps privados. Impacto bajo en runtime de la app.

**Dónde rotarlo:**
1. Ir a [sentry.io](https://sentry.io) → **Settings → Auth Tokens**
2. **"Create New Token"** → scopes: `project:releases`, `org:read`
3. Copiar el nuevo token

**Dónde actualizarlo:**
- Vercel → `SENTRY_AUTH_TOKEN` → Edit (scope `Production`)
- Si se usa en GitHub Actions: **repo → Settings → Secrets → `SENTRY_AUTH_TOKEN`**

**Requiere redeploy:** Solo el próximo build. El token solo se usa durante `next build`, no en runtime.

---

## Tabla de resumen: redeploy y verificación

| Secret | Requiere redeploy | Cómo verificar |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | `/api/health` → `database.ok: true` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sí | Login de usuario en la app |
| `SLACK_BOT_TOKEN` | Sí | `/api/health` → `slack.ok: true` |
| `ANTHROPIC_API_KEY` | Sí | Request a `/api/ai/suggest-questions` |
| `GOOGLE_CLIENT_SECRET` | Sí (Vercel) / No (Supabase) | Login con Google SSO |
| `CRON_SECRET` | Sí | `curl -H "Authorization: Bearer <nuevo>" /api/cron/check-thresholds` |
| GitHub PAT | No (solo CI) | Siguiente build de PR |
| Vercel Token | No | `vercel ls` desde terminal |
| Supabase Access Token | No | `pnpm supabase migration list --linked` |
| `RESEND_API_KEY` | Sí | `/api/health` → `email.ok: true` |
| `SENTRY_AUTH_TOKEN` | Solo en build | Siguiente deploy con source maps |

---

## Rotación sin downtime: consideraciones especiales

### Secrets con invalidación inmediata del viejo

Los siguientes secrets, al ser "reseteados" en el proveedor, invalidan el secret anterior instantáneamente. La ventana de downtime entre reset y redeploy exitoso es mínima (~2-4 min de deploy):

- `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Reset)
- `SLACK_BOT_TOKEN` (Reinstall to Workspace)

Para estos, la ventana de riesgo es pequeña pero real. Recomendar rotarlos durante horario de baja actividad (ej. 7am antes de que los usuarios entren).

### Secrets donde el viejo y el nuevo coexisten

Los siguientes permiten crear el nuevo secret antes de revocar el viejo, eliminando completamente el downtime:

- `ANTHROPIC_API_KEY` — crear nueva key, actualizar Vercel, deploy, verificar, luego borrar la vieja
- `RESEND_API_KEY` — mismo flujo
- `SENTRY_AUTH_TOKEN` — mismo flujo
- GitHub PAT — crear nuevo, actualizar donde se usa, verificar, revocar viejo
- Vercel Token — mismo flujo
- Supabase Access Token — mismo flujo

**Para estos, el procedimiento recomendado es:**
1. Crear el nuevo secret en el proveedor (sin borrar el viejo)
2. Actualizar en Vercel y hacer deploy
3. Verificar que funciona
4. Revocar el viejo

---

## Frecuencia recomendada por tipo de secret

| Frecuencia | Secrets |
|---|---|
| **Cada 90 días (rutinario)** | `SUPABASE_SERVICE_ROLE_KEY`, `SLACK_BOT_TOKEN`, `ANTHROPIC_API_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `SENTRY_AUTH_TOKEN`, GitHub PAT, Vercel Token, Supabase Access Token |
| **Cada 180 días** | `GOOGLE_CLIENT_SECRET` (más disruptivo — requiere coordinación), `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **Solo ante sospecha o cambio de proyecto** | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_PROJECT_REF` |
| **Si un dev sale del equipo** | Rotar TODOS los secrets de servicio inmediatamente |

---

## Rotación de emergencia (secret comprometido)

Si sospechás que un secret fue expuesto (en un chat, commit público, log visible):

```bash
# 1. Identificar el secret comprometido
# 2. Ir al proveedor y REVOCAR el secret viejo INMEDIATAMENTE (no esperar)
# 3. Generar el nuevo secret
# 4. Actualizar en Vercel y hacer redeploy de emergencia
vercel --prod  # o push a main

# 5. Verificar
curl https://1to1.b-drive.com.mx/api/health

# 6. Auditar logs del proveedor para detectar uso no autorizado
# (Supabase Dashboard → Logs, Slack audit logs, Anthropic console → Usage)

# 7. Si fue expuesto en git history (incluso en una rama privada):
git log --all --full-history -- "**/*.env*"   # buscar commits sospechosos
# Considerar git filter-repo para borrar del history si el repo es público
```

**Documentar** en `docs/incidents.md`:
- Fecha y hora del compromiso detectado
- Secret afectado
- Cuánto tiempo estuvo expuesto (estimado)
- Actividad sospechosa encontrada en logs
- Acciones tomadas

---

## Responsables de cada secret

| Secret | Responsable principal | Backup |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Lead técnico (Ariel) | — |
| `SLACK_BOT_TOKEN` | Lead técnico | IT designado |
| `ANTHROPIC_API_KEY` | Lead técnico | — |
| `GOOGLE_CLIENT_SECRET` | Lead técnico | Dev senior |
| `CRON_SECRET` | Lead técnico | Dev senior |
| `RESEND_API_KEY` | Lead técnico | — |
| GitHub PAT | Cada dev para sus propios tokens | Lead técnico para CI |
| Vercel Token | Cada dev para CLI local | Lead técnico para CI |
| Supabase Access Token | Cada dev para CLI local | — |
| `SENTRY_AUTH_TOKEN` | Lead técnico | — |

---

## Registro de rotaciones

Mantener `docs/rotation-log.md` con el historial. Formato sugerido:

```markdown
## 2026-06-10
- SUPABASE_SERVICE_ROLE_KEY — rotado por Ariel (rotación rutinaria Q2)
- SLACK_BOT_TOKEN — rotado por Ariel (rotación rutinaria Q2)

## 2026-03-10
- ANTHROPIC_API_KEY — rotado por Ariel (rotación rutinaria Q1)
- CRON_SECRET — rotado por Ariel (rotación rutinaria Q1)
```

### Scripts de apoyo

```bash
# Verificar qué env vars están actualmente en Vercel (no muestra valores)
vercel env ls

# Bajar env vars de Vercel a local (cuidado: sobrescribe .env.local)
vercel env pull .env.local.production

# Generar CRON_SECRET nuevo
openssl rand -hex 32

# Probar autenticación de Slack
pnpm tsx scripts/slack-test-auth.ts

# Verificar health de todos los servicios
curl https://1to1.b-drive.com.mx/api/health | jq .
```

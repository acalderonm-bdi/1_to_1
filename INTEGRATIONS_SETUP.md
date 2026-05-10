# Plan de integración — Google Calendar · Slack · Email

> Documento de configuración paso a paso. Léelo de arriba a abajo.
> Cada fase tiene **A. Configuración externa** (lo haces tú en consolas) y
> **B. Código** (lo implementamos juntos). Una fase no se puede empezar
> hasta que la anterior esté verificada.

---

## Estado actual del repo

| Componente | Existe | Conectado a flujo |
|---|---|---|
| `src/lib/google/calendar.ts` | ✓ helpers | ✗ nadie los llama |
| `src/lib/slack/notify.ts` | ✓ funciones | parcial (solo cron cadencia) |
| `src/lib/email/{client,templates}` | ✓ Resend + 2 templates | ✗ sin call sites |
| `/api/auth/callback` | ✓ | ✗ no guarda Google token |
| `/api/cron/check-cadence` | ✓ | ✓ Slack al líder |
| `/api/cron/notify-due-agreements` | ✓ | parcial (solo in-app, falta email/slack) |
| Schema `users.google_calendar_token` | ✓ campo | ✗ vacío |
| Schema `users.slack_user_id` | ✓ campo | ✗ vacío |

---

## Fase 0 — Configuración externa (sin código)

> **Tiempo estimado**: 45-60 min · **Bloqueante**: sí, todo lo demás depende de esto.

Vas a configurar 4 servicios externos. Al final de esta fase los `.env.local`
de dev y las env vars de Vercel deben tener todos los valores reales.

### 0.1 Google Cloud Console — OAuth Client + Calendar API

1. Entra a **console.cloud.google.com**, crea/selecciona un proyecto
   (ej. `1to1-bdrive`).
2. En el sidebar: **APIs & Services → Library**. Busca y habilita:
   - `Google Calendar API`
   - `Google People API` (para email/nombre)
3. **APIs & Services → OAuth consent screen**:
   - User Type: **Internal** (solo tu Workspace) — esto evita el flujo de
     verificación de Google que tarda semanas.
   - App name: `1to1`
   - User support email: el tuyo
   - Developer contact: el tuyo
   - **Scopes**: agrega los siguientes (botón "Add or Remove Scopes"):
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `openid`
     - `https://www.googleapis.com/auth/calendar.events` ← **crítico**
   - Save.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Name: `1to1 web`
   - Authorized JavaScript origins:
     - `http://localhost:3000`
     - `https://<tu-dominio-vercel>.vercel.app` (o tu dominio custom cuando lo tengas)
   - Authorized redirect URIs:
     - `https://<tu-supabase-project-ref>.supabase.co/auth/v1/callback`
       ← **NO es tu app, es Supabase**. Lo encuentras en
       Supabase → Authentication → Providers → Google → "Callback URL".
   - Create. Copia **Client ID** y **Client Secret**.
5. Pega los valores en `.env.local`:
   ```
   GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-...
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
   ```
   El `GOOGLE_REDIRECT_URI` apunta a TU app, no a Supabase — lo usamos
   solo en código nuestro (no en el flow de Supabase OAuth).

**Verificación**: `console.cloud.google.com → Credentials` muestra el client
con los redirect URIs correctos.

---

### 0.2 Supabase Auth — habilitar Google provider con scope Calendar

1. Entra a **dashboard.supabase.com**, abre tu proyecto.
2. **Authentication → Providers → Google**:
   - Enable: ON.
   - Client ID: el de Google Cloud (paso 0.1.4).
   - Client Secret: el de Google Cloud.
   - Authorized Client IDs: vacío.
   - **Skip nonce check**: ON (recomendado para Workspace internal).
3. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` para dev (cambias a prod después).
   - Redirect URLs (allowed): agrega ambos:
     - `http://localhost:3000/api/auth/callback`
     - `https://<dominio-prod>/api/auth/callback`
4. **Authentication → Providers → Google → Additional Scopes**:
   ```
   https://www.googleapis.com/auth/calendar.events
   ```
   Esto le dice a Supabase que reenvíe ese scope al consent de Google y
   que guarde el `provider_token` y `provider_refresh_token` en la sesión
   — sin esto, no podemos llamar a Calendar API.

**Verificación**: en el login de la app, click "Continuar con Google".
La pantalla de consent de Google debe pedir permiso para
"View and edit events on all your calendars" además del básico email/profile.

---

### 0.3 Slack App — Bot Token + scopes

1. Entra a **api.slack.com/apps → Create New App → From scratch**.
2. Nombre: `1to1`. Workspace: el de tu organización.
3. **OAuth & Permissions → Scopes → Bot Token Scopes**, agrega:
   - `chat:write` ← mandar DMs y mensajes a canales
   - `chat:write.public` ← mandar a canales públicos sin invitación
   - `users:read` ← listar usuarios del workspace
   - `users:read.email` ← buscar slack_id por email (autolink)
   - `im:write` ← abrir DMs con usuarios
4. **Install App → Install to Workspace** → autoriza.
5. Copia el **Bot User OAuth Token** (`xoxb-...`).
6. Crea un canal `#1to1-hr-alerts` (privado o público) en Slack. Invita al
   bot: `/invite @1to1`. Copia el Channel ID:
   - Click derecho en el canal → "View channel details" → al final del
     popup verás el Channel ID (`C01...`).
7. Pega en `.env.local`:
   ```
   SLACK_BOT_TOKEN=xoxb-...
   SLACK_DEFAULT_CHANNEL=C01...
   ```

**Verificación rápida** (terminal):
```bash
curl -X POST -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"channel":"$SLACK_DEFAULT_CHANNEL","text":"test desde 1to1"}' \
  https://slack.com/api/chat.postMessage
```
Debe responder `{"ok":true,...}` y aparecer el mensaje en el canal.

---

### 0.4 Resend — dominio verificado para email

1. Entra a **resend.com → Domains → Add Domain**.
2. Dominio: el que uses (ej. `b-drive.com.mx`). Region: `us-east-1` (o más
   cercana).
3. Resend te da 3 records DNS (SPF, DKIM, DMARC opcional). Agrégalos en tu
   proveedor DNS (Cloudflare, GoDaddy, etc.).
4. Espera propagación (5-30 min). Vuelve a Resend y dale "Verify".
5. **API Keys → Create**: scope "Sending access". Copia la key (`re_...`).
6. Pega en `.env.local`:
   ```
   RESEND_API_KEY=re_...
   RESEND_FROM_EMAIL=no-reply@tu-dominio.com
   ```
   El `from` debe ser un alias DEL dominio verificado.

**Verificación**: `Domains` en Resend muestra el dominio en verde "Verified".

---

### 0.5 Vercel Cron (solo si vas a deploy real)

1. **vercel.com** → tu proyecto → **Settings → Environment Variables**.
2. Agrega TODAS las env vars del `.env.local` (Production + Preview).
3. Genera un `CRON_SECRET` aleatorio (ej. `openssl rand -hex 32`) y agrégalo
   en Vercel.
4. Vercel detecta automáticamente el `vercel.json` con los crons al hacer
   deploy. No necesitas más config.

**Verificación**: tras deploy, `Settings → Cron Jobs` lista las 2 entradas
del `vercel.json`.

---

## Fase 1 — Google OAuth: capturar y persistir el token

> **Bloqueante**: sí. Sin esto, ninguna llamada a Calendar funciona.

### A. Configuración externa
Ya hecha en Fase 0.1 + 0.2. Verifica en Supabase Dashboard que el provider
Google tiene el scope `calendar.events` listado.

### B. Código a implementar (yo lo hago)
1. **Migración SQL** (nueva en `supabase/migrations/`): asegurar que
   `users.google_calendar_token` tiene la forma:
   ```json
   {
     "access_token": "ya29...",
     "refresh_token": "1//...",
     "expires_at": "2026-05-09T12:34:56Z",
     "scope": "..."
   }
   ```
   El campo ya existe como `jsonb`, no toca migración.
2. **Modificar `/api/auth/callback`**: tras `exchangeCodeForSession`, leer
   `data.session.provider_token` + `provider_refresh_token` y hacer
   UPSERT en `users.google_calendar_token` con admin client.
3. **Crear `src/lib/google/auth.ts`**: helper `getValidAccessToken(userId)`
   que:
   - Lee el jsonb del user.
   - Si `expires_at` está cerca, llama a `https://oauth2.googleapis.com/token`
     con el refresh_token.
   - Reescribe el jsonb con el nuevo access_token.
   - Retorna access_token válido.
4. **UI Integraciones** en `/configuracion → Integraciones`: leer estado
   real de `google_calendar_token != null` y `slack_user_id != null` para
   mostrar "Conectado" / "Conectar". El botón "Conectar Google" reusa el
   mismo `signInWithOAuth` pero forzando re-consent
   (`queryParams: { prompt: 'consent' }`).

### Cómo verificar
1. Logout, login con Google (botón "Continuar con Google" en /login).
2. Acepta el consent (debe pedir Calendar).
3. Tras redirect, abre el dashboard de Supabase → Table editor → `users`
   → tu fila → expandir `google_calendar_token`. Debe tener
   `access_token` y `refresh_token` no nulos.
4. En /configuracion → Integraciones, "Google Calendar" debe decir
   "Conectado".

---

## Fase 2 — Sync de Calendar con CRUD de 1:1

> **Bloqueante**: requiere Fase 1 verificada.

### A. Configuración externa
Ninguna nueva. (El bot de Slack se configurará en Fase 3, no es necesario
todavía.)

### B. Código a implementar
1. **Modificar `scheduleOneOnOne`** (`src/lib/actions/one-on-ones.ts`):
   - Tras INSERT, llamar `getValidAccessToken(leader_id)`.
   - Llamar `createCalendarEvent` con: summary `"1:1 con {colaborador}"`,
     description con link a la app, attendees `[leader.email,
     collaborator.email]`, modality, start/end ISO.
   - UPDATE en `one_on_ones` con `google_calendar_event_id` y `meet_link`.
   - Si la llamada falla, loggear pero NO fallar el insert (graceful degrade).
2. **Crear `cancelOneOnOne` con eventId**: ya existe el action; agregarle
   la llamada `deleteCalendarEvent`.
3. **Crear `rescheduleOneOnOne`** (acción nueva): UPDATE en `one_on_ones` +
   `updateCalendarEvent`.
4. **UI**:
   - Tras agendar, el detalle de la 1:1 muestra el botón "Unirse a Meet"
     que ya está cableado (lee `meet_link`).
   - Botón "Cancelar 1:1" / "Reagendar" en el detalle (no existen aún).

### Cómo verificar
1. Como Carolina (líder), ve a `/colaborador/1to1/nueva`. Agenda una 1:1
   virtual con Luis para mañana 10am.
2. Abre Google Calendar de Carolina → debe haber un evento "1:1 con Luis
   Hernández" mañana 10am con link Meet auto.
3. Luis (en otra cuenta) recibe la invitación en su calendario.
4. Cancela la 1:1 desde la app → el evento desaparece de Calendar.
5. Reagenda → el evento se mueve.

---

## Fase 3 — Slack: DMs, disputas, recordatorios

> **Bloqueante**: requiere Slack App configurada (Fase 0.3).

### A. Configuración externa
Ya hecha en 0.3. Verifica que el bot está en `SLACK_DEFAULT_CHANNEL`.

### B. Código a implementar
1. **Helper `lookupSlackUserByEmail(email)`** en `src/lib/slack/`: usa
   `users.lookupByEmail` de Slack API. Retorna slack_user_id.
2. **UI Integraciones → Slack**: botón "Conectar Slack" que llama un
   server action que (a) toma el email del user logueado, (b) lookupea
   en Slack, (c) UPDATE `users.slack_user_id`. Sin OAuth complejo —
   solo lookup por email del workspace.
3. **Modificar `submitVobo`** (`src/lib/actions/vobos.ts`): después del
   UPSERT, releer la 1:1 (el trigger SQL ya cambió el status). Si
   `status === 'en_disputa'`, llamar `notifyDispute` al `SLACK_DEFAULT_CHANNEL`.
4. **Cron nuevo `/api/cron/check-vobos-pendientes`**: lee 1:1s con
   `scheduled_at < now - 24h AND status = 'agendada' AND COUNT(vobos) < 2`,
   manda DM al participante que no ha confirmado. Schedule en
   `vercel.json`: cada 6h.
5. **Cron nuevo `/api/cron/meeting-reminders`**: 1:1s entre +55 min y
   +65 min, manda DM con el link Meet. Schedule: cada 5 min (Vercel hobby
   plan permite máx 1/día por cron, así que en hobby usa cada hora; en
   pro cada 5 min).

### Cómo verificar
1. En `/configuracion → Integraciones`, conecta Slack. Tu fila en `users`
   debe tener `slack_user_id` poblado (lo ves en Supabase Table Editor).
2. Para probar disputa: con Carolina marca "Sí se realizó", con Luis marca
   "No se realizó". Estado de la 1:1 cambia a `en_disputa`. Slack
   `#1to1-hr-alerts` recibe alerta.
3. Para probar recordatorio: agenda una 1:1 a +60min, espera o dispara el
   cron manualmente:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" \
     http://localhost:3000/api/cron/meeting-reminders
   ```

---

## Fase 4 — Email + crons completos

> **Bloqueante**: requiere Resend verificado (Fase 0.4).

### A. Configuración externa
Ya hecha en 0.4. Confirma que `RESEND_FROM_EMAIL` es del dominio verificado.

### B. Código a implementar
1. **Helper `sendEmail({to, subject, react})`** en `src/lib/email/send.ts`
   que use el client + render template + check graceful si no hay API key.
2. **Conectar `meeting-reminder.tsx`** al cron `meeting-reminders` de
   Fase 3 (paralelo al Slack DM, doble canal).
3. **Conectar `vobo-request.tsx`** al cron `check-vobos-pendientes`.
4. **Modificar `notify-due-agreements`** para que además del INSERT en
   notifications mande email al `responsible.email`.
5. **Notificación nueva al agendar 1:1**: cuando un líder agenda con un
   colaborador, mandar email al colaborador invitándolo + Slack DM. Hook
   en `scheduleOneOnOne` después del Calendar sync.

### Cómo verificar
1. Agenda una 1:1 → el colaborador recibe email + DM en Slack.
2. Crea un acuerdo con `due_date = mañana` → al día siguiente (o
   disparando el cron manual) el responsable recibe email + Slack.
3. 1:1 pasa sin VoBo → 24h después recibe DM + email "Confirma tu 1:1".

---

## Apéndice

### A. Variables de entorno completas (referencia)
```env
# Supabase (ya tienes)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PROJECT_REF=
SUPABASE_DB_PASSWORD=

# Admin seed (ya tienes)
ADMIN_EMAIL=
ADMIN_PASSWORD=
ADMIN_FULL_NAME=

# Google OAuth (Fase 0.1)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback

# Anthropic (ya tienes)
ANTHROPIC_API_KEY=

# App URL (ya tienes)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Slack (Fase 0.3)
SLACK_BOT_TOKEN=xoxb-...
SLACK_DEFAULT_CHANNEL=C01...

# Resend (Fase 0.4)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=no-reply@tu-dominio.com

# Vercel Cron (Fase 0.5)
CRON_SECRET=<openssl rand -hex 32>

# Demo
SEED_DEMO_DATA=true
```

### B. Checklist global (marca conforme avanzas)

- [ ] **0.1** Google Cloud: OAuth client creado, scopes habilitados, secrets en `.env.local`
- [ ] **0.2** Supabase: Google provider habilitado con scope `calendar.events`, redirect URLs OK
- [ ] **0.3** Slack: App creada, bot en canal HR, token en `.env.local`
- [ ] **0.4** Resend: dominio verificado, API key en `.env.local`
- [ ] **0.5** Vercel: env vars en Production + Preview (solo si deploy)
- [ ] **F1** Login con Google guarda `provider_token` en `users.google_calendar_token`
- [ ] **F1** UI Integraciones muestra "Google Calendar: Conectado" con datos reales
- [ ] **F2** Agendar 1:1 crea evento + Meet en Calendar de ambos participantes
- [ ] **F2** Cancelar 1:1 elimina evento de Calendar
- [ ] **F2** Reagendar 1:1 mueve evento de Calendar
- [ ] **F3** UI Integraciones conecta Slack del usuario via lookup por email
- [ ] **F3** Disputa de VoBo dispara alerta en `#1to1-hr-alerts`
- [ ] **F3** Cron de recordatorios manda DM 1h antes de 1:1
- [ ] **F3** Cron de VoBo pendiente manda DM 24h después
- [ ] **F4** Agendar 1:1 dispara email al colaborador
- [ ] **F4** Acuerdo por vencer manda email + DM
- [ ] **F4** VoBo pendiente manda email + DM

### C. Troubleshooting común

**"redirect_uri_mismatch" en Google login**
→ El URI en Google Cloud Credentials no coincide exactamente con el de
Supabase. Verifica que sea `https://<ref>.supabase.co/auth/v1/callback`
(sin slash final, https no http).

**Login con Google entra pero `provider_token` no se guarda**
→ Falta el scope `calendar.events` en Supabase Auth → Providers → Google →
Additional Scopes. Agrégalo, logout, login de nuevo.

**`createCalendarEvent` retorna 401 / 403**
→ Token expirado (1h) o sin scope. Verifica que `getValidAccessToken`
hace refresh y que el scope se solicitó al consent original. Solución
rápida: logout + re-login con `prompt: 'consent'`.

**Slack DM no llega**
→ El usuario no tiene `slack_user_id` poblado, o el bot no fue invitado al
canal/DM. Para DM directo el bot solo necesita el slack_user_id, no
invitación previa.

**Resend rebota emails**
→ Dominio no verificado o `RESEND_FROM_EMAIL` usa un dominio distinto al
verificado. Resend → Logs muestra el motivo exacto.

**Cron no se dispara en Vercel**
→ Plan Hobby tiene 1 cron por día por path. Si necesitas más frecuencia,
upgrade a Pro o consolida lógica en menos endpoints.

---

## Orden recomendado de ejecución

1. **HOY**: Fase 0 completa (0.1 → 0.5). Tiempo: ~1h.
2. **Día 1**: Fase 1 (código + verificación). ~3h.
3. **Día 2**: Fase 2. ~3h.
4. **Día 3**: Fase 3. ~3h.
5. **Día 4**: Fase 4. ~2-3h.

Cuando termines la Fase 0 me avisas con qué credenciales quedaron en
`.env.local` (sin pegar los secretos — solo "ya está GOOGLE_CLIENT_ID,
ya está SLACK_BOT_TOKEN, etc.") y arrancamos con la Fase 1.

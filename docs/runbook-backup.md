# Runbook — Backup y Restore de 1to1

> Qué datos existen, cómo respaldarlo todo, y cómo recuperarse ante un incidente de datos.
> Orientado a ejecutarse durante o después de un incidente — instrucciones directas, sin rodeos.

---

## Mapa de datos del sistema

### Fuente de verdad: Supabase (Postgres)

Toda la lógica de negocio y estado de la aplicación vive en Supabase:

| Schema / Tabla | Qué contiene | Criticidad |
|---|---|---|
| `auth.users` | Identidades de los ~400 usuarios (email, provider, metadata) | Alta |
| `public.users` | Perfil interno: nombre, rol, `slack_user_id`, `department_id` | Alta |
| `public.departments` | Estructura organizacional | Alta |
| `public.one_on_ones` | Reuniones 1:1 agendadas, realizadas, canceladas | Alta |
| `public.agreements` | Acuerdos comprometidos en cada 1:1, con VoBo tracking | Alta |
| `public.meeting_minutes` | Minutas capturadas durante el 1:1 | Alta |
| `public.cadences` | Configuración de frecuencia de reuniones por par líder-colaborador | Media |
| `public.warmth_records` | Registros de calidez evaluada en cada reunión | Media |
| `public.disputes` | Disputas abiertas por colaboradores | Media |
| `public.notification_rules` | Reglas de notificación configuradas por RH | Media |
| `public.notification_dispatches` | Log histórico de notificaciones enviadas | Baja |
| `public.scheduled_reports` | Configuración de reportes periódicos | Baja |
| `public.org_settings` | Configuraciones globales (umbrales, parámetros de cadencia) | Media |

### Datos fuera de Supabase (no aplica backup de DB)

| Dato | Dónde vive | Cómo hacer backup |
|---|---|---|
| Código fuente | GitHub `acalderonm-bdi/1_to_1` | Push frecuente + protección de rama `main` en GitHub |
| Archivos estáticos / assets | Vercel CDN (parte del build) | Están en el repo — se recuperan redeployando |
| Variables de entorno / secrets | Vercel Environment Variables + 1Password/Bitwarden | 1Password/Bitwarden es el backup. Exportar periódicamente. |
| Source maps de Sentry | Sentry (subidos en build) | Se regeneran en cada build — no requieren backup independiente |

---

## Backups automáticos de Supabase

### Por plan

| Plan Supabase | Frecuencia | Retención | Point-in-time recovery |
|---|---|---|---|
| Free | Diaria | 7 días | No |
| Pro | Diaria | 7 días | Sí (últimas 24-48h) |
| Team / Enterprise | Diaria | 30 días | Sí |

El proyecto `mlmpjeneeckfdyqavwgj` está actualmente en el plan que el equipo contrató. Verificar el plan actual en:

```
Supabase → Project Settings → Billing → Current plan
```

Los backups automáticos diarios corren aproximadamente a las 2am UTC.

---

## Cómo hacer backup manual de Supabase

### Opción A — Dashboard (recomendada para producción)

1. Ir a [supabase.com/dashboard](https://supabase.com/dashboard)
2. Seleccionar el proyecto `mlmpjeneeckfdyqavwgj`
3. Ir a **Settings → Database → Backups**
4. Ver la lista de backups disponibles con timestamp
5. Para descargar un backup: click en el ícono de descarga junto a la fecha deseada
   - El archivo descargado es un dump de Postgres en formato `.sql` o `.dump`

### Opción B — pg_dump directo (para exports de emergencia)

Requiere el `SUPABASE_DB_PASSWORD` de `.env.local`:

```bash
# Dump completo de la DB (sin schema auth — solo public)
pg_dump \
  "postgresql://postgres.mlmpjeneeckfdyqavwgj:[DB_PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres" \
  --schema=public \
  --no-owner \
  --no-acl \
  --format=custom \
  --file="backup-$(date +%Y%m%d-%H%M%S).dump"

# Para tablas críticas solamente (más rápido en emergencia)
pg_dump \
  "postgresql://postgres.mlmpjeneeckfdyqavwgj:[DB_PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres" \
  --schema=public \
  --table=users \
  --table=one_on_ones \
  --table=agreements \
  --table=meeting_minutes \
  --no-owner \
  --format=custom \
  --file="backup-critico-$(date +%Y%m%d-%H%M%S).dump"
```

### Opción C — Script de export vía REST API (emergencia sin psql)

Cuando no hay acceso directo a Postgres pero sí hay `SUPABASE_SERVICE_ROLE_KEY`:

```bash
#!/usr/bin/env bash
# scripts/emergency-export.sh
# Exporta tablas críticas via API REST de Supabase a archivos JSON.
# Uso: SUPABASE_URL=... SUPABASE_KEY=... bash scripts/emergency-export.sh

set -e

SUPABASE_URL="${SUPABASE_URL:?Falta SUPABASE_URL}"
SUPABASE_KEY="${SUPABASE_KEY:?Falta SUPABASE_KEY (service role)}"
OUTDIR="emergency-export-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUTDIR"

TABLES=(users departments one_on_ones agreements meeting_minutes cadences warmth_records disputes notification_rules org_settings)

for TABLE in "${TABLES[@]}"; do
  echo "Exportando $TABLE..."
  curl -sS \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Accept: application/json" \
    "${SUPABASE_URL}/rest/v1/${TABLE}?select=*" \
    -o "${OUTDIR}/${TABLE}.json"
  echo " -> ${OUTDIR}/${TABLE}.json"
done

echo "Export completo en: $OUTDIR/"
```

```bash
# Uso del script
export SUPABASE_URL="https://mlmpjeneeckfdyqavwgj.supabase.co"
export SUPABASE_KEY="<service_role_key>"
bash scripts/emergency-export.sh
```

Limitación: la API REST pagina resultados (por defecto 1000 filas). Para tablas grandes, agregar `?limit=10000` o hacer paginación con `Range` headers si hay más de 1000 registros.

---

## Cómo restaurar a un punto anterior

### Restaurar desde backup en Supabase Dashboard

1. Supabase → **Settings → Database → Backups**
2. Identificar el backup del punto deseado
3. Click en **Restore** junto al backup
4. Confirmar — **ADVERTENCIA**: esto sobrescribe la DB actual. No hay "undo" de un restore.
5. El restore puede tomar entre 5 y 30 minutos dependiendo del tamaño
6. Una vez completado, verificar que el schema coincide con el código desplegado:
   ```bash
   pnpm supabase migration list --linked
   ```
7. Si el restore es a un punto anterior a la última migration, re-aplicar migrations pendientes:
   ```bash
   pnpm supabase db push --linked
   ```
8. Verificar health check: `curl https://1to1.b-drive.com.mx/api/health`

### Restaurar desde dump manual (pg_dump)

```bash
# Restaurar un dump .dump (custom format)
pg_restore \
  --dbname="postgresql://postgres.mlmpjeneeckfdyqavwgj:[DB_PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres" \
  --schema=public \
  --no-owner \
  --clean \          # DROP antes de CREATE
  --if-exists \
  backup-20260610-090000.dump

# Verificar
psql "postgresql://postgres.mlmpjeneeckfdyqavwgj:[DB_PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres" \
  -c "SELECT count(*) FROM public.users;"
```

### Restaurar tablas individuales (restore parcial)

Si solo una tabla está corrupta y no querés sobrescribir toda la DB:

```bash
# Restaurar solo la tabla agreements desde el dump
pg_restore \
  --dbname="postgresql://..." \
  --table=agreements \
  --no-owner \
  --clean \
  --if-exists \
  backup-20260610-090000.dump
```

---

## RTO y RPO estimados

| Escenario | RPO (pérdida de datos máxima) | RTO (tiempo de recuperación) |
|---|---|---|
| Fallo de Vercel (sin cambios de datos) | 0 (datos en Supabase intactos) | 2–5 min (redeploy automático o promote en dashboard) |
| Bug en código que escribe datos incorrectos | Desde el último backup diario (hasta 24h) | 30–60 min (restore + redeploy) |
| Borrado accidental de tabla | Desde el último backup diario (hasta 24h) | 30–60 min (restore parcial) |
| Fallo de Supabase (downtime del servicio) | 0 (solo downtime, no pérdida) | Depende del SLA de Supabase (ver status.supabase.com) |
| Compromiso de service role key | Depende de cuándo se detecta | 30 min para rotar + verificar (ver runbook-token-rotation.md) |

**Con plan Supabase Pro (point-in-time recovery):** el RPO baja a ~5 minutos para incidentes detectados en las primeras 24–48h.

---

## Checklist de backup drill (ejecutar trimestralmente)

Esto simula un restore real en un ambiente de staging, no en producción:

- [ ] Ir a Supabase Dashboard → Backups → identificar backup de hace 48h
- [ ] Ejecutar script de emergency export en staging: `bash scripts/emergency-export.sh`
- [ ] Verificar que los JSON de export no están vacíos y tienen la cantidad esperada de registros
- [ ] Restaurar el backup en el proyecto staging (no en prod)
- [ ] Correr `pnpm supabase migration list --linked` contra staging — verificar que el schema coincide
- [ ] Hacer smoke test en staging: login → un 1:1 → acuerdo → historial
- [ ] Documentar el tiempo que tomó cada paso en `docs/backup-drill-log.md`
- [ ] Actualizar RTO/RPO en esta sección si los tiempos reales difieren

---

## Contactos en caso de incidente de datos

| Rol | Responsabilidad |
|---|---|
| Lead técnico (Ariel) | Único acceso al Supabase dashboard de prod — autoriza y ejecuta restores |
| Dev on-call | Diagnóstica el incidente, prepara el dump de emergencia si aplica |
| Arquitectura Humana (RH) | Informa si se detecta pérdida de datos de usuarios |

En caso de incidente, crear un reporte en `docs/incidents.md` con: fecha, causa raíz, alcance, acciones tomadas, y medidas preventivas.

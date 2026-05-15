# Plan de hardening 1to1 → B-Drive prod

> Plan consolidado para llevar el sistema 1to1 de estado actual (~75–80% prod-ready)
> a producción interna de B-Drive con confianza operacional.
>
> Estimado total: **12–14 días wall-clock** con paralelización agresiva tipo olas.

---

## Estado actual evaluado

**Lo que está bien:**
- Stack Next.js 14 + Supabase SSR + RLS + server actions bien aplicado
- Feature set ambicioso y entregado (cadencias, acuerdos, calidez, disputas, transfers, notif rules, IA)
- Multi-rol coherente (colaborador / líder / RH) con layouts segregados
- Identidad visual consistente (Warm SaaS coral)
- Slack integration funcional end-to-end (post-wires de mayo 2026)

**Lo que preocupa:**
1. **RLS no auditada sistemáticamente** — el bug C.4 (UPDATE policy faltante para líderes) se encontró por accidente. Probable que haya otros similar.
2. **Dispatcher de notificaciones incompleto** — `check-thresholds` solo escribe a `notification_dispatches` con `status='sent'` engañoso; no envía email ni Slack real para 4 de 6 triggers.
3. **`as never` regados por código** — `database.types.ts` desactualizado. Refactors silenciosos pueden romper en runtime.
4. **0 tests automatizados** — solo scripts QA manuales.
5. **Demo data en DB** — 13 users seed con `@demo.com`.
6. **Email no implementado** — `RESEND_API_KEY` definido pero sin wire.

---

## Fase 0 — Auditoría y spec (1–2 días)

Mapear todo antes de tocar nada.

| # | Tarea | Output |
|---|---|---|
| 0.1 | Auditar RLS vs server actions: por cada INSERT/UPDATE/DELETE en `src/lib/actions/*`, validar que existe policy correspondiente | `docs/rls-audit.md` |
| 0.2 | Inventariar dispatcher: por trigger_type × channel → ¿está cableado al delivery real? | `docs/notif-matrix.md` |
| 0.3 | Regenerar `database.types.ts` con `pnpm db:types`. Listar `as never` ya no necesarios | Diff + plan migración |
| 0.4 | Auditar otros usos de `currentPath` server-side en componentes client | Lista de archivos |

**Paralelizable:** sí, 4 sub-agentes independientes.

---

## Fase 1 — Seguridad y correctness crítica (3–5 días)

Cerrar los bugs invisibles antes de dejar entrar usuarios reales.

| # | Tarea | Acceptance |
|---|---|---|
| 1.1 | Aplicar policies RLS faltantes (migration única) | Cada server action probada escribe a DB realmente |
| 1.2 | Completar dispatcher: routear `channel='slack'` a helper Slack y `channel='email'` a Resend | Una regla con `channels=['slack','email']` entrega a ambos |
| 1.3 | Implementar `notifyByEmail` con Resend | Smoke test: email recibido |
| 1.4 | Wire de triggers pendientes (`acuerdo_vencido`, `vobo_pendiente`, `calidez_baja`, `reminder_pre_1to1`) con query real | Cada trigger dispara con data seeded |
| 1.5 | Auditoría de logs: 0 PII en logs (email/nombre completo/token) | grep limpio |

---

## Fase 2 — Data y migración (2–3 días)

| # | Tarea | Output |
|---|---|---|
| 2.1 | Connector al HR corporativo: cron sync horario | `src/lib/sync/corporate.ts` |
| 2.2 | Migration de limpieza de demo data | DELETE con dry-run preview |
| 2.3 | Smoke test del sync con DB corporativa | Reporte de matches |
| 2.4 | Script de rollback del sync | `scripts/sync-rollback.ts` |

---

## Fase 3 — Tests automatizados (3–4 días)

| # | Tarea | Cobertura mínima |
|---|---|---|
| 3.1 | Vitest + tests de server actions críticas | `scheduleOneOnOne`, `markNonRealization`, `dismissTransferBanner`, `markAgreementStatus`, `submitWarmth` |
| 3.2 | Playwright E2E golden path | Login → agendar → ejecutar → acuerdo → VoBo → historial |
| 3.3 | Playwright E2E flujos de error | Disputa, transfer líder, cadencia vencida, cancelación |
| 3.4 | CI GitHub Actions con `tsc -b` + `vitest` + `playwright` + lint | PR no mergea si rojo |
| 3.5 | Coverage mínimo 60% en `src/lib/actions/` | Reporte LCOV |

---

## Fase 4 — Type safety (2 días)

| # | Tarea | Output |
|---|---|---|
| 4.1 | Regenerar `database.types.ts` post-schema-sync | Diff revisado |
| 4.2 | Reemplazar `as never` por tipos reales | 0 ocurrencias en `src/` |
| 4.3 | Pre-commit hook: falla si `database.types.ts` desactualizado | `.husky/pre-commit` |
| 4.4 | Eliminar `database.augmentation.ts` | Archivo borrado |

---

## Fase 5 — Operational readiness (2–3 días)

| # | Tarea | Output |
|---|---|---|
| 5.1 | `vercel.json` con 4 cron jobs | Cron visible en dashboard |
| 5.2 | Integrar Sentry (errors + perf) | Dashboard con errores |
| 5.3 | Staging environment (Supabase + Vercel duplicado) | `1to1-staging.b-drive.com.mx` |
| 5.4 | Deploy pipeline main → staging → manual promote → prod | `docs/DEPLOY.md` |
| 5.5 | Backup/restore drill | Doc con timing real |
| 5.6 | Token rotation playbook | `docs/runbook-rotation.md` |
| 5.7 | Health check `/api/health` | 200 si DB + Slack OK |

---

## Fase 6 — Polish (1–2 días)

| # | Tarea | Output |
|---|---|---|
| 6.1 | Performance audit (queries con EXPLAIN, índices) | Lista de índices faltantes |
| 6.2 | Bundle size audit (`next build --profile`) | Reporte + decisión tree-shake |
| 6.3 | Accesibilidad con axe-core en 5 rutas principales | 0 errores serios |
| 6.4 | i18n placeholder structure | Inventario, no traducción |
| 6.5 | README decente | `README.md` |
| 6.6 | Diagrama de arquitectura | `docs/architecture.png` |
| 6.7 | Audit PII en UI por rol | Test E2E |

---

## Fase 7 — Notificaciones 100% usables (3–4 días)

**Objetivo:** que los usuarios quieran recibir las notificaciones, no solo las toleren.

### Principios rectores
1. Right person, right channel, right time — sin duplicación
2. Accionables, no solo informativas
3. Controlables por destinatario (opt-out granular)
4. Observables por RH (health dashboard real)

### 7.A — Preferencias del usuario (1 día)
- Tabla `notification_preferences` (user, channel, trigger, enabled, quiet_hours)
- Tabla `notification_digest_settings` (mode: realtime/daily/weekly)
- UI `/colaborador/configuracion/notificaciones` y para líderes
- Defaults sensatos via migration

### 7.B — Templates ricos y accionables (1 día)
- Slack Block Kit (no plain text)
- Action buttons: "Agendar ahora", "Posponer 1 sem", "Marcar no realizada"
- Endpoint `/api/slack/interactions` para click handlers
- Email HTML branded con unsubscribe link
- Variables personalizadas y locales en `src/lib/notifications/locales/es.ts`

### 7.C — Smart dispatch (0.5 día)
- Dedupe: agrupar eventos del mismo user en un mensaje
- Cooldown contextual con backoff exponencial (día 1, 3, 7, 14)
- Channel fallback: si Slack falla → email
- Honor quiet hours: encolar en `notification_queue` con `deliver_after`
- Cron `/api/cron/drain-notification-queue` hourly

### 7.D — Digest mode (0.5 día)
- Modo `daily`/`weekly` acumula en queue
- Job `/api/cron/send-digests` con respect de timezone del user
- Template con lista agrupada y "ver más en la app"

### 7.E — Test mode para RH (0.5 día)
- Botón "Vista previa" en cada regla (modal con render exacto)
- Botón "Disparar test (solo a mí)"
- Dry-run mode en cron con `?dry_run=true`
- Stats por regla: última vez, destinatarios, delivery rate

### 7.F — Observabilidad (0.5 día)
- `notification_dispatches` con `delivered_at`, `failed_reason`, `clicked_at`, `opened_at`
- Webhook Slack delivery events → `/api/slack/events`
- Webhook Resend email events → `/api/email/events`
- Dashboard `/arquitectura-humana/notificaciones/salud`
- Alerta self-monitoring si delivery rate < 95%

### 7.G — Edge cases (0.5 día)
- Sin `slack_user_id` → fallback email silent
- User dado de baja → cancelar notifs pendientes
- Workspace Slack offline → exponential backoff hasta 24h
- Link a recurso eliminado → landing graceful, no 500
- Unique index para evitar doble dispatch por race

---

## Orden recomendado de ejecución (con olas)

| Ola | Contenido | Tiempo |
|---|---|---|
| Ola 0 | Fase 0 completa con 4 sub-agentes en paralelo | 1 día |
| Ola 1 (big bang) | Fases 1.1 (RLS) + 1.2-1.4 (dispatcher con Fase 7.A+7.B+7.C juntas) + 1.5 (logs) | 2–3 días |
| Ola 2 | Fase 2 (data) + Fase 4 (types) + Fase 5.2/5.3/5.6 (ops) en paralelo | 2 días |
| Ola 3 | Fase 3 (tests) en paralelo | 2 días |
| Ola 4 (polish) | Fases 5 restantes + Fase 6 + Fase 7.D/E/F/G | 2 días |
| Ola 5 (validación) | L1–L7 zero-error review chain antes de prod | 1 día |

**Total wall-clock: ~12–14 días.**

---

## Acceptance final para "prod-ready"

- [ ] 0 server actions con `success:true` y DB no escrita (RLS audit completo)
- [ ] Cada `notification_rules.channels` entregable → dispatcher real cubre todos los triggers
- [ ] Cobertura de tests ≥ 60% en `src/lib/actions/`, CI bloqueante
- [ ] 0 `as never` en `src/`
- [ ] 0 demo users en DB de prod
- [ ] Email HTML y Slack Block Kit funcionando, opt-out respetado, digest mode probado
- [ ] Dashboard de delivery health con delivery rate >95%
- [ ] Health check /api/health responde 200 con DB + Slack OK
- [ ] Staging environment probado con un flujo end-to-end completo
- [ ] Playbook de rotación de tokens documentado
- [ ] README + diagrama de arquitectura entregables a un dev nuevo

---

_Última actualización: 15 de mayo 2026_

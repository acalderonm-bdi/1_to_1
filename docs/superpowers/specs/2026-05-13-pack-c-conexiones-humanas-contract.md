# Pack C — Contrato esperado de Conexiones Humanas

**Status:** outline / waiting on external spec
**Bloquea implementación de:** F3 (sync de estructura) — todo lo demás de Pack A + B ya está merged.

## Lo que necesitamos del lado de Conexiones Humanas

### Datos requeridos por colaborador

| Campo | Tipo | Notas |
|---|---|---|
| `employee_id` | string | identificador estable propio de CH |
| `email` | string | matching con `users.email` |
| `full_name` | string | |
| `department_name` o `department_id` | string | matching contra `departments.name` |
| `leader_email` | string | matching con `users.email` del líder |
| `effective_date` | date | cuándo aplica el cambio |
| `status` | enum `'active' / 'inactive'` | bajas también |

### Métodos de transferencia (a definir con su equipo)

- **Opción A — CSV/Excel manual.** Carga periódica desde un dashboard de AH. Más simple. Riesgo: latencia humana.
- **Opción B — REST endpoint.** Consultamos su API en un cron. Necesita auth + rate limiting.
- **Opción C — Webhook.** Ellos disparan cuando hay cambio. Real-time pero requiere infra de su lado.
- **Opción D — DB replica / vista compartida.** Acceso read-only directo a su base. Máximo acoplamiento.

Recomendación técnica preliminar: **A** para el piloto, **B** para producción cuando estabilice.

## Lo que dispara automáticamente este lado cuando se aplica un cambio

1. Cerrar `leadership_relations` activa con `ended_at = effective_date`.
2. Crear nueva `leadership_relations` con `started_at = effective_date`.
3. Notificación in-app + email a:
   - **Nuevo líder:** "heredaste N colaboradores".
   - **Líder anterior:** "ya no tenés a X en tu equipo".
   - **Colaborador:** "tu nuevo líder es Y".
4. F4 banner se activa automáticamente en el primer login del nuevo líder con ese colaborador.
5. Trigger `auto_dismiss_transfer_banner` (ya implementado) maneja el dismiss automático al primer VoBo.

## Decisiones pendientes con su equipo

- [ ] **Método de transferencia** (A / B / C / D)
- [ ] **Frecuencia** (diario / on-demand / event-driven)
- [ ] **Reconciliación inicial:** ¿hay un dump histórico para alinear estado base?
- [ ] **Edge cases:**
  - ¿Qué pasa si un líder se va de la empresa pero sus colaboradores no se reasignan automáticamente?
  - ¿Cómo se manejan colaboradores en transición (status temporal "en cambio")?
- [ ] **Notificaciones de baja:** ¿quién recibe las notificaciones de baja completa (`status='inactive'`)?
- [ ] **Conflictos de matching:** si `email` no calza con `users.email` existente, ¿bloqueamos el sync o creamos usuario?

## Componentes a construir cuando llegue el spec definitivo

```
src/lib/sync/conexiones-humanas/
├── parser.ts     — lee CSV/JSON/API según formato
├── differ.ts     — compara contra estado actual, produce diff (create / update / terminate)
└── applier.ts    — aplica diffs en transacción

src/app/api/admin/sync-org/route.ts        — endpoint manual, requiere role 'hr'
src/app/api/cron/sync-org/route.ts         — opcional, ejecución programada
src/app/(dashboard)/arquitectura-humana/estructura/page.tsx — botón "Sincronizar desde Conexiones Humanas" + preview de diff + "Aplicar"
```

## Cuando se resuelvan estas decisiones, expandir este doc a spec ejecutable y crear plan correspondiente.

## Stakeholders sugeridos

- Líder técnico de Conexiones Humanas (definir formato del payload)
- AH del lado del cliente (validar lógica de notificaciones y edge cases)
- Ariel Calderón (Track A) para la integración del lado 1to1

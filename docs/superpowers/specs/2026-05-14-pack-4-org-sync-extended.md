# Pack 4 — Sincronización organizacional con Conexiones Humanas (extendido)

**Status:** outline / waiting on external spec
**Referencia:** `docs/superpowers/specs/2026-05-13-pack-c-conexiones-humanas-contract.md`

## Recap del contrato original

Conexiones Humanas debe entregar, por colaborador, un row con 7 campos:

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `employee_id` | string | ID externo estable del colaborador (clave de reconciliación primaria) |
| `email` | string | Correo corporativo — clave secundaria si no hay match por `employee_id` |
| `full_name` | string | Nombre completo actual del colaborador |
| `department_name` / `department_id` | string | Departamento actual. `department_id` cuando exista catálogo compartido; `department_name` como fallback con auto-creación |
| `leader_email` | string | Correo del líder directo actual (puede ser nulo si está vacante) |
| `effective_date` | ISO date | Fecha desde la cual el row es válido — clave para reconciliar cambios mid-cycle |
| `status` | enum (`active` / `on_leave` / `terminated`) | Estado del colaborador en Conexiones Humanas |

## Flujo de import propuesto

1. **Upload manual o API trigger:**
   - AH sube un CSV en `/arquitectura-humana/sincronizacion`
   - O un endpoint REST `/api/admin/sync-org` recibe payload de Conexiones Humanas

2. **Preview diff (UI):**
   - Sistema parsea y compara contra estado actual
   - Muestra tabla con 4 columnas: action (create / update_leader / update_dept / terminate), employee, before, after
   - Cada fila es seleccionable — AH puede deseleccionar antes de aplicar

3. **Confirmación + apply:**
   - Botón "Aplicar N cambios" — confirma con modal de impacto
   - Transacción: aplica todos los cambios atomicamente
   - Si falla algún cambio, rollback completo

4. **Notificaciones automáticas:**
   - Al nuevo líder: "Heredaste a [Nombre], con N acuerdos abiertos"
   - Al líder anterior: "[Nombre] ya no está en tu equipo"
   - Al colaborador: "Tu nuevo líder es [Nombre]"

5. **Auditoría:**
   - Cada cambio se registra en `audit_logs` con `actor_id = HR_user`, `action = 'org_sync_apply'`, metadata con diff completo

## Bulk reassign manual (alternativa sin spec externo)

Decisión del brainstorm: outline only. La capacidad existe pero no se implementa en este round.

Si en el futuro AH necesita hacer cambios masivos sin Conexiones Humanas:
- UI en `/arquitectura-humana/usuarios` con multi-select + acción "Cambiar líder de N usuarios"
- Server action `bulkReassignLeader(userIds[], newLeaderId)` con transacción
- Mismas notificaciones que el flujo automático

## Componentes a construir cuando llegue spec definitivo

```
src/lib/sync/conexiones-humanas/
├── parser.ts     — lee CSV/JSON/API según formato
├── differ.ts     — compara contra estado actual, produce diff
└── applier.ts    — aplica diffs en transacción

src/app/api/admin/sync-org/route.ts        — endpoint manual, requiere requireHR()
src/app/(dashboard)/arquitectura-humana/sincronizacion/page.tsx — reemplaza placeholder con flujo real
src/components/arquitectura-humana/sync-diff-preview.tsx
src/components/arquitectura-humana/sync-upload-form.tsx
```

## Pre-condiciones de Conexiones Humanas

- [ ] Confirmar formato del payload (CSV / JSON / endpoint REST)
- [ ] Definir frecuencia (manual / diaria / event-driven)
- [ ] Reconciliación inicial: dump histórico para alinear estado base
- [ ] Edge cases: bajas, transferencias mid-cycle, líder ausente

## Cuando se resuelvan estas decisiones, expandir este doc a spec ejecutable.

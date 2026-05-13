# Page Map — Mejoras 1to1 Pack A + B

Mapa de archivos por feature para las olas posteriores a Phase A (Schema migrations).
Sirve como referencia de qué tocar en cada Phase de implementación.

## F2 — Justificación
- src/lib/actions/one-on-ones.ts (modify: add markNonRealization)
- src/components/one-on-one/meeting-card.tsx (modify: add CTA)
- src/components/one-on-one/non-realization-modal.tsx (NEW)
- src/app/(dashboard)/colaborador/1to1/[id]/page.tsx (modify: show motivo block)
- src/app/(dashboard)/lider/1to1/[id]/page.tsx (modify: show motivo block)

## F4 — Histórico
- src/lib/actions/one-on-ones.ts (modify: add dismissTransferBanner)
- src/components/shared/transfer-banner.tsx (NEW)
- src/components/one-on-one/agreement-list.tsx (modify: transferred badge)
- src/app/(dashboard)/lider/colaborador/[id]/page.tsx (modify: banner + open agreements section)
- src/app/(dashboard)/arquitectura-humana/usuarios/[id]/page.tsx (modify: same section)

## F1 — Lineamientos
- src/lib/agreement-quality.ts (NEW)
- src/lib/actions/agreements.ts (modify: persist quality on save)
- src/app/api/ai/agreement-quality/route.ts (NEW)
- src/components/one-on-one/minute-editor.tsx (modify: inline warnings)
- src/components/one-on-one/agreement-list.tsx (modify: quality badge)
- src/app/(dashboard)/arquitectura-humana/reportes/page.tsx (modify: low-quality card)

## F5 — Enfoque
- src/content/guia-1to1.md (NEW)
- src/components/one-on-one/focus-guidance.tsx (NEW)
- src/components/one-on-one/meeting-form.tsx (modify: embed component)

## F6 — Calidez
- src/lib/actions/warmth.ts (NEW)
- src/lib/actions/vobos.ts (modify: gate by warmth)
- src/components/one-on-one/warmth-survey.tsx (NEW)
- src/components/one-on-one/minute-editor.tsx (modify: embed survey)
- src/components/arquitectura-humana/warmth-heatmap.tsx (NEW)
- src/app/(dashboard)/lider/configuracion/page.tsx (modify: trend chart)
- src/app/(dashboard)/arquitectura-humana/mapa-calor/page.tsx (modify: heatmap widget)

## Findings de greps iniciales

### `grep -rln "non_realization\|no_realizada" src/`
```
src/lib/constants.ts
src/lib/actions/disputes.ts
src/lib/actions/one-on-ones.ts
src/types/domain.ts
src/types/database.types.ts
src/app/api/ai/analyze-patterns/route.ts
src/app/(dashboard)/arquitectura-humana/page.tsx
src/app/(dashboard)/arquitectura-humana/usuarios/[id]/page.tsx
src/app/(dashboard)/colaborador/historial/page.tsx
src/app/(dashboard)/colaborador/1to1/[id]/page.tsx
```

### `grep -rln "leadership_relations" src/`
```
src/lib/actions/users.ts
src/types/domain.ts
src/types/database.types.ts
src/app/api/ai/analyze-patterns/route.ts
src/app/api/cron/check-cadence/route.ts
src/app/(dashboard)/arquitectura-humana/estructura/page.tsx
src/app/(dashboard)/arquitectura-humana/usuarios/[id]/page.tsx
src/app/(dashboard)/colaborador/1to1/nueva/page.tsx
src/app/(dashboard)/lider/page.tsx
src/app/(dashboard)/lider/colaborador/[id]/page.tsx
```

### `grep -rln "meeting-form\|meeting-card\|minute-editor\|agreement-list" src/`
```
src/app/(dashboard)/colaborador/1to1/nueva/page.tsx
src/components/one-on-one/detail-interaction.tsx
```

### Observaciones
- Los nombres canónicos `meeting-form.tsx`, `meeting-card.tsx`, `minute-editor.tsx`, `agreement-list.tsx` del plan **aún no existen como archivos separados**; la lógica vive embebida en `src/components/one-on-one/detail-interaction.tsx` y en la página `colaborador/1to1/nueva/page.tsx`. Las olas posteriores deberán decidir si crearlos como split o continuar dentro de los archivos actuales. El page-map del plan los lista como destinos lógicos, no como rutas inmutables.
- `src/lib/constants.ts` ya contiene mapeos para los valores actuales del enum `non_realization_reason`. Al extender el enum en migration 7a habrá que ampliar los labels en F2 Phase B.
- `src/types/database.types.ts` es auto-generado por `pnpm db:types`. Phase A no lo modifica; en su lugar se crea `src/types/database.augmentation.ts` si la regeneración falla.

## C3 — Findings de cross-feature review (Phase C polish)

Auditoría posterior a la integración Pack A + B, sin cambios funcionales más allá de los fixes C1 (quality enrichment en `minutes.ts`) y C2 (mover `WarmthSurvey` a `detail-interaction.tsx`).

### Residue grep
`grep -rEn "TODO|FIXME|XXX"` sobre los directorios tocados por Pack A+B: **0 hits**. No quedaron guardarriles ni marcadores temporales.

### Import sanity
Cada archivo nuevo tiene al menos un consumidor real:
- `agreement-quality.ts` → `lib/actions/agreements.ts`, `lib/actions/minutes.ts`, `components/one-on-one/agreement-list.tsx`.
- `non-realization-modal.tsx` → `components/one-on-one/meeting-card.tsx` (componente), `colaborador/1to1/[id]/page.tsx`, `lider/1to1/[id]/page.tsx` (helper `labelForReason`).
- `transfer-banner.tsx` → `lider/colaborador/[id]/page.tsx`.
- `warmth-survey.tsx` → `components/one-on-one/detail-interaction.tsx` (movido en C2).
- `focus-guidance.tsx` → `components/one-on-one/meeting-form.tsx`.
- `lib/actions/warmth.ts` → `components/one-on-one/warmth-survey.tsx`.

### `as never` audit
Todos los casts están acotados a tablas/columnas/vistas nuevas que aún no aparecen en `database.types.ts` regenerado:
- Columnas `ai_quality_score`/`ai_quality_warnings` (F1) — 2 hits (`agreements.ts`, `minutes.ts`).
- Tabla `meeting_warmth_responses` (F6) — 4 hits (`warmth.ts`, `colaborador/.../page.tsx`, `vobos.ts`).
- Vistas `warmth_metrics_by_*` y `warmth_trend_by_leader_month` (F6) — 6 hits en `mapa-calor/page.tsx`, `lider/configuracion/page.tsx`.
- Vista `open_agreements_by_collaborator` (F4) — 4 hits en `lider/colaborador/.../page.tsx`, `arquitectura-humana/usuarios/.../page.tsx`.
- Columna `transfer_banner_dismissed_at` (F4) en `leadership_relations` — 2 hits en `one-on-ones.ts`.
- Filtros sobre `reportes/page.tsx` con `ai_quality_score` — 2 hits.

Ningún `as never` quedó fuera del scope de los cambios. **Acción de seguimiento sugerida (no bloqueante):** correr `pnpm db:types` cuando el remote refleje las migraciones de Pack A para que `database.types.ts` los conozca y se puedan eliminar todos los casts en una pasada futura.

### Augmentation types
Definidos en `src/types/database.augmentation.ts` y re-exportados desde `domain.ts`:
- `OpenAgreementByCollaborator` — usado como anotación de tipo en `lider/colaborador/[id]/page.tsx` y `arquitectura-humana/usuarios/[id]/page.tsx`.
- `MeetingWarmthResponse`, `WarmthMetricsByLeader`, `WarmthTrendByLeaderMonth` — exportados pero todavía no usados como anotaciones (las páginas que consumen las vistas usan inline `as unknown as { ... }`). **No bloqueante**; los tipos siguen siendo el contrato y deberían reemplazar los inlines en una limpieza posterior.

### Fixes aplicados en C
- **C1** — `minutes.ts` ahora aplica `checkAgreementQuality()` también a los acuerdos extraídos por IA, evitando N+1 vía pre-cómputo de `open_count` por responsable único.
- **C2** — `WarmthSurvey` se renderiza en `detail-interaction.tsx` justo antes de `VoboButton`, en lugar de dentro del editor de minuta. El `VoboButton` se oculta hasta que la encuesta se entrega (UX) y `submitVobo` sigue gateando en server (defensa en profundidad).
- **C4** — `focus-guidance.tsx` ahora cierra con `Escape` (a11y).

### Observaciones para futuras olas
- Los props `isCollaborator` y `meetingStatus` de `MinuteEditor` quedaron como hint contextual aunque no se usen internamente tras C2; pueden eliminarse en un refactor menor (o conservarse para futuras señales en el editor).
- `submitVobo` valida warmth solo cuando el caller es el colaborador (esperado), pero conviene cubrir con tests de integración el caso "colaborador intenta VoBo sin warmth" para garantizar el toast de error.

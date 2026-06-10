# Types Audit

## Diff schema (nuevo vs actual)

### Tabla nueva: `notification_preferences`

La tabla `notification_preferences` existe en el schema remoto pero **no estaba en `database.types.ts`**:

```
notification_preferences {
  Row: {
    channel: string          -- NOT NULL
    created_at: string       -- NOT NULL, default now()
    enabled: boolean         -- NOT NULL, default true
    id: string               -- NOT NULL, uuid PK
    trigger_type: string     -- NOT NULL
    updated_at: string       -- NOT NULL, default now()
    user_id: string          -- NOT NULL, FK → users.id
  }
}
```

### Schema `graphql_public` eliminado

El archivo anterior incluía el schema `graphql_public` completo (con su función `graphql` y los bloques `[_ in never]: never` vacíos). El nuevo archivo generado **no incluye ese schema** — Supabase ya no lo expone en la generación de tipos cuando no hay customizaciones en él.

Impacto: si algún código usaba `Database["graphql_public"]` directamente, fallará. Una búsqueda en `src/` no encontró ninguna referencia a ese schema.

### `Constants` — bloque `graphql_public` eliminado

El archivo actual tiene:
```ts
export const Constants = {
  graphql_public: { Enums: {} },
  public: { ... }
}
```
El nuevo tiene solo `public: { ... }`. Ningún código en `src/` referencia `Constants.graphql_public`, por lo que no hay impacto.

### Sin cambios en tablas existentes

Todas las demás tablas, vistas, funciones y enums son **idénticos** en ambas versiones:
- `agenda_items`, `agreement_followups`, `agreements`, `ai_reports`, `audit_logs`, `cadence_configs`, `departments`, `leadership_relations`, `meeting_warmth_responses`, `minutes`, `notification_dispatches`, `notification_rules`, `notifications`, `one_on_ones`, `org_settings`, `scheduled_reports`, `users`, `vobos` — sin cambios.
- Vistas: `compliance_metrics`, `open_agreements_by_collaborator`, `pending_alerts`, `warmth_metrics_by_department`, `warmth_metrics_by_leader`, `warmth_trend_by_leader_month` — sin cambios.
- Funciones: `is_hr`, `is_leader_of`, `is_participant`, `refresh_pending_alerts` — sin cambios.
- Enums: todos idénticos.

---

## `as never` encontrados

**No se encontró ningún `as never` en `src/`.**

```
grep -rn "as never" /home/admin/1_to_1/src/
# → No matches found
```

Los `[_ in never]: never` que aparecen en `database.types.ts` son parte del código generado por Supabase CLI (marcadores de placeholder para schemas/tipos vacíos), no son casts manuales del código de la aplicación. No hay nada que limpiar.

| Archivo:línea | Contexto | ¿Necesario con nuevo schema? | Acción recomendada |
|---------------|----------|------------------------------|-------------------|
| — | No se encontraron `as never` en `src/` | N/A | Ninguna acción requerida |

---

## Plan de migración

### Paso 1 — Reemplazar `database.types.ts` (ya realizado)

`src/types/database.types.ts` fue sobrescrito con el contenido de `/tmp/new_types.ts` generado por Supabase CLI. El archivo es válido (contiene al menos una tabla definida).

Cambios netos en el archivo de tipos:
- **Añadido**: tabla `notification_preferences` con sus tipos `Row`, `Insert`, `Update` y `Relationships`.
- **Eliminado**: schema `graphql_public` y su entrada en `Constants` (no había código que lo usara).

### Paso 2 — Aprovechar `notification_preferences` en la aplicación

La tabla existía en DB pero no estaba tipada, lo que significa que cualquier query a esa tabla usaba tipos `any` o workarounds. Ahora que está tipada:

1. Buscar cualquier query a `notification_preferences` en `src/`:
   ```bash
   grep -rn "notification_preferences" /home/admin/1_to_1/src/
   ```
2. Reemplazar los tipos explícitos o casts manuales por `Tables<"notification_preferences">`, `TablesInsert<"notification_preferences">`, etc.

### Paso 3 — Verificar compilación

```bash
cd /home/admin/1_to_1 && npx tsc --noEmit
```

No se esperan errores derivados de este cambio (los schemas eliminados no se usaban), pero conviene confirmar.

### Paso 4 — (Opcional) Configurar regeneración automática

Para mantener los tipos sincronizados agregar al `package.json`:
```json
"types:gen": "SUPABASE_ACCESS_TOKEN=... supabase gen types typescript --project-id mlmpjeneeckfdyqavwgj > src/types/database.types.ts"
```

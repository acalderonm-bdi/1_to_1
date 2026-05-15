# Auditoría de estado layout server-side

> Auditoría Ola 0.4 — buscar otros bugs del patrón `currentPath` stale en navegación client-side.

## Resumen

- **Bugs críticos activos**: 0
- **Patrón mejorable**: 1 (Sidebar recibe prop en lugar de hook, pero el prop viene de `usePathname` reactivo)
- **Componentes con riesgo de stale state**: 0
- **Usos de `currentPath` prop**: 2 (todos ya cubiertos por `usePathname()` upstream)
- **`headers().get('x-pathname')` calls**: 1 (en layout server, usado como fallback)

## Estado actual del fix breadcrumb (commit c96038a)

El patrón correcto ya está implementado:

1. **`AppShell`** (client component) — `src/components/layout/app-shell.tsx:44`
   - Usa `const pathname = usePathname() ?? currentPath`
   - `currentPath` viene del server como fallback para el primer render antes de hidratación
   - `activePath = pathname` se propaga a `Sidebar` y `Header`

2. **`Sidebar`** (client component) — recibe `currentPath={activePath}` dinámico
   - Como AppShell pasa `activePath` (que es reactivo), el sidebar también actualiza
   - `isNavItemActive(item, currentPath)` re-evalúa en cada nav

3. **`Header`** (client component) — recibe `breadcrumbs={breadcrumbsFor(role, activePath)}`
   - Recalculado dinámicamente con cada cambio de path

## Bugs latentes encontrados

**Ninguno crítico activo.**

### Riesgo residual

**Patrón mejorable** (no es bug, es brittleness): `Sidebar` recibe `currentPath` como prop en lugar de leerlo directo con `usePathname()` internamente. Hoy funciona porque AppShell lo pasa reactivo, pero si alguien agrega otro componente nuevo que use el mismo patrón (recibir `currentPath` desde un layout server), el bug reaparece.

**Mitigación recomendada (no urgente):**
- Refactor `Sidebar` y `Header` para usar `usePathname()` directamente (ambos ya son `'use client'`, no requiere cambio de boundary)
- Hacer el prop `currentPath` opcional o eliminarlo
- AppShell solo pasaría datos no derivables del path (role, userId, etc.)

## Inventario completo

| Archivo | Línea | Patrón | Estado |
|---|---|---|---|
| `src/app/(dashboard)/layout.tsx` | 20-21 | `headers().get('x-pathname') ?? '/'` para `currentPath` | ✓ Correcto como fallback |
| `src/components/layout/app-shell.tsx` | 41-44 | `usePathname() ?? currentPath` | ✓ Patrón correcto |
| `src/components/layout/app-shell.tsx` | 126,131 | Pasa `activePath` a Sidebar+Header | ✓ Correcto (reactivo) |
| `src/components/layout/sidebar.tsx` | 24,64 | Recibe `currentPath` prop, computa `isActive` | ✓ Funciona (mejorable) |
| `src/components/layout/header.tsx` | 31 | Recibe `breadcrumbs` prop calculado | ✓ Funciona |
| `src/middleware.ts` | 7 | Setea header `x-pathname` | ✓ Correcto |

## Otros patrones de stale state buscados (no encontrados)

- ❌ Componentes con `data-active` derivado de prop server (solo Sidebar, y ya está cubierto)
- ❌ `useEffect` que escucha `pathname` pero rompe en SSR
- ❌ Theme/lang/role props que deberían venir de context (todos esos vienen reactivos o de DB, no del path)
- ❌ Tabs/breadcrumbs duplicados (solo el header tiene breadcrumb, y ya fixed)

## Patrones de mitigación recomendados (para nuevos componentes)

1. **Para path**: siempre `usePathname()` en client components. Evitar pasar `currentPath` desde layouts server a client components nuevos.
2. **Para data que cambia**: `revalidatePath` + RSC, no props server pasados a client.
3. **Para theme/locale**: contexts client (`createContext`), no props server.
4. **Para role/userId**: viene de auth, una sola vez por sesión — props server son válidas porque no cambian en navegación.

## Conclusión

El bug del breadcrumb fue un caso aislado del patrón "prop server pasado a componente client que renderiza estado basado en path". La fix de commit `c96038a` lo resolvió correctamente. No hay otros componentes con el mismo bug.

**Acción recomendada**: ninguna urgente. Si en Fase 6 (polish) hay slot, refactorear Sidebar/Header para usar `usePathname()` directo y eliminar la dependencia del prop. Es brittleness, no bug.

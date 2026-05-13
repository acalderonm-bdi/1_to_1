# Fusión Template_User_Management → 1to1 — Design Spec

**Fecha:** 2026-05-13
**Autor:** Ariel Calderón
**Estado:** Aprobado (brainstorm) — pendiente plan de implementación

## Objetivo

Aplicar la identidad visual y la arquitectura de UI del template `xgael/Template_User_Management` (Vite + React 19 + Tailwind v4) al sistema productivo `1to1` (Next.js 14 + Supabase + Tailwind v3), preservando el stack actual y reescribiendo la capa visual de las ~30 páginas existentes.

## No-objetivos

- **No migrar el stack** de 1to1 a Vite + Express.
- **No reemplazar Supabase auth/SSR** ni los API routes de Next (`/api/ai/*`, `/api/cron/*`, `/api/auth/callback`).
- **No introducir** Zustand, react-router-dom, GSAP, Lenis, ApexCharts ni @dnd-kit.
- **No upgradear** Tailwind v3 → v4 (los tokens del `@theme` se backportean a CSS vars HSL compatibles con la config actual).

## Decisiones de stack

| Capa | Decisión |
|---|---|
| Framework | Next.js 14 App Router (sin cambios) |
| Auth/DB | Supabase SSR (sin cambios) |
| CSS engine | Tailwind v3 (sin cambios) |
| Component lib | shadcn/ui — se mantiene; restyle vía CSS vars |
| Tipografía | **Inter → Montserrat** (vía `next/font/google`); Source Serif 4 y JetBrains Mono se conservan como secundarias opcionales |
| Charts | Recharts (sin cambios; ApexCharts no entra) |
| Animaciones | Solo transiciones CSS de Tailwind (sin GSAP/Lenis) |
| State server | Mantener convenciones actuales (server components + Supabase) |
| Toasts/Modals | Portar `Toaster` y `ConfirmModal` del template |

## Design tokens

Reescritura de `src/app/globals.css`: las HSL vars que ya consume shadcn se redefinen a la paleta del template. Tailwind config no se toca.

```
/* Light */
--background:        36 33% 98%   /* #FBF9F7 */
--foreground:        0 0% 29%     /* #4A4A4A */
--card:              0 0% 100%
--card-foreground:   0 0% 29%
--primary:           16 84% 56%   /* #ED6134 */
--primary-foreground:0 0% 100%
--secondary:         41 89% 60%   /* #F4BB41 */
--secondary-foreground: 0 0% 10%
--muted:             30 14% 95%   /* #F5F2EF */
--muted-foreground:  30 4% 51%    /* #8A8580 */
--accent:            22 95% 95%   /* #FEF3ED */
--accent-foreground: 16 84% 56%
--destructive:       16 84% 56%   /* #ED6134 (usa primary como danger, como el template) */
--success:           96 38% 62%   /* #98C37A */
--warning:           41 89% 60%
--border:            33 13% 89%   /* #E8E4DF */
--input:             33 13% 89%
--ring:              16 84% 56%
--radius:            0.5rem

/* Sidebar/Navbar */
--sidebar-bg:               0 0% 100%
--sidebar-fg:               0 0% 29%
--sidebar-border:           33 13% 89%
--sidebar-accent-bg:        22 95% 95%
--sidebar-accent-fg:        16 84% 56%
--sidebar-width:            220px
--sidebar-collapsed-width:  78px
--navbar-height:            64px

/* Dark mode (parity con template) */
.dark {
  --background: 0 0% 10%   /* #1A1A1A */
  --foreground: 33 13% 89% /* #E8E4DF */
  --card:       0 0% 14%   /* #242424 */
  --border:     0 0% 20%   /* #333333 */
  --sidebar-bg: 0 0% 10%
  --sidebar-accent-bg: 16 28% 14% /* #2A1F1A */
  /* ... */
}
```

Utility `shadow-neu` portada al `@layer utilities`:

```css
.shadow-neu {
  box-shadow: 1px 1px 3px rgba(0,0,0,0.07), -1px -1px 3px rgba(255,255,255,0.7);
}
.dark .shadow-neu {
  box-shadow: 1px 1px 3px rgba(0,0,0,0.3), -1px -1px 2px rgba(255,255,255,0.04);
}
```

## Arquitectura de componentes

```
src/
├── app/
│   ├── layout.tsx              ← cambia fonts a Montserrat
│   └── globals.css             ← reescrito con tokens del template
├── components/
│   ├── layout/
│   │   ├── AuthLayout.tsx      ← portado del template (Next.js)
│   │   ├── DashboardLayout.tsx ← portado (usePathname, server components donde aplique)
│   │   ├── Sidebar.tsx         ← portado, parametrizado por rol vía prop `items: NavItem[]`
│   │   ├── Navbar.tsx          ← portado, user menu integrado con Supabase
│   │   ├── AuthCard.tsx        ← portado
│   │   └── Logo.tsx            ← portado, con variante 1to1
│   ├── ui/                     ← shadcn intacto (hereda tokens)
│   ├── shared/
│   │   ├── Toaster.tsx         ← portado del template
│   │   └── ConfirmModal.tsx    ← portado del template
│   ├── arquitectura-humana/    ← intacto en estructura, restyle automático
│   ├── one-on-one/             ← intacto en estructura, restyle automático
│   └── settings/               ← intacto en estructura, restyle automático
```

### Adaptaciones críticas al portar componentes del template

| Template (Vite) | 1to1 (Next.js) |
|---|---|
| `import { Link } from 'react-router-dom'` | `import Link from 'next/link'` |
| `useLocation().pathname` | `usePathname()` de `next/navigation` |
| `useNavigate()` | `useRouter()` de `next/navigation` |
| `import.meta.env.VITE_*` | `process.env.NEXT_PUBLIC_*` |
| `useAuthStore` (Zustand) | server-side Supabase + client hook existente de 1to1 |
| `'use client'` no existe | agregar directiva donde el componente use hooks |

### NavItem schema (Sidebar parametrizado)

```ts
type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  badge?: number | string
  children?: NavItem[]
}
```

Tres configs estáticas exportadas desde `src/components/layout/nav-items.ts`:
- `colaboradorNavItems`
- `liderNavItems`
- `arquitecturaHumanaNavItems`

`DashboardLayout` recibe `items` por prop y lo pasa al `Sidebar`.

## Plan de migración (waves)

### Ola 0 — SPEC (1 agente)
- Auditar las ~30 páginas en `src/app/(auth)/**` y `src/app/(dashboard)/**`.
- Producir `docs/superpowers/specs/2026-05-13-template-fusion-page-map.md` con: ruta → componentes del template a usar → notas de adaptación.
- Inventariar usos de Recharts (se conservan; ApexCharts no entra). Verificar que la paleta nueva se aplique a los charts existentes vía CSS vars.
- Output: page-mapping y foundation checklist.
- **Bloquea:** Ola 1.

### Ola 1 — FOUNDATION (1 agente)
- Reescribir `globals.css` con los tokens listados arriba.
- Reemplazar `Inter` por `Montserrat` en `app/layout.tsx`.
- Portar `AuthLayout`, `DashboardLayout`, `Sidebar`, `Navbar`, `AuthCard`, `Logo` adaptados a Next.js.
- Portar `Toaster` y `ConfirmModal` del template.
- Crear `nav-items.ts` con las 3 configs.
- Validar con `pnpm build` + `tsc -b` que el shell renderiza sin errores en una ruta mock.
- **Bloquea:** Ola 2.

### Ola 2 — BIG BANG PARALLEL (5 agentes en paralelo)
Cada agente:
1. Reescribe sus páginas usando los layouts portados y la paleta nueva.
2. Restilea cards, tables, badges, charts usando shadcn (que ya hereda tokens).
3. Verifica dark mode parity.
4. Self-review antes de entregar.

| Agente | Área | Páginas |
|---|---|---|
| A | Auth | `(auth)/login`, `(auth)/forgot-password`, `(auth)/reset-password`, `(auth)/callback` |
| B | Colaborador | `(dashboard)/colaborador/{1to1, historial, acuerdos, configuracion}` |
| C | Líder | `(dashboard)/lider/{1to1, equipo, colaborador, configuracion}` |
| D | Arquitectura Humana | `(dashboard)/arquitectura-humana/{mapa-calor, disputas, cadencias, usuarios, estructura, configuracion, reportes}` |
| E | Shared/States | empty states, loading skeletons, error boundaries, page transitions, breadcrumbs, header patterns reutilizables |

### Ola 3 — INTEGRATION (2 reviewers en paralelo)
- Reviewer 1: consistencia cross-página (spacing, typography, button styles, badge usage).
- Reviewer 2: responsive QA (mobile/tablet/desktop) + dark mode parity en todas las páginas.
- Output: lista de fixes para Ola 4.

### Ola 4 — POLISH (1 agente)
- Hover/focus states finos.
- Empty states con ilustración o icono coherente.
- Loading skeletons con la paleta nueva.
- A11y sweep (contraste, ARIA, keyboard nav).
- Final `pnpm build` + `tsc -b` zero-error gate.

## Data flow

Sin cambios. Los Server Components siguen leyendo de Supabase directamente. Los Client Components siguen usando el patrón actual (`createClient()` del cliente browser de Supabase). El portado es puramente presentacional.

## Error handling

Sin cambios estructurales. `error.tsx` y `not-found.tsx` de Next siguen activos; se restilean para usar los layouts portados (mismo header/sidebar, área de contenido reemplazada por el estado de error).

## Testing & QA

| Gate | Criterio | Cuándo |
|---|---|---|
| Build verde | `pnpm build` y `tsc -b` sin errores ni warnings | Cada ola antes de entregar |
| Visual regression | Screenshots before/after por página (manual o Playwright) | Después de Ola 2, antes de Ola 3 |
| A11y | Contraste WCAG AA verificado en pares críticos (`#ED6134` sobre `#FBF9F7`, sobre `#FEF3ED`, etc.) | Ola 4 |
| Dark mode | Toggle funciona en todas las páginas; sin "flash of unstyled" en SSR | Ola 3 |
| Responsive | Mobile (375px), tablet (768px), desktop (1280px+) | Ola 3 |
| Performance | Bundle delta ≤ +30kb gzipped (Montserrat font + componentes portados) | Ola 4 |

## Riesgos y mitigaciones

1. **Contraste `#ED6134` sobre fondos claros** — `#ED6134` sobre `#FBF9F7` da ~3.4:1, falla AA para texto. **Mitigación:** usar `#ED6134` solo para superficies pintadas (botones, badges, acentos), no para texto largo sobre fondo. Texto largo usa `--foreground` (`#4A4A4A` da 8:1 sobre `#FBF9F7`).

2. **Pérdida de identidad "Modo Bestia"** — el rediseño previo (`9d8ca01 feat: rediseño UX/UI integral — Editorial Cobalt + Lime v2`) era reciente. **Mitigación:** decisión explícita de Ariel; se conservan Source Serif y JetBrains Mono disponibles como fuentes secundarias por si se quiere recuperar acento editorial en headlines puntuales.

3. **`useLocation` / `<Link>` de react-router en componentes portados** — riesgo de portar sin adaptar y romper en build. **Mitigación:** checklist explícito en Ola 1, grep antes de mergear (`grep -r "react-router-dom\|useLocation\|useNavigate"`).

4. **Conflictos de naming `Logo`/`Toaster` con shadcn** — shadcn tiene su propio `Toaster`. **Mitigación:** los portados van a `src/components/shared/`, shadcn queda en `src/components/ui/`. Decidir cuál se usa por convención de imports (default = shared/Toaster).

5. **Big bang en 5 agentes paralelos toca archivos compartidos** — riesgo de merge conflicts en `globals.css`, `nav-items.ts`. **Mitigación:** Ola 1 cierra esos archivos antes; Ola 2 solo escribe en sus paths designados; reviewer de Ola 3 valida que nadie tocó fuera del scope.

## Convenciones de PR

- Una rama por ola: `feat/template-fusion-wave-{0,1,2-{a,b,c,d,e},3,4}`.
- PRs de Ola 2 paralelas mergean directo a `feat/template-fusion` (rama integradora), no a `main`.
- Squash merge a `main` al final de Ola 4 con un solo commit grande: `feat: fusión visual template Warm SaaS sobre 1to1`.

## Aceptación

- Las ~30 páginas renderean con la paleta cálida del template.
- Dark mode parity completo.
- `pnpm build` + `tsc -b` cero errores ni warnings.
- Visual regression aprobado.
- A11y WCAG AA cumplido en flujos críticos (login, dashboard, 1:1 detail).

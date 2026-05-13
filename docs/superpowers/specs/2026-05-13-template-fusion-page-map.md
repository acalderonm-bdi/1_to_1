# Page Map — Fusion Template Warm SaaS → 1to1

Phase A audit (foundation). Lists custom BEM-style classes that currently consume the legacy "Cobalt + Lime" palette and that must be re-styled to consume the new shadcn HSL tokens (Warm SaaS, `#ED6134`) in **Phase C**.

Source files audited:
- `src/app/globals.css` (2142 lines)
- `src/app/layout.tsx`
- `tailwind.config.ts`

## Custom classes de globals.css que requieren restilado (Phase C)

| Clase | Línea aprox. | Tokens actuales | Tokens nuevos (Phase C) |
|---|---|---|---|
| `.sidebar` | 432 | `var(--bg-sidebar)` = `#0a0a0c` (dark slate), gradientes `--accent-600`/`--lime-500`/`--accent-500` | `hsl(var(--sidebar))` (white), gradientes warm (`--primary`/`--secondary`) |
| `.sidebar__brand` | 447 | border `white 6%` (sobre fondo oscuro) | border `hsl(var(--sidebar-border))` |
| `.sidebar__brand-mark` | 452 | linear-gradient `--accent-400` → `--accent-700` (indigo) | linear-gradient `hsl(var(--primary))` warm `#ED6134` |
| `.sidebar__brand-mark::after` | 469 | overlay shine blanco (intacto) | sin cambio |
| `.sidebar__brand-name` | 478 | hereda `--text-on-dark` | `hsl(var(--sidebar-foreground))` |
| `.sidebar__brand-tag` | 485 | `var(--text-on-dark-muted)` | `hsl(var(--muted-foreground))` |
| `.sidebar__close` | 493 | bg/border/color `rgba(255,255,255,...)` (asume sidebar oscuro) | tokens neutros sobre sidebar claro |
| `.sidebar__role-switch` | 506 | bg/border `rgba(255,255,255,...)` | `hsl(var(--muted))` + `hsl(var(--sidebar-border))` |
| `.sidebar__role-btn` | 516 | color `--text-on-dark-muted`, hover white | `hsl(var(--muted-foreground))`, hover `hsl(var(--foreground))` |
| `.sidebar__role-btn[data-active]` | 529 | bg `rgba(255,255,255,0.10)`, color white | `hsl(var(--sidebar-accent))` + `hsl(var(--sidebar-accent-foreground))` |
| `.sidebar__section-label` | 533 | `color-mix(white 36%, transparent)` | `hsl(var(--muted-foreground))` |
| `.sidebar__nav` | 541 | scrollbar `rgba(255,255,255,...)` | scrollbar `hsl(var(--border))` |
| `.sidebar__link` | 544 | color `color-mix(white 76%, transparent)` | `hsl(var(--sidebar-foreground))` |
| `.sidebar__link:hover` | 556 | bg `rgba(255,255,255,0.06)` | `hsl(var(--sidebar-accent))` |
| `.sidebar__link[data-active]` | 561 | linear-gradient `--accent-500` 22→6%, box-shadow inset accent | `hsl(var(--sidebar-accent))` + `hsl(var(--sidebar-accent-foreground))`, neumorphic ring opcional |
| `.sidebar__link[data-active]::before` | 569 | accent-400 → accent-600 vertical bar + glow | `hsl(var(--primary))` bar warm |
| `.sidebar__link svg` | 577 | active `--accent-300` | active `hsl(var(--primary))` |
| `.sidebar__link-badge` | 579 | bg `--accent-600`, ring `--accent-300 30%` | bg `hsl(var(--primary))`, ring derivado |
| `.sidebar__divider` | 591 | `color-mix(white 8%, transparent)` | `hsl(var(--sidebar-border))` |
| `.sidebar__user` | 596 | border `white 6%`, bg `color-mix(black 18%, transparent)` | `hsl(var(--sidebar-border))` + `hsl(var(--muted))` |
| `.sidebar__user-avatar` | 604 | gradient `--slate-600` → `--slate-800` | gradient `hsl(var(--muted))` + warm tints |
| `.sidebar__user-name` | 616 | color white | `hsl(var(--sidebar-foreground))` |
| `.sidebar__user-role` | 621 | `--text-on-dark-muted` | `hsl(var(--muted-foreground))` |
| `.sidebar__user-action` | 626 | color `color-mix(white 60%, transparent)`, hover `rgba(255,255,255,0.08)` | `hsl(var(--muted-foreground))` + hover `hsl(var(--accent))` |
| `.app-drawer-backdrop` | 639 | `color-mix(black 40%, transparent)` + blur | sin cambios (overlay funcional) |
| `.app-main` | 653 | layout puro | sin cambios |
| `.app-header` | 654 | bg `color-mix(--bg-card 78%, transparent)` + blur, border `--border-c` | `hsl(var(--navbar))` + `hsl(var(--border))` |
| `.app-header__burger` | 666 | color `--text-c`, hover `--bg-muted` | `hsl(var(--foreground))` + `hsl(var(--muted))` |
| `.app-header__breadcrumb` | 679 | color `--text-muted` | `hsl(var(--muted-foreground))` |
| `.app-header__breadcrumb-current` | 685 | `--text-c` | `hsl(var(--foreground))` |
| `.app-header__sep` | 686 | `--text-subtle` | `hsl(var(--muted-foreground))` |
| `.app-header__spacer` | 687 | layout puro | sin cambios |
| `.app-header__search` | 688 | bg `--bg-muted`, focus border `--accent-300` | `hsl(var(--muted))` + focus `hsl(var(--ring))` |
| `.app-header__search:hover` | 702 | bg `--bg-card`, border `--border-c`, color `--text-c` | tokens shadcn equivalentes |
| `.app-header__search:focus-visible` | 708 | border `--accent-300`, shadow `--shadow-glow` | `hsl(var(--ring))` + neumorphic glow |
| `.app-header__search kbd` | 713 | bg `--bg-card`, border `--border-c`, color `--text-subtle` | tokens shadcn equivalentes |
| `.app-header__icon-btn` | 724 | color `--text-muted`, hover `--bg-muted` | `hsl(var(--muted-foreground))` + `hsl(var(--muted))` |
| `.app-header__icon-btn .dot` | 736 | bg `--accent-500`, border `--bg-card`, glow indigo | `hsl(var(--primary))` warm + glow |
| `.app-header__user-chip` | 745 | bg `--bg-card`, border `--border-c` | `hsl(var(--card))` + `hsl(var(--border))` |
| `.app-header__user-chip:hover` | 755 | bg `--bg-muted`, border `--border-strong` | `hsl(var(--muted))` + `hsl(var(--border))` |
| `.app-header__user-avatar` | 759 | gradient `--accent-100` → `--accent-200`, color `--accent-700` (indigo) | gradient `hsl(var(--accent))` + `hsl(var(--accent-foreground))` warm |
| `.app-header__user-text` | 769 | layout/typography puro | sin cambios |

> Otras clases legacy detectadas (no `.sidebar`/`.app-*` pero relacionadas) requerirán otra pasada en Phase C/E:
> - `.app` (línea 424) consume `var(--bg-app)`
> - Selectores `[data-theme="dark"] .av-*` (línea 274+) usan hex hardcoded — Phase E
> - Body background-image (línea 317) usa `color-mix` con `--accent-500` / `--lime-500` — Phase C

## Tokens shadcn HSL aún no introducidos (referencia para Phase A2/A3)

A introducir en `:root` y `.dark`:
- `--sidebar`, `--sidebar-foreground`, `--sidebar-border`, `--sidebar-accent`, `--sidebar-accent-foreground`
- `--navbar`, `--navbar-foreground`
- `--success`, `--success-foreground`, `--warning`, `--warning-foreground`
- Dimensiones: `--sidebar-width`, `--sidebar-collapsed-width`, `--navbar-height`

A introducir como utility (Phase A3): `.shadow-neu` (light + dark).

## Phase A smoke results

- Build: ✅ (Next.js 14, all 28 routes compiled, exit 0, no Tailwind warnings)
- Typecheck: ✅ (`pnpm tsc -b`, exit 0, no diagnostics)

### Palette residues still hardcoded (Phase E will address)

Conteo de archivos (no líneas) bajo `src/` con cada patrón:

| Patrón | Archivos | Comentario |
|---|---|---|
| `bg-(slate\|indigo\|cobalt\|lime\|coral)-*` (Tailwind class) | 0 | Limpio: no se usan estas Tailwind classes directamente. |
| `#0a0a0c` (sidebar bg dark hex literal) | 2 | `src/app/globals.css` (definición y `--bg-sidebar`/data-theme), `src/app/layout.tsx` (themeColor meta). |
| `#4f46e5` (indigo-600 hex literal) | 2 | `src/app/globals.css` (definición `--accent-600`), `src/components/settings/settings-shell.tsx` (hex inline). |
| `var(--accent-500)` (legacy indigo CSS var) | 10 | 1 archivo de definición (`globals.css`) + 9 consumidores en `components/*` y `app/(dashboard)/*` y login. |
| `var(--lime-…)` (legacy lima CSS var) | 4 | `globals.css` (definición) + sparkline, empty-state, login. |
| `var(--coral-…)` (legacy coral CSS var) | 0 | Limpio: las definiciones legacy en `globals.css` no quedaron como consumidores. |

**Detalle de consumidores `var(--accent-500)`:**
- `src/app/(auth)/login/page.tsx`
- `src/app/(dashboard)/colaborador/acuerdos/page.tsx`
- `src/app/(dashboard)/lider/colaborador/[id]/page.tsx`
- `src/components/shared/sparkline.tsx`
- `src/components/shared/empty-state.tsx`
- `src/components/arquitectura-humana/user-admin-controls.tsx`
- `src/components/one-on-one/minute-editor.tsx`
- `src/components/one-on-one/agreement-list.tsx`
- `src/components/one-on-one/agreement-status-pill.tsx`

**Detalle consumidores `var(--lime-…)`:** sparkline, empty-state, login.

**Detalle `#4f46e5` inline (no-`var`):** `src/components/settings/settings-shell.tsx`.

**Detalle `#0a0a0c` inline (no-`var`):** `src/app/layout.tsx` (`themeColor` meta para dark — funcional, no visual).

> Total archivos consumidores únicos (sumando los patrones legacy `var(--accent-*)`, `var(--lime-*)`, `#4f46e5` inline) ≈ 10. Es un alcance manejable para Phase E; no constituye un riesgo de bloqueo para Phase A.


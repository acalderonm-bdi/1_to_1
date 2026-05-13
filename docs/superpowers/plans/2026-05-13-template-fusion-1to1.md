# Fusión Template Warm SaaS → 1to1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar la identidad visual del template `xgael/Template_User_Management` (paleta cálida `#ED6134`, Montserrat, neumorphic shadows, dimensiones sidebar/navbar) a las ~30 páginas de 1to1, preservando el stack Next.js 14 + Supabase + shadcn/ui + Tailwind v3.

**Architecture:** Backportear los design tokens del `@theme` de Tailwind v4 del template a CSS vars HSL en `globals.css` de 1to1. Restilar los componentes de layout existentes (`app-shell.tsx`, `sidebar.tsx`, `header.tsx`) sin tocar su arquitectura. Portar 4 componentes standalone (`Logo`, `AuthCard`, `Toaster`, `ConfirmModal`) adaptados a Next.js. Restilar páginas vía CSS vars heredadas automáticamente por shadcn.

**Tech Stack:** Next.js 14 App Router, Supabase SSR, Tailwind CSS v3, shadcn/ui (Radix), Recharts, lucide-react, Montserrat (next/font/google).

---

## File Structure

**Modified (existentes en 1to1):**
- `src/app/layout.tsx` — swap fonts a Montserrat
- `src/app/globals.css` — token palette swap + neumorphic utility (~2142 líneas)
- `src/components/layout/app-shell.tsx` — restilar markup
- `src/components/layout/sidebar.tsx` — restilar markup
- `src/components/layout/header.tsx` — restilar markup
- `src/components/layout/command-palette.tsx` — restilar markup
- `src/app/(auth)/layout.tsx` — wrap centrado
- `src/app/(auth)/login/page.tsx` — usar AuthCard
- ~30 páginas en `src/app/(dashboard)/**/page.tsx` — restyle heredado + tweaks puntuales

**Created (portados del template):**
- `src/components/layout/Logo.tsx` — versión simplificada (sin Zustand)
- `src/components/layout/AuthCard.tsx`
- `src/components/shared/Toaster.tsx`
- `src/components/shared/ConfirmModal.tsx`
- `src/lib/use-click-outside.ts` — helper hook usado por Navbar dropdown

**Documentation:**
- `docs/superpowers/specs/2026-05-13-template-fusion-page-map.md` — output de Ola 0

---

## Phase A — Foundation (1 agent, secuencial, blocking)

Establece tokens, fuente, neumorphic. Bloquea todo lo demás.

### Task A1: Audit de globals.css — extraer mapping de clases custom

**Files:**
- Read: `src/app/globals.css` (2142 líneas)

- [ ] **Step 1: Grep clases custom que usan tokens cobalto/lime**

Run: `grep -nE "^\.(sidebar|navbar|header|btn|card|tag|app-)" src/app/globals.css | head -50`

Anota qué clases custom existen y cuáles consumen las vars `--accent-*`, `--lime-*`, `--coral-*`, `--slate-*`.

- [ ] **Step 2: Documentar inventario en page-map**

Crear `docs/superpowers/specs/2026-05-13-template-fusion-page-map.md` con sección "Custom classes a tocar":

```markdown
## Clases custom de globals.css que requieren restilado

| Clase | Línea aprox. | Tokens actuales | Tokens nuevos |
|---|---|---|---|
| .sidebar | XXX | --slate-950 bg | --sidebar (white) |
| .sidebar__brand | XXX | --lime-400 | --primary |
| .sidebar__nav-item | XXX | --slate-300 | --sidebar-foreground/70 |
| ... | ... | ... | ... |
```

- [ ] **Step 3: Commit el audit**

```bash
git add docs/superpowers/specs/2026-05-13-template-fusion-page-map.md
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "docs(fusion): audit de clases custom para restilado"
```

### Task A2: Reescribir paleta HSL en globals.css

**Files:**
- Modify: `src/app/globals.css` — bloque `:root` (líneas iniciales hasta el primer separador semántico) y bloque `.dark` correspondiente.

- [ ] **Step 1: Localizar bloques de definición de tokens HSL existentes**

Run: `grep -n "^\s*--background:\|^\s*--primary:\|^\s*--accent:" src/app/globals.css | head -20`

Identificar las líneas exactas donde shadcn lee `--background`, `--primary`, etc. (suelen estar bajo `:root` con valores HSL sin `hsl()`).

- [ ] **Step 2: Reemplazar bloque light**

Sustituir las vars HSL existentes por:

```css
:root {
  /* ... resto de vars (fonts, escalas custom, etc. se mantienen) ... */

  /* shadcn tokens — Warm SaaS palette */
  --background:           36 33% 98%;   /* #FBF9F7 */
  --foreground:           0 0% 29%;     /* #4A4A4A */
  --card:                 0 0% 100%;
  --card-foreground:      0 0% 29%;
  --popover:              0 0% 100%;
  --popover-foreground:   0 0% 29%;
  --primary:              16 84% 56%;   /* #ED6134 */
  --primary-foreground:   0 0% 100%;
  --secondary:            41 89% 60%;   /* #F4BB41 */
  --secondary-foreground: 0 0% 10%;
  --muted:                30 14% 95%;   /* #F5F2EF */
  --muted-foreground:     30 4% 51%;    /* #8A8580 */
  --accent:               22 95% 95%;   /* #FEF3ED */
  --accent-foreground:    16 84% 56%;
  --destructive:          16 84% 56%;
  --destructive-foreground: 0 0% 100%;
  --success:              96 38% 62%;   /* #98C37A */
  --success-foreground:   0 0% 100%;
  --warning:              41 89% 60%;
  --warning-foreground:   0 0% 10%;
  --border:               33 13% 89%;   /* #E8E4DF */
  --input:                33 13% 89%;
  --ring:                 16 84% 56%;
  --radius:               0.5rem;

  /* Sidebar/Navbar tokens */
  --sidebar:                  0 0% 100%;
  --sidebar-foreground:       0 0% 29%;
  --sidebar-border:           33 13% 89%;
  --sidebar-accent:           22 95% 95%;
  --sidebar-accent-foreground:16 84% 56%;
  --navbar:                   0 0% 100%;
  --navbar-foreground:        0 0% 29%;

  --sidebar-width:            220px;
  --sidebar-collapsed-width:  78px;
  --navbar-height:            64px;
}
```

**Importante:** mantener las escalas custom (`--accent-50`...`--accent-900`, `--lime-*`, `--coral-*`) intactas para que el código viejo no rompa de golpe. Esas dejan de usarse pero no las eliminamos en esta fase.

- [ ] **Step 3: Reemplazar bloque dark**

```css
.dark {
  --background:           0 0% 10%;    /* #1A1A1A */
  --foreground:           33 13% 89%;  /* #E8E4DF */
  --card:                 0 0% 14%;    /* #242424 */
  --card-foreground:      33 13% 89%;
  --popover:              0 0% 14%;
  --popover-foreground:   33 13% 89%;
  --primary:              16 84% 56%;
  --primary-foreground:   0 0% 100%;
  --secondary:            41 89% 60%;
  --secondary-foreground: 0 0% 10%;
  --muted:                0 0% 14%;
  --muted-foreground:     30 4% 51%;
  --accent:               16 28% 14%;  /* #2A1F1A */
  --accent-foreground:    16 84% 56%;
  --destructive:          16 84% 56%;
  --destructive-foreground: 0 0% 100%;
  --success:              96 38% 62%;
  --warning:              41 89% 60%;
  --border:               0 0% 20%;    /* #333333 */
  --input:                0 0% 20%;
  --ring:                 16 84% 56%;
  --sidebar:                  0 0% 10%;
  --sidebar-foreground:       33 13% 89%;
  --sidebar-border:           0 0% 20%;
  --sidebar-accent:           16 28% 14%;
  --sidebar-accent-foreground:16 84% 56%;
  --navbar:                   0 0% 14%;
  --navbar-foreground:        33 13% 89%;
}
```

- [ ] **Step 4: Verificar build no rompe**

Run: `pnpm tsc -b 2>&1 | tail -5`
Expected: zero errors. CSS no afecta a typecheck pero sirve de smoke.

Run: `pnpm build 2>&1 | tail -20`
Expected: build verde, sin errores de Tailwind config.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(fusion): swap palette HSL a Warm SaaS (#ED6134)"
```

### Task A3: Agregar utility `.shadow-neu`

**Files:**
- Modify: `src/app/globals.css` — agregar al `@layer utilities`

- [ ] **Step 1: Localizar `@layer utilities`**

Run: `grep -n "^@layer utilities" src/app/globals.css`
Si no existe, agregarlo al final del archivo.

- [ ] **Step 2: Insertar utility**

```css
@layer utilities {
  .shadow-neu {
    box-shadow: 1px 1px 3px rgba(0, 0, 0, 0.07), -1px -1px 3px rgba(255, 255, 255, 0.7);
  }
  .dark .shadow-neu {
    box-shadow: 1px 1px 3px rgba(0, 0, 0, 0.3), -1px -1px 2px rgba(255, 255, 255, 0.04);
  }
}
```

- [ ] **Step 3: Verificar con un smoke en una página existente**

Editar temporalmente `src/app/(dashboard)/colaborador/page.tsx` para agregar `<div className="shadow-neu p-4 bg-card rounded-lg">test</div>` en cualquier lugar visible.

Run: `pnpm dev` (background). Abrir `http://localhost:3000/colaborador`.
Verificar visualmente que el div tiene la sombra suave. Revertir el cambio temporal.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(fusion): utility shadow-neu para superficies neumorphic"
```

### Task A4: Swap Inter → Montserrat

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Reemplazar import y configuración de fuente**

En `src/app/layout.tsx`, cambiar:

```ts
import { Inter, Source_Serif_4, JetBrains_Mono } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
})
```

por:

```ts
import { Montserrat, Source_Serif_4, JetBrains_Mono } from 'next/font/google'

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-montserrat',
  display: 'swap',
})
```

Y en el JSX del `<html>` cambiar `${inter.variable}` por `${montserrat.variable}`, y `className={inter.className}` por `className={montserrat.className}`.

- [ ] **Step 2: Actualizar Tailwind config para usar Montserrat como sans default**

Run: `cat tailwind.config.ts | grep -n "fontFamily" -A 10`

Modificar el bloque `fontFamily` en `tailwind.config.ts` para que `sans` use `var(--font-montserrat)`:

```ts
fontFamily: {
  sans: ['var(--font-montserrat)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  serif: ['var(--font-source-serif)', 'Georgia', 'serif'],
  mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'monospace'],
},
```

- [ ] **Step 3: Actualizar globals.css `--font-sans`**

Buscar en globals.css la línea `--font-sans: 'Inter', ...` y reemplazarla por:

```css
--font-sans: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
```

- [ ] **Step 4: Build verify**

Run: `pnpm build 2>&1 | tail -10`
Expected: build verde, sin errores de fuente faltante.

- [ ] **Step 5: Visual smoke**

Run: `pnpm dev` (background). Abrir cualquier página. Inspeccionar `<body>` en devtools — `font-family` debe resolver a Montserrat.

- [ ] **Step 6: Commit**

```bash
git add src/app/layout.tsx tailwind.config.ts src/app/globals.css
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(fusion): swap Inter → Montserrat como fuente sans default"
```

### Task A5: Smoke test foundation — verificar que shadcn hereda los tokens

**Files:**
- No modifica nada. Solo verificación visual.

- [ ] **Step 1: Levantar dev server**

Run: `pnpm dev` (background).

- [ ] **Step 2: Inspección visual de 3 páginas representativas**

Abrir en navegador:
1. `http://localhost:3000/login` — debe mostrar fuente Montserrat, fondo `#FBF9F7`
2. `http://localhost:3000/colaborador` — botones primarios deben verse en `#ED6134`
3. `http://localhost:3000/arquitectura-humana` — badges/cards heredan paleta

Si algún color sigue saliendo cobalto/lime, hay clases hardcoded en globals.css que Phase C va a corregir. No es bloqueante para Phase A.

- [ ] **Step 3: Documentar regresiones visuales detectadas**

Anexar al page-map (`docs/superpowers/specs/2026-05-13-template-fusion-page-map.md`) una sección:

```markdown
## Smoke test Foundation — regresiones detectadas

- `[ruta]` — `[descripción de qué se ve mal]`
```

- [ ] **Step 4: Commit del page-map actualizado**

```bash
git add docs/superpowers/specs/2026-05-13-template-fusion-page-map.md
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "docs(fusion): smoke test foundation — regresiones detectadas"
```

---

## Phase B — Componentes portables del template (1 agent, paralelo a Phase A4-A5)

Portar componentes standalone (no acoplados a Zustand del template).

### Task B1: Portar `Logo.tsx` simplificado

**Files:**
- Create: `src/components/layout/Logo.tsx`

- [ ] **Step 1: Crear componente**

```tsx
// src/components/layout/Logo.tsx
import Link from 'next/link'
import Image from 'next/image'

interface LogoProps {
  collapsed?: boolean
  href?: string
}

export function Logo({ collapsed = false, href = '/' }: LogoProps) {
  return (
    <Link href={href} className="flex items-center gap-2 px-6 py-5">
      <Image
        src="/logo-light.png"
        alt="1to1"
        width={collapsed ? 32 : 80}
        height={collapsed ? 32 : 80}
        className="h-20 w-auto shrink-0 dark:hidden"
        priority
      />
      <Image
        src="/logo-dark.png"
        alt="1to1"
        width={collapsed ? 32 : 80}
        height={collapsed ? 32 : 80}
        className="h-20 w-auto shrink-0 hidden dark:block"
        priority
      />
    </Link>
  )
}
```

Diferencias vs template: usa `next/link` + `next/image`, no consume Zustand (el dark mode lo maneja Tailwind via `.dark` class en `<html>`).

- [ ] **Step 2: Verificar que los assets existan**

Run: `ls public/logo-light.png public/logo-dark.png 2>&1`

Si no existen, crear placeholders SVG temporales o usar el logo actual de 1to1. Anotar en page-map para que diseño los provea.

- [ ] **Step 3: Build verify**

Run: `pnpm tsc -b 2>&1 | tail -5`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Logo.tsx
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(fusion): Logo portado del template, adaptado a next/image"
```

### Task B2: Portar `AuthCard.tsx`

**Files:**
- Create: `src/components/layout/AuthCard.tsx`

- [ ] **Step 1: Crear componente**

```tsx
// src/components/layout/AuthCard.tsx
import Link from 'next/link'
import Image from 'next/image'

interface AuthCardProps {
  title: string
  subtitle: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
      <div className="mb-6 flex justify-center">
        <Link href="/">
          <Image
            src="/logo-light.png"
            alt="1to1"
            width={80}
            height={80}
            className="h-20 w-auto dark:hidden"
            priority
          />
          <Image
            src="/logo-dark.png"
            alt="1to1"
            width={80}
            height={80}
            className="h-20 w-auto hidden dark:block"
            priority
          />
        </Link>
      </div>
      <h4 className="mb-2 text-xl font-semibold text-card-foreground">{title}</h4>
      <p className="mb-6 text-sm text-muted-foreground">{subtitle}</p>
      {children}
      {footer && <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div>}
    </div>
  )
}
```

Diferencias vs template: tokens `bg-card`, `border-border`, `text-muted-foreground` en vez de hard-coded `bg-white`, `border-gray-200`, `text-gray-500`.

- [ ] **Step 2: Build verify**

Run: `pnpm tsc -b 2>&1 | tail -5`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/AuthCard.tsx
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(fusion): AuthCard portado, usa tokens shadcn"
```

### Task B3: Hook `use-click-outside`

**Files:**
- Create: `src/lib/use-click-outside.ts`

- [ ] **Step 1: Crear hook**

```ts
// src/lib/use-click-outside.ts
import { useEffect, type RefObject } from 'react'

export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T>,
  handler: (e: MouseEvent | TouchEvent) => void
) {
  useEffect(() => {
    function listener(event: MouseEvent | TouchEvent) {
      const el = ref.current
      if (!el || el.contains(event.target as Node)) return
      handler(event)
    }
    document.addEventListener('mousedown', listener)
    document.addEventListener('touchstart', listener)
    return () => {
      document.removeEventListener('mousedown', listener)
      document.removeEventListener('touchstart', listener)
    }
  }, [ref, handler])
}
```

- [ ] **Step 2: Build verify**

Run: `pnpm tsc -b 2>&1 | tail -5`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/use-click-outside.ts
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(fusion): hook use-click-outside (helper para dropdowns)"
```

### Task B4: Portar `ConfirmModal.tsx`

**Files:**
- Read first: `Template_User_Management/frontend/src/components/ui/ConfirmModal.tsx` para conocer su API.
- Create: `src/components/shared/ConfirmModal.tsx`

- [ ] **Step 1: Inspeccionar API del template**

Run: `cat /home/arielcalderon/Escritorio/Template_User_Management/frontend/src/components/ui/ConfirmModal.tsx`

Identificar: props, store (Zustand del template), trigger API (probable `confirm()` imperativo).

- [ ] **Step 2: Adaptar a contexto React (sin Zustand)**

Crear el modal con `React Context + useReducer` o reusar `<AlertDialog>` de shadcn (1to1 ya lo tiene en `src/components/ui/`).

**Recomendado:** usar `<AlertDialog>` de shadcn restilado, no portar el del template. shadcn ya soporta API imperativa vía un Context provider en el root.

Crear `src/components/shared/ConfirmModal.tsx`:

```tsx
'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
}

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmModalProvider')
  return ctx.confirm
}

export function ConfirmModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    open: boolean
    opts: ConfirmOptions | null
    resolve: ((v: boolean) => void) | null
  }>({ open: false, opts: null, resolve: null })

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, opts, resolve })
    })
  }, [])

  const close = useCallback((value: boolean) => {
    state.resolve?.(value)
    setState({ open: false, opts: null, resolve: null })
  }, [state])

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AlertDialog open={state.open} onOpenChange={(o) => !o && close(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{state.opts?.title}</AlertDialogTitle>
            {state.opts?.description && (
              <AlertDialogDescription>{state.opts.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close(false)}>
              {state.opts?.cancelLabel ?? 'Cancelar'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => close(true)}
              className={state.opts?.variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {state.opts?.confirmLabel ?? 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}
```

- [ ] **Step 3: Montar provider en root**

Modificar `src/app/(dashboard)/layout.tsx` para envolver `<AppShell>` con `<ConfirmModalProvider>`:

```tsx
import { ConfirmModalProvider } from '@/components/shared/ConfirmModal'

// dentro del return:
<ConfirmModalProvider>
  <AppShell ...>{children}</AppShell>
</ConfirmModalProvider>
```

- [ ] **Step 4: Build verify**

Run: `pnpm tsc -b 2>&1 | tail -5`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/ConfirmModal.tsx src/app/\(dashboard\)/layout.tsx
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(fusion): ConfirmModalProvider sobre AlertDialog de shadcn"
```

### Task B5: Verificar `Toaster` actual de shadcn

**Files:**
- Read: `src/components/ui/toaster.tsx` o `src/components/ui/toast.tsx`

- [ ] **Step 1: Confirmar que existe Toaster shadcn**

Run: `ls src/components/ui/toast* 2>&1`

Si existe (1to1 ya tiene `@radix-ui/react-toast` en deps), no portamos nada — solo verificamos que esté montado en el root layout.

- [ ] **Step 2: Verificar montaje**

Run: `grep -rn "Toaster" src/app/layout.tsx src/app/\(dashboard\)/layout.tsx 2>&1`

Si no está, agregarlo a `src/app/layout.tsx`:

```tsx
import { Toaster } from '@/components/ui/toaster'

// dentro del <body>:
<body className={montserrat.className}>
  {children}
  <Toaster />
</body>
```

- [ ] **Step 3: Build verify**

Run: `pnpm tsc -b 2>&1 | tail -5`
Expected: zero errors.

- [ ] **Step 4: Commit (si hubo cambios)**

```bash
git add src/app/layout.tsx
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(fusion): asegurar Toaster montado en root layout"
```

---

## Phase C — Restilar componentes layout existentes (1 agent, secuencial)

**Bloqueado por:** Phase A completa.

El objetivo es restilar los componentes de 1to1 (`app-shell.tsx`, `sidebar.tsx`, `header.tsx`, `command-palette.tsx`) para que se vean como el template, sin tocar su lógica de drawer/cmdk/role-based-nav.

### Task C1: Restilar Sidebar (sidebar.tsx + clases BEM en globals.css)

**Files:**
- Modify: `src/components/layout/sidebar.tsx` (~136 líneas)
- Modify: `src/app/globals.css` (clases `.sidebar`, `.sidebar__brand`, `.sidebar__nav-item`, etc.)

- [ ] **Step 1: Localizar todas las clases `.sidebar*` en globals.css**

Run: `grep -nE "^\.sidebar" src/app/globals.css`

Anotar las líneas exactas de cada definición.

- [ ] **Step 2: Reescribir el bloque CSS de `.sidebar`**

Reemplazar las definiciones existentes (que usan colores cobalto/lime) por:

```css
.sidebar {
  position: fixed;
  top: 0; left: 0;
  height: 100%;
  width: var(--sidebar-width);
  background: hsl(var(--sidebar));
  color: hsl(var(--sidebar-foreground));
  border-right: 1px solid hsl(var(--sidebar-border));
  display: flex;
  flex-direction: column;
  z-index: 50;
  transition: transform 0.3s ease;
  transform: translateX(-100%);
}

@media (min-width: 1280px) {
  .sidebar { transform: translateX(0); }
}

.sidebar[data-open="true"] { transform: translateX(0); }

.sidebar__brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid hsl(var(--sidebar-border));
}

.sidebar__brand-name {
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 1rem;
  color: hsl(var(--primary));
}

.sidebar__nav {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.sidebar__nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--sidebar-foreground) / 0.7);
  transition: background-color 0.15s, color 0.15s;
}

.sidebar__nav-item:hover {
  background: hsl(var(--sidebar-accent));
  color: hsl(var(--sidebar-accent-foreground));
}

.sidebar__nav-item[data-active="true"] {
  background: hsl(var(--sidebar-accent));
  color: hsl(var(--sidebar-accent-foreground));
  font-weight: 600;
}

.sidebar__nav-item-icon {
  flex-shrink: 0;
}

.sidebar__nav-item[data-active="true"] .sidebar__nav-item-icon {
  color: hsl(var(--primary));
}

.sidebar__footer {
  border-top: 1px solid hsl(var(--sidebar-border));
  padding: 1rem;
}
```

Eliminar cualquier `.sidebar`-prefixed selector duplicado.

- [ ] **Step 3: Smoke en navegador**

Run: `pnpm dev` (background). Abrir `http://localhost:3000/colaborador`.

Verificar:
- Sidebar tiene fondo blanco (light) o `#1A1A1A` (dark).
- Item activo tiene fondo `#FEF3ED` y texto `#ED6134`.
- Iconos heredan color del item.

Si el markup del sidebar.tsx no usa las clases BEM consistentemente, ajustarlo en el siguiente step.

- [ ] **Step 4: Audit y normalizar markup en sidebar.tsx**

Read: `src/components/layout/sidebar.tsx`

Verificar que cada `<Link>` use:
```tsx
<Link
  href={item.href}
  className="sidebar__nav-item"
  data-active={currentPath === item.href}
>
  <item.icon size={20} className="sidebar__nav-item-icon" />
  <span>{item.label}</span>
</Link>
```

Reemplazar usos de clases viejas (cobalto/lime) y dejar el markup limpio. Mantener intacta la lógica de `NAV_BY_ROLE`, `handleSignOut`, `drawerOpen`.

- [ ] **Step 5: Build verify + visual check ambos temas**

Run: `pnpm build 2>&1 | tail -10`
Expected: build verde.

Visualmente: navegar `/colaborador`, `/lider`, `/arquitectura-humana` en light y dark. Sidebar debe verse coherente en los tres roles.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/sidebar.tsx src/app/globals.css
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(fusion): restilar Sidebar — Warm SaaS palette + neumorphic hover"
```

### Task C2: Restilar Header (header.tsx + clases CSS)

**Files:**
- Modify: `src/components/layout/header.tsx` (~163 líneas)
- Modify: `src/app/globals.css` (clases `.header`, `.navbar`)

- [ ] **Step 1: Localizar clases header/navbar en globals.css**

Run: `grep -nE "^\.(header|navbar|app-header)" src/app/globals.css`

- [ ] **Step 2: Reemplazar bloque CSS**

```css
.navbar {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 1rem;
  height: var(--navbar-height);
  padding: 0 1.5rem;
  margin: 1rem 1.5rem 0;
  background: hsl(var(--navbar));
  color: hsl(var(--navbar-foreground));
  border-radius: 0.5rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.navbar__search {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 0.5rem;
}

.navbar__search-input {
  flex: 1;
  max-width: 28rem;
  background: transparent;
  font-size: 0.875rem;
  color: hsl(var(--foreground));
  outline: none;
}

.navbar__search-input::placeholder {
  color: hsl(var(--muted-foreground));
}

.navbar__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.navbar__icon-btn {
  padding: 0.5rem;
  border-radius: 0.5rem;
  color: hsl(var(--navbar-foreground) / 0.7);
  transition: background-color 0.15s;
}

.navbar__icon-btn:hover {
  background: hsl(var(--muted));
}

.navbar__avatar {
  position: relative;
  height: 2.5rem;
  width: 2.5rem;
  overflow: hidden;
  border-radius: 9999px;
  background: hsl(var(--primary) / 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.navbar__avatar-initials {
  color: hsl(var(--primary));
  font-weight: 600;
  font-size: 0.875rem;
}

.navbar__avatar-status {
  position: absolute;
  bottom: 0; right: 0;
  height: 0.625rem;
  width: 0.625rem;
  border-radius: 9999px;
  border: 2px solid hsl(var(--navbar));
  background: hsl(var(--success));
}
```

- [ ] **Step 3: Ajustar header.tsx para usar las clases nuevas**

Modificar el JSX de `src/components/layout/header.tsx` para que el `<header>` raíz use `className="navbar"`, los buttons de iconos `className="navbar__icon-btn"`, etc.

Mantener la lógica de `useAppShell()`, `openDrawer`, `openCmdK`, `signOut`.

- [ ] **Step 4: Build verify**

Run: `pnpm build 2>&1 | tail -10`
Expected: build verde.

- [ ] **Step 5: Visual smoke**

Run: `pnpm dev`. Verificar header en `/colaborador`. Search bar, theme toggle, avatar visibles y bien posicionados.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/header.tsx src/app/globals.css
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(fusion): restilar Header — navbar pill flotante Warm SaaS"
```

### Task C3: Restilar AppShell (app-shell.tsx)

**Files:**
- Modify: `src/components/layout/app-shell.tsx` (~138 líneas)

- [ ] **Step 1: Ajustar contenedor principal para nueva geometría sidebar/navbar**

Read: `src/components/layout/app-shell.tsx`

Reemplazar el contenedor del `<main>`/contenido para que respete `--sidebar-width`:

```tsx
return (
  <AppShellContext.Provider value={contextValue}>
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar role={role} currentPath={currentPath} userName={userName} userEmail={userEmail} />
      <div className="xl:ml-[var(--sidebar-width)] transition-[margin] duration-300">
        <Header />
        <main className="p-3 sm:p-6">
          {children}
        </main>
      </div>
      <CommandPalette open={cmdkOpen} onClose={closeCmdK} />
    </div>
  </AppShellContext.Provider>
)
```

Mantener intacto: `AppShellContext`, `useKeyboardShortcuts`, `drawerOpen/cmdkOpen` state.

- [ ] **Step 2: Build verify**

Run: `pnpm build 2>&1 | tail -10`
Expected: build verde.

- [ ] **Step 3: Visual smoke responsivo**

Verificar en mobile (375px), tablet (768px), desktop (≥1280px):
- Mobile: sidebar oculto, drawer activable.
- Desktop: sidebar fijo a la izquierda, contenido con margin-left.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/app-shell.tsx
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(fusion): AppShell layout con geometría sidebar/navbar del template"
```

### Task C4: Restilar CommandPalette

**Files:**
- Modify: `src/components/layout/command-palette.tsx`

- [ ] **Step 1: Verificar que use tokens shadcn**

Read: `src/components/layout/command-palette.tsx`

shadcn `<Command>` ya hereda tokens. Solo verificar que no haya colores hardcodeados (rgba específicos, `bg-slate-*`, etc.). Si los hay, swap a `bg-popover`, `text-popover-foreground`, `border-border`.

- [ ] **Step 2: Build verify**

Run: `pnpm build 2>&1 | tail -10`
Expected: build verde.

- [ ] **Step 3: Visual smoke**

Run: `pnpm dev`. Cmd+K → debe abrir el palette con fondo `bg-popover`, items con hover `bg-accent`.

- [ ] **Step 4: Commit (si hubo cambios)**

```bash
git add src/components/layout/command-palette.tsx
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(fusion): CommandPalette tokens normalizados"
```

---

## Phase D — Auth screens (1 agent, paralelo a Phase C)

### Task D1: AuthLayout centrado

**Files:**
- Modify: `src/app/(auth)/layout.tsx`

- [ ] **Step 1: Reemplazar layout vacío por centrado**

```tsx
// src/app/(auth)/layout.tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  )
}
```

Sin GSAP. Sin overlay coral. Layout limpio centrado.

- [ ] **Step 2: Build verify**

Run: `pnpm build 2>&1 | tail -10`
Expected: build verde.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(auth\)/layout.tsx
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(fusion): AuthLayout centrado, sin GSAP"
```

### Task D2: Login page con AuthCard

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Read current login**

Run: `cat src/app/\(auth\)/login/page.tsx | head -80`

Identificar el form actual (Supabase auth con email/password u OAuth).

- [ ] **Step 2: Envolver el form en AuthCard**

```tsx
import { AuthCard } from '@/components/layout/AuthCard'

// dentro del return del page:
return (
  <AuthCard
    title="Iniciar sesión"
    subtitle="Accedé a tu cuenta de 1to1"
    footer={
      <span>¿No tenés cuenta? <Link href="/contacto" className="text-primary hover:underline">Contactá a tu admin</Link></span>
    }
  >
    {/* form existente: <Input>, <Button>, etc. */}
  </AuthCard>
)
```

Mantener toda la lógica de submit/Supabase. Solo cambia el wrapping visual.

- [ ] **Step 3: Build verify**

Run: `pnpm build 2>&1 | tail -10`
Expected: build verde.

- [ ] **Step 4: Visual smoke**

`/login` debe verse: card blanca centrada, logo arriba, título Montserrat semibold, form con inputs shadcn que heredan `#ED6134` en el focus ring.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(auth\)/login/page.tsx
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(fusion): login envuelto en AuthCard Warm SaaS"
```

---

## Phase E — Big bang restyling de páginas dashboard (5 agentes paralelos)

**Bloqueado por:** Phase A + Phase C completas.

Cada agente recibe el mismo recipe genérico aplicado a su lista de páginas. Trabajan en ramas separadas que mergean a una rama integradora `feat/template-fusion`.

### Recipe genérico por página

Para cada página en la lista del agente:

- [ ] **Step 1: Read page actual**
- [ ] **Step 2: Identificar colores/clases hardcoded**

Grep en el archivo: `bg-slate-`, `bg-indigo-`, `bg-cobalto-`, `text-lime-`, `border-violet-`, `#0a0a0c`, `#4f46e5`, `--accent-500`, `--lime-*`, `--coral-*`.

- [ ] **Step 3: Swap a tokens semánticos**

| Antes (hardcoded) | Después (token semántico) |
|---|---|
| `bg-white` / `bg-slate-50` | `bg-card` |
| `bg-slate-100` | `bg-muted` |
| `text-slate-900` | `text-foreground` |
| `text-slate-500` | `text-muted-foreground` |
| `border-slate-200` | `border-border` |
| `bg-indigo-600` / `bg-cobalt-*` | `bg-primary` |
| `text-indigo-600` | `text-primary` |
| `bg-lime-400` | `bg-success` o `bg-secondary` según contexto |
| `bg-coral-500` | `bg-primary` (coral ahora es el primary) |
| `var(--accent-500)` | `hsl(var(--primary))` |
| `var(--lime-400)` | `hsl(var(--success))` |

- [ ] **Step 4: Agregar `shadow-neu` a cards principales**

Donde haya cards de KPIs o widgets destacados, agregar `shadow-neu` a la className.

- [ ] **Step 5: Verificar dark mode**

Toggle dark en el browser. Ningún elemento debe quedar con contraste insuficiente o color hardcoded que falle.

- [ ] **Step 6: Build verify**

Run: `pnpm tsc -b 2>&1 | tail -5` después de cada página.

- [ ] **Step 7: Commit incremental por sub-área (cada 3-5 páginas)**

```bash
git add src/app/\(dashboard\)/<area>/
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(fusion): restilar páginas <area> con Warm SaaS"
```

### Task E-A: Auth flows (Agente A)

**Páginas:**
- `src/app/(auth)/login/page.tsx` (ya hecho en D2 — solo verificar)
- Cualquier `forgot-password`, `reset-password`, `callback` existente

Run: `find src/app/\(auth\) -name 'page.tsx' 2>&1`

Aplicar recipe a cada una. Footer commit:

```bash
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(fusion): auth flows con Warm SaaS"
```

### Task E-B: Colaborador (Agente B)

**Páginas:**
- `src/app/(dashboard)/colaborador/page.tsx`
- `src/app/(dashboard)/colaborador/1to1/page.tsx` y subrutas (nueva, [id], etc.)
- `src/app/(dashboard)/colaborador/historial/page.tsx`
- `src/app/(dashboard)/colaborador/acuerdos/page.tsx`
- `src/app/(dashboard)/colaborador/configuracion/page.tsx`

Aplicar recipe. Atención especial a:
- KPI cards del dashboard del colaborador → `shadow-neu`
- Lista de acuerdos → tabla con `border-border`, hover `bg-muted/50`
- Charts (Recharts) → pasar `stroke="hsl(var(--primary))"` en lugar de hex hardcoded

### Task E-C: Líder (Agente C)

**Páginas:**
- `src/app/(dashboard)/lider/page.tsx`
- `src/app/(dashboard)/lider/1to1/page.tsx` y subrutas
- `src/app/(dashboard)/lider/equipo/page.tsx`
- `src/app/(dashboard)/lider/colaborador/page.tsx` y subrutas

Atención: vistas con datos de equipo (tabla de colaboradores) deben usar `bg-card` con `shadow-neu` y badges de cumplimiento con paleta `--success`/`--warning`/`--destructive`.

### Task E-D: Arquitectura Humana (Agente D)

**Páginas:**
- `src/app/(dashboard)/arquitectura-humana/page.tsx`
- `src/app/(dashboard)/arquitectura-humana/mapa-calor/page.tsx`
- `src/app/(dashboard)/arquitectura-humana/disputas/page.tsx`
- `src/app/(dashboard)/arquitectura-humana/cadencias/page.tsx`
- `src/app/(dashboard)/arquitectura-humana/usuarios/page.tsx`
- `src/app/(dashboard)/arquitectura-humana/estructura/page.tsx`
- `src/app/(dashboard)/arquitectura-humana/configuracion/page.tsx`
- `src/app/(dashboard)/arquitectura-humana/reportes/page.tsx`

Atención especial:
- **Mapa de calor**: gradiente debe usar `--success` (verde) → `--warning` (amarillo) → `--destructive` (rojo/coral). Reescribir las funciones de color generator.
- **Estructura (org chart)**: nodos en `bg-card`, conectores `border-border`, nodo activo `border-primary`.
- **Reportes IA**: badges de severidad con `--destructive` / `--warning` / `--success`.

### Task E-E: Shared states + componentes reutilizables (Agente E)

**Áreas:**
- Empty states de cualquier página vacía → ilustración + texto en `--muted-foreground`
- Loading skeletons → restilar para usar `bg-muted` con animación `animate-pulse`
- Error boundaries (`error.tsx` por área) → usar AlertDialog patterns
- Breadcrumbs si existen
- Header patterns que se repitan (en `src/components/shared/`)

Run: `grep -rln "skeleton\|empty-state\|loading-" src/components/shared src/components/one-on-one src/components/arquitectura-humana 2>&1`

Aplicar recipe a cada uno.

---

## Phase F — Integration + Polish (2 reviewers paralelos + 1 polish agent)

**Bloqueado por:** Phase E completa.

### Task F1: Cross-page consistency review (Reviewer 1)

**Files:** todas las páginas modificadas en Phase E.

- [ ] **Step 1: Grep residuos de paleta vieja**

```bash
grep -rEn "bg-(slate|indigo|cobalt|lime|coral|violet)-|text-(slate|indigo|cobalt|lime|coral|violet)-|#(0a0a0c|4f46e5|6366f1|84cc16|a3e635|f97316)" src/app src/components 2>&1 | grep -v node_modules
```
Expected output: vacío. Si hay matches, abrir issue por página o corregir.

- [ ] **Step 2: Grep vars cobalto/lime aún usadas**

```bash
grep -rEn "var\(--(accent|lime|coral|violet)-" src/app src/components 2>&1 | grep -v node_modules
```
Expected: vacío o solo en globals.css (donde están definidas como legacy, pero no usadas).

- [ ] **Step 3: Documentar findings**

Anexar a `docs/superpowers/specs/2026-05-13-template-fusion-page-map.md`:

```markdown
## F1 — Findings de consistency review

- [ ] `path/file.tsx:LINE` — `bg-indigo-600` aún presente
- ...
```

- [ ] **Step 4: Fix all findings**

Aplicar recipe en cada match.

- [ ] **Step 5: Commit**

```bash
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "fix(fusion): eliminar residuos de paleta cobalto/lime"
```

### Task F2: Dark mode + responsive QA (Reviewer 2)

**Files:** no modifica, solo verifica.

- [ ] **Step 1: Smoke test por viewport**

Run: `pnpm dev`.

Para cada página de la app:
1. Light mode 1280px+ → screenshot mental, anotar issues
2. Light mode 768px → idem
3. Light mode 375px → idem (sidebar drawer abre/cierra)
4. Dark mode 1280px+ → idem
5. Dark mode 375px → idem

- [ ] **Step 2: Documentar issues**

Anexar a page-map:

```markdown
## F2 — Findings dark/responsive

- `/colaborador` — dark: contraste header insuficiente
- `/arquitectura-humana/mapa-calor` — 375px: tooltips se cortan
```

- [ ] **Step 3: Abrir tasks fix para Phase F3**

Cada issue se vuelve un step de F3.

### Task F3: Polish final (Polish Agent)

**Files:** según findings de F1 y F2.

- [ ] **Step 1: Hover/focus states en buttons custom**

Run: `grep -rln "className=.*button\|<button" src/components src/app 2>&1 | head -20`

Verificar que cada `<button>` no-shadcn tiene `transition-colors` y `hover:bg-muted` o equivalente. Agregar si falta.

- [ ] **Step 2: Empty states con paleta nueva**

Cada empty state debe tener:
- Icon lucide-react en `text-muted-foreground` tamaño 48px
- Title en `text-foreground font-semibold`
- Description en `text-muted-foreground text-sm`
- CTA primary en `bg-primary text-primary-foreground`

- [ ] **Step 3: Loading skeletons**

Verificar que todos los skeletons usen `bg-muted animate-pulse`. Run:

```bash
grep -rn "bg-(slate|indigo|cobalt)-" src/components 2>&1 | grep -i skeleton
```
Si hay matches, fix.

- [ ] **Step 4: A11y sweep**

Verificar contraste de pares críticos con devtools:
- `#ED6134` sobre `#FBF9F7` — ~3.4:1 (insuficiente para texto largo, OK para botones)
- `#4A4A4A` sobre `#FBF9F7` — ~8:1 (OK)
- `#ED6134` sobre `#FEF3ED` (sidebar accent) — verificar
- En cards `bg-card` (#fff) → texto `#4A4A4A`: ~8.5:1 OK

Donde haya texto largo en `text-primary` sobre fondo claro, swap a `text-foreground` o agregar weight 600+.

- [ ] **Step 5: Final build + typecheck zero-error gate**

```bash
pnpm tsc -b 2>&1 | tail -5
```
Expected: zero errors, zero warnings.

```bash
pnpm build 2>&1 | tail -20
```
Expected: build verde, sin warnings de fuente faltante o CSS.

- [ ] **Step 6: Final commit**

```bash
git add -A
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(fusion): polish final — empty states, skeletons, a11y"
```

### Task F4: Squash merge a main

**Files:** rama `feat/template-fusion` → `main`.

- [ ] **Step 1: Verificar rama integradora limpia**

```bash
git status
git log --oneline -20
```

- [ ] **Step 2: Cambio a main y squash merge**

```bash
git checkout main
git merge --squash feat/template-fusion
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat: fusión visual template Warm SaaS sobre 1to1 (#ED6134, Montserrat, neumorphic)"
```

**No pushear sin confirmación de Ariel.**

- [ ] **Step 3: Push (solo con consent explícito)**

Esperar autorización. Cuando se autorice:

```bash
git push origin main
```

---

## Self-Review

**Spec coverage:**
- ✅ Sección "Decisiones de stack" → Phase A (tokens, Montserrat) + Phase C (componentes existentes)
- ✅ Sección "Design tokens" → Task A2 (HSL palette swap completo)
- ✅ Sección "Arquitectura de componentes" → Phase B (portados) + Phase C (restilados)
- ✅ Sección "Adaptaciones críticas" → Logo/AuthCard usan next/link, AuthLayout sin GSAP (Phase D)
- ✅ Plan de migración 5 olas → Phases A-F mapean 1:1 (A=Foundation, B=Componentes portables, C=Restyle layouts, D=Auth, E=Big bang dashboard, F=Integration+Polish)
- ✅ Testing & QA → Task F1, F2, F3 (consistency, dark/responsive, a11y)
- ✅ Riesgos: Recipe en E cubre swap de `useLocation`/`<Link>` (no aplica en restyle), conflicto Toaster (B5 usa shadcn existente), contraste (F3 step 4)

**Placeholder scan:** ninguna ocurrencia de TBD/TODO/"implement later"/"add appropriate".

**Type consistency:** `NavItem`, `UserRole`, `ConfirmOptions` consistentes entre tasks. `useConfirm()` definido en B4 y referenciado solo allí.

**Recipe pattern justification:** Phase E tiene un recipe genérico repetido por agente porque mecánicamente es la misma operación (swap de tokens) aplicada a 30+ archivos. Cada agente tiene su lista explícita de páginas con áreas de atención específicas. No es "TODO en otra parte" — es un patrón intencional para paralelización masiva.

---

**Plan completo y listo para ejecutar.** Saved to `docs/superpowers/plans/2026-05-13-template-fusion-1to1.md`.

Dos opciones de ejecución:

1. **Subagent-Driven (recomendado)** — dispatch fresh subagent por task, review entre tasks, fast iteration. Calza con tu memory `method_parallel_multiagent_waves`.
2. **Inline Execution** — ejecuta tasks en esta sesión con checkpoints para review.

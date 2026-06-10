# Server/Client Boundary Audit

## Usos de currentPath / x-pathname

| Archivo:línea | Tipo componente | Problema | Fix recomendado |
|---|---|---|---|
| `src/middleware.ts:7` | Middleware | **Bug crítico:** `supabaseResponse` se re-crea en `setAll` (línea 21) con `NextResponse.next({ request })` — sin pasar `requestHeaders`. Cuando Supabase necesita renovar cookies (token refresh), el nuevo response pierde el header `x-pathname`. El Server Component downstream recibirá `'/'` como fallback en esas requests. | En `setAll`, usar `NextResponse.next({ request: { headers: requestHeaders } })` igual que la asignación inicial, o copiar el header antes de re-crear el response. |
| `src/app/(dashboard)/layout.tsx:20-21` | Server Component (async) | Uso correcto de `headers()` + `x-pathname`. Sin embargo, **no declara `export const dynamic = 'force-dynamic'`**. `headers()` ya implica dynamic rendering en Next.js 14, pero la ausencia de la declaración explícita puede causar advertencias de build o comportamiento inesperado si Next decide cachear el segmento. | Agregar `export const dynamic = 'force-dynamic'` al inicio del archivo. |
| `src/app/(dashboard)/layout.tsx:21` | Server Component | El fallback cuando `x-pathname` es `null` es `'/'`. Si el bug de middleware (arriba) ocurre, el sidebar marcará todos los ítems como inactivos y el breadcrumb mostrará `'Inicio'` en páginas que no lo son. | Fallback a `request.nextUrl.pathname` en el middleware (solución de raíz). Alternativa defensiva: el layout podría leer también `request.headers.get('referer')` aunque no es fiable. |
| `src/components/layout/app-shell.tsx:31,44` | Client Component (`'use client'`) | `currentPath` (string) se pasa como prop desde el Server Layout. La línea 44 ya tiene el patrón correcto: `usePathname() ?? currentPath`. El `?? currentPath` es el fallback de SSR para el primer render. **Uso correcto**, pero documentado para claridad. | Sin cambios requeridos. El comentario en línea 41-43 explica la intención. |
| `src/components/layout/sidebar.tsx:64` | Client Component (`'use client'`) | Recibe `currentPath` como prop del `AppShell` (que ya aplica `usePathname()`). El valor siempre refleja la ruta activa del cliente. **Uso correcto.** | Sin cambios requeridos. |
| `src/lib/nav.ts:53-56` | Módulo utilitario puro (sin directiva) | `isNavItemActive` recibe `currentPath: string` como parámetro; no tiene acceso directo a headers ni al router. **Correcto.** | Sin cambios requeridos. |

---

## Otros problemas server/client encontrados

| Archivo:línea | Problema | Severidad | Fix |
|---|---|---|---|
| `src/middleware.ts:21` | **`supabaseResponse` re-asignado sin `requestHeaders`** — cuando `setAll` es invocado (refresh de sesión), el nuevo `NextResponse.next({ request })` usa `request` original sin el header `x-pathname`. El header inyectado se pierde para esa request. | **Alta** | Cambiar línea 21 a: `supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })` |
| `src/app/layout.tsx:42-51` | `window.matchMedia(...)` dentro de un string de `<script dangerouslySetInnerHTML>`. El script se inyecta como JS inline en el HTML y corre en el browser — **no** es código JS de Node/Server Component. **Uso correcto técnicamente**, pero si alguien mueve el contenido a código TS/TSX del módulo, fallaría en SSR. | Informativa | Mantener siempre dentro de `dangerouslySetInnerHTML`. Agregar comentario `// browser-only inline script`. |
| `src/app/(auth)/login/page.tsx:57` | `window.location.origin` dentro de `handleGoogleLogin` — función async llamada desde un evento de click. El archivo tiene `'use client'` (línea 1). **Uso correcto**: corre solo en el browser. | Informativa | Sin cambios requeridos. El patrón es seguro porque es un event handler. |
| `src/components/settings/settings-shell.tsx:486` | `window.matchMedia(...)` dentro de `useEffect` con guarda `if (typeof document === 'undefined') return`. **Uso correcto**: la guarda evita ejecución en SSR. Sin embargo, la guarda debería ser `typeof window === 'undefined'` para ser semánticamente más preciso (se accede a `window`, no a `document`). | Baja | Cambiar guarda a `if (typeof window === 'undefined') return` en línea 484. |
| `src/hooks/use-keyboard-shortcuts.ts:64-66` | `window.addEventListener` dentro de un hook con `'use client'`. Uso dentro de `useEffect` — **correcto**, solo corre en browser. | OK | Sin cambios requeridos. |
| `src/components/layout/command-palette.tsx:141-142` | `window.addEventListener` dentro de `useEffect` en Client Component. **Correcto.** | OK | Sin cambios requeridos. |
| `src/components/layout/app-shell.tsx:94-95` | `window.addEventListener` dentro de `useEffect` en Client Component. **Correcto.** | OK | Sin cambios requeridos. |
| `src/lib/supabase/server.ts:5` | `cookies()` en función de utilidad del servidor. El archivo no tiene `'use client'`. **Correcto** — es un helper de Server Component / Route Handler. | OK | Sin cambios requeridos. |
| `src/app/api/auth/callback/route.ts:13` | `cookies()` en Route Handler (GET). **Correcto** — los Route Handlers tienen acceso al request context de Next.js. | OK | Sin cambios requeridos. |

---

## OK (usos correctos confirmados)

| Archivo | Patrón | Confirmación |
|---|---|---|
| `src/components/layout/app-shell.tsx` | `usePathname() ?? currentPath` | Client Component. `usePathname` se actualiza en navegación SPA; `currentPath` solo es fallback de primer render. Patrón canónico. |
| `src/components/layout/sidebar.tsx` | Recibe `currentPath` como prop | Prop ya resuelto por `AppShell` desde `usePathname()`. Nunca usa headers directamente. |
| `src/lib/nav.ts` | `isNavItemActive(item, currentPath)` | Función pura. No accede a contexto de server/client. |
| `src/lib/supabase/server.ts` | `cookies()` | Solo llamado desde Server Components y Route Handlers. |
| `src/app/(dashboard)/layout.tsx` | `headers()` | Server Component async. Acceso legítimo a request headers. |
| `src/app/(auth)/login/page.tsx` | `window.location.origin` | Dentro de event handler en Client Component con `'use client'`. Nunca ejecuta en SSR. |
| `src/app/layout.tsx` | `window.matchMedia` | Dentro de string de script inline (`dangerouslySetInnerHTML`). Nunca parseado por el compilador TS. |
| `src/hooks/use-keyboard-shortcuts.ts` | `window.addEventListener` | Dentro de `useEffect` en hook `'use client'`. |

---

## Resumen de acciones requeridas

1. **[Alta] Middleware line 21** — `supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })` para que el header `x-pathname` sobreviva al token refresh.
2. **[Media] Dashboard layout** — agregar `export const dynamic = 'force-dynamic'` para hacer explícito el rendering dinámico.
3. **[Baja] settings-shell.tsx line 484** — cambiar guarda SSR de `typeof document` a `typeof window`.

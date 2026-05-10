# Prompt seed — reescritura del frontend (v2)

> Copia el bloque siguiente y pégalo como **primer mensaje** en una conversación nueva con Claude Code (o Claude.ai si tienes acceso al filesystem). Está pensado para que el agente arranque sabiendo qué hay, qué tocar y qué NO tocar.

---

## Bloque a copiar

```
Vas a reescribir SOLO el frontend de un sistema de 1:1s ya en producción de desarrollo. El backend (Supabase + RLS + AI + integraciones) está sólido y NO se toca. Lee CONTEXT.md en la raíz del repo antes de hacer nada — tiene el modelo de datos, los flujos, los prompts de IA, los roles y las 10 lecciones validadas en la sesión anterior. No vuelvas a cometer esos 10 errores.

# Working directory
/Users/ariel/Desktop/1 to 1

# Lo que NO debes tocar (rompe el sistema)
- supabase/migrations/*.sql (schema + RLS + triggers)
- src/lib/{actions,ai,google,slack,email,supabase,validations,utils,constants.ts}
- src/types/{database,domain}.ts
- src/middleware.ts
- src/app/api/**/* (rutas del backend)
- scripts/* (tooling de DB y screenshots)
- package.json, next.config.js, tsconfig.json, tailwind.config.ts

# Lo que SÍ vas a reescribir
- src/app/(auth)/login/page.tsx
- src/app/(dashboard)/layout.tsx
- src/app/(dashboard)/colaborador/**/*.tsx
- src/app/(dashboard)/lider/**/*.tsx
- src/app/(dashboard)/arquitectura-humana/**/*.tsx
- src/components/{layout,one-on-one,hr,settings,shared}/*.tsx
- src/app/globals.css (puedes mantener los :root tokens si te sirven)

# Lo que se conserva tal cual
- src/components/ui/* (shadcn primitives ya están bien)

# Reglas de oro (no negociables, leídas de CONTEXT.md §11)
1. Sin "eyebrows" azules redundantes encima del título serif. El sidebar + el título YA identifican la sección.
2. Empty state ≠ "0%" en rojo. Si no hay datos: tono slate neutral + "—" subtle. Nunca rojo alarmante para áreas sin reuniones todavía.
3. Sidebar role-aware POR URL, no por rol fijo. El rol determina ACCESO; la URL determina QUÉ NAV mostrar. Role-switcher arriba para users con multi-acceso (HR ve los 3, líder ve 2, colab ve 1).
4. Estructura organizacional como árbol: cada líder UNA vez con sus reportes anidados. NO una fila por par líder↔reporte.
5. Disputas: badges informativos NO deben parecer botones. CTA real "Resolver disputa →" prominente.
6. Reportes IA: badge de categoría (Cumplimiento/Cadencia/Disputa/Acuerdos/Engagement) + border-left por severidad para escaneo rápido.
7. Dashboard del colaborador necesita sección "Pendientes de confirmar" (1:1s pasadas con scheduled_at < now y status='agendada' donde el usuario no ha dado VoBo). Es el flujo crítico de transparencia.
8. La "otra parte" en una 1:1 NO es siempre el líder. Cuando un líder ve sus 1:1s en /colaborador, el otro participante es el COLABORADOR. Calcular dinámicamente: m.leader_id === user.id ? collaborator : leader.
9. Formato de %: usar src/lib/utils/format.ts (formatPct, formatCount). Nada de toFixed(2) ni "33.33%".
10. Login button primary: clase ui-btn--accent (azul vivo), NO ui-btn--primary (slate-900 que se ve gris).

# Stack técnico (no cambiar)
- Next.js 14 App Router + TypeScript + React 18
- Tailwind CSS + shadcn/ui (Radix primitives)
- Supabase como DB + Auth (RLS activo, no bypass)
- Server Components por defecto. 'use client' solo donde haya interactividad real.
- Server Actions de src/lib/actions para mutaciones, NO crear API routes nuevas.

# Roles y rutas (de CONTEXT.md §8)
- /colaborador, /colaborador/{1to1/nueva, 1to1/[id], acuerdos, configuracion}
- /lider, /lider/{equipo, insights, 1to1/[id], configuracion}
- /arquitectura-humana, /arquitectura-humana/{mapa-calor, reportes, disputas, cadencias, estructura, usuarios, configuracion}

# Cómo verificar tu trabajo
Después de CADA sección que reescribas:
1. pnpm exec tsc --noEmit                        # debe pasar limpio
2. pnpm dev (si no está corriendo en :3000)
3. pnpm exec tsx scripts/ux-screenshots.ts        # captura todas las pantallas en /tmp/ux-shots
4. Lee los PNGs relevantes con tu tool Read       # validas visualmente
5. Si encuentras issues, arregla antes de seguir

Las credenciales de prueba están en CONTEXT.md §scripts útiles. Para login automático:
- Tu cuenta HR: acalderonm@b-drive.com.mx / elmata01
- Líder demo: lider.tech@demo.com / Demo1234!
- Colab demo: dev1@demo.com / Demo1234!

# Orden de reconstrucción recomendado
1. globals.css — decide qué tokens conservar (recomiendo conservarlos)
2. (dashboard)/layout.tsx + components/layout/{sidebar,header} — la base
3. (auth)/login — pantalla pública
4. components/shared/{empty-state,confirm-dialog,loading-spinner} — primitivos
5. (dashboard)/colaborador/page.tsx + el resto de colab — flujo más usado
6. components/one-on-one/* — formularios, vobo, minutas, agendas, acuerdos
7. (dashboard)/colaborador/1to1/[id] + 1to1/nueva
8. (dashboard)/lider/* — resumen, equipo, insights, 1to1/[id]
9. (dashboard)/arquitectura-humana/* — panel global, mapa, estructura, disputas, etc.
10. components/settings + las 3 páginas de configuración
11. Recapture final + comparar contra /tmp/ux-shots-vobo (último estado bueno previo)

# Filosofía de diseño
- Empresarial pero moderno. Tipografía serif para títulos (Source Serif 4) sobre Inter para UI.
- Densidad cómoda, no apretada. Mucho whitespace.
- Color base slate (gris azulado), accent azul (#2563eb), semánticos suaves.
- Animaciones sutiles (fade-in-up, stagger), nunca decorativas.
- Accesibilidad: focus visible, aria correctos, contraste WCAG AA.
- Responsive desktop-first (la app vive en escritorio).

# Antes de empezar
Pregunta al usuario:
- ¿Quiere mantener el DS "Editorial Slate + Serif" o pivotar a otro look?
- ¿Algún elemento del diseño actual que SÍ quiera conservar tal cual?
- ¿Algo que odie del diseño actual y quiera asegurarse de cambiar?

NO empieces a escribir código sin esa alineación. Las reescrituras a ciegas son las que terminan iguales o peores que el original.

# Cuando termines cada sección
- Reporte breve (≤5 líneas) de qué cambió y por qué
- Screenshots antes/después de la sección
- Marca las tareas pendientes que quedaron a propósito (no perfeccionar de más en sprint inicial)

Empieza leyendo CONTEXT.md ahora.
```

---

## Cómo usarlo

1. Abre una conversación nueva en Claude Code en `/Users/ariel/Desktop/1 to 1`.
2. Pega el bloque entre los ``` (sin las comillas).
3. El agente leerá `CONTEXT.md` automáticamente como primer paso.
4. Te hará 3 preguntas de alineación antes de tocar código.
5. Trabajará por secciones, recapturando entre cada una.

## Tip importante

La sesión anterior dejó capturas de referencia en:
- `/tmp/ux-shots-vobo/` — último estado bueno

Si la v2 va por mal camino, esas capturas son tu baseline para revertir.

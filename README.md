# Sistema de Seguimiento de 1:1s

Plataforma web interna para la gestión, agendado y seguimiento de reuniones uno a uno (1:1) entre colaboradores y líderes, con visibilidad para Recursos Humanos sobre el cumplimiento y la salud organizacional, sin comprometer la privacidad del contenido conversado.

---

## 📋 Tabla de Contenidos

- [Contexto y Propósito](#contexto-y-propósito)
- [Objetivos](#objetivos)
- [Alcance](#alcance)
- [Roles del Sistema](#roles-del-sistema)
- [Funcionalidades](#funcionalidades)
- [Privacidad y Seguridad](#privacidad-y-seguridad)
- [Validación de Cumplimiento](#validación-de-cumplimiento)
- [Stack Tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [Modelo de Datos](#modelo-de-datos)
- [Integraciones](#integraciones)
- [Instalación y Configuración](#instalación-y-configuración)
- [Variables de Entorno](#variables-de-entorno)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Fases de Implementación](#fases-de-implementación)
- [Equipo](#equipo)

---

## Contexto y Propósito

Las reuniones 1:1 son una práctica fundamental para el desarrollo de las personas, la alineación de expectativas y la detección temprana de problemas en los equipos. Sin embargo, su realización suele ser inconsistente y RH carece de visibilidad sobre si efectivamente están ocurriendo, con qué frecuencia y si están generando valor.

Este sistema busca **profesionalizar la práctica de 1:1s** en la organización, brindando:

- A los **colaboradores**: un espacio seguro para preparar, registrar y dar seguimiento a sus 1:1s.
- A los **líderes**: una herramienta para gestionar las 1:1s con su equipo y dar seguimiento a compromisos.
- A **Recursos Humanos**: visibilidad agregada del cumplimiento y la salud de la práctica, sin acceder al contenido privado de las conversaciones.

---

## Objetivos

1. Estandarizar la práctica de 1:1s entre líderes y colaboradores (≈400 personas).
2. Facilitar el agendado, registro y seguimiento de cada reunión.
3. Crear un repositorio histórico de acuerdos y compromisos por persona.
4. Brindar a RH métricas de cumplimiento y tendencias organizacionales.
5. Garantizar la privacidad del contenido de las 1:1s para fomentar conversaciones honestas.

---

## Alcance

### Dentro del alcance

- Reuniones 1:1 entre líder directo y colaborador.
- Modalidad virtual (Google Meet) y presencial.
- Integración con Google Workspace (SSO + Calendar).
- Dashboard operativo para líderes y dashboard de cumplimiento para RH.
- Sistema de notificaciones (in-app y email).
- Configuración de cadencias por área o globales.

### Fuera del alcance (por ahora)

- Reuniones grupales o de equipo.
- Evaluaciones de desempeño formales.
- Gestión de objetivos (OKRs/KPIs).
- Grabación o transcripción de conversaciones (decisión deliberada por privacidad).
- Integraciones con otros calendarios (Outlook, etc.).

---

## Roles del Sistema

| Rol | Descripción | Permisos clave |
|-----|-------------|----------------|
| **Colaborador** | Cualquier persona de la organización | Agendar 1:1s con su líder, capturar notas y acuerdos, ver su historial |
| **Líder** | Personas con reportes directos | Todo lo del colaborador + dashboard de su equipo + recordatorios de cadencia |
| **RH / Admin** | Equipo de Recursos Humanos | Dashboards de cumplimiento, configuración de cadencias, gestión de relaciones líder-colaborador, **sin acceso al contenido de las notas** |

---

## Funcionalidades

### Gestión de 1:1s

- Agendado de reuniones con selección de modalidad (virtual o presencial)
- Sincronización automática con Google Calendar
- Generación automática de link de Google Meet para reuniones virtuales
- Captura de ubicación para reuniones presenciales (sala, oficina, etc.)
- Reagendado y cancelación con motivo

### Agenda y Notas

- Agenda compartida pre-reunión: ambos participantes pueden agregar temas
- Captura de notas durante o después de la reunión
- Registro de acuerdos con responsable y fecha límite
- Seguimiento de compromisos de juntas anteriores
- Check-in de estado de ánimo del colaborador (opcional)

### Dashboard del Líder

- Vista de todas las 1:1s con su equipo
- Próximas reuniones agendadas
- Recordatorios cuando una 1:1 está atrasada según cadencia
- Acuerdos pendientes por colaborador
- Historial completo por persona

### Dashboard de RH

- Métricas de cumplimiento por área, líder y empresa
- Alertas de líderes que no cumplen cadencia
- Tendencias de estado de ánimo (agregado, anónimo)
- Configuración de cadencias esperadas
- Gestión de la estructura organizacional

### Notificaciones

- Recordatorio antes de la 1:1
- Solicitud de confirmación post-reunión
- Recordatorio de acuerdos próximos a vencer
- Alerta cuando se acerca el fin de la cadencia sin reunión agendada

---

## Privacidad y Seguridad

> **Principio rector**: el contenido de las 1:1s es privado entre los dos participantes. RH ve metadata, nunca contenido.

- **Notas, acuerdos y temas de agenda**: visibles únicamente para el colaborador y su líder directo.
- **Metadata visible para RH**: fecha, duración, modalidad, estado (realizada/no realizada), motivo de cancelación si aplica.
- **No se graba audio ni video** de las conversaciones bajo ninguna circunstancia.
- **Row Level Security (RLS)** en Supabase para garantizar el aislamiento a nivel de base de datos.
- **Autenticación SSO** vía Google Workspace.
- **Cumplimiento con LFPDPPP** (Ley Federal de Protección de Datos Personales en Posesión de los Particulares).
- **Aviso de privacidad** visible y aceptado en el primer ingreso.

---

## Validación de Cumplimiento

Una 1:1 se considera **realizada** si cumple al menos una de las siguientes señales:

1. **Confirmación de ambos participantes** post-reunión (mecanismo principal).
2. **Captura de notas o acuerdos** por al menos uno de los participantes.
3. **Confirmación automática vía Google Meet** (para reuniones virtuales: ambos se conectaron).
4. **No fue cancelada en Calendar** y pasó la fecha sin objeción de ninguna parte.

### Estados posibles

- `agendada`: futura
- `realizada`: confirmada por las señales anteriores
- `no_realizada`: con motivo (reagendada, cancelada por cargas, ausencia, sin justificación)
- `en_disputa`: los participantes reportan estados diferentes (visible para RH para revisión)

---

## Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 14+ (App Router), TypeScript, React |
| Estilos | Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes / Server Actions |
| Base de datos | PostgreSQL (vía Supabase) |
| Auth | Supabase Auth + Google Workspace SSO |
| ORM | Prisma o Supabase Client |
| Calendario | Google Calendar API |
| Videoconferencia | Google Meet (vía Calendar API) |
| Notificaciones | Resend / Email + Notificaciones in-app |
| Hosting | Vercel |
| CI/CD | GitLab CI/CD |

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                     Cliente (Browser)                    │
│              Next.js App Router + React                  │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│              Next.js Server (Vercel)                     │
│      API Routes / Server Actions / Middleware            │
└──────┬─────────────────┬──────────────────┬─────────────┘
       │                 │                  │
       ▼                 ▼                  ▼
┌─────────────┐  ┌──────────────┐  ┌────────────────┐
│  Supabase   │  │ Google APIs  │  │   Resend       │
│ (Postgres + │  │  (Calendar,  │  │   (Email)      │
│   Auth +    │  │   Meet, SSO) │  │                │
│    RLS)     │  │              │  │                │
└─────────────┘  └──────────────┘  └────────────────┘
```

---

## Modelo de Datos

Entidades principales:

- **users**: información básica sincronizada con Google Workspace
- **departments**: áreas/departamentos de la organización
- **leadership_relations**: relación líder ↔ colaborador (puede ser multinivel)
- **cadence_configs**: cadencias esperadas (por área o global)
- **one_on_ones**: cada reunión con su metadata
- **agenda_items**: temas pre-reunión
- **notes**: notas de la reunión (privadas)
- **commitments**: acuerdos con responsable y fecha
- **mood_checkins**: estado de ánimo del colaborador
- **confirmations**: confirmaciones post-reunión por participante
- **notifications**: notificaciones in-app

---

## Integraciones

### Google Workspace

- **SSO**: autenticación vía OAuth 2.0
- **Calendar API**: creación, actualización y eliminación de eventos
- **Meet**: generación automática de links para reuniones virtuales
- **Directory API** (opcional): sincronización de la estructura organizacional

### Email

- Resend para notificaciones transaccionales

---

## Instalación y Configuración

### Requisitos previos

- Node.js 20+
- pnpm (recomendado) o npm
- Cuenta de Supabase
- Proyecto en Google Cloud con Calendar API habilitada
- Cuenta de Resend (o equivalente)

### Pasos

```bash
# Clonar el repositorio
git clone https://gitlab.com/[organizacion]/sistema-1to1.git
cd sistema-1to1

# Instalar dependencias
pnpm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales

# Ejecutar migraciones de base de datos
pnpm db:migrate

# Iniciar en modo desarrollo
pnpm dev
```

---

## Variables de Entorno

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# Email
RESEND_API_KEY=

# App
NEXT_PUBLIC_APP_URL=
```

---

## Estructura del Proyecto

```
sistema-1to1/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # Rutas de autenticación
│   ├── (dashboard)/            # Rutas autenticadas
│   │   ├── colaborador/
│   │   ├── lider/
│   │   └── rh/
│   ├── api/                    # API Routes
│   └── layout.tsx
├── components/                 # Componentes React
│   ├── ui/                     # shadcn/ui
│   └── features/               # Componentes por feature
├── lib/                        # Utilidades
│   ├── supabase/
│   ├── google/
│   └── email/
├── prisma/                     # Schema y migraciones
├── public/
├── types/                      # TypeScript types
└── README.md
```

---



## Fases de Implementación

### Fase 1 — MVP
- [ ] Auth con Google Workspace
- [ ] Estructura organizacional (líder ↔ colaborador)
- [ ] Agendado básico de 1:1s
- [ ] Integración con Google Calendar
- [ ] Captura de notas y acuerdos

### Fase 2 — Seguimiento
- [ ] Confirmación post-reunión
- [ ] Seguimiento de compromisos
- [ ] Check-in de estado de ánimo
- [ ] Dashboard del líder

### Fase 3 — RH
- [ ] Dashboard de cumplimiento
- [ ] Configuración de cadencias
- [ ] Sistema de alertas
- [ ] Métricas agregadas

### Fase 4 — Pulido
- [ ] Notificaciones por email
- [ ] Optimización de UX
- [ ] Pruebas con usuarios piloto
- [ ] Despliegue en producción

---

## Equipo

- **Sponsor**: Recursos Humanos
- **Product Owner**: [Por definir]
- **Desarrollo**: [Por definir]
- **Diseño**: [Por definir]

---

## Licencia

Proyecto interno — Uso restringido a la organización.

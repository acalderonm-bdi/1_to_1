# Sistema de Seguimiento de 1:1s

Plataforma web interna para la gestión, agendado y seguimiento de reuniones uno a uno (1:1) entre colaboradores y líderes, con visibilidad para el área de **Arquitectura Humana** sobre el cumplimiento y la salud organizacional. Incorpora **inteligencia artificial** para estructurar acuerdos, dar acompañamiento al líder y detectar patrones que requieran atención.

---

## 📋 Tabla de Contenidos

- [Contexto y Propósito](#contexto-y-propósito)
- [Objetivos](#objetivos)
- [Alcance](#alcance)
- [Roles del Sistema](#roles-del-sistema)
- [Funcionalidades](#funcionalidades)
- [Flujo de una 1:1](#flujo-de-una-11)
- [Inteligencia Artificial en el Sistema](#inteligencia-artificial-en-el-sistema)
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

Las reuniones 1:1 son una práctica fundamental para el desarrollo de las personas, la alineación de expectativas y la detección temprana de problemas en los equipos. Sin embargo, su realización suele ser inconsistente y Arquitectura Humana carece de visibilidad sobre si efectivamente están ocurriendo, con qué frecuencia y si están generando valor real (compromisos que se cumplen).

Este sistema busca **profesionalizar la práctica de 1:1s** en la organización (≈400 colaboradores), brindando:

- A los **colaboradores**: un espacio para preparar, registrar y dar seguimiento a sus 1:1s.
- A los **líderes**: una herramienta de gestión + acompañamiento con IA para hacer mejores 1:1s.
- A **Arquitectura Humana**: visibilidad de los acuerdos, su cumplimiento, reportes automatizados y mapas de calor por área.

---

## Objetivos

1. Estandarizar la práctica de 1:1s entre líderes y colaboradores.
2. Facilitar el agendado, registro y seguimiento de cada reunión.
3. Estructurar los acuerdos con IA para garantizar claridad y trazabilidad.
4. Acompañar al líder con sugerencias inteligentes para hacer mejores 1:1s.
5. Brindar a Arquitectura Humana mapas de calor, reportes y alertas automatizadas.
6. Generar accountability real sobre el cumplimiento de compromisos.

---

## Alcance

### Dentro del alcance

- Reuniones 1:1 entre líder directo y colaborador.
- Modalidad virtual (Google Meet) y presencial.
- Integración con Google Workspace (SSO + Calendar).
- Notificaciones a Slack ante incumplimientos.
- Procesamiento de minutas con IA.
- Acompañamiento al líder con sugerencias de IA.
- Dashboards diferenciados por rol.
- Mapa de calor organizacional por áreas.

### Fuera del alcance (por ahora)

- Reuniones grupales o de equipo.
- Evaluaciones de desempeño formales.
- Gestión de objetivos (OKRs/KPIs).
- Grabación o transcripción de conversaciones.
- Integraciones con otros calendarios (Outlook, etc.).

---

## Roles del Sistema

| Rol | Descripción | Permisos clave |
|-----|-------------|----------------|
| **Colaborador** | Cualquier persona de la organización | Agendar 1:1s con su líder, capturar acuerdos, dar VoBo, ver su historial, reportar cumplimiento de acuerdos previos |
| **Líder** | Personas con reportes directos | Todo lo del colaborador + dashboard de su equipo + sugerencias de IA + recordatorios de cadencia |
| **Arquitectura Humana** | Equipo de RH | Dashboards globales, mapa de calor por áreas, alertas de incumplimiento, **visibilidad de acuerdos y su cumplimiento**, reportes automáticos generados por IA, validación del seguimiento del líder |

---

## Funcionalidades

### Gestión de 1:1s

- Agendado de reuniones con selección de modalidad (virtual o presencial)
- **Calendarización automática** en Google Calendar
- Generación automática de link de Google Meet para reuniones virtuales
- Captura de ubicación para reuniones presenciales
- Reagendado y cancelación con motivo

### Minuta y Acuerdos

- **Plantilla de minuta** con campos estructurados
- Captura de acuerdos por ambos participantes al finalizar la 1:1
- **Procesamiento con IA**: el texto libre se transforma en una lista estructurada de acuerdos (descripción, responsable, fecha objetivo)
- Visibilidad compartida de los acuerdos entre líder, colaborador y Arquitectura Humana
- Historial de acuerdos por persona

### VoBo (Validación de Realización)

- Al finalizar la 1:1, **ambos participantes deben confirmar de forma independiente** que la reunión se realizó
- Si ambos confirman → 1:1 marcada como realizada
- Si discrepan → estado "en disputa" para revisión de Arquitectura Humana
- En la **siguiente 1:1**, antes de dar el VoBo, el sistema pregunta sobre los acuerdos previos (cumplidos, parciales, no cumplidos, con justificación)

### Acompañamiento al Líder con IA

- Sugerencias de **preguntas inteligentes** basadas en el historial del colaborador
- **Planes de seguimiento** generados a partir de la minuta
- Recomendaciones para asegurar el cumplimiento de los acuerdos
- Tips contextuales según patrones detectados (ej. acuerdos repetidamente incumplidos)

### Notificaciones

- **Slack**: alerta automática cuando no se realiza una 1:1 según cadencia
- **Email**: recordatorios de reuniones, confirmaciones, vencimiento de acuerdos
- **In-app**: notificaciones operativas

### Dashboard del Colaborador

- Próximas 1:1s
- Acuerdos pendientes propios
- Historial de sus 1:1s
- Espacio para preparar agenda pre-reunión

### Dashboard del Líder

- Vista de todas las 1:1s con su equipo
- Próximas reuniones agendadas
- Recordatorios de cadencia
- Acuerdos pendientes por colaborador
- Sugerencias de IA por persona
- Historial completo por colaborador

### Dashboard de Arquitectura Humana

- **Mapa de calor** por áreas: cumplimiento de 1:1s a nivel organizacional
- Métricas por líder, área y empresa
- **Visibilidad de acuerdos generados** y su estado de cumplimiento
- Alertas de líderes que no cumplen cadencia
- **Reportes automáticos generados por IA** cuando se detectan patrones (ej. acuerdos sistemáticamente no cumplidos, 1:1s sin contenido relevante, escalada de problemas)
- Casos en disputa para revisión
- Configuración de cadencias esperadas
- Gestión de la estructura organizacional
- Herramientas de validación del seguimiento del líder a compromisos

---

## Flujo de una 1:1

```
1. AGENDADO
   └─> Colaborador o líder agenda → Google Calendar (auto) → Notificación

2. PRE-REUNIÓN
   └─> Ambos pueden agregar temas a la agenda compartida (privada)

3. REUNIÓN (virtual o presencial)
   └─> Conversación libre, sin grabación

4. POST-REUNIÓN
   ├─> Ambos capturan los acuerdos en la plantilla de minuta
   ├─> IA procesa el texto → lista estructurada de acuerdos
   ├─> Acuerdos quedan visibles para líder, colaborador y Arquitectura Humana
   ├─> Ambos dan VoBo independiente de que la 1:1 se realizó
   └─> Si hay discrepancia → "en disputa" → revisión de Arquitectura Humana

5. ENTRE 1:1s
   ├─> Slack avisa si pasó la cadencia sin nueva 1:1
   ├─> IA prepara sugerencias para el líder de cara a la siguiente
   └─> Recordatorios de acuerdos próximos a vencer

6. SIGUIENTE 1:1
   └─> Antes del VoBo: revisión de acuerdos previos (cumplido / parcial / no cumplido)
       └─> IA analiza patrones; si detecta problemas → reporte a Arquitectura Humana
```

---

## Inteligencia Artificial en el Sistema

La IA se usa de forma transparente y con un propósito claro en cuatro lugares:

### 1. Estructuración de acuerdos
Toma el texto libre de la minuta y lo convierte en una lista limpia: descripción del acuerdo, responsable, fecha objetivo, criterios de cumplimiento.

### 2. Acompañamiento al líder
Sugiere preguntas relevantes para la siguiente 1:1 basadas en el historial del colaborador, los acuerdos pendientes y patrones detectados.

### 3. Análisis de seguimiento
Cuando el colaborador o líder reportan cumplimiento (o falta de él) de acuerdos previos, la IA analiza patrones: ¿se repiten incumplimientos? ¿Las 1:1s tienen contenido sustancial? ¿Hay señales de problemas que requieren atención?

### 4. Reportes automáticos a Arquitectura Humana
Si la IA detecta patrones que requieren atención (ej. múltiples 1:1s sin acuerdos, incumplimiento sistemático, escalada de tensiones), genera un reporte agregado para Arquitectura Humana con conclusiones y recomendaciones.

> La IA procesa contenido únicamente para los fines anteriores. No se almacena más allá de lo necesario y no se usa para entrenar modelos externos.

---

## Privacidad y Seguridad

> **Principio rector**: la información se segmenta según el rol. Los acuerdos formales son visibles para Arquitectura Humana para garantizar accountability; el espacio de preparación y trabajo personal sigue siendo privado entre los participantes.

### Lo que ven los participantes (líder + colaborador)
- La minuta cruda y los acuerdos
- La agenda compartida pre-reunión
- Histórico completo de sus 1:1s

### Lo que ve Arquitectura Humana
- Metadata: fecha, duración, modalidad, estado (realizada / no realizada / en disputa)
- **Acuerdos estructurados** generados por IA (descripción, responsable, fecha objetivo)
- **Estado de cumplimiento** de cada acuerdo (cumplido / parcial / no cumplido)
- Reportes automáticos generados por IA con conclusiones y recomendaciones
- Mapas de calor y métricas por área
- Casos en disputa para arbitraje

### Lo que NO ve Arquitectura Humana
- La minuta cruda (texto libre antes del procesamiento de IA)
- La agenda pre-reunión (preparación privada de los participantes)
- Audio o video (no se graba bajo ninguna circunstancia)

### Marco legal
- El uso del sistema y la visibilidad de Arquitectura Humana sobre los acuerdos está cubierto en el contrato laboral de los colaboradores.
- Cumplimiento con **LFPDPPP** (Ley Federal de Protección de Datos Personales en Posesión de los Particulares).

### Controles técnicos
- **Row Level Security (RLS)** en Supabase a nivel base de datos
- **Autenticación SSO** vía Google Workspace
- Logs de auditoría para accesos sensibles

---

## Validación de Cumplimiento

Una 1:1 se considera **realizada** cuando:

1. **Ambos participantes dan VoBo** post-reunión (mecanismo principal).
2. Hay **acuerdos capturados** en la minuta.
3. Para reuniones virtuales: confirmación automática vía Google Meet (ambos se conectaron).

### Estados posibles de la 1:1

- `agendada`: futura
- `realizada`: ambas partes dieron VoBo
- `no_realizada`: con motivo (reagendada, cancelada por cargas, ausencia, sin justificación)
- `en_disputa`: los participantes reportan estados diferentes → revisión de Arquitectura Humana

### Estados de acuerdos

- `pendiente`: aún no llega su fecha objetivo
- `cumplido`: ambas partes lo confirman
- `parcial`: avance pero no completado
- `no_cumplido`: con justificación opcional

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
| Inteligencia Artificial | Anthropic Claude API |
| Notificaciones | Slack API, Resend (email) |
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
└──┬──────────┬──────────┬──────────┬──────────┬─────────┘
   │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼
┌──────┐  ┌────────┐  ┌──────┐  ┌──────┐  ┌────────┐
│Supa- │  │ Google │  │Claude│  │Slack │  │ Resend │
│base  │  │  APIs  │  │ AI   │  │ API  │  │(Email) │
│(DB + │  │(Cal +  │  │      │  │      │  │        │
│ Auth)│  │ Meet)  │  │      │  │      │  │        │
└──────┘  └────────┘  └──────┘  └──────┘  └────────┘
```

---

## Modelo de Datos

Entidades principales:

- **users**: información sincronizada con Google Workspace
- **departments**: áreas de la organización
- **leadership_relations**: relación líder ↔ colaborador (multinivel)
- **cadence_configs**: cadencias esperadas (por área o global)
- **one_on_ones**: cada reunión con su metadata
- **agenda_items**: temas pre-reunión (privados a los participantes)
- **minutes**: minuta cruda capturada por ambos (privada a los participantes)
- **agreements**: acuerdos estructurados por IA (visibles para Arquitectura Humana)
- **agreement_followups**: seguimiento de cumplimiento de acuerdos
- **vobos**: confirmaciones independientes por participante
- **ai_insights**: sugerencias generadas por IA para líderes
- **ai_reports**: reportes automáticos a Arquitectura Humana
- **notifications**: notificaciones in-app, slack y email
- **audit_logs**: registro de accesos sensibles

---

## Integraciones

### Google Workspace
- **SSO**: autenticación vía OAuth 2.0
- **Calendar API**: creación, actualización y eliminación de eventos
- **Meet**: generación automática de links para reuniones virtuales
- **Directory API**: sincronización de la estructura organizacional

### Slack
- Webhook o bot oficial para notificaciones de incumplimiento

### Anthropic Claude (IA)
- Estructuración de minutas
- Generación de sugerencias para líderes
- Análisis de patrones y reportes

### Resend
- Notificaciones transaccionales por email

---

## Instalación y Configuración

### Requisitos previos
- Node.js 20+
- pnpm (recomendado) o npm
- Cuenta de Supabase
- Proyecto en Google Cloud con Calendar API habilitada
- API Key de Anthropic
- Bot/Webhook de Slack
- Cuenta de Resend

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

# Anthropic (IA)
ANTHROPIC_API_KEY=

# Slack
SLACK_BOT_TOKEN=
SLACK_WEBHOOK_URL=

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
│   │   └── arquitectura-humana/
│   ├── api/                    # API Routes
│   └── layout.tsx
├── components/                 # Componentes React
│   ├── ui/                     # shadcn/ui
│   └── features/               # Componentes por feature
├── lib/                        # Utilidades
│   ├── supabase/
│   ├── google/
│   ├── ai/                     # Integración con Claude
│   ├── slack/
│   └── email/
├── prisma/                     # Schema y migraciones
├── public/
├── types/                      # TypeScript types
└── README.md
```

---

## Fases de Implementación

### Fase 1 — Fundación
- [ ] Auth con Google Workspace
- [ ] Estructura organizacional (líder ↔ colaborador, áreas)
- [ ] Vistas base por rol (colaborador, líder, arquitectura humana)
- [ ] Agendado de 1:1s con sync a Google Calendar

### Fase 2 — Minuta y VoBo
- [ ] Plantilla de minuta para captura de acuerdos
- [ ] Procesamiento con IA: texto libre → lista estructurada de acuerdos
- [ ] VoBo independiente por ambas partes
- [ ] Estado "en disputa" cuando hay discrepancia
- [ ] Visibilidad compartida de acuerdos (incluyendo Arquitectura Humana)

### Fase 3 — Seguimiento de Acuerdos
- [ ] Pregunta de cumplimiento de acuerdos previos antes del VoBo
- [ ] Estados de acuerdos (pendiente, cumplido, parcial, no cumplido)
- [ ] Análisis con IA de patrones de cumplimiento
- [ ] Reportes automáticos a Arquitectura Humana cuando se detectan patrones

### Fase 4 — Acompañamiento al Líder
- [ ] Sugerencias de IA con preguntas para la siguiente 1:1
- [ ] Planes de seguimiento basados en la minuta
- [ ] Recomendaciones contextuales por colaborador

### Fase 5 — Arquitectura Humana
- [ ] Dashboard global de cumplimiento
- [ ] Mapa de calor por áreas
- [ ] Configuración de cadencias
- [ ] Alertas e incumplimientos
- [ ] Herramientas de validación del seguimiento del líder

### Fase 6 — Notificaciones e Integraciones
- [ ] Notificaciones a Slack ante incumplimientos
- [ ] Recordatorios por email
- [ ] Notificaciones in-app

### Fase 7 — Pulido y Despliegue
- [ ] Optimización de UX
- [ ] Pruebas con usuarios piloto
- [ ] Despliegue en producción

---

## Equipo

- **Sponsor**: Arquitectura Humana
- **Product Owner**: [Por definir]
- **Desarrollo**: [Por definir]
- **Diseño**: [Por definir]

---

## Licencia

Proyecto interno — Uso restringido a la organización.

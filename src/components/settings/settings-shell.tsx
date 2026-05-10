'use client'

import { useState } from 'react'
import {
  User, Lock, Bell, Calendar, Plug, Palette, Building2, Shield,
  Sparkles, CreditCard, FileText, ChevronRight,
} from 'lucide-react'
import type { UserRole } from '@/types/domain'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { InitialsAvatar } from '@/components/shared/initials-avatar'
import { useTheme } from '@/components/theme/theme-provider'
import { cn } from '@/lib/utils/cn'

interface SettingsShellProps {
  role: UserRole
  user: {
    name: string
    email: string
    title?: string
  }
}

interface Section {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  group: 'personal' | 'org'
}

const PERSONAL_SECTIONS: Section[] = [
  { key: 'perfil', label: 'Perfil', icon: User, group: 'personal' },
  { key: 'cuenta', label: 'Cuenta', icon: Lock, group: 'personal' },
  { key: 'notificaciones', label: 'Notificaciones', icon: Bell, group: 'personal' },
  { key: 'preferencias', label: 'Preferencias 1:1', icon: Calendar, group: 'personal' },
  { key: 'integraciones', label: 'Integraciones', icon: Plug, group: 'personal' },
  { key: 'apariencia', label: 'Apariencia', icon: Palette, group: 'personal' },
]

const ORG_SECTIONS: Section[] = [
  { key: 'organizacion', label: 'Organización', icon: Building2, group: 'org' },
  { key: 'privacidad', label: 'Privacidad', icon: Shield, group: 'org' },
  { key: 'asistente', label: 'Asistente IA', icon: Sparkles, group: 'org' },
  { key: 'facturacion', label: 'Facturación', icon: CreditCard, group: 'org' },
  { key: 'auditoria', label: 'Auditoría', icon: FileText, group: 'org' },
]

export function SettingsShell({ role, user }: SettingsShellProps) {
  const sections = role === 'hr' ? [...PERSONAL_SECTIONS, ...ORG_SECTIONS] : PERSONAL_SECTIONS
  const [active, setActive] = useState(sections[0]!.key)

  return (
    <div className="grid grid-cols-[220px_1fr] gap-8 items-start">
      <nav className="sticky top-20 flex flex-col">
        <div className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground px-2 pb-2">Personal</div>
        {PERSONAL_SECTIONS.map(s => <NavItem key={s.key} s={s} active={active} setActive={setActive} />)}
        {role === 'hr' && (
          <>
            <div className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground px-2 pt-4 pb-2">Organización</div>
            {ORG_SECTIONS.map(s => <NavItem key={s.key} s={s} active={active} setActive={setActive} />)}
          </>
        )}
      </nav>

      <div className="min-w-0">
        {active === 'perfil' && <PerfilSection user={user} />}
        {active === 'cuenta' && <CuentaSection email={user.email} />}
        {active === 'notificaciones' && <NotificacionesSection />}
        {active === 'preferencias' && <PreferenciasSection />}
        {active === 'integraciones' && <IntegracionesSection />}
        {active === 'apariencia' && <AparienciaSection />}
        {active === 'organizacion' && <OrganizacionSection />}
        {active === 'privacidad' && <PrivacidadSection />}
        {active === 'asistente' && <AsistenteSection />}
        {active === 'facturacion' && <FacturacionSection />}
        {active === 'auditoria' && <AuditoriaSection />}
      </div>
    </div>
  )
}

function NavItem({
  s, active, setActive,
}: { s: Section; active: string; setActive: (k: string) => void }) {
  const Icon = s.icon
  const isActive = active === s.key
  return (
    <button
      type="button"
      onClick={() => setActive(s.key)}
      className={cn(
        'flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] text-left transition-colors',
        isActive ? 'bg-secondary text-foreground font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
      )}
    >
      <Icon className={cn('size-4 shrink-0', isActive && 'text-foreground')} />
      {s.label}
    </button>
  )
}

// ----- helpers -----

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0',
        on ? 'bg-brand' : 'bg-secondary border'
      )}
    >
      <span
        className={cn(
          'inline-block size-4 rounded-full bg-background shadow transition-transform',
          on ? 'translate-x-[18px]' : 'translate-x-[2px]'
        )}
      />
    </button>
  )
}

function ToggleRow({
  title, hint, defaultOn = false,
}: { title: string; hint?: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <div className="flex items-center justify-between gap-6 px-6 py-3.5 border-t first:border-t-0">
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium">{title}</div>
        {hint && <div className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{hint}</div>}
      </div>
      <Toggle on={on} onChange={setOn} />
    </div>
  )
}

function Segmented<T extends string>({
  value, options, onChange,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex p-0.5 rounded-md border bg-secondary/50 gap-0.5">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'px-3 py-1 text-[12.5px] rounded font-medium transition-colors',
            value === o.value ? 'bg-background text-foreground shadow-[0_0_0_1px_hsl(var(--border))]' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function SettingRow({
  title, hint, control,
}: { title: string; hint?: string; control: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_1.4fr] gap-6 px-6 py-4 border-t first:border-t-0 items-start">
      <div>
        <div className="text-[13.5px] font-medium">{title}</div>
        {hint && <div className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{hint}</div>}
      </div>
      <div>{control}</div>
    </div>
  )
}

// ----- sections -----

function PerfilSection({ user }: { user: { name: string; email: string; title?: string } }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Perfil</CardTitle>
          <CardDescription>Cómo te ven los demás en la plataforma.</CardDescription>
        </div>
        <Button variant="brand" size="sm">Guardar</Button>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="flex items-center gap-4">
          <InitialsAvatar name={user.name} size="xl" />
          <div>
            <Button variant="outline" size="sm">Cambiar foto</Button>
            <p className="text-[11.5px] text-muted-foreground mt-1.5">JPG/PNG, hasta 2MB</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="mb-1.5 block">Nombre completo</Label>
            <Input defaultValue={user.name} />
          </div>
          <div>
            <Label className="mb-1.5 block">Pronombres</Label>
            <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" defaultValue="ella">
              <option value="ella">ella / la</option>
              <option value="el">él / lo</option>
              <option value="elle">elle / le</option>
              <option value="ninguno">No especificar</option>
            </select>
          </div>
        </div>
        <div>
          <Label className="mb-1.5 block">Puesto</Label>
          <Input defaultValue={user.title ?? ''} placeholder="Ej. Engineering Manager" />
        </div>
        <div>
          <Label className="mb-1.5 block">Bio breve</Label>
          <Textarea placeholder="Cuéntale a tu equipo qué te interesa, en qué proyectos has trabajado…" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="mb-1.5 block">Zona horaria</Label>
            <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" defaultValue="cdmx">
              <option value="cdmx">Ciudad de México (GMT-6)</option>
              <option value="bog">Bogotá (GMT-5)</option>
              <option value="mad">Madrid (GMT+1)</option>
            </select>
          </div>
          <div>
            <Label className="mb-1.5 block">Idioma</Label>
            <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" defaultValue="es">
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CuentaSection({ email }: { email: string }) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Cuenta</CardTitle>
          <CardDescription>Correo, contraseña y seguridad.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3.5">
          <div>
            <Label className="mb-1.5 block">Correo electrónico</Label>
            <Input defaultValue={email} type="email" />
          </div>
          <div>
            <Label className="mb-1.5 block">Cambiar contraseña</Label>
            <div className="grid gap-2">
              <Input placeholder="Contraseña actual" type="password" />
              <Input placeholder="Nueva contraseña" type="password" />
              <Input placeholder="Confirmar nueva contraseña" type="password" />
            </div>
            <Button variant="outline" size="sm" className="mt-2.5">Actualizar contraseña</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Autenticación de dos factores</CardTitle>
          <CardDescription>Capa adicional de seguridad para tu cuenta.</CardDescription>
        </CardHeader>
        <div>
          <ToggleRow title="2FA con app autenticadora" hint="Google Authenticator, Authy, 1Password" />
          <ToggleRow title="Códigos de respaldo" hint="Genera 10 códigos para emergencias" />
        </div>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Sesiones activas</CardTitle>
            <CardDescription>Dispositivos conectados a tu cuenta.</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/5">Cerrar todas</Button>
        </CardHeader>
        <div className="divide-y">
          {[
            { device: 'MacBook Pro 14"', loc: 'Ciudad de México · Hace 5 min', current: true },
            { device: 'iPhone 15', loc: 'Ciudad de México · Hace 2 horas' },
            { device: 'Chrome en Windows', loc: 'CDMX · Hace 3 días' },
          ].map((s, i) => (
            <div key={i} className="flex items-center justify-between px-6 py-3.5">
              <div>
                <div className="text-[13.5px] font-medium flex items-center gap-2">
                  {s.device}
                  {s.current && <Badge variant="success" className="text-[10px]">Actual</Badge>}
                </div>
                <div className="text-[12px] text-muted-foreground mt-0.5">{s.loc}</div>
              </div>
              {!s.current && <Button variant="ghost" size="sm">Cerrar</Button>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function NotificacionesSection() {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Canales</CardTitle>
          <CardDescription>Dónde recibir las notificaciones.</CardDescription>
        </CardHeader>
        <div>
          <ToggleRow title="Email" hint="A tu correo corporativo" defaultOn />
          <ToggleRow title="Slack" hint="DM al usuario @tu.usuario" defaultOn />
          <ToggleRow title="Push (navegador)" hint="Notificaciones del sistema" />
          <ToggleRow title="Resumen diario por correo" hint="A las 8:00 AM con todo lo importante" defaultOn />
        </div>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Eventos</CardTitle>
          <CardDescription>Qué te avisamos.</CardDescription>
        </CardHeader>
        <div>
          <ToggleRow title="Recordatorio 1 hora antes de la 1:1" defaultOn />
          <ToggleRow title="Solicitud de VoBo después de la reunión" defaultOn />
          <ToggleRow title="Acuerdo próximo a vencer (3 días)" defaultOn />
          <ToggleRow title="Acuerdo vencido sin reportar" defaultOn />
          <ToggleRow title="Reasignación de líder o cambio de área" />
          <ToggleRow title="Sugerencias de IA disponibles" defaultOn />
          <ToggleRow title="1:1 reagendada por el otro participante" defaultOn />
          <ToggleRow title="Mención en agenda o minuta" />
        </div>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>No molestar</CardTitle>
          <CardDescription>Pausa todas las notificaciones en horarios específicos.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div>
            <Label className="mb-1.5 block">Desde</Label>
            <Input type="time" defaultValue="20:00" />
          </div>
          <div>
            <Label className="mb-1.5 block">Hasta</Label>
            <Input type="time" defaultValue="08:00" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function PreferenciasSection() {
  const [duration, setDuration] = useState<'15' | '30' | '45' | '60'>('30')
  const [modality, setModality] = useState<'virtual' | 'presencial' | 'auto'>('auto')

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Preferencias de 1:1</CardTitle>
          <CardDescription>Defaults al agendar una reunión.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div>
            <Label className="mb-2 block">Duración por defecto</Label>
            <Segmented
              value={duration}
              options={[
                { value: '15', label: '15 min' },
                { value: '30', label: '30 min' },
                { value: '45', label: '45 min' },
                { value: '60', label: '1 hora' },
              ]}
              onChange={setDuration}
            />
          </div>
          <div>
            <Label className="mb-2 block">Modalidad por defecto</Label>
            <Segmented
              value={modality}
              options={[
                { value: 'virtual', label: 'Virtual (Meet)' },
                { value: 'presencial', label: 'Presencial' },
                { value: 'auto', label: 'Decidir cada vez' },
              ]}
              onChange={setModality}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Asistente IA en tus 1:1s</CardTitle>
          <CardDescription>Cómo y cuándo participa la IA.</CardDescription>
        </CardHeader>
        <div>
          <ToggleRow title="Extraer acuerdos automáticamente al guardar minuta" defaultOn />
          <ToggleRow title="Sugerir preguntas antes de cada 1:1 (líder)" defaultOn />
          <ToggleRow title="Plan de seguimiento post-reunión" defaultOn />
          <ToggleRow title="Detección de patrones en mis 1:1s (RH)" hint="Solo aplica para reportes agregados, no individuales" />
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacidad</CardTitle>
          <CardDescription>Quién ve qué.</CardDescription>
        </CardHeader>
        <div>
          <ToggleRow title="Ocultar agenda pre-reunión hasta el día de la 1:1" />
          <ToggleRow title="Compartir mood check-in con líder" hint="Tu líder verá tendencias agregadas" defaultOn />
          <ToggleRow title="Pedir confirmación antes de compartir acuerdos con RH" defaultOn />
        </div>
      </Card>
    </div>
  )
}

function IntegracionesSection() {
  const integrations = [
    { name: 'Google Calendar', desc: 'Sincronizar 1:1s y crear eventos', status: 'connected' as const },
    { name: 'Google Meet', desc: 'Generar enlaces automáticamente', status: 'connected' as const },
    { name: 'Slack', desc: 'Notificaciones y comandos /1to1', status: 'connected' as const },
    { name: 'Microsoft Outlook', desc: 'Calendar para usuarios MS365', status: 'available' as const },
    { name: 'Linear', desc: 'Crear acuerdos como issues', status: 'available' as const },
    { name: 'Notion', desc: 'Exportar minutas a una página', status: 'available' as const },
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle>Integraciones</CardTitle>
        <CardDescription>Conecta 1to1 con tus herramientas.</CardDescription>
      </CardHeader>
      <div className="divide-y">
        {integrations.map(i => (
          <div key={i.name} className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3.5">
              <InitialsAvatar name={i.name} size="md" />
              <div>
                <div className="text-[13.5px] font-medium">{i.name}</div>
                <div className="text-[12px] text-muted-foreground mt-0.5">{i.desc}</div>
              </div>
            </div>
            {i.status === 'connected' ? (
              <div className="flex items-center gap-2.5">
                <Badge variant="success">Conectado</Badge>
                <Button variant="ghost" size="sm">Desconectar</Button>
              </div>
            ) : (
              <Button variant="outline" size="sm">Conectar</Button>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

function AparienciaSection() {
  const { theme, setTheme } = useTheme()
  const [density, setDensity] = useState<'compact' | 'cozy' | 'comfortable'>('comfortable')

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Apariencia</CardTitle>
          <CardDescription>Personaliza cómo se ve 1to1.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div>
            <Label className="mb-2 block">Tema</Label>
            <Segmented<'light' | 'dark'>
              value={theme}
              options={[
                { value: 'light', label: 'Claro' },
                { value: 'dark', label: 'Oscuro' },
              ]}
              onChange={setTheme}
            />
          </div>
          <div>
            <Label className="mb-2 block">Densidad</Label>
            <Segmented
              value={density}
              options={[
                { value: 'compact', label: 'Compacta' },
                { value: 'cozy', label: 'Cómoda' },
                { value: 'comfortable', label: 'Espaciosa' },
              ]}
              onChange={setDensity}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Idioma y formato</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div>
            <Label className="mb-1.5 block">Idioma</Label>
            <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" defaultValue="es-MX">
              <option value="es-MX">Español (México)</option>
              <option value="es-ES">Español (España)</option>
              <option value="en-US">English (US)</option>
            </select>
          </div>
          <div>
            <Label className="mb-1.5 block">Formato de fecha</Label>
            <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" defaultValue="dmy">
              <option value="dmy">DD / MM / AAAA</option>
              <option value="mdy">MM / DD / AAAA</option>
              <option value="ymd">AAAA-MM-DD</option>
            </select>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ----- HR-only -----
function OrganizacionSection() {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Organización</CardTitle>
            <CardDescription>Datos generales de tu empresa.</CardDescription>
          </div>
          <Button variant="brand" size="sm">Guardar</Button>
        </CardHeader>
        <CardContent className="grid gap-3.5">
          <div>
            <Label className="mb-1.5 block">Nombre de la organización</Label>
            <Input defaultValue="B-Drive" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block">Dominio corporativo</Label>
              <Input defaultValue="b-drive.com.mx" />
            </div>
            <div>
              <Label className="mb-1.5 block">Plan</Label>
              <Input defaultValue="Empresarial · 400 usuarios" disabled />
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block">Logo</Label>
            <Button variant="outline" size="sm">Subir logo</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Roles y permisos</CardTitle>
          <CardDescription>Quién puede hacer qué.</CardDescription>
        </CardHeader>
        <div className="divide-y">
          {[
            { role: 'Arquitectura Humana', desc: 'Acceso completo + reportes', count: 3 },
            { role: 'Líder', desc: 'Gestión de su equipo', count: 42 },
            { role: 'Colaborador', desc: 'Sus propias 1:1s', count: 358 },
          ].map(r => (
            <button key={r.role} type="button" className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-secondary/40 transition-colors">
              <div className="text-left">
                <div className="text-[13.5px] font-medium">{r.role}</div>
                <div className="text-[12px] text-muted-foreground mt-0.5">{r.desc}</div>
              </div>
              <div className="flex items-center gap-3.5">
                <span className="text-[13px] text-muted-foreground tabular-nums">{r.count} usuarios</span>
                <ChevronRight className="size-3.5 text-muted-foreground/60" />
              </div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}

function PrivacidadSection() {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Política de privacidad</CardTitle>
          <CardDescription>Configuración global de visibilidad y retención.</CardDescription>
        </CardHeader>
        <div>
          <ToggleRow title="Cifrado en reposo de minutas" hint="AES-256 sobre Postgres" defaultOn />
          <ToggleRow title="RH puede ver minutas crudas" hint="Por defecto desactivado — RH solo ve acuerdos estructurados" />
          <ToggleRow title="Anonimización en reportes agregados" defaultOn />
          <ToggleRow title="Auditar accesos a minutas" defaultOn />
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Retención de datos</CardTitle>
          <CardDescription>Cuánto tiempo conservamos cada tipo de información.</CardDescription>
        </CardHeader>
        <div>
          <SettingRow
            title="Minutas y agendas"
            hint="Datos privados entre los participantes"
            control={
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" defaultValue="3">
                <option value="1">1 año</option>
                <option value="2">2 años</option>
                <option value="3">3 años</option>
                <option value="forever">Sin límite</option>
              </select>
            }
          />
          <SettingRow
            title="Acuerdos y métricas"
            hint="Datos agregados visibles para RH"
            control={
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" defaultValue="forever">
                <option value="3">3 años</option>
                <option value="5">5 años</option>
                <option value="forever">Sin límite</option>
              </select>
            }
          />
        </div>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Aviso de privacidad</CardTitle>
            <CardDescription>Documento que aceptan los usuarios al ingresar.</CardDescription>
          </div>
          <Button variant="outline" size="sm">Editar</Button>
        </CardHeader>
        <CardContent>
          <p className="text-[12.5px] text-muted-foreground leading-relaxed m-0">
            Versión 2.3 · Última actualización 12 de marzo, 2026 · Cumple con LFPDPPP
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function AsistenteSection() {
  return (
    <div className="grid gap-4">
      <Card className="border-brand/30 bg-brand-muted/20">
        <CardHeader>
          <Badge variant="brand" className="self-start mb-2"><Sparkles className="size-3" /> Asistente</Badge>
          <CardTitle>Configuración global de IA</CardTitle>
          <CardDescription>Cómo participa el asistente en toda la plataforma.</CardDescription>
        </CardHeader>
        <div>
          <ToggleRow title="Extracción automática de acuerdos" hint="IA procesa minutas para generar acuerdos estructurados" defaultOn />
          <ToggleRow title="Sugerencias contextuales para líderes" defaultOn />
          <ToggleRow title="Detección de patrones organizacionales" hint="Para reportes de RH agregados" defaultOn />
          <ToggleRow title="Análisis de salud emocional" hint="Mood check-ins anónimos por área" />
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Categorías de preguntas</CardTitle>
          <CardDescription>Qué tipos de pregunta puede sugerir la IA.</CardDescription>
        </CardHeader>
        <div>
          {[
            'Desempeño y entregables',
            'Desarrollo profesional',
            'Bienestar y carga de trabajo',
            'Seguimiento de acuerdos',
            'Feedback bidireccional',
          ].map(c => <ToggleRow key={c} title={c} defaultOn />)}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modelo y costos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2.5 text-[13px]">
          <ModelRow label="Modelo activo" value="Claude Sonnet 4.5" />
          <ModelRow label="Llamadas este mes" value="1,247" />
          <ModelRow label="Costo estimado" value="$48.20 USD" />
        </CardContent>
      </Card>
    </div>
  )
}

function ModelRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <strong className="font-medium tabular-nums">{value}</strong>
    </div>
  )
}

function FacturacionSection() {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Plan actual</CardTitle>
            <CardDescription>Empresarial · facturación anual.</CardDescription>
          </div>
          <Button variant="outline" size="sm">Cambiar plan</Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-[32px] font-medium font-mono-numeric tracking-tight">$3,840</span>
            <span className="text-sm text-muted-foreground">USD / año</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-[13px]">
            <PlanCell label="Usuarios" value="403 / 500" />
            <PlanCell label="Renovación" value="1 enero 2027" />
            <PlanCell label="Próximo cargo" value="$3,840 USD" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <CardTitle>Datos fiscales (México)</CardTitle>
          <Button variant="ghost" size="sm">Editar</Button>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <PlanCell label="Razón social" value="B-Drive S.A. de C.V." />
          <PlanCell label="RFC" value="BDR210315H68" />
          <PlanCell label="Régimen fiscal" value="601 — Personas Morales" />
          <PlanCell label="Uso de CFDI" value="G03 — Gastos en general" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <CardTitle>Historial de pagos</CardTitle>
          <Button variant="ghost" size="sm">Descargar todo</Button>
        </CardHeader>
        <div className="divide-y">
          {[
            { date: '01 ene 2026', concept: 'Plan empresarial 2026', amount: '$3,840 USD' },
            { date: '01 ene 2025', concept: 'Plan empresarial 2025', amount: '$3,200 USD' },
            { date: '01 ene 2024', concept: 'Plan empresarial 2024', amount: '$2,800 USD' },
          ].map((r, i) => (
            <div key={i} className="flex items-center justify-between px-6 py-3">
              <div>
                <div className="text-[13px] font-medium">{r.concept}</div>
                <div className="text-[11.5px] text-muted-foreground">{r.date}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[13px] font-medium tabular-nums">{r.amount}</span>
                <Badge variant="success">Pagado</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function PlanCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] text-muted-foreground uppercase tracking-[0.08em] font-medium">{label}</div>
      <div className="text-[13.5px] font-medium mt-1">{value}</div>
    </div>
  )
}

function AuditoriaSection() {
  const events = [
    { who: 'Carolina Méndez', what: 'Vio el reporte IA #R-104', when: 'Hace 12 min' },
    { who: 'Roberto Silva', what: 'Cerró sesión', when: 'Hace 1 hora' },
    { who: 'Ariel Calderón', what: 'Cambió rol de Luis Hernández a Líder', when: 'Hace 2 horas' },
    { who: 'Ana Patricia Ruiz', what: 'Exportó usuarios (CSV)', when: 'Ayer 18:42' },
    { who: 'Sistema', what: 'Backup automático completado', when: 'Ayer 03:00' },
  ]
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Bitácora de auditoría</CardTitle>
          <CardDescription>Registro de accesos sensibles y cambios administrativos.</CardDescription>
        </div>
        <Button variant="outline" size="sm">Exportar CSV</Button>
      </CardHeader>
      <div className="divide-y">
        {events.map((e, i) => (
          <div key={i} className="flex items-center justify-between px-6 py-3 text-[13px]">
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-medium truncate">{e.who}</span>
              <span className="text-muted-foreground truncate">{e.what}</span>
            </div>
            <span className="text-muted-foreground/70 text-[11.5px] shrink-0">{e.when}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

'use client'

import { useState } from 'react'
import {
  User, Lock, Bell, Calendar, Plug, Palette, Building2, Shield,
  Sparkles, CreditCard, FileText, ChevronRight,
} from 'lucide-react'
import type { UserRole } from '@/types/domain'

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
  icon: React.ComponentType<{ size?: number | string }>
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
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 32, alignItems: 'flex-start' }}>
      <nav className="settings-nav">
        <div className="settings-nav__group">Personal</div>
        {PERSONAL_SECTIONS.map(s => {
          const Icon = s.icon
          return (
            <button
              key={s.key}
              type="button"
              className="settings-nav__item"
              data-active={active === s.key}
              onClick={() => setActive(s.key)}
            >
              <Icon size={15} />
              {s.label}
            </button>
          )
        })}
        {role === 'hr' && (
          <>
            <div className="settings-nav__group" style={{ marginTop: 18 }}>Organización</div>
            {ORG_SECTIONS.map(s => {
              const Icon = s.icon
              return (
                <button
                  key={s.key}
                  type="button"
                  className="settings-nav__item"
                  data-active={active === s.key}
                  onClick={() => setActive(s.key)}
                >
                  <Icon size={15} />
                  {s.label}
                </button>
              )
            })}
          </>
        )}
      </nav>

      <div>
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

// ---------- helpers ----------
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className="toggle"
      data-on={on}
      onClick={() => onChange(!on)}
      aria-pressed={on}
    >
      <span className="toggle__thumb" />
    </button>
  )
}

function ToggleRow({
  title, hint, defaultOn = false,
}: { title: string; hint?: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <div className="toggle-row">
      <div>
        <div className="setting-row__title">{title}</div>
        {hint && <div className="setting-row__hint">{hint}</div>}
      </div>
      <Toggle on={on} onChange={setOn} />
    </div>
  )
}

function Segmented<T extends string>({
  value, options, onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented">
      {options.map(o => (
        <button key={o.value} type="button" data-active={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ---------- sections ----------
function PerfilSection({ user }: { user: { name: string; email: string; title?: string } }) {
  const initials = user.name.split(' ').map(p => p[0]).slice(0, 2).join('')
  return (
    <div className="ui-card">
      <div className="ui-card__head">
        <div>
          <h3 className="ui-card__title font-serif" style={{ fontSize: 18 }}>Perfil</h3>
          <p className="ui-card__desc">Cómo te ven los demás en la plataforma</p>
        </div>
        <button type="button" className="ui-btn ui-btn--accent ui-btn--sm">Guardar</button>
      </div>
      <div className="ui-card__body" style={{ display: 'grid', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="avatar avatar--xl av-blue">{initials}</div>
          <div>
            <button type="button" className="ui-btn ui-btn--outline ui-btn--sm">Cambiar foto</button>
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>JPG/PNG, hasta 2MB</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label className="ui-label">Nombre completo</label>
            <input className="ui-input" defaultValue={user.name} />
          </div>
          <div>
            <label className="ui-label">Pronombres</label>
            <select className="ui-select" defaultValue="ella">
              <option value="ella">ella / la</option>
              <option value="el">él / lo</option>
              <option value="elle">elle / le</option>
              <option value="ninguno">No especificar</option>
            </select>
          </div>
        </div>
        <div>
          <label className="ui-label">Puesto</label>
          <input className="ui-input" defaultValue={user.title ?? ''} placeholder="Ej. Engineering Manager" />
        </div>
        <div>
          <label className="ui-label">Bio breve</label>
          <textarea
            className="ui-textarea"
            placeholder="Cuéntale a tu equipo qué te interesa, en qué proyectos has trabajado…"
            style={{ minHeight: 90 }}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label className="ui-label">Zona horaria</label>
            <select className="ui-select" defaultValue="cdmx">
              <option value="cdmx">Ciudad de México (GMT-6)</option>
              <option value="bog">Bogotá (GMT-5)</option>
              <option value="mad">Madrid (GMT+1)</option>
            </select>
          </div>
          <div>
            <label className="ui-label">Idioma</label>
            <select className="ui-select" defaultValue="es">
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

function CuentaSection({ email }: { email: string }) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title font-serif" style={{ fontSize: 18 }}>Cuenta</h3>
            <p className="ui-card__desc">Correo, contraseña y seguridad</p>
          </div>
        </div>
        <div className="ui-card__body" style={{ display: 'grid', gap: 14 }}>
          <div>
            <label className="ui-label">Correo electrónico</label>
            <input className="ui-input" defaultValue={email} type="email" />
          </div>
          <div>
            <label className="ui-label">Cambiar contraseña</label>
            <input className="ui-input" placeholder="Contraseña actual" type="password" />
            <input className="ui-input" placeholder="Nueva contraseña" type="password" style={{ marginTop: 8 }} />
            <input className="ui-input" placeholder="Confirmar nueva contraseña" type="password" style={{ marginTop: 8 }} />
            <button type="button" className="ui-btn ui-btn--outline ui-btn--sm" style={{ marginTop: 10 }}>
              Actualizar contraseña
            </button>
          </div>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title">Autenticación de dos factores</h3>
            <p className="ui-card__desc">Capa adicional de seguridad para tu cuenta</p>
          </div>
        </div>
        <div className="ui-card__body ui-card__body--flush">
          <ToggleRow title="2FA con app autenticadora" hint="Google Authenticator, Authy, 1Password" />
          <ToggleRow title="Códigos de respaldo" hint="Genera 10 códigos para emergencias" />
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title">Sesiones activas</h3>
            <p className="ui-card__desc">Dispositivos conectados a tu cuenta</p>
          </div>
          <button type="button" className="ui-btn ui-btn--danger-outline ui-btn--sm">
            Cerrar todas
          </button>
        </div>
        <div className="ui-card__body ui-card__body--flush">
          {[
            { device: 'MacBook Pro 14"', loc: 'Ciudad de México · Hace 5 min', current: true },
            { device: 'iPhone 15', loc: 'Ciudad de México · Hace 2 horas' },
            { device: 'Chrome en Windows', loc: 'CDMX · Hace 3 días' },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderTop: i > 0 ? '1px solid var(--border-c)' : 'none' }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                  {s.device}
                  {s.current && <span className="ui-badge ui-badge--green" style={{ marginLeft: 8, fontSize: 10.5 }}>Actual</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{s.loc}</div>
              </div>
              {!s.current && (
                <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm">Cerrar</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function NotificacionesSection() {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title font-serif" style={{ fontSize: 18 }}>Canales</h3>
            <p className="ui-card__desc">Dónde recibir las notificaciones</p>
          </div>
        </div>
        <div className="ui-card__body ui-card__body--flush">
          <ToggleRow title="Email" hint="A tu correo corporativo" defaultOn />
          <ToggleRow title="Slack" hint="DM al usuario @tu.usuario" defaultOn />
          <ToggleRow title="Push (navegador)" hint="Notificaciones del sistema" />
          <ToggleRow title="Resumen diario por correo" hint="A las 8:00 AM con todo lo importante" defaultOn />
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title">Eventos</h3>
            <p className="ui-card__desc">Qué te avisamos</p>
          </div>
        </div>
        <div className="ui-card__body ui-card__body--flush">
          <ToggleRow title="Recordatorio 1 hora antes de la 1:1" defaultOn />
          <ToggleRow title="Solicitud de VoBo después de la reunión" defaultOn />
          <ToggleRow title="Acuerdo próximo a vencer (3 días)" defaultOn />
          <ToggleRow title="Acuerdo vencido sin reportar" defaultOn />
          <ToggleRow title="Reasignación de líder o cambio de área" />
          <ToggleRow title="Sugerencias de IA disponibles" defaultOn />
          <ToggleRow title="1:1 reagendada por el otro participante" defaultOn />
          <ToggleRow title="Mención en agenda o minuta" />
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title">No molestar</h3>
            <p className="ui-card__desc">Pausa todas las notificaciones en horarios específicos</p>
          </div>
        </div>
        <div className="ui-card__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label className="ui-label">Desde</label>
            <input className="ui-input" type="time" defaultValue="20:00" />
          </div>
          <div>
            <label className="ui-label">Hasta</label>
            <input className="ui-input" type="time" defaultValue="08:00" />
          </div>
        </div>
      </div>
    </div>
  )
}

function PreferenciasSection() {
  const [duration, setDuration] = useState<'15' | '30' | '45' | '60'>('30')
  const [modality, setModality] = useState<'virtual' | 'presencial' | 'auto'>('auto')

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title font-serif" style={{ fontSize: 18 }}>Preferencias de 1:1</h3>
            <p className="ui-card__desc">Defaults al agendar una reunión</p>
          </div>
        </div>
        <div className="ui-card__body" style={{ display: 'grid', gap: 18 }}>
          <div>
            <label className="ui-label">Duración por defecto</label>
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
            <label className="ui-label">Modalidad por defecto</label>
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
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title">Asistente IA en tus 1:1s</h3>
            <p className="ui-card__desc">Cómo y cuándo participa la IA</p>
          </div>
        </div>
        <div className="ui-card__body ui-card__body--flush">
          <ToggleRow title="Extraer acuerdos automáticamente al guardar minuta" defaultOn />
          <ToggleRow title="Sugerir preguntas antes de cada 1:1 (líder)" defaultOn />
          <ToggleRow title="Plan de seguimiento post-reunión" defaultOn />
          <ToggleRow title="Detección de patrones en mis 1:1s (RH)" hint="Solo aplica para reportes agregados, no individuales" />
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title">Privacidad</h3>
            <p className="ui-card__desc">Quién ve qué</p>
          </div>
        </div>
        <div className="ui-card__body ui-card__body--flush">
          <ToggleRow title="Ocultar agenda pre-reunión hasta el día de la 1:1" />
          <ToggleRow title="Compartir mood check-in con líder" hint="Tu líder verá tendencias agregadas" defaultOn />
          <ToggleRow title="Pedir confirmación antes de compartir acuerdos con RH" defaultOn />
        </div>
      </div>
    </div>
  )
}

function IntegracionesSection() {
  const integrations = [
    { name: 'Google Calendar', desc: 'Sincronizar 1:1s y crear eventos', status: 'connected' as const, color: 'av-blue' },
    { name: 'Google Meet', desc: 'Generar enlaces automáticamente', status: 'connected' as const, color: 'av-green' },
    { name: 'Slack', desc: 'Notificaciones y comandos /1to1', status: 'connected' as const, color: 'av-violet' },
    { name: 'Microsoft Outlook', desc: 'Calendar para usuarios MS365', status: 'available' as const, color: 'av-blue' },
    { name: 'Linear', desc: 'Crear acuerdos como issues', status: 'available' as const, color: 'av-pink' },
    { name: 'Notion', desc: 'Exportar minutas a una página', status: 'available' as const, color: 'av-slate' },
  ]
  return (
    <div className="ui-card">
      <div className="ui-card__head">
        <div>
          <h3 className="ui-card__title font-serif" style={{ fontSize: 18 }}>Integraciones</h3>
          <p className="ui-card__desc">Conecta 1to1 con tus herramientas</p>
        </div>
      </div>
      <div className="ui-card__body ui-card__body--flush">
        {integrations.map((i, idx) => (
          <div key={i.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderTop: idx > 0 ? '1px solid var(--border-c)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className={`avatar avatar--md ${i.color}`}>{i.name[0]}</div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{i.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{i.desc}</div>
              </div>
            </div>
            {i.status === 'connected' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="ui-badge ui-badge--green">Conectado</span>
                <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm">Desconectar</button>
              </div>
            ) : (
              <button type="button" className="ui-btn ui-btn--outline ui-btn--sm">Conectar</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function AparienciaSection() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light')
  const [density, setDensity] = useState<'compact' | 'cozy' | 'comfortable'>('comfortable')
  const [accent, setAccent] = useState('blue')

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title font-serif" style={{ fontSize: 18 }}>Apariencia</h3>
            <p className="ui-card__desc">Personaliza cómo se ve 1to1</p>
          </div>
        </div>
        <div className="ui-card__body" style={{ display: 'grid', gap: 18 }}>
          <div>
            <label className="ui-label">Tema</label>
            <Segmented
              value={theme}
              options={[
                { value: 'light', label: 'Claro' },
                { value: 'dark', label: 'Oscuro' },
                { value: 'system', label: 'Sistema' },
              ]}
              onChange={setTheme}
            />
          </div>
          <div>
            <label className="ui-label">Densidad</label>
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
          <div>
            <label className="ui-label">Color de acento</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { key: 'blue', color: '#2563eb' },
                { key: 'violet', color: '#7c3aed' },
                { key: 'green', color: '#16a34a' },
                { key: 'amber', color: '#d97706' },
                { key: 'rose', color: '#e11d48' },
              ].map(c => (
                <button
                  key={c.key}
                  type="button"
                  className="accent-swatch"
                  data-active={accent === c.key}
                  style={{ background: c.color }}
                  onClick={() => setAccent(c.key)}
                  aria-label={c.key}
                />
              ))}
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8 }}>
              Cambia el acento usado en botones, links y elementos de IA
            </p>
          </div>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title">Idioma y formato</h3>
          </div>
        </div>
        <div className="ui-card__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label className="ui-label">Idioma</label>
            <select className="ui-select" defaultValue="es-MX">
              <option value="es-MX">Español (México)</option>
              <option value="es-ES">Español (España)</option>
              <option value="en-US">English (US)</option>
            </select>
          </div>
          <div>
            <label className="ui-label">Formato de fecha</label>
            <select className="ui-select" defaultValue="dmy">
              <option value="dmy">DD / MM / AAAA</option>
              <option value="mdy">MM / DD / AAAA</option>
              <option value="ymd">AAAA-MM-DD</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- RH only ----------
function OrganizacionSection() {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title font-serif" style={{ fontSize: 18 }}>Organización</h3>
            <p className="ui-card__desc">Datos generales de tu empresa</p>
          </div>
          <button type="button" className="ui-btn ui-btn--accent ui-btn--sm">Guardar</button>
        </div>
        <div className="ui-card__body" style={{ display: 'grid', gap: 14 }}>
          <div>
            <label className="ui-label">Nombre de la organización</label>
            <input className="ui-input" defaultValue="B-Drive" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label className="ui-label">Dominio corporativo</label>
              <input className="ui-input" defaultValue="b-drive.com.mx" />
            </div>
            <div>
              <label className="ui-label">Plan</label>
              <input className="ui-input" defaultValue="Empresarial · 400 usuarios" disabled />
            </div>
          </div>
          <div>
            <label className="ui-label">Logo</label>
            <button type="button" className="ui-btn ui-btn--outline ui-btn--sm">Subir logo</button>
          </div>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title">Roles y permisos</h3>
            <p className="ui-card__desc">Quién puede hacer qué</p>
          </div>
        </div>
        <div className="ui-card__body ui-card__body--flush">
          {[
            { role: 'Arquitectura Humana', desc: 'Acceso completo + reportes', count: 3 },
            { role: 'Líder', desc: 'Gestión de su equipo', count: 42 },
            { role: 'Colaborador', desc: 'Sus propias 1:1s', count: 358 },
          ].map((r, i) => (
            <div key={r.role} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderTop: i > 0 ? '1px solid var(--border-c)' : 'none' }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{r.role}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{r.desc}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{r.count} usuarios</span>
                <ChevronRight size={14} style={{ color: 'var(--text-subtle)' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PrivacidadSection() {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title font-serif" style={{ fontSize: 18 }}>Política de privacidad</h3>
            <p className="ui-card__desc">Configuración global de visibilidad y retención</p>
          </div>
        </div>
        <div className="ui-card__body ui-card__body--flush">
          <ToggleRow title="Cifrado en reposo de minutas" hint="AES-256 sobre Postgres" defaultOn />
          <ToggleRow title="RH puede ver minutas crudas" hint="Por defecto desactivado — RH solo ve acuerdos estructurados" />
          <ToggleRow title="Anonimización en reportes agregados" defaultOn />
          <ToggleRow title="Auditar accesos a minutas" defaultOn />
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title">Retención de datos</h3>
            <p className="ui-card__desc">Cuánto tiempo conservamos cada tipo de información</p>
          </div>
        </div>
        <div className="ui-card__body ui-card__body--flush">
          <div className="setting-row">
            <div>
              <div className="setting-row__title">Minutas y agendas</div>
              <div className="setting-row__hint">Datos privados entre los participantes</div>
            </div>
            <select className="ui-select" defaultValue="3">
              <option value="1">1 año</option>
              <option value="2">2 años</option>
              <option value="3">3 años</option>
              <option value="forever">Sin límite</option>
            </select>
            <span />
          </div>
          <div className="setting-row">
            <div>
              <div className="setting-row__title">Acuerdos y métricas</div>
              <div className="setting-row__hint">Datos agregados visibles para RH</div>
            </div>
            <select className="ui-select" defaultValue="forever">
              <option value="3">3 años</option>
              <option value="5">5 años</option>
              <option value="forever">Sin límite</option>
            </select>
            <span />
          </div>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title">Aviso de privacidad</h3>
            <p className="ui-card__desc">Documento que aceptan los usuarios al ingresar</p>
          </div>
          <button type="button" className="ui-btn ui-btn--outline ui-btn--sm">Editar</button>
        </div>
        <div className="ui-card__body">
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
            Versión 2.3 · Última actualización 12 de marzo, 2026 · Cumple con LFPDPPP
          </p>
        </div>
      </div>
    </div>
  )
}

function AsistenteSection() {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="ui-card ai-card">
        <div className="ui-card__head" style={{ borderBottom: 'none' }}>
          <div>
            <span className="ai-chip" style={{ marginBottom: 8, display: 'inline-flex' }}>Asistente</span>
            <h3 className="ui-card__title font-serif" style={{ fontSize: 18 }}>Configuración global de IA</h3>
            <p className="ui-card__desc">Cómo participa el asistente en toda la plataforma</p>
          </div>
        </div>
        <div className="ui-card__body ui-card__body--flush">
          <ToggleRow title="Extracción automática de acuerdos" hint="IA procesa minutas para generar acuerdos estructurados" defaultOn />
          <ToggleRow title="Sugerencias contextuales para líderes" defaultOn />
          <ToggleRow title="Detección de patrones organizacionales" hint="Para reportes de RH agregados" defaultOn />
          <ToggleRow title="Análisis de salud emocional" hint="Mood check-ins anónimos por área" />
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title">Categorías de preguntas</h3>
            <p className="ui-card__desc">Qué tipos de pregunta puede sugerir la IA</p>
          </div>
        </div>
        <div className="ui-card__body ui-card__body--flush">
          {[
            'Desempeño y entregables',
            'Desarrollo profesional',
            'Bienestar y carga de trabajo',
            'Seguimiento de acuerdos',
            'Feedback bidireccional',
          ].map(c => <ToggleRow key={c} title={c} defaultOn />)}
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title">Modelo y costos</h3>
          </div>
        </div>
        <div className="ui-card__body" style={{ display: 'grid', gap: 12, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Modelo activo</span>
            <strong>Claude Sonnet 4.5</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Llamadas este mes</span>
            <strong>1,247</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Costo estimado</span>
            <strong>$48.20 USD</strong>
          </div>
        </div>
      </div>
    </div>
  )
}

function FacturacionSection() {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title font-serif" style={{ fontSize: 18 }}>Plan actual</h3>
            <p className="ui-card__desc">Empresarial · facturación anual</p>
          </div>
          <button type="button" className="ui-btn ui-btn--outline ui-btn--sm">Cambiar plan</button>
        </div>
        <div className="ui-card__body">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 36, fontWeight: 500 }}>$3,840</span>
            <span style={{ color: 'var(--text-muted)' }}>USD / año</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, fontSize: 13 }}>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Usuarios</div>
              <div style={{ fontWeight: 500, marginTop: 4 }}>403 / 500</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Renovación</div>
              <div style={{ fontWeight: 500, marginTop: 4 }}>1 enero 2027</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Próximo cargo</div>
              <div style={{ fontWeight: 500, marginTop: 4 }}>$3,840 USD</div>
            </div>
          </div>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title">Datos fiscales (México)</h3>
          </div>
          <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm">Editar</button>
        </div>
        <div className="ui-card__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Razón social</div>
            <div style={{ fontSize: 13.5, fontWeight: 500, marginTop: 4 }}>B-Drive S.A. de C.V.</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>RFC</div>
            <div style={{ fontSize: 13.5, fontWeight: 500, marginTop: 4 }}>BDR210315H68</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Régimen fiscal</div>
            <div style={{ fontSize: 13.5, fontWeight: 500, marginTop: 4 }}>601 — Personas Morales</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Uso de CFDI</div>
            <div style={{ fontSize: 13.5, fontWeight: 500, marginTop: 4 }}>G03 — Gastos en general</div>
          </div>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title">Historial de pagos</h3>
          </div>
          <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm">Descargar todo</button>
        </div>
        <div className="ui-card__body ui-card__body--flush">
          {[
            { date: '01 ene 2026', concept: 'Plan empresarial 2026', amount: '$3,840 USD', status: 'paid' },
            { date: '01 ene 2025', concept: 'Plan empresarial 2025', amount: '$3,200 USD', status: 'paid' },
            { date: '01 ene 2024', concept: 'Plan empresarial 2024', amount: '$2,800 USD', status: 'paid' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderTop: i > 0 ? '1px solid var(--border-c)' : 'none' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{r.concept}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{r.date}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{r.amount}</span>
                <span className="ui-badge ui-badge--green">Pagado</span>
              </div>
            </div>
          ))}
        </div>
      </div>
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
    <div className="ui-card">
      <div className="ui-card__head">
        <div>
          <h3 className="ui-card__title font-serif" style={{ fontSize: 18 }}>Bitácora de auditoría</h3>
          <p className="ui-card__desc">Registro de accesos sensibles y cambios administrativos</p>
        </div>
        <button type="button" className="ui-btn ui-btn--outline ui-btn--sm">Exportar CSV</button>
      </div>
      <div className="ui-card__body ui-card__body--flush">
        {events.map((e, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderTop: i > 0 ? '1px solid var(--border-c)' : 'none', fontSize: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 500 }}>{e.who}</span>
              <span style={{ color: 'var(--text-muted)' }}>{e.what}</span>
            </div>
            <span style={{ color: 'var(--text-subtle)', fontSize: 11.5 }}>{e.when}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

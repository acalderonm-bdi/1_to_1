'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save, ShieldAlert, ShieldCheck } from 'lucide-react'
import { updateUserRole, updateUserActive, assignLeader } from '@/lib/actions/users'

interface LeaderOption { id: string; full_name: string; email: string }

interface Props {
  userId: string
  currentRole: 'collaborator' | 'leader' | 'hr'
  isActive: boolean
  currentLeaderId: string | null
  leaderOptions: LeaderOption[]
}

const ROLE_OPTIONS = [
  { value: 'collaborator', label: 'Colaborador' },
  { value: 'leader',       label: 'Líder' },
  { value: 'hr',           label: 'Arquitectura Humana' },
] as const

export function UserAdminControls({ userId, currentRole, isActive, currentLeaderId, leaderOptions }: Props) {
  const router = useRouter()
  const [role, setRole] = useState(currentRole)
  const [leaderId, setLeaderId] = useState<string>(currentLeaderId ?? '')
  const [active, setActive] = useState(isActive)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const dirty = role !== currentRole || leaderId !== (currentLeaderId ?? '') || active !== isActive

  function save() {
    if (!dirty || pending) return
    startTransition(async () => {
      setMsg(null)
      if (role !== currentRole) {
        const r = await updateUserRole({ userId, role })
        if (!r.success) { setMsg({ type: 'err', text: r.error ?? 'Error al cambiar rol' }); return }
      }
      if (active !== isActive) {
        const r = await updateUserActive({ userId, isActive: active })
        if (!r.success) { setMsg({ type: 'err', text: r.error ?? 'Error al cambiar estado' }); return }
      }
      if (leaderId !== (currentLeaderId ?? '')) {
        const r = await assignLeader({ collaboratorId: userId, newLeaderId: leaderId || null })
        if (!r.success) { setMsg({ type: 'err', text: r.error ?? 'Error al asignar líder' }); return }
      }
      setMsg({ type: 'ok', text: 'Cambios guardados' })
      router.refresh()
    })
  }

  return (
    <div className="ui-card" style={{ borderColor: 'var(--accent-200)' }}>
      <div className="ui-card__head" style={{ borderBottom: '1px solid var(--accent-200)' }}>
        <div>
          <h3 className="ui-card__title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={15} style={{ color: 'var(--accent-500)' }} /> Controles administrativos
          </h3>
          <p className="ui-card__desc">Solo Arquitectura Humana puede modificar estos campos. Cada cambio queda en auditoría.</p>
        </div>
      </div>

      <div className="ui-card__body" style={{ display: 'grid', gap: 16 }}>
        <div>
          <label className="ui-label">Rol</label>
          <select className="ui-select" value={role} onChange={e => setRole(e.target.value as typeof role)}>
            {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="ui-label">Líder asignado</label>
          <select className="ui-select" value={leaderId} onChange={e => setLeaderId(e.target.value)}>
            <option value="">— Sin líder asignado —</option>
            {leaderOptions.map(l => (
              <option key={l.id} value={l.id} disabled={l.id === userId}>
                {l.full_name} ({l.email})
              </option>
            ))}
          </select>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
            Cambiar el líder cierra la relación anterior y crea una nueva. El histórico se mantiene.
          </p>
        </div>

        <div>
          <label className="ui-label" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={active}
              onChange={e => setActive(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            <span>Usuario activo</span>
            {!active && <ShieldAlert size={13} style={{ color: 'var(--red-700)' }} />}
          </label>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
            Desactivar evita que aparezca en listas y selectores; no borra historial.
          </p>
        </div>

        {msg && (
          <p style={{
            fontSize: 12.5,
            color: msg.type === 'ok' ? 'var(--green-700)' : 'var(--red-700)',
            margin: 0,
          }}>
            {msg.text}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="ui-btn ui-btn--accent ui-btn--sm"
            onClick={save}
            disabled={!dirty || pending}
          >
            {pending ? <span className="spinner" /> : <Save size={13} />}
            <span>{pending ? 'Guardando…' : 'Guardar cambios'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Calendar } from 'lucide-react'
import { scheduleOneOnOne } from '@/lib/actions/one-on-ones'

interface Person { id: string; full_name: string; email: string }
interface MeetingFormProps {
  counterparts: Person[]
  currentRole: 'leader' | 'collaborator'
  currentUserId: string
}

export function MeetingForm({ counterparts, currentRole, currentUserId }: MeetingFormProps) {
  const router = useRouter()
  const [counterpartId, setCounterpartId] = useState(counterparts[0]?.id ?? '')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('10:00')
  const [duration, setDuration] = useState('30')
  const [modality, setModality] = useState<'virtual' | 'presencial'>('virtual')
  const [location, setLocation] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!counterpartId || !date) {
      setError('Selecciona participante y fecha')
      return
    }
    const scheduledAt = new Date(`${date}T${time}:00`).toISOString()
    startTransition(async () => {
      const collaboratorId = currentRole === 'leader' ? counterpartId : currentUserId
      const result = await scheduleOneOnOne({
        collaboratorId,
        scheduledAt,
        durationMinutes: parseInt(duration),
        modality,
        location: modality === 'presencial' ? location : undefined,
      })
      if (!result.success) { setError(result.error ?? 'Error al agendar'); return }
      const basePath = currentRole === 'leader' ? '/lider' : '/colaborador'
      router.push(`${basePath}/1to1/${result.data?.id}`)
    })
  }

  const counterpartLabel = currentRole === 'leader' ? 'Colaborador' : 'Líder'
  const minDate = new Date().toISOString().split('T')[0]

  return (
    <div className="ui-card" style={{ maxWidth: 560 }}>
      <div className="ui-card__head">
        <div>
          <h3 className="ui-card__title font-serif" style={{ fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={16} /> Agendar 1:1
          </h3>
          <p className="ui-card__desc">Define los detalles de la próxima reunión</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="ui-card__body" style={{ display: 'grid', gap: 16 }}>
        <div>
          <label className="ui-label">{counterpartLabel}</label>
          <select className="ui-select" value={counterpartId} onChange={e => setCounterpartId(e.target.value)} required>
            {counterparts.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="ui-label">Fecha</label>
            <input className="ui-input" type="date" value={date} onChange={e => setDate(e.target.value)} required min={minDate} />
          </div>
          <div>
            <label className="ui-label">Hora</label>
            <input className="ui-input" type="time" value={time} onChange={e => setTime(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="ui-label">Duración</label>
            <select className="ui-select" value={duration} onChange={e => setDuration(e.target.value)}>
              <option value="15">15 min</option>
              <option value="30">30 min</option>
              <option value="45">45 min</option>
              <option value="60">1 hora</option>
            </select>
          </div>
          <div>
            <label className="ui-label">Modalidad</label>
            <select className="ui-select" value={modality} onChange={e => setModality(e.target.value as 'virtual' | 'presencial')}>
              <option value="virtual">Virtual (Meet)</option>
              <option value="presencial">Presencial</option>
            </select>
          </div>
        </div>

        {modality === 'presencial' && (
          <div>
            <label className="ui-label">Ubicación</label>
            <input className="ui-input" value={location} onChange={e => setLocation(e.target.value)} placeholder="Sala de juntas A" />
          </div>
        )}

        {error && <p style={{ fontSize: 13, color: 'var(--red-700)', margin: 0 }}>{error}</p>}

        <button type="submit" className="ui-btn ui-btn--primary ui-btn--block" disabled={isPending}>
          {isPending ? <Loader2 size={14} className="animate-spin" /> : null}
          Agendar reunión
        </button>
      </form>
    </div>
  )
}

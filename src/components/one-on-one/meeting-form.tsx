'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Calendar, Clock, Video, MapPin, AlertCircle } from 'lucide-react'
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
  const [duration, setDuration] = useState<'15' | '30' | '45' | '60'>('30')
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

  const counterpart = counterparts.find(p => p.id === counterpartId)
  const initials = counterpart?.full_name.split(' ').map(p => p[0]).slice(0, 2).join('') ?? ''

  return (
    <div className="ui-card" style={{ maxWidth: 600 }}>
      <div className="ui-card__head">
        <div>
          <h3 className="ui-card__title">
            <Calendar size={15} /> Detalles de la reunión
          </h3>
          <p className="ui-card__desc">Define cuándo, cuánto tiempo y dónde se realizará</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="ui-card__body" style={{ display: 'grid', gap: 18 }}>
        <div>
          <label className="ui-label">{counterpartLabel}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {counterpart && (
              <div className={`avatar avatar--md av-blue`} aria-hidden="true">
                {initials}
              </div>
            )}
            <select
              className="ui-select"
              value={counterpartId}
              onChange={e => setCounterpartId(e.target.value)}
              required
              style={{ flex: 1 }}
            >
              {counterparts.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="ui-label">
              <Calendar size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: '-2px' }} />
              Fecha
            </label>
            <input className="ui-input" type="date" value={date} onChange={e => setDate(e.target.value)} required min={minDate} />
          </div>
          <div>
            <label className="ui-label">
              <Clock size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: '-2px' }} />
              Hora
            </label>
            <input className="ui-input" type="time" value={time} onChange={e => setTime(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="ui-label">Duración</label>
          <div className="segmented" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {(['15', '30', '45', '60'] as const).map(d => (
              <button
                key={d}
                type="button"
                data-active={duration === d}
                onClick={() => setDuration(d)}
              >
                {d === '60' ? '1 hora' : `${d} min`}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="ui-label">Modalidad</label>
          <div className="segmented" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <button
              type="button"
              data-active={modality === 'virtual'}
              onClick={() => setModality('virtual')}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Video size={13} /> Virtual (Meet)
            </button>
            <button
              type="button"
              data-active={modality === 'presencial'}
              onClick={() => setModality('presencial')}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <MapPin size={13} /> Presencial
            </button>
          </div>
        </div>

        {modality === 'presencial' && (
          <div className="anim-fade-in">
            <label className="ui-label">Ubicación</label>
            <input className="ui-input" value={location} onChange={e => setLocation(e.target.value)} placeholder="Sala de juntas A" />
            <p className="ui-field-hint">Indica dónde se reunirán dentro de la oficina.</p>
          </div>
        )}

        {error && (
          <div className="ui-field-error" role="alert">
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
          <button type="button" className="ui-btn ui-btn--outline" onClick={() => router.back()}>
            Cancelar
          </button>
          <button type="submit" className="ui-btn ui-btn--primary" disabled={isPending}>
            {isPending && <Loader2 size={14} className="animate-spin" />}
            Agendar reunión
          </button>
        </div>
      </form>
    </div>
  )
}

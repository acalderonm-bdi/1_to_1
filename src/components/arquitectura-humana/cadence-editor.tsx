'use client'

import { useState, useTransition } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  upsertGlobalCadence,
  upsertDepartmentCadence,
  removeDepartmentCadence,
} from '@/lib/actions/cadence'

interface DeptCadence {
  id: string
  name: string
  freq: number
  departmentId: string
}

interface CadenceEditorProps {
  initialGlobal: number | null
  initialDepts: DeptCadence[]
  allDepts: Array<{ id: string; name: string }>
}

export function CadenceEditor({ initialGlobal, initialDepts, allDepts }: CadenceEditorProps) {
  const [global, setGlobal] = useState(initialGlobal ?? 14)
  const [editing, setEditing] = useState(false)
  const [draftGlobal, setDraftGlobal] = useState(initialGlobal ?? 14)
  const [depts, setDepts] = useState<DeptCadence[]>(initialDepts)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  function saveGlobal() {
    startTransition(async () => {
      const r = await upsertGlobalCadence({ frequencyDays: draftGlobal })
      if (!r.success) {
        toast({ title: 'No se pudo guardar', description: r.error, variant: 'destructive' })
        return
      }
      setGlobal(draftGlobal)
      setEditing(false)
      toast({ title: 'Cadencia global actualizada' })
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title">Cadencia global</h3>
            <p className="ui-card__desc">Aplica a toda la organización por defecto.</p>
          </div>
          {!editing ? (
            <button
              type="button"
              className="ui-btn ui-btn--ghost ui-btn--sm"
              onClick={() => {
                setDraftGlobal(global)
                setEditing(true)
              }}
            >
              <Pencil size={13} /> Editar
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="ui-btn ui-btn--ghost ui-btn--sm"
                onClick={() => {
                  setDraftGlobal(global)
                  setEditing(false)
                }}
                disabled={isPending}
              >
                <X size={13} /> Cancelar
              </button>
              <button
                type="button"
                className="ui-btn ui-btn--accent ui-btn--sm"
                onClick={saveGlobal}
                disabled={isPending || draftGlobal === global}
              >
                <Check size={13} /> Guardar
              </button>
            </div>
          )}
        </div>
        <div className="ui-card__body">
          {editing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="number"
                className="ui-input"
                min={1}
                max={90}
                value={draftGlobal}
                onChange={(e) => setDraftGlobal(Number(e.target.value))}
                style={{ width: 100 }}
              />
              <span style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>días entre 1:1s</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
              <span
                style={{
                  fontSize: 48,
                  fontWeight: 500,
                  fontFamily: 'var(--font-serif)',
                  lineHeight: 1,
                }}
              >
                {global}
              </span>
              <span style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>días entre 1:1s</span>
            </div>
          )}
        </div>
      </div>

      <DepartmentCadences depts={depts} setDepts={setDepts} allDepts={allDepts} />
    </div>
  )
}

function DepartmentCadences(props: {
  depts: DeptCadence[]
  setDepts: React.Dispatch<React.SetStateAction<DeptCadence[]>>
  allDepts: Array<{ id: string; name: string }>
}) {
  const [adding, setAdding] = useState(false)
  const [draftDept, setDraftDept] = useState('')
  const [draftFreq, setDraftFreq] = useState(14)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const usedIds = new Set(props.depts.map((d) => d.departmentId))
  const available = props.allDepts.filter((d) => !usedIds.has(d.id))

  function addOverride() {
    if (!draftDept) return
    startTransition(async () => {
      const r = await upsertDepartmentCadence({ departmentId: draftDept, frequencyDays: draftFreq })
      if (!r.success) {
        toast({ title: 'No se pudo agregar', description: r.error, variant: 'destructive' })
        return
      }
      const dept = props.allDepts.find((d) => d.id === draftDept)
      props.setDepts((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          name: dept?.name ?? '',
          freq: draftFreq,
          departmentId: draftDept,
        },
      ])
      setAdding(false)
      setDraftDept('')
      setDraftFreq(14)
      toast({ title: 'Override agregado' })
    })
  }

  function removeOverride(id: string) {
    startTransition(async () => {
      const r = await removeDepartmentCadence(id)
      if (!r.success) {
        toast({ title: 'No se pudo eliminar', description: r.error, variant: 'destructive' })
        return
      }
      props.setDepts((prev) => prev.filter((d) => d.id !== id))
      toast({ title: 'Override eliminado' })
    })
  }

  return (
    <div className="ui-card">
      <div className="ui-card__head">
        <div>
          <h3 className="ui-card__title">Cadencias por área</h3>
          <p className="ui-card__desc">Override por departamento.</p>
        </div>
        {!adding && available.length > 0 && (
          <button
            type="button"
            className="ui-btn ui-btn--accent ui-btn--sm"
            onClick={() => setAdding(true)}
          >
            + Agregar
          </button>
        )}
      </div>
      <div className="ui-card__body ui-card__body--flush">
        {props.depts.length === 0 && !adding && (
          <div style={{ padding: '14px 24px', fontSize: 13, color: 'var(--text-muted)' }}>
            Sin overrides — todas las áreas usan la cadencia global.
          </div>
        )}
        {props.depts.map((d) => (
          <div
            key={d.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 24px',
              borderBottom: '1px solid var(--border-c)',
            }}
          >
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>{d.name}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Cada <strong style={{ color: 'var(--text-c)' }}>{d.freq}</strong> días
              </span>
              <button
                type="button"
                className="ui-btn ui-btn--ghost ui-btn--sm"
                onClick={() => removeOverride(d.id)}
                disabled={isPending}
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
        {adding && (
          <div
            style={{
              padding: '14px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <select
              className="ui-input"
              value={draftDept}
              onChange={(e) => setDraftDept(e.target.value)}
              style={{ flex: 1, minWidth: 180 }}
            >
              <option value="">Seleccionar área…</option>
              {available.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              className="ui-input"
              value={draftFreq}
              onChange={(e) => setDraftFreq(Number(e.target.value))}
              min={1}
              max={90}
              style={{ width: 80 }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>días</span>
            <button
              type="button"
              className="ui-btn ui-btn--ghost ui-btn--sm"
              onClick={() => {
                setAdding(false)
                setDraftDept('')
                setDraftFreq(14)
              }}
              disabled={isPending}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="ui-btn ui-btn--accent ui-btn--sm"
              onClick={addOverride}
              disabled={isPending || !draftDept}
            >
              Guardar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

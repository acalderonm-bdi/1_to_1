'use client'

import { useState, useTransition } from 'react'
import { Upload, AlertCircle, CheckCircle, Eye, Play } from 'lucide-react'
import { previewOrgSync, applyOrgSync } from '@/lib/actions/org-sync'
import type { SyncReport } from '@/lib/sync/org-sync'

export function SyncPanel() {
  const [csvText, setCsvText] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [report, setReport] = useState<SyncReport | null>(null)
  const [applied, setApplied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null); setReport(null); setApplied(false)
    setFileName(file.name)
    setCsvText(await file.text())
  }

  function runPreview() {
    if (!csvText) return
    setError(null); setApplied(false)
    startTransition(async () => {
      const res = await previewOrgSync(csvText)
      if (res.success && res.data) setReport(res.data)
      else setError(res.error ?? 'Error')
    })
  }

  function runApply() {
    if (!csvText) return
    setError(null)
    startTransition(async () => {
      const res = await applyOrgSync(csvText)
      if (res.success && res.data) { setReport(res.data); setApplied(res.data.validationErrors.length === 0) }
      else setError(res.error ?? 'Error')
    })
  }

  const hasValidationErrors = !!report && report.validationErrors.length > 0
  const canApply = !!report && !hasValidationErrors && !applied && !pending

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="ui-card">
        <div className="ui-card__body" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <label className="ui-btn ui-btn--outline ui-btn--sm" style={{ cursor: 'pointer' }}>
            <Upload size={14} /> Elegir CSV
            <input type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: 'none' }} />
          </label>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {fileName ? fileName : 'Base de líderes de RH (ID, NOMBRE COMPLETO, AREA, SUB AREA, cadena de mando, CORREO ORGANIZACIONAL)'}
          </span>
          <div style={{ flex: 1 }} />
          <button type="button" className="ui-btn ui-btn--outline ui-btn--sm" onClick={runPreview} disabled={!csvText || pending}>
            <Eye size={14} /> {pending && !applied ? 'Procesando…' : 'Previsualizar'}
          </button>
          <button type="button" className="ui-btn ui-btn--accent ui-btn--sm" onClick={runApply} disabled={!canApply}>
            <Play size={14} /> Aplicar
          </button>
        </div>
      </div>

      {error && (
        <div className="ui-card" style={{ borderColor: 'hsl(var(--destructive) / 0.4)' }}>
          <div className="ui-card__body" style={{ color: 'hsl(var(--destructive))', fontSize: 13, display: 'flex', gap: 8 }}>
            <AlertCircle size={16} /> {error}
          </div>
        </div>
      )}

      {applied && (
        <div className="ui-card" style={{ borderColor: 'hsl(var(--success) / 0.4)' }}>
          <div className="ui-card__body" style={{ color: 'hsl(var(--success))', fontSize: 13.5, display: 'flex', gap: 8, alignItems: 'center' }}>
            <CheckCircle size={16} /> Sincronización aplicada correctamente.
          </div>
        </div>
      )}

      {report && (
        <div className="ui-card">
          <div className="ui-card__head">
            <div>
              <h3 className="ui-card__title">{applied ? 'Resultado' : 'Vista previa del cambio'}</h3>
              <p className="ui-card__desc">
                {report.totalRows} filas · {report.excluded.length} excluidas
              </p>
            </div>
          </div>
          <div className="ui-card__body">
            {hasValidationErrors ? (
              <div style={{ color: 'hsl(var(--destructive))', fontSize: 13 }}>
                <strong>CSV inválido — no se escribió nada:</strong>
                <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                  {report.validationErrors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 12 }}>
                  <Stat label="Altas" value={report.usersCreated} tone="green" />
                  <Stat label="Cambios" value={report.usersUpdated} tone="amber" />
                  <Stat label="Reactivados" value={report.usersReactivated} tone="blue" />
                  <Stat label="Bajas" value={report.deactivated.length} tone="red" />
                  <Stat label="Relaciones +" value={report.relationsCreated} tone="violet" />
                  <Stat label="Relaciones −" value={report.relationsClosed} tone="slate" />
                  <Stat label="Áreas nuevas" value={report.departmentsToCreate.length} tone="slate" />
                </div>

                {report.excluded.length > 0 && (
                  <Detail summary={`${report.excluded.length} fila(s) excluidas del import`}>
                    {report.excluded.map((e, i) => <li key={i}>{e}</li>)}
                  </Detail>
                )}
                {report.people.length > 0 && (
                  <Detail summary={`${report.people.length} persona(s) con cambios`}>
                    {report.people.map((p) => (
                      <li key={p.employeeId}>
                        <strong>{p.employeeId}</strong> {p.name} — {p.action}
                        {p.changes.length > 0 ? `: ${p.changes.join(', ')}` : ''}
                      </li>
                    ))}
                  </Detail>
                )}
                {report.relationChanges.length > 0 && (
                  <Detail summary={`${report.relationChanges.length} colaborador(es) cambian de líder(es)`}>
                    {report.relationChanges.map((rc) => (
                      <li key={rc.collaboratorEmployeeId}>
                        <strong>{rc.collaboratorEmployeeId}</strong> {rc.collaboratorName}
                        {rc.creates.length > 0 && <> · alta con: {rc.creates.join(', ')}</>}
                        {rc.closes.length > 0 && <> · cierra con: {rc.closes.join(', ')}</>}
                      </li>
                    ))}
                  </Detail>
                )}
                {report.deactivated.length > 0 && (
                  <Detail summary={`${report.deactivated.length} baja(s) (ya no están activos en el CSV)`}>
                    {report.deactivated.map((id) => <li key={id}>{id}</li>)}
                  </Detail>
                )}
                {report.hrProtected.length > 0 && (
                  <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 8 }}>
                    ⚠ {report.hrProtected.length} usuario(s) RH ausentes del CSV NO se desactivan automáticamente
                    ({report.hrProtected.join(', ')}). Baja manual si corresponde.
                  </p>
                )}

                {report.errors.length > 0 && (
                  <div style={{ color: 'hsl(var(--destructive))', fontSize: 12.5, marginTop: 8 }}>
                    {report.errors.length} error(es): {report.errors.slice(0, 3).join(' · ')}{report.errors.length > 3 ? '…' : ''}
                  </div>
                )}
                {!applied && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Revisa el diff y pulsa <strong>Aplicar</strong>. El primer import masivo conviene correrlo por CLI (<code>pnpm org-sync</code>).
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Detail({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details style={{ marginTop: 8, fontSize: 12.5 }}>
      <summary style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>{summary}</summary>
      <ul style={{ margin: '6px 0 0', paddingLeft: 18, maxHeight: 240, overflowY: 'auto' }}>
        {children}
      </ul>
    </details>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="kpi" style={{ padding: 12 }}>
      <div className="kpi__label">{label}</div>
      <div className="kpi__value u-tabular" style={{ fontSize: 22 }}>{value}</div>
      <span className={`ui-badge ui-badge--${tone}`} style={{ marginTop: 4 }}>&nbsp;</span>
    </div>
  )
}

'use client'

import { useState, useRef, useTransition, useCallback } from 'react'
import {
  RefreshCcw,
  Upload,
  FileSpreadsheet,
  Eye,
  Check,
  AlertTriangle,
  UserPlus,
  UserMinus,
  UserCheck,
  Building2,
  ArrowRight,
  X,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { previewExcelSync, applyExcelSync } from '@/lib/actions/hr-sync'
import type { SyncPreview } from '@/lib/actions/hr-sync'

// ---------------------------------------------------------------------------
// Section badge
// ---------------------------------------------------------------------------

function Badge({
  count,
  color,
}: {
  count: number
  color: 'green' | 'yellow' | 'red' | 'blue' | 'gray'
}) {
  const map: Record<typeof color, string> = {
    green: 'background: hsl(142 70% 45% / 0.15); color: hsl(142 70% 38%); border: 1px solid hsl(142 70% 45% / 0.35)',
    yellow: 'background: hsl(var(--warning) / 0.15); color: hsl(var(--warning)); border: 1px solid hsl(var(--warning) / 0.35)',
    red: 'background: hsl(0 72% 50% / 0.12); color: hsl(0 72% 45%); border: 1px solid hsl(0 72% 50% / 0.3)',
    blue: 'background: hsl(var(--primary) / 0.12); color: hsl(var(--primary)); border: 1px solid hsl(var(--primary) / 0.3)',
    gray: 'background: var(--bg-d); color: var(--text-c); border: 1px solid var(--border-c)',
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        fontSize: 11,
        fontWeight: 700,
        padding: '0 6px',
        ...Object.fromEntries(
          map[color].split(';').map((s) => {
            const [k, v] = s.split(':').map((x) => x.trim())
            return [k.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase()), v]
          }),
        ),
      }}
    >
      {count}
    </span>
  )
}

// ---------------------------------------------------------------------------
// SyncPanel
// ---------------------------------------------------------------------------

export function SyncPanel() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview] = useState<SyncPreview | null>(null)
  const [result, setResult] = useState<{
    created: number
    updated: number
    deactivated: number
  } | null>(null)

  const [isPreviewing, startPreview] = useTransition()
  const [isApplying, startApply] = useTransition()

  const isPending = isPreviewing || isApplying

  // -------------------------------------------------------------------------
  // File handling
  // -------------------------------------------------------------------------

  function handleFileChange(chosen: File | null) {
    setFile(chosen)
    setPreview(null)
    setResult(null)
  }

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      const dropped = e.dataTransfer.files[0]
      if (!dropped) return
      if (!dropped.name.endsWith('.xlsx') && !dropped.name.endsWith('.xls')) {
        toast({ title: 'Formato no válido', description: 'Solo se aceptan archivos .xlsx o .xls', variant: 'destructive' })
        return
      }
      handleFileChange(dropped)
    },
    [toast],
  )

  // -------------------------------------------------------------------------
  // Preview
  // -------------------------------------------------------------------------

  function handlePreview() {
    if (!file) return
    startPreview(async () => {
      const fd = new FormData()
      fd.append('file', file)
      const r = await previewExcelSync(fd)
      if (!r.success) {
        toast({ title: 'Error al procesar el archivo', description: r.error, variant: 'destructive' })
        return
      }
      setPreview(r.data!)
      if (r.data!.errors.length > 0) {
        toast({
          title: `${r.data!.errors.length} advertencia${r.data!.errors.length > 1 ? 's' : ''}`,
          description: 'Revisa la sección de advertencias en la vista previa.',
          variant: 'destructive',
        })
      }
    })
  }

  // -------------------------------------------------------------------------
  // Apply
  // -------------------------------------------------------------------------

  function handleApply() {
    if (!file) return
    const confirmed = window.confirm(
      `¿Aplicar sincronización?\n\n` +
      `• ${preview?.toCreate.length ?? 0} usuarios nuevos\n` +
      `• ${preview?.toUpdate.length ?? 0} usuarios a actualizar\n` +
      `• ${preview?.toDeactivate.length ?? 0} usuarios a desactivar\n\n` +
      `Esta acción modificará la base de datos de producción.`,
    )
    if (!confirmed) return

    startApply(async () => {
      const fd = new FormData()
      fd.append('file', file)
      const r = await applyExcelSync(fd)
      if (!r.success) {
        toast({ title: 'Error al aplicar sync', description: r.error, variant: 'destructive' })
        return
      }
      setResult(r.data!)
      setPreview(null)
      setFile(null)
      toast({ title: 'Sincronización aplicada correctamente' })
    })
  }

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const totalChanges =
    preview
      ? preview.toCreate.length + preview.toUpdate.length + preview.toDeactivate.length
      : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header card */}
      <div className="ui-card">
        <div className="ui-card__head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <RefreshCcw size={16} style={{ color: 'hsl(var(--primary))' }} />
            <h3 className="ui-card__title">Sincronización desde Excel RH</h3>
          </div>
        </div>
        <div className="ui-card__body">
          <p className="ui-card__desc" style={{ marginBottom: 0 }}>
            Sube el archivo Excel de Recursos Humanos (hoja{' '}
            <strong>PERSONAL ACTIVO</strong>) para comparar y sincronizar
            usuarios, departamentos y relaciones de liderazgo.
          </p>
        </div>
      </div>

      {/* Upload zone */}
      <div className="ui-card">
        <div className="ui-card__head">
          <h3 className="ui-card__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Upload size={14} /> Archivo Excel
          </h3>
        </div>
        <div className="ui-card__body">
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            style={{
              border: `2px dashed ${isDragging ? 'hsl(var(--primary))' : 'var(--border-c)'}`,
              borderRadius: 8,
              padding: '32px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: isDragging ? 'hsl(var(--primary) / 0.05)' : 'var(--bg-d)',
              transition: 'border-color 0.15s, background 0.15s',
              outline: 'none',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={(e) => {
                const chosen = e.target.files?.[0] ?? null
                handleFileChange(chosen)
                e.target.value = ''
              }}
            />
            {file ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <FileSpreadsheet size={20} style={{ color: 'hsl(142 70% 40%)' }} />
                <span style={{ fontSize: 14, fontWeight: 500 }}>{file.name}</span>
                <button
                  type="button"
                  className="ui-btn ui-btn--ghost ui-btn--sm"
                  style={{ padding: '2px 6px', marginLeft: 4 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleFileChange(null)
                  }}
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <div>
                <FileSpreadsheet
                  size={32}
                  style={{ color: 'var(--text-muted)', marginBottom: 8 }}
                />
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 500 }}>
                  Arrastra el archivo aquí o haz clic para seleccionar
                </p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                  .xlsx · hoja PERSONAL ACTIVO
                </p>
              </div>
            )}
          </div>

          {file && (
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button
                type="button"
                className="ui-btn ui-btn--accent ui-btn--sm"
                onClick={handlePreview}
                disabled={isPending}
              >
                <Eye size={13} />
                {isPreviewing ? 'Analizando…' : 'Vista previa'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Preview results */}
      {preview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Summary bar */}
          <div
            className="ui-card"
            style={{
              background:
                totalChanges === 0
                  ? 'hsl(142 70% 45% / 0.08)'
                  : 'hsl(var(--primary) / 0.06)',
              borderLeft: `3px solid ${totalChanges === 0 ? 'hsl(142 70% 45%)' : 'hsl(var(--primary))'}`,
            }}
          >
            <div className="ui-card__body" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1, minWidth: 200 }}>
                Resumen de cambios detectados
              </span>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <StatChip icon={<UserPlus size={13} />} label="Nuevos" count={preview.toCreate.length} color="green" />
                <StatChip icon={<UserCheck size={13} />} label="Actualizar" count={preview.toUpdate.length} color="yellow" />
                <StatChip icon={<UserMinus size={13} />} label="Desactivar" count={preview.toDeactivate.length} color="red" />
                <StatChip icon={<Building2 size={13} />} label="Depts. nuevos" count={preview.departmentsToCreate.length} color="blue" />
                <StatChip icon={<ArrowRight size={13} />} label="Cambios lider" count={preview.leadershipChanges.length} color="blue" />
              </div>
            </div>
          </div>

          {/* New users */}
          {preview.toCreate.length > 0 && (
            <PreviewSection
              title="Usuarios nuevos"
              color="green"
              count={preview.toCreate.length}
              icon={<UserPlus size={14} />}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-c)' }}>
                    <Th>ID RH</Th>
                    <Th>Nombre</Th>
                    <Th>Correo</Th>
                    <Th>Área</Th>
                    <Th>Rol</Th>
                  </tr>
                </thead>
                <tbody>
                  {preview.toCreate.map((u) => (
                    <tr key={u.hr_id} style={{ borderBottom: '1px solid var(--border-c)' }}>
                      <Td mono>{u.hr_id}</Td>
                      <Td>{u.full_name}</Td>
                      <Td muted>{u.email}</Td>
                      <Td>{u.area}</Td>
                      <Td>
                        <RoleBadge role={u.role} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </PreviewSection>
          )}

          {/* Users to update */}
          {preview.toUpdate.length > 0 && (
            <PreviewSection
              title="Usuarios a actualizar"
              color="yellow"
              count={preview.toUpdate.length}
              icon={<UserCheck size={14} />}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-c)' }}>
                    <Th>ID RH</Th>
                    <Th>Nombre</Th>
                    <Th>Correo</Th>
                    <Th>Cambios</Th>
                  </tr>
                </thead>
                <tbody>
                  {preview.toUpdate.map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border-c)' }}>
                      <Td mono>{u.hr_id}</Td>
                      <Td>{u.full_name}</Td>
                      <Td muted>{u.email}</Td>
                      <Td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {u.changes.map((c, i) => (
                            <span key={i} style={{ fontSize: 12, color: 'hsl(var(--warning))' }}>
                              {c}
                            </span>
                          ))}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </PreviewSection>
          )}

          {/* Users to deactivate */}
          {preview.toDeactivate.length > 0 && (
            <PreviewSection
              title="Usuarios a desactivar"
              color="red"
              count={preview.toDeactivate.length}
              icon={<UserMinus size={14} />}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-c)' }}>
                    <Th>Nombre</Th>
                    <Th>Correo</Th>
                  </tr>
                </thead>
                <tbody>
                  {preview.toDeactivate.map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border-c)' }}>
                      <Td>{u.full_name}</Td>
                      <Td muted>{u.email}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                Los usuarios no se eliminan — solo se marca is_active = false. Los de rol <strong>rh</strong> nunca se tocan.
              </p>
            </PreviewSection>
          )}

          {/* Departments to create */}
          {preview.departmentsToCreate.length > 0 && (
            <PreviewSection
              title="Departamentos nuevos"
              color="blue"
              count={preview.departmentsToCreate.length}
              icon={<Building2 size={14} />}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '4px 0' }}>
                {preview.departmentsToCreate.map((d) => (
                  <span
                    key={d}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 4,
                      fontSize: 12,
                      background: 'hsl(var(--primary) / 0.1)',
                      color: 'hsl(var(--primary))',
                      border: '1px solid hsl(var(--primary) / 0.25)',
                    }}
                  >
                    {d}
                  </span>
                ))}
              </div>
            </PreviewSection>
          )}

          {/* Leadership changes */}
          {preview.leadershipChanges.length > 0 && (
            <PreviewSection
              title="Cambios de líder"
              color="blue"
              count={preview.leadershipChanges.length}
              icon={<ArrowRight size={14} />}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-c)' }}>
                    <Th>Colaborador</Th>
                    <Th>Líder anterior</Th>
                    <Th></Th>
                    <Th>Líder nuevo</Th>
                  </tr>
                </thead>
                <tbody>
                  {preview.leadershipChanges.map((lc, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-c)' }}>
                      <Td muted>{lc.collaborator_email}</Td>
                      <Td muted>{lc.old_leader ?? '—'}</Td>
                      <Td>
                        <ArrowRight size={12} style={{ color: 'var(--text-muted)' }} />
                      </Td>
                      <Td>{lc.new_leader}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </PreviewSection>
          )}

          {/* Warnings */}
          {preview.errors.length > 0 && (
            <PreviewSection
              title="Advertencias del archivo"
              color="yellow"
              count={preview.errors.length}
              icon={<AlertTriangle size={14} />}
            >
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {preview.errors.map((e, i) => (
                  <li key={i} style={{ fontSize: 12.5, color: 'hsl(var(--warning))' }}>
                    {e}
                  </li>
                ))}
              </ul>
            </PreviewSection>
          )}

          {/* No changes */}
          {totalChanges === 0 && preview.leadershipChanges.length === 0 && preview.departmentsToCreate.length === 0 && (
            <div
              className="ui-card"
              style={{
                background: 'hsl(142 70% 45% / 0.08)',
                borderLeft: '3px solid hsl(142 70% 45%)',
                padding: '20px 24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Check size={18} style={{ color: 'hsl(142 70% 40%)' }} />
                <span style={{ fontSize: 14, fontWeight: 500 }}>
                  La base de datos ya está al día — no hay cambios que aplicar.
                </span>
              </div>
            </div>
          )}

          {/* Apply button */}
          {(totalChanges > 0 || preview.leadershipChanges.length > 0 || preview.departmentsToCreate.length > 0) && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 8 }}>
              <button
                type="button"
                className="ui-btn ui-btn--accent"
                onClick={handleApply}
                disabled={isPending}
                style={{ gap: 8 }}
              >
                <Check size={15} />
                {isApplying ? 'Aplicando…' : 'Aplicar sincronización'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Result */}
      {result && (
        <div
          className="ui-card"
          style={{
            background: 'hsl(142 70% 45% / 0.08)',
            borderLeft: '3px solid hsl(142 70% 45%)',
            padding: '20px 24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Check size={18} style={{ color: 'hsl(142 70% 40%)' }} />
            <span style={{ fontSize: 15, fontWeight: 600 }}>Sincronización completada</span>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <ResultStat label="Creados" value={result.created} color="green" />
            <ResultStat label="Actualizados" value={result.updated} color="yellow" />
            <ResultStat label="Desactivados" value={result.deactivated} color="red" />
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function StatChip({
  icon,
  label,
  count,
  color,
}: {
  icon: React.ReactNode
  label: string
  count: number
  color: 'green' | 'yellow' | 'red' | 'blue'
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
      <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
      <span style={{ color: 'var(--text-c)' }}>{label}</span>
      <Badge count={count} color={color} />
    </div>
  )
}

function ResultStat({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: 'green' | 'yellow' | 'red'
}) {
  const colorMap = {
    green: 'hsl(142 70% 38%)',
    yellow: 'hsl(var(--warning))',
    red: 'hsl(0 72% 45%)',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80 }}>
      <span style={{ fontSize: 28, fontWeight: 700, color: colorMap[color] }}>{value}</span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
    </div>
  )
}

function RoleBadge({ role }: { role: 'leader' | 'collaborator' }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 4,
        background: role === 'leader' ? 'hsl(var(--primary) / 0.12)' : 'var(--bg-d)',
        color: role === 'leader' ? 'hsl(var(--primary))' : 'var(--text-c)',
        border: `1px solid ${role === 'leader' ? 'hsl(var(--primary) / 0.25)' : 'var(--border-c)'}`,
      }}
    >
      {role === 'leader' ? 'Líder' : 'Colaborador'}
    </span>
  )
}

function PreviewSection({
  title,
  color,
  count,
  icon,
  children,
}: {
  title: string
  color: 'green' | 'yellow' | 'red' | 'blue'
  count: number
  icon: React.ReactNode
  children: React.ReactNode
}) {
  const borderMap = {
    green: 'hsl(142 70% 45%)',
    yellow: 'hsl(var(--warning))',
    red: 'hsl(0 72% 50%)',
    blue: 'hsl(var(--primary))',
  }
  return (
    <div
      className="ui-card"
      style={{ borderLeft: `3px solid ${borderMap[color]}` }}
    >
      <div className="ui-card__head">
        <h3 className="ui-card__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon}
          {title}
          <Badge count={count} color={color} />
        </h3>
      </div>
      <div className="ui-card__body ui-card__body--flush" style={{ overflowX: 'auto' }}>
        <div style={{ padding: '0 0 4px' }}>{children}</div>
      </div>
    </div>
  )
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: 'left',
        padding: '8px 16px',
        fontSize: 11.5,
        fontWeight: 600,
        color: 'var(--text-muted)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  mono,
  muted,
}: {
  children?: React.ReactNode
  mono?: boolean
  muted?: boolean
}) {
  return (
    <td
      style={{
        padding: '8px 16px',
        fontSize: 13,
        color: muted ? 'var(--text-muted)' : 'var(--text-b)',
        fontFamily: mono ? 'monospace' : undefined,
        verticalAlign: 'top',
      }}
    >
      {children}
    </td>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { Pencil, Check, X, Trash2, Plus, Building2, Settings2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  createDepartment,
  deleteDepartment,
  renameDepartment,
} from '@/lib/actions/departments'

export interface DepartmentItem {
  id: string
  name: string
  userCount: number
}

interface DepartmentManagerProps {
  initialDepartments: DepartmentItem[]
}

export function DepartmentManager({ initialDepartments }: DepartmentManagerProps) {
  const { toast } = useToast()
  const [items, setItems] = useState<DepartmentItem[]>(initialDepartments)
  const [adding, setAdding] = useState(false)
  const [draftNewName, setDraftNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftEditName, setDraftEditName] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAdd() {
    const name = draftNewName.trim()
    if (!name) return
    startTransition(async () => {
      const r = await createDepartment({ name })
      if (!r.success || !r.data) {
        toast({ title: 'No se pudo crear', description: r.error, variant: 'destructive' })
        return
      }
      setItems((prev) => [...prev, { id: r.data!.id, name, userCount: 0 }])
      setDraftNewName('')
      setAdding(false)
      toast({ title: 'Departamento creado' })
    })
  }

  function startEdit(item: DepartmentItem) {
    setEditingId(item.id)
    setDraftEditName(item.name)
  }

  function cancelEdit() {
    setEditingId(null)
    setDraftEditName('')
  }

  function handleRename(item: DepartmentItem) {
    const name = draftEditName.trim()
    if (!name || name === item.name) {
      cancelEdit()
      return
    }
    startTransition(async () => {
      const r = await renameDepartment(item.id, name)
      if (!r.success) {
        toast({ title: 'No se pudo renombrar', description: r.error, variant: 'destructive' })
        return
      }
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, name } : x)))
      cancelEdit()
      toast({ title: 'Renombrado' })
    })
  }

  function confirmDelete() {
    if (!pendingDeleteId) return
    const id = pendingDeleteId
    startTransition(async () => {
      const r = await deleteDepartment(id)
      if (!r.success) {
        toast({
          title: 'No se pudo eliminar',
          description: r.error,
          variant: 'destructive',
        })
        setPendingDeleteId(null)
        return
      }
      setItems((prev) => prev.filter((x) => x.id !== id))
      setPendingDeleteId(null)
      toast({ title: 'Departamento eliminado' })
    })
  }

  const pendingItem = items.find((i) => i.id === pendingDeleteId)

  return (
    <>
      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={15} /> Departamentos
            </h3>
            <p className="ui-card__desc">
              {items.length} área{items.length === 1 ? '' : 's'} configurada{items.length === 1 ? '' : 's'}.
            </p>
          </div>
          {!adding && (
            <button
              type="button"
              className="ui-btn ui-btn--accent ui-btn--sm"
              onClick={() => setAdding(true)}
            >
              <Plus size={13} /> Nuevo
            </button>
          )}
        </div>
        <div className="ui-card__body ui-card__body--flush">
          {adding && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                padding: '12px 24px',
                borderBottom: '1px solid var(--border-c)',
              }}
            >
              <input
                type="text"
                className="ui-input"
                value={draftNewName}
                onChange={(e) => setDraftNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd()
                  if (e.key === 'Escape') {
                    setAdding(false)
                    setDraftNewName('')
                  }
                }}
                maxLength={100}
                placeholder="Nombre del departamento"
                autoFocus
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="ui-btn ui-btn--ghost ui-btn--sm"
                onClick={() => {
                  setAdding(false)
                  setDraftNewName('')
                }}
                disabled={isPending}
              >
                <X size={13} />
              </button>
              <button
                type="button"
                className="ui-btn ui-btn--accent ui-btn--sm"
                onClick={handleAdd}
                disabled={isPending || !draftNewName.trim()}
              >
                <Check size={13} /> Crear
              </button>
            </div>
          )}

          {items.length === 0 && !adding && (
            <div style={{ padding: '14px 24px', fontSize: 13, color: 'var(--text-muted)' }}>
              Sin departamentos. Creá el primero con el botón “Nuevo”.
            </div>
          )}

          {items.map((item) => {
            const editing = editingId === item.id
            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 24px',
                  borderBottom: '1px solid var(--border-c)',
                  gap: 8,
                }}
              >
                {editing ? (
                  <input
                    type="text"
                    className="ui-input"
                    value={draftEditName}
                    onChange={(e) => setDraftEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(item)
                      if (e.key === 'Escape') cancelEdit()
                    }}
                    maxLength={100}
                    autoFocus
                    style={{ flex: 1 }}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 500 }}>{item.name}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      {item.userCount} usuario{item.userCount === 1 ? '' : 's'}
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 6 }}>
                  {editing ? (
                    <>
                      <button
                        type="button"
                        className="ui-btn ui-btn--ghost ui-btn--sm"
                        onClick={cancelEdit}
                        disabled={isPending}
                      >
                        <X size={13} />
                      </button>
                      <button
                        type="button"
                        className="ui-btn ui-btn--accent ui-btn--sm"
                        onClick={() => handleRename(item)}
                        disabled={isPending || !draftEditName.trim()}
                      >
                        <Check size={13} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="ui-btn ui-btn--ghost ui-btn--sm"
                        onClick={() => startEdit(item)}
                        disabled={isPending}
                      >
                        <Pencil size={12} /> Renombrar
                      </button>
                      <button
                        type="button"
                        className="ui-btn ui-btn--ghost ui-btn--sm"
                        onClick={() => {
                          if (item.userCount > 0) {
                            toast({
                              title: 'No se puede eliminar',
                              description: `"${item.name}" tiene ${item.userCount} usuario${item.userCount === 1 ? '' : 's'} asignado${item.userCount === 1 ? '' : 's'}. Reasignalos antes de eliminar.`,
                              variant: 'destructive',
                            })
                            return
                          }
                          setPendingDeleteId(item.id)
                        }}
                        disabled={isPending}
                        title={
                          item.userCount > 0
                            ? `Hay ${item.userCount} usuario(s) asignado(s) — reasignalos antes de eliminar.`
                            : 'Eliminar departamento'
                        }
                        style={{
                          color: 'var(--destructive, #c0392b)',
                        }}
                      >
                        <Trash2 size={12} /> Eliminar
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingDeleteId}
        onOpenChange={(v) => !v && setPendingDeleteId(null)}
        title="Eliminar departamento"
        description={
          pendingItem
            ? `Vas a eliminar "${pendingItem.name}". Esta acción no se puede deshacer.`
            : 'Esta acción no se puede deshacer.'
        }
        confirmLabel="Eliminar"
        destructive
        onConfirm={confirmDelete}
      />
    </>
  )
}

interface DepartmentManagerDialogProps {
  initialDepartments: DepartmentItem[]
}

export function DepartmentManagerDialog({ initialDepartments }: DepartmentManagerDialogProps) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm">
          <Settings2 size={13} /> Gestionar departamentos
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Gestionar departamentos</DialogTitle>
          <DialogDescription>
            Creá, renombrá o eliminá áreas. Los departamentos con usuarios asignados no se pueden borrar.
          </DialogDescription>
        </DialogHeader>
        <DepartmentManager initialDepartments={initialDepartments} />
      </DialogContent>
    </Dialog>
  )
}

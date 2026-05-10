'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface AgendaItem { id: string; content: string; author_id: string }
interface AgendaListProps {
  oneOnOneId: string
  initialItems: AgendaItem[]
  currentUserId: string
  authorMap?: Record<string, string>
}

export function AgendaList({ oneOnOneId, initialItems, currentUserId, authorMap = {} }: AgendaListProps) {
  const [items, setItems] = useState<AgendaItem[]>(initialItems)
  const [newItem, setNewItem] = useState('')
  const [isPending, startTransition] = useTransition()

  async function handleAdd() {
    if (!newItem.trim()) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from('agenda_items')
      .insert({ one_on_one_id: oneOnOneId, author_id: currentUserId, content: newItem.trim() })
      .select().single()
    if (!error && data) {
      setItems(prev => [...prev, data as AgendaItem])
      setNewItem('')
    }
  }

  async function handleDelete(itemId: string) {
    const supabase = createClient()
    await supabase.from('agenda_items').delete().eq('id', itemId)
    setItems(prev => prev.filter(i => i.id !== itemId))
  }

  return (
    <div className="grid gap-2">
      {items.length === 0 && (
        <div className="text-[13px] text-muted-foreground py-4 px-4 text-center border border-dashed rounded-md bg-secondary/30">
          Aún no hay temas. Agrega el primero abajo.
        </div>
      )}
      {items.map(item => {
        const isMine = item.author_id === currentUserId
        const authorName = authorMap[item.author_id] ?? 'Tú'
        return (
          <div
            key={item.id}
            className="flex items-start gap-3 px-3.5 py-2.5 rounded-md border bg-secondary/30 hover:bg-background hover:border-border anim-fade-in"
          >
            <span className="size-3 mt-1 rounded-full border border-border shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0 text-[13.5px] leading-relaxed">
              {item.content}
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Sugerido por {isMine ? 'ti' : authorName.split(' ')[0]}
              </div>
            </div>
            {isMine && (
              <button
                type="button"
                onClick={() => handleDelete(item.id)}
                aria-label="Eliminar"
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        )
      })}
      <div className="flex gap-2 mt-1">
        <Input
          placeholder="Agregar tema…"
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); startTransition(handleAdd) } }}
        />
        <Button type="button" onClick={() => startTransition(handleAdd)} disabled={isPending || !newItem.trim()}>
          <Plus className="size-3.5" /> Agregar
        </Button>
      </div>
    </div>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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
    <div style={{ display: 'grid', gap: 8 }}>
      {items.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: 8, fontStyle: 'italic' }}>
          Aún no hay temas. Agrega el primero abajo.
        </div>
      )}
      {items.map(item => {
        const isMine = item.author_id === currentUserId
        const authorName = authorMap[item.author_id] ?? 'Tú'
        return (
          <div key={item.id} className="agenda-item" style={{ position: 'relative' }}>
            <div className="agenda-item__bullet" />
            <div className="agenda-item__text">
              {item.content}
              <div className="agenda-item__author">Sugerido por {isMine ? 'ti' : authorName.split(' ')[0]}</div>
            </div>
            {isMine && (
              <button
                onClick={() => handleDelete(item.id)}
                className="ui-btn ui-btn--ghost ui-btn--icon"
                style={{ width: 26, height: 26, padding: 4 }}
                aria-label="Eliminar"
                type="button"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        )
      })}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <input
          className="ui-input"
          placeholder="Agregar tema…"
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); startTransition(handleAdd) } }}
        />
        <button
          type="button"
          className="ui-btn ui-btn--primary"
          onClick={() => startTransition(handleAdd)}
          disabled={isPending || !newItem.trim()}
        >
          <Plus size={14} /> Agregar
        </button>
      </div>
    </div>
  )
}

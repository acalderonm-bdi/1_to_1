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
    const text = newItem.trim()
    if (!text) return
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const optimistic: AgendaItem = { id: tempId, content: text, author_id: currentUserId }
    setItems(prev => [...prev, optimistic])
    setNewItem('')
    const supabase = createClient()
    const { data, error } = await supabase
      .from('agenda_items')
      .insert({ one_on_one_id: oneOnOneId, author_id: currentUserId, content: text })
      .select().single()
    if (!error && data) {
      setItems(prev => prev.map(i => i.id === tempId ? (data as AgendaItem) : i))
    } else {
      setItems(prev => prev.filter(i => i.id !== tempId))
    }
  }

  async function handleDelete(itemId: string) {
    const previous = items
    setItems(prev => prev.filter(i => i.id !== itemId))
    const supabase = createClient()
    const { error } = await supabase.from('agenda_items').delete().eq('id', itemId)
    if (error) setItems(previous)
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {items.length === 0 && (
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-muted)',
            padding: '16px 12px',
            textAlign: 'center',
            border: '1px dashed var(--border-strong)',
            borderRadius: 'var(--r-md)',
            background: 'var(--bg-subtle)',
          }}
        >
          Aún no hay temas. Agrega el primero abajo.
        </div>
      )}
      {items.map(item => {
        const isMine = item.author_id === currentUserId
        const authorName = authorMap[item.author_id] ?? 'Tú'
        return (
          <div key={item.id} className="agenda-item anim-fade-in">
            <div className="agenda-item__bullet" />
            <div className="agenda-item__text">
              {item.content}
              <div className="agenda-item__author">
                Sugerido por {isMine ? 'ti' : authorName.split(' ')[0]}
              </div>
            </div>
            {isMine && (
              <button
                onClick={() => handleDelete(item.id)}
                className="ui-btn ui-btn--ghost ui-btn--icon"
                style={{ width: 28, height: 28, padding: 4 }}
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
          className="ui-btn ui-btn--accent"
          onClick={() => startTransition(handleAdd)}
          disabled={isPending || !newItem.trim()}
        >
          <Plus size={14} /> <span>Agregar</span>
        </button>
      </div>
    </div>
  )
}

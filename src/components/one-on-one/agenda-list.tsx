'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface AgendaItem {
  id: string
  content: string
  author_id: string
}

interface AgendaListProps {
  oneOnOneId: string
  initialItems: AgendaItem[]
  currentUserId: string
}

export function AgendaList({ oneOnOneId, initialItems, currentUserId }: AgendaListProps) {
  const [items, setItems] = useState<AgendaItem[]>(initialItems)
  const [newItem, setNewItem] = useState('')
  const [isPending, startTransition] = useTransition()

  async function handleAdd() {
    if (!newItem.trim()) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from('agenda_items')
      .insert({ one_on_one_id: oneOnOneId, author_id: currentUserId, content: newItem.trim() })
      .select()
      .single()
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
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="text-sm text-slate-400 italic">Sin temas de agenda todavía.</p>
      )}
      {items.map(item => (
        <div key={item.id} className="flex items-start gap-2 group">
          <span className="text-sm text-slate-700 flex-1 pt-0.5">{item.content}</span>
          {item.author_id === currentUserId && (
            <button
              onClick={() => handleDelete(item.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
      <div className="flex gap-2 pt-2">
        <Textarea
          placeholder="Agregar tema..."
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          className="min-h-0 h-9 py-1.5 text-sm resize-none"
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              startTransition(handleAdd)
            }
          }}
        />
        <Button size="sm" onClick={() => startTransition(handleAdd)} disabled={isPending || !newItem.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

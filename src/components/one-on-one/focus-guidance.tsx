'use client'

import { useEffect, useState } from 'react'
import { BookOpen, X } from 'lucide-react'

export function FocusGuidance() {
  const [open, setOpen] = useState(false)

  // A11y: cerrar con Escape mientras el modal esté abierto.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <div
        style={{
          borderLeft: '4px solid hsl(var(--primary))',
          background: 'hsl(var(--accent) / 0.4)',
          padding: '0.875rem 1rem',
          borderRadius: '0.5rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
        }}
      >
        <BookOpen size={20} style={{ color: 'hsl(var(--primary))', flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
            Recordá: esto es 1:1, no un seguimiento operativo.
          </p>
          <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>
            Hablamos de cómo estás, qué te bloquea, qué necesitás. Los pendientes operativos van en tu reunión de equipo.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              marginTop: 6,
              cursor: 'pointer',
              fontSize: '0.75rem',
              color: 'hsl(var(--primary))',
              fontWeight: 500,
            }}
          >
            Ver guía completa →
          </button>
        </div>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Guía 1:1"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'hsl(var(--card))',
              borderRadius: '0.75rem',
              padding: '1.5rem 2rem',
              maxWidth: '640px',
              maxHeight: '85vh',
              overflowY: 'auto',
              position: 'relative',
              border: '1px solid hsl(var(--border))',
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'hsl(var(--muted-foreground))',
              }}
            >
              <X size={20} />
            </button>
            <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Qué es y qué no es un 1:1</h2>
            <h3 style={{ marginTop: '1.25rem' }}>Sí es…</h3>
            <ul style={{ paddingLeft: '1.25rem', lineHeight: 1.7 }}>
              <li>Un espacio para tu desarrollo personal y profesional, no para entregables operativos.</li>
              <li>Conversación sobre cómo te sentís, qué te bloquea, qué necesitás.</li>
              <li>Tiempo para feedback bidireccional (vos podés dar feedback a tu líder también).</li>
              <li>Momento para acuerdos sobre TU carrera, bienestar y crecimiento.</li>
            </ul>
            <h3 style={{ marginTop: '1.25rem' }}>No es…</h3>
            <ul style={{ paddingLeft: '1.25rem', lineHeight: 1.7 }}>
              <li>Status update operativo (eso va en tu reunión de equipo o standup).</li>
              <li>Lista de pendientes que tu líder te asigna como tareas.</li>
              <li>Revisión de KPIs (eso va en tu evaluación de desempeño).</li>
              <li>Sesión correctiva o de feedback negativo unidireccional.</li>
            </ul>
            <h3 style={{ marginTop: '1.25rem' }}>Buenas preguntas para abrir tu agenda</h3>
            <ul style={{ paddingLeft: '1.25rem', lineHeight: 1.7 }}>
              <li>¿Cómo me siento con mi carga actual?</li>
              <li>¿Qué me energiza esta semana? ¿Qué me desgasta?</li>
              <li>¿Qué bloqueos necesito que mi líder ayude a remover?</li>
              <li>¿Qué feedback necesito o quiero dar?</li>
              <li>¿Cómo veo mi crecimiento en los próximos 3 a 6 meses?</li>
            </ul>
            <h3 style={{ marginTop: '1.25rem' }}>Tips para que sea valiosa</h3>
            <ul style={{ paddingLeft: '1.25rem', lineHeight: 1.7 }}>
              <li>Llegá con 2-3 temas que querés abordar.</li>
              <li>Si vas a hablar de algo difícil, pedí espacio: &ldquo;necesito tu opinión sobre…&rdquo;.</li>
              <li>Cerrá con acuerdos claros: qué, quién, cuándo.</li>
            </ul>
          </div>
        </div>
      )}
    </>
  )
}

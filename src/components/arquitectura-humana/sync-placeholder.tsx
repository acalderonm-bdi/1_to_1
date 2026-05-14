import { RefreshCcw, ExternalLink } from 'lucide-react'

export function SyncPlaceholder() {
  return (
    <div
      className="ui-card"
      style={{
        background: 'hsl(var(--warning) / 0.12)',
        borderLeft: '3px solid hsl(var(--warning))',
        padding: '24px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <RefreshCcw size={20} style={{ color: 'hsl(var(--warning))' }} />
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Sincronización organizacional</h3>
      </div>
      <p style={{ margin: '0 0 12px', color: 'var(--text-c)', fontSize: 14 }}>
        <strong>En desarrollo</strong> — esperando spec de Conexiones Humanas.
      </p>
      <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 13.5, lineHeight: 1.6 }}>
        Cuando esté disponible, podrás subir un CSV o conectar via API para que los cambios de líder,
        departamento y status se reflejen automáticamente. Mientras tanto, los cambios manuales se
        hacen desde la vista de <strong>Usuarios</strong>.
      </p>
      <a
        href="/docs/pack-4-org-sync"
        target="_blank"
        rel="noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: 'hsl(var(--primary))',
          fontSize: 13,
          fontWeight: 500,
          textDecoration: 'none',
        }}
      >
        <ExternalLink size={13} /> Ver spec del contrato
      </a>
    </div>
  )
}

import { Download, type LucideIcon } from 'lucide-react'

interface ExportCardProps {
  title: string
  description: string
  href: string
  icon?: LucideIcon
}

/**
 * Tarjeta de export ad-hoc.
 *
 * Renderea como server component: el botón es un `<a download>` que
 * apunta al endpoint `/api/exports/[type]`. No requiere JS para
 * triggerar la descarga.
 */
export function ExportCard({
  title,
  description,
  href,
  icon: Icon = Download,
}: ExportCardProps) {
  return (
    <div className="ui-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="ui-card__head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon size={16} style={{ color: 'var(--text-c)' }} />
          <h3 className="ui-card__title">{title}</h3>
        </div>
      </div>
      <div
        className="ui-card__body"
        style={{ display: 'flex', flexDirection: 'column', flex: 1 }}
      >
        <p
          className="ui-card__desc"
          style={{ flex: 1, marginBottom: 14, fontSize: 13 }}
        >
          {description}
        </p>
        <a
          href={href}
          download
          className="ui-btn ui-btn--accent ui-btn--sm"
          style={{ alignSelf: 'flex-start', textDecoration: 'none' }}
        >
          <Download size={13} /> Descargar CSV
        </a>
      </div>
    </div>
  )
}

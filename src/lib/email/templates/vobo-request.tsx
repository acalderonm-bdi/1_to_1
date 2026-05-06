interface VoboRequestProps {
  recipientName: string
  partnerName: string
  meetingDate: string
  appUrl: string
  oneOnOneId: string
}

export function VoboRequestEmail({
  recipientName,
  partnerName,
  meetingDate,
  appUrl,
  oneOnOneId,
}: VoboRequestProps) {
  const voboUrl = `${appUrl}/colaborador/1to1/${oneOnOneId}`

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 600, margin: '0 auto', padding: 24 }}>
      <h1 style={{ color: '#1e293b' }}>¿Se realizó tu 1:1?</h1>
      <p>Hola {recipientName},</p>
      <p>
        Por favor confirma si tu 1:1 del <strong>{meetingDate}</strong> con{' '}
        <strong>{partnerName}</strong> se llevó a cabo.
      </p>
      <a
        href={voboUrl}
        style={{
          display: 'inline-block',
          padding: '12px 24px',
          backgroundColor: '#1e293b',
          color: '#fff',
          textDecoration: 'none',
          borderRadius: 6,
        }}
      >
        Dar VoBo
      </a>
      <hr />
      <small style={{ color: '#64748b' }}>Sistema de 1:1s</small>
    </div>
  )
}

interface MeetingReminderProps {
  recipientName: string
  partnerName: string
  meetingDate: string
  meetingTime: string
  modality: 'virtual' | 'presencial'
  meetLink?: string
  location?: string
}

export function MeetingReminderEmail({
  recipientName,
  partnerName,
  meetingDate,
  meetingTime,
  modality,
  meetLink,
  location,
}: MeetingReminderProps) {
  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 600, margin: '0 auto', padding: 24 }}>
      <h1 style={{ color: '#1e293b' }}>Recordatorio: 1:1 en 1 hora</h1>
      <p>Hola {recipientName},</p>
      <p>
        Tu 1:1 con <strong>{partnerName}</strong> es hoy a las{' '}
        <strong>{meetingTime}</strong> ({meetingDate}).
      </p>
      {modality === 'virtual' && meetLink && (
        <p>
          <a href={meetLink} style={{ color: '#3b82f6' }}>
            Unirse a Google Meet
          </a>
        </p>
      )}
      {modality === 'presencial' && location && (
        <p>Lugar: {location}</p>
      )}
      <hr />
      <small style={{ color: '#64748b' }}>Sistema de 1:1s</small>
    </div>
  )
}

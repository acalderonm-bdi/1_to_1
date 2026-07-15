/**
 * Formateo de fecha/hora de reuniones pinneado a la zona horaria de la
 * organización. Antes se usaba `date.toTimeString()` / `toLocaleDateString`
 * sin `timeZone`, que renderizan en la zona del runtime — en el server (UTC)
 * eso mostraba la hora en UTC y no la local (F4: 13:12 se veía 19:12). El
 * instante se guarda bien en UTC; aquí lo convertimos siempre a la zona de la
 * org para mostrarlo.
 */
export const APP_TZ = 'America/Mexico_City'

/** "HH:mm" (24h) en la zona de la org. Reemplaza `date.toTimeString().slice(0,5)`. */
export function meetingTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', {
    timeZone: APP_TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

/** Fecha en la zona de la org, con las opciones que pida cada vista. */
export function meetingDate(iso: string, opts: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleDateString('es-MX', { timeZone: APP_TZ, ...opts })
}

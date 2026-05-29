-- Observabilidad de entrega de notificaciones para RH.
-- El dispatcher (check-thresholds) ya computa el motivo de fallo pero lo
-- descartaba (`void failedReason`) porque la columna no existía. La añadimos
-- para persistir por qué un dispatch quedó en 'failed' (sin Slack vinculado,
-- email no configurado, rebote, etc.). delivered_at queda para medir latencia.
alter table public.notification_dispatches
  add column if not exists failed_reason text;
alter table public.notification_dispatches
  add column if not exists delivered_at timestamptz;

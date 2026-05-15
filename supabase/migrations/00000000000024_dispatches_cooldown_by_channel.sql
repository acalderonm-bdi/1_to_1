-- Fix P0 (Ola 1.C review): el unique index de cooldown era (rule_id, recipient_id, day)
-- pero el dispatcher inserta una fila POR CANAL para la misma regla×recipient en el
-- mismo día (in_app + email + slack). El segundo y tercero violaban el unique,
-- silenciosamente ignorados como "expected cooldown", pero el delivery (email/Slack)
-- ya se había ejecutado → entregamos sin auditar y arrancamos el cooldown a la deriva.
--
-- Fix: incluir `channel` en el unique. Cooldown semantics: máximo 1 dispatch por
-- (regla, recipient, CANAL, día UTC). Esto permite multi-canal sin colisión.

drop index if exists public.idx_dispatches_cooldown;

create unique index idx_dispatches_cooldown
  on public.notification_dispatches(
    rule_id,
    recipient_id,
    channel,
    (date_trunc('day', (created_at at time zone 'UTC')))
  )
  where rule_id is not null;

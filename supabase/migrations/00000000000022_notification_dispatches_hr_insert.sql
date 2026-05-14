-- HR/Admin pueden insertar dispatches (para testFireRule + runReportNow manual).
-- El cron usa admin client que bypassa RLS, así que esta policy solo afecta
-- la mutation via user authenticated.
create policy "notification_dispatches_hr_insert"
  on public.notification_dispatches
  for insert
  to authenticated
  with check ((select role from public.users where id = auth.uid()) = 'hr');

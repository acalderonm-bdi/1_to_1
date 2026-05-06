-- =============================================================================
-- HABILITAR ROW LEVEL SECURITY
-- =============================================================================
alter table public.departments enable row level security;
alter table public.users enable row level security;
alter table public.leadership_relations enable row level security;
alter table public.cadence_configs enable row level security;
alter table public.one_on_ones enable row level security;
alter table public.agenda_items enable row level security;
alter table public.minutes enable row level security;
alter table public.agreements enable row level security;
alter table public.agreement_followups enable row level security;
alter table public.vobos enable row level security;
alter table public.ai_insights enable row level security;
alter table public.ai_reports enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- =============================================================================
-- DEPARTMENTS
-- =============================================================================
create policy "departments_select_authenticated" on public.departments
  for select using (auth.uid() is not null);
create policy "departments_all_hr" on public.departments
  for all using (public.is_hr());

-- =============================================================================
-- USERS
-- =============================================================================
create policy "users_select_authenticated" on public.users
  for select using (auth.uid() is not null);
create policy "users_update_self" on public.users
  for update using (auth.uid() = id);
create policy "users_all_hr" on public.users
  for all using (public.is_hr());

-- =============================================================================
-- LEADERSHIP_RELATIONS
-- =============================================================================
create policy "relations_select_involved_or_hr" on public.leadership_relations
  for select using (
    auth.uid() = leader_id or auth.uid() = collaborator_id or public.is_hr()
  );
create policy "relations_all_hr" on public.leadership_relations
  for all using (public.is_hr());

-- =============================================================================
-- CADENCE_CONFIGS
-- =============================================================================
create policy "cadence_select_authenticated" on public.cadence_configs
  for select using (auth.uid() is not null);
create policy "cadence_all_hr" on public.cadence_configs
  for all using (public.is_hr());

-- =============================================================================
-- ONE_ON_ONES
-- =============================================================================
create policy "oneonones_select_participants_or_hr" on public.one_on_ones
  for select using (
    auth.uid() = leader_id or auth.uid() = collaborator_id or public.is_hr()
  );
create policy "oneonones_insert_participants" on public.one_on_ones
  for insert with check (
    auth.uid() = leader_id or auth.uid() = collaborator_id
  );
create policy "oneonones_update_participants_or_hr" on public.one_on_ones
  for update using (
    auth.uid() = leader_id or auth.uid() = collaborator_id or public.is_hr()
  );
create policy "oneonones_delete_hr" on public.one_on_ones
  for delete using (public.is_hr());

-- =============================================================================
-- AGENDA_ITEMS (privado a participantes, RH no tiene acceso)
-- =============================================================================
create policy "agenda_select_participants" on public.agenda_items
  for select using (public.is_participant(one_on_one_id));
create policy "agenda_insert_participants" on public.agenda_items
  for insert with check (
    public.is_participant(one_on_one_id) and author_id = auth.uid()
  );
create policy "agenda_update_author" on public.agenda_items
  for update using (author_id = auth.uid());
create policy "agenda_delete_author" on public.agenda_items
  for delete using (author_id = auth.uid());

-- =============================================================================
-- MINUTES (privado a participantes, RH no tiene acceso)
-- =============================================================================
create policy "minutes_select_participants" on public.minutes
  for select using (public.is_participant(one_on_one_id));
create policy "minutes_insert_participants" on public.minutes
  for insert with check (
    public.is_participant(one_on_one_id) and author_id = auth.uid()
  );
create policy "minutes_update_author" on public.minutes
  for update using (author_id = auth.uid());

-- =============================================================================
-- AGREEMENTS (acuerdos estructurados: visibles para RH)
-- =============================================================================
create policy "agreements_select_participants_or_hr" on public.agreements
  for select using (
    public.is_participant(one_on_one_id) or public.is_hr()
  );
create policy "agreements_insert_participants" on public.agreements
  for insert with check (public.is_participant(one_on_one_id));
create policy "agreements_update_participants_or_hr" on public.agreements
  for update using (
    public.is_participant(one_on_one_id) or public.is_hr()
  );
create policy "agreements_delete_participants" on public.agreements
  for delete using (public.is_participant(one_on_one_id));

-- =============================================================================
-- AGREEMENT_FOLLOWUPS
-- =============================================================================
create policy "followups_select_involved_or_hr" on public.agreement_followups
  for select using (
    exists (
      select 1 from public.agreements a
      where a.id = agreement_id and public.is_participant(a.one_on_one_id)
    ) or public.is_hr()
  );
create policy "followups_insert_involved" on public.agreement_followups
  for insert with check (
    exists (
      select 1 from public.agreements a
      where a.id = agreement_id and public.is_participant(a.one_on_one_id)
    ) and reported_by_id = auth.uid()
  );

-- =============================================================================
-- VOBOS
-- =============================================================================
create policy "vobos_select_participants_or_hr" on public.vobos
  for select using (
    public.is_participant(one_on_one_id) or public.is_hr()
  );
create policy "vobos_insert_self" on public.vobos
  for insert with check (
    user_id = auth.uid() and public.is_participant(one_on_one_id)
  );
create policy "vobos_update_self" on public.vobos
  for update using (user_id = auth.uid());

-- =============================================================================
-- AI_INSIGHTS (solo el líder ve sus sugerencias)
-- =============================================================================
create policy "insights_select_leader" on public.ai_insights
  for select using (leader_id = auth.uid());
create policy "insights_update_leader" on public.ai_insights
  for update using (leader_id = auth.uid());

-- =============================================================================
-- AI_REPORTS (solo RH)
-- =============================================================================
create policy "reports_select_hr" on public.ai_reports
  for select using (public.is_hr());
create policy "reports_update_hr" on public.ai_reports
  for update using (public.is_hr());

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================
create policy "notifications_select_self" on public.notifications
  for select using (user_id = auth.uid());
create policy "notifications_update_self" on public.notifications
  for update using (user_id = auth.uid());

-- =============================================================================
-- AUDIT_LOGS (solo RH puede leer)
-- =============================================================================
create policy "audit_select_hr" on public.audit_logs
  for select using (public.is_hr());

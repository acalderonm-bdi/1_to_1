-- F2 — Justificación: columnas para nota libre + auditoría (quién marcó la no-realización y cuándo).

alter table public.one_on_ones
  add column non_realization_note text,
  add column non_realization_marked_by uuid references public.users(id),
  add column non_realization_marked_at timestamptz,
  add constraint non_realization_note_length check (
    non_realization_note is null or length(non_realization_note) <= 500
  );

create index idx_oneonones_non_realization
  on public.one_on_ones(non_realization_marked_by)
  where non_realization_marked_by is not null;

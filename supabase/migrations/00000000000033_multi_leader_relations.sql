-- Multi-líder: un colaborador puede tener VARIAS relaciones de liderazgo
-- activas a la vez (decisión Ariel/RH jul-2026: la base de líderes trae celdas
-- multi-jefe "A/B/C" — coordinaciones compartidas — y cada jefe debe poder
-- llevar su propio 1:1 con la persona).
--
-- El índice único por colaborador venía del schema inicial (modelo 1-líder).
-- Lo que el código realmente asume es unicidad por PAR (líder, colaborador)
-- activo — p.ej. analyze-patterns hace .single() sobre ese par — así que la
-- unicidad se mueve ahí. Se conserva un índice (ya no único) por colaborador
-- porque las consultas de flags/cadencia filtran por collaborator_id.
drop index if exists public.idx_relations_active_collaborator;

create index if not exists idx_relations_active_collaborator
  on public.leadership_relations(collaborator_id)
  where ended_at is null;

create unique index if not exists idx_relations_active_pair
  on public.leadership_relations(leader_id, collaborator_id)
  where ended_at is null;

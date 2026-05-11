-- Índices compuestos para perf en perfil de colaborador (filtrar 1:1s por par
-- líder/colab ordenado por fecha) y lista de acuerdos por persona+status.
create index if not exists idx_oneonones_leader_collab_scheduled
  on public.one_on_ones (leader_id, collaborator_id, scheduled_at desc);

create index if not exists idx_agreements_responsible_status
  on public.agreements (responsible_id, status);

-- Limpieza: ai_reports tiene duplicados del seed. Dejamos solo el más reciente
-- por scope+title para que el dashboard no muestre el mismo reporte 3 veces.
delete from public.ai_reports
where id in (
  select id from (
    select id,
           row_number() over (partition by scope_type, scope_id, title order by created_at desc) as rn
    from public.ai_reports
  ) d
  where rn > 1
);

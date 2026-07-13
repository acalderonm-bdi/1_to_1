-- Columnas de perfil organizacional para el CSV de RH (BASE LIDERES, jul-2026).
--
-- La base nueva trae, además del área (ya mapeada a departments), el puesto,
-- el nivel de puesto (O/C/G/LT/S/D/L/CA/SU), la subárea y el proyecto de cada
-- persona. El organigrama con visibilidad acotada (colaborador ve hacia arriba
-- + pares dentro de su área/subárea; vista completa solo Direcciones y AH&TT)
-- necesita nivel y subárea del usuario que mira, así que se persisten en users.
--
-- Texto plano (no FK): subáreas/puestos cambian con cada corte de RH y no
-- tienen ciclo de vida propio en el sistema; la fuente de verdad es el CSV.
alter table public.users add column if not exists puesto text;
alter table public.users add column if not exists nivel_puesto text;
alter table public.users add column if not exists sub_area text;
alter table public.users add column if not exists proyecto text;

comment on column public.users.puesto is 'Puesto del CSV de RH (BASE LIDERES). Fuente: org-sync.';
comment on column public.users.nivel_puesto is 'Nivel de puesto del CSV de RH: O/C/G/LT/S/D/L/CA/SU. Fuente: org-sync.';
comment on column public.users.sub_area is 'Subárea del CSV de RH (null si N/A). Fuente: org-sync.';
comment on column public.users.proyecto is 'Proyecto asignado del CSV de RH (null si N/A). Fuente: org-sync.';

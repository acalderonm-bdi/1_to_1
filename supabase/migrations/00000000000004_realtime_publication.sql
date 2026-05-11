-- Agregar tablas a la publication de Realtime para sincronización en vivo
-- entre los participantes de la 1:1 (notas, acuerdos, VoBo).
alter publication supabase_realtime add table public.minutes;
alter publication supabase_realtime add table public.agreements;
alter publication supabase_realtime add table public.vobos;
alter publication supabase_realtime add table public.agenda_items;

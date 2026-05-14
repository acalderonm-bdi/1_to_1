-- Fix C.4: la action `dismissTransferBanner` retornaba success pero RLS
-- bloqueaba silenciosamente el UPDATE porque no había policy de UPDATE para
-- el líder. Las policies existentes solo permitían SELECT a involucrados y
-- ALL a HR.
--
-- Esta policy permite a un líder actualizar SU propio relation
-- (`leader_id = auth.uid()`). La action server-side ya valida el payload con
-- Zod, así que la superficie de ataque es controlada: solo se escribe
-- `transfer_banner_dismissed_at`.

create policy "relations_update_self_leader" on public.leadership_relations
  for update
  using (auth.uid() = leader_id)
  with check (auth.uid() = leader_id);

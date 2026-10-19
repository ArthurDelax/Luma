-- =====================================================================
-- Luma — ajustes de segurança apontados pelo Supabase (advisors)
--
-- * search_path fixo nas duas funções que ainda não tinham;
-- * visitantes sem login (anon) não executam mais as funções de checagem
--   de permissão. invitation_info continua liberada: a página do convite
--   precisa dela antes do login.
-- Idempotente: pode rodar mais de uma vez.
-- =====================================================================

alter function public.luma_org_from_path(text) set search_path = public;
alter function public.luma_touch_record() set search_path = public;

revoke execute on function public.am_i_platform_admin() from public, anon;
revoke execute on function public.is_platform_admin() from public, anon;
revoke execute on function public.luma_can_read(uuid) from public, anon;
revoke execute on function public.luma_can_write(uuid) from public, anon;

grant execute on function public.am_i_platform_admin() to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.luma_can_read(uuid) to authenticated;
grant execute on function public.luma_can_write(uuid) to authenticated;

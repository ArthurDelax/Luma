-- =====================================================================
-- Testes de segurança do cardápio (0007_cardapio.sql) — 29 verificações.
--
-- Como usar: Supabase → SQL Editor → cole "begin;", depois o arquivo
-- 0007_cardapio.sql inteiro e depois este arquivo → Run.
-- Termina sempre com um ERRO de propósito, cuja mensagem lista os
-- resultados: o erro desfaz tudo (migração e dados de teste), então pode
-- rodar no banco de produção sem deixar rastro.
-- =====================================================================

create function pg_temp.try_as(p_claims jsonb, p_sql text) returns text language plpgsql as $f$
declare v text;
begin
  begin
    perform set_config('request.jwt.claims', coalesce(p_claims::text, ''), true);
    if p_claims is null then execute 'set local role anon'; else execute 'set local role authenticated'; end if;
    execute p_sql into v;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    return coalesce(v, 'null');
  exception when others then
    return 'ERR: ' || sqlerrm;
  end;
end $f$;

do $$
declare
  r text := '';
  orgA uuid := gen_random_uuid(); orgB uuid := gen_random_uuid();
  uA uuid := gen_random_uuid(); uEd uuid := gen_random_uuid(); uCons uuid := gen_random_uuid(); uB uuid := gen_random_uuid(); uAdm uuid := gen_random_uuid();
  cA jsonb; cEd jsonb; cCons jsonb; cB jsonb; cAdm1 jsonb; cAdm2 jsonb;
  t text;
begin
  insert into auth.users (id, email) values (uA, 'a@cardapio.test'), (uEd, 'ed@cardapio.test'), (uCons, 'c@cardapio.test'), (uB, 'b@cardapio.test'), (uAdm, 'adm@cardapio.test');
  insert into public.platform_admins (user_id) values (uAdm);
  insert into public.organizations (id, name, responsible_name, responsible_email, licenses, monthly_price_cents) values (orgA, 'Loja Teste A', 'Ana', 'a@cardapio.test', 3, 0), (orgB, 'Loja Teste B', 'Bia', 'b@cardapio.test', 1, 0);
  insert into public.memberships (org_id, user_id, role) values (orgA, uA, 'administrador'), (orgA, uEd, 'financeiro'), (orgA, uCons, 'consulta'), (orgB, uB, 'administrador');
  cA := jsonb_build_object('sub', uA, 'email', 'a@cardapio.test', 'aal', 'aal1', 'role', 'authenticated');
  cEd := jsonb_build_object('sub', uEd, 'email', 'ed@cardapio.test', 'aal', 'aal1', 'role', 'authenticated');
  cCons := jsonb_build_object('sub', uCons, 'email', 'c@cardapio.test', 'aal', 'aal1', 'role', 'authenticated');
  cB := jsonb_build_object('sub', uB, 'email', 'b@cardapio.test', 'aal', 'aal1', 'role', 'authenticated');
  cAdm1 := jsonb_build_object('sub', uAdm, 'email', 'adm@cardapio.test', 'aal', 'aal1', 'role', 'authenticated');
  cAdm2 := jsonb_build_object('sub', uAdm, 'email', 'adm@cardapio.test', 'aal', 'aal2', 'role', 'authenticated');

  t := pg_temp.try_as(cEd, format($q$insert into public.menus (org_id, slug, data) values (%L, 'loja-teste-a-zz', '{"store":{"name":"A"}}') returning 'ok'$q$, orgA));
  r := r || E'\n1 editor cria cardápio da loja A (ok): ' || t;
  t := pg_temp.try_as(cB, format($q$insert into public.menus (org_id, slug) values (%L, 'invasao-zz') on conflict (org_id) do update set slug = 'invasao-zz' returning 'ok'$q$, orgA));
  r := r || E'\n2 loja B NÃO grava no cardápio de A (ERR): ' || t;
  t := pg_temp.try_as(cB, format($q$select count(*)::text from public.menus where org_id = %L$q$, orgA));
  r := r || E'\n3 loja B NÃO lê cardápio de A (0): ' || t;
  t := pg_temp.try_as(cCons, format($q$select count(*)::text from public.menus where org_id = %L$q$, orgA));
  r := r || E'\n4a consulta lê o cardápio (1): ' || t;
  t := pg_temp.try_as(cCons, format($q$with u as (update public.menus set published = true where org_id = %L returning 1) select count(*)::text from u$q$, orgA));
  r := r || E'\n4b consulta NÃO publica (0): ' || t;
  t := pg_temp.try_as(null, $q$select coalesce(public.public_menu('loja-teste-a-zz')::text, 'null')$q$);
  r := r || E'\n5 visitante NÃO vê rascunho (null): ' || t;
  t := pg_temp.try_as(null, $q$select count(*)::text from public.menus$q$);
  r := r || E'\n6 visitante NÃO lê a tabela direto (ERR): ' || t;
  t := pg_temp.try_as(cA, format($q$with u as (update public.menus set published = true where org_id = %L returning 1) select count(*)::text from u$q$, orgA));
  r := r || E'\n7a administrador da loja publica (1): ' || t;
  t := pg_temp.try_as(null, $q$select (public.public_menu('LOJA-TESTE-A-ZZ') -> 'data' -> 'store' ->> 'name')$q$);
  r := r || E'\n7b visitante vê o publicado (A): ' || t;
  r := r || E'\n7c registra quem alterou (true): ' || ((select updated_by from public.menus where org_id = orgA) = uA)::text;
  update public.organizations set status = 'suspensa' where id = orgA;
  t := pg_temp.try_as(null, $q$select coalesce(public.public_menu('loja-teste-a-zz')::text, 'null')$q$);
  r := r || E'\n8a loja suspensa sai do ar (null): ' || t;
  t := pg_temp.try_as(cA, format($q$with u as (update public.menus set data = '{}' where org_id = %L returning 1) select count(*)::text from u$q$, orgA));
  r := r || E'\n8b loja suspensa NÃO edita (0): ' || t;
  update public.organizations set status = 'inadimplente' where id = orgA;
  t := pg_temp.try_as(null, $q$select coalesce((public.public_menu('loja-teste-a-zz') ->> 'slug'), 'null')$q$);
  r := r || E'\n8c inadimplente continua no ar (loja-teste-a-zz): ' || t;
  update public.organizations set status = 'ativa' where id = orgA;
  t := pg_temp.try_as(cAdm1, format($q$insert into public.menus (org_id, slug) values (%L, 'loja-teste-b-zz') returning 'ok'$q$, orgB));
  r := r || E'\n9a admin SEM 2 etapas NÃO cria (ERR): ' || t;
  t := pg_temp.try_as(cAdm2, format($q$insert into public.menus (org_id, slug) values (%L, 'loja-teste-b-zz') returning 'ok'$q$, orgB));
  r := r || E'\n9b admin com 2 etapas cria o cardápio da loja B (ok): ' || t;
  t := pg_temp.try_as(cAdm2, format($q$with u as (update public.menus set data = '{"store":{"name":"montado"}}' where org_id = %L returning 1) select count(*)::text from u$q$, orgB));
  r := r || E'\n9c admin edita o cardápio da loja B (1): ' || t;
  t := pg_temp.try_as(cB, format($q$with u as (update public.menus set slug = 'loja-teste-a-zz' where org_id = %L returning 1) select count(*)::text from u$q$, orgB));
  r := r || E'\n10a endereço repetido recusado (ERR): ' || t;
  t := pg_temp.try_as(cB, format($q$with u as (update public.menus set slug = 'Com Espaco' where org_id = %L returning 1) select count(*)::text from u$q$, orgB));
  r := r || E'\n10b endereço inválido recusado (ERR): ' || t;
  t := pg_temp.try_as(cB, format($q$select public.menu_slug_available('loja-teste-a-zz', %L)::text$q$, orgB));
  r := r || E'\n10c endereço de outra loja não está livre (false): ' || t;
  t := pg_temp.try_as(cA, format($q$with u as (delete from public.menus where org_id = %L returning 1) select count(*)::text from u$q$, orgA));
  r := r || E'\n11 ninguém exclui o cardápio (0 ou ERR): ' || t;
  t := pg_temp.try_as(cAdm2, format($q$select length(public.admin_set_responsible(%L, 'Bruno', 'bruno@cardapio.test'))::text$q$, orgB));
  r := r || E'\n12a admin troca o responsável (64): ' || t;
  t := pg_temp.try_as(cB, format($q$select public.admin_set_responsible(%L, 'X', 'x@cardapio.test')$q$, orgB));
  r := r || E'\n12b lojista NÃO troca o responsável (ERR): ' || t;
  r := r || E'\n12c só o convite novo vale (1): ' || (select count(*) from public.invitations where org_id = orgB and revoked_at is null)::text;
  t := pg_temp.try_as(cEd, format($q$insert into storage.objects (bucket_id, name) values ('cardapio', %L) returning 'ok'$q$, orgA || '/foto.webp'));
  r := r || E'\n13a editor envia foto para a loja A (ok): ' || t;
  t := pg_temp.try_as(cB, format($q$insert into storage.objects (bucket_id, name) values ('cardapio', %L) returning 'ok'$q$, orgA || '/hack.webp'));
  r := r || E'\n13b loja B NÃO envia para a pasta de A (ERR): ' || t;
  t := pg_temp.try_as(cCons, format($q$insert into storage.objects (bucket_id, name) values ('cardapio', %L) returning 'ok'$q$, orgA || '/c.webp'));
  r := r || E'\n13c consulta NÃO envia (ERR): ' || t;
  t := pg_temp.try_as(cAdm2, format($q$insert into storage.objects (bucket_id, name) values ('cardapio', %L) returning 'ok'$q$, orgB || '/adm.webp'));
  r := r || E'\n13d admin envia foto para a loja B (ok): ' || t;
  r := r || E'\n13e pasta cardapio é pública (true): ' || (select public::text from storage.buckets where id = 'cardapio');
  raise exception 'RESULTADO DOS TESTES (tudo desfeito):%', r;
end $$;

-- VÉRTICE · ranking TOP 100
-- Cole este script inteiro no Supabase: painel do projeto → SQL Editor → New query → Run.
-- Pode ser executado de novo sem perder dados (cria só o que falta e atualiza as funções).
--
-- Segurança:
-- - a tabela não pode ser lida nem gravada diretamente com a chave pública (anon);
-- - o jogo só usa três funções: ranking_top100 (leitura dos 100 primeiros, sem dados internos),
--   ranking_submit (soma pontos validando limites, intervalo e apelido) e ranking_delete
--   (apaga o próprio registro);
-- - cada aparelho tem um identificador e um segredo aleatórios; o servidor guarda só o hash do
--   segredo, então ninguém altera nem apaga o registro de outra pessoa.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.ranking (
  player_id   uuid primary key,
  secret_hash text not null,
  nickname    text not null check (char_length(nickname) between 2 and 16),
  score       bigint not null default 0 check (score >= 0),
  matches     integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.ranking enable row level security;
-- sem políticas de acesso: leitura e escrita diretas ficam bloqueadas para anon e authenticated
revoke all on public.ranking from anon, authenticated;

-- nível a partir da pontuação total (o jogo usa a mesma fórmula)
create or replace function public.vertice_level(p_score bigint)
returns integer language sql immutable as $$
  select floor(sqrt(greatest(p_score, 0) / 500.0))::int + 1
$$;

-- 100 primeiros: posição, apelido, pontos, nível e partidas
create or replace function public.ranking_top100()
returns table(pos bigint, nickname text, score bigint, level integer, matches integer)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by r.score desc, r.updated_at asc), r.nickname, r.score, public.vertice_level(r.score), r.matches
  from public.ranking r
  where r.score > 0
  order by r.score desc, r.updated_at asc
  limit 100
$$;

-- soma os pontos de uma partida
-- limites por partida: história 6.000, treino 4.000, partidas 6.000; no máximo 120 pontos por
-- segundo de jogo; um envio a cada 20 segundos por jogador
create or replace function public.ranking_submit(p_player uuid, p_secret uuid, p_nickname text, p_points integer, p_mode text, p_seconds integer)
returns table(score bigint, level integer, pos bigint)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hash text := encode(extensions.digest(p_secret::text, 'sha256'), 'hex');
  v_cap integer := case p_mode when 'story' then 6000 when 'training' then 4000 when 'match' then 6000 else 0 end;
  v_row public.ranking%rowtype;
  v_nick text := btrim(regexp_replace(coalesce(p_nickname, ''), '\s+', ' ', 'g'));
begin
  if p_player is null or p_secret is null then raise exception 'jogador inválido'; end if;
  if p_points is null or p_points < 1 or p_points > v_cap then raise exception 'pontuação fora do limite'; end if;
  if p_seconds is null or p_seconds < 10 or p_points > p_seconds * 120 then raise exception 'pontuação incompatível com a duração'; end if;
  if char_length(v_nick) < 2 or char_length(v_nick) > 16 or v_nick !~ '^[[:alnum:] ._-]+$' then raise exception 'apelido inválido'; end if;

  select * into v_row from public.ranking r where r.player_id = p_player for update;
  if found then
    if v_row.secret_hash <> v_hash then raise exception 'jogador não autorizado'; end if;
    if v_row.updated_at > now() - interval '20 seconds' then raise exception 'aguarde alguns segundos antes de enviar outra pontuação'; end if;
    update public.ranking r set score = r.score + p_points, matches = r.matches + 1, nickname = v_nick, updated_at = now()
      where r.player_id = p_player;
  else
    insert into public.ranking(player_id, secret_hash, nickname, score, matches) values (p_player, v_hash, v_nick, p_points, 1);
  end if;

  return query
    select r.score, public.vertice_level(r.score), (select count(*) + 1 from public.ranking o where o.score > r.score)
    from public.ranking r where r.player_id = p_player;
end $$;

-- apaga o próprio registro (precisa do segredo do aparelho)
create or replace function public.ranking_delete(p_player uuid, p_secret uuid)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from public.ranking r where r.player_id = p_player and r.secret_hash = encode(extensions.digest(p_secret::text, 'sha256'), 'hex');
  return found;
end $$;

revoke all on function public.ranking_top100() from public;
revoke all on function public.ranking_submit(uuid, uuid, text, integer, text, integer) from public;
revoke all on function public.ranking_delete(uuid, uuid) from public;
grant execute on function public.ranking_top100() to anon, authenticated;
grant execute on function public.ranking_submit(uuid, uuid, text, integer, text, integer) to anon, authenticated;
grant execute on function public.ranking_delete(uuid, uuid) to anon, authenticated;

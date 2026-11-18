-- VÉRTICE · ranking TOP 100
-- Cole este script inteiro no Supabase: painel do projeto → SQL Editor → New query → Run.
-- Pode ser executado de novo sem perder dados (cria só o que falta e atualiza as funções).
--
-- Segurança:
-- - a tabela não pode ser lida nem gravada diretamente com a chave pública (anon);
-- - o jogo só usa três funções: ranking_top100 (leitura dos 100 primeiros, sem dados internos),
--   ranking_submit (soma pontos validando limites, intervalo e apelido) e ranking_delete
--   (apaga o próprio registro);
-- - o servidor mede o tempo entre envios pelo próprio relógio (no máximo 120 pontos por segundo),
--   limita 60.000 pontos por dia por jogador e 60 jogadores novos por hora, e recusa apelidos
--   ofensivos;
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

alter table public.ranking add column if not exists day date not null default current_date;
alter table public.ranking add column if not exists day_score bigint not null default 0;

-- jogadores bloqueados pela moderação (ver "Moderação" no fim do arquivo)
create table if not exists public.ranking_ban (
  player_id  uuid primary key,
  reason     text,
  created_at timestamptz not null default now()
);
alter table public.ranking_ban enable row level security;
revoke all on public.ranking_ban from anon, authenticated;

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
  where r.score > 0 and not exists (select 1 from public.ranking_ban b where b.player_id = r.player_id)
  order by r.score desc, r.updated_at asc
  limit 100
$$;

-- apelido ofensivo? (mesma lista do jogo; acentos e números trocados por letras antes de comparar)
create or replace function public.vertice_bad_nick(p_nick text)
returns boolean language sql immutable as $$
  select exists (
    select 1 from unnest(array['porra','caralho','merda','buceta','boceta','filhodaputa','putaria','fdp','viado','arrombad',
      'cuzao','piroca','xoxota','foder','fuder','fodase','vsf','vtnc','otario','babaca','retardad','nazi','hitler','fuck',
      'shit','bitch','nigg','pussy']) w
    where position(w in regexp_replace(translate(lower(p_nick), 'áàâãäéèêëíìîïóòôõöúùûüç0@1!34$5', 'aaaaaeeeeiiiiooooouuuucooiieass'), '[^a-z]', '', 'g')) > 0
  )
$$;

-- soma os pontos de uma partida
-- limites: por partida (história 6.000, treino 4.000, partidas 6.000); no máximo 120 pontos por
-- segundo, medidos pelo relógio do servidor desde o envio anterior; 60.000 pontos por dia;
-- um envio a cada 20 segundos; 60 jogadores novos por hora no ranking inteiro
create or replace function public.ranking_submit(p_player uuid, p_secret uuid, p_nickname text, p_points integer, p_mode text, p_seconds integer)
returns table(score bigint, level integer, pos bigint)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hash text := encode(extensions.digest(p_secret::text, 'sha256'), 'hex');
  v_cap integer := case p_mode when 'story' then 6000 when 'training' then 4000 when 'match' then 6000 else 0 end;
  v_row public.ranking%rowtype;
  v_nick text := btrim(regexp_replace(coalesce(p_nickname, ''), '\s+', ' ', 'g'));
  v_elapsed double precision;
  v_day bigint;
begin
  if p_player is null or p_secret is null then raise exception 'jogador inválido'; end if;
  if p_points is null or p_points < 1 or p_points > v_cap then raise exception 'pontuação fora do limite'; end if;
  if p_seconds is null or p_seconds < 10 or p_points > p_seconds * 120 then raise exception 'pontuação incompatível com a duração'; end if;
  if char_length(v_nick) < 2 or char_length(v_nick) > 16 or v_nick !~ '^[[:alnum:] ._-]+$' then raise exception 'apelido inválido'; end if;
  if public.vertice_bad_nick(v_nick) then raise exception 'apelido não permitido'; end if;
  if exists (select 1 from public.ranking_ban b where b.player_id = p_player) then raise exception 'jogador bloqueado no ranking'; end if;

  select * into v_row from public.ranking r where r.player_id = p_player for update;
  if found then
    if v_row.secret_hash <> v_hash then raise exception 'jogador não autorizado'; end if;
    v_elapsed := extract(epoch from now() - v_row.updated_at);
    if v_elapsed < 20 then raise exception 'aguarde alguns segundos antes de enviar outra pontuação'; end if;
    if p_points > v_elapsed * 120 then raise exception 'pontuação incompatível com o tempo de jogo'; end if;
    v_day := case when v_row.day = current_date then v_row.day_score else 0 end;
    if v_day + p_points > 60000 then raise exception 'limite diário de pontos atingido'; end if;
    update public.ranking r set score = r.score + p_points, matches = r.matches + 1, nickname = v_nick, updated_at = now(),
      day = current_date, day_score = v_day + p_points
      where r.player_id = p_player;
  else
    if (select count(*) from public.ranking r where r.created_at > now() - interval '1 hour') >= 60 then
      raise exception 'muitos jogadores novos agora; tente mais tarde';
    end if;
    insert into public.ranking(player_id, secret_hash, nickname, score, matches, day, day_score)
      values (p_player, v_hash, v_nick, p_points, 1, current_date, p_points);
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
revoke all on function public.vertice_bad_nick(text) from public, anon, authenticated;
revoke all on function public.ranking_submit(uuid, uuid, text, integer, text, integer) from public;
revoke all on function public.ranking_delete(uuid, uuid) from public;
grant execute on function public.ranking_top100() to anon, authenticated;
grant execute on function public.ranking_submit(uuid, uuid, text, integer, text, integer) to anon, authenticated;
grant execute on function public.ranking_delete(uuid, uuid) to anon, authenticated;

-- Moderação (executar no SQL Editor quando necessário):
--
--   -- ver os registros
--   select player_id, nickname, score, matches, day_score, created_at, updated_at from public.ranking order by score desc;
--
--   -- bloquear e retirar um jogador do ranking (pelo apelido)
--   insert into public.ranking_ban(player_id, reason)
--     select player_id, 'pontuação forjada' from public.ranking where nickname = 'APELIDO'
--     on conflict do nothing;
--   delete from public.ranking where nickname = 'APELIDO';
--
--   -- desbloquear
--   delete from public.ranking_ban where player_id = 'ID';

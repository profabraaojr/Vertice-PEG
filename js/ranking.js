// Pontuação, níveis e ranking TOP 100 (Supabase).
//
// - Cada partida concluída rende pontos de experiência; a soma define o nível, salvo neste aparelho.
// - Com perfil criado, os mesmos pontos vão para o ranking público, que mostra os 100 primeiros
//   (apelido, nível e pontos). O servidor valida limites e intervalo (ver supabase/ranking.sql).
// - A chave abaixo é a chave pública (anon) do projeto: ela só permite chamar as funções do
//   ranking, nunca ler ou alterar a tabela diretamente. A chave secreta (service_role) não fica
//   no jogo.
import { settings, saveSettings } from './settings.js';
import { activeProfile } from './profiles.js';

export const SUPABASE_URL = 'https://wqdojkjwsiasnntaedsl.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_7mCiRxHz3X98K-w3TEFxiA_tjRMNWl-';

export const rankingConfigured = () => !!SUPABASE_ANON_KEY;

// nível a partir dos pontos (mesma fórmula do servidor): 500 pontos para o nível 2,
// 2.000 para o 3, 4.500 para o 4… cada nível pede um pouco mais que o anterior
export const levelOf = (xp) => Math.floor(Math.sqrt(Math.max(0, xp) / 500)) + 1;
export const xpForLevel = (lv) => 500 * (lv - 1) * (lv - 1);

export function progress(xp = settings.xp || 0) {
  const lv = levelOf(xp);
  const a = xpForLevel(lv), b = xpForLevel(lv + 1);
  return { xp, level: lv, into: xp - a, need: b - a, frac: (xp - a) / (b - a), next: b };
}

// identificador e segredo aleatórios do aparelho (o segredo protege o registro no ranking)
function identity() {
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15);
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  }));
  if (!settings.rankId) { settings.rankId = uuid(); settings.rankSecret = uuid(); saveSettings(); }
  return { id: settings.rankId, secret: settings.rankSecret };
}

// Pontos de uma partida concluída (0 quando não conta).
//  - modo história: pontuação da missão cumprida;
//  - desafios do centro de treinamento: estande × 5, dojô × 1;
//  - partidas (equipe e mata-mata, contra bots ou no multijogador): 50 por eliminação,
//    25 extras na cabeça e 300 pela vitória;
//  - treino livre com bots passivos e partidas abandonadas não contam.
export function pointsFor(r) {
  if (!r) return { points: 0, mode: null };
  if (r.story) {
    const st = r.story;
    if (st.training) {
      const range = /Estande|Pista/.test(r.subtitle || '');
      return { points: Math.min(4000, Math.round((st.score || 0) * (range ? 5 : 1))), mode: 'training' };
    }
    return { points: st.success ? Math.min(6000, Math.round(st.score || 0)) : 0, mode: 'story' };
  }
  if (r.mode === 'ffa' || r.mode === 'team') {
    const p = (r.rows || []).find((c) => c.isPlayer);
    if (!p) return { points: 0, mode: null };
    const pts = (p.kills || 0) * 50 + (p.headshots || 0) * 25 + (r.playerWon ? 300 : 0);
    return { points: Math.min(6000, pts), mode: 'match' };
  }
  return { points: 0, mode: null };
}

async function rpc(name, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    // chave legada (anon, um JWT) vai também no Authorization; a chave nova (sb_publishable_…) só no apikey
    headers: SUPABASE_ANON_KEY.startsWith('sb_')
      ? { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }
      : { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!res.ok) {
    const err = new Error((data && data.message) || `erro ${res.status}`);
    // função ainda não criada no banco (script supabase/ranking.sql não executado)
    if (data && data.code === 'PGRST202') { err.pending = true; err.message = 'ranking em preparação'; }
    throw err;
  }
  return data;
}

// Soma os pontos da partida no aparelho e, com perfil e ranking configurado, envia ao servidor.
// Devolve { points, before, after, sent, pos, error }.
export async function reportMatch(r) {
  const { points, mode } = pointsFor(r);
  const before = progress();
  if (points <= 0) return { points: 0, before, after: before, sent: false };
  settings.xp = (settings.xp || 0) + points;
  saveSettings();
  const after = progress();
  const out = { points, before, after, sent: false };
  const nick = activeProfile();
  if (!rankingConfigured()) { out.reason = 'off'; return out; }
  if (!nick) { out.reason = 'noprofile'; return out; }
  try {
    const id = identity();
    const seconds = Math.max(10, Math.round(r.time || 0));
    const rows = await rpc('ranking_submit', { p_player: id.id, p_secret: id.secret, p_nickname: nick, p_points: points, p_mode: mode, p_seconds: seconds });
    const row = Array.isArray(rows) ? rows[0] : rows;
    out.sent = true;
    if (row) { out.pos = row.pos; out.serverScore = row.score; }
  } catch (e) {
    out.error = e.message;
  }
  return out;
}

export async function fetchTop100() {
  return rpc('ranking_top100', {});
}

export async function deleteMine() {
  if (!settings.rankId) return false;
  const ok = await rpc('ranking_delete', { p_player: settings.rankId, p_secret: settings.rankSecret });
  return ok === true;
}

// Preferências do jogador, persistidas no localStorage quando disponível.

const KEY = 'vertice.settings.v1';

export const QUALITY = {
  baixa: { label: 'Baixa', shadows: false, shadowSize: 512, pixelRatio: 1, lights: false, particles: 0.5 },
  media: { label: 'Média', shadows: true, shadowSize: 1024, pixelRatio: 1, lights: true, particles: 0.8 },
  alta: { label: 'Alta', shadows: true, shadowSize: 2048, pixelRatio: 1.5, lights: true, particles: 1 },
  ultra: { label: 'Ultra', shadows: true, shadowSize: 4096, pixelRatio: 2, lights: true, particles: 1 },
};

const DEFAULTS = {
  quality: 'alta',
  renderScale: 1,
  fov: 80,
  showFps: false,
  master: 0.8,
  sfx: 0.9,
  music: 0.45,
  musicInGame: false,
  sensitivity: 1.0,
  scopeSens: 0.85,
  invertY: false,
  crosshairColor: '#6dff9e',
  crosshairDot: false,
  crosshairDynamic: true,
  radar: true,
  loadout: { primary: 'tempest', secondary: 'vp9', melee: 'katana' },
  match: { map: 'ferrugem', mode: 'team', bots: 7, difficulty: 'soldado', timeLimit: 8, scoreLimit: 25, rounds: 5, botsShoot: true },
  nickname: '',
  profile: '',
  looks: {},
  coop: { map: 'ferrugem', mode: 'team', bots: 6, difficulty: 'soldado', rounds: 5 },
};

function load() {
  let data = {};
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = JSON.parse(raw) || {};
  } catch (e) {
    data = {};
  }
  return {
    ...DEFAULTS,
    ...data,
    loadout: { ...DEFAULTS.loadout, ...(data.loadout || {}) },
    match: { ...DEFAULTS.match, ...(data.match || {}) },
    coop: { ...DEFAULTS.coop, ...(data.coop || {}) },
  };
}

export const settings = load();

export function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch (e) {
    /* armazenamento indisponível: preferências valem só nesta sessão */
  }
}

export function resetSettings() {
  const keep = { loadout: settings.loadout, match: settings.match, coop: settings.coop, nickname: settings.nickname, profile: settings.profile, looks: settings.looks };
  Object.assign(settings, JSON.parse(JSON.stringify(DEFAULTS)), keep);
  saveSettings();
}

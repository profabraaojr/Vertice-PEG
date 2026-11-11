// Perfis dos jogadores: homenagem aos alunos, com aparência personalizável.
// Cada perfil guarda tom de pele, cor dos olhos, estilo e cor de cabelo e a camuflagem da farda.
// O modelo do uniforme (colete, cinto, coturnos, ombreiras da equipe) é sempre o padrão.
import * as THREE from 'three';
import { settings, saveSettings } from './settings.js';
import { mulberry32 } from './utils.js';

export const SCHOOL = 'Escola Estadual Cívico Militar Joaquim Nunes Rocha';
export const CLASSES = '1º, 2º e 3º ano PEG';
export const STUDENTS = [
  'Ana', 'Carlos', 'Damarys', 'Daniel', 'David', 'Enzo', 'Eros', 'Gustavo Correa', 'Gustavo Luiz', 'Gustavo Hideki',
  'Jhon', 'João', 'Kayleb', 'Larissa', 'Luiz', 'Matheus', 'Rafael', 'Renato', 'Tamyris',
];

export const SKINS = [
  { id: 's1', name: 'Muito claro', hex: 0xf6dcc6 },
  { id: 's2', name: 'Claro', hex: 0xe9bf9b },
  { id: 's3', name: 'Médio claro', hex: 0xd3a077 },
  { id: 's4', name: 'Médio', hex: 0xb07d55 },
  { id: 's5', name: 'Moreno', hex: 0x8d5f3d },
  { id: 's6', name: 'Escuro', hex: 0x6a4329 },
  { id: 's7', name: 'Muito escuro', hex: 0x47301f },
];
export const EYES = [
  { id: 'e1', name: 'Castanho-escuro', hex: 0x3a2414 },
  { id: 'e2', name: 'Castanho', hex: 0x6b4423 },
  { id: 'e3', name: 'Mel', hex: 0xa9762c },
  { id: 'e4', name: 'Verde', hex: 0x3f7d4a },
  { id: 'e5', name: 'Azul', hex: 0x3a78b8 },
  { id: 'e6', name: 'Cinza', hex: 0x76828c },
];
export const HAIRS = [
  { id: 'raspado', name: 'Raspado' },
  { id: 'curto', name: 'Curto' },
  { id: 'topete', name: 'Topete' },
  { id: 'cacheado', name: 'Cacheado' },
  { id: 'longo', name: 'Longo liso' },
  { id: 'rabo', name: 'Rabo de cavalo' },
  { id: 'trancas', name: 'Tranças' },
  { id: 'coque', name: 'Coque' },
];
export const HAIR_COLORS = [
  { id: 'h1', name: 'Preto', hex: 0x15120f },
  { id: 'h2', name: 'Castanho-escuro', hex: 0x3a2618 },
  { id: 'h3', name: 'Castanho', hex: 0x6a4526 },
  { id: 'h4', name: 'Loiro', hex: 0xc9a25a },
  { id: 'h5', name: 'Ruivo', hex: 0x9a4a22 },
  { id: 'h6', name: 'Grisalho', hex: 0x8a8a88 },
];
export const CAMOS = [
  { id: 'mata', name: 'Mata', kind: 'blobs', colors: ['#4b5a33', '#2f3a22', '#6b5a3a', '#1e2416'] },
  { id: 'deserto', name: 'Deserto', kind: 'blobs', colors: ['#b9a27a', '#8f7a54', '#d6c49c', '#6e5a3c'] },
  { id: 'urbano', name: 'Urbano', kind: 'blobs', colors: ['#8a8e92', '#55595e', '#c2c6ca', '#2f3236'] },
  { id: 'digital', name: 'Digital', kind: 'pixels', colors: ['#5a6b45', '#3a4a2e', '#7d8a5e', '#232b1c'] },
  { id: 'tigrado', name: 'Tigrado', kind: 'stripes', colors: ['#59633c', '#1e2416', '#7a6a3e', '#2f3a22'] },
  { id: 'noturno', name: 'Noturno', kind: 'blobs', colors: ['#1c2430', '#0e1218', '#2e3a4c', '#3b4656'] },
];

const pickId = (list, id, fallback) => (list.some((o) => o.id === id) ? id : fallback);
const byId = (list, id) => list.find((o) => o.id === id) || list[0];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Aparência inicial de cada perfil: variada, mas sempre a mesma para o mesmo nome.
export function defaultLook(name) {
  const r = mulberry32(hash(name || 'Jogador'));
  const pick = (list) => list[Math.floor(r() * list.length)].id;
  return { skin: pick(SKINS), eyes: pick(EYES.slice(0, 4)), hair: pick(HAIRS), hairColor: pick(HAIR_COLORS.slice(0, 4)), camo: 'mata' };
}

// Valida dados de aparência (inclusive os recebidos pela rede).
export function sanitizeLook(look, name = '') {
  const d = defaultLook(name);
  const l = look && typeof look === 'object' ? look : {};
  return {
    skin: pickId(SKINS, l.skin, d.skin), eyes: pickId(EYES, l.eyes, d.eyes), hair: pickId(HAIRS, l.hair, d.hair),
    hairColor: pickId(HAIR_COLORS, l.hairColor, d.hairColor), camo: pickId(CAMOS, l.camo, d.camo),
  };
}

export function getLook(name) {
  return sanitizeLook((settings.looks || {})[name], name);
}

export function setLook(name, patch) {
  if (!settings.looks) settings.looks = {};
  settings.looks[name] = { ...getLook(name), ...patch };
  saveSettings();
  return getLook(name);
}

export const activeProfile = () => (STUDENTS.includes(settings.profile) ? settings.profile : '');
export const activeLook = () => (activeProfile() ? getLook(activeProfile()) : null);
export const playerName = () => activeProfile() || 'Você';

export function setActiveProfile(name) {
  settings.profile = STUDENTS.includes(name) ? name : '';
  saveSettings();
}

export const lookColors = (look) => ({
  skin: byId(SKINS, look.skin).hex, eyes: byId(EYES, look.eyes).hex, hair: byId(HAIR_COLORS, look.hairColor).hex,
});

// ---------- camuflagens (texturas geradas por código) ----------
const camoCache = new Map();
export function camoCanvas(id, size = 128) {
  const def = byId(CAMOS, id);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const r = mulberry32(hash(def.id) + 7);
  const [base, ...rest] = def.colors;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  if (def.kind === 'pixels') {
    const px = size / 16;
    for (let i = 0; i < 150; i++) {
      ctx.fillStyle = rest[Math.floor(r() * rest.length)];
      const x = Math.floor(r() * 16) * px, y = Math.floor(r() * 16) * px;
      const w = (1 + Math.floor(r() * 3)) * px, h = (1 + Math.floor(r() * 2)) * px;
      ctx.fillRect(x, y, w, h);
      ctx.fillRect(x - size, y, w, h); ctx.fillRect(x, y - size, w, h);
    }
  } else if (def.kind === 'stripes') {
    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = rest[i % rest.length];
      ctx.lineWidth = 3 + r() * 7;
      ctx.lineCap = 'round';
      const y = r() * size, x = r() * size, len = 30 + r() * 60;
      for (const [ox, oy] of [[0, 0], [-size, 0], [size, 0], [0, -size], [0, size]]) {
        ctx.beginPath();
        ctx.moveTo(x + ox, y + oy);
        ctx.bezierCurveTo(x + ox + len * 0.3, y + oy - 8, x + ox + len * 0.6, y + oy + 8, x + ox + len, y + oy - 3);
        ctx.stroke();
      }
    }
  } else {
    for (let i = 0; i < 46; i++) {
      ctx.fillStyle = rest[Math.floor(r() * rest.length)];
      const x = r() * size, y = r() * size, rx = 6 + r() * 16, ry = 4 + r() * 11, rot = r() * 3;
      for (const [ox, oy] of [[0, 0], [-size, 0], [size, 0], [0, -size], [0, size]]) {
        ctx.beginPath();
        ctx.ellipse(x + ox, y + oy, rx, ry, rot, 0, 7);
        ctx.fill();
      }
    }
  }
  return c;
}

export function camoTexture(id) {
  const key = byId(CAMOS, id).id;
  if (camoCache.has(key)) return camoCache.get(key);
  const t = new THREE.CanvasTexture(camoCanvas(key));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1.4, 1.4);
  t.colorSpace = THREE.SRGBColorSpace;
  camoCache.set(key, t);
  return t;
}

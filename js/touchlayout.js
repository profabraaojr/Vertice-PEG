// Modelo dos controles de toque: catálogo de comandos, layouts, perfis e geometria.
// Não tem interface: quem desenha é touch.js (na partida) e controleditor.js (no editor).
//
// Posições são normalizadas (0..1) dentro da ÁREA SEGURA da tela, separadas para paisagem e
// retrato. Tamanhos são frações do lado menor da tela, então o layout se adapta a qualquer
// aparelho. Cada comando executa ações no "sink" de entrada, que na partida é o mesmo objeto
// Input usado por teclado e mouse.
import { settings, saveSettings } from './settings.js';

export const LAYOUT_VERSION = 1;
export const MIN_TOUCH_PX = 44; // área mínima de toque recomendada (Apple e Google)

// ---------------------------------------------------------------- comandos reais do jogo
// kind: stick (joystick), hold (enquanto segura), toggle (liga/desliga), tap (um toque)
export const COMMANDS = {
  move: { label: 'Movimento (joystick)', short: '', kind: 'stick', sens: true },
  up: { label: 'Andar para a frente', short: '▲', kind: 'hold', key: 'KeyW' },
  down: { label: 'Andar para trás', short: '▼', kind: 'hold', key: 'KeyS' },
  left: { label: 'Andar para a esquerda', short: '◀', kind: 'hold', key: 'KeyA' },
  right: { label: 'Andar para a direita', short: '▶', kind: 'hold', key: 'KeyD' },
  fire: { label: 'Atirar / atacar', short: 'FOGO', kind: 'hold', sens: true },
  ads: { label: 'Mirar · luneta · golpe pesado', short: 'MIRA', kind: 'special' },
  jump: { label: 'Pular', short: 'PULAR', kind: 'hold', key: 'Space', press: true },
  crouch: { label: 'Agachar', short: 'AGACHAR', kind: 'toggle', key: 'KeyC' },
  sprint: { label: 'Correr', short: 'CORRER', kind: 'toggle', key: 'ShiftLeft' },
  reload: { label: 'Recarregar', short: 'RECARGA', kind: 'tap', key: 'KeyR' },
  swap: { label: 'Próxima arma', short: 'TROCAR', kind: 'tap', wheel: 1 },
  primary: { label: 'Arma principal', short: 'ARMA 1', kind: 'tap', key: 'Digit1' },
  secondary: { label: 'Pistola', short: 'ARMA 2', kind: 'tap', key: 'Digit2' },
  melee: { label: 'Espada (corpo a corpo)', short: 'ESPADA', kind: 'tap', key: 'Digit3' },
  last: { label: 'Última arma', short: 'ÚLTIMA', kind: 'tap', key: 'KeyQ' },
  inspect: { label: 'Inspecionar a arma', short: 'INSPEC.', kind: 'tap', key: 'KeyF' },
  nv: { label: 'Visão noturna (mapa noturno)', short: 'NV', kind: 'tap', key: 'KeyX', when: 'night' },
  loadout: { label: 'Armas (inventário)', short: 'ARMAS', kind: 'tap', key: 'KeyB' },
  board: { label: 'Placar (segurar)', short: 'PLACAR', kind: 'hold', key: 'Tab' },
  chat: { label: 'Chat (multijogador)', short: 'CHAT', kind: 'tap', action: 'chat', when: 'net' },
  fs: { label: 'Tela cheia', short: '⛶', kind: 'tap', action: 'fullscreen' },
  pause: { label: 'Pausa', short: '❚❚', kind: 'tap', action: 'pause' },
};
export const COMMAND_IDS = Object.keys(COMMANDS);
export const SHAPES = { circle: 'Circular', square: 'Quadrado', rounded: 'Arredondado', hex: 'Hexagonal' };

// ---------------------------------------------------------------- layouts prontos
let uidN = 0;
const uid = () => `b${Date.now().toString(36)}${(uidN++).toString(36)}`;
const el = (cmd, lx, ly, px, py, size, extra = {}) => ({ uid: uid(), cmd, land: { x: lx, y: ly }, port: { x: px, y: py }, size, opacity: 0.85, shape: 'circle', visible: true, sens: 1, ...extra });
const small = { shape: 'rounded', opacity: 0.9 };

// Clássico: joystick à esquerda, ações em leque à direita, atalhos no topo.
function classic() {
  return [
    el('move', 0.17, 0.70, 0.25, 0.80, 0.34),
    el('fire', 0.91, 0.76, 0.80, 0.83, 0.25),
    el('ads', 0.775, 0.85, 0.57, 0.91, 0.165),
    el('jump', 0.92, 0.42, 0.85, 0.665, 0.155),
    el('crouch', 0.655, 0.85, 0.59, 0.765, 0.15),
    el('reload', 0.805, 0.585, 0.845, 0.545, 0.145),
    el('swap', 0.69, 0.62, 0.63, 0.63, 0.145),
    el('fire', 0.065, 0.5, 0.11, 0.56, 0.17, { opacity: 0.7 }),
    el('pause', 0.975, 0.075, 0.93, 0.15, 0.1, small),
    el('fs', 0.905, 0.075, 0.93, 0.21, 0.1, small),
    el('board', 0.835, 0.075, 0.93, 0.27, 0.1, small),
    el('loadout', 0.765, 0.075, 0.93, 0.33, 0.1, small),
    el('nv', 0.695, 0.075, 0.93, 0.39, 0.1, small),
    el('chat', 0.625, 0.075, 0.93, 0.45, 0.1, small),
  ];
}

// Compacto: botões menores e mais juntos, liberando a tela.
function compact() {
  return [
    el('move', 0.15, 0.74, 0.24, 0.83, 0.28),
    el('fire', 0.93, 0.80, 0.84, 0.86, 0.2),
    el('ads', 0.835, 0.88, 0.67, 0.93, 0.135),
    el('jump', 0.935, 0.565, 0.88, 0.72, 0.13),
    el('crouch', 0.745, 0.88, 0.67, 0.81, 0.125),
    el('reload', 0.845, 0.665, 0.72, 0.70, 0.12),
    el('swap', 0.765, 0.71, 0.88, 0.59, 0.12),
    el('pause', 0.975, 0.07, 0.93, 0.15, 0.09, small),
    el('fs', 0.915, 0.07, 0.93, 0.205, 0.09, small),
    el('board', 0.855, 0.07, 0.93, 0.26, 0.09, small),
    el('loadout', 0.795, 0.07, 0.93, 0.315, 0.09, small),
    el('nv', 0.735, 0.07, 0.93, 0.37, 0.09, small),
    el('chat', 0.675, 0.07, 0.93, 0.425, 0.09, small),
  ];
}

// Ergonômico: botões maiores em arco ao redor do polegar, com troca direta de armas.
function ergonomic() {
  return [
    el('move', 0.17, 0.68, 0.25, 0.79, 0.36),
    el('fire', 0.885, 0.72, 0.78, 0.80, 0.28),
    el('ads', 0.73, 0.87, 0.53, 0.89, 0.17),
    el('jump', 0.895, 0.44, 0.86, 0.6, 0.165),
    el('crouch', 0.715, 0.66, 0.56, 0.74, 0.16),
    el('reload', 0.765, 0.47, 0.72, 0.6, 0.155),
    el('primary', 0.62, 0.9, 0.12, 0.64, 0.13, small),
    el('secondary', 0.62, 0.73, 0.25, 0.64, 0.13, small),
    el('melee', 0.62, 0.56, 0.38, 0.64, 0.13, small),
    el('fire', 0.065, 0.5, 0.11, 0.5, 0.17, { opacity: 0.7 }),
    el('pause', 0.975, 0.075, 0.93, 0.15, 0.1, small),
    el('fs', 0.905, 0.075, 0.93, 0.21, 0.1, small),
    el('board', 0.835, 0.075, 0.93, 0.27, 0.1, small),
    el('loadout', 0.765, 0.075, 0.93, 0.33, 0.1, small),
    el('nv', 0.695, 0.075, 0.93, 0.39, 0.1, small),
    el('chat', 0.625, 0.075, 0.93, 0.45, 0.1, small),
  ];
}

// atalhos do topo ficam onde estão: o radar ocupa o canto superior esquerdo
const UTIL = new Set(['pause', 'fs', 'board', 'loadout', 'nv', 'chat']);
const mirror = (els) => els.map((e) => (UTIL.has(e.cmd) ? { ...e, uid: uid() } : { ...e, uid: uid(), land: { x: 1 - e.land.x, y: e.land.y }, port: { x: 1 - e.port.x, y: e.port.y } }));

// Simétrico: disparo e pulo dos dois lados, joystick à esquerda.
function symmetric() {
  const els = classic().filter((e) => !(e.cmd === 'fire' && e.land.x < 0.5));
  els.push(el('fire', 0.08, 0.5, 0.12, 0.6, 0.2, { opacity: 0.8 }));
  els.push(el('jump', 0.31, 0.42, 0.42, 0.66, 0.14, { opacity: 0.8 }));
  return els;
}

export const PRESETS = {
  classic: { name: 'Clássico', build: classic },
  compact: { name: 'Compacto', build: compact },
  ergonomic: { name: 'Ergonômico', build: ergonomic },
};
export const HANDS = { right: 'Destro', left: 'Canhoto', sym: 'Simétrico', custom: 'Personalizado' };

export function makeLayout(preset = 'classic', hand = 'right', extra = {}) {
  let els = (PRESETS[preset] || PRESETS.classic).build();
  if (hand === 'left') els = mirror(els);
  if (hand === 'sym') els = symmetric();
  return { version: LAYOUT_VERSION, preset, hand, scale: 1, spacing: 1, opacity: 1, moveMode: 'dynamic', orient: 'any', elements: els, ...extra };
}

// ---------------------------------------------------------------- validação e migração
const clamp01 = (v, d) => (Number.isFinite(+v) ? Math.min(1, Math.max(0, +v)) : d);
const clampR = (v, a, b, d) => (Number.isFinite(+v) ? Math.min(b, Math.max(a, +v)) : d);

export function sanitizeLayout(l) {
  const base = makeLayout('classic');
  if (!l || typeof l !== 'object' || !Array.isArray(l.elements)) return base;
  const out = {
    version: LAYOUT_VERSION,
    preset: PRESETS[l.preset] ? l.preset : 'custom',
    hand: HANDS[l.hand] ? l.hand : 'custom',
    scale: clampR(l.scale, 0.6, 1.8, 1),
    spacing: clampR(l.spacing, 0.7, 1.4, 1),
    opacity: clampR(l.opacity, 0.2, 1, 1),
    moveMode: ['dynamic', 'fixed', 'dpad'].includes(l.moveMode) ? l.moveMode : 'dynamic',
    orient: ['any', 'landscape', 'portrait'].includes(l.orient) ? l.orient : 'any',
    elements: [],
  };
  for (const e of l.elements.slice(0, 40)) {
    if (!e || !COMMANDS[e.cmd]) continue;
    out.elements.push({
      uid: typeof e.uid === 'string' ? e.uid.slice(0, 24) : uid(),
      cmd: e.cmd,
      land: { x: clamp01(e.land && e.land.x, 0.5), y: clamp01(e.land && e.land.y, 0.5) },
      port: { x: clamp01(e.port && e.port.x, 0.5), y: clamp01(e.port && e.port.y, 0.5) },
      size: clampR(e.size, 0.06, 0.5, 0.15),
      opacity: clampR(e.opacity, 0.15, 1, 0.85),
      shape: SHAPES[e.shape] ? e.shape : 'circle',
      visible: e.visible !== false,
      sens: clampR(e.sens, 0.4, 2.5, 1),
    });
  }
  if (!out.elements.length) return base;
  return out;
}

// ---------------------------------------------------------------- perfis (salvos com as preferências)
function defaultProfiles() {
  return [
    { id: 'p1', name: 'Celular pequeno', layout: makeLayout('compact', 'right', { scale: 1.05 }) },
    { id: 'p2', name: 'Celular grande', layout: makeLayout('classic', 'right', { scale: 0.95 }) },
    { id: 'p3', name: 'Modo canhoto', layout: makeLayout('classic', 'left') },
    { id: 'p4', name: 'Modo destro', layout: makeLayout('classic', 'right') },
    { id: 'p5', name: 'Personalizado', layout: makeLayout('ergonomic', 'right') },
  ];
}

let checked = null;
export function profiles() {
  let tp = settings.touchProfiles;
  if (!tp || !Array.isArray(tp.list) || !tp.list.length) {
    tp = { active: 'p4', list: defaultProfiles() };
    settings.touchProfiles = tp;
    saveSettings();
  }
  // migração: perfis de versões anteriores passam pela validação (uma vez por carga)
  if (tp !== checked) {
    tp.list = tp.list.filter((p) => p && p.id).map((p) => ({ id: String(p.id), name: String(p.name || 'Perfil').slice(0, 30), layout: sanitizeLayout(p.layout) }));
    if (!tp.list.length) tp.list = defaultProfiles();
    checked = tp;
  }
  if (!tp.list.some((p) => p.id === tp.active)) tp.active = tp.list[0].id;
  return tp;
}

export function activeProfile() {
  const tp = profiles();
  return tp.list.find((p) => p.id === tp.active);
}

export const activeLayout = () => activeProfile().layout;

export function saveProfiles() {
  saveSettings();
  if (onChange) onChange();
}

let onChange = null;
export function onLayoutChange(fn) { onChange = fn; }

export function newProfileId() {
  const ids = new Set(profiles().list.map((p) => p.id));
  let i = 1;
  while (ids.has(`p${i}`)) i++;
  return `p${i}`;
}

// exportação e importação (arquivo .json ou texto)
export function exportProfile(p) {
  return JSON.stringify({ app: 'vertice-peg', type: 'touch-controls', version: LAYOUT_VERSION, name: p.name, layout: p.layout }, null, 1);
}

export function importProfile(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error('O arquivo não é uma configuração válida (JSON ilegível).'); }
  if (!data || data.type !== 'touch-controls' || !data.layout) throw new Error('Este arquivo não contém controles do VÉRTICE.');
  return { name: String(data.name || 'Importado').slice(0, 30), layout: sanitizeLayout(data.layout) };
}

// ---------------------------------------------------------------- geometria
// insets = { top, right, bottom, left } em px; devolve retângulos em px para a orientação da tela.
export function computeRects(layout, W, H, insets, ctx = {}) {
  const orient = W >= H ? 'land' : 'port';
  const ins = { top: 0, right: 0, bottom: 0, left: 0, ...insets };
  const sw = Math.max(1, W - ins.left - ins.right);
  const sh = Math.max(1, H - ins.top - ins.bottom);
  const short = Math.min(W, H);
  const els = layout.elements;
  const rects = [];
  // espaçamento: aproxima ou afasta cada botão do canto do seu grupo (esquerda, direita ou topo)
  for (const e of els) {
    const cmd = COMMANDS[e.cmd];
    if (!cmd) continue;
    if (layout.moveMode === 'dpad' && e.cmd === 'move') continue;
    let { x, y } = e[orient];
    const ax = x < 0.5 ? 0 : 1;
    const ay = y < 0.2 ? 0 : 1;
    x = ax + (x - ax) * layout.spacing;
    y = ay + (y - ay) * layout.spacing;
    const size = Math.max(MIN_TOUCH_PX, e.size * short * layout.scale);
    let cx = ins.left + x * sw;
    let cy = ins.top + y * sh;
    // mantém o botão inteiro dentro da área segura
    const r = size / 2;
    cx = Math.min(ins.left + sw - r, Math.max(ins.left + r, cx));
    cy = Math.min(ins.top + sh - r, Math.max(ins.top + r, cy));
    const available = !cmd.when || (cmd.when === 'night' ? ctx.night : cmd.when === 'net' ? ctx.net : true);
    rects.push({ e, cmd, cx, cy, size, orient, available, opacity: e.opacity * layout.opacity });
  }
  // layouts prontos: afasta botões que se tocariam nesta resolução (tablets, telas estreitas).
  // Layouts personalizados ficam exatamente como o jogador posicionou; o editor avisa sobreposições.
  if (layout.preset !== 'custom') separate(rects, ins, sw, sh);
  return rects;
}

function separate(rects, ins, sw, sh) {
  const vis = rects.filter((r) => r.e.visible);
  const clamp = (r) => {
    const h = r.size / 2;
    r.cx = Math.min(ins.left + sw - h, Math.max(ins.left + h, r.cx));
    r.cy = Math.min(ins.top + sh - h, Math.max(ins.top + h, r.cy));
  };
  for (let it = 0; it < 40; it++) {
    let moved = false;
    for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
      const a = vis[i], b = vis[j];
      const minD = (a.size + b.size) / 2 + 4;
      let dx = b.cx - a.cx, dy = b.cy - a.cy;
      let d = Math.hypot(dx, dy);
      if (d >= minD) continue;
      if (d < 0.01) { dx = 1; dy = 0; d = 1; }
      // o joystick pesa mais: os botões menores é que se afastam dele
      const wa = a.cmd.kind === 'stick' ? 0.15 : b.cmd.kind === 'stick' ? 0.85 : 0.5;
      const push = (minD - d) + 0.5;
      a.cx -= (dx / d) * push * wa; a.cy -= (dy / d) * push * wa;
      b.cx += (dx / d) * push * (1 - wa); b.cy += (dy / d) * push * (1 - wa);
      clamp(a); clamp(b);
      moved = true;
    }
    if (!moved) break;
  }
}

// Inverso de computeRects para o arraste no editor: posição em px -> coordenada normalizada.
export function pxToNorm(layout, W, H, insets, cx, cy) {
  const ins = { top: 0, right: 0, bottom: 0, left: 0, ...insets };
  const sw = Math.max(1, W - ins.left - ins.right);
  const sh = Math.max(1, H - ins.top - ins.bottom);
  let x = (cx - ins.left) / sw;
  let y = (cy - ins.top) / sh;
  const ax = x < 0.5 ? 0 : 1;
  const ay = y < 0.2 ? 0 : 1;
  x = ax + (x - ax) / layout.spacing;
  y = ay + (y - ay) / layout.spacing;
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
}

// Pares de botões sobrepostos (o editor destaca para evitar toques acidentais).
export function overlaps(rects) {
  const bad = new Set();
  const vis = rects.filter((r) => r.e.visible);
  for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
    const a = vis[i], b = vis[j];
    const minD = (a.size + b.size) / 2 + 4;
    if (Math.hypot(a.cx - b.cx, a.cy - b.cy) < minD * 0.82) { bad.add(a.e.uid); bad.add(b.e.uid); }
  }
  return bad;
}

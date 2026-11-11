// Mapas do jogo: layout em grade, temas visuais, geometria, colisores, navegação e radar.
import * as THREE from 'three';
import * as TX from './textures.js';
import { mulberry32 } from './utils.js';

export const CELL = 2;
export const N = 36;
export const HALF = (N * CELL) / 2; // 36 m
export const WALL_H = 5;

/*
 * Legenda (cada caractere = 2 x 2 m):
 *  #  parede      w  janela (vão entre 1,0 e 2,3 m)   d  porta (verga a 3 m)
 *  x  obstáculo baixo (1 m, dá para pular)   X  obstáculo alto (2,3 m)
 *  K  bloco grande (contêiner, rocha, plataforma)   b  barris / urnas
 *  T  árvore   o  coluna   v  moita (não bloqueia a passagem)
 *  ,  piso interno coberto   .  piso externo
 *  Z  base Sentinela (B)      A  base Vanguarda (A, gerada pelo espelhamento)
 * Só a metade de cima é desenhada: a de baixo é seu espelho pontual, o que equilibra as bases.
 */
const TOP_URBAN = [
  '####################################',
  '#..........#..........#,,,,,,,,,,,,#',
  '#.ZZZZZZZ..#....xx....#,,,,,,,,,,,,#',
  '#.ZZZZZZZ..d....xx....d,,,x,,,,X,,,#',
  '#..........d..........#,,,,,,,,,,,,#',
  '#...xx.....#..........w,,,,,,,,,,,,#',
  '#...xx.....#....X.....w,,,,,,,,,,,,#',
  '#..........#..........#,,,,,X,,,,,,#',
  '######dd####....b.....####ww##dd####',
  '#,,,,,,,,,#................x.......#',
  '#,,,,,,,,,d.......KKKK.............#',
  '#,,X,,,,,,d.......KKKK......xx.....#',
  '#,,X,,,x,,#.................xx.....#',
  '#,,,,,,x,,#####.......X............#',
  '#,,,,,,,,,w........................#',
  '#,,xx,,,,,w.....x..KKKK.....b......#',
  '#,,xx,,,,,d........................#',
  '####dd#####.........X.......XX.....#',
];

const TOP_JUNGLE = [
  '####################################',
  '#....T.....T......v.....T......T...#',
  '#.ZZZZZZZ....v..........xx....v....#',
  '#.ZZZZZZZ..T.....T...........T.....#',
  '#.......v.......xx....T.....###d####',
  '#..T.........v.............T#,,,,,##',
  '#......xx.........T.........w,,x,,##',
  '#.T..........T.......v......d,,,,,##',
  '#.....v...........XX........#,,,,,##',
  '#..........T................###w####',
  '#...T.........KKK......T...........#',
  '#.......xx....KKK...v.......T...xx.#',
  '####d###..........T................#',
  '#,,,,,,#.....T.........xx.....T....#',
  '#,,x,,,w...v.......T.........v.....#',
  '#,,,,,,d......b........T.....XX....#',
  '#,,,,,,#..T.........v..............#',
  '####d###.........x......T......v...#',
];

const TOP_RUINS = [
  '####################################',
  '#............#.....o....o.....#....#',
  '#.ZZZZZZZ....d................x....#',
  '#.ZZZZZZZ....#.....o....o..........#',
  '#............#...............xx....#',
  '#....xx......d.....o....o..........#',
  '#............#..............####d###',
  '######dd#####.....X.........#,,,,,,#',
  '#...........o...............w,,o,,,#',
  '#..x........o......KKKK.....d,,,,,,#',
  '#...........o......KKKK.....#,,o,,,#',
  '#....o......................########',
  '#...........o....x.................#',
  '#..XX.......#####.......o.....o....#',
  '#...........w...................b..#',
  '#....o......w....x..KKKK..o.....o..#',
  '#...........d......................#',
  '#####dd#####.........X.......XX....#',
];

function mirrorRow(r) {
  return r.split('').reverse().map((ch) => (ch === 'Z' ? 'A' : ch === 'A' ? 'Z' : ch)).join('');
}
const makeLayout = (top) => [...top, ...top.slice().reverse().map(mirrorRow)];

export const MAPS = {
  ferrugem: { id: 'ferrugem', name: 'Distrito Ferrugem', tag: 'Dia', theme: 'city', top: TOP_URBAN, desc: 'Complexo industrial ao sol: depósitos, escritórios e um pátio de contêineres.' },
  noite: { id: 'noite', name: 'Ferrugem à Noite', tag: 'Noturno', theme: 'night', top: TOP_URBAN, desc: 'O mesmo distrito sob a lua. Quase nada se vê sem os óculos de visão noturna (tecla X).' },
  selva: { id: 'selva', name: 'Selva Esmeralda', tag: 'Selva', theme: 'jungle', top: TOP_JUNGLE, desc: 'Clareiras entre árvores altas, moitas que escondem, rochas e cabanas de bambu.' },
  ruinas: { id: 'ruinas', name: 'Ruínas de Aruanã', tag: 'Construção antiga', theme: 'ruins', top: TOP_RUINS, desc: 'Templo de pedra ao entardecer: colunatas, câmaras e muros em ruínas.' },
};
export const MAP_IDS = ['ferrugem', 'noite', 'selva', 'ruinas'];

// layout do mapa carregado no momento (consultado por charAt)
export let LAYOUT = makeLayout(TOP_URBAN);
export const layoutOf = (id) => makeLayout((MAPS[id] || MAPS.ferrugem).top);

const WALKABLE = new Set(['.', ',', 'd', 'A', 'Z', 'v']);

export const cellToWorld = (c) => c * CELL - HALF + CELL / 2;
export const worldToCell = (v) => Math.floor((v + HALF) / CELL);

export function charAt(cx, cy) {
  if (cx < 0 || cy < 0 || cx >= N || cy >= N) return '#';
  return LAYOUT[cy][cx];
}

// ---------- construtor de geometria com UV em escala de mundo ----------
class GeoBuilder {
  constructor() {
    this.pos = [];
    this.norm = [];
    this.uv = [];
    this.idx = [];
  }

  quad(p, n, uvs) {
    const base = this.pos.length / 3;
    // garante sentido anti-horário visto de fora
    const ax = p[1][0] - p[0][0], ay = p[1][1] - p[0][1], az = p[1][2] - p[0][2];
    const bx = p[2][0] - p[0][0], by = p[2][1] - p[0][1], bz = p[2][2] - p[0][2];
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    const flip = cx * n[0] + cy * n[1] + cz * n[2] < 0;
    for (let i = 0; i < 4; i++) {
      this.pos.push(p[i][0], p[i][1], p[i][2]);
      this.norm.push(n[0], n[1], n[2]);
      this.uv.push(uvs[i][0], uvs[i][1]);
    }
    if (flip) this.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    else this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /*
   * opts.uv: 'world' (escala su/sv em metros) ou 'face' (0..1 por face)
   * opts.skip: faces omitidas, ex.: { ny: true }
   */
  box(x0, y0, z0, x1, y1, z1, opts = {}) {
    const su = opts.su || 0.5;
    const sv = opts.sv || 0.5;
    const face = opts.uv === 'face';
    const skip = opts.skip || {};
    const u = (a, b) => (face ? [a, b] : null);
    // +X
    if (!skip.px) this.quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0],
      face ? [u(0, 0), u(1, 0), u(1, 1), u(0, 1)] : [[-z1 * su, y0 * sv], [-z0 * su, y0 * sv], [-z0 * su, y1 * sv], [-z1 * su, y1 * sv]]);
    if (!skip.nx) this.quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0],
      face ? [u(0, 0), u(1, 0), u(1, 1), u(0, 1)] : [[z0 * su, y0 * sv], [z1 * su, y0 * sv], [z1 * su, y1 * sv], [z0 * su, y1 * sv]]);
    if (!skip.pz) this.quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1],
      face ? [u(0, 0), u(1, 0), u(1, 1), u(0, 1)] : [[x0 * su, y0 * sv], [x1 * su, y0 * sv], [x1 * su, y1 * sv], [x0 * su, y1 * sv]]);
    if (!skip.nz) this.quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1],
      face ? [u(0, 0), u(1, 0), u(1, 1), u(0, 1)] : [[-x1 * su, y0 * sv], [-x0 * su, y0 * sv], [-x0 * su, y1 * sv], [-x1 * su, y1 * sv]]);
    const st = opts.st || su;
    if (!skip.py) this.quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0],
      face ? [u(0, 0), u(1, 0), u(1, 1), u(0, 1)] : [[x0 * st, z1 * st], [x1 * st, z1 * st], [x1 * st, z0 * st], [x0 * st, z0 * st]]);
    if (!skip.ny) this.quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0],
      face ? [u(0, 0), u(1, 0), u(1, 1), u(0, 1)] : [[x0 * st, z0 * st], [x1 * st, z0 * st], [x1 * st, z1 * st], [x0 * st, z1 * st]]);
  }

  plane(x0, z0, x1, z1, y, s) {
    this.quad([[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]], [0, 1, 0],
      [[x0 * s, z1 * s], [x1 * s, z1 * s], [x1 * s, z0 * s], [x0 * s, z0 * s]]);
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.norm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }

  get empty() { return this.idx.length === 0; }
}

// Junção gulosa de células iguais em retângulos (menos caixas, menos draw calls).
function greedyRects(pred) {
  const used = Array.from({ length: N }, () => new Array(N).fill(false));
  const rects = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (used[y][x] || !pred(x, y)) continue;
      let w = 1;
      while (x + w < N && !used[y][x + w] && pred(x + w, y)) w++;
      let h = 1;
      outer: while (y + h < N) {
        for (let k = 0; k < w; k++) if (used[y + h][x + k] || !pred(x + k, y + h)) break outer;
        h++;
      }
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) used[yy][xx] = true;
      rects.push({ x, y, w, h });
    }
  }
  return rects;
}

function nearInterior(x, y) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (charAt(x + dx, y + dy) === ',') return true;
  return false;
}

function signTexture(text, sub) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, 512, 160);
  ctx.fillStyle = 'rgba(235,230,215,0.82)';
  ctx.font = 'bold 92px "Chakra Petch", "Arial Narrow", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 256, 100);
  if (sub) {
    ctx.font = 'bold 30px "Chakra Petch", sans-serif';
    ctx.fillStyle = 'rgba(217,165,20,0.9)';
    ctx.fillText(sub, 256, 145);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function floorLetter(letter, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = color;
  ctx.lineWidth = 14;
  ctx.globalAlpha = 0.75;
  ctx.beginPath(); ctx.arc(128, 128, 110, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = 'bold 170px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, 128, 138);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- temas ----------
const std = (o) => new THREE.MeshStandardMaterial(o);
const metalSet = (colors) => colors.map((c, i) => std({ map: TX.containerMetal(c, 21 + i), roughness: 0.6, metalness: 0.35 }));

const THEMES = {
  city: () => ({
    wallOuter: std({ map: TX.concreteWall('#b8a991', 11), roughness: 0.92 }),
    wallInner: std({ map: TX.brickWall(12), roughness: 0.95 }),
    ground: std({ map: TX.groundSand(13), roughness: 1 }),
    floor: std({ map: TX.floorTiles(14), roughness: 0.75 }),
    roof: std({ map: TX.roofTex(17), roughness: 0.9 }),
    crate: std({ map: TX.crateWood(15), roughness: 0.85 }),
    crate2: std({ map: TX.crateWood(16, [120, 120, 90]), roughness: 0.85 }),
    blocks: metalSet(['#8a3a2e', '#2f6e6a', '#5e6b34', '#2e4a7a']),
    blockMat: 'metal', crateMat: 'wood',
    barrels: [0x48663f, 0x9a3a2c],
    sky: 0x5d8fc9, fog: [0xcdbca2, 70, 240], sunDir: [0.55, 0.78, 0.32], sun: [0xffe7c4, 3.1], sunGlow: [1, 0.85, 0.6],
    hemi: [0xcfdcf0, 0x6b5a45, 1.15], lamp: [0xffd9a0, 22, 6], lampGlow: 0xffe2a8,
    decor: 'city', stripes: true, exposure: 1, vmLight: 1, botView: 1, night: false,
    radar: { floor: '#24231f', inner: '#34332f' },
  }),
  night: () => ({
    ...THEMES.city(),
    sky: 0x04060c, fog: [0x080b13, 22, 150], sunDir: [-0.45, 0.72, -0.5], sun: [0x8fa8d8, 0.55], sunGlow: [0.45, 0.55, 0.8],
    hemi: [0x24304a, 0x0a0b0e, 0.2], lamp: [0xffc27a, 34, 4], lampGlow: 0xffd08a,
    decor: 'night', exposure: 1, vmLight: 0.32, botView: 0.55, night: true,
    radar: { floor: '#15161a', inner: '#22232a' },
  }),
  jungle: () => ({
    wallOuter: std({ map: TX.stoneBlocks('#70766a', 31, 0.9), roughness: 0.95 }),
    wallInner: std({ map: TX.bambooWall(37), roughness: 0.85 }),
    ground: std({ map: TX.jungleGround(35), roughness: 1 }),
    floor: std({ map: TX.plankFloor(41), roughness: 0.8 }),
    roof: std({ map: TX.thatch(39), roughness: 1 }),
    crate: std({ map: TX.rockFace('#7d7a70', 33, 0.7), roughness: 0.95 }),
    crate2: std({ map: TX.rockFace('#6a6e62', 34, 1), roughness: 0.95 }),
    blocks: [std({ map: TX.stoneBlocks('#7a7c70', 51, 0.8), roughness: 0.95 }), std({ map: TX.stoneBlocks('#66705e', 52, 1), roughness: 0.95 })],
    blockMat: 'concrete', crateMat: 'concrete',
    barrels: [0x6a5230, 0x4a5a34],
    sky: 0x6fa6c8, fog: [0x9db79a, 26, 130], sunDir: [0.35, 0.86, 0.38], sun: [0xfff1c9, 2.7], sunGlow: [1, 0.9, 0.7],
    hemi: [0xcfe6c8, 0x35452a, 1.05], lamp: [0xffb060, 16, 4], lampGlow: 0xffb866,
    decor: 'jungle', stripes: false, exposure: 1, vmLight: 0.9, botView: 0.85, night: false,
    radar: { floor: '#1d2a18', inner: '#3a3222' },
  }),
  ruins: () => ({
    wallOuter: std({ map: TX.stoneBlocks('#c2a878', 61, 0), roughness: 0.95 }),
    wallInner: std({ map: TX.stoneBlocks('#a98f62', 62, 0), roughness: 0.95 }),
    ground: std({ map: TX.groundSand(13), color: 0xf2dcae, roughness: 1 }),
    floor: std({ map: TX.flagstones(43), roughness: 0.85 }),
    roof: std({ map: TX.flagstones(44), color: 0xcdb48a, roughness: 0.95 }),
    crate: std({ map: TX.rockFace('#c8ae80', 63, 0), roughness: 0.95 }),
    crate2: std({ map: TX.rockFace('#b09468', 64, 0), roughness: 0.95 }),
    blocks: [std({ map: TX.stoneBlocks('#b89c6c', 65, 0), roughness: 0.95 }), std({ map: TX.stoneBlocks('#cdb284', 66, 0), roughness: 0.95 })],
    blockMat: 'concrete', crateMat: 'concrete',
    barrels: [0xa8643a, 0x8a4e2c],
    sky: 0x3f5f9a, fog: [0xe4b88a, 60, 220], sunDir: [0.78, 0.4, 0.36], sun: [0xffc48a, 3.0], sunGlow: [1, 0.7, 0.4],
    hemi: [0xe8d0b0, 0x7a5a3a, 0.95], lamp: [0xff9a40, 18, 4], lampGlow: 0xff8a30,
    decor: 'ruins', stripes: false, exposure: 1, vmLight: 1, botView: 1, night: false,
    radar: { floor: '#2a2418', inner: '#3c3424' },
  }),
};

// ---------- montagem do mapa ----------
export function buildMap(scene, renderer, mapId = 'ferrugem') {
  const def = MAPS[mapId] || MAPS.ferrugem;
  LAYOUT = makeLayout(def.top);
  TX.setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
  const T = THEMES[def.theme]();
  const rng = mulberry32(77);
  const boxes = []; // colisores {min,max,mat}
  const addCollider = (x0, y0, z0, x1, y1, z1, mat) => boxes.push({ min: [x0, y0, z0], max: [x1, y1, z1], mat });
  const root = new THREE.Group();
  root.name = `map-${def.id}`;

  const metal = std({ map: TX.metalPlate(18), roughness: 0.55, metalness: 0.6 });
  const lampMat = std({ color: 0xfff3d6, emissive: T.lampGlow, emissiveIntensity: 2.2 });
  const geo = { outer: new GeoBuilder(), inner: new GeoBuilder(), floor: new GeoBuilder(), crate: new GeoBuilder(), crate2: new GeoBuilder(), roof: new GeoBuilder(), metal: new GeoBuilder() };
  const blockGeo = T.blocks.map(() => new GeoBuilder());
  const wallUV = { su: 1 / 4, sv: 1 / WALL_H, st: 1 / 4 };
  const X0 = (cx) => cx * CELL - HALF;
  const Z0 = (cy) => cy * CELL - HALF;

  // paredes, janelas e portas (material conforme a vizinhança de áreas cobertas)
  for (const [ch, kind] of [['#', 'wall'], ['w', 'window'], ['d', 'door']]) {
    for (const which of ['outer', 'inner']) {
      const wantInner = which === 'inner';
      const rects = greedyRects((x, y) => charAt(x, y) === ch && nearInterior(x, y) === wantInner);
      for (const r of rects) {
        const x0 = X0(r.x), z0 = Z0(r.y), x1 = X0(r.x + r.w), z1 = Z0(r.y + r.h);
        const g = geo[which];
        if (kind === 'wall') {
          g.box(x0, 0, z0, x1, WALL_H, z1, { ...wallUV, skip: { ny: true } });
          addCollider(x0, 0, z0, x1, WALL_H, z1, 'concrete');
        } else if (kind === 'window') {
          g.box(x0, 0, z0, x1, 1.0, z1, { ...wallUV, skip: { ny: true } });
          g.box(x0, 2.3, z0, x1, WALL_H, z1, { ...wallUV });
          addCollider(x0, 0, z0, x1, 1.0, z1, 'concrete');
          addCollider(x0, 2.3, z0, x1, WALL_H, z1, 'concrete');
          if (T.decor === 'city' || T.decor === 'night') geo.metal.box(x0 - 0.04, 0.96, z0 - 0.04, x1 + 0.04, 1.04, z1 + 0.04, { su: 0.5, sv: 0.5 });
        } else {
          g.box(x0, 3.0, z0, x1, WALL_H, z1, { ...wallUV });
          addCollider(x0, 3.0, z0, x1, WALL_H, z1, 'concrete');
        }
      }
    }
  }

  // blocos grandes (contêineres, rochas, plataformas)
  greedyRects((x, y) => charAt(x, y) === 'K').forEach((r, i) => {
    const x0 = X0(r.x) + 0.1, z0 = Z0(r.y) + 0.1, x1 = X0(r.x + r.w) - 0.1, z1 = Z0(r.y + r.h) - 0.1;
    const k = i % blockGeo.length;
    blockGeo[k].box(x0, 0, z0, x1, 2.6, z1, { su: 1 / 3, sv: 1 / 2.6, st: 1 / 3, skip: { ny: true } });
    addCollider(x0, 0, z0, x1, 2.6, z1, T.blockMat);
  });

  // piso interno, cobertura e pontos de luz
  const interiorRects = greedyRects((x, y) => charAt(x, y) === ',');
  const lampSpots = [];
  for (const r of interiorRects) {
    const x0 = X0(r.x), z0 = Z0(r.y), x1 = X0(r.x + r.w), z1 = Z0(r.y + r.h);
    geo.floor.plane(x0, z0, x1, z1, 0.005, 1 / 4);
    geo.roof.box(x0, WALL_H, z0, x1, WALL_H + 0.35, z1, { su: 0.5, sv: 0.5 });
    addCollider(x0, WALL_H, z0, x1, WALL_H + 0.35, z1, 'concrete');
    if (r.w * r.h >= 6) lampSpots.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, area: r.w * r.h });
  }

  // obstáculos por célula
  const barrelSpots = [], trees = [], bushes = [], columns = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const ch = charAt(x, y);
      const x0 = X0(x), z0 = Z0(y);
      if (ch === 'x') {
        const g = (x + y) % 3 === 0 ? geo.crate2 : geo.crate;
        g.box(x0 + 0.1, 0, z0 + 0.1, x0 + 1.9, 1.0, z0 + 1.9, { uv: 'face', skip: { ny: true } });
        addCollider(x0 + 0.1, 0, z0 + 0.1, x0 + 1.9, 1.0, z0 + 1.9, T.crateMat);
      } else if (ch === 'X') {
        geo.crate.box(x0 + 0.1, 0, z0 + 0.1, x0 + 1.9, 1.15, z0 + 1.9, { uv: 'face', skip: { ny: true } });
        geo.crate2.box(x0 + 0.25, 1.15, z0 + 0.25, x0 + 1.75, 2.3, z0 + 1.75, { uv: 'face' });
        addCollider(x0 + 0.1, 0, z0 + 0.1, x0 + 1.9, 1.15, z0 + 1.9, T.crateMat);
        addCollider(x0 + 0.25, 1.15, z0 + 0.25, x0 + 1.75, 2.3, z0 + 1.75, T.crateMat);
      } else if (ch === 'b') {
        barrelSpots.push([x0 + 0.6, z0 + 0.6], [x0 + 1.4, z0 + 0.7], [x0 + 0.9, z0 + 1.4]);
        addCollider(x0 + 0.2, 0, z0 + 0.2, x0 + 1.8, 1.2, z0 + 1.8, T.blockMat === 'metal' ? 'metal' : 'wood');
      } else if (ch === 'T') {
        const cx = x0 + 1 + (rng() - 0.5) * 0.5, cz = z0 + 1 + (rng() - 0.5) * 0.5;
        trees.push({ x: cx, z: cz, h: 6.5 + rng() * 2.5, s: 0.85 + rng() * 0.4 });
        addCollider(cx - 0.45, 0, cz - 0.45, cx + 0.45, 7, cz + 0.45, 'wood');
      } else if (ch === 'v') {
        bushes.push({ x: x0 + 1, z: z0 + 1 });
      } else if (ch === 'o') {
        const h = [4.6, 4.6, 4.6, 3.1, 2.1, 1.5][Math.floor(rng() * 6)];
        columns.push({ x: x0 + 1, z: z0 + 1, h });
        addCollider(x0 + 0.5, 0, z0 + 0.5, x0 + 1.5, h, z0 + 1.5, 'concrete');
      }
    }
  }

  const addMesh = (g, m, shadow = true) => {
    if (g.empty) return null;
    const mesh = new THREE.Mesh(g.build(), m);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    root.add(mesh);
    return mesh;
  };
  addMesh(geo.outer, T.wallOuter);
  addMesh(geo.inner, T.wallInner);
  addMesh(geo.floor, T.floor, false);
  addMesh(geo.crate, T.crate);
  addMesh(geo.crate2, T.crate2);
  addMesh(geo.roof, T.roof);
  addMesh(geo.metal, metal);
  blockGeo.forEach((g, i) => addMesh(g, T.blocks[i]));

  const instanced = (geometry, material, list, place, shadow = true) => {
    if (!list.length) return null;
    const inst = new THREE.InstancedMesh(geometry, material, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
    list.forEach((it, i) => {
      const o = place(it, i);
      p.set(o.x, o.y || 0, o.z);
      q.setFromEuler(new THREE.Euler(0, o.ry || 0, 0));
      sc.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
      inst.setMatrixAt(i, m.compose(p, q, sc));
      if (o.color !== undefined) inst.setColorAt(i, col.setHex(o.color));
    });
    inst.castShadow = shadow;
    inst.receiveShadow = true;
    root.add(inst);
    return inst;
  };

  // barris ou urnas
  const bg = T.decor === 'ruins' ? new THREE.CylinderGeometry(0.22, 0.34, 1.1, 14) : new THREE.CylinderGeometry(0.36, 0.36, 1.15, 14);
  bg.translate(0, 0.575, 0);
  instanced(bg, std({ color: 0xffffff, roughness: 0.6, metalness: T.decor === 'ruins' || T.decor === 'jungle' ? 0 : 0.4 }), barrelSpots, ([x, z], i) => ({ x, z, ry: rng() * 6, color: T.barrels[i % 4 === 0 ? 1 : 0] }));

  // vegetação
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.46, 1, 10);
  trunkGeo.translate(0, 0.5, 0);
  const trunkMat = std({ color: 0x5a4630, roughness: 1 });
  const leafGeo = new THREE.IcosahedronGeometry(1, 1);
  const leafMat = std({ color: 0xffffff, roughness: 0.95, flatShading: true });
  const greens = [0x2f6b2a, 0x3d7f33, 0x275a26, 0x4a8a3a];
  const outerTrees = [];
  if (T.decor === 'jungle') {
    for (let i = 0; i < 90; i++) {
      const a = rng() * Math.PI * 2, d = 40 + rng() * 45;
      outerTrees.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, h: 8 + rng() * 7, s: 1.1 + rng() * 0.8 });
    }
  }
  const allTrees = [...trees, ...outerTrees];
  instanced(trunkGeo, trunkMat, allTrees, (t) => ({ x: t.x, z: t.z, sy: t.h, sx: t.s, sz: t.s, ry: rng() * 6 }));
  const canopy = [];
  for (const t of allTrees) for (let k = 0; k < 3; k++) canopy.push({ x: t.x + (rng() - 0.5) * 2.4 * t.s, z: t.z + (rng() - 0.5) * 2.4 * t.s, y: t.h - 0.6 + rng() * 1.6, s: (2.3 + rng() * 1.3) * t.s });
  instanced(leafGeo, leafMat, canopy, (c, i) => ({ x: c.x, y: c.y, z: c.z, sx: c.s, sy: c.s * 0.62, sz: c.s, ry: rng() * 6, color: greens[i % greens.length] }));
  const bushList = [];
  for (const b of bushes) for (let k = 0; k < 3; k++) bushList.push({ x: b.x + (rng() - 0.5) * 1.1, z: b.z + (rng() - 0.5) * 1.1, s: 0.55 + rng() * 0.45 });
  instanced(leafGeo, leafMat, bushList, (b, i) => ({ x: b.x, y: b.s * 0.55, z: b.z, sx: b.s, sy: b.s * 0.8, sz: b.s, ry: rng() * 6, color: greens[(i + 1) % greens.length] }), false);

  // colunas (ruínas): fuste, base e capitel quando inteiras
  if (columns.length) {
    const colMat = std({ map: TX.rockFace('#cdb68c', 71, 0), roughness: 0.95 });
    const shaft = new THREE.CylinderGeometry(0.4, 0.46, 1, 14);
    shaft.translate(0, 0.5, 0);
    instanced(shaft, colMat, columns, (c) => ({ x: c.x, z: c.z, sy: c.h, ry: rng() * 6 }));
    const slab = new THREE.BoxGeometry(1.15, 0.28, 1.15);
    slab.translate(0, 0.14, 0);
    instanced(slab, colMat, columns, (c) => ({ x: c.x, z: c.z }));
    instanced(slab, colMat, columns.filter((c) => c.h > 4), (c) => ({ x: c.x, y: c.h - 0.28, z: c.z }));
  }

  // chão externo
  T.ground.map.repeat.set(60, 60);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(480, 480), T.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  // marcações das bases no chão
  const decalMat = (tex) => std({ map: tex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 });
  const hazardTex = T.stripes ? TX.hazardStripes() : null;
  const spawnCells = { A: [], B: [] };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const ch = charAt(x, y);
    if (ch === 'A') spawnCells.A.push([x, y]);
    if (ch === 'Z') spawnCells.B.push([x, y]);
  }
  for (const [team, letter, color] of [['A', 'A', '#ff8a3d'], ['B', 'B', '#3db8ff']]) {
    const cells = spawnCells[team];
    let sx = 0, sz = 0;
    cells.forEach(([x, y]) => { sx += cellToWorld(x); sz += cellToWorld(y); });
    sx /= cells.length; sz /= cells.length;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 4.5), decalMat(floorLetter(letter, color)));
    m.rotation.x = -Math.PI / 2;
    m.position.set(sx, 0.02, sz);
    m.receiveShadow = true;
    root.add(m);
    if (!hazardTex) continue;
    const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
    const minX = X0(Math.min(...xs)), maxX = X0(Math.max(...xs) + 1);
    for (const zz of [Z0(Math.min(...ys)) - 0.3, Z0(Math.max(...ys) + 1) + 0.3]) {
      const tex = hazardTex.clone();
      tex.repeat.set((maxX - minX) / 1.4, 1);
      tex.needsUpdate = true;
      const s = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX, 0.35), std({ map: tex, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }));
      s.rotation.x = -Math.PI / 2;
      s.position.set((minX + maxX) / 2, 0.015, zz);
      s.receiveShadow = true;
      root.add(s);
    }
  }

  // luminárias, lanternas ou tochas nas áreas cobertas
  const lampGeo = T.decor === 'city' || T.decor === 'night' ? new THREE.BoxGeometry(1.6, 0.08, 0.35) : new THREE.BoxGeometry(0.28, 0.36, 0.28);
  const interiorLights = [];
  lampSpots.sort((a, b) => b.area - a.area);
  lampSpots.forEach((sp, i) => {
    const lm = new THREE.Mesh(lampGeo, lampMat);
    lm.position.set(sp.x, WALL_H - (T.decor === 'city' || T.decor === 'night' ? 0.06 : 0.9), sp.z);
    root.add(lm);
    if (i < T.lamp[2]) {
      const pl = new THREE.PointLight(T.lamp[0], T.lamp[1], 16, 1.6);
      pl.position.set(sp.x, WALL_H - 1.0, sp.z);
      root.add(pl);
      interiorLights.push(pl);
    }
  });

  // ---------- entorno ----------
  if (T.decor === 'city' || T.decor === 'night') {
    const signs = [
      { text: 'DEPÓSITO', sub: 'SETOR OESTE', x: -14 + 0.03, z: -11, ry: Math.PI / 2 },
      { text: 'DEPÓSITO', sub: 'SETOR LESTE', x: 14 - 0.03, z: 11, ry: -Math.PI / 2 },
      { text: 'ESCRITÓRIO', sub: 'BLOCO NORTE', x: 13, z: -18 + 0.03, ry: 0 },
      { text: 'ESCRITÓRIO', sub: 'BLOCO SUL', x: -13, z: 18 - 0.03, ry: Math.PI },
    ];
    for (const s of signs) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.25), std({ map: signTexture(s.text, s.sub), transparent: true, roughness: 0.9, depthWrite: false }));
      m.position.set(s.x, 3.3, s.z);
      m.rotation.y = s.ry;
      root.add(m);
    }
    const pipeGeo = new THREE.CylinderGeometry(0.12, 0.12, 1, 10);
    pipeGeo.rotateZ(Math.PI / 2);
    for (const [z, off] of [[-HALF + 2 + 0.25, 1], [HALF - 2 - 0.25, -1]]) {
      const p = new THREE.Mesh(pipeGeo, metal);
      p.scale.set(HALF * 2 - 4, 1, 1);
      p.position.set(0, 4.3, z);
      p.castShadow = true;
      root.add(p);
      const p2 = p.clone();
      p2.position.y = 4.0;
      p2.position.z = z + off * 0.05;
      p2.scale.y = 0.7; p2.scale.z = 0.7;
      root.add(p2);
    }
    // silhueta urbana (à noite, parte dos prédios tem janelas acesas)
    const night = T.decor === 'night';
    const sg = new THREE.BoxGeometry(1, 1, 1);
    sg.translate(0, 0.5, 0);
    const dark = std({ color: night ? 0x14161c : 0x6f6a66, roughness: 1 });
    const lit = night ? std({ color: 0x191b22, roughness: 1, emissive: 0xffc27a, emissiveIntensity: 0.22 }) : dark;
    for (let i = 0; i < 70; i++) {
      const a = rng() * Math.PI * 2;
      const d = 52 + rng() * 90;
      const b = new THREE.Mesh(sg, night && rng() < 0.35 ? lit : dark);
      b.scale.set(6 + rng() * 14, 6 + rng() * 26, 6 + rng() * 14);
      b.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
      b.rotation.y = rng() * Math.PI;
      root.add(b);
    }
    const tower = new THREE.Group();
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 14, 0.4), metal);
    for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) { const l = leg.clone(); l.position.set(dx, 7, dz); tower.add(l); }
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 5, 20), T.blocks[1]);
    tank.position.y = 16.5;
    tower.add(tank);
    tower.position.set(-58, 0, 30);
    root.add(tower);
    if (night) {
      // postes de luz nas bases e nos pátios
      const poleGeo = new THREE.CylinderGeometry(0.07, 0.09, 4.4, 8);
      for (const [px, pz] of [[-27, -27], [27, 27], [-3, -13], [3, 13]]) {
        const pole = new THREE.Mesh(poleGeo, metal);
        pole.position.set(px, 2.2, pz);
        root.add(pole);
        const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.3), lampMat);
        bulb.position.set(px, 4.45, pz);
        root.add(bulb);
        const pl = new THREE.PointLight(0xffd29a, 30, 20, 1.5);
        pl.position.set(px, 4.2, pz);
        root.add(pl);
        interiorLights.push(pl);
      }
    }
  } else if (T.decor === 'ruins') {
    // pirâmides e mesas de arenito no horizonte
    const pyr = new THREE.ConeGeometry(1, 1, 4);
    pyr.translate(0, 0.5, 0);
    pyr.rotateY(Math.PI / 4);
    const far = std({ color: 0xc9a878, roughness: 1, flatShading: true });
    for (const [x, z, s, h] of [[-110, -70, 60, 62], [95, -120, 46, 48], [140, 40, 70, 74], [-60, 130, 40, 40], [30, 150, 30, 30]]) {
      const m = new THREE.Mesh(pyr, far);
      m.scale.set(s, h, s);
      m.position.set(x, 0, z);
      root.add(m);
    }
    const mesa = new THREE.BoxGeometry(1, 1, 1);
    mesa.translate(0, 0.5, 0);
    for (let i = 0; i < 26; i++) {
      const a = rng() * Math.PI * 2, d = 55 + rng() * 60;
      const m = new THREE.Mesh(mesa, far);
      m.scale.set(8 + rng() * 18, 3 + rng() * 9, 8 + rng() * 18);
      m.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
      m.rotation.y = rng() * 3;
      root.add(m);
    }
  }

  scene.add(root);

  // ---------- iluminação e céu ----------
  const hemi = new THREE.HemisphereLight(T.hemi[0], T.hemi[1], T.hemi[2]);
  root.add(hemi);
  const sun = new THREE.DirectionalLight(T.sun[0], T.sun[1]);
  const sunDir = new THREE.Vector3(...T.sunDir).normalize();
  sun.position.copy(sunDir).multiplyScalar(80);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  const sc = sun.shadow.camera;
  sc.left = -44; sc.right = 44; sc.top = 44; sc.bottom = -44; sc.near = 10; sc.far = 180;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  root.add(sun);
  root.add(sun.target);

  const fogColor = new THREE.Color(T.fog[0]);
  scene.fog = new THREE.Fog(fogColor, T.fog[1], T.fog[2]);
  scene.background = fogColor;

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(T.sky) },
      horizon: { value: fogColor.clone() },
      sunDir: { value: sunDir },
      glow: { value: new THREE.Vector3(...T.sunGlow) },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 glow; varying vec3 vDir;
      void main(){ float h = clamp(vDir.y, 0.0, 1.0); vec3 col = mix(horizon, top, pow(h, 0.55));
      float s = max(dot(normalize(vDir), sunDir), 0.0); col += glow * (pow(s, 600.0) * 4.0 + pow(s, 12.0) * 0.25);
      gl_FragColor = vec4(col, 1.0); }`,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 16), skyMat);
  skyDome.renderOrder = -1;
  root.add(skyDome);
  if (T.night) {
    // estrelas
    const n = 700;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2, e = Math.asin(0.08 + rng() * 0.92);
      pos[i * 3] = Math.cos(a) * Math.cos(e) * 300; pos[i * 3 + 1] = Math.sin(e) * 300; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 300;
    }
    const sgeo = new THREE.BufferGeometry();
    sgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(sgeo, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.8, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, depthWrite: false }));
    stars.frustumCulled = false;
    root.add(stars);
    // lua
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.windowGlow(), color: 0xcfdcff, fog: false, depthWrite: false }));
    moon.position.copy(sunDir).multiplyScalar(290);
    moon.scale.setScalar(34);
    root.add(moon);
  }

  // ---------- navegação ----------
  const walk = [];
  for (let y = 0; y < N; y++) {
    walk.push([]);
    for (let x = 0; x < N; x++) walk[y].push(WALKABLE.has(charAt(x, y)));
  }
  const ffaSpawns = [];
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    if (!walk[y][x]) continue;
    let open = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (walk[y + dy][x + dx]) open++;
    if (open >= 8) ffaSpawns.push({ x: cellToWorld(x), z: cellToWorld(y) });
  }
  const teamSpawns = {
    A: spawnCells.A.map(([x, y]) => ({ x: cellToWorld(x), z: cellToWorld(y), yaw: 0 })),
    B: spawnCells.B.map(([x, y]) => ({ x: cellToWorld(x), z: cellToWorld(y), yaw: Math.PI })),
  };

  // ---------- radar (imagem de cima) ----------
  const PPM = 4; // pixels por metro
  const radarImg = document.createElement('canvas');
  radarImg.width = radarImg.height = N * CELL * PPM;
  const rc = radarImg.getContext('2d');
  const nat = T.decor === 'jungle' || T.decor === 'ruins';
  const colors = {
    '#': nat ? '#a59f8c' : '#c9c4b8', w: '#8f8a80', d: '#4a4741', x: nat ? '#77735f' : '#8c6a43', X: nat ? '#8a8570' : '#a07a4c',
    K: nat ? '#7d7864' : '#7c5348', b: '#5c6b55', ',': T.radar.inner, '.': T.radar.floor, A: '#3a2a1f', Z: '#1f2c3a',
    T: '#3f7a35', v: '#2c4a26', o: '#cfc3a0',
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const ch = charAt(x, y);
    rc.fillStyle = colors[ch] || T.radar.floor;
    rc.fillRect(x * CELL * PPM, y * CELL * PPM, CELL * PPM, CELL * PPM);
    if (ch === 'T' || ch === 'o' || ch === 'v') {
      rc.fillStyle = T.radar.floor;
      rc.fillRect(x * CELL * PPM, y * CELL * PPM, CELL * PPM, CELL * PPM);
      rc.fillStyle = colors[ch];
      rc.beginPath(); rc.arc((x + 0.5) * CELL * PPM, (y + 0.5) * CELL * PPM, ch === 'v' ? 3 : 2.6, 0, 7); rc.fill();
    }
  }

  // libera geometria, materiais e texturas ao trocar de mapa
  const dispose = () => {
    scene.remove(root);
    const seen = new Set();
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of ms) {
        if (seen.has(m)) continue;
        seen.add(m);
        if (m.map) m.map.dispose();
        m.dispose();
      }
      if (o.isLight && o.shadow && o.shadow.map) o.shadow.map.dispose();
    });
  };

  return {
    id: def.id, name: def.name, def, root, boxes, walk, teamSpawns, ffaSpawns, sun, hemi, interiorLights, radarImg, radarPPM: PPM, skyDome,
    night: T.night, exposure: T.exposure, vmLight: T.vmLight, botView: T.botView, baseHemi: T.hemi[2], dispose,
  };
}

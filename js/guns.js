// Modelos detalhados das armas, montados por código.
//
// Cada arma nasce de perfis laterais (silhuetas em 2D extrudadas com chanfro), cilindros
// para canos e tubos, e peças de detalhe. As partes fixas são unidas por material em poucas
// malhas; só o que se move (carregador, ferrolho, bomba, coronha) fica separado.
// Convenção dos perfis: u = para a frente (o cano aponta para u positivo), y = para cima,
// origem no topo do punho. No mundo, "para a frente" é o eixo -Z.
import * as THREE from 'three';
import { mulberry32 } from './utils.js';

// ---------------------------------------------------------------- ambiente e materiais
let ENV = null;
const matCache = new Map();
const texCache = new Map();

// Mapa de ambiente gerado por código: um "estúdio" com painéis de luz, para o metal refletir.
export function initGunEnvironment(renderer) {
  if (ENV) return ENV;
  const scene = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: 0x1c1f24, side: THREE.BackSide }));
  scene.add(room);
  const panel = (w, h, x, y, z, ry, rx, color, power) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, 0);
    scene.add(m);
  };
  panel(6, 4, 0, 4.9, 0, 0, Math.PI / 2, 0xffffff, 4.5); // teto
  panel(3, 5, -4.9, 0.5, 1, Math.PI / 2, 0, 0xffe2b8, 3.5); // lateral quente
  panel(2, 5, 4.9, 0.5, -1.5, -Math.PI / 2, 0, 0xb8d4ff, 2.6); // lateral fria
  panel(5, 1.2, 0, 1.5, -4.9, 0, 0, 0xffffff, 2); // faixa frontal
  panel(8, 8, 0, -4.9, 0, 0, -Math.PI / 2, 0x6a5a48, 0.6); // chão
  const pmrem = new THREE.PMREMGenerator(renderer);
  ENV = pmrem.fromScene(scene, 0.03).texture;
  pmrem.dispose();
  room.geometry.dispose();
  for (const m of matCache.values()) if (m.isMeshStandardMaterial) { m.envMap = ENV; m.needsUpdate = true; }
  return ENV;
}
export const gunEnvironment = () => ENV;

function canvasTex(key, w, h, draw, repeat = 1) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

// veios de madeira (as coordenadas de textura dos perfis estão em metros)
const woodTex = () => canvasTex('wood', 256, 256, (ctx, w, h) => {
  const rng = mulberry32(31);
  ctx.fillStyle = '#8a5a32';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) {
    const y = rng() * h;
    ctx.strokeStyle = `rgba(${60 + rng() * 40},${35 + rng() * 25},${15 + rng() * 15},${0.15 + rng() * 0.35})`;
    ctx.lineWidth = 0.6 + rng() * 2.2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    const a = (rng() - 0.5) * 14, b = (rng() - 0.5) * 14;
    ctx.bezierCurveTo(w * 0.3, y + a, w * 0.65, y + b, w, y);
    ctx.stroke();
  }
  for (let i = 0; i < 5; i++) {
    const x = rng() * w, y = rng() * h, r = 6 + rng() * 10;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(50,28,12,0.7)'); g.addColorStop(1, 'rgba(50,28,12,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}, 6);

// granulado fino para polímero e borracha (usado como relevo e variação de rugosidade)
const grainTex = () => canvasTex('grain', 128, 128, (ctx, w, h) => {
  const rng = mulberry32(57);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 5000; i++) {
    const v = 90 + rng() * 80;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(rng() * w, rng() * h, 1.5, 1.5);
  }
}, 40);

// aço escovado: riscos longos ao longo do comprimento
const brushedTex = () => canvasTex('brushed', 256, 64, (ctx, w, h) => {
  const rng = mulberry32(73);
  ctx.fillStyle = '#9a9a9a';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    const v = 110 + rng() * 90;
    ctx.fillStyle = `rgba(${v},${v},${v},${0.25 + rng() * 0.4})`;
    ctx.fillRect(rng() * w, rng() * h, 30 + rng() * 120, 1);
  }
}, 8);

// empunhadura de katana: fita trançada em losangos sobre couro de arraia claro
const itoTex = (hex) => canvasTex(`ito${hex}`, 64, 64, (ctx, w, h) => {
  ctx.fillStyle = '#e6dfcf';
  ctx.fillRect(0, 0, w, h);
  const rng = mulberry32(11);
  for (let i = 0; i < 220; i++) { ctx.fillStyle = `rgba(150,140,120,${rng() * 0.5})`; ctx.beginPath(); ctx.arc(rng() * w, rng() * h, 1.2, 0, 7); ctx.fill(); }
  ctx.strokeStyle = `#${hex.toString(16).padStart(6, '0')}`;
  ctx.lineWidth = 17;
  ctx.lineCap = 'butt';
  for (const off of [-64, 0, 64]) {
    ctx.beginPath(); ctx.moveTo(off, 0); ctx.lineTo(off + 64, 64); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(off + 64, 0); ctx.lineTo(off, 64); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  for (const off of [-64, 0, 64]) for (const d of [-8.5, 8.5]) {
    ctx.beginPath(); ctx.moveTo(off + d, 0); ctx.lineTo(off + 64 + d, 64); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(off + 64 + d, 0); ctx.lineTo(off + d, 64); ctx.stroke();
  }
}, 30);

function mat(kind, color = 0xffffff, extra = {}) {
  const key = `${kind}|${color}|${JSON.stringify(extra)}`;
  if (matCache.has(key)) return matCache.get(key);
  let m;
  switch (kind) {
    case 'steel': m = new THREE.MeshStandardMaterial({ color, metalness: 0.92, roughness: 0.34, roughnessMap: brushedTex() }); break;
    case 'gunmetal': m = new THREE.MeshStandardMaterial({ color, metalness: 0.8, roughness: 0.5, roughnessMap: brushedTex() }); break;
    case 'polymer': m = new THREE.MeshStandardMaterial({ color, metalness: 0.04, roughness: 0.82, bumpMap: grainTex(), bumpScale: 0.6 }); break;
    case 'rubber': m = new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: 0.96, bumpMap: grainTex(), bumpScale: 0.9 }); break;
    case 'wood': m = new THREE.MeshStandardMaterial({ color, map: woodTex(), metalness: 0, roughness: 0.52 }); break;
    case 'brass': m = new THREE.MeshStandardMaterial({ color, metalness: 0.95, roughness: 0.28 }); break;
    case 'glass': m = new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: 0.04 }); break;
    case 'glow': m = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: extra.power ?? 1.3, roughness: 0.3, metalness: 0 }); break;
    case 'lens': m = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.05, transparent: true, opacity: 0.16, depthWrite: false }); break;
    case 'ito': m = new THREE.MeshStandardMaterial({ map: itoTex(color), roughness: 0.85, metalness: 0 }); break;
    case 'bore': m = new THREE.MeshBasicMaterial({ color: 0x050505 }); break;
    default: m = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2 });
  }
  if (m.isMeshStandardMaterial) {
    m.envMap = ENV;
    const dielectric = kind === 'polymer' || kind === 'rubber' || kind === 'wood' || kind === 'ito' || kind === 'glow';
    m.envMapIntensity = extra.env ?? (kind === 'glass' ? 1.8 : dielectric ? 0.3 : 1.0);
  }
  matCache.set(key, m);
  return m;
}
export { mat as gunMat };

// ---------------------------------------------------------------- kit de construção
function makeProfile(pts, w, bev, holes, bs = 1) {
  bev = Math.max(0, Math.min(bev, w / 2 - 0.0004));
  const shape = new THREE.Shape(pts.map(([u, y]) => new THREE.Vector2(u, y)));
  if (holes) for (const h of holes) shape.holes.push(new THREE.Path(h.map(([u, y]) => new THREE.Vector2(u, y))));
  const depth = w - 2 * bev;
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: bs, steps: 1, curveSegments: 8 });
  g.translate(0, 0, -depth / 2);
  return g;
}

function mergeGeos(geos) {
  let n = 0;
  const list = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}

export class Kit {
  constructor() { this.buckets = new Map(); }

  push(g, m) {
    let a = this.buckets.get(m);
    if (!a) { a = []; this.buckets.set(m, a); }
    a.push(g);
    return g;
  }

  // perfil lateral [u, y] extrudado na largura w (eixo X); o.x desloca para o lado
  prof(pts, w, m, o = {}) {
    const g = makeProfile(pts, w, o.b ?? 0.003, o.holes, o.bs);
    g.rotateY(Math.PI / 2); // u -> -z, largura -> x
    if (o.x || o.y) g.translate(o.x || 0, o.y || 0, 0);
    return this.push(g, m);
  }

  // perfil frontal [x, y] extrudado ao longo do comprimento, de u0 a u1
  fprof(pts, u0, u1, m, o = {}) {
    const g = makeProfile(pts, u1 - u0, o.b ?? 0.0015, o.holes, o.bs);
    g.translate(o.x || 0, o.y || 0, -(u0 + u1) / 2);
    return this.push(g, m);
  }

  // caixa chanfrada: largura (x), altura (y), comprimento (ao longo de u), centrada em (x, y, u)
  box(w, h, d, x, y, u, m, o = {}) {
    const bev = o.b ?? Math.min(0.0025, w / 5, h / 5, d / 5);
    const g = makeProfile([[-d / 2, -h / 2], [d / 2, -h / 2], [d / 2, h / 2], [-d / 2, h / 2]], w, bev);
    g.rotateY(Math.PI / 2);
    if (o.rx) g.rotateX(o.rx);
    if (o.rz) g.rotateZ(o.rz);
    if (o.ry) g.rotateY(o.ry);
    g.translate(x, y, -u);
    return this.push(g, m);
  }

  // tubo ao longo do comprimento: raio r (atrás) -> r2 (na frente), de u0 a u1
  tube(r, u0, u1, y, m, o = {}) {
    const g = new THREE.CylinderGeometry(r, o.r2 ?? r, u1 - u0, o.seg || 20, 1, !!o.open);
    g.rotateX(Math.PI / 2);
    g.translate(o.x || 0, y, -(u0 + u1) / 2);
    return this.push(g, m);
  }

  // cilindro vertical (eixo Y) ou lateral (eixo X)
  cylY(r, h, x, y, u, m, o = {}) {
    const g = new THREE.CylinderGeometry(o.r2 ?? r, r, h, o.seg || 16);
    g.translate(x, y, -u);
    return this.push(g, m);
  }

  cylX(r, w, x, y, u, m, o = {}) {
    const g = new THREE.CylinderGeometry(r, o.r2 ?? r, w, o.seg || 16);
    g.rotateZ(Math.PI / 2);
    g.translate(x, y, -u);
    return this.push(g, m);
  }

  // disco voltado para a frente (boca do cano, lente) ou para trás (back: true)
  disc(r, u, y, m, o = {}) {
    const g = new THREE.CircleGeometry(r, o.seg || 20);
    if (!o.back) g.rotateY(Math.PI);
    g.translate(o.x || 0, y, -u);
    return this.push(g, m);
  }

  sphere(r, x, y, u, m) {
    const g = new THREE.SphereGeometry(r, 14, 10);
    g.translate(x, y, -u);
    return this.push(g, m);
  }

  build(parent = new THREE.Group()) {
    for (const [m, geos] of this.buckets) {
      const mesh = new THREE.Mesh(mergeGeos(geos), m);
      mesh.castShadow = true;
      parent.add(mesh);
    }
    this.buckets.clear();
    return parent;
  }
}

// trilho dentado (padrão de acessórios) visto de lado
function railPts(u0, u1, y0, y1, pitch = 0.0105) {
  const base = y1 - 0.0028;
  const pts = [[u0, y0]];
  let u = u0;
  while (u + pitch * 0.55 <= u1 + 1e-6) {
    pts.push([u, base], [u, y1], [u + pitch * 0.55, y1], [u + pitch * 0.55, base]);
    u += pitch;
  }
  pts.push([u1 + 0.0006, base], [u1 + 0.0006, y0]);
  return pts;
}

// guarda-mato com gatilho
function triggerGuard(k, u0, u1, yTop, yBot, m, trigM) {
  const c = 0.008, t = 0.0035;
  k.prof([[u0, yTop], [u1, yTop], [u1, yBot + c], [u1 - c, yBot], [u0 + c, yBot], [u0, yBot + c]], 0.011, m, {
    b: 0.001,
    holes: [[[u0 + t, yTop - 0.001], [u1 - t, yTop - 0.001], [u1 - t, yBot + c], [u1 - c - 0.001, yBot + t], [u0 + c + 0.001, yBot + t], [u0 + t, yBot + c]]],
  });
  const um = (u0 + u1) / 2 - 0.004;
  k.prof([[um, yTop], [um + 0.006, yTop], [um + 0.009, yTop - 0.012], [um + 0.004, (yTop + yBot) / 2 - 0.004], [um, (yTop + yBot) / 2 - 0.002], [um + 0.003, yTop - 0.012]], 0.006, trigM, { b: 0.0008 });
}

// mira holográfica aberta: base, moldura com janela, lente e ponto luminoso
function holoSight(k, u, yc, dark, color) {
  const hw = 0.021, hh = 0.019, c = 0.005;
  k.box(0.03, yc - hh - 0.004 > 0 ? 0.008 : 0.006, 0.05, 0, yc - hh - 0.003, u, dark);
  k.fprof(
    [[-hw + c, -hh], [hw - c, -hh], [hw, -hh + c], [hw, hh - c], [hw - c, hh], [-hw + c, hh], [-hw, hh - c], [-hw, -hh + c]],
    u - 0.022, u + 0.022, dark,
    { y: yc, b: 0.001, holes: [[[-hw + 0.004, -hh + 0.004], [hw - 0.004, -hh + 0.004], [hw - 0.004, hh - 0.004], [-hw + 0.004, hh - 0.004]]] },
  );
  k.box(0.034, 0.03, 0.001, 0, yc, u + 0.012, mat('lens', 0x9fd0ff), { b: 0 });
  k.disc(0.0017, u - 0.004, yc, mat('glow', color, { power: 1.8 }), { back: true, seg: 10 });
  k.box(0.012, 0.01, 0.014, 0.024, yc - 0.01, u, dark); // botão lateral
}

const P_DARK = 0x1c1e22;

// ---------------------------------------------------------------- as armas
/*
 * Retorna { group, muzzle, muzzles?, mag, slide, pump, stock[], sightY }.
 * mag/slide/pump são grupos próprios (animados); stock some na mira de precisão.
 */
export function buildGun(def) {
  const g = new THREE.Group();
  const md = def.model;
  const k = new Kit();
  const out = { group: g, muzzle: new THREE.Object3D(), mag: null, slide: null, pump: null, sightY: 0.06, stock: [], type: md.type };
  const sub = (fn) => { const kk = new Kit(); fn(kk); const grp = kk.build(); g.add(grp); return grp; };
  const gunmetal = mat('gunmetal', 0x26282c);
  const steelDark = mat('steel', 0x3a3d42);
  const polyDark = mat('polymer', P_DARK);
  const rubber = mat('rubber', 0x111214);
  const bore = mat('bore');
  const brass = mat('brass', 0xc09a48);

  switch (md.type) {
    // ============================================================ VP-9
    case 'pistol': {
      const slideM = mat('steel', 0x4a4e55);
      const frame = mat('polymer', md.body);
      // armação e punho em peça única
      k.prof([[-0.05, 0.016], [0.142, 0.016], [0.142, -0.003], [0.132, -0.008], [0.062, -0.01], [0.0, -0.012], [-0.012, -0.05], [-0.03, -0.118], [-0.076, -0.112], [-0.06, -0.04], [-0.066, 0.004]], 0.028, frame, { b: 0.005, bs: 2 });
      k.prof(railPts(0.07, 0.13, -0.008, -0.013, 0.012), 0.016, frame, { b: 0 }); // trilho inferior
      k.box(0.031, 0.05, 0.03, 0, -0.07, -0.045, rubber, { rx: -0.2, b: 0.004 }); // textura do punho
      triggerGuard(k, -0.002, 0.062, -0.011, -0.05, frame, steelDark);
      k.box(0.004, 0.006, 0.02, 0.016, 0.004, 0.02, steelDark); // retém do ferrolho
      k.cylX(0.004, 0.032, 0, 0.0, 0.05, steelDark); // pino de desmontagem
      // ferrolho (recua ao disparar)
      out.slide = sub((s) => {
        s.prof([[-0.047, 0.017], [-0.047, 0.05], [-0.04, 0.055], [0.136, 0.055], [0.145, 0.047], [0.145, 0.017]], 0.03, slideM, { b: 0.004 });
        for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) s.box(0.0012, 0.026, 0.0035, sx * 0.0152, 0.036, -0.036 + i * 0.007, gunmetal, { b: 0 });
        s.box(0.0012, 0.012, 0.032, 0.0152, 0.046, 0.045, gunmetal, { b: 0 }); // janela de ejeção
        s.box(0.012, 0.0012, 0.03, 0.006, 0.0552, 0.045, gunmetal, { b: 0 });
        s.box(0.004, 0.008, 0.008, 0, 0.059, 0.132, gunmetal, { b: 0.0008 }); // massa de mira
        s.box(0.0045, 0.008, 0.007, -0.0075, 0.059, -0.038, gunmetal, { b: 0.0008 }); // alça (dois postes)
        s.box(0.0045, 0.008, 0.007, 0.0075, 0.059, -0.038, gunmetal, { b: 0.0008 });
        s.box(0.02, 0.004, 0.007, 0, 0.0565, -0.038, gunmetal, { b: 0.0008 });
        s.disc(0.0012, 0.1281, 0.0605, mat('glow', 0xf2f2f2, { power: 0.9 }), { back: true, seg: 8 });
        s.tube(0.0068, 0.13, 0.149, 0.037, steelDark);
        s.disc(0.0046, 0.1492, 0.037, bore);
        s.tube(0.0035, 0.13, 0.1465, 0.023, steelDark); // guia da mola
      });
      out.mag = sub((s) => {
        s.box(0.022, 0.09, 0.03, 0, -0.07, -0.046, gunmetal, { rx: -0.2 });
        s.box(0.03, 0.012, 0.05, 0, -0.121, -0.056, polyDark, { rx: -0.07, b: 0.003 });
      });
      out.muzzle.position.set(0, 0.037, -0.152);
      out.sightY = 0.063;
      break;
    }
    // ============================================================ Brasa .50
    case 'revolver': {
      const steel = mat('steel', md.body);
      const wood = mat('wood', 0xffffff);
      // cano pesado com contrapeso e nervura superior
      k.prof([[0.045, 0.012], [0.045, 0.066], [0.238, 0.066], [0.238, 0.034], [0.226, 0.012]], 0.024, steel, { b: 0.005, bs: 2 });
      k.prof([[0.05, 0.066], [0.05, 0.071], [0.232, 0.071], [0.236, 0.066]], 0.011, gunmetal, { b: 0.001 });
      for (let i = 0; i < 5; i++) k.box(0.0255, 0.006, 0.014, 0, 0.028, 0.08 + i * 0.032, gunmetal, { b: 0.001 }); // aberturas do contrapeso
      k.disc(0.0075, 0.2385, 0.048, bore);
      k.prof([[0.2, 0.071], [0.232, 0.071], [0.228, 0.082], [0.222, 0.082]], 0.005, gunmetal, { b: 0.0005 }); // massa de mira em rampa
      k.box(0.0052, 0.004, 0.006, 0, 0.0805, 0.2235, mat('glow', 0xff5a1e, { power: 1.2 }), { b: 0 });
      // armação
      k.prof([[-0.066, 0.0], [-0.066, 0.05], [-0.05, 0.066], [0.045, 0.066], [0.045, 0.058], [-0.022, 0.058], [-0.022, 0.004], [0.045, 0.004], [0.045, -0.004], [0.012, -0.012], [-0.04, -0.012]], 0.022, steel, { b: 0.004 });
      k.box(0.006, 0.01, 0.008, -0.007, 0.071, -0.052, gunmetal, { b: 0.001 }); // alça (dois postes)
      k.box(0.006, 0.01, 0.008, 0.007, 0.071, -0.052, gunmetal, { b: 0.001 });
      k.box(0.02, 0.005, 0.01, 0, 0.0675, -0.052, gunmetal, { b: 0.001 });
      k.prof([[-0.064, 0.05], [-0.076, 0.066], [-0.071, 0.07], [-0.056, 0.06]], 0.008, gunmetal, { b: 0.001 }); // cão
      triggerGuard(k, -0.012, 0.045, -0.011, -0.05, steel, gunmetal);
      k.tube(0.0045, 0.045, 0.13, 0.02, gunmetal); // vareta do extrator
      // tambor com caneluras
      out.mag = sub((s) => {
        s.tube(0.03, -0.02, 0.043, 0.031, steel, { seg: 24 });
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.52;
          s.tube(0.0085, -0.012, 0.0432, 0.031 + Math.sin(a) * 0.0265, gunmetal, { x: Math.cos(a) * 0.0265, seg: 12 });
          s.disc(0.006, -0.0202, 0.031 + Math.sin(a) * 0.0185, brass, { x: Math.cos(a) * 0.0185, back: true, seg: 12 });
        }
      });
      // cabo de madeira
      k.prof([[-0.066, -0.004], [-0.02, -0.012], [-0.03, -0.062], [-0.05, -0.128], [-0.1, -0.122], [-0.09, -0.06], [-0.082, -0.012]], 0.034, wood, { b: 0.009, bs: 2 });
      k.cylX(0.006, 0.036, 0, -0.07, -0.058, brass);
      out.muzzle.position.set(0, 0.048, -0.24);
      out.sightY = 0.079;
      break;
    }
    // ============================================================ Ratel MK2
    case 'smg': {
      const body = mat('polymer', md.body);
      const acc = mat('polymer', md.accent);
      // caixa superior e inferior
      k.prof([[-0.085, 0.012], [-0.085, 0.056], [-0.075, 0.066], [0.235, 0.066], [0.245, 0.056], [0.245, 0.02], [0.235, 0.012]], 0.042, gunmetal, { b: 0.006 });
      k.prof([[-0.085, 0.014], [0.2, 0.014], [0.2, -0.002], [0.165, -0.012], [0.09, -0.012], [0.07, -0.006], [-0.06, -0.012], [-0.085, 0.0]], 0.038, body, { b: 0.005 });
      k.prof(railPts(-0.07, 0.225, 0.066, 0.0715), 0.02, gunmetal, { b: 0 });
      k.box(0.0012, 0.014, 0.05, 0.0212, 0.045, 0.06, steelDark, { b: 0 }); // janela de ejeção
      k.box(0.014, 0.01, 0.022, -0.026, 0.05, 0.16, acc, { b: 0.002 }); // alavanca de manejo
      for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) k.box(0.0012, 0.006, 0.024, sx * 0.0212, 0.034, 0.12 + i * 0.03, steelDark, { b: 0 });
      // cano curto com quebra-chamas
      k.tube(0.0185, 0.245, 0.3, 0.036, gunmetal);
      k.tube(0.0215, 0.3, 0.36, 0.036, steelDark, { seg: 16 });
      for (let i = 0; i < 3; i++) k.tube(0.0222, 0.308 + i * 0.016, 0.314 + i * 0.016, 0.036, gunmetal, { seg: 16 });
      k.disc(0.0085, 0.3605, 0.036, bore);
      // punho e apoio frontal
      k.prof([[-0.05, -0.008], [-0.006, -0.008], [-0.022, -0.112], [-0.07, -0.108], [-0.062, -0.05]], 0.032, acc, { b: 0.007, bs: 2 });
      triggerGuard(k, -0.004, 0.07, -0.008, -0.046, body, steelDark);
      k.prof([[0.2, -0.002], [0.235, 0.008], [0.225, -0.05], [0.2, -0.05]], 0.03, acc, { b: 0.006 });
      // carregador reto
      out.mag = sub((s) => {
        s.prof([[0.1, -0.006], [0.146, -0.006], [0.158, -0.192], [0.112, -0.196]], 0.025, gunmetal, { b: 0.003 });
        for (let i = 0; i < 4; i++) s.box(0.0262, 0.003, 0.04, 0, -0.06 - i * 0.035, 0.131 + i * 0.002, steelDark, { b: 0 });
        s.box(0.029, 0.008, 0.052, 0, -0.197, 0.135, polyDark, { b: 0.002 });
      });
      // coronha rebatível (some na mira)
      out.stock.push(sub((s) => {
        for (const sx of [-1, 1]) s.tube(0.0055, -0.215, -0.085, 0.048, steelDark, { x: sx * 0.016, seg: 10 });
        s.prof([[-0.215, 0.066], [-0.232, 0.066], [-0.236, -0.04], [-0.218, -0.04]], 0.044, body, { b: 0.006 });
        s.box(0.046, 0.1, 0.006, 0, 0.013, -0.238, rubber, { b: 0.002 });
      }));
      holoSight(k, 0.05, 0.0925, gunmetal, 0xff3030);
      out.sightY = 0.0925;
      out.muzzle.position.set(0, 0.036, -0.365);
      break;
    }
    // ============================================================ Tempest AR-K
    case 'ar': {
      const wood = mat('wood', 0xd9b48a);
      const steel = mat('steel', 0x34373c);
      // caixa da culatra e tampa
      k.prof([[-0.13, 0.004], [-0.13, 0.062], [-0.1, 0.068], [0.2, 0.068], [0.205, 0.06], [0.205, 0.006], [0.06, 0.0], [0.04, -0.01], [-0.03, -0.01], [-0.05, 0.0]], 0.044, steel, { b: 0.004 });
      k.prof([[-0.125, 0.068], [-0.116, 0.083], [0.12, 0.083], [0.14, 0.068]], 0.04, gunmetal, { b: 0.006, bs: 2 });
      for (let i = 0; i < 4; i++) k.box(0.0405, 0.002, 0.004, 0, 0.0838, -0.07 + i * 0.045, steel, { b: 0 }); // nervuras da tampa
      k.box(0.0012, 0.014, 0.07, 0.0222, 0.05, 0.06, gunmetal, { b: 0 }); // janela de ejeção
      k.cylX(0.0045, 0.024, 0.03, 0.052, 0.085, steelDark); // alavanca de manejo
      k.box(0.002, 0.012, 0.085, 0.0228, 0.024, 0.02, steelDark, { b: 0.0005, rx: 0.06 }); // seletor
      for (const u of [-0.11, 0.0, 0.18]) for (const sx of [-1, 1]) k.cylX(0.003, 0.002, sx * 0.0225, 0.014, u, steelDark, { seg: 8 }); // rebites
      // alça de mira regulável (dois postes) sobre a caixa
      k.box(0.03, 0.01, 0.03, 0, 0.073, 0.165, gunmetal, { b: 0.002 });
      k.box(0.0065, 0.024, 0.012, -0.0105, 0.09, 0.165, gunmetal, { b: 0.001 });
      k.box(0.0065, 0.024, 0.012, 0.0105, 0.09, 0.165, gunmetal, { b: 0.001 });
      // guarda-mão de madeira (inferior e superior) e tubo de gases
      k.prof([[0.205, 0.006], [0.205, 0.05], [0.43, 0.05], [0.445, 0.04], [0.445, 0.016], [0.41, 0.004]], 0.05, wood, { b: 0.008, bs: 2 });
      k.prof([[0.205, 0.056], [0.205, 0.08], [0.4, 0.08], [0.412, 0.07], [0.412, 0.056]], 0.04, wood, { b: 0.008, bs: 2 });
      for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) k.box(0.0012, 0.006, 0.03, sx * 0.0252, 0.03, 0.26 + i * 0.055, gunmetal, { b: 0 }); // aberturas de ventilação
      k.tube(0.0105, 0.412, 0.535, 0.068, steel);
      k.box(0.024, 0.05, 0.03, 0, 0.052, 0.535, steel, { b: 0.004 }); // bloco de gases
      // cano, base da massa de mira e freio de boca
      k.tube(0.0095, 0.2, 0.675, 0.034, gunmetal);
      k.box(0.02, 0.03, 0.03, 0, 0.046, 0.62, steel, { b: 0.003 });
      k.box(0.003, 0.05, 0.012, -0.0115, 0.08, 0.62, steel, { b: 0.0008 }); // orelhas de proteção
      k.box(0.003, 0.05, 0.012, 0.0115, 0.08, 0.62, steel, { b: 0.0008 });
      k.cylY(0.002, 0.04, 0, 0.082, 0.62, gunmetal, { seg: 8 }); // poste
      k.tube(0.0135, 0.665, 0.705, 0.034, steel, { r2: 0.0115 });
      k.box(0.03, 0.006, 0.012, 0, 0.034, 0.69, gunmetal, { b: 0.001 }); // janelas do freio
      k.disc(0.0062, 0.7052, 0.034, bore);
      k.tube(0.004, 0.42, 0.66, 0.018, steelDark, { seg: 8 }); // vareta de limpeza
      // punho e guarda-mato
      k.prof([[-0.046, -0.008], [-0.004, -0.008], [-0.03, -0.116], [-0.078, -0.114], [-0.066, -0.05]], 0.034, wood, { b: 0.008, bs: 2 });
      triggerGuard(k, -0.01, 0.062, -0.009, -0.05, steel, steelDark);
      // carregador curvo
      out.mag = sub((s) => {
        s.prof([[0.062, 0.0], [0.128, 0.0], [0.15, -0.06], [0.188, -0.122], [0.23, -0.164], [0.18, -0.194], [0.136, -0.15], [0.1, -0.09], [0.076, -0.03]], 0.027, gunmetal, { b: 0.003 });
        s.prof([[0.084, -0.02], [0.118, -0.02], [0.142, -0.068], [0.178, -0.122], [0.204, -0.148], [0.186, -0.162], [0.15, -0.126], [0.118, -0.076], [0.098, -0.03]], 0.0286, steel, { b: 0.0004 });
      });
      // coronha de madeira (some na mira)
      out.stock.push(sub((s) => {
        s.prof([[-0.13, 0.056], [-0.13, 0.008], [-0.2, -0.008], [-0.385, -0.056], [-0.392, 0.046], [-0.38, 0.052], [-0.2, 0.058]], 0.04, wood, { b: 0.009, bs: 2 });
        s.prof([[-0.386, -0.058], [-0.398, -0.056], [-0.404, 0.046], [-0.392, 0.05]], 0.042, steel, { b: 0.002 });
      }));
      out.sightY = 0.1025;
      out.muzzle.position.set(0, 0.034, -0.71);
      break;
    }
    // ============================================================ Kestrel M7
    case 'ar2': {
      const acc = mat('gunmetal', md.accent);
      const poly = mat('polymer', md.body);
      // caixas superior e inferior
      k.prof([[-0.11, 0.022], [-0.11, 0.07], [0.195, 0.07], [0.195, 0.022]], 0.042, gunmetal, { b: 0.005 });
      k.prof([[-0.11, 0.024], [-0.11, -0.004], [-0.05, -0.012], [0.032, -0.012], [0.036, -0.032], [0.108, -0.032], [0.118, 0.024]], 0.04, gunmetal, { b: 0.004 });
      k.box(0.0012, 0.016, 0.06, 0.0212, 0.05, 0.07, steelDark, { b: 0 }); // janela de ejeção
      k.prof([[0.0, 0.04], [0.012, 0.06], [0.03, 0.06], [0.03, 0.04]], 0.008, gunmetal, { b: 0.001, x: 0.024 }); // defletor
      k.cylX(0.0065, 0.016, 0.027, 0.05, -0.075, gunmetal, { seg: 12 }); // auxiliar de fechamento
      k.box(0.03, 0.008, 0.02, 0, 0.073, -0.118, steelDark, { b: 0.002 }); // alavanca de manejo
      k.box(0.002, 0.008, 0.03, -0.0212, 0.008, -0.03, steelDark, { b: 0.0005, rx: -0.3 }); // seletor
      k.cylX(0.0035, 0.044, 0, 0.012, 0.1, steelDark, { seg: 10 }); // pinos
      k.cylX(0.0035, 0.044, 0, 0.012, -0.09, steelDark, { seg: 10 });
      // trilho superior contínuo
      k.prof(railPts(-0.1, 0.47, 0.07, 0.0782), 0.02, gunmetal, { b: 0 });
      // guarda-mão octogonal com fendas
      k.prof([[0.195, 0.008], [0.195, 0.07], [0.475, 0.07], [0.475, 0.008]], 0.046, acc, { b: 0.012, bs: 1 });
      for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) k.box(0.0012, 0.008, 0.03, sx * 0.0232, 0.039, 0.225 + i * 0.043, steelDark, { b: 0 });
      for (let i = 0; i < 6; i++) k.box(0.014, 0.0012, 0.03, 0, 0.0076, 0.225 + i * 0.043, steelDark, { b: 0 });
      // cano e quebra-chamas
      k.tube(0.009, 0.19, 0.645, 0.038, gunmetal);
      k.tube(0.0125, 0.635, 0.7, 0.038, steelDark, { seg: 16 });
      for (let i = 0; i < 4; i++) k.box(0.027, 0.004, 0.026, 0, 0.038, 0.672, gunmetal, { b: 0, rz: (i * Math.PI) / 4 });
      k.disc(0.006, 0.7003, 0.038, bore);
      // punho, guarda-mato
      k.prof([[-0.052, -0.01], [-0.008, -0.01], [-0.022, -0.112], [-0.07, -0.108], [-0.062, -0.05]], 0.032, poly, { b: 0.007, bs: 2 });
      triggerGuard(k, -0.006, 0.036, -0.011, -0.048, gunmetal, steelDark);
      // carregador de polímero
      out.mag = sub((s) => {
        s.prof([[0.04, -0.02], [0.103, -0.02], [0.128, -0.165], [0.066, -0.178]], 0.026, poly, { b: 0.004 });
        for (let i = 0; i < 4; i++) s.box(0.0272, 0.004, 0.05, 0, -0.07 - i * 0.026, 0.08 + i * 0.0045, polyDark, { b: 0, rx: 0.17 });
        s.box(0.03, 0.008, 0.07, 0, -0.176, 0.097, polyDark, { b: 0.002, rx: 0.2 });
      });
      // tubo e coronha regulável (somem na mira)
      out.stock.push(sub((s) => {
        s.tube(0.0135, -0.31, -0.11, 0.046, gunmetal);
        s.prof([[-0.19, 0.068], [-0.19, 0.022], [-0.24, 0.018], [-0.33, -0.046], [-0.366, -0.046], [-0.366, 0.068]], 0.036, poly, { b: 0.006, holes: [[[-0.262, 0.012], [-0.335, -0.034], [-0.35, -0.034], [-0.35, 0.012]]] });
        s.box(0.038, 0.116, 0.006, 0, 0.011, -0.369, rubber, { b: 0.002 });
      }));
      holoSight(k, 0.045, 0.116, gunmetal, 0x30ff80);
      k.box(0.026, 0.02, 0.04, 0, 0.088, 0.045, gunmetal, { b: 0.002 }); // suporte elevado da mira
      // miras rebatíveis de reserva
      k.box(0.018, 0.006, 0.03, 0, 0.081, 0.44, steelDark, { b: 0.001 });
      k.box(0.018, 0.006, 0.03, 0, 0.081, -0.07, steelDark, { b: 0.001 });
      out.sightY = 0.116;
      out.muzzle.position.set(0, 0.038, -0.705);
      break;
    }
    // ============================================================ Longinus .338
    case 'sniper': {
      const chassis = mat('polymer', md.body);
      const steel = mat('steel', 0x2e3136);
      // chassi (leito da ação e guarda-mão)
      k.prof([[0.34, 0.016], [0.34, 0.044], [-0.1, 0.044], [-0.1, 0.0], [0.0, -0.012], [0.06, -0.012], [0.09, 0.004], [0.3, 0.004]], 0.05, chassis, { b: 0.008, bs: 2 });
      for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) k.box(0.0012, 0.01, 0.034, sx * 0.0252, 0.024, 0.16 + i * 0.05, polyDark, { b: 0 });
      // ação, cano pesado e freio de boca
      k.tube(0.0205, -0.1, 0.21, 0.056, steel, { seg: 24 });
      k.box(0.0012, 0.014, 0.07, 0.0205, 0.058, 0.07, gunmetal, { b: 0 });
      k.tube(0.0145, 0.21, 0.73, 0.056, gunmetal, { r2: 0.0115 });
      k.box(0.03, 0.026, 0.075, 0, 0.056, 0.765, steel, { b: 0.006 });
      for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) k.box(0.0012, 0.014, 0.01, sx * 0.0152, 0.056, 0.745 + i * 0.02, bore, { b: 0 });
      k.disc(0.0065, 0.8028, 0.056, bore);
      // trilho e luneta
      k.prof(railPts(-0.08, 0.2, 0.076, 0.082), 0.02, gunmetal, { b: 0 });
      for (const u of [-0.01, 0.13]) {
        k.box(0.03, 0.022, 0.022, 0, 0.092, u, gunmetal, { b: 0.003 });
        k.tube(0.0195, u - 0.011, u + 0.011, 0.118, gunmetal, { seg: 20 });
      }
      k.tube(0.0155, -0.1, 0.22, 0.118, steel, { seg: 20 });
      k.tube(0.0155, 0.22, 0.27, 0.118, steel, { r2: 0.028, seg: 24 });
      k.tube(0.028, 0.27, 0.34, 0.118, steel, { seg: 24 });
      k.tube(0.0155, -0.15, -0.1, 0.118, steel, { r2: 0.0155, seg: 20 });
      k.tube(0.022, -0.185, -0.15, 0.118, steel, { r2: 0.0155, seg: 24 });
      k.tube(0.0235, -0.2, -0.185, 0.118, rubber, { seg: 24 });
      k.disc(0.0255, 0.338, 0.118, mat('glass', 0x16324a));
      k.disc(0.019, -0.199, 0.118, mat('glass', 0x16324a), { back: true });
      k.cylY(0.011, 0.022, 0, 0.142, 0.06, steel); // torres de regulagem
      k.cylY(0.0118, 0.006, 0, 0.154, 0.06, gunmetal);
      k.cylX(0.011, 0.022, 0.024, 0.118, 0.06, steel);
      k.cylX(0.0118, 0.006, 0.036, 0.118, 0.06, gunmetal);
      // punho vertical e guarda-mato
      k.prof([[-0.058, -0.004], [-0.012, -0.012], [-0.02, -0.118], [-0.07, -0.118], [-0.066, -0.05]], 0.034, chassis, { b: 0.008, bs: 2 });
      k.box(0.0352, 0.06, 0.03, 0, -0.07, -0.044, rubber, { b: 0.004 });
      triggerGuard(k, -0.008, 0.06, -0.011, -0.048, gunmetal, steelDark);
      // bipé recolhido sob o guarda-mão
      k.box(0.03, 0.012, 0.03, 0, 0.0, 0.3, gunmetal, { b: 0.003 });
      for (const sx of [-1, 1]) {
        k.tube(0.005, 0.3, 0.5, -0.004, steelDark, { x: sx * 0.014, seg: 10 });
        k.box(0.012, 0.008, 0.02, sx * 0.014, -0.004, 0.505, rubber, { b: 0.002 });
      }
      // ferrolho com manopla esférica
      out.slide = sub((s) => {
        s.box(0.03, 0.007, 0.007, 0.034, 0.046, -0.06, steelDark, { b: 0.001, rz: -0.5 });
        s.sphere(0.0115, 0.05, 0.036, -0.06, polyDark);
        s.tube(0.0125, -0.125, -0.1, 0.056, steelDark, { seg: 16 });
      });
      out.mag = sub((s) => {
        s.box(0.03, 0.062, 0.09, 0, -0.03, 0.125, gunmetal, { b: 0.004 });
        s.box(0.032, 0.006, 0.094, 0, -0.063, 0.125, polyDark, { b: 0.002 });
      });
      // coronha com apoio de rosto e soleira (some na mira)
      out.stock.push(sub((s) => {
        s.prof([[-0.1, 0.044], [-0.14, 0.05], [-0.4, 0.05], [-0.42, 0.04], [-0.42, -0.064], [-0.39, -0.07], [-0.31, -0.03], [-0.16, -0.012], [-0.1, 0.0]], 0.046, chassis, { b: 0.01, bs: 2, holes: [[[-0.18, 0.03], [-0.3, 0.03], [-0.3, 0.0], [-0.18, 0.006]]] });
        s.prof([[-0.17, 0.05], [-0.18, 0.082], [-0.34, 0.082], [-0.35, 0.05]], 0.036, polyDark, { b: 0.008, bs: 2 });
        s.box(0.048, 0.118, 0.014, 0, -0.012, -0.428, rubber, { b: 0.004 });
      }));
      out.sightY = 0.118;
      out.muzzle.position.set(0, 0.056, -0.81);
      break;
    }
    // ============================================================ Bulldog 12
    case 'shotgun': {
      const wood = mat('wood', 0xffffff);
      const steel = mat('steel', 0x2c2f33);
      // caixa da culatra
      k.prof([[-0.1, -0.004], [-0.1, 0.06], [-0.084, 0.07], [0.205, 0.07], [0.205, 0.0], [0.06, -0.008]], 0.046, steel, { b: 0.006, bs: 2 });
      k.box(0.0012, 0.02, 0.075, 0.0232, 0.046, 0.08, gunmetal, { b: 0 }); // janela de ejeção
      k.box(0.03, 0.0012, 0.08, 0, -0.0062, 0.11, gunmetal, { b: 0 }); // janela de carregamento
      for (const u of [-0.06, 0.16]) k.cylX(0.0035, 0.048, 0, 0.02, u, steelDark, { seg: 10 });
      // cano com nervura ventilada e tubo do carregador
      k.tube(0.0138, 0.205, 0.672, 0.052, gunmetal);
      k.disc(0.0105, 0.6722, 0.052, bore);
      k.prof([[0.205, 0.066], [0.205, 0.0745], [0.662, 0.0745], [0.668, 0.066]], 0.009, gunmetal, { b: 0.001 });
      for (let i = 0; i < 9; i++) k.box(0.0095, 0.004, 0.03, 0, 0.068, 0.24 + i * 0.047, steelDark, { b: 0 });
      k.sphere(0.0036, 0, 0.0778, 0.655, brass); // massa de mira
      k.tube(0.0128, 0.205, 0.6, 0.019, steel);
      k.tube(0.0142, 0.6, 0.618, 0.019, gunmetal, { r2: 0.011 });
      k.box(0.034, 0.056, 0.014, 0, 0.036, 0.565, steel, { b: 0.003 }); // braçadeira
      // punho de madeira e guarda-mato
      k.prof([[-0.1, 0.002], [-0.02, -0.01], [-0.034, -0.06], [-0.06, -0.118], [-0.106, -0.11], [-0.1, -0.05]], 0.036, wood, { b: 0.009, bs: 2 });
      triggerGuard(k, -0.012, 0.062, -0.009, -0.05, steel, steelDark);
      // porta-cartuchos lateral
      k.box(0.006, 0.03, 0.11, -0.026, 0.036, 0.05, polyDark, { b: 0.002 });
      const shell = mat('polymer', 0xa02a22);
      for (let i = 0; i < 4; i++) {
        k.cylY(0.0088, 0.04, -0.034, 0.048, 0.012 + i * 0.026, shell, { seg: 12 });
        k.cylY(0.0092, 0.012, -0.034, 0.024, 0.012 + i * 0.026, brass, { seg: 12 });
      }
      // telha (bomba) de madeira com ranhuras
      out.pump = sub((s) => {
        s.prof([[0.27, -0.006], [0.27, 0.036], [0.45, 0.036], [0.45, -0.002], [0.43, -0.008]], 0.05, wood, { b: 0.01, bs: 2 });
        for (let i = 0; i < 7; i++) for (const sx of [-1, 1]) s.box(0.0012, 0.03, 0.006, sx * 0.0252, 0.014, 0.295 + i * 0.022, gunmetal, { b: 0 });
        s.box(0.006, 0.008, 0.2, 0.018, 0.03, 0.26, steelDark, { b: 0.001 }); // barra de ação
      });
      // coronha (some na mira)
      out.stock.push(sub((s) => {
        s.prof([[-0.1, 0.058], [-0.1, 0.004], [-0.17, -0.014], [-0.37, -0.072], [-0.378, 0.034], [-0.34, 0.046]], 0.04, wood, { b: 0.01, bs: 2 });
        s.prof([[-0.37, -0.074], [-0.386, -0.07], [-0.394, 0.03], [-0.378, 0.036]], 0.042, rubber, { b: 0.003 });
      }));
      out.sightY = 0.0815;
      out.muzzle.position.set(0, 0.052, -0.68);
      break;
    }
    // ============================================================ Katana / Nodachi
    case 'katana':
    case 'nodachi': {
      const long = md.type === 'nodachi';
      const L = long ? 1.0 : 0.72; // lâmina
      const hl = long ? 0.34 : 0.26; // empunhadura
      const sori = long ? 0.06 : 0.045; // curvatura
      const steel = mat('steel', md.body, { env: 1.5 });
      const edge = mat('steel', 0xffffff, { env: 2.2, e: 1 });
      const gold = mat('brass', 0xb8913a);
      const u0 = 0.085;
      const curve = (t) => sori * t * t; // elevação do dorso ao longo da lâmina
      const hgt = (t) => 0.034 - 0.009 * t; // altura da lâmina
      const N = 16;
      const back = [], mid = [], cut = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const u = u0 + t * L;
        const top = 0.02 + curve(t);
        back.push([u, top]);
        // linha de têmpera (hamon) ondulada separa o corpo do fio
        mid.push([u, top - hgt(t) * (0.56 + 0.07 * Math.sin(t * 34))]);
        cut.push([u, top - hgt(t)]);
      }
      const tip = [u0 + L + 0.03, 0.02 + curve(1) + 0.002]; // ponta (kissaki)
      k.prof([...back, tip, ...mid.slice().reverse()], 0.0075, steel, { b: 0.0024 });
      k.prof([...mid, tip, ...cut.slice().reverse()], 0.0068, edge, { b: 0.0032 });
      // colar, guarda vazada, espaçadores
      k.prof([[u0 - 0.026, -0.016], [u0 - 0.026, 0.021], [u0 + 0.004, 0.021], [u0 + 0.004, -0.014]], 0.011, gold, { b: 0.002 });
      const ring = [], hole1 = [], hole2 = [];
      for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; ring.push([Math.cos(a) * 0.043, Math.sin(a) * 0.046]); }
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; hole1.push([Math.cos(a) * 0.009 + 0.024, Math.sin(a) * 0.012]); hole2.push([Math.cos(a) * 0.009 - 0.024, Math.sin(a) * 0.012]); }
      k.fprof(ring, u0 - 0.034, u0 - 0.027, mat('gunmetal', 0x2a2420), { y: 0.002, b: 0.0015, holes: [hole1, hole2] });
      k.fprof(ring.map(([x, y]) => [x * 0.5, y * 0.56]), u0 - 0.037, u0 - 0.034, gold, { y: 0.002, b: 0.0008 });
      // empunhadura trançada, enfeite e pomo
      k.prof([[u0 - 0.037, -0.017], [u0 - 0.037, 0.019], [u0 - 0.037 - hl, 0.017], [u0 - 0.037 - hl, -0.015]], 0.027, mat('ito', md.accent), { b: 0.007, bs: 2 });
      for (const sx of [-1, 1]) k.box(0.002, 0.008, 0.03, sx * 0.0138, 0.001, u0 - 0.037 - hl * 0.42, gold, { b: 0.0008 });
      k.prof([[u0 - 0.035 - hl, -0.017], [u0 - 0.035 - hl, 0.019], [u0 - 0.055 - hl, 0.016], [u0 - 0.055 - hl, -0.014]], 0.029, gold, { b: 0.006, bs: 2 });
      out.muzzle.position.set(0, 0.02 + curve(1), -(u0 + L));
      out.sightY = 0.05;
      break;
    }
    // ============================================================ Manoplas Fulgor
    case 'gauntlet': {
      const body = mat('polymer', md.body);
      const plate = mat('steel', 0x6d7686);
      const dark = mat('gunmetal', 0x15171b);
      const glow = mat('glow', md.accent);
      out.muzzles = [];
      out.glows = [];
      for (const side of [-1, 1]) {
        const x = side * 0.13;
        const kk = new Kit();
        // bracelete blindado, afunilando para o punho
        kk.prof([[-0.23, -0.07], [-0.23, 0.012], [-0.2, 0.024], [0.0, 0.014], [0.04, 0.002], [0.04, -0.058], [0.0, -0.07]], 0.088, body, { b: 0.014, bs: 2, x });
        // placas sobrepostas no dorso
        kk.prof([[-0.215, 0.024], [-0.2, 0.036], [-0.12, 0.032], [-0.11, 0.02]], 0.07, plate, { b: 0.006, x });
        kk.prof([[-0.125, 0.02], [-0.11, 0.032], [-0.03, 0.026], [-0.02, 0.014]], 0.064, plate, { b: 0.006, x });
        kk.box(0.092, 0.012, 0.03, x, -0.03, -0.21, plate, { b: 0.003 }); // cinta
        kk.box(0.092, 0.012, 0.022, x, -0.03, 0.01, plate, { b: 0.003 });
        // dorso da mão, proteção dos nós e dedos articulados
        kk.prof([[0.04, -0.056], [0.04, 0.0], [0.115, -0.006], [0.128, -0.02], [0.128, -0.05]], 0.082, body, { b: 0.01, bs: 2, x });
        kk.prof([[0.06, 0.0], [0.075, 0.012], [0.12, 0.006], [0.128, -0.008]], 0.074, plate, { b: 0.005, x });
        for (let f = 0; f < 4; f++) {
          const fx = x - 0.028 + f * 0.0187;
          kk.box(0.0165, 0.02, 0.04, fx, -0.03, 0.146, plate, { b: 0.004, rx: 0.5 });
          kk.box(0.0155, 0.018, 0.034, fx, -0.052, 0.156, dark, { b: 0.004, rx: 1.35 });
        }
        kk.box(0.02, 0.022, 0.05, x - side * 0.048, -0.04, 0.09, plate, { b: 0.005, ry: side * 0.5 }); // polegar
        // projetor de luz sobre o punho
        kk.box(0.05, 0.016, 0.07, x, 0.03, 0.03, dark, { b: 0.004 });
        kk.tube(0.021, -0.03, 0.12, 0.052, dark, { x, seg: 20 });
        kk.tube(0.025, 0.12, 0.15, 0.052, plate, { x, r2: 0.028, seg: 20 });
        kk.disc(0.0235, 0.1505, 0.052, mat('glow', md.accent, { power: 1.6 }), { x });
        kk.disc(0.012, 0.1508, 0.052, mat('glow', 0xd8fbff, { power: 1.4 }), { x });
        for (let i = 0; i < 3; i++) kk.tube(0.0232, 0.0 + i * 0.036, 0.008 + i * 0.036, 0.052, glow, { x, seg: 20 }); // bobinas
        for (const fx of [-1, 1]) kk.box(0.003, 0.03, 0.09, x + fx * 0.026, 0.056, 0.045, plate, { b: 0.001 }); // aletas
        // condutos de energia
        kk.box(0.011, 0.005, 0.15, x, 0.0375, -0.12, glow, { b: 0.0015 });
        kk.box(0.005, 0.03, 0.006, x + side * 0.0445, -0.03, -0.06, glow, { b: 0.0015 });
        kk.box(0.005, 0.03, 0.006, x + side * 0.0445, -0.03, -0.14, glow, { b: 0.0015 });
        kk.cylX(0.012, 0.09, x, -0.03, -0.1, dark, { seg: 14 });
        const grp = kk.build();
        g.add(grp);
        const mz = new THREE.Object3D();
        mz.position.set(x, 0.052, -0.17);
        g.add(mz);
        out.muzzles.push(mz);
      }
      out.muzzle = out.muzzles[1];
      out.sightY = 0.0;
      break;
    }
    default: {
      k.box(0.05, 0.07, 0.4, 0, 0.03, 0.1, gunmetal);
      out.muzzle.position.set(0, 0.03, -0.32);
    }
  }
  k.build(g);
  if (md.type !== 'gauntlet') g.add(out.muzzle);
  return out;
}

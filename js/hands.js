// Mãos enluvadas articuladas para a visão em primeira pessoa.
//
// Cada mão é um esqueleto simples (palma, quatro dedos com três falanges e polegar) montado com
// Object3D. Os dedos se fecham junta por junta até encostar na superfície da arma, descrita por
// funções de distância (SDF): assim a pegada se adapta a guarda-mãos, punhos e cabos diferentes
// sem posições ajustadas dedo a dedo. A malha final é unida por material em poucas peças.
//
// Convenção do modelo de mão (sempre construída como mão DIREITA): +Z aponta para as pontas dos
// dedos, +Y é o dorso, +X é o lado do polegar e do indicador. A mão esquerda é o espelho da
// direita em relação ao plano central da arma (x = 0).
import * as THREE from 'three';
import { Kit } from './guns.js';
import { mulberry32 } from './utils.js';

// ---------------------------------------------------------------- texturas da luva
const texCache = new Map();
function tex(key, size, draw, srgb = true) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

// trama de tecido sintético (cor) com leve variação
function weave(ctx, s, base, rng) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y += 2) {
    ctx.fillStyle = `rgba(255,255,255,${0.025 + rng() * 0.02})`;
    ctx.fillRect(0, y, s, 1);
  }
  for (let x = 0; x < s; x += 2) {
    ctx.fillStyle = `rgba(0,0,0,${0.05 + rng() * 0.03})`;
    ctx.fillRect(x, 0, 1, s);
  }
  for (let i = 0; i < s * 1.5; i++) {
    ctx.fillStyle = `rgba(${rng() < 0.5 ? '0,0,0' : '255,255,255'},${rng() * 0.05})`;
    ctx.fillRect(rng() * s, rng() * s, 2 + rng() * 5, 1);
  }
}

// costura lateral pespontada (nos dedos, as coordenadas u dão a volta no cilindro)
function seam(ctx, s, u, dark = 'rgba(0,0,0,0.55)', light = 'rgba(200,200,190,0.35)') {
  const x = u * s;
  ctx.fillStyle = dark;
  ctx.fillRect(x - 2, 0, 4, s);
  ctx.fillStyle = light;
  for (let y = 0; y < s; y += 8) ctx.fillRect(x - 0.75, y, 1.5, 5);
}

const fingerMap = (hex) => tex(`hf${hex}`, 128, (ctx, s) => {
  const rng = mulberry32(5);
  weave(ctx, s, hex, rng);
  seam(ctx, s, 0.25);
  seam(ctx, s, 0.75);
});
const backMap = (hex) => tex(`hb${hex}`, 128, (ctx, s) => {
  const rng = mulberry32(9);
  weave(ctx, s, hex, rng);
});
// relevo: trama fina para o tecido, granulado para borracha e couro sintético
const weaveBump = () => tex('hwb', 128, (ctx, s) => {
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y += 2) for (let x = 0; x < s; x += 2) {
    ctx.fillStyle = (x + y) % 4 === 0 ? '#9a9a9a' : '#666666';
    ctx.fillRect(x, y, 2, 2);
  }
  seam(ctx, s, 0.25, '#3a3a3a', '#c0c0c0');
  seam(ctx, s, 0.75, '#3a3a3a', '#c0c0c0');
}, false);
const grainBump = () => tex('hgb', 128, (ctx, s) => {
  const rng = mulberry32(17);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 2600; i++) {
    const v = 90 + Math.floor(rng() * 80);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.beginPath(); ctx.arc(rng() * s, rng() * s, 0.6 + rng() * 1.4, 0, 7); ctx.fill();
  }
}, false);
// velcro e elástico do punho
const strapMap = () => tex('hst', 64, (ctx, s) => {
  const rng = mulberry32(23);
  ctx.fillStyle = '#1f2123';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(255,255,255,${rng() * 0.07})`; ctx.fillRect(rng() * s, rng() * s, 1, 1); }
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, s, 3); ctx.fillRect(0, s - 3, s, 3);
});

// ---------------------------------------------------------------- materiais
const matCache = new Map();
export function handMaterials(env, glove = '#34363a') {
  const key = glove;
  if (matCache.has(key)) return matCache.get(key);
  const std = (o) => {
    const m = new THREE.MeshStandardMaterial(o);
    m.envMap = env;
    m.envMapIntensity = o.envMapIntensity ?? 0.3;
    return m;
  };
  const m = {
    finger: std({ map: fingerMap(glove), bumpMap: weaveBump(), bumpScale: 0.9, roughness: 0.9, metalness: 0 }),
    back: std({ map: backMap(glove), bumpMap: weaveBump(), bumpScale: 0.7, roughness: 0.9, metalness: 0 }),
    // palma e pontas em couro sintético mais escuro e liso
    palm: std({ color: 0x2a2621, bumpMap: grainBump(), bumpScale: 0.8, roughness: 0.72, metalness: 0, envMapIntensity: 0.45 }),
    // protetores de borracha moldada nos nós dos dedos
    pad: std({ color: 0x17181a, bumpMap: grainBump(), bumpScale: 0.5, roughness: 0.55, metalness: 0, envMapIntensity: 0.6 }),
    strap: std({ map: strapMap(), roughness: 0.95, metalness: 0 }),
  };
  matCache.set(key, m);
  return m;
}

// ---------------------------------------------------------------- distâncias (superfícies da arma)
const _q = new THREE.Vector3();
// caixa arredondada: centro, meias medidas, raio do arredondamento e rotação opcional (Matrix4 inversa)
export function sdBox(center, half, r = 0, inv = null) {
  const c = new THREE.Vector3(...center);
  const h = new THREE.Vector3(...half);
  return (p) => {
    _q.copy(p).sub(c);
    if (inv) _q.applyMatrix4(inv);
    const qx = Math.abs(_q.x) - h.x + r, qy = Math.abs(_q.y) - h.y + r, qz = Math.abs(_q.z) - h.z + r;
    const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
    return Math.hypot(ox, oy, oz) + Math.min(Math.max(qx, qy, qz), 0) - r;
  };
}
// caixa inclinada no plano lateral (punhos): ângulo em torno do eixo X
export function sdTiltBox(center, half, r, angle) {
  const inv = new THREE.Matrix4().makeRotationX(angle).invert();
  return sdBox(center, half, r, inv);
}
export const sdUnion = (...fs) => (p) => { let d = Infinity; for (const f of fs) d = Math.min(d, f(p)); return d; };

// ---------------------------------------------------------------- esqueleto
// dimensões de uma mão enluvada (metros): posição do nó do dedo na palma, falanges e raios
const FINGERS = [
  { x: 0.03, z: 0.047, len: [0.044, 0.026, 0.021], r: [0.0098, 0.0092, 0.0086], splay: 0.07 }, // indicador
  { x: 0.0095, z: 0.05, len: [0.048, 0.029, 0.022], r: [0.0101, 0.0094, 0.0088], splay: 0.0 }, // médio
  { x: -0.0115, z: 0.047, len: [0.045, 0.027, 0.021], r: [0.0097, 0.009, 0.0084], splay: -0.06 }, // anelar
  { x: -0.0305, z: 0.039, len: [0.036, 0.021, 0.019], r: [0.0088, 0.0082, 0.0078], splay: -0.13 }, // mínimo
];
const THUMB = { pos: [0.021, -0.005, -0.03], len: [0.046, 0.032, 0.027], r: [0.0135, 0.0114, 0.0104] };
const PALM = { halfT: 0.0125, back: -0.046, front: 0.048, left: -0.041, right: 0.039 };

function chain(parent, pos, len) {
  const joints = [];
  let p = parent;
  for (let i = 0; i < len.length; i++) {
    const j = new THREE.Object3D();
    j.rotation.order = 'YXZ';
    if (i === 0) j.position.set(...pos); else j.position.set(0, 0, len[i - 1]);
    p.add(j);
    joints.push(j);
    p = j;
  }
  return joints;
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _s = new THREE.Vector3();
// pontos de amostra ao longo de uma falange (no espaço da arma)
function segTouch(j, L, r, sdf, slack) {
  j.updateMatrixWorld(true);
  _a.setFromMatrixPosition(j.matrixWorld);
  _b.set(0, 0, L).applyMatrix4(j.matrixWorld);
  for (const t of [0.35, 0.7, 1]) {
    _s.lerpVectors(_a, _b, t);
    if (sdf(_s) < r + slack) return true;
  }
  return false;
}

// Fecha cada junta até a falange encostar na superfície (ou até o limite da junta).
function wrap(joints, len, r, sdf, o) {
  const max = o.max || [1.75, 1.85, 1.3];
  for (let i = 0; i < joints.length; i++) {
    const j = joints[i];
    let a = o.min?.[i] ?? 0.04;
    j.rotation.x = a;
    if (segTouch(j, len[i], r[i], sdf, o.slack ?? 0.0012)) continue; // já encostado
    const step = 0.035;
    while (a < max[i]) {
      a += step;
      j.rotation.x = a;
      if (segTouch(j, len[i], r[i], sdf, o.slack ?? 0.0012)) { a -= step * 0.5; j.rotation.x = a; break; }
    }
  }
}

/*
 * Monta uma mão (direita) no espaço da arma e adiciona a malha ao kit.
 * pose: {
 *   center: [x,y,z] centro da palma, back: [x,y,z] direção do dorso, thumb: [x,y,z] direção do
 *   lado do polegar, sdf: superfície a envolver,
 *   fingers: { curl?: [[a,b,c] x4] (ângulos fixos, sem envolver), wrap?: true, skip?: [índices] },
 *   index: { fixed: [a,b,c], splay } (indicador estendido no gatilho),
 *   thumbRot: [rx, ry, rz] (rotação da base do polegar), thumbCurl: [a,b,c] ou 'wrap',
 *   wrist: [x,y,z] ponto do cotovelo (direção do antebraço), sleeve: comprimento da manga,
 * }
 */
export function buildHand(k, pose, mats, sleeveMat) {
  const root = new THREE.Object3D();
  const Y = new THREE.Vector3(...pose.back).normalize();
  const Xg = new THREE.Vector3(...pose.thumb).normalize();
  const Z = new THREE.Vector3().crossVectors(Xg, Y).normalize();
  const X = new THREE.Vector3().crossVectors(Y, Z).normalize();
  const C = new THREE.Vector3(...pose.center).addScaledVector(Z, -(pose.slide || 0));
  root.matrix.makeBasis(X, Y, Z).setPosition(C);
  root.matrix.decompose(root.position, root.quaternion, root.scale);
  if (pose.scale) root.scale.setScalar(pose.scale);
  root.updateMatrixWorld(true);
  const sdf = pose.sdf || (() => 1);

  // dedos
  const fingerJoints = FINGERS.map((f, i) => {
    const js = chain(root, [f.x, 0.001, f.z], f.len);
    js[0].rotation.y = f.splay * (pose.splay ?? 1);
    if (i === 0 && pose.index) {
      js[0].rotation.y += pose.index.splay || 0;
      pose.index.fixed.forEach((a, n) => (js[n].rotation.x = a));
    } else if (pose.fingers?.curl) {
      pose.fingers.curl[i].forEach((a, n) => (js[n].rotation.x = a));
    } else {
      wrap(js, f.len, f.r, sdf, pose.fingers || {});
    }
    return js;
  });

  // polegar
  const tj = chain(root, THUMB.pos, THUMB.len);
  const tr = pose.thumbRot || [0.35, 0.75, -0.6];
  tj[0].rotation.set(tr[0], tr[1], tr[2], 'YXZ');
  if (pose.thumbCurl === 'wrap') wrap(tj, THUMB.len, THUMB.r, sdf, { min: [tr[0], 0.05, 0.05], max: [tr[0] + 0.9, 0.9, 0.9] });
  else (pose.thumbCurl || [tr[0], 0.25, 0.2]).forEach((a, n) => { if (n > 0 || pose.thumbCurl) tj[n].rotation.x = a; });
  root.updateMatrixWorld(true);

  const put = (g, obj, m) => { obj.updateMatrixWorld(true); g.applyMatrix4(obj.matrixWorld); k.push(g, m); };
  const capsule = (r, L, seg = 10) => {
    const g = new THREE.CapsuleGeometry(r, Math.max(0.001, L - r * 0.2), 5, seg);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, L / 2);
    return g;
  };

  // falanges; protetores nos dorsos das falanges proximais e médias; ponta reforçada
  FINGERS.forEach((f, i) => {
    fingerJoints[i].forEach((j, n) => {
      put(capsule(f.r[n], f.len[n]), j, mats.finger);
      if (n < 2) {
        const pad = new THREE.CapsuleGeometry(f.r[n] * 0.62, f.len[n] * (n === 0 ? 0.36 : 0.26), 3, 8);
        pad.rotateX(Math.PI / 2);
        pad.scale(1, 0.38, 1);
        pad.translate(0, f.r[n] * 0.8, f.len[n] * 0.5);
        put(pad, j, mats.pad);
      }
      if (n === 2) {
        const tip = new THREE.SphereGeometry(f.r[n] * 1.04, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        tip.rotateX(Math.PI / 2);
        tip.scale(1, 1, 0.9);
        tip.translate(0, -f.r[n] * 0.08, f.len[n] - f.r[n] * 0.35);
        put(tip, j, mats.palm);
      }
    });
  });
  // polegar com reforço de couro na face interna
  tj.forEach((j, n) => {
    put(capsule(THUMB.r[n], THUMB.len[n]), j, n === 0 ? mats.back : mats.finger);
    if (n > 0) {
      const p = new THREE.CapsuleGeometry(THUMB.r[n] * 0.75, THUMB.len[n] * 0.5, 4, 8);
      p.rotateX(Math.PI / 2);
      p.scale(1, 0.55, 1);
      p.translate(-THUMB.r[n] * 0.35, -THUMB.r[n] * 0.45, THUMB.len[n] * 0.5);
      put(p, j, mats.palm);
    }
  });

  // palma: placa arredondada, mais larga nos nós dos dedos
  const sh = new THREE.Shape();
  const { back: zb, front: zf, left: xl, right: xr, halfT } = PALM;
  sh.moveTo(xl + 0.006, -zb);
  sh.lineTo(xr - 0.008, -zb);
  sh.quadraticCurveTo(xr + 0.002, -zb, xr + 0.002, -zb - 0.012);
  sh.lineTo(xr - 0.002, -zf + 0.006);
  sh.quadraticCurveTo(xr - 0.004, -zf - 0.001, xr - 0.016, -zf - 0.002);
  sh.quadraticCurveTo(0.0, -zf - 0.006, xl + 0.012, -zf + 0.006);
  sh.quadraticCurveTo(xl, -zf + 0.012, xl - 0.001, -zf + 0.024);
  sh.lineTo(xl - 0.002, -zb - 0.014);
  sh.quadraticCurveTo(xl - 0.002, -zb, xl + 0.006, -zb);
  const bev = 0.0105;
  const palmG = new THREE.ExtrudeGeometry(sh, { depth: halfT * 2 - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.8, bevelOffset: -bev * 0.55, bevelSegments: 5, curveSegments: 10 });
  palmG.rotateX(-Math.PI / 2);
  palmG.translate(0, -halfT + bev, 0); // (x, -z) do desenho -> (x, z) com a espessura em y
  put(palmG, root, mats.back);
  // face da palma em couro (levemente saliente) e eminência tenar
  const palmFace = new THREE.CapsuleGeometry(0.03, 0.04, 4, 10);
  palmFace.rotateX(Math.PI / 2);
  palmFace.scale(1.15, 0.28, 1.05);
  palmFace.translate(0.0, -halfT * 0.7, -0.002);
  put(palmFace, root, mats.palm);
  const thenar = new THREE.SphereGeometry(0.019, 12, 10);
  thenar.scale(1, 0.75, 1.5);
  thenar.translate(0.019, -0.006, -0.022);
  put(thenar, root, mats.palm);
  // protetor rígido dos nós e placa do dorso
  const knuckle = new THREE.CapsuleGeometry(0.0105, 0.05, 4, 12);
  knuckle.rotateZ(Math.PI / 2);
  knuckle.scale(1, 0.62, 1);
  knuckle.rotateY(-0.12);
  knuckle.translate(-0.001, halfT * 0.95, 0.039);
  put(knuckle, root, mats.pad);
  for (const f of FINGERS) {
    const b = new THREE.SphereGeometry(f.r[0] * 0.95, 10, 8);
    b.scale(1, 0.75, 1);
    b.translate(f.x, halfT * 0.85, f.z - 0.002);
    put(b, root, mats.pad);
  }
  // arco do dorso (metacarpos) e painel acolchoado discreto
  const dome = new THREE.SphereGeometry(0.036, 16, 10);
  dome.scale(1.05, 0.26, 1.25);
  dome.translate(-0.002, halfT * 0.55, 0.004);
  put(dome, root, mats.back);
  const panel = new THREE.SphereGeometry(0.02, 14, 8);
  panel.scale(1.1, 0.22, 1.25);
  panel.translate(-0.004, halfT + 0.0035, 0.004);
  put(panel, root, mats.pad);
  // punho da luva com tira de velcro e puxador
  const cuff = new THREE.CylinderGeometry(0.031, 0.034, 0.05, 18, 1, true);
  cuff.rotateX(Math.PI / 2);
  cuff.scale(1.18, 0.82, 1);
  cuff.translate(0, -0.001, zb - 0.017);
  put(cuff, root, mats.back);
  const strap = new THREE.CylinderGeometry(0.0335, 0.0345, 0.022, 18);
  strap.rotateX(Math.PI / 2);
  strap.scale(1.18, 0.84, 1);
  strap.translate(0, -0.001, zb - 0.03);
  put(strap, root, mats.strap);
  const tab = new THREE.CapsuleGeometry(0.009, 0.016, 3, 8);
  tab.rotateZ(Math.PI / 2);
  tab.scale(1, 0.4, 1);
  tab.translate(0.01, 0.0295, zb - 0.03);
  put(tab, root, mats.pad);

  // antebraço: o punho da luva se prolonga sobre o pulso e a manga começa logo depois
  if (pose.elbow && sleeveMat) {
    const sc = pose.scale || 1;
    const wrist = new THREE.Vector3(0, -0.001, zb - 0.03).applyMatrix4(root.matrixWorld);
    const dir = new THREE.Vector3(...pose.elbow).sub(wrist).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    const along = (g, z0) => { g.applyQuaternion(q); g.translate(wrist.x + dir.x * z0, wrist.y + dir.y * z0, wrist.z + dir.z * z0); return g; };
    const tube = (r0, r1, len, seg = 16) => {
      const g = new THREE.CylinderGeometry(r1 * sc, r0 * sc, len, seg, 1, false);
      g.rotateX(Math.PI / 2); // eixo do cilindro -> +Z (r0 no início)
      g.scale(1.14, 0.9, 1);
      g.translate(0, 0, len / 2);
      return g;
    };
    k.push(along(tube(0.03, 0.031, 0.05 * sc), 0), mats.back); // cano da luva
    k.push(along(tube(0.0315, 0.032, 0.012 * sc), 0.034 * sc), mats.strap); // elástico
    const L = (pose.sleeve || 0.34) * sc;
    k.push(along(tube(0.032, 0.043, L), 0.042 * sc), sleeveMat);
    // dobras do tecido perto do pulso
    for (const [z0, r] of [[0.05, 0.034], [0.075, 0.0365]]) k.push(along(tube(r, r + 0.0015, 0.012 * sc, 14), z0 * sc), sleeveMat);
  }
  return root;
}

// inverte a ordem dos vértices (após espelhamento)
function flipWinding(g) {
  if (g.index) {
    const a = g.index.array;
    for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; }
    g.index.needsUpdate = true;
    return g;
  }
  for (const name of ['position', 'normal', 'uv']) {
    const at = g.attributes[name];
    if (!at) continue;
    const n = at.itemSize, arr = at.array;
    for (let i = 0; i < arr.length; i += n * 3) for (let c = 0; c < n; c++) {
      const t = arr[i + n + c]; arr[i + n + c] = arr[i + 2 * n + c]; arr[i + 2 * n + c] = t;
    }
    at.needsUpdate = true;
  }
  return g;
}

// Espelha as malhas de um grupo em relação ao plano x = 0 (mão direita -> esquerda).
export function mirrorX(group) {
  const M = new THREE.Matrix4().makeScale(-1, 1, 1);
  group.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.applyMatrix4(M);
    flipWinding(o.geometry);
    o.geometry.computeBoundingSphere();
  });
  return group;
}

export { Kit };

// Funções matemáticas e auxiliares sem dependências.

export const DEG = Math.PI / 180;
export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const approach = (v, target, delta) => (v < target ? Math.min(v + delta, target) : Math.max(v - delta, target));
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export function angleDiff(from, to) {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// Gerador pseudoaleatório determinístico (texturas e mapa).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Aproximação gaussiana simples (-1..1, concentrada no centro).
export const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

/*
 * Interseção raio x caixa alinhada aos eixos (método das placas).
 * o, d: arrays [x,y,z]; box: {min:[...], max:[...]}.
 * Retorna t de entrada e eixo/sinal da normal, ou null.
 */
const _hit = { t: 0, axis: -1, sign: 0 };
export function rayAABB(o, d, box, maxT) {
  let tmin = 0;
  let tmax = maxT;
  let axis = -1;
  let sign = 0;
  for (let i = 0; i < 3; i++) {
    const oi = o[i];
    const di = d[i];
    const mn = box.min[i];
    const mx = box.max[i];
    if (Math.abs(di) < 1e-9) {
      if (oi < mn || oi > mx) return null;
    } else {
      const inv = 1 / di;
      let t1 = (mn - oi) * inv;
      let t2 = (mx - oi) * inv;
      let s = -1;
      if (t1 > t2) {
        const tmp = t1; t1 = t2; t2 = tmp; s = 1;
      }
      if (t1 > tmin) { tmin = t1; axis = i; sign = s; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
  }
  _hit.t = tmin;
  _hit.axis = axis;
  _hit.sign = sign;
  return _hit;
}

export function formatTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

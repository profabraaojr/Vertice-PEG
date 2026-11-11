// Texturas procedurais geradas em canvas: nenhum arquivo de imagem externo é necessário.
import * as THREE from 'three';
import { mulberry32 } from './utils.js';

let maxAniso = 4;
export function setAnisotropy(v) { maxAniso = v; }

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(canvas, repeat = true, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function noise(ctx, w, h, rng, amount, alpha = 0.08, size = 2) {
  for (let i = 0; i < amount; i++) {
    const v = Math.floor(rng() * 255);
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha * rng()})`;
    ctx.fillRect(rng() * w, rng() * h, size * (0.5 + rng()), size * (0.5 + rng()));
  }
}

function stains(ctx, w, h, rng, n, color, rmin, rmax) {
  for (let i = 0; i < n; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const r = rmin + rng() * (rmax - rmin);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

// Concreto de parede: painéis, faixa de sujeira na base e arremate no topo.
export function concreteWall(base = '#b9ab95', seed = 1) {
  const w = 512, h = 640;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  noise(ctx, w, h, rng, 9000, 0.1, 2);
  stains(ctx, w, h, rng, 18, 'rgba(70,55,40,0.12)', 30, 120);
  // juntas de painéis
  ctx.strokeStyle = 'rgba(40,32,25,0.35)';
  ctx.lineWidth = 3;
  for (let x = 0; x <= w; x += 256) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(0, h * 0.42); ctx.lineTo(w, h * 0.42); ctx.stroke();
  // furos de forma
  ctx.fillStyle = 'rgba(30,25,20,0.45)';
  for (let x = 64; x < w; x += 128) {
    for (const y of [h * 0.2, h * 0.62]) {
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    }
  }
  // sujeira na base (v=0 corresponde ao chão: parte de baixo do canvas)
  const g = ctx.createLinearGradient(0, h, 0, h * 0.72);
  g.addColorStop(0, 'rgba(60,45,30,0.55)');
  g.addColorStop(1, 'rgba(60,45,30,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, h * 0.72, w, h * 0.28);
  // escorridos
  for (let i = 0; i < 26; i++) {
    const x = rng() * w;
    const len = 40 + rng() * 160;
    ctx.fillStyle = `rgba(55,45,35,${0.05 + rng() * 0.1})`;
    ctx.fillRect(x, h * 0.06, 2 + rng() * 4, len);
  }
  // arremate superior
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, 0, w, h * 0.05);
  return toTexture(c);
}

// Tijolo aparente, usado em paredes internas.
export function brickWall(seed = 2) {
  const w = 512, h = 640;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = '#5e4a3c';
  ctx.fillRect(0, 0, w, h);
  const bw = 64, bh = 26;
  for (let row = 0; row * bh < h; row++) {
    const off = (row % 2) * (bw / 2);
    for (let x = -bw; x < w + bw; x += bw) {
      const r = 130 + rng() * 50, gg = 70 + rng() * 25, b = 50 + rng() * 20;
      ctx.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`;
      ctx.fillRect(x + off + 2, row * bh + 2, bw - 4, bh - 4);
    }
  }
  noise(ctx, w, h, rng, 7000, 0.12, 2);
  const g = ctx.createLinearGradient(0, h, 0, h * 0.75);
  g.addColorStop(0, 'rgba(30,20,15,0.6)');
  g.addColorStop(1, 'rgba(30,20,15,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, h * 0.75, w, h * 0.25);
  return toTexture(c);
}

// Chão externo: areia compactada com marcas e fissuras.
export function groundSand(seed = 3) {
  const s = 512;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = '#a88f6c';
  ctx.fillRect(0, 0, s, s);
  stains(ctx, s, s, rng, 40, 'rgba(120,95,65,0.25)', 20, 90);
  stains(ctx, s, s, rng, 25, 'rgba(200,180,150,0.18)', 20, 80);
  noise(ctx, s, s, rng, 20000, 0.12, 1.5);
  ctx.strokeStyle = 'rgba(70,55,40,0.3)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 14; i++) {
    let x = rng() * s, y = rng() * s;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (rng() - 0.5) * 50; y += (rng() - 0.5) * 50; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  for (let i = 0; i < 300; i++) {
    ctx.fillStyle = `rgba(80,65,50,${rng() * 0.4})`;
    ctx.beginPath(); ctx.arc(rng() * s, rng() * s, rng() * 2.5, 0, Math.PI * 2); ctx.fill();
  }
  return toTexture(c);
}

// Piso interno: placas de concreto polido com juntas.
export function floorTiles(seed = 4) {
  const s = 512;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  const n = 4;
  const ts = s / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const v = 120 + rng() * 25;
      ctx.fillStyle = `rgb(${v | 0},${(v - 4) | 0},${(v - 10) | 0})`;
      ctx.fillRect(x * ts, y * ts, ts, ts);
    }
  }
  noise(ctx, s, s, rng, 12000, 0.1, 1.5);
  stains(ctx, s, s, rng, 12, 'rgba(40,35,30,0.2)', 20, 70);
  ctx.strokeStyle = 'rgba(30,28,25,0.6)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= n; i++) {
    ctx.beginPath(); ctx.moveTo(i * ts, 0); ctx.lineTo(i * ts, s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * ts); ctx.lineTo(s, i * ts); ctx.stroke();
  }
  return toTexture(c);
}

// Caixa de madeira com moldura e travessa em X: textura por face.
export function crateWood(seed = 5, tint = [150, 110, 65]) {
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  const [r, g, b] = tint;
  for (let i = 0; i < 6; i++) {
    const k = 0.85 + rng() * 0.3;
    ctx.fillStyle = `rgb(${(r * k) | 0},${(g * k) | 0},${(b * k) | 0})`;
    ctx.fillRect(0, (i * s) / 6, s, s / 6);
    ctx.fillStyle = 'rgba(40,25,10,0.5)';
    ctx.fillRect(0, (i * s) / 6, s, 2);
  }
  for (let i = 0; i < 160; i++) {
    ctx.strokeStyle = `rgba(60,40,20,${rng() * 0.25})`;
    ctx.lineWidth = 1;
    const y = rng() * s;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(s * 0.3, y + rng() * 6 - 3, s * 0.6, y + rng() * 6 - 3, s, y); ctx.stroke();
  }
  const fr = 24;
  ctx.fillStyle = `rgb(${(r * 0.7) | 0},${(g * 0.7) | 0},${(b * 0.7) | 0})`;
  ctx.fillRect(0, 0, s, fr); ctx.fillRect(0, s - fr, s, fr);
  ctx.fillRect(0, 0, fr, s); ctx.fillRect(s - fr, 0, fr, s);
  ctx.save();
  ctx.translate(s / 2, s / 2);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-s * 0.7, -fr / 2, s * 1.4, fr);
  ctx.restore();
  ctx.strokeStyle = 'rgba(30,18,8,0.7)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, s - 2, s - 2);
  ctx.strokeRect(fr, fr, s - fr * 2, s - fr * 2);
  ctx.fillStyle = 'rgba(40,40,40,0.9)';
  for (const [x, y] of [[12, 12], [s - 12, 12], [12, s - 12], [s - 12, s - 12]]) {
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
  }
  noise(ctx, s, s, rng, 2500, 0.12, 1.5);
  return toTexture(c, false);
}

// Contêiner de metal corrugado.
export function containerMetal(color = '#8a3a2e', seed = 6) {
  const w = 512, h = 512;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 32) {
    const g = ctx.createLinearGradient(x, 0, x + 32, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.28)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.12)');
    g.addColorStop(0.65, 'rgba(255,255,255,0.05)');
    g.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 32, h);
  }
  stains(ctx, w, h, rng, 22, 'rgba(90,50,20,0.35)', 10, 60);
  noise(ctx, w, h, rng, 9000, 0.12, 1.5);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, w, 18);
  ctx.fillRect(0, h - 18, w, 18);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(110,60,25,${0.2 + rng() * 0.3})`;
    ctx.fillRect(rng() * w, h - 18 - rng() * 80, 2 + rng() * 3, 10 + rng() * 60);
  }
  return toTexture(c);
}

export function metalPlate(seed = 7) {
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = '#5b5f63';
  ctx.fillRect(0, 0, s, s);
  noise(ctx, s, s, rng, 6000, 0.15, 1.2);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, s - 4, s - 4);
  return toTexture(c);
}

// Faixa de sinalização (preto e amarelo).
export function hazardStripes() {
  const w = 256, h = 64;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d9a514';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1b1b1b';
  for (let x = -h; x < w + h; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x + 24, 0); ctx.lineTo(x + 24 + h, h); ctx.lineTo(x + h, h);
    ctx.closePath(); ctx.fill();
  }
  const rng = mulberry32(9);
  noise(ctx, w, h, rng, 1500, 0.25, 1.5);
  return toTexture(c);
}

export function roofTex(seed = 8) {
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = '#6d6a63';
  ctx.fillRect(0, 0, s, s);
  for (let x = 0; x < s; x += 16) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x, 0, 3, s);
  }
  noise(ctx, s, s, rng, 4000, 0.12, 1.5);
  return toTexture(c);
}

// Marca de bala para os decalques.
export function bulletHole() {
  const s = 64;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.18, 'rgba(10,8,6,0.95)');
  g.addColorStop(0.32, 'rgba(40,32,25,0.6)');
  g.addColorStop(1, 'rgba(40,32,25,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return toTexture(c, false);
}

// Clarão do cano (estrela) para sprites aditivos.
export function muzzleFlash() {
  const s = 128;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const cx = s / 2;
  const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  g.addColorStop(0, 'rgba(255,250,220,1)');
  g.addColorStop(0.2, 'rgba(255,200,90,0.9)');
  g.addColorStop(0.5, 'rgba(255,120,30,0.35)');
  g.addColorStop(1, 'rgba(255,80,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  const spikes = 7;
  for (let i = 0; i <= spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? cx : cx * 0.35;
    const x = cx + Math.cos(a) * r;
    const y = cx + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  return toTexture(c, false);
}

export function windowGlow() {
  const s = 64;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,240,200,1)');
  g.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return toTexture(c, false);
}

// ---------- texturas dos mapas de selva e de ruínas ----------

// Parede de blocos de pedra irregulares; moss (0..1) cobre a base e as juntas de musgo.
export function stoneBlocks(base = '#b79f7a', seed = 31, moss = 0) {
  const w = 512, h = 640;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = '#3a3229';
  ctx.fillRect(0, 0, w, h);
  const rows = 6;
  const rh = h / rows;
  const col = (k) => {
    const m = /#(..)(..)(..)/.exec(base);
    const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
    return `rgb(${(r * k) | 0},${(g * k) | 0},${(b * k) | 0})`;
  };
  for (let r = 0; r < rows; r++) {
    let x = -(rng() * 60);
    while (x < w) {
      const bw = 90 + rng() * 110;
      ctx.fillStyle = col(0.78 + rng() * 0.36);
      ctx.fillRect(x + 3, r * rh + 3, bw - 6, rh - 6);
      // lascas e desgaste nas quinas
      ctx.fillStyle = 'rgba(40,32,24,0.5)';
      for (let k = 0; k < 3; k++) ctx.fillRect(x + 3 + rng() * (bw - 20), r * rh + 3 + (rng() < 0.5 ? 0 : rh - 12), 8 + rng() * 14, 6);
      x += bw;
    }
  }
  noise(ctx, w, h, rng, 12000, 0.14, 2);
  stains(ctx, w, h, rng, 20, 'rgba(50,40,28,0.16)', 30, 110);
  if (moss > 0) {
    stains(ctx, w, h, rng, Math.round(60 * moss), 'rgba(58,96,40,0.5)', 14, 60);
    const g = ctx.createLinearGradient(0, h, 0, h * 0.5);
    g.addColorStop(0, `rgba(46,84,34,${0.75 * moss})`);
    g.addColorStop(1, 'rgba(46,84,34,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.5, w, h * 0.5);
  } else {
    const g = ctx.createLinearGradient(0, h, 0, h * 0.75);
    g.addColorStop(0, 'rgba(70,52,30,0.5)');
    g.addColorStop(1, 'rgba(70,52,30,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.75, w, h * 0.25);
  }
  return toTexture(c);
}

// Face de rocha ou bloco solto (uma textura por face).
export function rockFace(base = '#7d7a70', seed = 33, moss = 0) {
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, s, s);
  stains(ctx, s, s, rng, 26, 'rgba(30,28,24,0.28)', 14, 70);
  stains(ctx, s, s, rng, 16, 'rgba(230,225,210,0.16)', 10, 50);
  ctx.strokeStyle = 'rgba(25,22,18,0.55)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    let x = rng() * s, y = rng() * s;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (rng() - 0.5) * 80; y += (rng() - 0.5) * 80; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  if (moss > 0) stains(ctx, s, s, rng, Math.round(30 * moss), 'rgba(60,104,40,0.55)', 14, 60);
  noise(ctx, s, s, rng, 5000, 0.16, 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, s, s);
  return toTexture(c, false);
}

// Chão de selva: terra úmida coberta de capim e folhas.
export function jungleGround(seed = 35) {
  const s = 512;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = '#3f5a2a';
  ctx.fillRect(0, 0, s, s);
  stains(ctx, s, s, rng, 40, 'rgba(74,58,34,0.5)', 20, 90);
  stains(ctx, s, s, rng, 40, 'rgba(92,130,52,0.35)', 20, 80);
  for (let i = 0; i < 2600; i++) {
    const x = rng() * s, y = rng() * s;
    ctx.strokeStyle = `rgba(${50 + rng() * 70},${100 + rng() * 80},${30 + rng() * 40},${0.35 + rng() * 0.4})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rng() - 0.5) * 7, y - 3 - rng() * 7); ctx.stroke();
  }
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(${90 + rng() * 60},${70 + rng() * 40},${20 + rng() * 20},0.5)`;
    ctx.beginPath(); ctx.ellipse(rng() * s, rng() * s, 3 + rng() * 4, 1.5 + rng() * 2, rng() * 3, 0, 7); ctx.fill();
  }
  return toTexture(c);
}

// Parede de bambu (cabanas).
export function bambooWall(seed = 37) {
  const w = 512, h = 640;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = '#4a3a22';
  ctx.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 32) {
    const k = 0.85 + rng() * 0.3;
    const g = ctx.createLinearGradient(x, 0, x + 30, 0);
    g.addColorStop(0, `rgb(${(110 * k) | 0},${(96 * k) | 0},${(52 * k) | 0})`);
    g.addColorStop(0.45, `rgb(${(196 * k) | 0},${(176 * k) | 0},${(104 * k) | 0})`);
    g.addColorStop(1, `rgb(${(100 * k) | 0},${(86 * k) | 0},${(46 * k) | 0})`);
    ctx.fillStyle = g;
    ctx.fillRect(x + 1, 0, 30, h);
    ctx.fillStyle = 'rgba(50,38,18,0.7)';
    for (let y = rng() * 120; y < h; y += 110 + rng() * 60) ctx.fillRect(x + 1, y, 30, 4);
  }
  // amarrações de corda
  ctx.fillStyle = 'rgba(70,50,26,0.9)';
  for (const y of [h * 0.18, h * 0.62]) ctx.fillRect(0, y, w, 12);
  noise(ctx, w, h, rng, 6000, 0.12, 2);
  return toTexture(c);
}

// Cobertura de palha.
export function thatch(seed = 39) {
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = '#8f7a44';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 2200; i++) {
    const x = rng() * s, y = rng() * s;
    ctx.strokeStyle = `rgba(${120 + rng() * 80},${100 + rng() * 60},${40 + rng() * 40},${0.4 + rng() * 0.5})`;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rng() - 0.5) * 6, y + 10 + rng() * 16); ctx.stroke();
  }
  return toTexture(c);
}

// Assoalho de tábuas.
export function plankFloor(seed = 41) {
  const s = 512;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  const n = 8;
  for (let i = 0; i < n; i++) {
    const k = 0.8 + rng() * 0.35;
    ctx.fillStyle = `rgb(${(128 * k) | 0},${(94 * k) | 0},${(56 * k) | 0})`;
    ctx.fillRect(0, (i * s) / n, s, s / n);
    ctx.fillStyle = 'rgba(30,20,10,0.7)';
    ctx.fillRect(0, (i * s) / n, s, 3);
    ctx.fillRect(rng() * s, (i * s) / n, 3, s / n);
  }
  noise(ctx, s, s, rng, 9000, 0.12, 2);
  return toTexture(c);
}

// Piso de lajes de pedra (ruínas).
export function flagstones(seed = 43) {
  const s = 512;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = '#4a4034';
  ctx.fillRect(0, 0, s, s);
  const n = 4, ts = s / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = 0.8 + rng() * 0.3;
    ctx.fillStyle = `rgb(${(176 * v) | 0},${(156 * v) | 0},${(120 * v) | 0})`;
    ctx.fillRect(x * ts + 4, y * ts + 4, ts - 8, ts - 8);
  }
  stains(ctx, s, s, rng, 20, 'rgba(60,46,30,0.22)', 20, 80);
  noise(ctx, s, s, rng, 12000, 0.14, 2);
  return toTexture(c);
}

// Céu estrelado (pontos claros em fundo transparente), usado no mapa noturno.
export function starField(seed = 45) {
  const s = 1024;
  const c = makeCanvas(s, s / 2);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  for (let i = 0; i < 900; i++) {
    const a = 0.3 + rng() * 0.7;
    ctx.fillStyle = `rgba(${220 + rng() * 35},${225 + rng() * 30},255,${a})`;
    const r = rng() < 0.06 ? 1.6 : 0.8;
    ctx.beginPath(); ctx.arc(rng() * s, rng() * s * 0.5, r, 0, 7); ctx.fill();
  }
  return toTexture(c, false);
}

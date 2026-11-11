// Colisão de entidades (AABB contra caixas estáticas) e consultas de raio.
import { rayAABB } from './utils.js';

export const GRAVITY = 18;
const EPS = 0.001;
const STEP = 0.32; // degrau máximo vencido sem pular

export class World {
  constructor(boxes) {
    this.boxes = boxes;
    this._o = [0, 0, 0];
    this._d = [0, 0, 0];
    this.hit = { t: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, box: null };
  }

  // Raio contra o cenário. Retorna this.hit (reutilizado) ou null.
  raycast(ox, oy, oz, dx, dy, dz, maxT) {
    const o = this._o, d = this._d;
    o[0] = ox; o[1] = oy; o[2] = oz;
    d[0] = dx; d[1] = dy; d[2] = dz;
    let best = maxT;
    let bestBox = null, axis = -1, sign = 0;
    // chão
    if (dy < -1e-6) {
      const t = -oy / dy;
      if (t > 0 && t < best) { best = t; bestBox = null; axis = 1; sign = 1; }
    }
    let groundHit = axis === 1;
    for (let i = 0; i < this.boxes.length; i++) {
      const b = this.boxes[i];
      const r = rayAABB(o, d, b, best);
      if (r && r.t < best) {
        best = r.t; bestBox = b; axis = r.axis; sign = r.sign; groundHit = false;
      }
    }
    if (best >= maxT) return null;
    const h = this.hit;
    h.t = best;
    h.x = ox + dx * best; h.y = oy + dy * best; h.z = oz + dz * best;
    h.nx = h.ny = h.nz = 0;
    if (axis === 0) h.nx = sign; else if (axis === 1) h.ny = sign; else if (axis === 2) h.nz = sign;
    else { h.nx = -dx; h.ny = -dy; h.nz = -dz; }
    h.box = bestBox;
    h.ground = groundHit;
    return h;
  }

  // Linha de visão livre entre dois pontos.
  clear(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return true;
    return !this.raycast(ax, ay, az, dx / len, dy / len, dz / len, len - 0.05);
  }

  overlapsAny(minX, minY, minZ, maxX, maxY, maxZ) {
    for (let i = 0; i < this.boxes.length; i++) {
      const b = this.boxes[i];
      if (minX < b.max[0] && maxX > b.min[0] && minY < b.max[1] && maxY > b.min[1] && minZ < b.max[2] && maxZ > b.min[2]) return true;
    }
    return false;
  }

  // Move a entidade eixo a eixo, deslizando pelas superfícies.
  move(e, dt) {
    const r = e.radius;
    const boxes = this.boxes;
    const p = e.pos;
    const v = e.vel;
    const wasGround = e.onGround;

    // eixo X
    p.x += v.x * dt;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (p.x - r < b.max[0] && p.x + r > b.min[0] && p.y < b.max[1] && p.y + e.height > b.min[1] && p.z - r < b.max[2] && p.z + r > b.min[2]) {
        const top = b.max[1] - p.y;
        if (wasGround && top <= STEP && !this.overlapsAny(p.x - r, b.max[1] + EPS, p.z - r, p.x + r, b.max[1] + e.height, p.z + r)) {
          p.y = b.max[1];
          continue;
        }
        if (v.x > 0) p.x = b.min[0] - r - EPS;
        else if (v.x < 0) p.x = b.max[0] + r + EPS;
        else p.x = (p.x < (b.min[0] + b.max[0]) / 2) ? b.min[0] - r - EPS : b.max[0] + r + EPS;
        v.x = 0;
      }
    }
    // eixo Z
    p.z += v.z * dt;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (p.x - r < b.max[0] && p.x + r > b.min[0] && p.y < b.max[1] && p.y + e.height > b.min[1] && p.z - r < b.max[2] && p.z + r > b.min[2]) {
        const top = b.max[1] - p.y;
        if (wasGround && top <= STEP && !this.overlapsAny(p.x - r, b.max[1] + EPS, p.z - r, p.x + r, b.max[1] + e.height, p.z + r)) {
          p.y = b.max[1];
          continue;
        }
        if (v.z > 0) p.z = b.min[2] - r - EPS;
        else if (v.z < 0) p.z = b.max[2] + r + EPS;
        else p.z = (p.z < (b.min[2] + b.max[2]) / 2) ? b.min[2] - r - EPS : b.max[2] + r + EPS;
        v.z = 0;
      }
    }
    // eixo Y
    v.y -= GRAVITY * dt;
    p.y += v.y * dt;
    e.onGround = false;
    if (p.y <= 0) { p.y = 0; v.y = 0; e.onGround = true; }
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (p.x - r < b.max[0] && p.x + r > b.min[0] && p.y < b.max[1] && p.y + e.height > b.min[1] && p.z - r < b.max[2] && p.z + r > b.min[2]) {
        if (v.y <= 0) { p.y = b.max[1]; e.onGround = true; } else { p.y = b.min[1] - e.height - EPS; }
        v.y = 0;
      }
    }
    // limites do mapa (segurança)
    if (p.x < -35.5) p.x = -35.5; if (p.x > 35.5) p.x = 35.5;
    if (p.z < -35.5) p.z = -35.5; if (p.z > 35.5) p.z = 35.5;
  }

  // Há espaço para ficar de pé?
  canStand(e, height) {
    const r = e.radius;
    return !this.overlapsAny(e.pos.x - r, e.pos.y + 0.05, e.pos.z - r, e.pos.x + r, e.pos.y + height, e.pos.z + r);
  }
}

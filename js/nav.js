// Navegação dos bots: A* na grade do mapa, com suavização por linha de visão.
import { N, cellToWorld, worldToCell } from './map.js';

const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

export class Nav {
  constructor(walk) {
    this.walk = walk;
    this.size = N;
    const n = N * N;
    this.g = new Float32Array(n);
    this.f = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.state = new Uint8Array(n); // 0 novo, 1 aberto, 2 fechado
    this.open = [];
    this.walkList = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (walk[y][x]) this.walkList.push([x, y]);
  }

  isWalkable(cx, cy) {
    return cx >= 0 && cy >= 0 && cx < N && cy < N && this.walk[cy][cx];
  }

  nearestWalkable(cx, cy) {
    if (this.isWalkable(cx, cy)) return [cx, cy];
    for (let r = 1; r < 6; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (this.isWalkable(cx + dx, cy + dy)) return [cx + dx, cy + dy];
      }
    }
    return null;
  }

  randomCell(filter) {
    for (let i = 0; i < 40; i++) {
      const c = this.walkList[Math.floor(Math.random() * this.walkList.length)];
      if (!filter || filter(c)) return c;
    }
    return this.walkList[Math.floor(Math.random() * this.walkList.length)];
  }

  // Caminho entre posições de mundo -> lista de {x,z}
  find(sx, sz, tx, tz) {
    const s = this.nearestWalkable(worldToCell(sx), worldToCell(sz));
    const t = this.nearestWalkable(worldToCell(tx), worldToCell(tz));
    if (!s || !t) return null;
    const start = s[1] * N + s[0];
    const goal = t[1] * N + t[0];
    const { g, f, parent, state } = this;
    state.fill(0);
    const open = this.open;
    open.length = 0;
    const h = (i) => {
      const x = i % N, y = (i / N) | 0;
      const dx = Math.abs(x - t[0]), dy = Math.abs(y - t[1]);
      return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
    };
    g[start] = 0; f[start] = h(start); parent[start] = -1; state[start] = 1;
    open.push(start);
    let found = false;
    let iter = 0;
    while (open.length && iter++ < 2000) {
      // menor f (lista pequena: busca linear é suficiente)
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
      const cur = open[bi];
      open[bi] = open[open.length - 1];
      open.pop();
      if (cur === goal) { found = true; break; }
      state[cur] = 2;
      const cx = cur % N, cy = (cur / N) | 0;
      for (const [dx, dy, cost] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (!this.isWalkable(nx, ny)) continue;
        if (dx && dy && (!this.isWalkable(cx + dx, cy) || !this.isWalkable(cx, cy + dy))) continue;
        const ni = ny * N + nx;
        if (state[ni] === 2) continue;
        const ng = g[cur] + cost;
        if (state[ni] === 1 && ng >= g[ni]) continue;
        g[ni] = ng; f[ni] = ng + h(ni); parent[ni] = cur;
        if (state[ni] !== 1) { state[ni] = 1; open.push(ni); }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let c = goal; c !== -1; c = parent[c]) cells.push(c);
    cells.reverse();
    const pts = cells.map((c) => ({ x: cellToWorld(c % N), z: cellToWorld((c / N) | 0) }));
    // o último ponto é o alvo exato quando ele é caminhável
    if (this.isWalkable(worldToCell(tx), worldToCell(tz))) pts[pts.length - 1] = { x: tx, z: tz };
    return this.smooth(pts, sx, sz);
  }

  // Linha reta na grade sem atravessar células bloqueadas (considera a largura do bot).
  lineClear(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);
    const steps = Math.ceil(len / 0.3);
    const px = (-dz / (len || 1)) * 0.42, pz = (dx / (len || 1)) * 0.42;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = ax + dx * t, z = az + dz * t;
      if (!this.isWalkable(worldToCell(x + px), worldToCell(z + pz))) return false;
      if (!this.isWalkable(worldToCell(x - px), worldToCell(z - pz))) return false;
    }
    return true;
  }

  smooth(pts, sx, sz) {
    if (pts.length <= 2) return pts;
    const out = [];
    let ax = sx, az = sz;
    let i = 0;
    while (i < pts.length) {
      let far = i;
      for (let j = pts.length - 1; j > i; j--) {
        if (this.lineClear(ax, az, pts[j].x, pts[j].z)) { far = j; break; }
      }
      out.push(pts[far]);
      ax = pts[far].x; az = pts[far].z;
      i = far + 1;
    }
    return out;
  }
}

// Centro de Treinamento: estande de tiro de longa distância e dojô de cortes em bambu.
//
// Estande: alvos de aço com anéis a 25, 50, 100, 150 e 200 m. No modo realista, o projétil
// cai com a gravidade (arma zerada a 100 m) e é desviado pelo vento indicado na biruta.
// Dojô: suportes de bambu cortados pela espada na altura da mira; golpe leve corta na diagonal
// (alternando o lado) e golpe pesado corta na horizontal.
import * as THREE from 'three';
import { settings, saveSettings } from './settings.js';
import { RANGE, cellToWorld } from './map.js';
import { pick, rand, shuffle } from './utils.js';
import * as TX from './textures.js';
import { ballisticsOf, WIND_SCENARIOS } from './wind.js';

const G = 9.81;
const SOUND = 343; // m/s: o "tim" do aço chega depois do disparo nas distâncias longas
const _p = new THREE.Vector3();
const EXTREME = [500, 1000, 1500, 2000];
// birutas maiores ao longo da pista extrema (x, z), legíveis pela luneta
export const EXTREME_SOCKS = [[-34, -417], [36, -777], [-40, -1267], [44, -1777]];
const ZEROS = [100, 200, 300, 500, 800, 1000, 1200, 1500, 2000];
const _n = new THREE.Vector3(0, 0, 1);


export function trainingBest() {
  if (!settings.training || typeof settings.training !== 'object') settings.training = {};
  return settings.training;
}

// face do alvo: anéis numerados (canvas reaproveitado)
let faceTex = null;
function targetFace() {
  if (faceTex) return faceTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  drawFace(c.getContext('2d'), 256);
  faceTex = new THREE.CanvasTexture(c);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  return faceTex;
}
function drawFace(ctx, s, highlight = false) {
  const R = s / 2;
  ctx.clearRect(0, 0, s, s);
  for (let i = 10; i >= 1; i--) {
    ctx.beginPath();
    ctx.arc(R, R, (R * i) / 10, 0, Math.PI * 2);
    ctx.fillStyle = i <= 2 ? '#c8262e' : i % 2 ? '#f1ece0' : (highlight ? '#ff9a4a' : '#2a2d31');
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

export class Training {
  constructor(game, cfg) {
    this.game = game;
    this.cfg = cfg;
    this.area = cfg.area === 'dojo' ? 'dojo' : 'range';
    this.challenge = cfg.variant === 'challenge';
    this.real = cfg.ballistics === 'real';
    // pista extrema: alvos de 500 a 2.000 m além da barreira, impacto com atraso (tempo de voo)
    this.extreme = this.area === 'range' && cfg.lane === 'extreme';
    this.distances = this.extreme ? EXTREME : RANGE.distances;
    this.zeroSel = null; // zeragem escolhida no painel (null = a da arma)
    this.puffs = [];
    this.hidden = [];
    this.objects = [];
    this.timers = [];
    this.plates = [];
    this.stalks = [];
    this.pieces = [];
    this.stats = { shots: 0, hits: 0, points: 0, best: 0, byDist: {} };
    this.cuts = { total: 0, diag: 0, horiz: 0, combo: 0, bestCombo: 0, score: 0, lastT: -9, good: 0, wrong: 0 };
    this.ended = false;
  }

  after(sec, fn) { this.timers.push({ t: this.game.time + sec, fn }); }

  // ---------- montagem ----------
  setup() {
    document.body.classList.add('training');
    this.buildHud();
    if (this.extreme) this.buildExtreme();
    this.buildPlates();
    this.buildStalks();
    if (this.real && this.area === 'range') {
      this.onKey = (e) => { if (e.code === 'KeyZ' && this.game.active && !e.repeat) this.cycleZero(); };
      window.addEventListener('keydown', this.onKey);
    }
    if (this.area === 'range' && this.challenge) {
      // desafio: alvos em ordem de distância, um disparo para cada
      this.queue = [];
      for (const d of this.distances) for (const p of shuffle(this.plates.filter((q) => q.d === d))) this.queue.push(p);
      this.qi = 0;
      this.highlight(this.queue[0]);
    }
    if (this.area === 'dojo' && this.challenge) {
      this.timeLeft = 60;
      this.pickStalk();
    }
    this.render();
  }

  playerStart() {
    if (this.area === 'dojo') return { x: 0, z: cellToWorld(20), yaw: Math.PI };
    return { x: 0, z: RANGE.fireZ - 0.3, yaw: 0 };
  }

  buildPlates() {
    const g = this.game;
    const layout = this.extreme
      ? { 500: [-12, 12], 1000: [-10, 15], 1500: [-26, 8], 2000: [-6, 18] } // ângulos distintos: nenhum alvo encobre outro
      : { 25: [-9, 9], 50: [-7, 7], 100: [-5.5, 5.5], 150: [-1.6, 1.6], 200: [-4, 4] };
    const radius = this.extreme
      ? { 500: 1.0, 1000: 1.5, 1500: 2.0, 2000: 2.6 }
      : { 25: 0.25, 50: 0.3, 100: 0.42, 150: 0.55, 200: 0.7 };
    const post = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.8 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: 0.5, metalness: 0.7 });
    for (const d of this.distances) {
      for (const x of layout[d]) {
        const R = radius[d];
        const z = RANGE.fireZ - d;
        const grp = new THREE.Group();
        grp.position.set(x, 0, z);
        const hingeY = 1.55 + R;
        for (const sx of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08 * (1 + R), hingeY + 0.1, 0.08 * (1 + R)), post);
          leg.position.set(sx * (R + 0.15), (hingeY + 0.1) / 2, 0);
          leg.castShadow = true;
          grp.add(leg);
        }
        const bar = new THREE.Mesh(new THREE.BoxGeometry(2 * R + 0.38, 0.08, 0.08), post);
        bar.position.set(0, hingeY + 0.06, 0);
        grp.add(bar);
        const pivot = new THREE.Group();
        pivot.position.set(0, hingeY, 0);
        grp.add(pivot);
        const chain = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.03), steel);
        chain.position.set(0, -0.1, 0);
        pivot.add(chain);
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.03, 40), [steel, new THREE.MeshStandardMaterial({ map: targetFace(), roughness: 0.7 }), steel]);
        plate.rotation.x = Math.PI / 2;
        plate.position.set(0, -0.2 - R, 0);
        plate.castShadow = true;
        pivot.add(plate);
        const glow = new THREE.Mesh(new THREE.RingGeometry(R * 1.08, R * 1.25, 40), new THREE.MeshBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: 0.9, fog: false, side: THREE.DoubleSide }));
        glow.position.set(0, -0.2 - R, 0.03);
        glow.visible = false;
        pivot.add(glow);
        g.scene.add(grp);
        this.objects.push(grp);
        this.plates.push({ d, x, z, R, cy: hingeY - 0.2 - R, pivot, glow, swing: 0, vel: 0, hits: [] });
      }
    }
  }

  // terreno aberto até 2,7 km, sem a barreira do fundo; neblina e plano de corte da câmera ampliados
  buildExtreme() {
    const g = this.game;
    g.scene.traverse((o) => { if (o.userData.rangeBack && o.visible) { o.visible = false; this.hidden.push(o); } });
    const add = (m) => { g.scene.add(m); this.objects.push(m); return m; };
    const L = 2500, z0 = -240;
    const tex = TX.groundSand(13);
    tex.repeat.set(1600 / 8, L / 8);
    const ground = add(new THREE.Mesh(new THREE.PlaneGeometry(1600, L), new THREE.MeshStandardMaterial({ map: tex, color: 0xb4a682, roughness: 1 })));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, z0 - L / 2);
    // faixas de distância e postes laranja ao lado de cada linha de alvos
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 });
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xff7a2a, roughness: 0.6 });
    for (const d of EXTREME) {
      const z = RANGE.fireZ - d;
      const l = add(new THREE.Mesh(new THREE.PlaneGeometry(60, 0.6), lineMat));
      l.rotation.x = -Math.PI / 2;
      l.position.set(0, 0.03, z);
      for (const x of [-30, 30]) {
        const pole = add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 0.5), poleMat));
        pole.position.set(x, 3, z);
      }
    }
    // morros no horizonte e moitas espalhadas (referência de profundidade)
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x8c9a6a, roughness: 1, flatShading: true });
    const hillGeo = new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    for (const [x, z, sx, sy] of [[-500, -2650, 420, 120], [300, -2750, 520, 160], [0, -2900, 700, 210], [-900, -1800, 300, 90], [950, -1500, 320, 100], [-700, -900, 200, 60], [760, -700, 220, 70]]) {
      const h = add(new THREE.Mesh(hillGeo, hillMat));
      h.scale.set(sx, sy, sx * 0.6);
      h.position.set(x, -2, z);
    }
    const bushGeo = new THREE.IcosahedronGeometry(1, 0);
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x5e7040, roughness: 1, flatShading: true });
    const n = 260;
    const bush = add(new THREE.InstancedMesh(bushGeo, bushMat, n));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      const z = -260 - rnd() * 2300;
      let x = (rnd() - 0.5) * 500;
      if (Math.abs(x) < 26) x += Math.sign(x || 1) * 26; // a linha de tiro fica livre
      const s = 0.8 + rnd() * 1.6 + (-z / 2300) * 1.5;
      v.set(x, s * 0.35, z);
      q.setFromAxisAngle(sc.set(0, 1, 0), rnd() * 6);
      m4.compose(v, q, sc.set(s * 1.3, s * 0.7, s));
      bush.setMatrixAt(i, m4);
    }
    bush.instanceMatrix.needsUpdate = true;
    // as birutas maiores ao longo da pista (EXTREME_SOCKS) são criadas pela partida, com as demais
    // neblina mais distante e plano de corte da câmera estendido
    this.saved = { fog: g.scene.fog ? [g.scene.fog.near, g.scene.fog.far] : null, far: g.camera.far };
    if (g.scene.fog) { g.scene.fog.near = 900; g.scene.fog.far = 6500; }
    g.camera.far = 4000;
    g.camera.updateProjectionMatrix();
  }

  zeroOf(def) { return this.zeroSel || def.zero || 100; }

  cycleZero() {
    const def = this.game.player.weapon && this.game.player.weapon.def;
    if (!def || this.zoneOf() !== 'range') return;
    const cur = this.zeroOf(def);
    const next = ZEROS.find((z) => z > cur) || ZEROS[0];
    this.zeroSel = next;
    this.game.audio.beep(1400, 0.04, 0.12);
    this.pop(`Luneta zerada a ${next.toLocaleString('pt-BR')} m`, '#cfe3ff');
    this.render();
  }

  buildStalks() {
    const g = this.game;
    this.bambooMat = new THREE.MeshStandardMaterial({ map: bambooTex(), roughness: 0.6 });
    this.innerMat = new THREE.MeshStandardMaterial({ color: 0xe9e2b8, roughness: 0.8 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x6a4a2e, roughness: 0.85 });
    const xs = [-15, -9, -3, 3, 9, 15];
    const zs = [cellToWorld(24), cellToWorld(28)];
    for (const z of zs) for (const x of xs) {
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.55), wood);
      base.position.set(x, 0.07, z);
      base.castShadow = true;
      g.scene.add(base);
      this.objects.push(base);
      const mark = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 32), new THREE.MeshBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
      mark.rotation.x = -Math.PI / 2;
      mark.position.set(x, 0.16, z);
      mark.visible = false;
      g.scene.add(mark);
      this.objects.push(mark);
      const s = { x, z, r: 0.055, full: 1.75, h: 1.75, mesh: null, cap: null, mark };
      this.resetStalk(s);
      this.stalks.push(s);
    }
  }

  resetStalk(s) {
    s.h = s.full;
    s.cutCount = 0;
    this.drawStalk(s, null);
  }

  // desenha o tronco de 0,14 m até a altura h; o topo pode ter o corte inclinado (ângulo a)
  drawStalk(s, cutAngle) {
    const g = this.game;
    if (s.mesh) s.mesh.removeFromParent();
    if (s.cap) s.cap.removeFromParent();
    const len = s.h - 0.14;
    const geo = new THREE.CylinderGeometry(s.r, s.r * 1.06, len, 14, 1, false);
    geo.translate(0, 0.14 + len / 2, 0);
    s.mesh = new THREE.Mesh(geo, this.bambooMat);
    s.mesh.position.set(s.x, 0, s.z);
    s.mesh.castShadow = true;
    g.scene.add(s.mesh);
    if (cutAngle != null) {
      // face do corte (elipse clara) inclinada conforme o golpe
      const cap = new THREE.Mesh(new THREE.CircleGeometry(s.r * 1.02, 16), this.innerMat);
      cap.rotation.x = -Math.PI / 2;
      const holder = new THREE.Group();
      holder.add(cap);
      holder.position.set(s.x, s.h + 0.002, s.z);
      holder.rotation.set(0, s.cutYaw || 0, cutAngle);
      cap.scale.set(1 / Math.cos(Math.min(1.2, Math.abs(cutAngle))), 1, 1);
      g.scene.add(holder);
      s.cap = holder;
    } else s.cap = null;
  }

  dispose() {
    document.body.classList.remove('training');
    if (this.onKey) window.removeEventListener('keydown', this.onKey);
    for (const o of this.hidden) o.visible = true;
    this.hidden = [];
    for (const f of this.puffs) f.mesh.removeFromParent();
    this.puffs = [];
    if (this.saved) {
      const g = this.game;
      if (g.scene.fog && this.saved.fog) { g.scene.fog.near = this.saved.fog[0]; g.scene.fog.far = this.saved.fog[1]; }
      g.camera.far = this.saved.far;
      g.camera.updateProjectionMatrix();
      this.saved = null;
    }
    for (const o of this.objects) o.removeFromParent();
    for (const s of this.stalks) { if (s.mesh) s.mesh.removeFromParent(); if (s.cap) s.cap.removeFromParent(); }
    for (const p of this.pieces) p.mesh.removeFromParent();
    this.objects = [];
    if (this.hud) this.hud.root.remove();
    this.hud = null;
  }

  // ---------- HUD ----------
  buildHud() {
    const root = document.createElement('div');
    root.id = 'train-hud';
    root.innerHTML = `
      <div class="tr-panel"><h4></h4><div class="tr-lines"></div><div class="tr-timer hidden"></div></div>
      <div class="tr-scope hidden"><canvas width="180" height="180"></canvas><p></p></div>
      <div class="tr-pop"></div>`;
    document.getElementById('hud').appendChild(root);
    const q = (s) => root.querySelector(s);
    this.hud = { root, title: q('.tr-panel h4'), lines: q('.tr-lines'), timer: q('.tr-timer'), scope: q('.tr-scope'), canvas: q('.tr-scope canvas'), cap: q('.tr-scope p'), pop: q('.tr-pop') };
  }

  pop(text, color = '#6dff9e') {
    const el = this.hud.pop;
    el.textContent = text;
    el.style.color = color;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  zoneOf() {
    const p = this.game.player.pos;
    return p.z > cellToWorld(18) ? 'dojo' : 'range';
  }

  render() {
    if (!this.hud) return;
    const zone = this.zoneOf();
    this.zone = zone;
    const L = [];
    if (zone === 'range') {
      this.hud.title.textContent = `Estande de longa distância · ${this.real ? 'balística realista' : 'balística básica'}`;
      const st = this.stats;
      const acc = st.shots ? Math.round((st.hits / st.shots) * 100) : 0;
      L.push(`Disparos ${st.shots} · acertos ${st.hits} (${acc}%) · pontos ${st.points}`);
      for (const d of this.distances) { const b = st.byDist[d]; if (b) L.push(`${d.toLocaleString('pt-BR')} m: ${b.h}/${b.s} · melhor ${b.best}`); }
      const sc = WIND_SCENARIOS[this.cfg.wind] || WIND_SCENARIOS.none;
      L.push(`Vento: ${sc.label.toLowerCase()} · leia a biruta`);
      const def = this.game.player && this.game.player.weapon && this.game.player.weapon.def;
      if (this.real && def) L.push(`Luneta zerada a ${this.zeroOf(def).toLocaleString('pt-BR')} m · <button class="tr-zero" type="button">mudar (Z)</button>`);
      if (this.spot) L.push(this.spot);
      if (this.queue && !this.ended) {
        const t = this.queue[this.qi];
        if (t) L.push(`Desafio: alvo ${this.qi + 1}/${this.queue.length} · ${t.d.toLocaleString('pt-BR')} m (marcado em laranja)`);
      } else if (!this.queue) L.push('Livre: atire à vontade. B troca de arma.');
    } else {
      const c = this.cuts;
      this.hud.title.textContent = 'Dojô · cortes em bambu';
      L.push(`Cortes ${c.total} · diagonais ${c.diag} · horizontais ${c.horiz}`);
      L.push(`Sequência ${c.combo} · melhor ${c.bestCombo}`);
      if (this.challenge && this.area === 'dojo') {
        L.push(`Pontos ${c.score} · certos ${c.good} · tipo errado ${c.wrong}`);
        if (this.want) L.push(`Corte pedido: <b>${this.want === 'diag' ? 'DIAGONAL (golpe leve)' : 'HORIZONTAL (golpe pesado)'}</b> no bambu marcado`);
      } else L.push('Golpe leve: diagonal · golpe pesado (botão direito): horizontal · mire na altura do corte');
    }
    this.hud.lines.innerHTML = L.map((x) => `<div>${x}</div>`).join('');
    const zb = this.hud.lines.querySelector('.tr-zero');
    if (zb) zb.onclick = (e) => { e.preventDefault(); this.cycleZero(); };
  }

  drawScope(plate, last) {
    const c = this.hud.canvas;
    const ctx = c.getContext('2d');
    const s = c.width;
    drawFace(ctx, s);
    for (const h of plate.hits.slice(-6)) {
      const px = s / 2 + (h.dx / plate.R) * (s / 2);
      const py = s / 2 - (h.dy / plate.R) * (s / 2);
      ctx.beginPath();
      ctx.arc(px, py, h === last ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = h === last ? '#ffd166' : '#555';
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.stroke();
    }
    this.hud.scope.classList.remove('hidden');
    const cm = (v) => `${Math.abs(Math.round(v * 100))} cm`;
    const dir = [];
    if (Math.abs(last.dy) > 0.02) dir.push(`${cm(last.dy)} ${last.dy > 0 ? 'acima' : 'abaixo'}`);
    if (Math.abs(last.dx) > 0.02) dir.push(`${cm(last.dx)} à ${last.dx > 0 ? 'direita' : 'esquerda'}`);
    this.hud.cap.textContent = `${plate.d} m · ${last.score} pontos${dir.length ? ` · ${dir.join(', ')} do centro` : ' · no centro!'}`;
  }

  highlight(plate) {
    for (const p of this.plates) p.glow.visible = p === plate;
  }

  // ---------- disparos no estande ----------
  // Chamado pelo jogo para cada projétil do jogador; devolve o ponto de impacto se acertou um alvo.
  shoot(shooter, o, d, def, wallT) {
    if (!shooter.isPlayer || this.ended) return null;
    // balística: o vento desvia conforme o "atraso" do projétil (lag = c·D²/v0, igual à partida)
    // e, no modo realista, a gravidade o faz cair (arma zerada na distância da arma ou do painel)
    const bal = ballisticsOf(def);
    const w = this.game.wind.vector();
    const hl = Math.hypot(d.x, d.z) || 1;
    const ux = d.x / hl, uz = d.z / hl;
    const along = w.x * ux + w.z * uz;
    const px = w.x - along * ux;
    // pista extrema: a barreira do fundo está escondida, então só os muros laterais param o tiro
    if (this.extreme && o.z + d.z * wallT < RANGE.endZ + 3) wallT = Infinity;
    const Z = this.zeroOf(def);
    const tz = Z / bal.v + (bal.c * Z * Z) / bal.v;
    const impactAt = (t) => {
      const lag = (bal.c * t * t) / bal.v;
      let ix = o.x + d.x * t + px * lag, iy = o.y + d.y * t;
      const tof = (t / bal.v + lag) * (1 - along * 0.012); // vento de frente alonga o voo; de cauda encurta
      if (this.real) iy += -0.5 * G * tof * tof + 0.5 * G * tz * tz * (t / Z);
      return { ix, iy, tof };
    };
    let best = null;
    for (const p of this.plates) {
      if (d.z >= -1e-4) continue;
      const t = (p.z - o.z) / d.z;
      if (t <= 0 || t > wallT + 0.01) continue;
      const { ix, iy, tof } = impactAt(t);
      const dx = ix - p.x, dy = iy - p.cy;
      const r = Math.hypot(dx, dy);
      if (r <= p.R && (!best || t < best.t)) best = { p, t, dx, dy, r, ix, iy, tof };
    }
    this.stats.shots++;
    if (!best) {
      // erro: atribui ao alvo mais próximo da linha de tiro para a estatística por distância
      let near = null, nd = Infinity;
      for (const p of this.plates) {
        const t = (p.z - o.z) / d.z;
        if (t <= 0 || t > wallT + 0.01) continue;
        const e = Math.hypot(o.x + d.x * t - p.x, o.y + d.y * t - p.cy) / t;
        if (e < nd) { nd = e; near = p; }
      }
      const counted = near && nd < (this.extreme ? 0.006 : 0.03);
      if (!this.extreme) {
        if (counted) this.addDist(near.d, false, 0);
        if (this.challenge) this.challengeShot(null);
        this.render();
        return null;
      }
      // pista extrema: a poeira levanta onde o projétil cai, depois do tempo de voo
      if (!near) { this.render(); return null; }
      const t = (near.z - o.z) / d.z;
      const im = impactAt(t);
      const dx = im.ix - near.x, dy = im.iy - near.cy;
      const pt = new THREE.Vector3(im.ix, Math.max(0.1, Math.min(im.iy, 0.1)), near.z + 0.5);
      const over = im.iy > near.cy + near.R + 3; // passou alto: cai bem além, fora de vista
      this.after(im.tof, () => {
        if (!over) this.puff(pt, im.iy < 0 ? 1 : 0.6);
        if (counted) this.addDist(near.d, false, 0);
        this.spotter(near, dx, dy, null);
        if (this.challenge) this.challengeShot(null);
        this.render();
      });
      _p.set(im.ix, Math.max(0.1, im.iy), near.z);
      return { point: _p, t, deferred: true };
    }
    const p = best.p;
    const score = Math.max(1, 10 - Math.floor((best.r / p.R) * 10));
    const hit = { dx: best.dx, dy: best.dy, score };
    const g = this.game;
    const land = () => {
      p.hits.push(hit);
      p.vel += 2.5 + score * 0.15;
      this.stats.hits++;
      this.stats.points += score;
      this.addDist(p.d, true, score);
      this.drawScope(p, hit);
      // o som do aço chega depois, conforme a distância
      const ring = () => g.audio.beep(Math.max(900, 2600 - p.d * 4), 0.18, Math.max(0.04, 0.3 - Math.min(p.d, 300) / 900));
      if (p.d > 40) this.after(p.d / SOUND, ring); else ring();
      this.pop(`${p.d.toLocaleString('pt-BR')} m · ${score}`, score >= 9 ? '#ffd166' : '#6dff9e');
      if (this.extreme) this.spotter(p, hit.dx, hit.dy, score);
      if (this.challenge) this.challengeShot(p, score);
      this.render();
    };
    _p.set(best.ix, best.iy, p.z + 0.02);
    if (this.extreme) {
      // o projétil leva segundos para chegar: o acerto aparece com atraso
      const pt = _p.clone();
      this.after(best.tof, () => { land(); g.effects.impact(pt, new THREE.Vector3(0, 0, 1), 'metal'); this.flash(pt, p.R); });
      return { point: _p, t: best.t, deferred: true };
    }
    land();
    return { point: _p, t: best.t };
  }

  // chamada do observador: desvio em metros e em miliradianos (o retículo em árvore é em mrad)
  spotter(p, dx, dy, score) {
    const m = (v) => `${Math.abs(v).toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} m`;
    const mil = (v) => (Math.abs(v) / p.d * 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
    const parts = [];
    if (Math.abs(dy) > 0.15) parts.push(`${m(dy)} ${dy > 0 ? 'alto' : 'baixo'} (${mil(dy)} mil)`);
    if (Math.abs(dx) > 0.15) parts.push(`${m(dx)} à ${dx > 0 ? 'direita' : 'esquerda'} (${mil(dx)} mil)`);
    const where = parts.length ? parts.join(', ') : 'no centro';
    this.spot = score != null ? `Observador: impacto a ${p.d.toLocaleString('pt-BR')} m, ${score} pontos, ${where}.` : `Observador: errou a ${p.d.toLocaleString('pt-BR')} m, ${where}.`;
    if (score == null) this.pop(`ERROU · ${parts.length ? parts.map((x) => x.split(' (')[0]).join(', ') : ''}`, '#ffb057');
  }

  // nuvem de poeira grande o bastante para ser vista pela luneta a 2 km
  puff(pt, k = 1) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xc9b48e, transparent: true, opacity: 0.85, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), mat);
    mesh.position.copy(pt);
    this.game.scene.add(mesh);
    this.puffs.push({ mesh, life: 1.6, max: 1.6, size: 2.2 * k, rise: 1.2 });
  }

  flash(pt, R) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 1, depthWrite: false, fog: false });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), mat);
    mesh.position.copy(pt);
    this.game.scene.add(mesh);
    this.puffs.push({ mesh, life: 0.25, max: 0.25, size: R * 0.5, rise: 0 });
  }

  addDist(d, hit, score) {
    const b = this.stats.byDist[d] || (this.stats.byDist[d] = { s: 0, h: 0, best: 0, pts: 0 });
    b.s++;
    if (hit) { b.h++; b.pts += score; b.best = Math.max(b.best, score); }
  }

  challengeShot(plate, score = 0) {
    const t = this.queue[this.qi];
    if (!t) return;
    const ok = plate === t;
    t.result = ok ? score : 0;
    this.qi++;
    if (this.qi >= this.queue.length) { this.highlight(null); this.finish(); return; }
    this.highlight(this.queue[this.qi]);
  }

  // ---------- cortes no dojô ----------
  // Chamado pelo jogo quando o golpe da espada do jogador se completa.
  slice(c, pm, eye, fwd) {
    if (!c.isPlayer || this.ended) return false;
    const reach = pm.def.reach + 0.35;
    let best = null, bd = Infinity;
    for (const s of this.stalks) {
      if (s.h < 0.5) continue;
      const dx = s.x - eye.x, dz = s.z - eye.z;
      const dist = Math.hypot(dx, dz);
      if (dist > reach) continue;
      const fl = Math.hypot(fwd.x, fwd.z) || 1;
      const ang = Math.acos(Math.max(-1, Math.min(1, (dx * fwd.x + dz * fwd.z) / (dist * fl))));
      if (ang > pm.def.arc + 0.25 && dist > 0.7) continue;
      if (dist + ang < bd) { bd = dist + ang; best = s; }
    }
    if (!best) return false;
    const s = best;
    const dist = Math.hypot(s.x - eye.x, s.z - eye.z);
    const fl = Math.hypot(fwd.x, fwd.z) || 1;
    const aimY = eye.y + (fwd.y / fl) * dist;
    const cutY = Math.max(0.45, Math.min(s.h - 0.12, aimY));
    const heavy = pm.heavy;
    const dir = this.game.viewmodel.meleeDir || 1;
    const angle = heavy ? 0 : 0.62 * dir;
    const oldH = s.h;
    s.h = cutY;
    s.cutYaw = Math.atan2(s.x - eye.x, s.z - eye.z);
    s.cutCount++;
    this.drawStalk(s, angle);
    this.dropPiece(s, cutY, oldH, angle, s.cutYaw);
    const g = this.game;
    _p.set(s.x, cutY, s.z);
    g.effects.slash(_p, fwd);
    g.audio.slashHit(_p);
    g.audio.beep(heavy ? 520 : 760, 0.06, 0.12);
    // estatística e desafio
    const k = this.cuts;
    k.total++;
    if (heavy) k.horiz++; else k.diag++;
    k.combo = g.time - k.lastT < 2.5 ? k.combo + 1 : 1;
    k.lastT = g.time;
    k.bestCombo = Math.max(k.bestCombo, k.combo);
    if (this.challenge) {
      if (s === this.target) {
        const right = (this.want === 'horiz') === heavy;
        const mult = Math.min(5, k.combo);
        const pts = (right ? 100 : 40) * mult;
        k.score += pts;
        if (right) k.good++; else k.wrong++;
        this.pop(right ? `CORTE PERFEITO +${pts}` : `TIPO ERRADO +${pts}`, right ? '#ffd166' : '#ffb057');
        this.pickStalk();
      } else {
        k.score += 10;
        k.combo = 0;
        this.pop('+10 · bambu não marcado', '#cfd6de');
      }
    } else this.pop(heavy ? 'HORIZONTAL' : 'DIAGONAL', '#6dff9e');
    if (s.h < 0.6) this.after(1.6, () => this.resetStalk(s));
    this.render();
    return true;
  }

  dropPiece(s, y0, y1, angle, yaw) {
    const g = this.game;
    const len = y1 - y0;
    const geo = new THREE.CylinderGeometry(s.r, s.r, len, 12);
    const mesh = new THREE.Mesh(geo, this.bambooMat);
    mesh.castShadow = true;
    mesh.position.set(s.x, y0 + len / 2, s.z);
    g.scene.add(mesh);
    // escorrega pela face do corte e tomba
    const side = Math.sign(angle) || (Math.random() < 0.5 ? -1 : 1);
    const vx = Math.cos(yaw) * side * (angle ? 1.4 : 0.5) + Math.sin(yaw) * 0.6;
    const vz = -Math.sin(yaw) * side * (angle ? 1.4 : 0.5) + Math.cos(yaw) * 0.6;
    this.pieces.push({ mesh, len, vy: 0.5, vx, vz, spinX: rand(-3, 3), spinZ: side * rand(2, 5), life: 3.2 });
  }

  pickStalk() {
    const opts = this.stalks.filter((s) => s !== this.target && s.h > 0.9);
    this.target = pick(opts.length ? opts : this.stalks);
    this.want = Math.random() < 0.55 ? 'diag' : 'horiz';
    for (const s of this.stalks) s.mark.visible = s === this.target;
  }

  // ---------- quadro ----------
  update(dt) {
    const g = this.game;
    if (!g.active || !this.hud) return;
    for (let i = this.timers.length - 1; i >= 0; i--) if (g.time >= this.timers[i].t) { const t = this.timers.splice(i, 1)[0]; t.fn(); }
    // alvos balançam e voltam
    for (const p of this.plates) {
      p.vel += (-p.swing * 30 - p.vel * 3.5) * dt;
      p.swing += p.vel * dt;
      p.pivot.rotation.x = -p.swing * 0.5;
    }
    // poeira e clarões da pista extrema
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const f = this.puffs[i];
      f.life -= dt;
      const k = 1 - f.life / f.max;
      f.mesh.scale.setScalar(f.size * (0.35 + k * 0.9));
      f.mesh.position.y += f.rise * dt;
      f.mesh.material.opacity = Math.max(0, (f.life / f.max) * 0.85);
      if (f.life <= 0) { f.mesh.removeFromParent(); f.mesh.geometry.dispose(); f.mesh.material.dispose(); this.puffs.splice(i, 1); }
    }
    // pedaços de bambu caindo
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const pc = this.pieces[i];
      pc.life -= dt;
      const m = pc.mesh;
      if (m.position.y > pc.len * 0.15 + 0.05) {
        pc.vy -= G * dt;
        m.position.x += pc.vx * dt; m.position.z += pc.vz * dt; m.position.y += pc.vy * dt;
        m.rotation.x += pc.spinX * dt; m.rotation.z += pc.spinZ * dt;
      } else {
        m.position.y = 0.06;
        m.rotation.x = Math.PI / 2 * Math.sign(m.rotation.x || 1);
        pc.vx *= 0.9; pc.vz *= 0.9;
      }
      if (pc.life < 0.6) m.scale.setScalar(Math.max(0.01, pc.life / 0.6));
      if (pc.life <= 0) { m.removeFromParent(); m.geometry.dispose(); this.pieces.splice(i, 1); }
    }
    if (this.area === 'dojo' && this.challenge && !this.ended) {
      this.timeLeft -= dt;
      this.hud.timer.classList.remove('hidden');
      this.hud.timer.textContent = `TEMPO · ${Math.max(0, Math.ceil(this.timeLeft))} s`;
      if (this.target) this.target.mark.material.opacity = 0.55 + Math.sin(g.time * 8) * 0.35;
      if (this.timeLeft <= 0) this.finish();
    }
    if (this.zoneOf() !== this.zone) this.render();
  }

  // ---------- fim do desafio ----------
  finish() {
    if (this.ended) return;
    this.ended = true;
    const g = this.game;
    g.phase = 'matchEnd';
    g.phaseT = 2.6;
    g.announce('DESAFIO CONCLUÍDO', this.area === 'dojo' ? `${this.cuts.score} pontos` : `${this.challengeScore()} pontos`, 2.4, '#6dff9e', 'matchEnd', { win: true });
  }

  challengeScore() {
    // pontos do anel multiplicados pela distância (25 m vale 1×, 200 m vale 8×; na pista extrema, 500 m vale 2× e 2.000 m vale 8×)
    return this.queue.reduce((a, p) => a + (p.result || 0) * (p.d / this.unit()), 0);
  }

  unit() { return this.extreme ? 250 : 25; }

  results() {
    const g = this.game;
    const p = g.player;
    const lines = [];
    let score = 0, title, stars = 0, key;
    if (this.area === 'range') {
      const ladder = this.queue || [];
      for (const t of ladder) { const pts = (t.result || 0) * (t.d / this.unit()); lines.push([`Alvo a ${t.d.toLocaleString('pt-BR')} m (${t.x < 0 ? 'esquerda' : 'direita'})`, t.result ? `${t.result} no anel` : 'errou', pts]); score += pts; }
      title = this.extreme ? `Pista extrema · desafio de ${ladder.length} tiros` : 'Estande · desafio de 10 tiros';
      stars = this.extreme ? (score >= 220 ? 3 : score >= 120 ? 2 : score > 0 ? 1 : 0) : (score >= 380 ? 3 : score >= 230 ? 2 : score > 0 ? 1 : 0);
      key = `range-${this.extreme ? 'extreme-' : ''}${this.real ? 'real' : 'basic'}`;
    } else {
      const k = this.cuts;
      lines.push(['Cortes no bambu marcado, tipo certo', k.good, k.good * 100]);
      lines.push(['Cortes no bambu marcado, tipo errado', k.wrong, k.wrong * 40]);
      lines.push(['Melhor sequência', k.bestCombo, 0]);
      lines.push(['Total (com multiplicador de sequência)', k.total, k.score]);
      score = k.score;
      title = 'Dojô · desafio de 60 segundos';
      stars = score >= 2400 ? 3 : score >= 1300 ? 2 : score > 0 ? 1 : 0;
      key = `dojo-${this.cfg.weapon || 'katana'}`;
    }
    score = Math.round(score);
    const bestAll = trainingBest();
    const prev = bestAll[key] || 0;
    if (score > prev) { bestAll[key] = score; saveSettings(); }
    return {
      mode: 'range', rows: [p], title: 'DESAFIO CONCLUÍDO', subtitle: title, color: '#6dff9e', playerWon: true,
      acc: p.shots ? Math.round((p.hits / p.shots) * 100) : 0, hs: 0, time: g.time, teamScore: { A: 0, B: 0 },
      story: { training: true, success: true, lines, score, stars, best: Math.max(prev, score), isBest: score > prev, backLabel: 'Centro de treinamento', backAction: 'training' },
    };
  }
}

// textura do bambu: verde com nós claros a cada ~35 cm
let bTex = null;
function bambooTex() {
  if (bTex) return bTex;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const ctx = c.getContext('2d');
  const grd = ctx.createLinearGradient(0, 0, 64, 0);
  grd.addColorStop(0, '#5f7d2c'); grd.addColorStop(0.5, '#8fae46'); grd.addColorStop(1, '#5a7628');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(40,60,20,${Math.random() * 0.15})`; ctx.fillRect(Math.random() * 64, 0, 1.5, 256); }
  for (const y of [40, 128, 216]) {
    ctx.fillStyle = '#c9c48a'; ctx.fillRect(0, y, 64, 5);
    ctx.fillStyle = 'rgba(40,50,20,0.5)'; ctx.fillRect(0, y + 5, 64, 2);
  }
  bTex = new THREE.CanvasTexture(c);
  bTex.wrapS = bTex.wrapT = THREE.RepeatWrapping;
  bTex.repeat.set(1, 2);
  bTex.colorSpace = THREE.SRGBColorSpace;
  return bTex;
}

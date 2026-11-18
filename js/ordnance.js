// Armas pesadas em jogo:
// - foguetes da bazuca: voo com leve queda, colisão com cenário e combatentes, explosão em área
//   (o dano cai com a distância do centro, só atinge quem está à vista da explosão e fere também
//   quem disparou muito perto). O anfitrião (ou o jogo local) resolve o dano; os convidados só
//   veem o foguete e a explosão;
// - pontos de coleta nas partidas (equipe e mata-mata): a foto do professor, em local sorteado,
//   entrega a Minigun M134; uma caixa de armamento, em outro local, entrega a bazuca. Uma pessoa
//   por vez fica com cada arma; quando ela cai, o ponto reaparece em outro lugar.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { WeaponInstance } from './weapon.js';
import { wallSpots, cellToWorld } from './map.js';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export const PROF_URL = 'assets/professor.jpg';
export const PROF_NAME = 'Prof. Esp. Abraão Junio de Souza Costa';
export const PROF_TITLES = 'Bacharel em Administração · Matemático · Especialista em TI e IA';

// ======================================================================== foguetes
let rocketGeo = null;
function rocketMesh() {
  if (!rocketGeo) {
    rocketGeo = {
      body: new THREE.CylinderGeometry(0.035, 0.035, 0.32, 10).rotateX(Math.PI / 2),
      nose: new THREE.ConeGeometry(0.05, 0.16, 12).rotateX(-Math.PI / 2).translate(0, 0, -0.24),
      glow: new THREE.SphereGeometry(0.09, 8, 6),
    };
  }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(rocketGeo.body, new THREE.MeshStandardMaterial({ color: 0x3d4a2c, roughness: 0.6 })));
  g.add(new THREE.Mesh(rocketGeo.nose, new THREE.MeshStandardMaterial({ color: 0x55602f, roughness: 0.5 })));
  const glow = new THREE.Mesh(rocketGeo.glow, new THREE.MeshBasicMaterial({ color: 0xffb050, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.position.z = 0.2;
  g.add(glow);
  return g;
}

export class Ordnance {
  constructor(game) {
    this.game = game;
    this.rockets = [];
    this.blasts = [];
    this.seq = 1;
    this.fireballGeo = new THREE.SphereGeometry(1, 16, 10);
  }

  clear() {
    for (const r of this.rockets) r.mesh.removeFromParent();
    for (const b of this.blasts) b.mesh.removeFromParent();
    this.rockets = [];
    this.blasts = [];
  }

  // Dispara um foguete. visual = só a imagem (convidado); id liga o foguete à explosão enviada.
  launch(shooter, o, d, def, visual = false, id = 0) {
    const g = this.game;
    const rk = def.rocket;
    const mesh = rocketMesh();
    mesh.position.copy(o).addScaledVector(d, 0.6);
    mesh.lookAt(_a.copy(mesh.position).sub(d)); // o nariz (-z local) aponta para d
    g.scene.add(mesh);
    const r = { id: id || this.seq++, shooter, def, pos: mesh.position, vel: d.clone().multiplyScalar(rk.speed), life: rk.life, age: 0, mesh, visual };
    this.rockets.push(r);
    if (!visual) g.fxPush({ k: 'rk', id: -1, rid: r.id, p: [o.x, o.y, o.z], d: [d.x, d.y, d.z] });
    g.audio.rocketLaunch(shooter && shooter.isPlayer ? null : o);
    // sopro traseiro
    const back = _b.copy(o).addScaledVector(d, -0.7);
    for (let i = 0; i < 14; i++) {
      g.effects.soft.emit(back.x, back.y, back.z, -d.x * (2 + Math.random() * 4) + (Math.random() - 0.5) * 2, -d.y * 3 + Math.random(), -d.z * (2 + Math.random() * 4) + (Math.random() - 0.5) * 2,
        0.8 + Math.random() * 0.6, 0.25 + Math.random() * 0.25, 0.7, 0.68, 0.64, 0.5, -0.3, 1.5, 1.6);
    }
    return r;
  }

  update(dt) {
    const g = this.game;
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.age += dt;
      r.life -= dt;
      r.vel.y -= r.def.rocket.gravity * dt;
      const sp = r.vel.length();
      const step = sp * dt;
      _a.copy(r.vel).divideScalar(sp || 1);
      let hitT = step + 1e-3, hitP = null, hitN = null;
      const wall = g.world.raycast(r.pos.x, r.pos.y, r.pos.z, _a.x, _a.y, _a.z, step);
      if (wall) { hitT = wall.t; hitP = _b.set(wall.x, wall.y, wall.z); hitN = _c.set(wall.nx, wall.ny, wall.nz); }
      // combatentes: esfera no tronco (e na cabeça) ao longo do trecho percorrido
      for (const c of g.combatants) {
        if (!c.alive || (c === r.shooter && r.age < 0.25)) continue;
        for (const [hy, rad] of [[1.0, 0.5], [1.55, 0.28]]) {
          const cx = c.pos.x - r.pos.x, cy = c.pos.y + hy - r.pos.y, cz = c.pos.z - r.pos.z;
          const t = cx * _a.x + cy * _a.y + cz * _a.z;
          if (t < 0 || t > hitT) continue;
          const dd = cx * cx + cy * cy + cz * cz - t * t;
          if (dd < rad * rad) { hitT = t; hitP = _b.copy(r.pos).addScaledVector(_a, t); hitN = _c.copy(_a).negate(); }
        }
      }
      if (hitP || r.life <= 0) {
        const p = hitP ? hitP.clone() : r.pos.clone();
        if (!r.visual) this.explode(p, r.shooter, r.def, r.id, hitN ? hitN.clone() : UP.clone());
        r.mesh.removeFromParent();
        this.rockets.splice(i, 1);
        continue;
      }
      r.pos.addScaledVector(_a, step);
      r.mesh.lookAt(_b.copy(r.pos).sub(_a));
      // rastro de fumaça e brilho do motor
      if (Math.random() < 0.9) {
        g.effects.soft.emit(r.pos.x - _a.x * 0.25, r.pos.y - _a.y * 0.25, r.pos.z - _a.z * 0.25, (Math.random() - 0.5) * 0.4, 0.3 + Math.random() * 0.3, (Math.random() - 0.5) * 0.4,
          0.9 + Math.random() * 0.5, 0.14, 0.78, 0.76, 0.72, 0.55, -0.15, 1.2, 1.8);
        g.effects.glow.emit(r.pos.x - _a.x * 0.22, r.pos.y - _a.y * 0.22, r.pos.z - _a.z * 0.22, 0, 0, 0, 0.06, 0.07, 1, 0.65, 0.25, 1, 0, 0, 0);
      }
    }
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i];
      b.t += dt;
      const k = b.t / b.dur;
      b.mesh.scale.setScalar(b.r0 + (b.r1 - b.r0) * (1 - (1 - Math.min(1, k)) ** 3));
      b.mesh.material.opacity = Math.max(0, 1 - k) * 0.95;
      if (k >= 1) { b.mesh.removeFromParent(); b.mesh.material.dispose(); this.blasts.splice(i, 1); }
    }
  }

  // Explosão com dano (anfitrião ou jogo local) e efeitos.
  explode(p, shooter, def, id, n) {
    const g = this.game;
    const rk = def.rocket;
    for (const c of g.combatants) {
      if (!c.alive) continue;
      const self = c === shooter;
      if (!self && shooter && !g.isEnemy(shooter, c)) continue; // sem fogo amigo
      const cy = c.pos.y + 1.0;
      const dist = Math.hypot(c.pos.x - p.x, cy - p.y, c.pos.z - p.z);
      if (dist > rk.radius) continue;
      // abrigo: a explosão precisa "ver" o tronco ou a cabeça
      const lift = p.clone().addScaledVector(n, 0.15);
      if (!g.world.clear(lift.x, lift.y, lift.z, c.pos.x, cy, c.pos.z) && !g.world.clear(lift.x, lift.y, lift.z, c.pos.x, c.pos.y + 1.6, c.pos.z)) continue;
      let dmg = rk.minDamage + (def.damage - rk.minDamage) * (1 - dist / rk.radius) ** 1.2;
      if (self) dmg *= rk.self;
      const dir = _a.set(c.pos.x - p.x, 0.4, c.pos.z - p.z).normalize();
      // empurrão (jogador local e bots; convidados controlam a própria posição)
      if (c.vel && !c.isRemote) { const push = 7 * (1 - dist / rk.radius); c.vel.x += dir.x * push; c.vel.z += dir.z * push; if (c.vel.y !== undefined) c.vel.y += push * 0.4; }
      g.applyDamage(c, dmg, shooter, 'body', dir.clone(), def);
    }
    g.fxPush({ k: 'ex', id: -1, rid: id, p: [p.x, p.y, p.z], n: [n.x, n.y, n.z] });
    this.blast(p, n);
    g.noise(p, 70, shooter);
  }

  // Só a imagem e o som da explosão (também usado pelos convidados).
  blast(p, n = UP) {
    const g = this.game;
    const mk = (color, r0, r1, dur) => {
      const m = new THREE.Mesh(this.fireballGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.position.copy(p).addScaledVector(n, 0.3);
      g.scene.add(m);
      this.blasts.push({ mesh: m, t: 0, dur, r0, r1 });
    };
    mk(0xffc060, 0.3, 2.6, 0.32);
    mk(0xff6a20, 0.5, 3.4, 0.5);
    const k = g.effects.density || 1;
    for (let i = 0; i < Math.round(26 * k); i++) {
      const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 5;
      g.effects.soft.emit(p.x, p.y + 0.3, p.z, Math.cos(a) * s + n.x * 3, 1.5 + Math.random() * 4 + n.y * 2, Math.sin(a) * s + n.z * 3,
        1.6 + Math.random() * 1.6, 0.5 + Math.random() * 0.6, 0.32, 0.3, 0.28, 0.75, -0.4, 1.6, 1.4);
    }
    for (let i = 0; i < Math.round(30 * k); i++) {
      g.effects.glow.emit(p.x, p.y + 0.2, p.z, (Math.random() - 0.5) * 18 + n.x * 6, Math.random() * 12 + n.y * 4, (Math.random() - 0.5) * 18 + n.z * 6,
        0.5 + Math.random() * 0.6, 0.04 + Math.random() * 0.04, 1, 0.7, 0.3, 1, 12, 0.6, 0);
    }
    const l = g.effects.lights && g.effects.lights[g.effects.lIdx || 0];
    if (l) { g.effects.lIdx = ((g.effects.lIdx || 0) + 1) % g.effects.lights.length; l.l.color.setHex(0xff9a40); l.l.position.copy(p).addScaledVector(n, 1); l.l.intensity = 40; l.t = 0.18; }
    if (n.y > 0.5) g.effects.decal(p, n);
    const pl = g.player;
    const d = pl && pl.alive ? Math.hypot(pl.pos.x - p.x, pl.pos.y + 1 - p.y, pl.pos.z - p.z) : 99;
    if (pl && d < 16) pl.shake = Math.min(1.6, (pl.shake || 0) + (1 - d / 16) * 1.3);
    g.audio.explosion(p, Math.max(0, 1 - d / 20));
  }

  // Convidado: eventos enviados pelo anfitrião.
  remoteRocket(f) {
    const def = WEAPONS.rpg;
    this.launch(null, new THREE.Vector3(...f.p), new THREE.Vector3(...f.d).normalize(), def, true, f.rid);
  }

  remoteExplosion(f) {
    const i = this.rockets.findIndex((r) => r.id === f.rid);
    if (i >= 0) { this.rockets[i].mesh.removeFromParent(); this.rockets.splice(i, 1); }
    this.blast(new THREE.Vector3(...f.p), new THREE.Vector3(...(f.n || [0, 1, 0])));
  }
}

// ======================================================================== pontos de coleta
function plaqueTex() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 200;
  const ctx = c.getContext('2d');
  const gr = ctx.createLinearGradient(0, 0, 0, 200);
  gr.addColorStop(0, '#2b2418'); gr.addColorStop(1, '#17120c');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 1024, 200);
  ctx.strokeStyle = '#c9a25a';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 1008, 184);
  ctx.textAlign = 'center';
  const fit = (text, weight, size, y, color) => {
    let px = size;
    do { ctx.font = `${weight} ${px}px "Chakra Petch", "Arial Narrow", sans-serif`; px -= 2; } while (ctx.measureText(text).width > 950 && px > 14);
    ctx.fillStyle = color;
    ctx.fillText(text, 512, y);
  };
  fit(PROF_NAME, 'bold', 52, 82, '#ecd8a0');
  fit(PROF_TITLES, '600', 34, 146, '#d8d2c2');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildPhoto() {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2e2216, roughness: 0.6, metalness: 0.1 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xc9a043, roughness: 0.3, metalness: 0.85, emissive: 0x3a2a08, emissiveIntensity: 0.6 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.95, 0.08), frameMat);
  frame.position.set(0, 1.85, 0.04);
  g.add(frame);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 0.02), trimMat);
  trim.position.set(0, 2.1, 0.085);
  g.add(trim);
  const tex = new THREE.TextureLoader().load(PROF_URL);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.32, roughness: 0.8 }));
  photo.position.set(0, 2.1, 0.1);
  g.add(photo);
  const pt = plaqueTex();
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.26), new THREE.MeshStandardMaterial({ map: pt, emissive: 0xffffff, emissiveMap: pt, emissiveIntensity: 0.22, roughness: 0.6 }));
  plaque.position.set(0, 1.18, 0.09);
  g.add(plaque);
  // halo dourado pulsante e ícone da minigun (indicam que a foto pode ser pega)
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.08, 40), new THREE.MeshBasicMaterial({ color: 0xffc04a, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
  halo.position.set(0, 2.0, 0.12);
  g.add(halo);
  g.userData.halo = halo;
  g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  return g;
}

function buildCrate() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x4f5634, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x23251c, roughness: 0.7, metalness: 0.3 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 0.62), wood);
  box.position.y = 0.3;
  box.castShadow = true;
  g.add(box);
  for (const x of [-0.6, 0, 0.6]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.57, 0.64), dark); b.position.set(x, 0.3, 0); g.add(b); }
  const c = document.createElement('canvas');
  c.width = 256; c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#4f5634'; ctx.fillRect(0, 0, 256, 96);
  ctx.fillStyle = '#e8d27a'; ctx.font = 'bold 40px "Chakra Petch", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('84 mm', 128, 46); ctx.font = 'bold 24px sans-serif'; ctx.fillText('FOGUETES · PERIGO', 128, 80);
  const lbl = new THREE.CanvasTexture(c);
  lbl.colorSpace = THREE.SRGBColorSpace;
  for (const z of [0.312, -0.312]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.19), new THREE.MeshStandardMaterial({ map: lbl, roughness: 0.8 }));
    m.position.set(-0.3, 0.32, z);
    if (z < 0) m.rotation.y = Math.PI;
    g.add(m);
  }
  const halo = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.15, 40), new THREE.MeshBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.03;
  g.add(halo);
  g.userData.halo = halo;
  return g;
}

const KINDS = {
  photo: { weapon: 'm134', label: 'Minigun M134', verb: 'Pegar a Minigun M134 (foto do professor)', respawn: 8 },
  crate: { weapon: 'rpg', label: 'Bazuca', verb: 'Pegar a bazuca (caixa de armamento)', respawn: 8 },
};

export class HeavyPickups {
  constructor(game) {
    this.game = game;
    this.items = {};
    for (const [kind, info] of Object.entries(KINDS)) {
      const group = kind === 'photo' ? buildPhoto() : buildCrate();
      game.scene.add(group);
      this.items[kind] = { kind, info, group, available: false, holder: null, respawnAt: 0 };
    }
    this.near = null;
    this.reach = 2.2;
    if (!game.isClient) for (const k of Object.keys(this.items)) this.place(k);
  }

  dispose() {
    for (const it of Object.values(this.items)) it.group.removeFromParent();
    const el = document.getElementById('pk-prompt');
    if (el) el.classList.add('hidden');
  }

  // sorteia o local: a foto numa parede livre; a caixa no chão, longe das bases
  place(kind) {
    const g = this.game;
    const it = this.items[kind];
    const avoid = [];
    for (const s of [...(g.map.teamSpawns.A || []), ...(g.map.teamSpawns.B || [])]) avoid.push({ x: s.x, z: s.z });
    if (g.map.mural && g.map.mural.group) avoid.push({ x: g.map.mural.group.position.x, z: g.map.mural.group.position.z });
    for (const o of Object.values(this.items)) if (o !== it && o.available) avoid.push({ x: o.group.position.x, z: o.group.position.z });
    if (kind === 'photo') {
      const spots = wallSpots(avoid).filter((s) => !avoid.some((a) => Math.hypot(a.x - s.x, a.z - s.z) < 8));
      const sp = spots.length ? spots[Math.floor(Math.random() * spots.length)] : null;
      if (sp) { it.group.position.set(sp.x, 0, sp.z); it.group.rotation.y = Math.atan2(sp.nx, sp.nz); }
      else { const c = g.nav.randomCell(); it.group.position.set(cellToWorld(c[0]), 0, cellToWorld(c[1])); }
    } else {
      const far = ([cx, cy]) => !avoid.some((a) => Math.hypot(a.x - cellToWorld(cx), a.z - cellToWorld(cy)) < 10);
      const c = g.nav.randomCell(far);
      it.group.position.set(cellToWorld(c[0]), 0, cellToWorld(c[1]));
      it.group.rotation.y = Math.random() * Math.PI;
    }
    it.available = true;
    it.holder = null;
    it.group.visible = true;
  }

  // ponto de interação de cada item (a foto fica na parede; a pessoa para à frente dela)
  spotOf(it) {
    const p = it.group.position;
    if (it.kind === 'photo') return _a.set(p.x + Math.sin(it.group.rotation.y) * 0.9, 0, p.z + Math.cos(it.group.rotation.y) * 0.9);
    return _a.set(p.x, 0, p.z);
  }

  nearest(c) {
    if (!c || !c.alive || c.heavy) return null;
    let best = null, bd = this.reach;
    for (const it of Object.values(this.items)) {
      if (!it.available) continue;
      const s = this.spotOf(it);
      const d = Math.hypot(c.pos.x - s.x, c.pos.z - s.z);
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }

  update(dt) {
    const g = this.game;
    const t = g.time;
    for (const it of Object.values(this.items)) {
      const h = it.group.userData.halo;
      if (h) { h.material.opacity = 0.28 + Math.sin(t * 4) * 0.16; h.scale.setScalar(1 + Math.sin(t * 2) * 0.04); }
      if (!g.isClient && !it.available && !it.holder && t >= it.respawnAt) this.place(it.kind);
    }
    // jogador local perto de um item: aviso e tecla de interação
    const p = g.player;
    this.near = g.canShoot() ? this.nearest(p) : null;
    const el = document.getElementById('pk-prompt');
    if (el) {
      el.classList.toggle('hidden', !this.near);
      if (this.near) {
        const key = document.body.classList.contains('touch') ? 'AÇÃO' : 'E';
        el.innerHTML = `<b>${key}</b> ${this.near.info.verb}`;
      }
    }
    if (this.near && g.input.justPressed('KeyE')) {
      if (g.isClient) g.net.toHost({ t: 'pick', k: this.near.kind });
      else this.grant(p, this.near.kind);
    }
  }

  // entrega a arma (anfitrião ou jogo local)
  grant(c, kind) {
    const g = this.game;
    const it = this.items[kind];
    if (!it || !it.available || !c.alive || c.heavy) return false;
    const s = this.spotOf(it);
    if (Math.hypot(c.pos.x - s.x, c.pos.z - s.z) > this.reach + 0.6) return false;
    it.available = false;
    it.holder = c;
    it.group.visible = false;
    this.give(c, it.info.weapon);
    c.heavy = { kind, weapon: it.info.weapon };
    if (c.isRemote) g.net.sendTo(c.peerId, { t: 'heavy', w: it.info.weapon });
    const msg = `${c.name} pegou ${kind === 'photo' ? 'a Minigun M134' : 'a bazuca'}`;
    g.announce(c.isPlayer ? (kind === 'photo' ? 'MINIGUN M134' : 'BAZUCA') : msg, c.isPlayer ? 'Arma pesada carregada' : '', 2.2, '#ffc04a');
    if (g.isHost) for (const o of g.combatants) if (o.isRemote && o !== c) g.net.sendTo(o.peerId, { t: 'ann', title: msg, sub: '', dur: 2.2, color: '#ffc04a' });
    if (g.isHost && c.isRemote) g.net.sendTo(c.peerId, { t: 'ann', title: kind === 'photo' ? 'MINIGUN M134' : 'BAZUCA', sub: 'Arma pesada carregada', dur: 2.2, color: '#ffc04a' });
    return true;
  }

  // troca a arma principal (também usado pelo convidado ao receber a mensagem do anfitrião)
  give(c, weaponId) {
    const g = this.game;
    if (weaponId) {
      c.heavyPrev = c.heavyPrev || c.weapons.primary;
      c.weapons.primary = new WeaponInstance(WEAPONS[weaponId]);
    } else if (c.heavyPrev) {
      c.weapons.primary = c.heavyPrev;
      c.heavyPrev = null;
    }
    c.slot = c.weapons.primary ? 'primary' : 'secondary';
    c.switchT = 0;
    if (c.isPlayer) g.viewmodel.setWeapon(c.weapon.def, true);
    if (c.model && c.model.setWeapon) c.model.setWeapon(c.weapon.def);
  }

  // quem carregava a arma caiu: ela volta para o ponto, em outro local, depois de alguns segundos
  onDeath(c) {
    const g = this.game;
    if (!c.heavy) return;
    const it = this.items[c.heavy.kind];
    c.heavy = null;
    this.give(c, null);
    if (c.isRemote && g.isHost) g.net.sendTo(c.peerId, { t: 'heavy', w: null });
    if (it) { it.holder = null; it.respawnAt = g.time + it.info.respawn; }
  }

  // estado enviado aos convidados: [tipo, disponível, x, z, giro]
  snapshot() {
    return Object.values(this.items).map((it) => [it.kind, it.available ? 1 : 0, Math.round(it.group.position.x * 100) / 100, Math.round(it.group.position.z * 100) / 100, Math.round(it.group.rotation.y * 1000) / 1000]);
  }

  applyRemote(arr) {
    for (const [kind, av, x, z, ry] of arr || []) {
      const it = this.items[kind];
      if (!it) continue;
      it.available = !!av;
      it.group.visible = !!av;
      it.group.position.set(x, 0, z);
      it.group.rotation.y = ry;
    }
  }
}

// Modelos procedurais: armas (mundo e primeira pessoa) e personagens.
import * as THREE from 'three';
import { lerp, damp } from './utils.js';
import { buildGun } from './guns.js';
import { camoTexture, lookColors } from './profiles.js';

const matCache = new Map();
export function stdMat(color, rough = 0.6, metal = 0.3, extra = {}) {
  const key = `${color}|${rough}|${metal}|${JSON.stringify(extra)}`;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }));
  return matCache.get(key);
}

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 12);
cylGeo.rotateX(Math.PI / 2); // eixo ao longo de Z

function box(parent, w, h, d, x, y, z, mat, rx = 0) {
  const m = new THREE.Mesh(boxGeo, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.rotation.x = rx;
  m.castShadow = true;
  parent.add(m);
  return m;
}

function cyl(parent, r, len, x, y, z, mat) {
  const m = new THREE.Mesh(cylGeo, mat);
  m.scale.set(r, r, len);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}


// As armas detalhadas ficam em guns.js.
export { buildGun } from './guns.js';

// ---------- personagem ----------
export class CharacterModel {
  // look (opcional): aparência de um perfil. Sem ele, o personagem usa capacete e máscara.
  constructor(color, look = null) {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    const team = stdMat(color, 0.7, 0.1);
    const teamDark = stdMat(new THREE.Color(color).multiplyScalar(0.45).getHex(), 0.8, 0.1);
    const boots = stdMat(0x1d1b18, 0.8, 0.1);
    const gear = stdMat(0x23262a, 0.6, 0.3);
    const lc = look ? lookColors(look) : null;
    // a farda mantém o corte padrão; só a estampa de camuflagem muda
    const fabric = look ? new THREE.MeshStandardMaterial({ map: camoTexture(look.camo), roughness: 0.95 }) : stdMat(0x3a3d36, 0.95, 0);
    const pants = look ? new THREE.MeshStandardMaterial({ map: camoTexture(look.camo), color: 0xd8d8d8, roughness: 0.95 }) : stdMat(0x4a4538, 0.95, 0);
    const skin = stdMat(lc ? lc.skin : 0x8d6a52, 0.8, 0);
    this.fabric = fabric;

    this.legs = [];
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.11, 0.85, 0);
      box(hip, 0.17, 0.62, 0.2, 0, -0.31, 0, pants);
      box(hip, 0.18, 0.24, 0.26, 0, -0.73, -0.03, boots);
      box(hip, 0.19, 0.1, 0.06, 0, -0.38, -0.11, teamDark); // joelheira
      this.body.add(hip);
      this.legs.push(hip);
    }
    this.upper = new THREE.Group();
    this.upper.position.y = 0.85;
    this.body.add(this.upper);
    box(this.upper, 0.46, 0.62, 0.26, 0, 0.31, 0, fabric);
    box(this.upper, 0.5, 0.42, 0.32, 0, 0.36, 0, team); // colete
    box(this.upper, 0.36, 0.12, 0.06, 0, 0.26, -0.18, gear); // porta-carregadores
    box(this.upper, 0.3, 0.3, 0.12, 0, 0.36, 0.2, teamDark); // mochila
    box(this.upper, 0.52, 0.06, 0.34, 0, 0.04, 0, gear); // cinto

    this.head = new THREE.Group();
    this.head.position.y = 0.76;
    this.upper.add(this.head);
    box(this.head, 0.22, 0.25, 0.24, 0, 0, 0, skin);
    if (look) {
      this.buildFace(lc, skin);
      this.buildHair(look.hair, stdMat(lc.hair, 0.85, 0));
      box(this.upper, 0.11, 0.08, 0.11, 0, 0.64, 0, skin); // pescoço
    } else {
      box(this.head, 0.27, 0.13, 0.29, 0, 0.11, 0.01, teamDark); // capacete
      box(this.head, 0.24, 0.05, 0.03, 0, 0.02, -0.125, stdMat(0x111316, 0.2, 0.8, { emissive: 0x1a3a4a, emissiveIntensity: 0.6 }));
      box(this.head, 0.23, 0.08, 0.05, 0, -0.08, -0.11, gear); // máscara
    }

    // braços + arma giram com a inclinação vertical da mira
    this.aim = new THREE.Group();
    this.aim.position.set(0, 0.52, 0);
    this.upper.add(this.aim);
    box(this.aim, 0.11, 0.11, 0.36, 0.2, -0.06, -0.16, fabric);
    box(this.aim, 0.1, 0.1, 0.32, -0.12, -0.08, -0.26, fabric);
    box(this.aim, 0.13, 0.12, 0.14, 0.22, 0.0, 0.0, team); // ombreiras
    box(this.aim, 0.13, 0.12, 0.14, -0.22, 0.0, 0.0, team);
    if (look) {
      box(this.aim, 0.09, 0.09, 0.09, 0.2, -0.07, -0.36, skin); // mãos
      box(this.aim, 0.09, 0.09, 0.09, -0.11, -0.09, -0.44, skin);
    }
    this.gunHolder = new THREE.Group();
    this.gunHolder.position.set(0.1, -0.08, -0.32);
    this.aim.add(this.gunHolder);
    this.gun = null;
    this.flash = null;

    this.phase = Math.random() * 6;
    this.deathT = 0;
    this.deathSide = Math.random() < 0.5 ? -1 : 1;
    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  }

  // Rosto: olhos com íris colorida, sobrancelhas, nariz e boca.
  buildFace(lc, skin) {
    const h = this.head;
    const white = stdMat(0xf4f1ea, 0.5, 0);
    const iris = stdMat(lc.eyes, 0.35, 0);
    const brow = stdMat(lc.hair, 0.85, 0);
    const shade = stdMat(new THREE.Color(lc.skin).multiplyScalar(0.82).getHex(), 0.8, 0);
    for (const sx of [-1, 1]) {
      box(h, 0.056, 0.03, 0.008, sx * 0.055, 0.03, -0.121, white);
      box(h, 0.026, 0.03, 0.008, sx * 0.055, 0.03, -0.124, iris);
      box(h, 0.01, 0.012, 0.008, sx * 0.055, 0.03, -0.127, stdMat(0x0b0b0b, 0.4, 0));
      box(h, 0.064, 0.011, 0.012, sx * 0.055, 0.058, -0.122, brow);
      box(h, 0.02, 0.07, 0.05, sx * 0.12, 0.0, 0.0, shade); // orelhas
    }
    box(h, 0.03, 0.06, 0.03, 0, -0.012, -0.13, shade); // nariz
    box(h, 0.064, 0.012, 0.008, 0, -0.07, -0.121, stdMat(0x8a3b34, 0.6, 0)); // boca
  }

  // Cabelo conforme o estilo escolhido (peças presas à cabeça).
  buildHair(style, m) {
    const h = this.head;
    const cap = (t = 0.07, y = 0.118) => box(h, 0.236, t, 0.256, 0, y, 0.004, m);
    const backPiece = (len = 0.14, y = 0.045) => box(h, 0.236, len, 0.04, 0, y, 0.118, m);
    const sides = (len = 0.1, y = 0.06) => { for (const sx of [-1, 1]) box(h, 0.02, len, 0.17, sx * 0.118, y, 0.03, m); };
    switch (style) {
      case 'raspado':
        box(h, 0.226, 0.026, 0.246, 0, 0.128, 0.002, m);
        box(h, 0.226, 0.1, 0.014, 0, 0.07, 0.122, m);
        break;
      case 'topete':
        cap(); backPiece(); sides();
        box(h, 0.2, 0.075, 0.09, 0, 0.175, -0.085, m, -0.35);
        break;
      case 'cacheado': {
        cap(0.06); backPiece(0.16, 0.04); sides(0.13, 0.05);
        const sph = new THREE.SphereGeometry(0.062, 8, 6);
        for (let ix = -1; ix <= 1; ix++) for (let iz = -1; iz <= 1; iz++) {
          const s = new THREE.Mesh(sph, m);
          s.position.set(ix * 0.085, 0.17 - Math.abs(ix) * 0.02, iz * 0.09 + 0.01);
          h.add(s);
        }
        for (const sx of [-1, 1]) for (const y of [0.09, 0.0]) { const s = new THREE.Mesh(sph, m); s.position.set(sx * 0.13, y, 0.05); h.add(s); }
        for (const x of [-0.07, 0.07]) { const s = new THREE.Mesh(sph, m); s.position.set(x, 0.04, 0.14); h.add(s); }
        break;
      }
      case 'longo':
        cap(); sides(0.3, -0.03);
        box(h, 0.24, 0.4, 0.05, 0, -0.07, 0.128, m);
        box(h, 0.2, 0.03, 0.03, 0, 0.1, -0.125, m); // franja
        break;
      case 'rabo':
        cap(); backPiece(0.12, 0.06); sides(0.08, 0.08);
        box(h, 0.05, 0.05, 0.05, 0, 0.09, 0.16, stdMat(0x2a2c30, 0.6, 0));
        box(h, 0.07, 0.28, 0.07, 0, -0.04, 0.2, m, 0.3);
        break;
      case 'trancas':
        cap(); backPiece(0.1, 0.07); sides(0.09, 0.07);
        for (const sx of [-1, 1]) {
          for (let i = 0; i < 5; i++) box(h, 0.052 - (i % 2) * 0.008, 0.07, 0.052 - (i % 2) * 0.008, sx * 0.105, -0.02 - i * 0.07, 0.07, m);
          box(h, 0.03, 0.03, 0.03, sx * 0.105, -0.37, 0.07, stdMat(0xc0392b, 0.6, 0));
        }
        break;
      case 'coque': {
        cap(); backPiece(0.12, 0.06); sides(0.08, 0.08);
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), m);
        s.position.set(0, 0.16, 0.12);
        h.add(s);
        break;
      }
      default: // curto
        cap(); backPiece(); sides();
        box(h, 0.22, 0.03, 0.03, 0, 0.115, -0.125, m);
    }
  }

  setWeapon(def) {
    if (this.gunDef === def) return;
    this.gunDef = def;
    if (this.gun) this.gunHolder.remove(this.gun.group);
    this.gun = buildGun(def);
    this.gun.group.scale.setScalar(1.15);
    const t = def.model.type;
    this.gun.group.rotation.set(t === 'katana' || t === 'nodachi' ? 0.9 : 0, 0, 0);
    this.gun.group.position.set(t === 'gauntlet' ? -0.1 : 0, 0, t === 'gauntlet' ? 0.1 : 0);
    this.gunHolder.add(this.gun.group);
  }

  swing() { this.swingT = 0; }

  muzzleWorld(out) {
    if (!this.gun) return this.root.getWorldPosition(out);
    return this.gun.muzzle.getWorldPosition(out);
  }

  update(dt, c) {
    const r = this.root;
    r.position.copy(c.pos);
    r.rotation.y = c.yaw;
    if (!c.alive) {
      this.deathT = Math.min(1, this.deathT + dt * 3);
      const e = 1 - Math.pow(1 - this.deathT, 3);
      this.body.rotation.x = e * (Math.PI / 2 - 0.05);
      this.body.rotation.z = e * 0.25 * this.deathSide;
      this.body.position.y = e * 0.12;
      return;
    }
    this.deathT = 0;
    this.body.rotation.set(0, 0, 0);
    this.body.position.y = 0;
    const speed = Math.hypot(c.vel.x, c.vel.z);
    const ct = c.crouchT;
    const hipY = lerp(0.85, 0.5, ct);
    this.upper.position.y = hipY;
    this.phase += dt * speed * 2.2;
    const swing = Math.min(1, speed / 4.5) * 0.65;
    this.legs.forEach((leg, i) => {
      leg.position.y = hipY;
      leg.scale.y = hipY / 0.85;
      leg.rotation.x = Math.sin(this.phase + i * Math.PI) * swing + ct * 0.35;
    });
    this.upper.rotation.x = damp(this.upper.rotation.x, ct * 0.18, 10, dt);
    this.aim.rotation.x = c.pitch;
    this.aim.rotation.y = 0;
    if (this.swingT !== undefined && this.swingT < 1) {
      this.swingT = Math.min(1, this.swingT + dt / 0.35);
      const k = Math.sin(this.swingT * Math.PI);
      this.aim.rotation.y = (0.9 - this.swingT * 1.8) * k;
      this.aim.rotation.x = c.pitch - 0.6 * k;
    }
    this.head.rotation.x = c.pitch * 0.6;
    this.upper.position.y += Math.abs(Math.sin(this.phase)) * 0.03 * swing;
  }
}

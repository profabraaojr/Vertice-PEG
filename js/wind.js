// Vento: condição ambiental compartilhada pela física dos projéteis, pelas birutas e pelo HUD.
//
// O vento tem uma direção (para onde sopra) e uma velocidade em m/s. Cada condição dura de 25 a
// 45 s; depois, direção e intensidade migram aos poucos para a próxima. Por cima disso há uma
// oscilação natural (rajadas) que nunca muda o quadro de forma brusca. A mesma leitura
// (vector/at) é usada pela balística e pelas birutas, para que elas mostrem exatamente o vento
// que desvia os tiros.
import * as THREE from 'three';
import { rand } from './utils.js';

const TAU = Math.PI * 2;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Cenários de teste do estande (yaw de referência: direção do tiro para o norte, -Z)
export const WIND_SCENARIOS = {
  none: { label: 'Sem vento', speed: 0 },
  weak: { label: 'Fraco lateral', speed: 2, rel: Math.PI / 2 },
  moderate: { label: 'Moderado lateral', speed: 4.5, rel: Math.PI / 2 },
  strong: { label: 'Forte lateral', speed: 7.5, rel: Math.PI / 2 },
  head: { label: 'Frontal', speed: 5, rel: Math.PI }, // sopra contra o atirador
  tail: { label: 'Traseiro', speed: 5, rel: 0 }, // sopra a favor do tiro
  variable: { label: 'Variável', dynamic: true, min: 1.5, max: 7.5 },
};

export class Wind {
  constructor() {
    this.dir = 0; // ângulo da direção para onde sopra (0 = -Z, sentido horário visto de cima = +X)
    this.speed = 0;
    this.base = { dir: 0, speed: 0 };
    this.target = { dir: 0, speed: 0 };
    this.hold = 30;
    this.t = rand(0, 100);
    this.dynamic = true;
    this.min = 0.5;
    this.max = 7;
    this.gust = 1;
  }

  // Modo dinâmico (partidas): começa numa condição sorteada e muda com o tempo.
  randomize(min = 0.5, max = 7) {
    this.dynamic = true;
    this.min = min; this.max = max;
    this.base.dir = rand(-Math.PI, Math.PI);
    this.base.speed = rand(min, max * 0.75);
    this.pickTarget();
    this.hold = rand(25, 45);
    this.apply();
  }

  // Condição fixa (cenários de teste): direção relativa ao tiro para o norte.
  setScenario(key) {
    const s = WIND_SCENARIOS[key] || WIND_SCENARIOS.moderate;
    if (s.dynamic) { this.randomize(s.min, s.max); return; }
    this.dynamic = false;
    // direção para onde sopra: rel = 0 → para o norte (a favor do tiro); π/2 → para a direita
    this.base.dir = wrap(s.rel ?? 0);
    this.base.speed = s.speed;
    this.target = { ...this.base };
    this.apply();
  }

  // Estado recebido do anfitrião (multijogador): adota suavemente.
  setRemote(dir, speed) {
    this.dynamic = false;
    this.target.dir = dir;
    this.target.speed = speed;
    if (!this.synced) { this.base.dir = dir; this.base.speed = speed; this.synced = true; } // primeiro contato: adota na hora
    this.remote = true;
  }

  pickTarget() {
    // a próxima condição é vizinha da atual: no máximo ±55° e ±2,5 m/s
    this.target.dir = wrap(this.base.dir + rand(-0.95, 0.95));
    this.target.speed = Math.min(this.max, Math.max(this.min, this.base.speed + rand(-2.5, 2.5)));
  }

  update(dt) {
    this.t += dt;
    if (this.dynamic) {
      this.hold -= dt;
      if (this.hold <= 0) { this.pickTarget(); this.hold = rand(25, 45); }
    }
    if (this.dynamic || this.remote) {
      // migração lenta para a condição seguinte (cerca de 4°/s e 0,25 m/s por segundo)
      const dd = wrap(this.target.dir - this.base.dir);
      this.base.dir = wrap(this.base.dir + Math.max(-0.07 * dt, Math.min(0.07 * dt, dd)));
      const ds = this.target.speed - this.base.speed;
      this.base.speed += Math.max(-0.25 * dt, Math.min(0.25 * dt, ds));
    }
    this.apply();
  }

  // oscilação natural: rajadas de ±15% e variação de ±5° na direção, com períodos de vários segundos
  apply() {
    const t = this.t;
    const s = this.base.speed;
    this.gust = 1 + 0.1 * Math.sin(t * 0.83) + 0.05 * Math.sin(t * 2.17 + 1.3);
    this.speed = Math.max(0, s * (s > 0.05 ? this.gust : 0));
    this.dir = wrap(this.base.dir + 0.07 * Math.sin(t * 0.31 + 0.7) + 0.025 * Math.sin(t * 1.13));
  }

  // vetor horizontal do vento (m/s) no plano XZ
  vector(out = { x: 0, z: 0 }) {
    out.x = Math.sin(this.dir) * this.speed;
    out.z = -Math.cos(this.dir) * this.speed;
    return out;
  }

  level() {
    const s = this.speed;
    return s < 0.6 ? 0 : s < 3 ? 1 : s < 6 ? 2 : 3; // calmo, fraco, moderado, forte
  }
}

// ------------------------------------------------------------------ desvio balístico
// "Tempo de atraso" do projétil (lag): quanto ele fica exposto ao vento além do voo no vácuo.
// lag(D) = c · D² / v0. O desvio lateral é o vento perpendicular vezes o lag, por isso cresce
// com o quadrado da distância e quase some nos tiros curtos.
export const BALLISTICS = {
  pistol: { v: 370, c: 0.004 }, revolver: { v: 430, c: 0.0035 }, smg: { v: 400, c: 0.0035 },
  ar: { v: 715, c: 0.002 }, ar2: { v: 900, c: 0.0016 }, shotgun: { v: 400, c: 0.005 },
  sniper: { v: 880, c: 0.001 }, gauntlet: { v: 3000, c: 0 },
};
export function ballisticsOf(def) {
  return def.ballistic || BALLISTICS[def.model.type] || BALLISTICS.ar;
}

// Desvia a direção d (normalizada) conforme o vento perpendicular ao tiro, para um alvo a D metros.
const _w = { x: 0, z: 0 };
export function windDeflect(d, def, D, wind) {
  if (!wind || wind.speed < 0.05 || D < 1) return d;
  const b = ballisticsOf(def);
  if (!b.c) return d;
  wind.vector(_w);
  const hx = d.x, hz = d.z;
  const hl = Math.hypot(hx, hz) || 1;
  const ux = hx / hl, uz = hz / hl;
  const along = _w.x * ux + _w.z * uz;
  const px = _w.x - along * ux, pz = _w.z - along * uz; // componente perpendicular ao tiro
  const lag = (b.c * D * D) / b.v;
  // ângulo do desvio = deslocamento lateral / distância
  const k = lag / D;
  d.x += px * k;
  d.z += pz * k;
  return d.normalize();
}

// ------------------------------------------------------------------ biruta
// Mastro, aro giratório e tecido em 5 gomos (laranja e branco, como nas birutas de aeródromo).
// O tecido infla e se levanta conforme a velocidade (estendido por volta de 7,5 m/s), aponta
// para onde o vento sopra e tremula com uma onda que corre até a ponta.
const SEG = 5;
const DROOP_W = [0.34, 0.24, 0.18, 0.13, 0.11];
export class Windsock {
  constructor(scene, x, y, z, poleH = 4.2, scale = 1) {
    this.root = new THREE.Group();
    this.root.position.set(x, y, z);
    this.root.scale.setScalar(scale);
    const metal = new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.45, metalness: 0.7 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, poleH, 10), metal);
    pole.position.y = poleH / 2;
    pole.castShadow = true;
    this.root.add(pole);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), metal);
    cap.position.y = poleH + 0.06;
    this.root.add(cap);
    // aro giratório
    this.swivel = new THREE.Group();
    this.swivel.position.y = poleH - 0.05;
    this.root.add(this.swivel);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.32), metal);
    arm.position.z = -0.16;
    this.swivel.add(arm);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.014, 6, 20), metal);
    ring.position.z = -0.32;
    this.swivel.add(ring);
    // gomos do tecido (cada um filho do anterior: as curvaturas se somam até a ponta)
    const orange = new THREE.MeshStandardMaterial({ color: 0xff5a14, roughness: 0.85, side: THREE.DoubleSide });
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.85, side: THREE.DoubleSide });
    this.segs = [];
    let parent = new THREE.Group();
    parent.position.z = -0.32;
    this.swivel.add(parent);
    const len = 0.34;
    for (let i = 0; i < SEG; i++) {
      const r0 = 0.2 - i * 0.022, r1 = 0.2 - (i + 1) * 0.022;
      const g = new THREE.CylinderGeometry(r1, r0, len, 14, 1, true);
      g.rotateX(-Math.PI / 2);
      g.translate(0, 0, -len / 2);
      const joint = new THREE.Group();
      if (i > 0) joint.position.z = -len;
      parent.add(joint);
      const m = new THREE.Mesh(g, i % 2 ? white : orange);
      m.castShadow = true;
      joint.add(m);
      this.segs.push({ joint, mesh: m });
      parent = joint;
    }
    this.yaw = rand(0, TAU);
    this.k = 0.3;
    this.phase = rand(0, 10);
    scene.add(this.root);
  }

  update(dt, wind) {
    const s = wind.speed;
    // inflação: 0 (murcha, pendurada) a 1 (estendida na horizontal)
    const k = Math.min(1, s / 7.5);
    this.k += (k - this.k) * Math.min(1, dt * 1.6);
    // gira para onde o vento sopra, com a inércia do aro
    const want = -wind.dir; // direção do vento no plano → rotação em torno de Y
    const dy = wrap(want - this.yaw);
    this.yaw += dy * Math.min(1, dt * (0.8 + this.k * 2.2));
    this.swivel.rotation.y = this.yaw;
    this.phase += dt * (2.2 + s * 0.9);
    const turb = 0.04 + this.k * 0.06; // vento mais forte, tremor mais rápido e visível
    // queda total (rad): sem vento o tecido fica quase pendurado; a dobra se concentra perto do aro
    const droop = Math.pow(1 - this.k, 1.3) * 1.55;
    for (let i = 0; i < SEG; i++) {
      const sg = this.segs[i];
      const tip = (i + 1) / SEG;
      const wave = Math.sin(this.phase - i * 0.9);
      const wave2 = Math.sin(this.phase * 1.37 - i * 1.3 + 0.6);
      sg.joint.rotation.x = -droop * DROOP_W[i] - wave * turb * tip * 0.6;
      sg.joint.rotation.y = wave2 * turb * tip * 0.8;
      // tecido meio vazio com pouco vento
      const inf = 0.62 + 0.38 * this.k;
      sg.mesh.scale.set(inf + wave * 0.03 * tip, inf * (1 - 0.08 * (1 - this.k) * tip), 1);
    }
  }

  dispose() {
    this.root.removeFromParent();
    this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
}

// Onde ficam as birutas em cada mapa: [x, y (base), z, altura do mastro]
export const WINDSOCK_SPOTS = {
  ferrugem: [[23, 5.35, -27, 3], [-23, 5.35, 27, 3]],
  noite: [[23, 5.35, -27, 3], [-23, 5.35, 27, 3]],
  selva: [[-5, 2.6, -14, 3.2], [5, 2.6, 14, 3.2]],
  ruinas: [[6, 2.6, -16, 3.2], [-8, 2.6, 5, 3.2]],
  estande: [[-10.6, 0, -47, 4.5], [10.6, 0, -92, 4.5], [-10.6, 0, -142, 4.5], [10.6, 0, -192, 4.5], [10.8, 0, -24, 3.6]],
};

// ------------------------------------------------------------------ indicador discreto no HUD
// Seta relativa à direção do olhar (para onde o vento sopra) e três barras: fraco, moderado, forte.
// Sem números: complementa a leitura da biruta, sem substituí-la.
const LEVELS = ['CALMO', 'FRACO', 'MODERADO', 'FORTE'];
export class WindIndicator {
  constructor() {
    const el = document.createElement('div');
    el.id = 'wind-hud';
    el.className = 'hidden';
    el.innerHTML = '<div class="wh-dial"><i></i></div><div class="wh-info"><b></b><span><em></em><em></em><em></em></span></div>';
    document.getElementById('hud').appendChild(el);
    this.el = el;
    this.arrow = el.querySelector('.wh-dial i');
    this.label = el.querySelector('b');
    this.bars = [...el.querySelectorAll('em')];
    this.rel = 0;
    this.lv = -1;
  }

  update(wind, yaw, show, dt) {
    this.el.classList.toggle('hidden', !show);
    if (!show) return;
    const lv = wind.level();
    const target = wind.dir + yaw;
    this.rel += wrap(target - this.rel) * Math.min(1, dt * 6);
    this.arrow.style.transform = `translate(-50%, -50%) rotate(${this.rel}rad)`;
    this.arrow.style.opacity = lv ? '1' : '0.25';
    if (lv !== this.lv) {
      this.lv = lv;
      this.label.textContent = `VENTO ${LEVELS[lv]}`;
      this.bars.forEach((b, i) => b.classList.toggle('on', i < lv));
      this.el.dataset.level = String(lv);
    }
  }
}

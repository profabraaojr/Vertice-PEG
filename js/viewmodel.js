// Arma em primeira pessoa: cena própria sobreposta ao mundo, com mãos e animações procedurais.
import * as THREE from 'three';
import { buildGun, Kit, gunMat, gunEnvironment } from './guns.js';
import { damp, lerp, clamp } from './utils.js';
import { muzzleFlash } from './textures.js';
import { camoTexture } from './profiles.js';
import { buildHand, handMaterials, mirrorX, sdBox, sdTiltBox, sdUnion } from './hands.js';

const HIP = {
  pistol: [0.08, -0.1, -0.4], revolver: [0.08, -0.1, -0.42], smg: [0.11, -0.17, -0.36],
  ar: [0.11, -0.17, -0.35], ar2: [0.11, -0.175, -0.35], sniper: [0.11, -0.18, -0.35], shotgun: [0.11, -0.17, -0.35],
  katana: [0.17, -0.17, -0.44], nodachi: [0.18, -0.19, -0.46], gauntlet: [0, -0.23, -0.46],
};
// inclinação lateral de repouso (fora da mira). A direção do cano não entra aqui: ela é
// calculada para cada arma de modo que a linha do cano cruze o centro da mira (ver aimAt).
const HIP_ROLL = { pistol: -0.05, revolver: -0.05, smg: -0.16, ar: -0.18, ar2: -0.18, sniper: -0.16, shotgun: -0.18 };
const CONVERGE = 9; // distância (m) em que a linha do cano encontra o centro da tela

// Ângulos (rx, ry) que fazem a linha do cano, saindo da posição de repouso, passar por (0, 0, -D).
// Com a ordem de Euler XYZ, a inclinação lateral (rz) não altera a direção do cano.
function aimAt(hip, boreY, boreZ, D) {
  let rx = 0, ry = 0;
  const e = new THREE.Euler();
  const b = new THREE.Vector3();
  for (let i = 0; i < 4; i++) {
    e.set(rx, ry, 0);
    b.set(0, boreY, boreZ).applyEuler(e).add(V(...hip));
    const v = V(0, 0, -D).sub(b).normalize();
    ry = Math.asin(-v.x);
    rx = Math.atan2(v.y, -v.z);
  }
  return [rx, ry];
}
// ---------------------------------------------------------------- mãos e pegada
// Cada arma descreve as superfícies onde as mãos encostam (punho, guarda-mão, bomba, cabo) e a
// pose da palma; os dedos se fecham sozinhos até tocar essas superfícies (ver hands.js).
// Coordenadas no espaço da arma: x = direita, y = cima, z = -u (para trás). A mão de apoio é
// desenhada como mão direita do lado direito e espelhada para a esquerda.
let SLEEVE = null;

const V = (x, y, z) => new THREE.Vector3(x, y, z);
// ponto na superfície a partir de um ponto interno, seguindo uma direção, mais um afastamento
function onSurface(sdf, from, dir, off) {
  const d = V(...dir).normalize();
  const p = V(...from);
  for (let i = 0; i < 400 && sdf(p) < 0; i++) p.addScaledVector(d, 0.0008);
  return p.addScaledVector(d, off).toArray();
}

// punho de pistola inclinado: topo (u, y) e base (u, y), largura e espessura
function gripShape(top, bot, w, t) {
  const cz = -(top[0] + bot[0]) / 2, cy = (top[1] + bot[1]) / 2;
  const len = Math.hypot(top[0] - bot[0], top[1] - bot[1]);
  const ang = -Math.atan2(top[0] - bot[0], top[1] - bot[1]); // inclinação para trás
  const up = [0, Math.cos(ang), Math.sin(ang)];
  return { sdf: sdTiltBox([0, cy, cz], [w / 2, len / 2, t / 2], 0.009, ang), c: [0, cy, cz], up };
}

// mão do gatilho: palma no lado direito e atrás do punho, indicador estendido sobre o gatilho
function triggerPose(g, extra, o = {}) {
  const back = o.back || [0.82, 0, 0.57];
  const at = [g.c[0], g.c[1] + (o.dy ?? 0.008), g.c[2]];
  return {
    center: onSurface(sdUnion(g.sdf, extra), at, back, 0.0135),
    back, thumb: g.up, sdf: sdUnion(g.sdf, extra),
    index: { fixed: o.index || [0.32, 0.42, 0.34], splay: o.splay ?? 0.2 },
    thumbRot: o.thumbRot || [1.2, 0.3, 0], thumbCurl: o.thumbCurl || [1.2, 0.6, 0.3],
    elbow: o.elbow || [0.08, -0.4, 0.4], sleeve: 0.4,
  };
}

// mão de apoio por baixo do guarda-mão (lado direito antes do espelhamento)
function supportPose(sdf, axisY, z, o = {}) {
  const phi = o.phi ?? 0.8; // ângulo a partir de "para baixo"
  const back = [Math.sin(phi), -Math.cos(phi), 0];
  return {
    center: onSurface(sdf, [0, axisY, z], back, 0.0135),
    back, thumb: o.thumb || [0, 0.12, -1], sdf, slide: o.slide ?? 0.016,
    thumbRot: o.thumbRot || [0.3, 1.6, -0.6], thumbCurl: o.thumbCurl || [0.3, 0.25, 0.15],
    elbow: o.elbow || [0.0, -0.3, 0.12], sleeve: 0.38,
  };
}

const GRIPS = {
  pistol() {
    const g = gripShape([-0.04, -0.012], [-0.053, -0.115], 0.028, 0.044);
    const slide = sdBox([0, 0.025, 0.05], [0.0155, 0.032, 0.096], 0.004);
    const wide = (p) => g.sdf(p) - 0.011; // punho mais os dedos da mão do gatilho
    return [
      { pose: { ...triggerPose(g, slide, { thumbRot: [0.75, 1.3, -0.1], index: [0.22, 0.34, 0.3], splay: 0.24, elbow: [0.08, -0.4, 0.42] }), scale: 1 / 1.3 } },
      { mirror: true, pose: { center: onSurface(wide, [0, -0.07, 0.04], [0.78, -0.05, -0.62], 0.0135), back: [0.78, -0.05, -0.62], thumb: [0, 0.6, -0.8], sdf: wide, thumbRot: [0.15, 0.4, 0], thumbCurl: [0.15, 0.12, 0.1], elbow: [0.2, -0.42, 0.4], sleeve: 0.4, scale: 1 / 1.3 } },
    ];
  },
  revolver() {
    const g = gripShape([-0.05, -0.012], [-0.075, -0.125], 0.034, 0.05);
    const frame = sdBox([0, 0.027, 0.01], [0.012, 0.04, 0.056], 0.004);
    const wide = (p) => g.sdf(p) - 0.011;
    return [
      { pose: { ...triggerPose(g, frame, { thumbRot: [0.75, 1.3, -0.1], index: [0.22, 0.38, 0.32], splay: 0.26, elbow: [0.08, -0.4, 0.42] }), scale: 1 / 1.3 } },
      { mirror: true, pose: { center: onSurface(wide, [0, -0.075, 0.06], [0.78, -0.05, -0.62], 0.0135), back: [0.78, -0.05, -0.62], thumb: [0, 0.6, -0.8], sdf: wide, thumbRot: [0.15, 0.4, 0], thumbCurl: [0.15, 0.12, 0.1], elbow: [0.2, -0.42, 0.4], sleeve: 0.4, scale: 1 / 1.3 } },
    ];
  },
  smg() {
    const g = gripShape([-0.028, -0.008], [-0.046, -0.11], 0.032, 0.044);
    const recv = sdBox([0, 0.03, -0.08], [0.021, 0.04, 0.165], 0.004);
    const stub = sdBox([0, -0.024, -0.216], [0.015, 0.03, 0.017], 0.007);
    const sup = sdUnion(stub, recv);
    const sg = { sdf: stub, c: [0, -0.03, -0.216], up: [0, 1, 0] };
    return [
      { pose: triggerPose(g, recv) },
      { mirror: true, pose: { center: onSurface(sup, sg.c, [0.8, 0, 0.6], 0.0135), back: [0.8, 0, 0.6], thumb: [0, 1, -0.15], sdf: sup, thumbRot: [0.55, 1.1, -0.2], thumbCurl: 'wrap', elbow: [0.34, -0.4, 0.18], sleeve: 0.42 } },
    ];
  },
  ar() {
    const g = gripShape([-0.025, -0.008], [-0.054, -0.115], 0.034, 0.044);
    const recv = sdBox([0, 0.03, -0.035], [0.022, 0.039, 0.165], 0.004);
    const hg = sdUnion(sdBox([0, 0.027, -0.325], [0.025, 0.023, 0.12], 0.009), sdBox([0, 0.068, -0.31], [0.02, 0.012, 0.1], 0.008));
    return [{ pose: triggerPose(g, recv) }, { mirror: true, pose: supportPose(hg, 0.03, -0.24) }];
  },
  ar2() {
    const g = gripShape([-0.03, -0.01], [-0.046, -0.11], 0.032, 0.044);
    const recv = sdBox([0, 0.035, -0.03], [0.022, 0.035, 0.16], 0.004);
    const hg = sdBox([0, 0.039, -0.335], [0.023, 0.031, 0.14], 0.012);
    return [{ pose: triggerPose(g, recv) }, { mirror: true, pose: supportPose(hg, 0.039, -0.25) }];
  },
  sniper() {
    const g = gripShape([-0.035, -0.008], [-0.045, -0.118], 0.034, 0.046);
    const recv = sdBox([0, 0.03, 0.0], [0.024, 0.03, 0.12], 0.006);
    const hg = sdUnion(sdBox([0, 0.024, -0.215], [0.025, 0.02, 0.125], 0.008), sdBox([0, 0.056, -0.3], [0.0145, 0.0145, 0.2], 0.012));
    return [{ pose: triggerPose(g, recv) }, { mirror: true, pose: supportPose(hg, 0.026, -0.2) }];
  },
  shotgun() {
    const g = gripShape([-0.04, -0.01], [-0.083, -0.114], 0.036, 0.05);
    const recv = sdBox([0, 0.03, -0.06], [0.022, 0.04, 0.15], 0.004);
    const pump = sdUnion(sdBox([0, 0.015, -0.36], [0.025, 0.021, 0.09], 0.01), sdBox([0, 0.052, -0.36], [0.0138, 0.0138, 0.12], 0.012));
    return [{ pose: triggerPose(g, recv) }, { mirror: true, onPump: true, pose: supportPose(pump, 0.015, -0.315) }];
  },
  blade(type) {
    const hl = type === 'nodachi' ? 0.34 : 0.26;
    const u0 = 0.085 - 0.037;
    const hilt = sdBox([0, 0.001, -(u0 - hl / 2)], [0.0135, 0.018, hl / 2], 0.009);
    const fist = (u, mirror) => ({
      mirror, pose: {
        center: onSurface(hilt, [0, 0.001, -u], [0.7, -0.71, 0], 0.0135), back: [0.7, -0.71, 0], thumb: [0, 0.1, -1], sdf: hilt,
        thumbRot: [0.45, 1.5, -0.3], thumbCurl: 'wrap', fingers: { max: [2.1, 2.0, 1.5] },
        elbow: mirror ? [0.3, -0.35, 0.3] : [0.18, -0.4, 0.35], sleeve: 0.4, scale: 1 / 0.85,
      },
    });
    return [fist(u0 - 0.055, false), fist(u0 - hl + 0.06, true)];
  },
};
GRIPS.katana = () => GRIPS.blade('katana');
GRIPS.nodachi = () => GRIPS.blade('nodachi');

function buildHands(type, gun) {
  const sleeve = SLEEVE || gunMat('polymer', 0x414636);
  const mats = handMaterials(gunEnvironment());
  if (type === 'gauntlet') {
    // as manoplas cobrem as mãos: só antebraços e punhos
    const cuff = gunMat('polymer', 0x23261f);
    const k = new Kit();
    for (const sx of [-1, 1]) {
      k.box(0.086, 0.086, 0.3, sx * 0.13, -0.034, -0.37, sleeve, { rx: 0.1, b: 0.02 });
      k.box(0.092, 0.092, 0.03, sx * 0.13, -0.03, -0.235, cuff, { b: 0.01 });
    }
    return { main: k.build(), onPump: null };
  }
  const main = new THREE.Group();
  let onPump = null;
  for (const h of GRIPS[type]()) {
    const k = new Kit();
    buildHand(k, h.pose, mats, sleeve);
    const g = k.build();
    if (h.mirror) mirrorX(g);
    if (h.onPump && gun.pump) { gun.pump.add(g); onPump = g; } else main.add(g);
  }
  return { main, onPump };
}

export class ViewModel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.01, 10);
    this.scene.add(this.camera);
    // luz de estúdio: ambiente suave, principal quente e contorno frio vindo de trás
    this.hemi = new THREE.HemisphereLight(0xdfe8f5, 0x6a5a48, 0.55);
    this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight(0xfff0dc, 1.9);
    this.key.position.set(0.7, 1, 0.5);
    this.scene.add(this.key);
    this.rim = new THREE.DirectionalLight(0xa8c8ff, 1.2);
    this.rim.position.set(-0.8, 0.5, -0.9);
    this.scene.add(this.rim);
    this.flashLight = new THREE.PointLight(0xffb060, 0, 2.5, 2);
    this.flashLight.position.set(0.1, -0.05, -0.6);
    this.camera.add(this.flashLight);

    this.root = new THREE.Group();
    this.camera.add(this.root);
    this.pivot = new THREE.Group(); // recebe as animações
    this.root.add(this.pivot);

    const flashMat = new THREE.SpriteMaterial({ map: muzzleFlash(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: 0xffd9a0 });
    this.flash = new THREE.Sprite(flashMat);
    this.flash.visible = false;
    this.flashT = 0;

    this.models = new Map();
    this.current = null;
    this.def = null;

    this.sway = new THREE.Vector2();
    this.bobPhase = 0;
    this.idle = 0;
    this.kickZ = 0;
    this.kickRot = 0;
    this.kickSide = 0;
    this.slideKick = 0;
    this.switchT = 1;
    this.cycleT = 1;
    this.inspectT = 1;
    this.meleeT = 1;
    this.light = 1;
  }

  // Aplica a camuflagem do perfil às mangas; reconstrói os modelos já criados.
  setLook(look) {
    const key = look ? (look.uniform || look.camo) : '';
    if (this.lookKey === key) return;
    this.lookKey = key;
    if (look && look.uniform === 'swat') {
      // farda da unidade tática (modo história): azul-marinho liso
      SLEEVE = new THREE.MeshStandardMaterial({ color: 0x1c2532, roughness: 0.9, envMap: gunEnvironment(), envMapIntensity: 0.25 });
    } else {
      SLEEVE = look ? new THREE.MeshStandardMaterial({ map: camoTexture(look.camo), roughness: 0.92, envMap: gunEnvironment(), envMapIntensity: 0.25 }) : null;
    }
    for (const e of this.models.values()) e.holder.removeFromParent();
    this.models.clear();
    if (this.def) { const d = this.def; this.current = null; this.setWeapon(d, false); }
  }

  setAspect(a) {
    this.camera.aspect = a;
    this.camera.updateProjectionMatrix();
  }

  // Intensidade geral da luz sobre a arma (mapas escuros usam valores menores).
  setLight(f) {
    this.light = f;
    this.hemi.intensity = 0.55 * f;
    this.key.intensity = 1.9 * f;
    this.rim.intensity = 1.2 * f;
  }

  modelFor(def) {
    if (this.models.has(def.id)) return this.models.get(def.id);
    if (!this.scene.environment) this.scene.environment = gunEnvironment();
    const gun = buildGun(def);
    const holder = new THREE.Group();
    holder.add(gun.group);
    const t = def.model.type;
    const pistol = t === 'pistol' || t === 'revolver';
    const blade = t === 'katana' || t === 'nodachi';
    const hands = buildHands(t, gun);
    holder.add(hands.main);
    if (pistol) holder.scale.setScalar(1.3);
    if (t === 'gauntlet' || blade) holder.scale.setScalar(0.85);
    holder.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
    const hip = HIP[t] || HIP.ar;
    const sc = holder.scale.y;
    const aim = blade || t === 'gauntlet' ? [0, 0] : aimAt(hip, gun.muzzle.position.y * sc, gun.muzzle.position.z * sc, CONVERGE);
    const entry = { holder, gun, hip, aim, roll: HIP_ROLL[t] || 0, ads: pistol ? -0.46 : t === 'smg' ? -0.5 : t === 'gauntlet' ? -0.36 : -0.6 };
    this.models.set(def.id, entry);
    return entry;
  }

  setWeapon(def, animate = true) {
    if (this.current) this.pivot.remove(this.current.holder);
    this.def = def;
    this.current = this.modelFor(def);
    this.pivot.add(this.current.holder);
    this.current.gun.muzzle.add(this.flash);
    const beam = !!def.beam;
    this.flash.material.color.setHex(beam ? 0x8ff6ff : 0xffd9a0);
    this.flashLight.color.setHex(beam ? 0x5fe8ff : 0xffb060);
    this.muzzleIdx = 1;
    this.meleeT = 1;
    this.inspectT = 1;
    this.slideKick = 0;
    this.switchT = animate ? 0 : 1;
    this.cycleT = 1;
  }

  // Posição da boca do cano na tela (coordenadas normalizadas -1..1), para os traçantes saírem
  // exatamente de onde o jogador vê o cano.
  muzzleNDC(out) {
    if (!this.current || !this.root.visible) return null;
    this.current.gun.muzzle.updateWorldMatrix(true, false);
    return this.current.gun.muzzle.getWorldPosition(out).project(this.camera);
  }

  // Golpe de espada: alterna a direção dos cortes leves.
  swing(heavy) {
    this.meleeT = 0;
    this.inspectT = 1;
    this.meleeHeavy = heavy;
    this.meleeDir = heavy ? 1 : -(this.meleeDir || -1);
    this.meleeDur = heavy ? 0.55 : 0.32;
  }

  // Gira a arma diante da câmera para mostrá-la.
  inspect() {
    if (this.inspectT < 1 || this.switchT < 1) return;
    this.inspectT = 0;
  }

  fire(strength = 1) {
    const d = this.def;
    if (!d) return;
    this.inspectT = 1;
    if (d.melee) { this.swing(false); return; }
    const mz = this.current.gun.muzzles;
    if (mz) {
      this.muzzleIdx = 1 - this.muzzleIdx;
      mz[this.muzzleIdx].add(this.flash);
      this.kickSide += (this.muzzleIdx ? -1 : 1) * 0.015;
    }
    const k = clamp(d.recoil / 2, 0.35, 2.2) * strength;
    this.kickZ += 0.028 * k;
    this.kickRot += 0.05 * k;
    this.kickSide += (Math.random() - 0.5) * 0.02 * k;
    this.flash.visible = true;
    this.flash.material.rotation = Math.random() * Math.PI;
    const t = d.model.type;
    const s = t === 'shotgun' || t === 'sniper' ? 0.2 : 0.13;
    this.flash.scale.setScalar(s * (0.8 + Math.random() * 0.4));
    this.flashT = 0.045;
    this.flashLight.intensity = 6;
    if (t === 'shotgun' || t === 'sniper') this.cycleT = 0;
    if (t === 'pistol') this.slideKick = 1;
  }

  /*
   * s: { speed, sprint, sprintBlend, ads, reload (0..1|null), crouch, mdx, mdy, onGround, scoped, alive, empty }
   */
  update(dt, s) {
    if (!this.current) return;
    this.root.visible = s.alive && !s.scoped;
    const gun = this.current.gun;
    const type = this.def.model.type;
    // clarão
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) { this.flash.visible = false; this.flashLight.intensity = 0; }
    }
    // balanço do mouse
    this.sway.x = damp(this.sway.x, clamp(-s.mdx * 0.00035, -0.04, 0.04), 9, dt);
    this.sway.y = damp(this.sway.y, clamp(s.mdy * 0.00035, -0.04, 0.04), 9, dt);
    // passos e respiração
    const moveAmt = s.onGround ? Math.min(1, s.speed / 5) : 0;
    this.bobPhase += dt * (4 + s.speed * 1.5) * (moveAmt > 0.05 ? 1 : 0);
    this.idle += dt;
    const bobAmp = moveAmt * (s.sprint ? 1.8 : 1) * lerp(1, 0.25, s.ads);
    // coice
    this.kickZ = damp(this.kickZ, 0, 14, dt);
    this.kickRot = damp(this.kickRot, 0, 12, dt);
    this.kickSide = damp(this.kickSide, 0, 12, dt);
    this.slideKick = damp(this.slideKick, 0, 22, dt);
    this.switchT = Math.min(1, this.switchT + dt / 0.45);
    this.cycleT = Math.min(1, this.cycleT + dt / 0.7);

    const hip = this.current.hip;
    const adsPos = [0, -gun.sightY * this.current.holder.scale.y, this.current.ads];
    const a = s.ads;
    let px = lerp(hip[0], adsPos[0], a);
    let py = lerp(hip[1], adsPos[1], a);
    let pz = lerp(hip[2], adsPos[2], a);
    const aim = this.current.aim;
    let rx = aim[0] * (1 - a), ry = aim[1] * (1 - a), rz = this.current.roll * (1 - a);

    const breathe = (1 - a * 0.85) * (1 - moveAmt);
    px += this.sway.x + Math.sin(this.bobPhase) * 0.009 * bobAmp + Math.sin(this.idle * 0.9) * 0.0016 * breathe;
    py += this.sway.y - Math.abs(Math.cos(this.bobPhase)) * 0.011 * bobAmp + Math.sin(this.idle * 1.7) * 0.0022 * breathe;
    rz += Math.sin(this.bobPhase) * 0.015 * bobAmp;
    rx += Math.sin(this.idle * 1.7 + 0.6) * 0.004 * breathe;
    pz += this.kickZ;
    rx += this.kickRot;
    ry += this.kickSide;
    if (s.crouch) { py -= 0.01 * (1 - a); rz += 0.04 * (1 - a); }

    // corrida
    const sp = s.sprintBlend || 0;
    px += 0.03 * sp; py -= 0.04 * sp;
    rx -= 0.25 * sp; ry += 0.55 * sp; rz += 0.15 * sp;

    // recarga
    const mag = gun.mag;
    if (s.reload !== null && s.reload !== undefined) {
      this.inspectT = 1;
      const p = s.reload;
      const e = p < 0.15 ? p / 0.15 : p > 0.85 ? (1 - p) / 0.15 : 1;
      const ee = e * e * (3 - 2 * e);
      rz += 0.55 * ee; rx += -0.35 * ee; py -= 0.05 * ee; px -= 0.02 * ee;
      if (mag) {
        let off = 0;
        if (p > 0.15 && p < 0.45) off = (p - 0.15) / 0.3;
        else if (p >= 0.45 && p < 0.65) off = 1 - (p - 0.45) / 0.2;
        mag.position.y = -off * 0.3;
        mag.visible = off < 0.95;
      }
    } else if (mag) {
      mag.position.y = 0;
      mag.visible = true;
    }

    // ferrolho da pistola: recua a cada disparo e fica aberto com o pente vazio
    if (type === 'pistol' && gun.slide) {
      const open = s.empty && s.reload == null ? 0.032 : 0;
      gun.slide.position.z = Math.max(open, this.slideKick * 0.034);
    }
    // ciclo de bombeamento / ferrolho do rifle de precisão
    const c = this.cycleT < 1 ? Math.sin(this.cycleT * Math.PI) : 0;
    if (gun.pump) gun.pump.position.z = c * 0.085;
    if (type === 'sniper' && gun.slide) gun.slide.position.z = c * 0.07;
    if (c > 0) { rz += 0.12 * c * (1 - a); rx += 0.06 * c; }

    // inspeção
    if (this.inspectT < 1) {
      if (a > 0.2 || sp > 0.3) this.inspectT = 1;
      else {
        this.inspectT = Math.min(1, this.inspectT + dt / 3.2);
        const p = this.inspectT;
        const e = Math.min(1, p / 0.15, (1 - p) / 0.15);
        const ee = e * e * (3 - 2 * e);
        const w = Math.sin(p * Math.PI * 2);
        px -= 0.1 * ee; py += 0.05 * ee; pz += 0.06 * ee;
        ry += ee * (0.25 + 0.95 * w);
        rz += ee * (-0.35 * w - 0.25);
        rx += ee * 0.22;
      }
    }

    // troca de arma
    const sw = 1 - this.switchT;
    const swe = sw * sw;
    py -= 0.25 * swe; rx -= 0.9 * swe;

    // espadas: postura de guarda e animação de golpe
    if (this.def.melee) {
      rx += 0.7; ry += 0.4; rz += 1.05;
      if (this.meleeT < 1) {
        this.meleeT = Math.min(1, this.meleeT + dt / this.meleeDur);
        const p = this.meleeT;
        const env = p < 0.12 ? p / 0.12 : p > 0.6 ? 1 - (p - 0.6) / 0.4 : 1;
        if (this.meleeHeavy) {
          const th = Math.sin(Math.min(1, p / 0.6) * Math.PI);
          rx -= 1.0 * env; ry -= 0.3 * env; pz -= 0.32 * th; px -= 0.12 * env; py += 0.08 * env;
        } else {
          let k = Math.min(1, Math.max(0, (p - 0.08) / 0.32));
          k = k * k * (3 - 2 * k);
          const d = this.meleeDir;
          ry += d * (0.9 - 2.1 * k) * env;
          rx += (0.35 - 1.5 * k) * env;
          rz += d * (-0.7 + 1.4 * k) * env;
          px += d * (0.1 - 0.3 * k) * env;
          pz -= 0.1 * env;
        }
      }
    }

    // a coronha é ocultada na mira de precisão para não cobrir a visão
    for (const m of gun.stock) m.visible = a < 0.6;

    this.pivot.position.set(px, py, pz);
    this.pivot.rotation.set(rx, ry, rz);
  }
}

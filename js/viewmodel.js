// Arma em primeira pessoa: cena própria sobreposta ao mundo, com mãos e animações procedurais.
import * as THREE from 'three';
import { buildGun, Kit, gunMat, gunEnvironment } from './guns.js';
import { damp, lerp, clamp } from './utils.js';
import { muzzleFlash } from './textures.js';
import { camoTexture } from './profiles.js';

const HIP = {
  pistol: [0.14, -0.13, -0.42], revolver: [0.14, -0.13, -0.44], smg: [0.2, -0.22, -0.54],
  ar: [0.22, -0.23, -0.6], ar2: [0.22, -0.23, -0.6], sniper: [0.22, -0.24, -0.58], shotgun: [0.22, -0.23, -0.6],
  katana: [0.21, -0.27, -0.44], nodachi: [0.22, -0.29, -0.46], gauntlet: [0, -0.25, -0.5],
};
// posição (u) da mão esquerda no guarda-mão
const LEFT_U = { smg: 0.215, ar: 0.33, ar2: 0.33, sniper: 0.27, shotgun: 0.36 };

// Mãos enluvadas e antebraços, modelados no espaço da arma.
let SLEEVE = null;
function buildHands(type, gun) {
  const sleeve = SLEEVE || gunMat('polymer', 0x414636);
  const glove = gunMat('rubber', 0x1a1b1d);
  const pad = gunMat('polymer', 0x33363a);
  const cuff = gunMat('polymer', 0x23261f);
  const k = new Kit();
  const blade = type === 'katana' || type === 'nodachi';
  const pistol = type === 'pistol' || type === 'revolver';
  if (type === 'gauntlet') {
    for (const sx of [-1, 1]) {
      k.box(0.086, 0.086, 0.3, sx * 0.13, -0.034, -0.37, sleeve, { rx: 0.1, b: 0.02 });
      k.box(0.092, 0.092, 0.03, sx * 0.13, -0.03, -0.235, cuff, { b: 0.01 });
    }
    return { main: k.build(), onPump: null };
  }
  if (blade) {
    const us = type === 'nodachi' ? [0.005, -0.21] : [0.005, -0.15];
    us.forEach((u, i) => {
      const sx = i === 0 ? 1 : -1;
      k.box(0.05, 0.05, 0.062, 0, 0.0, u, glove, { b: 0.012 });
      for (let f = 0; f < 4; f++) k.box(0.054, 0.016, 0.0135, 0, -0.02, u - 0.022 + f * 0.0148, glove, { b: 0.004 });
      k.box(0.016, 0.018, 0.05, -sx * 0.02, 0.022, u + 0.005, glove, { b: 0.005 });
      k.box(0.03, 0.01, 0.04, sx * 0.012, 0.027, u, pad, { b: 0.003 });
      k.box(0.06, 0.058, 0.05, sx * 0.022, -0.035, u - 0.045, cuff, { rx: 0.5, ry: -sx * 0.32, b: 0.014 });
      k.box(0.07, 0.068, 0.3, sx * 0.065, -0.085, u - 0.17, sleeve, { rx: 0.5, ry: -sx * 0.32, b: 0.018 });
    });
    return { main: k.build(), onPump: null };
  }
  // mão direita no punho
  k.box(0.052, 0.074, 0.05, 0.01, -0.052, -0.04, glove, { rx: 0.2, b: 0.012 });
  for (let f = 0; f < 3; f++) k.box(0.05, 0.0165, 0.022, 0.001, -0.03 - f * 0.0195, -0.012 - f * 0.005, glove, { b: 0.005 });
  k.box(0.014, 0.014, 0.056, 0.0225, -0.013, 0.008, glove, { b: 0.004 }); // indicador estendido
  k.box(0.016, 0.017, 0.05, -0.022, -0.01, -0.02, glove, { b: 0.005 }); // polegar
  k.box(0.012, 0.04, 0.034, 0.036, -0.05, -0.042, pad, { rx: 0.2, b: 0.003 }); // proteção dos nós
  k.box(0.062, 0.06, 0.05, 0.03, -0.088, -0.09, cuff, { rx: 0.35, ry: -0.2, b: 0.014 });
  k.box(0.07, 0.068, 0.3, 0.052, -0.105, -0.21, sleeve, { rx: 0.35, ry: -0.2, b: 0.018 });
  // mão esquerda
  const kl = type === 'shotgun' ? new Kit() : k;
  if (pistol) {
    k.box(0.05, 0.062, 0.04, -0.02, -0.058, -0.03, glove, { rx: 0.2, ry: 0.25, b: 0.012 });
    for (let f = 0; f < 3; f++) k.box(0.056, 0.016, 0.02, -0.004, -0.036 - f * 0.019, 0.0 - f * 0.005, glove, { b: 0.005 });
    k.box(0.016, 0.016, 0.05, -0.024, 0.004, 0.0, glove, { b: 0.005 });
    k.box(0.062, 0.06, 0.05, -0.05, -0.092, -0.085, cuff, { rx: 0.35, ry: 0.4, b: 0.014 });
    k.box(0.07, 0.068, 0.3, -0.095, -0.112, -0.2, sleeve, { rx: 0.35, ry: 0.4, b: 0.018 });
  } else {
    const u = LEFT_U[type] ?? 0.33;
    const y = type === 'smg' ? -0.03 : type === 'shotgun' ? -0.024 : -0.012;
    kl.box(0.062, 0.03, 0.092, -0.004, y, u, glove, { b: 0.01 });
    for (let f = 0; f < 4; f++) kl.box(0.014, 0.046, 0.0185, 0.031, y + 0.03, u - 0.032 + f * 0.0212, glove, { b: 0.005 });
    kl.box(0.015, 0.042, 0.02, -0.034, y + 0.028, u - 0.03, glove, { rx: -0.3, b: 0.005 });
    kl.box(0.03, 0.008, 0.05, -0.002, y - 0.018, u, pad, { b: 0.003 });
    kl.box(0.062, 0.058, 0.05, -0.035, y - 0.02, u - 0.07, cuff, { rx: 0.25, ry: 0.45, b: 0.014 });
    kl.box(0.07, 0.068, 0.36, -0.1, y - 0.07, u - 0.22, sleeve, { rx: 0.25, ry: 0.45, b: 0.018 });
  }
  const main = k.build();
  let onPump = null;
  if (type === 'shotgun' && gun.pump) { onPump = kl.build(); gun.pump.add(onPump); }
  return { main, onPump };
}

export class ViewModel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(64, 1, 0.01, 10);
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
    const key = look ? look.camo : '';
    if (this.lookKey === key) return;
    this.lookKey = key;
    SLEEVE = look ? new THREE.MeshStandardMaterial({ map: camoTexture(look.camo), roughness: 0.92, envMap: gunEnvironment(), envMapIntensity: 0.25 }) : null;
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
    const entry = { holder, gun, hip: HIP[t] || HIP.ar, ads: pistol ? -0.46 : t === 'smg' ? -0.5 : t === 'gauntlet' ? -0.36 : -0.6 };
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
    let rx = 0, ry = 0, rz = 0;

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

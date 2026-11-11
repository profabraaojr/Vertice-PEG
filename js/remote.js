// Combatente controlado pela rede. No anfitrião representa um convidado; no convidado,
// representa todos os demais (anfitrião, outros convidados e bots).
import * as THREE from 'three';
import { Combatant } from './combatant.js';
import { CharacterModel } from './models.js';
import { WEAPONS } from './config.js';
import { angleDiff, lerp } from './utils.js';

export class Proxy extends Combatant {
  constructor(opts) {
    super(opts);
    this.isRemote = true;
    this.peerId = opts.peerId ?? null;
    this.model = new CharacterModel(opts.color, opts.look || null);
    this.target = new THREE.Vector3();
    this.targetYaw = 0;
    this.targetPitch = 0;
    this.netWeapon = WEAPONS.vp9;
    this.spawnSeq = 0;
    this.hasTarget = false;
  }

  // Estado recebido: posição, mira, postura e arma em mãos.
  applyNet(x, y, z, yaw, pitch, crouchT, weaponId, vx = 0, vz = 0) {
    this.target.set(x, y, z);
    this.targetYaw = yaw;
    this.targetPitch = pitch;
    this.crouchT = crouchT;
    this.vel.set(vx, 0, vz);
    if (WEAPONS[weaponId]) this.netWeapon = WEAPONS[weaponId];
    if (!this.hasTarget) {
      this.pos.copy(this.target);
      this.yaw = yaw;
      this.hasTarget = true;
    }
  }

  // Etiqueta com o nome sobre a cabeça (só para jogadores humanos).
  addNameTag(name, color = '#ffffff') {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.font = 'bold 30px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(name, 128, 32);
    ctx.fillStyle = color;
    ctx.fillText(name, 128, 32);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
    spr.scale.set(1.2, 0.3, 1);
    spr.position.y = 2.15;
    this.model.root.add(spr);
    this.nameTag = spr;
  }

  get weapon() {
    return { def: this.netWeapon, spread: () => 0, update() {}, mag: 1, reserve: 1, reloading: false, infinite: true };
  }

  spawnAt(x, z, yaw) {
    super.spawnAt(x, z, yaw);
    this.teleport(x, z, yaw);
  }

  teleport(x, z, yaw) {
    this.pos.set(x, 0, z);
    this.target.set(x, 0, z);
    this.yaw = this.targetYaw = yaw;
    this.hasTarget = true;
  }

  updateWeapons() { /* o estado das armas vive no computador de quem controla */ }

  update(dt) {
    if (this.alive && this.hasTarget) {
      const k = 1 - Math.exp(-14 * dt);
      // pequena extrapolação pela velocidade suaviza a cadência da rede
      this.target.x += this.vel.x * dt;
      this.target.z += this.vel.z * dt;
      if (this.pos.distanceToSquared(this.target) > 25) this.pos.copy(this.target);
      else this.pos.lerp(this.target, k);
      this.yaw += angleDiff(this.yaw, this.targetYaw) * k;
      this.pitch = lerp(this.pitch, this.targetPitch, k);
    }
    this.model.setWeapon(this.netWeapon);
    this.model.update(dt, this);
    if (this.nameTag) this.nameTag.visible = this.alive;
  }
}

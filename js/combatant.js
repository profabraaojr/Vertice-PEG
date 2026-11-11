// Base comum ao jogador e aos bots: corpo físico, vida, armas e caixas de acerto.
import * as THREE from 'three';
import { WeaponInstance } from './weapon.js';
import { WEAPONS } from './config.js';
import { lerp } from './utils.js';

export const STAND_H = 1.8;
export const CROUCH_H = 1.3;
export const RADIUS = 0.34;

export class Combatant {
  constructor(opts) {
    this.id = opts.id;
    this.name = opts.name;
    this.team = opts.team;
    this.color = opts.color;
    this.isPlayer = !!opts.isPlayer;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.radius = RADIUS;
    this.height = STAND_H;
    this.crouching = false;
    this.crouchT = 0;
    this.onGround = true;
    this.health = 100;
    this.alive = true;
    this.kills = 0;
    this.deaths = 0;
    this.headshots = 0;
    this.shots = 0;
    this.hits = 0;
    this.damageDealt = 0;
    this.weapons = { primary: null, secondary: null, melee: null };
    this.slot = 'secondary';
    this.respawnTimer = 0;
    this.spawnProtect = 0;
    this.spottedUntil = 0;
    this.lastAttacker = null;
    this.lastDamageTime = -10;
    this.deathTime = 0;
    this.switchT = 0;
    this.loadout = { primary: null, secondary: 'vp9', melee: 'katana' };
    this._hb = [
      { part: 'head', min: [0, 0, 0], max: [0, 0, 0] },
      { part: 'body', min: [0, 0, 0], max: [0, 0, 0] },
      { part: 'legs', min: [0, 0, 0], max: [0, 0, 0] },
    ];
  }

  setLoadout(primaryId, secondaryId, infinite = false, meleeId = 'katana') {
    meleeId = WEAPONS[meleeId] ? meleeId : 'katana';
    this.loadout = { primary: primaryId, secondary: secondaryId, melee: meleeId };
    this.weapons.primary = primaryId ? new WeaponInstance(WEAPONS[primaryId]) : null;
    this.weapons.secondary = new WeaponInstance(WEAPONS[secondaryId]);
    this.weapons.melee = new WeaponInstance(WEAPONS[meleeId]);
    for (const w of [this.weapons.primary, this.weapons.secondary]) if (w) w.infinite = infinite;
    this.slot = this.weapons.primary ? 'primary' : 'secondary';
    this.switchT = 0;
  }

  get weapon() {
    return this.weapons[this.slot];
  }

  eyeHeight() {
    return lerp(1.62, 1.12, this.crouchT);
  }

  eyePos(out) {
    return out.set(this.pos.x, this.pos.y + this.eyeHeight(), this.pos.z);
  }

  hitboxes() {
    const x = this.pos.x, y = this.pos.y, z = this.pos.z;
    const c = this.crouchT;
    const headY = y + lerp(1.6, 1.13, c);
    const hipY = y + lerp(0.86, 0.5, c);
    const [h, b, l] = this._hb;
    h.min[0] = x - 0.15; h.min[1] = headY - 0.14; h.min[2] = z - 0.15;
    h.max[0] = x + 0.15; h.max[1] = headY + 0.2; h.max[2] = z + 0.15;
    b.min[0] = x - 0.27; b.min[1] = hipY - 0.05; b.min[2] = z - 0.27;
    b.max[0] = x + 0.27; b.max[1] = headY - 0.14; b.max[2] = z + 0.27;
    l.min[0] = x - 0.2; l.min[1] = y; l.min[2] = z - 0.2;
    l.max[0] = x + 0.2; l.max[1] = hipY - 0.05; l.max[2] = z + 0.2;
    return this._hb;
  }

  spawnAt(x, z, yaw) {
    this.pos.set(x, 0, z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.health = 100;
    this.alive = true;
    this.crouching = false;
    this.crouchT = 0;
    this.height = STAND_H;
    this.onGround = true;
    this.lastAttacker = null;
    for (const w of [this.weapons.primary, this.weapons.secondary, this.weapons.melee]) if (w) w.refill();
    this.slot = this.weapons.primary ? 'primary' : 'secondary';
    this.switchT = 0;
  }

  updateWeapons(dt) {
    if (this.switchT > 0) this.switchT -= dt;
    const w = this.weapon;
    if (w) w.update(dt);
  }
}

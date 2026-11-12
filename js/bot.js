// Bots: percepção (visão e audição), navegação, combate e reação a dano.
import * as THREE from 'three';
import { Combatant, STAND_H, CROUCH_H } from './combatant.js';
import { CharacterModel } from './models.js';
import { DIFFICULTY } from './config.js';
import { angleDiff, clamp, rand, randInt, gauss, DEG, approach, lerp } from './utils.js';

const _eye = new THREE.Vector3();

export class Bot extends Combatant {
  constructor(opts, difficulty) {
    super(opts);
    this.diff = DIFFICULTY[difficulty] || DIFFICULTY.soldado;
    this.model = new CharacterModel(opts.color, opts.look || null, opts.style || null);
    this.state = 'roam';
    this.path = null;
    this.pathIdx = 0;
    this.repath = 0;
    this.target = null;
    this.targetVisible = false;
    this.lastKnown = new THREE.Vector3();
    this.lastSeen = -99;
    this.react = 0;
    this.think = Math.random() * 0.2;
    this.strafeDir = 0;
    this.strafeT = 0;
    this.burstLeft = 3;
    this.burstPause = 0;
    this.semiDelay = 0;
    this.err = new THREE.Vector2();
    this.errTarget = new THREE.Vector2();
    this.errT = 0;
    this.track = 0;
    this.aimHead = false;
    this.stuckTimer = 0;
    this.stuckRef = new THREE.Vector3();
    this.searchT = 0;
    this.retreatT = 0;
    this.alertYaw = 0;
    this.alertT = 0;
    this.stepDist = 0;
    this.passive = false;
    this.swordsman = Math.random() < 0.22; // perfil que prefere avançar com a espada
    this.wantCrouch = false;
    this.crouchTimer = 0;
    this.mv = { x: 0, z: 0 };
  }

  spawnAt(x, z, yaw) {
    super.spawnAt(x, z, yaw);
    this.state = 'roam';
    this.path = null;
    this.target = null;
    this.targetVisible = false;
    this.react = 0;
    this.model.setWeapon(this.weapon.def);
    this.model.update(0, this);
  }

  switchSlot(slot) {
    if (slot === this.slot || !this.weapons[slot]) return;
    this.weapon.cancelReload();
    this.slot = slot;
    this.switchT = 0.5;
    this.model.setWeapon(this.weapon.def);
  }

  setPath(game, x, z) {
    this.path = game.nav.find(this.pos.x, this.pos.z, x, z);
    this.pathIdx = 0;
    return !!this.path;
  }

  followPath() {
    if (!this.path) return false;
    while (this.pathIdx < this.path.length) {
      const p = this.path[this.pathIdx];
      const dx = p.x - this.pos.x, dz = p.z - this.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.55) { this.pathIdx++; continue; }
      this.mv.x = dx / dist;
      this.mv.z = dz / dist;
      return true;
    }
    this.path = null;
    return false;
  }

  turnTo(yaw, pitch, rate, dt) {
    const dy = angleDiff(this.yaw, yaw);
    const step = rate * dt * (1 + Math.abs(dy) * 2);
    this.yaw += clamp(dy, -step, step);
    this.pitch += clamp(pitch - this.pitch, -rate * dt, rate * dt);
  }

  // ---------- percepção ----------
  perceive(game) {
    const d = this.diff;
    this.eyePos(_eye);
    let best = null, bestScore = Infinity;
    for (const c of game.combatants) {
      if (c === this || !c.alive || !game.isEnemy(this, c)) continue;
      const dx = c.pos.x - this.pos.x, dz = c.pos.z - this.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > d.viewDist * (game.map.botView || 1)) continue; // no escuro e na mata os bots enxergam menos
      const ang = Math.abs(angleDiff(this.yaw, Math.atan2(-dx, -dz)));
      const loud = c.spottedUntil > game.time && dist < 30;
      const fov = c === this.target ? 1.6 : loud ? 1.5 : 1.05;
      if (ang > fov && dist > 3.5) continue;
      const headY = c.pos.y + lerp(1.6, 1.13, c.crouchT);
      let vis = game.world.clear(_eye.x, _eye.y, _eye.z, c.pos.x, headY, c.pos.z);
      if (!vis) vis = game.world.clear(_eye.x, _eye.y, _eye.z, c.pos.x, headY - 0.55, c.pos.z);
      if (!vis) continue;
      const score = dist + ang * 8 + (c === this.target ? -8 : 0);
      if (score < bestScore) { bestScore = score; best = c; }
    }
    if (best) {
      if (this.target !== best) {
        this.target = best;
        this.react = d.reaction * rand(0.8, 1.3) * (this.state === 'engage' ? 0.6 : 1);
        this.track = 0;
        this.errT = 0;
        this.aimHead = Math.random() < d.headChance;
      }
      this.targetVisible = true;
      this.lastKnown.copy(best.pos);
      this.lastSeen = game.time;
      if (this.state !== 'retreat') this.state = 'engage';
      game.markSpotted(best, this);
    } else {
      this.targetVisible = false;
      if (this.target && game.time - this.lastSeen > 0.7) {
        this.target = null;
        if (this.state === 'engage') {
          if (this.hold) { this.state = 'search'; this.searchT = 4; } else {
            this.state = 'chase';
            this.setPath(game, this.lastKnown.x, this.lastKnown.z);
          }
        }
      }
    }
  }

  hear(pos, source, game) {
    if (!this.alive || this.state === 'engage' || this.state === 'retreat') return;
    if (!game.isEnemy(this, source)) return;
    // guardas fixos (modo história) não abandonam o posto: só se viram para o barulho
    if (this.hold) { this.alertYaw = Math.atan2(-(pos.x - this.pos.x), -(pos.z - this.pos.z)); this.alertT = 2; this.state = 'search'; this.searchT = 4; return; }
    if (this.state === 'chase' && Math.random() < 0.6) return;
    this.lastKnown.copy(pos);
    this.state = 'chase';
    this.setPath(game, pos.x, pos.z);
  }

  onDamaged(attacker, game) {
    if (!attacker || attacker === this) return;
    if (!this.targetVisible || this.target !== attacker) {
      this.lastKnown.copy(attacker.pos);
      this.alertYaw = Math.atan2(-(attacker.pos.x - this.pos.x), -(attacker.pos.z - this.pos.z));
      this.alertT = 0.8;
      if (this.state !== 'engage') {
        if (this.hold) { this.state = 'search'; this.searchT = 4; } else {
          this.state = 'chase';
          this.setPath(game, attacker.pos.x, attacker.pos.z);
        }
      }
    }
    if (this.hold) return;
    if (this.health < 35 && this.state !== 'retreat' && Math.random() < 0.4) {
      const a = attacker.pos;
      const cell = game.nav.randomCell(([cx, cy]) => {
        const x = cx * 2 - 35, z = cy * 2 - 35;
        return Math.hypot(x - a.x, z - a.z) > 14 && Math.hypot(x - this.pos.x, z - this.pos.z) < 16;
      });
      if (cell && this.setPath(game, cell[0] * 2 - 35, cell[1] * 2 - 35)) {
        this.state = 'retreat';
        this.retreatT = 2.5;
      }
    }
  }

  // ---------- atualização ----------
  update(dt, game) {
    if (!this.alive) { this.model.update(dt, this); return; }
    if (this.ctrl && this.ctrl(dt, game)) return; // controle externo (modo história: reféns e rendidos)
    const d = this.diff;
    const w = this.weapon;
    this.think -= dt;
    if (this.think <= 0) {
      this.think = 0.11 + Math.random() * 0.08;
      this.perceive(game);
    }
    this.repath -= dt;
    this.semiDelay -= dt;
    if (this.alertT > 0) this.alertT -= dt;

    // manutenção fora de combate
    if (!this.target) {
      if (this.slot !== 'primary' && this.weapons.primary && !this.weapons.primary.empty) this.switchSlot('primary');
      else if (this.slot === 'melee' && this.weapons.secondary && !this.weapons.secondary.empty) this.switchSlot('secondary');
      if (!w.reloading && w.mag < w.def.mag * 0.5 && (w.reserve > 0 || w.infinite) && w.startReload()) game.botReload(this);
    }

    if (!game.canMove(this)) {
      this.vel.x = this.vel.z = 0;
      game.world.move(this, dt);
      this.model.update(dt, this);
      return;
    }

    this.mv.x = 0; this.mv.z = 0;
    let moving = false;
    let lookYaw = null;
    switch (this.state) {
      case 'engage':
        moving = this.engage(dt, game);
        break;
      case 'chase': {
        moving = this.followPath();
        if (!moving) { this.state = 'search'; this.searchT = rand(1.2, 2.6); }
        if (this.alertT > 0) lookYaw = this.alertYaw;
        break;
      }
      case 'retreat': {
        this.retreatT -= dt;
        moving = this.followPath();
        if (!moving || this.retreatT <= 0) this.state = this.target ? 'engage' : 'search';
        if (this.target && this.targetVisible) this.aimAt(this.target, dt, game, true);
        break;
      }
      case 'search': {
        this.searchT -= dt;
        lookYaw = this.yaw + Math.sin(game.time * 1.7 + this.id) * 1.2 * dt * 3;
        if (this.alertT > 0) lookYaw = this.alertYaw;
        if (this.searchT <= 0) this.state = 'roam';
        break;
      }
      default: {
        moving = this.followPath();
        if (!moving) {
          const g = game.pickRoamGoal(this);
          if (g) this.setPath(game, g.x, g.z);
          moving = this.followPath();
        }
      }
    }

    // orientação fora do combate: olha para onde anda
    if (this.state !== 'engage' && !(this.state === 'retreat' && this.targetVisible)) {
      if (lookYaw === null && moving) lookYaw = Math.atan2(-this.mv.x, -this.mv.z);
      if (lookYaw !== null) this.turnTo(lookYaw, 0, d.turnSpeed * 0.7, dt);
      this.wantCrouch = false;
    }

    // separação entre combatentes
    for (const o of game.combatants) {
      if (o === this || !o.alive) continue;
      const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z;
      const dd = dx * dx + dz * dz;
      if (dd < 0.8 && dd > 1e-4) {
        const k = (0.9 - Math.sqrt(dd)) * 2;
        this.mv.x += (dx / Math.sqrt(dd)) * k;
        this.mv.z += (dz / Math.sqrt(dd)) * k;
      }
    }

    // postura
    if (this.wantCrouch) this.crouching = true;
    else if (this.crouching && game.world.canStand(this, STAND_H)) this.crouching = false;
    this.crouchT = approach(this.crouchT, this.crouching ? 1 : 0, dt * 6);
    this.height = lerp(STAND_H, CROUCH_H, this.crouchT);

    // aplica movimento
    const ml = Math.hypot(this.mv.x, this.mv.z);
    const speed = (this.crouching ? 2.0 : 4.4) * this.weapon.def.speed * (this.weapon.def.melee && this.swordsman ? 1.25 : 1);
    const tx = ml > 0 ? (this.mv.x / Math.max(1, ml)) * speed : 0;
    const tz = ml > 0 ? (this.mv.z / Math.max(1, ml)) * speed : 0;
    const k = Math.min(1, dt * 10);
    this.vel.x += (tx - this.vel.x) * k;
    this.vel.z += (tz - this.vel.z) * k;
    game.world.move(this, dt);

    // detecção de travamento
    this.stuckTimer += dt;
    if (this.stuckTimer > 1.0) {
      const moved = Math.hypot(this.pos.x - this.stuckRef.x, this.pos.z - this.stuckRef.z);
      if (ml > 0.3 && moved < 0.35 && this.state !== 'engage') {
        this.path = null;
        if (this.state === 'chase') this.state = 'roam';
        this.vel.x += rand(-3, 3);
        this.vel.z += rand(-3, 3);
      }
      this.stuckRef.copy(this.pos);
      this.stuckTimer = 0;
    }

    // passos audíveis perto do jogador
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp > 1.5 && !this.crouching) {
      this.stepDist += sp * dt;
      if (this.stepDist > 2.3) {
        this.stepDist = 0;
        const L = game.listenerPos;
        if (L && this.pos.distanceToSquared(L) < 22 * 22) game.audio.footstep(0.55, this.pos);
      }
    }

    this.model.update(dt, this);
  }

  aimAt(t, dt, game, visible) {
    const d = this.diff;
    this.eyePos(_eye);
    const px = visible ? t.pos.x : this.lastKnown.x;
    const pz = visible ? t.pos.z : this.lastKnown.z;
    const tc = visible ? t.crouchT : 0;
    const headY = (visible ? t.pos.y : this.lastKnown.y) + lerp(1.6, 1.13, tc) + 0.02;
    const py = this.aimHead ? headY : headY - 0.45;
    const dx = px - _eye.x, dy = py - _eye.y, dz = pz - _eye.z;
    const horiz = Math.hypot(dx, dz);
    const dist = Math.hypot(horiz, dy);
    const desiredYaw = Math.atan2(-dx, -dz);
    const desiredPitch = Math.atan2(dy, horiz);
    // erro de mira que diminui enquanto o alvo é acompanhado
    this.errT -= dt;
    if (this.errT <= 0) {
      this.errT = rand(0.25, 0.55);
      const tSpeed = Math.hypot(t.vel.x, t.vel.z);
      const mySpeed = Math.hypot(this.vel.x, this.vel.z);
      const scale = d.aimError * DEG * Math.max(0.1, 1 - this.track * d.accuracyGain * 0.45) * (1 + Math.min(1, tSpeed / 5) * 0.6) * (mySpeed > 1 ? 1.25 : 1);
      this.errTarget.set(gauss() * scale, gauss() * scale * 0.6);
    }
    const ek = Math.min(1, dt * 5);
    this.err.x += (this.errTarget.x - this.err.x) * ek;
    this.err.y += (this.errTarget.y - this.err.y) * ek;
    this.track += dt;
    const ty = desiredYaw + this.err.x;
    const tp = desiredPitch + this.err.y;
    const dyaw = angleDiff(this.yaw, ty);
    const turn = d.turnSpeed * dt * (1 + Math.abs(dyaw) * 2.5);
    this.yaw += clamp(dyaw, -turn, turn);
    this.pitch += clamp(tp - this.pitch, -turn, turn);
    return { dist, off: Math.abs(angleDiff(this.yaw, desiredYaw)) + Math.abs(this.pitch - desiredPitch) };
  }

  engage(dt, game) {
    const d = this.diff;
    const t = this.target;
    if (!t || !t.alive) {
      this.target = null;
      this.state = 'search';
      this.searchT = rand(0.8, 1.6);
      return false;
    }
    let w = this.weapon;
    const { dist, off } = this.aimAt(t, dt, game, this.targetVisible);
    let moving = false;

    // corpo a corpo: puxa a espada colado no alvo ou quando as armas de fogo secaram
    const melee = this.weapons.melee;
    const gunsDry = (!this.weapons.primary || this.weapons.primary.empty) && this.weapons.secondary.empty;
    if (melee && this.slot !== 'melee' && this.targetVisible && (dist < (this.swordsman ? 9 : 2.0) || gunsDry) && this.switchT <= 0) {
      this.switchSlot('melee');
      w = this.weapon;
    } else if (this.slot === 'melee' && dist > (this.swordsman ? 16 : 5.5) && !gunsDry) {
      const back = this.weapons.primary && !this.weapons.primary.empty ? 'primary' : 'secondary';
      this.switchSlot(back);
      w = this.weapon;
    }
    if (w.def.melee) {
      if (this.repath <= 0) { this.setPath(game, t.pos.x, t.pos.z); this.repath = 0.5; }
      if (this.targetVisible && dist < (this.swordsman ? 12 : 6)) {
        const dx = t.pos.x - this.pos.x, dz = t.pos.z - this.pos.z;
        const l = Math.hypot(dx, dz) || 1;
        this.mv.x = dx / l; this.mv.z = dz / l;
        moving = true;
      } else moving = this.followPath();
      this.react -= dt;
      if (this.targetVisible && this.react <= 0 && dist < w.def.reach + 0.2 && off < 0.6 && w.canFire && this.switchT <= 0 && game.canShoot(this) && !this.passive) {
        game.meleeAttack(this, Math.random() < 0.3);
      }
      this.wantCrouch = false;
      return moving;
    }
    const pref = w.def.bot.pref;

    // deslocamento tático
    if (!this.targetVisible || dist > pref * 1.35) {
      if (this.repath <= 0) { this.setPath(game, this.lastKnown.x, this.lastKnown.z); this.repath = 0.8; }
      moving = this.followPath();
    }
    if (!moving && this.targetVisible) {
      this.strafeT -= dt;
      if (this.strafeT <= 0) {
        this.strafeT = rand(0.35, 1.1);
        this.strafeDir = Math.random() < d.strafeChance ? (Math.random() < 0.5 ? -1 : 1) : 0;
        this.wantCrouch = d.stopToShoot && w.def.auto && dist > 14 && Math.random() < 0.3;
      }
      const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
      this.mv.x = rx * this.strafeDir;
      this.mv.z = rz * this.strafeDir;
      if (dist < pref * 0.45 && w.def.id !== 'bulldog') {
        this.mv.x += Math.sin(this.yaw) * 0.7;
        this.mv.z += Math.cos(this.yaw) * 0.7;
      }
      moving = this.strafeDir !== 0;
    }

    // munição
    if (w.mag === 0 && !w.reloading) {
      const sec = this.weapons.secondary;
      if (this.slot === 'primary' && d.stopToShoot && sec && sec.mag > 0 && dist < 18) this.switchSlot('secondary');
      else if (w.startReload()) game.botReload(this);
      else if (this.slot === 'primary' && sec) this.switchSlot('secondary');
    }

    // disparo
    this.react -= dt;
    const tol = Math.max(0.03, Math.atan2(0.45, dist)) + d.aimError * DEG * 0.4;
    if (this.targetVisible && this.react <= 0 && off < tol && w.canFire && this.switchT <= 0 && game.canShoot(this) && !this.passive) {
      if (this.burstPause > 0) {
        this.burstPause -= dt;
      } else if (w.def.auto) {
        game.botFire(this);
        this.burstLeft--;
        if (this.burstLeft <= 0) {
          this.burstLeft = Math.max(1, Math.round(randInt(d.burst[0], d.burst[1]) * (dist > 25 ? 0.5 : 1)));
          this.burstPause = rand(0.18, 0.45) * (dist > 20 ? 1.6 : 1);
        }
      } else if (this.semiDelay <= 0) {
        game.botFire(this);
        this.semiDelay = rand(0.05, 0.3) * (1.3 - d.recoilControl) + (dist > 20 ? 0.12 : 0);
      }
    } else if (this.burstPause > 0) {
      this.burstPause -= dt;
    }
    if (d.stopToShoot && w.sinceShot < 0.2) { this.mv.x *= 0.15; this.mv.z *= 0.15; }
    return moving;
  }
}

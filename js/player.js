// Jogador: movimento em primeira pessoa, postura, câmera, recuo e uso das armas.
import { Combatant, STAND_H, CROUCH_H } from './combatant.js';
import { settings } from './settings.js';
import { clamp, approach, damp, DEG, lerp } from './utils.js';

const WALK = 4.7;
const SPRINT = 6.6;
const CROUCH = 2.1;
const JUMP_V = 6.3;

export class Player extends Combatant {
  constructor(opts) {
    super({ ...opts, isPlayer: true });
    this.ads = 0;
    this.zoomLevel = 0;
    this.sprinting = false;
    this.sprintBlend = 0;
    this.stepDist = 0;
    this.lastSlot = 'secondary';
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.landKick = 0;
    this.shake = 0;
    this.speed = 0;
    this.bob = 0;
  }

  resetView() {
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.zoomLevel = 0;
    this.ads = 0;
    this.shake = 0;
    this.landKick = 0;
  }

  switchTo(slot, game) {
    if (slot === this.slot || !this.weapons[slot]) return;
    const w = this.weapon;
    if (w) w.cancelReload();
    this.lastSlot = this.slot;
    this.slot = slot;
    this.switchT = 0.45;
    this.switchTime = game.time;
    this.zoomLevel = 0;
    game.viewmodel.setWeapon(this.weapon.def);
    game.audio.switchWeapon();
  }

  update(dt, input, game) {
    const world = game.world;
    const canMove = game.canMove(this);
    const canShoot = game.canShoot(this);
    const w = this.weapon;
    const def = w.def;

    // ---- mira ----
    let sens = 0.0021 * settings.sensitivity;
    if (this.zoomLevel > 0) sens *= settings.scopeSens * (game.currentFov / settings.fov);
    else sens *= lerp(1, 0.8, this.ads);
    this.yaw -= input.mouse.dx * sens;
    this.pitch -= input.mouse.dy * sens * (settings.invertY ? -1 : 1);
    this.pitch = clamp(this.pitch, -1.5, 1.5);

    // ---- troca de armas ----
    if (input.justPressed('Digit1')) this.switchTo('primary', game);
    if (input.justPressed('Digit2')) this.switchTo('secondary', game);
    if (input.justPressed('KeyQ')) this.switchTo(this.lastSlot, game);
    if (input.justPressed('Digit3')) this.switchTo('melee', game);
    if (input.justPressed('KeyF')) game.viewmodel.inspect();
    if (input.mouse.wheel !== 0) {
      const order = ['primary', 'secondary', 'melee'].filter((k) => this.weapons[k]);
      const i = order.indexOf(this.slot);
      this.switchTo(order[(i + (input.mouse.wheel > 0 ? 1 : order.length - 1)) % order.length], game);
    }

    // ---- agachar ----
    const wantCrouch = input.down('KeyC') || input.down('ControlLeft');
    if (wantCrouch) this.crouching = true;
    else if (this.crouching && world.canStand(this, STAND_H)) this.crouching = false;
    this.crouchT = approach(this.crouchT, this.crouching ? 1 : 0, dt * 7);
    this.height = lerp(STAND_H, CROUCH_H, this.crouchT);

    // ---- deslocamento ----
    let fwd = 0, str = 0;
    if (canMove) {
      fwd = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
      str = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
    }
    const firing = (input.mouse.left || input.mouse.leftPressed || (def.melee && input.mouse.right)) && canShoot;
    this.sprinting = canMove && input.down('ShiftLeft') && fwd > 0 && !this.crouching && !firing && this.ads < 0.2 && this.zoomLevel === 0;
    this.sprintBlend = approach(this.sprintBlend, this.sprinting ? 1 : 0, dt * 6);
    let maxSpeed = this.crouching ? CROUCH : this.sprinting ? SPRINT : WALK;
    maxSpeed *= def.speed;
    if (this.ads > 0.5 || this.zoomLevel > 0) maxSpeed *= 0.62;

    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let wx = -sy * fwd + cy * str;
    let wz = -cy * fwd - sy * str;
    const wl = Math.hypot(wx, wz);
    if (wl > 0) { wx /= wl; wz /= wl; }
    const tx = wx * maxSpeed, tz = wz * maxSpeed;
    const accel = this.onGround ? (wl > 0 ? 45 : 32) : 7;
    const dvx = tx - this.vel.x, dvz = tz - this.vel.z;
    const dl = Math.hypot(dvx, dvz);
    if (dl > 0 && (this.onGround || wl > 0)) {
      const k = Math.min(1, (accel * dt) / dl);
      this.vel.x += dvx * k;
      this.vel.z += dvz * k;
    }
    if (canMove && input.justPressed('Space') && this.onGround && this.crouchT < 0.5) {
      this.vel.y = JUMP_V;
      this.onGround = false;
      game.audio.jump();
    }
    const vyBefore = this.vel.y;
    const wasGround = this.onGround;
    world.move(this, dt);
    if (!wasGround && this.onGround && vyBefore < -3) {
      this.landKick = Math.min(0.12, -vyBefore * 0.012);
      game.audio.land(Math.min(0.7, -vyBefore * 0.06));
    }
    this.speed = Math.hypot(this.vel.x, this.vel.z);

    // passos
    if (this.onGround && this.speed > 1.2 && !this.crouching) {
      this.stepDist += this.speed * dt;
      const stride = this.sprinting ? 2.5 : 2.1;
      if (this.stepDist > stride) {
        this.stepDist = 0;
        game.audio.footstep(this.sprinting ? 0.45 : 0.25);
        game.noise(this.pos, this.sprinting ? 16 : 9, this);
      }
    }

    // ---- espadas: esquerdo corta, direito desfere golpe pesado ----
    if (def.melee) {
      this.ads = approach(this.ads, 0, dt * 8);
      this.zoomLevel = 0;
      const canSwing = canShoot && !this.sprinting && this.switchT <= 0 && w.cooldown <= 0;
      if (canSwing && (input.mouse.right || input.mouse.rightPressed)) game.meleeAttack(this, true);
      else if (canSwing && (input.mouse.left || input.mouse.leftPressed)) game.meleeAttack(this, false);
      this.landKick = damp(this.landKick, 0, 8, dt);
      this.shake = damp(this.shake, 0, 6, dt);
      this.recoilPitch = approach(this.recoilPitch, 0, 20 * dt);
      this.recoilYaw = approach(this.recoilYaw, 0, 20 * dt);
      return;
    }

    // ---- mira com o botão direito ----
    if (def.zoom) {
      if (input.mouse.rightPressed && canShoot && !w.reloading && !this.sprinting) {
        this.zoomLevel = (this.zoomLevel + 1) % (def.zoom.length + 1);
        game.audio.zoom();
      }
      if (this.sprinting || w.reloading) this.zoomLevel = 0;
      this.ads = approach(this.ads, 0, dt * 8);
    } else {
      const want = input.mouse.right && !this.sprinting && !w.reloading && this.switchT <= 0;
      this.ads = approach(this.ads, want ? 1 : 0, dt * 7);
      this.zoomLevel = 0;
    }

    // ---- recarga ----
    if (input.justPressed('KeyR') && w.startReload()) {
      game.audio.reload(def);
      this.zoomLevel = 0;
    }

    // ---- disparo ----
    const trigger = input.mouse.left || input.mouse.leftPressed; // cliques curtos entre quadros também contam
    if (!input.mouse.left && !input.mouse.leftPressed) w.triggerReleased = true;
    if (trigger && canShoot && !this.sprinting && this.switchT <= 0) {
      if (!w.reloading) {
        if (w.mag <= 0) {
          if (w.triggerReleased) {
            w.triggerReleased = false;
            game.audio.dryFire();
            if (w.startReload()) game.audio.reload(def);
          }
        } else if (w.cooldown <= 0 && (def.auto || w.triggerReleased)) {
          w.triggerReleased = false;
          game.playerFire(this);
        }
      }
    }
    // recarga automática quando o pente esvazia
    if (w.mag === 0 && !w.reloading && w.cooldown <= 0 && !input.mouse.left && (w.reserve > 0 || w.infinite)) {
      if (w.startReload()) game.audio.reload(def);
    }

    // ---- recuperação do recuo ----
    if (w.sinceShot > 0.09) {
      const rr = def.recoilRecover * dt;
      this.recoilPitch = approach(this.recoilPitch, 0, rr * (1.6 + Math.abs(this.recoilPitch) * 0.35));
      this.recoilYaw = approach(this.recoilYaw, 0, rr * (1.2 + Math.abs(this.recoilYaw) * 0.3));
    }
    this.landKick = damp(this.landKick, 0, 8, dt);
    this.shake = damp(this.shake, 0, 6, dt);
  }

  applyCamera(camera, dt) {
    const eye = this.eyeHeight();
    const bobAmt = this.onGround ? Math.min(1, this.speed / 5) : 0;
    this.bob += dt * (5 + this.speed * 1.4) * (bobAmt > 0.1 ? 1 : 0);
    const bobY = Math.sin(this.bob * 2) * 0.025 * bobAmt * (1 - this.ads * 0.8);
    camera.position.set(this.pos.x, this.pos.y + eye + bobY - this.landKick, this.pos.z);
    const sh = this.shake;
    camera.rotation.order = 'YXZ';
    camera.rotation.y = this.yaw + this.recoilYaw * DEG + (Math.random() - 0.5) * sh * 0.03;
    camera.rotation.x = clamp(this.pitch + this.recoilPitch * DEG, -1.55, 1.55) + (Math.random() - 0.5) * sh * 0.03;
    camera.rotation.z = Math.sin(this.bob) * 0.004 * bobAmt;
  }
}

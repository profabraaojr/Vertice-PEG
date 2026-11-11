// Partida cooperativa. O anfitrião roda as regras, os bots e todo o dano; cada convidado
// simula apenas o próprio movimento e as próprias armas, envia posição, mira e disparos,
// e recebe do anfitrião o estado do mundo (~20 vezes por segundo) e os efeitos.
import * as THREE from 'three';
import { Proxy } from './remote.js';
import { Player } from './player.js';
import { TEAMS, WEAPONS } from './config.js';
import { settings } from './settings.js';
import { rayAABB } from './utils.js';
import { sanitizeLook, activeLook, playerName, STUDENTS, getLook } from './profiles.js';

const SNAP_DT = 0.05; // 20 Hz
const INPUT_DT = 1 / 30;
const MATS = ['concrete', 'wood', 'metal'];
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
const _e = new THREE.Vector3();
const _n = new THREE.Vector3();
const _m = new THREE.Vector3();
const oArr = [0, 0, 0];
const dArr = [0, 0, 0];

export const EMPTY_INPUT = {
  mouse: { dx: 0, dy: 0, left: false, right: false, leftPressed: false, rightPressed: false, wheel: 0 },
  down: () => false,
  justPressed: () => false,
};

export function installCoop(Game) {
  const P = Game.prototype;

  Object.defineProperty(P, 'isHost', { get() { return !!(this.net && this.net.role === 'host' && this.coop); } });
  Object.defineProperty(P, 'isClient', { get() { return !!(this.net && this.net.role === 'guest' && this.coop); } });

  P.byId = function (id) {
    return this.combatants.find((c) => c.id === id) || null;
  };

  // ================= ANFITRIÃO =================
  P.createRemote = function (peer, team) {
    const color = TEAMS[team] ? TEAMS[team].color : 0x6dff9e;
    const r = new Proxy({ id: 100 + peer.id, name: peer.name, team, color, peerId: peer.id, look: peer.look ? sanitizeLook(peer.look, peer.name) : null });
    r.look = peer.look ? sanitizeLook(peer.look, peer.name) : null;
    const lo = peer.loadout || {};
    r.setLoadout(WEAPONS[lo.primary] ? lo.primary : 'tempest', WEAPONS[lo.secondary] ? lo.secondary : 'vp9', this.config.mode === 'training', lo.melee);
    r.netWeapon = r.weapons.primary ? r.weapons.primary.def : r.weapons.secondary.def;
    r.addNameTag(r.name, TEAMS[team] ? TEAMS[team].css : '#ffffff');
    this.scene.add(r.model.root);
    return r;
  };

  P.roster = function () {
    return this.combatants.map((c) => ({
      id: c.id, name: c.isPlayer ? this.net.myName : c.name, team: c.team, color: c.color,
      peer: c.isRemote ? c.peerId : null, kind: c.isPlayer ? 'host' : c.isRemote ? 'guest' : 'bot',
      look: c.isPlayer ? activeLook() : c.isRemote ? c.look : (STUDENTS.includes(c.name) ? getLook(c.name) : null),
    }));
  };

  P.broadcastStart = function () {
    this.fxQueue = [];
    this.snapT = 0;
    this.net.broadcast({ t: 'start', config: this.config, roster: this.roster() });
  };

  P.notifySpawn = function (c) {
    c.spawnSeq = (c.spawnSeq || 0) + 1;
    this.net.sendTo(c.peerId, { t: 'spawn', x: r2(c.pos.x), z: r2(c.pos.z), yaw: r3(c.yaw), s: c.spawnSeq, prot: this.config.mode === 'team' ? 0 : 1.5 });
  };

  // Mensagens que exibem algo ao jogador: localmente e, no anfitrião, em todos.
  P.announce = function (title, sub = '', dur = 2.5, color = null, sound = null, extra = {}) {
    this.hud.center(title, sub, dur, color);
    this.playAnnounceSound(sound, extra);
    if (this.isHost) this.net.broadcast({ t: 'ann', title, sub, dur, color, sound, ...extra });
  };

  P.playAnnounceSound = function (sound, extra) {
    if (sound === 'roundStart') this.audio.roundStart();
    else if (sound === 'beep') this.audio.beep(660, 0.15, 0.12);
    else if (sound === 'roundEnd') this.audio.roundEnd(extra.win === this.player.team);
    else if (sound === 'matchEnd') this.audio.roundEnd(!!extra.win);
  };

  P.fxBegin = function () {
    this.fxRec = this.isHost ? [] : null;
  };

  P.fxRecordEnd = function (end, type, n, mat) {
    if (!this.fxRec) return;
    this.fxRec.push([r2(end.x), r2(end.y), r2(end.z), type, n ? r2(n.x) : 0, n ? r2(n.y) : 0, n ? r2(n.z) : 0, Math.max(0, MATS.indexOf(mat))]);
  };

  P.fxEndShot = function (shooter, def, muzzle) {
    if (!this.fxRec) return;
    this.fxQueue.push({ k: 's', id: shooter.id, w: def.id, m: [r2(muzzle.x), r2(muzzle.y), r2(muzzle.z)], e: this.fxRec });
    this.fxRec = null;
  };

  P.fxPush = function (entry) {
    if (this.isHost) this.fxQueue.push(entry);
  };

  P.hostHandle = function (peerId, msg) {
    if (!this.active) return;
    const r = this.combatants.find((c) => c.isRemote && c.peerId === peerId);
    if (!r) return;
    switch (msg.t) {
      case 'in':
        if (msg.s !== r.spawnSeq || !r.alive) return;
        r.applyNet(msg.p[0], msg.p[1], msg.p[2], msg.yw, msg.pt, msg.ct, msg.w, msg.v[0], msg.v[1]);
        break;
      case 'fire': {
        if (!r.alive || !this.canShoot(r)) return;
        const def = WEAPONS[msg.w];
        if (!def || def.melee) return;
        r.spawnProtect = 0;
        r.shots++;
        _o.set(msg.o[0], msg.o[1], msg.o[2]);
        // a origem informada precisa estar perto do corpo do convidado
        if (_o.distanceTo(r.pos) > 3) _o.set(r.pos.x, r.pos.y + r.eyeHeight(), r.pos.z);
        this.fxBegin();
        const hitsBefore = r.hits;
        for (const dd of (msg.d || []).slice(0, 12)) {
          _d.set(dd[0], dd[1], dd[2]).normalize();
          this.resolveShot(r, _o, _d, def);
        }
        if (def.pellets > 1 && r.hits > hitsBefore) r.hits = hitsBefore + 1;
        this.fxEndShot(r, def, r.model.muzzleWorld(_m));
        r.spottedUntil = this.time + 1.2;
        this.noise(_o, 50, r);
        break;
      }
      case 'melee': {
        const def = WEAPONS[msg.w];
        if (!r.alive || !def || !def.melee || !this.canShoot(r)) return;
        r.spawnProtect = 0;
        r.pendingMelee = { t: msg.h ? 0.22 : 0.12, heavy: !!msg.h, def };
        r.model.swing();
        this.fxPush({ k: 'm', id: r.id, h: msg.h ? 1 : 0 });
        this.noise(r.pos, 8, r);
        break;
      }
      case 'loadout':
        r.setLoadout(msg.primary, msg.secondary, this.config.mode === 'training', msg.melee);
        break;
      default: break;
    }
  };

  P.removePeer = function (peerId, name) {
    const r = this.combatants.find((c) => c.isRemote && c.peerId === peerId);
    if (!r) return;
    this.scene.remove(r.model.root);
    this.combatants = this.combatants.filter((c) => c !== r);
    this.announce(`${name || r.name} saiu da partida`, '', 2.5);
    this.checkRoundEnd();
  };

  P.hostTick = function (dt) {
    this.snapT = (this.snapT || 0) - dt;
    if (this.snapT > 0) return;
    this.snapT = SNAP_DT;
    const t = this.time;
    const e = this.combatants.map((c) => [
      c.id, r2(c.pos.x), r2(c.pos.y), r2(c.pos.z), r3(c.yaw), r3(c.pitch), r2(c.crouchT), c.alive ? 1 : 0,
      Math.max(0, Math.round(c.health)), c.weapon.def.id, c.kills, c.deaths, c.headshots, Math.round(c.damageDealt), c.shots, c.hits,
      ((c.spotted && c.spotted.A > t) || c.spottedUntil > t) ? 1 : 0, r2(c.vel.x), r2(c.vel.z),
      c.spawnProtect > 0 ? 1 : 0,
    ]);
    this.net.broadcast({ t: 'snap', tm: r2(t), ph: this.phase, pt: r2(this.phaseT), rd: this.round, ts: this.teamScore, e }, true);
    if (this.fxQueue.length) {
      for (const peer of this.net.connectedPeers) {
        const myId = 100 + peer.id;
        const list = this.fxQueue.filter((f) => f.id !== myId);
        if (list.length) this.net.send(peer, { t: 'fx', l: list });
      }
      this.fxQueue = [];
    }
  };

  P.serializeResults = function (r) {
    return {
      ...r,
      rows: r.rows.map((c) => ({ id: c.id, name: c.isPlayer ? this.net.myName : c.name, team: c.team, color: c.color, kills: c.kills, deaths: c.deaths, headshots: c.headshots, damageDealt: c.damageDealt })),
    };
  };

  // ================= CONVIDADO =================
  P.startClient = function (msg) {
    this.cleanup();
    this.coop = true;
    this.config = msg.config;
    const mode = this.config.mode;
    this.time = 0;
    this.round = 0;
    this.phase = 'freeze';
    this.phaseT = 0;
    this.teamScore = { A: 0, B: 0 };
    this.deathCam = null;
    this.pendingLoadout = null;
    this.inputT = 0;
    this.lastSnap = -1;
    this.bots = [];
    this.combatants = [];
    for (const rr of msg.roster) {
      if (rr.peer === this.net.myId) {
        const p = new Player({ id: rr.id, name: playerName(), team: rr.team, color: rr.color });
        p.setLoadout(settings.loadout.primary, settings.loadout.secondary, mode === 'training', settings.loadout.melee);
        p.alive = false;
        p.spawnSeq = 0;
        p.respawnTimer = 0;
        this.player = p;
        this.combatants.push(p);
      } else {
        const c = new Proxy({ id: rr.id, name: rr.name, team: rr.team, color: rr.color, look: rr.look ? sanitizeLook(rr.look, rr.name) : null });
        c.alive = false;
        if (rr.kind !== 'bot') c.addNameTag(rr.name, TEAMS[rr.team] ? TEAMS[rr.team].css : '#ffffff');
        this.scene.add(c.model.root);
        this.combatants.push(c);
      }
    }
    this.viewmodel.setWeapon(this.player.weapon.def, false);
    this.effects.clear();
    this.active = true;
    this.paused = false;
    this.hud.setupMatch(this);
  };

  P.clientHandle = function (msg) {
    const p = this.player;
    switch (msg.t) {
      case 'snap': {
        if (msg.tm < this.lastSnap) return; // canal rápido não garante ordem
        this.lastSnap = msg.tm;
        if (Math.abs(this.time - msg.tm) > 0.3) this.time = msg.tm;
        this.phase = msg.ph;
        this.phaseT = msg.pt;
        this.round = msg.rd;
        this.teamScore = msg.ts;
        for (const e of msg.e) {
          const c = this.byId(e[0]);
          if (!c) continue;
          c.kills = e[10]; c.deaths = e[11]; c.headshots = e[12]; c.damageDealt = e[13]; c.shots = e[14]; c.hits = e[15];
          if (c === p) {
            if (p.alive) p.health = e[8];
            continue;
          }
          const wasAlive = c.alive;
          c.alive = !!e[7];
          c.health = e[8];
          c.spawnProtect = e[19] ? 1 : 0;
          if (c.alive && !wasAlive) c.teleport(e[1], e[3], e[4]);
          c.applyNet(e[1], e[2], e[3], e[4], e[5], e[6], e[9], e[17], e[18]);
          if (e[16]) c.spotted = { [p.team]: this.time + 0.6 };
        }
        break;
      }
      case 'spawn': {
        if (this.pendingLoadout) {
          const lo = this.pendingLoadout;
          p.setLoadout(lo.primary, lo.secondary, this.config.mode === 'training', lo.melee);
          this.pendingLoadout = null;
        }
        p.spawnAt(msg.x, msg.z, msg.yaw);
        p.spawnSeq = msg.s;
        p.spawnTime = this.time;
        p.spawnProtect = msg.prot || 0;
        p.resetView();
        this.viewmodel.setWeapon(p.weapon.def, true);
        this.deathCam = null;
        this.hud.onRespawn();
        if (this.config.mode === 'team') this.effects.clear();
        break;
      }
      case 'died': {
        const killer = this.byId(msg.k);
        p.alive = false;
        p.health = 0;
        p.zoomLevel = 0;
        p.respawnTimer = msg.rt == null ? Infinity : msg.rt;
        this.deathCam = { killer, t: 0 };
        this.audio.death();
        this.hud.onDeath(killer, WEAPONS[msg.w], this);
        break;
      }
      case 'dmg': {
        const from = this.byId(msg.a) || { pos: new THREE.Vector3(msg.ax, 0, msg.az) };
        this.hud.damage(from, this);
        this.audio.hurt();
        p.shake = Math.min(1.2, p.shake + msg.amt / 35);
        p.recoilPitch += Math.min(3, msg.amt * 0.05);
        p.health = msg.hp;
        p.lastDamageTime = this.time;
        break;
      }
      case 'hit':
        this.hud.hitmarker(!!msg.h, !!msg.k);
        this.audio.hitmarker(!!msg.h);
        if (msg.k) this.audio.killConfirm();
        break;
      case 'kf': {
        const a = this.byId(msg.a), v = this.byId(msg.v);
        if (v) this.hud.killfeed(a, v, WEAPONS[msg.w], !!msg.hs, this);
        break;
      }
      case 'ann':
        this.hud.center(msg.title, msg.sub, msg.dur, msg.color);
        this.playAnnounceSound(msg.sound, msg);
        break;
      case 'fx':
        for (const f of msg.l) this.clientFx(f);
        break;
      case 'end': {
        const res = msg.r;
        res.rows = res.rows.map((row) => ({ ...row, isPlayer: row.id === p.id }));
        res.acc = p.shots ? Math.round((p.hits / p.shots) * 100) : 0;
        res.hs = p.kills ? Math.round((p.headshots / p.kills) * 100) : 0;
        if (this.onMatchEnd) { this.active = false; this.onMatchEnd(res); }
        break;
      }
      default: break;
    }
  };

  P.clientFx = function (f) {
    const c = this.byId(f.id);
    const L = this.listenerPos;
    if (f.k === 's') {
      const def = WEAPONS[f.w];
      if (!def) return;
      _m.set(f.m[0], f.m[1], f.m[2]);
      const first = f.e[0];
      _d.set(first ? first[0] - _m.x : 0, first ? first[1] - _m.y : 0, first ? first[2] - _m.z : -1).normalize();
      this.effects.muzzle(_m, _d, !!def.beam);
      if (L.distanceToSquared(_m) < 120 * 120) this.audio.shot(def.sound, _m, 1);
      f.e.forEach((e, i) => {
        _e.set(e[0], e[1], e[2]);
        if (def.beam) this.effects.beam(_m, _e);
        else if (i < 2) this.effects.tracer(_m, _e, 260);
        _n.set(e[4], e[5], e[6]);
        if (e[3] === 1) {
          if (def.beam) this.effects.energyImpact(_e, _n); else this.effects.impact(_e, _n, MATS[e[7]]);
          if (L.distanceToSquared(_e) < 1600) this.audio.impact(_e, MATS[e[7]]);
        } else if (e[3] === 2) {
          _d.subVectors(_e, _m).normalize();
          if (def.beam) this.effects.energyHit(_e, _d); else this.effects.blood(_e, _d, false);
        }
      });
      if (c) c.spottedUntil = this.time + 1.2;
    } else if (f.k === 'm') {
      if (c && c.model) c.model.swing();
      if (c) this.audio.swing(!!f.h, c.pos);
    } else if (f.k === 'mh') {
      _e.set(f.p[0], f.p[1], f.p[2]);
      _d.set(f.d[0], f.d[1], f.d[2]);
      this.effects.blood(_e, _d, false);
      this.effects.slash(_e, _d);
      this.audio.slashHit(_e);
    }
  };

  // Disparo do convidado: efeitos locais imediatos; o dano é decidido pelo anfitrião.
  P.visualShot = function (shooter, o, d, def) {
    const maxD = 250;
    const hit = this.world.raycast(o.x, o.y, o.z, d.x, d.y, d.z, maxD);
    let best = hit ? hit.t : maxD;
    let body = null;
    const wall = hit ? { n: new THREE.Vector3(hit.nx, hit.ny, hit.nz), mat: hit.ground ? 'concrete' : (hit.box ? hit.box.mat : 'concrete') } : null;
    oArr[0] = o.x; oArr[1] = o.y; oArr[2] = o.z;
    dArr[0] = d.x; dArr[1] = d.y; dArr[2] = d.z;
    for (const c of this.combatants) {
      if (c === shooter || !c.alive) continue;
      for (const hb of c.hitboxes()) {
        const r = rayAABB(oArr, dArr, hb, best);
        if (r && r.t < best && !def.pierce) { best = r.t; body = c; }
        else if (r && def.pierce && !body) body = c;
      }
    }
    const end = new THREE.Vector3().copy(o).addScaledVector(d, best);
    if (body && !def.pierce) {
      if (this.isEnemy(shooter, body)) { if (def.beam) this.effects.energyHit(end, d); else this.effects.blood(end, d, false); }
    } else if (wall) {
      if (def.beam) this.effects.energyImpact(end, wall.n); else this.effects.impact(end, wall.n, wall.mat);
      if (this.listenerPos.distanceToSquared(end) < 1600) this.audio.impact(end, wall.mat);
    }
    return end;
  };

  P.clientMelee = function (c, heavy) {
    const w = c.weapon;
    if (!w || !w.def.melee || w.cooldown > 0) return;
    w.swing(heavy);
    c.spawnProtect = 0;
    this.audio.swing(heavy || !!w.def.sound.heavy, null);
    this.viewmodel.swing(heavy);
    this.net.toHost({ t: 'melee', h: heavy ? 1 : 0, w: w.def.id });
  };

  P.clientSetLoadout = function (primary, secondary, melee) {
    const p = this.player;
    const mode = this.config.mode;
    this.net.toHost({ t: 'loadout', primary, secondary, melee });
    const immediate = mode === 'training' || (mode === 'team' && this.phase === 'freeze');
    if (immediate && p.alive) {
      p.setLoadout(primary, secondary, mode === 'training', melee);
      p.resetView();
      this.viewmodel.setWeapon(p.weapon.def, true);
      return 'Armas equipadas.';
    }
    this.pendingLoadout = { primary, secondary, melee };
    return mode === 'team' ? 'As armas serão equipadas na próxima rodada.' : 'As armas serão equipadas no próximo renascimento.';
  };

  P.clientUpdate = function (dt) {
    this.time += dt;
    if (this.config.mode !== 'training' && (this.phase === 'live' || this.phase === 'freeze' || this.phase === 'roundEnd')) this.phaseT -= dt;
    const p = this.player;
    const inp = this.inputBlocked ? EMPTY_INPUT : this.input;
    if (p.alive) {
      p.update(dt, inp, this);
      p.updateWeapons(dt);
      if (p.spawnProtect > 0) p.spawnProtect -= dt;
    } else {
      if (p.respawnTimer !== Infinity) p.respawnTimer -= dt;
      if (this.deathCam) {
        this.deathCam.t += dt;
        if (inp.mouse.leftPressed) this.spectateIdx++;
      }
    }
    for (const c of this.combatants) if (c !== p) c.update(dt);
    this.inputT -= dt;
    if (this.inputT <= 0 && p.alive) {
      this.inputT = INPUT_DT;
      this.net.toHost({
        t: 'in', s: p.spawnSeq, p: [r2(p.pos.x), r2(p.pos.y), r2(p.pos.z)], v: [r2(p.vel.x), r2(p.vel.z)],
        yw: r3(p.yaw), pt: r3(p.pitch), ct: r2(p.crouchT), w: p.weapon.def.id,
      }, true);
    }
    this.frameTail(dt);
  };
}

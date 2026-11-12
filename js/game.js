// Núcleo da partida: modos, rodadas, disparos, dano, renascimento e câmera.
import * as THREE from 'three';
import { StoryMission, missionById, AGENT } from './story.js';
import { Player } from './player.js';
import { Bot } from './bot.js';
import { TEAMS, FFA_COLORS, BOT_NAMES, WEAPONS, PRIMARY_IDS, SECONDARY_IDS, MELEE_IDS } from './config.js';
import { settings } from './settings.js';
import { cellToWorld } from './map.js';
import { DEG, rand, pick, shuffle, clamp, lerp, damp, rayAABB } from './utils.js';
import { installCoop, EMPTY_INPUT } from './coop.js';
import { STUDENTS, getLook, playerName, activeProfile } from './profiles.js';

const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
const _base = new THREE.Vector3();
const _end = new THREE.Vector3();
const _n = new THREE.Vector3();
const _m = new THREE.Vector3();
const _ndc = new THREE.Vector3();
const _r = new THREE.Vector3();
const _u = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _look = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const oArr = [0, 0, 0];
const dArr = [0, 0, 0];

const PRIMARY_WEIGHTS = { tempest: 3, kestrel: 3, ratel: 2.2, longinus: 1.2, bulldog: 1.4, fulgor: 1.6 };

function forward(yaw, pitch, out) {
  const cp = Math.cos(pitch);
  return out.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
}

function weightedPrimary() {
  const total = PRIMARY_IDS.reduce((s, id) => s + PRIMARY_WEIGHTS[id], 0);
  let r = Math.random() * total;
  for (const id of PRIMARY_IDS) { r -= PRIMARY_WEIGHTS[id]; if (r <= 0) return id; }
  return 'tempest';
}

export class Game {
  constructor(ctx) {
    Object.assign(this, ctx); // scene, camera, world, nav, map, audio, input, effects, viewmodel, hud
    this.active = false;
    this.paused = false;
    this.time = 0;
    this.combatants = [];
    this.bots = [];
    this.player = null;
    this.config = null;
    this.phase = 'live';
    this.phaseT = 0;
    this.round = 0;
    this.teamScore = { A: 0, B: 0 };
    this.listenerPos = new THREE.Vector3();
    this.currentFov = settings.fov;
    this.deathCam = null;
    this.spectateIdx = 0;
    this.pendingLoadout = null;
    this.onMatchEnd = null;
    this.spotTimer = 0;
  }

  // ---------- ciclo da partida ----------
  start(config) {
    this.cleanup();
    this.config = {
      freezeTime: 5,
      roundTime: 115,
      ...config,
    };
    const mode = this.config.mode;
    this.time = 0;
    this.round = 0;
    this.teamScore = { A: 0, B: 0 };
    this.deathCam = null;
    this.pendingLoadout = null;
    // sala multijogador: a composição dos times vem da sala de espera (config.net)
    const room = this.config.net || null;
    const peers = this.net && this.net.role === 'host' ? this.net.connectedPeers : [];
    const guests = room ? peers.filter((g) => room.teams[g.id]) : peers;
    this.coop = !!(this.net && this.net.role === 'host' && guests.length);

    const pTeam = mode === 'ffa' ? 'P' : room && mode === 'team' ? room.hostTeam : 'A';
    const story = mode === 'story';
    this.player = new Player({ id: 0, name: story ? AGENT.name : playerName(), team: pTeam, color: mode === 'ffa' ? FFA_COLORS[0] : TEAMS[pTeam].color });
    if (story) this.player.setLoadout('kestrel', 'vp9', false, 'katana'); // equipamento padrão da unidade
    else this.player.setLoadout(settings.loadout.primary, settings.loadout.secondary, mode === 'training', settings.loadout.melee);
    if (story) {
      // modo história: a missão monta criminosos, reféns e objetivos
      this.story = new StoryMission(this, missionById(this.config.mission));
      this.story.setup();
      this.remotes = [];
      this.combatants = [this.player, ...this.bots];
      this.viewmodel.setWeapon(this.player.weapon.def, false);
      this.effects.clear();
      this.phase = 'live';
      this.phaseT = 0;
      this.story.spawnAll();
      this.announce(`MISSÃO ${this.story.def.n}`, this.story.def.title, 3.2, null, 'roundStart');
      this.active = true;
      this.paused = false;
      this.hud.setupMatch(this);
      return;
    }

    // os bots levam os nomes (e a aparência salva) dos alunos que não estão jogando
    const taken = new Set([activeProfile(), ...guests.map((g) => g.name)]);
    let names = shuffle(STUDENTS.filter((n) => !taken.has(n)));
    if (names.length < this.config.bots) names = names.concat(shuffle(BOT_NAMES.slice()));
    let aBots;
    if (room) {
      // bots definidos pela sala: os primeiros completam a Vanguarda, os demais a Sentinela
      this.config.bots = (room.botsA || 0) + (room.botsB || 0);
      aBots = mode === 'team' ? room.botsA || 0 : 0;
    } else {
      const total = this.config.bots + 1 + guests.length;
      aBots = mode === 'team' ? Math.max(0, Math.ceil(total / 2) - 1 - guests.length) : 0;
    }
    this.bots = [];
    for (let i = 0; i < this.config.bots; i++) {
      let team, color;
      if (mode === 'team') { team = i < aBots ? 'A' : 'B'; color = TEAMS[team].color; }
      else if (mode === 'training') { team = 'B'; color = TEAMS.B.color; }
      else { team = `F${i}`; color = FFA_COLORS[(i + 1) % FFA_COLORS.length]; }
      const bname = names[i % names.length];
      const bot = new Bot({ id: i + 1, name: bname, team, color, look: STUDENTS.includes(bname) ? getLook(bname) : null }, this.config.difficulty);
      bot.setLoadout(weightedPrimary(), pick(SECONDARY_IDS), mode === 'training', pick(MELEE_IDS));
      bot.passive = mode === 'training' && !this.config.botsShoot;
      this.scene.add(bot.model.root);
      this.bots.push(bot);
    }
    this.remotes = guests.map((g) => this.createRemote(g, mode === 'ffa' ? `R${g.id}` : room && mode === 'team' ? room.teams[g.id] : 'A'));
    this.combatants = [this.player, ...this.remotes, ...this.bots];
    this.viewmodel.setWeapon(this.player.weapon.def, false);
    this.effects.clear();
    if (this.coop) this.broadcastStart();

    if (mode === 'team') {
      this.startRound();
    } else {
      this.phase = 'live';
      this.phaseT = mode === 'ffa' ? this.config.timeLimit * 60 : 0;
      this.respawn(this.player);
      for (const r of this.remotes) this.respawn(r);
      for (const b of this.bots) this.respawn(b);
      this.announce(mode === 'ffa' ? 'MATA-MATA' : 'TREINAMENTO', mode === 'ffa' ? `Primeiro a ${this.config.scoreLimit} ${this.config.scoreLimit === 1 ? 'eliminação' : 'eliminações'} vence` : 'Pressione B para trocar de armas a qualquer momento', 3, null, 'roundStart');
    }
    this.active = true;
    this.paused = false;
    this.hud.setupMatch(this);
  }

  cleanup() {
    if (this.story) { this.story.dispose(); this.story = null; }
    for (const c of this.combatants) if (!c.isPlayer && c.model) this.scene.remove(c.model.root);
    for (const b of this.bots) this.scene.remove(b.model.root);
    this.coop = false;
    this.bots = [];
    this.combatants = [];
    this.active = false;
  }

  startRound() {
    this.round++;
    this.phase = 'freeze';
    this.phaseT = this.config.freezeTime;
    this.deathCam = null;
    this.effects.clear();
    if (this.pendingLoadout) {
      const { primary, secondary, melee } = this.pendingLoadout;
      this.player.setLoadout(primary, secondary, false, melee);
      this.pendingLoadout = null;
    }
    for (const team of ['A', 'B']) {
      const members = this.combatants.filter((c) => c.team === team);
      const spots = shuffle(this.map.teamSpawns[team].slice());
      members.forEach((c, i) => {
        const s = spots[i % spots.length];
        this.spawnCombatant(c, s.x + rand(-0.3, 0.3), s.z + rand(-0.3, 0.3), s.yaw + rand(-0.3, 0.3));
        c.spawnProtect = 0;
      });
    }
    this.announce(`RODADA ${this.round}`, 'Pressione B para trocar de armas', this.config.freezeTime, null, 'beep');
  }

  endRound(winner) {
    if (this.phase !== 'live') return;
    this.phase = 'roundEnd';
    this.phaseT = 4;
    if (winner) this.teamScore[winner]++;
    const msg = winner ? `${TEAMS[winner].name.toUpperCase()} VENCE A RODADA` : 'RODADA EMPATADA';
    const sub = `Vanguarda ${this.teamScore.A}  ·  ${this.teamScore.B} Sentinela`;
    this.announce(msg, sub, 3.5, winner ? TEAMS[winner].css : null, 'roundEnd', { win: winner });
  }

  checkRoundEnd() {
    if (this.config.mode !== 'team' || this.phase !== 'live') return;
    const aliveA = this.combatants.some((c) => c.alive && c.team === 'A');
    const aliveB = this.combatants.some((c) => c.alive && c.team === 'B');
    if (!aliveA || !aliveB) this.endRound(aliveA ? 'A' : aliveB ? 'B' : null);
  }

  endMatch() {
    if (this.phase === 'matchEnd') return;
    this.phase = 'matchEnd';
    this.phaseT = 3;
    const r = this.results();
    const ts = this.teamScore;
    const winTeam = r.mode === 'team' ? (ts.A > ts.B ? 'A' : ts.B > ts.A ? 'B' : '') : null;
    this.announce(r.title, r.subtitle, 3, r.color, 'matchEnd', { win: r.playerWon, winTeam });
  }

  results() {
    if (this.story) return this.story.results();
    const mode = this.config.mode;
    const rows = this.combatants.slice().sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    const p = this.player;
    let title, subtitle, playerWon = false, color = null;
    if (mode === 'team') {
      const w = this.teamScore.A > this.teamScore.B ? 'A' : this.teamScore.B > this.teamScore.A ? 'B' : null;
      playerWon = w === p.team;
      title = w ? `${TEAMS[w].name.toUpperCase()} VENCE` : 'EMPATE';
      subtitle = `Placar final: Vanguarda ${this.teamScore.A} × ${this.teamScore.B} Sentinela`;
      color = w ? TEAMS[w].css : null;
    } else if (mode === 'ffa') {
      const leader = rows[0];
      playerWon = leader === p;
      title = playerWon ? 'VITÓRIA' : `${leader.name.toUpperCase()} VENCE`;
      subtitle = `${leader.kills} eliminações · sua posição: ${rows.indexOf(p) + 1}º de ${rows.length}`;
      color = playerWon ? '#6dff9e' : '#ff6b5b';
    } else {
      title = 'TREINAMENTO ENCERRADO';
      subtitle = '';
    }
    const acc = p.shots ? Math.round((p.hits / p.shots) * 100) : 0;
    const hs = p.kills ? Math.round((p.headshots / p.kills) * 100) : 0;
    return { mode, rows, title, subtitle, playerWon, color, acc, hs, teamScore: { ...this.teamScore }, time: this.time };
  }

  // ---------- renascimento ----------
  spawnCombatant(c, x, z, yaw) {
    c.spawnAt(x, z, yaw);
    c.spawnTime = this.time;
    if (c.isRemote && this.isHost) { c.teleport(x, z, yaw); this.notifySpawn(c); }
    if (c.isPlayer) {
      c.resetView();
      this.viewmodel.setWeapon(c.weapon.def, true);
      this.deathCam = null;
      this.hud.onRespawn();
    }
  }

  findSpawn(c) {
    const mode = this.config.mode;
    const enemies = this.combatants.filter((o) => o !== c && o.alive && this.isEnemy(c, o));
    const cands = this.map.ffaSpawns;
    const scored = [];
    for (let i = 0; i < cands.length; i += 1) {
      const s = cands[i];
      let minD = 80;
      let seen = false;
      for (const e of enemies) {
        const dd = Math.hypot(e.pos.x - s.x, e.pos.z - s.z);
        if (dd < minD) minD = dd;
        if (dd < 30 && !seen) seen = this.world.clear(s.x, 1.6, s.z, e.pos.x, e.pos.y + 1.5, e.pos.z);
      }
      scored.push({ s, score: minD - (seen ? 25 : 0) + Math.random() * 4 });
    }
    scored.sort((a, b) => b.score - a.score);
    const s = pick(scored.slice(0, 6)).s;
    return { x: s.x, z: s.z, yaw: Math.atan2(s.x, s.z) };
  }

  respawn(c) {
    if (c.isPlayer && this.pendingLoadout) {
      c.setLoadout(this.pendingLoadout.primary, this.pendingLoadout.secondary, this.config.mode === 'training', this.pendingLoadout.melee);
      this.pendingLoadout = null;
    }
    const s = this.findSpawn(c);
    this.spawnCombatant(c, s.x + rand(-0.3, 0.3), s.z + rand(-0.3, 0.3), s.yaw);
    c.spawnProtect = 1.5;
  }

  // Troca de armas pelo menu. Retorna texto informando quando vale.
  setPlayerLoadout(primary, secondary, melee = 'katana') {
    if (this.isClient) return this.clientSetLoadout(primary, secondary, melee);
    const p = this.player;
    const mode = this.config.mode;
    const immediate = mode === 'training' || mode === 'story' || (mode === 'team' && this.phase === 'freeze') || (mode === 'ffa' && p.alive && this.time - (p.spawnTime || 0) < 6);
    if (immediate && p.alive) {
      p.setLoadout(primary, secondary, mode === 'training', melee);
      p.resetView();
      this.viewmodel.setWeapon(p.weapon.def, true);
      return 'Armas equipadas.';
    }
    this.pendingLoadout = { primary, secondary, melee };
    return mode === 'team' ? 'As armas serão equipadas na próxima rodada.' : 'As armas serão equipadas no próximo renascimento.';
  }

  canChangeLoadoutNow() {
    const mode = this.config.mode;
    return mode !== 'team' || this.phase === 'freeze';
  }

  // ---------- regras ----------
  isEnemy(a, b) {
    if (a === b) return false;
    if (this.story) return this.story.isEnemy(a, b);
    return a.team !== b.team;
  }
  canMove() { return this.phase !== 'freeze' && this.phase !== 'matchEnd'; }
  canShoot() { return this.phase === 'live' || this.phase === 'roundEnd'; }

  markSpotted(c, by) {
    if (!c.spotted) c.spotted = {};
    c.spotted[by.team] = this.time + 1.2;
  }

  noise(pos, radius, source) {
    const r2 = radius * radius;
    for (const b of this.bots) {
      if (b === source || !b.alive) continue;
      if (b.pos.distanceToSquared(pos) < r2) b.hear(pos, source, this);
    }
  }

  pickRoamGoal(bot) {
    const sg = this.story && this.story.roamGoal(bot);
    if (sg) return sg;
    const mode = this.config.mode;
    const nav = this.nav;
    let anchor = null;
    if (mode === 'training' && this.player.alive && Math.random() < 0.55) anchor = this.player.pos;
    else if (mode === 'ffa' && Math.random() < 0.4) {
      const others = this.combatants.filter((o) => o !== bot && o.alive);
      if (others.length) anchor = pick(others).pos;
    } else if (mode === 'team') {
      const enemyTeam = bot.team === 'A' ? 'B' : 'A';
      const late = this.phase === 'live' && this.phaseT < this.config.roundTime - 45;
      if (late || Math.random() < 0.25) {
        const enemies = this.combatants.filter((o) => o.alive && o.team === enemyTeam);
        if (enemies.length) anchor = pick(enemies).pos;
      } else if (Math.random() < 0.6) {
        const sp = this.map.teamSpawns[enemyTeam];
        const s = pick(sp);
        anchor = _tmp.set(s.x, 0, s.z);
      }
    }
    let cell;
    if (anchor) {
      const ax = anchor.x, az = anchor.z;
      cell = nav.randomCell(([cx, cy]) => Math.hypot(cellToWorld(cx) - ax, cellToWorld(cy) - az) < 9);
    } else {
      cell = nav.randomCell(([cx, cy]) => Math.hypot(cellToWorld(cx) - bot.pos.x, cellToWorld(cy) - bot.pos.z) > 12);
    }
    return { x: cellToWorld(cell[0]) + rand(-0.4, 0.4), z: cellToWorld(cell[1]) + rand(-0.4, 0.4) };
  }

  // ---------- disparos ----------
  spreadDir(base, spread, out) {
    const r = Math.tan(spread * Math.random());
    const th = Math.random() * Math.PI * 2;
    _r.crossVectors(base, UP);
    if (_r.lengthSq() < 1e-6) _r.set(1, 0, 0);
    _r.normalize();
    _u.crossVectors(_r, base).normalize();
    out.copy(base).addScaledVector(_r, Math.cos(th) * r).addScaledVector(_u, Math.sin(th) * r).normalize();
    return out;
  }

  // Resolve um projétil (hitscan). Retorna o ponto final em _end.
  resolveShot(shooter, o, d, def) {
    const maxD = 250;
    const hit = this.world.raycast(o.x, o.y, o.z, d.x, d.y, d.z, maxD);
    let best = hit ? hit.t : maxD;
    const wallBox = hit ? hit.box : null;
    const wallGround = hit ? hit.ground : false;
    if (hit) _n.set(hit.nx, hit.ny, hit.nz);
    let victim = null, part = null;
    oArr[0] = o.x; oArr[1] = o.y; oArr[2] = o.z;
    dArr[0] = d.x; dArr[1] = d.y; dArr[2] = d.z;
    const wallT = best;
    const hits = [];
    for (const c of this.combatants) {
      if (c === shooter || !c.alive) continue;
      // rejeição rápida por distância do raio ao centro do corpo
      _tmp.set(c.pos.x - o.x, c.pos.y + 0.9 - o.y, c.pos.z - o.z);
      const proj = _tmp.dot(d);
      if (proj < 0 || proj > wallT + 1) continue;
      if (_tmp.lengthSq() - proj * proj > 1.6) continue;
      let cBest = wallT, cPart = null;
      for (const hb of c.hitboxes()) {
        const r = rayAABB(oArr, dArr, hb, cBest);
        if (r && r.t < cBest) { cBest = r.t; cPart = hb.part; }
      }
      if (cPart) hits.push({ c, t: cBest, part: cPart });
    }
    hits.sort((a, b) => a.t - b.t);
    // feixes de energia atravessam vários corpos; projéteis comuns param no primeiro
    const maxHits = def.pierce || 1;
    const struck = hits.slice(0, maxHits);
    if (struck.length) {
      victim = struck[0].c; part = struck[0].part;
      best = struck.length >= maxHits && !def.pierce ? struck[0].t : (struck.length >= maxHits ? struck[struck.length - 1].t : wallT);
    }
    for (const h of struck) {
      _end.copy(o).addScaledVector(d, h.t);
      if (h.c.isHostage || h.c.isCivilian) {
        this.effects.blood(_end, d, false);
        if (this.story) this.story.innocentHit(shooter, h.c);
        continue;
      }
      if (this.isEnemy(shooter, h.c)) {
        const falloff = h.t <= def.range ? 1 : Math.max(def.minFalloff, 1 - (h.t - def.range) / (def.range * 1.5));
        const mult = h.part === 'head' ? def.headMult : h.part === 'legs' ? def.legMult : 1;
        if (def.beam) this.effects.energyHit(_end, d); else this.effects.blood(_end, d, h.part === 'head');
        this.fxRecordEnd(_end, 2, null, null);
        if (!h.c.isPlayer && this.listenerPos.distanceToSquared(_end) < 900) this.audio.fleshHit(_end);
        this.applyDamage(h.c, def.damage * mult * falloff, shooter, h.part, d, def);
      } else {
        this.effects.blood(_end, d, false);
      }
    }
    _end.copy(o).addScaledVector(d, best);
    if (!struck.length && !hit) this.fxRecordEnd(_end, 0, null, null);
    const stoppedByBody = struck.length && best < wallT;
    if (stoppedByBody) {
      /* o projétil parou num corpo */    } else if (hit) {
      const mat = wallGround ? 'concrete' : (wallBox ? wallBox.mat : 'concrete');
      if (def.beam) this.effects.energyImpact(_end, _n); else this.effects.impact(_end, _n, mat);
      this.fxRecordEnd(_end, 1, _n, mat);
      if (this.listenerPos.distanceToSquared(_end) < 40 * 40) this.audio.impact(_end, mat);
    }
    // zunido de projétil que passa perto do jogador
    const p = this.player;
    if (shooter !== p && victim !== p && p.alive) {
      p.eyePos(_m);
      _tmp.subVectors(_m, o);
      const proj = _tmp.dot(d);
      if (proj > 2 && proj < best) {
        const distSq = _tmp.lengthSq() - proj * proj;
        if (distSq < 1.5) this.audio.whizz(_tmp.copy(o).addScaledVector(d, proj));
      }
    }
    return _end;
  }

  playerFire(p) {
    const w = p.weapon;
    const def = w.def;
    const spread = w.spread(p.speed, !p.onGround, p.crouchT > 0.5, p.ads > 0.6, p.zoomLevel > 0);
    w.fire();
    p.shots++;
    p.spawnProtect = 0;
    p.eyePos(_o);
    forward(p.yaw + p.recoilYaw * DEG, p.pitch + p.recoilPitch * DEG, _base);
    // posição aproximada do cano no mundo (origem dos traçantes)
    _r.crossVectors(_base, UP).normalize();
    _u.crossVectors(_r, _base).normalize();
    const hipK = 1 - p.ads;
    const side = def.model.type === 'gauntlet' ? (w.shotsFired % 2 ? -1 : 1) : 1;
    let muzzle = def.model.type === 'gauntlet'
      ? _m.copy(_o).addScaledVector(_base, 0.45).addScaledVector(_r, 0.16 * side).addScaledVector(_u, -0.17)
      : _m.copy(_o).addScaledVector(_base, 0.6).addScaledVector(_r, 0.13 * hipK).addScaledVector(_u, -0.1 * hipK - 0.03);
    // jogador local: parte do ponto da tela onde está a boca do cano da arma em primeira pessoa
    if (p.isPlayer && def.model.type !== 'gauntlet' && this.viewmodel.muzzleNDC(_ndc)) {
      _ndc.z = 0.5;
      _ndc.unproject(this.camera).sub(this.camera.position).normalize();
      muzzle = _m.copy(this.camera.position).addScaledVector(_ndc, 0.6);
    }
    const muzzleCopy = muzzle.clone();
    const pellets = def.pellets;
    let hitsBefore = p.hits;
    const client = this.isClient;
    const sentDirs = [];
    this.fxBegin();
    for (let i = 0; i < pellets; i++) {
      this.spreadDir(_base, spread + (pellets > 1 ? def.pelletSpread : 0), _d);
      if (client) sentDirs.push([Math.round(_d.x * 1e4) / 1e4, Math.round(_d.y * 1e4) / 1e4, Math.round(_d.z * 1e4) / 1e4]);
      const end = client ? this.visualShot(p, _o, _d, def) : this.resolveShot(p, _o, _d, def);
      if (def.beam) this.effects.beam(muzzleCopy, end);
      else if (i < 3 && (def.auto ? w.shotsFired % 2 === 1 : true)) this.effects.tracer(muzzleCopy, end, 300);
    }
    this.fxEndShot(p, def, muzzleCopy);
    if (client) this.net.toHost({ t: 'fire', o: [_o.x, _o.y, _o.z], d: sentDirs, w: def.id });
    // múltiplos chumbos contam como um acerto para a precisão
    if (pellets > 1 && p.hits > hitsBefore) { p.hits = hitsBefore + 1; }
    if (pellets > 1) p.shots += 0;
    // recuo
    const kick = 1 + Math.min(w.shotsFired, 9) * 0.07;
    const postureK = (p.crouchT > 0.5 ? 0.8 : 1) * (p.ads > 0.6 ? 0.85 : 1);
    p.recoilPitch = Math.min(14, p.recoilPitch + def.recoil * kick * postureK);
    const sway = w.shotsFired > 3 ? Math.sin(w.shotsFired * 0.65) * def.recoilH : 0;
    p.recoilYaw += (sway + (Math.random() - 0.5) * def.recoilH) * postureK;
    p.recoilYaw = clamp(p.recoilYaw, -6, 6);
    this.audio.shot(def.sound, null, 1);
    if (def.model.type === 'shotgun') this.audio.pump();
    if (def.model.type === 'sniper') this.audio.bolt();
    this.viewmodel.fire();
    this.effects.playerMuzzleLight(muzzleCopy, !!def.beam);
    p.spottedUntil = this.time + 1.2;
    this.noise(_o, 50, p);
  }

  // Ataque corpo a corpo: o golpe sai na hora e o dano é resolvido no meio do arco.
  meleeAttack(c, heavy) {
    if (this.isClient) { this.clientMelee(c, heavy); return; }
    const w = c.weapon;
    if (!w || !w.def.melee || w.cooldown > 0) return;
    w.swing(heavy);
    c.spawnProtect = 0;
    c.pendingMelee = { t: heavy ? 0.22 : 0.12, heavy, def: w.def };
    this.audio.swing(heavy || !!w.def.sound.heavy, c.isPlayer ? null : c.pos);
    if (c.isPlayer) this.viewmodel.swing(heavy);
    else c.model.swing();
    this.fxPush({ k: 'm', id: c.id, h: heavy ? 1 : 0 });
    this.noise(c.pos, 8, c);
  }

  resolveMelee(c, pm) {
    const def = pm.def;
    c.eyePos(_o);
    forward(c.yaw + (c.isPlayer ? c.recoilYaw * DEG : 0), c.pitch, _base);
    // parede no caminho?
    const wall = this.world.raycast(_o.x, _o.y, _o.z, _base.x, _base.y, _base.z, def.reach);
    const wallT = wall ? wall.t : def.reach + 0.5;
    let target = null, bestScore = Infinity;
    for (const o of this.combatants) {
      if (o === c || !o.alive || !this.isEnemy(c, o)) continue;
      _tmp.set(o.pos.x - _o.x, o.pos.y + 1.0 - _o.y, o.pos.z - _o.z);
      const dist = Math.hypot(_tmp.x, _tmp.z);
      if (dist > def.reach + 0.35 || dist > wallT + 0.4) continue;
      if (Math.abs(_tmp.y) > 1.4) continue;
      const ang = Math.acos(clamp((_tmp.x * _base.x + _tmp.z * _base.z) / (dist * Math.hypot(_base.x, _base.z) || 1), -1, 1));
      if (ang > def.arc && dist > 0.8) continue;
      if (!this.world.clear(_o.x, _o.y, _o.z, o.pos.x, o.pos.y + 1.1, o.pos.z)) continue;
      const score = dist + ang;
      if (score < bestScore) { bestScore = score; target = o; }
    }
    if (target) {
      // golpe pelas costas: o alvo olha para longe do atacante
      const fx = -Math.sin(target.yaw), fz = -Math.cos(target.yaw);
      const tx = c.pos.x - target.pos.x, tz = c.pos.z - target.pos.z;
      const back = (fx * tx + fz * tz) / (Math.hypot(tx, tz) || 1) < -0.4;
      const dmg = (pm.heavy ? def.heavyDamage : def.damage) * (back ? 2 : 1);
      target.eyePos(_end);
      _end.y -= 0.35;
      this.effects.blood(_end, _base, false);
      this.effects.slash(_end, _base);
      this.audio.slashHit(_end);
      this.fxPush({ k: 'mh', id: -1, p: [_end.x, _end.y, _end.z], d: [_base.x, _base.y, _base.z] });
      this.applyDamage(target, dmg, c, back ? 'back' : 'body', _base, def);
      if (c.isPlayer && back) this.hud.center('PELAS COSTAS', '', 0.8, '#ffd166');
      if (c.isRemote && back && this.isHost) this.net.sendTo(c.peerId, { t: 'ann', title: 'PELAS COSTAS', sub: '', dur: 0.8, color: '#ffd166' });
    } else if (wall) {
      _end.set(wall.x, wall.y, wall.z);
      _n.set(wall.nx, wall.ny, wall.nz);
      this.effects.impact(_end, _n, 'metal');
      this.audio.clang(_end);
    }
    c.shots++;
  }

  botFire(b) {
    const w = b.weapon;
    const def = w.def;
    const sp = Math.hypot(b.vel.x, b.vel.z);
    const scoped = !!def.zoom && sp < 1.2;
    const spread = w.spread(sp, !b.onGround, b.crouchT > 0.5, false, scoped);
    w.fire();
    b.shots++;
    b.spawnProtect = 0;
    b.eyePos(_o);
    forward(b.yaw, b.pitch, _base);
    const muzzle = b.model.muzzleWorld(new THREE.Vector3());
    this.fxBegin();
    for (let i = 0; i < def.pellets; i++) {
      this.spreadDir(_base, spread + (def.pellets > 1 ? def.pelletSpread : 0), _d);
      const end = this.resolveShot(b, _o, _d, def);
      if (def.beam) this.effects.beam(muzzle, end);
      else if (i < 2) this.effects.tracer(muzzle, end, 260);
    }
    this.fxEndShot(b, def, muzzle);
    this.effects.muzzle(muzzle, _base, !!def.beam);
    if (this.listenerPos.distanceToSquared(muzzle) < 120 * 120) this.audio.shot(def.sound, muzzle, 1);
    const ctrl = 1 - b.diff.recoilControl;
    b.pitch += def.recoil * DEG * ctrl * 0.55;
    b.yaw += (Math.random() - 0.5) * def.recoilH * DEG * ctrl * 1.5;
    b.spottedUntil = this.time + 1.2;
    this.noise(_o, 45, b);
  }

  botReload(b) {
    if (this.listenerPos.distanceToSquared(b.pos) < 15 * 15) this.audio.reload(b.weapon.def, b.pos);
  }

  applyDamage(victim, dmg, attacker, part, dir, def) {
    if (!victim.alive || victim.spawnProtect > 0) return;
    if (this.story) { dmg = this.story.filterDamage(victim, dmg, attacker); if (dmg <= 0) return; }
    dmg = Math.max(1, Math.round(dmg));
    const dealt = Math.min(dmg, victim.health);
    victim.health -= dmg;
    victim.lastAttacker = attacker;
    victim.lastDamageTime = this.time;
    if (attacker) { attacker.hits++; attacker.damageDealt += dealt; }
    const killed = victim.health <= 0;
    if (victim.isPlayer) {
      this.hud.damage(attacker, this);
      this.audio.hurt();
      victim.shake = Math.min(1.2, victim.shake + dmg / 35);
      victim.recoilPitch += Math.min(3, dmg * 0.05);
    } else if (victim.isRemote) {
      if (this.isHost) this.net.sendTo(victim.peerId, { t: 'dmg', a: attacker ? attacker.id : -1, ax: attacker ? attacker.pos.x : 0, az: attacker ? attacker.pos.z : 0, amt: dmg, hp: Math.max(0, victim.health) });
    } else if (victim.onDamaged) {
      victim.onDamaged(attacker, this);
    }
    if (attacker && attacker.isPlayer) {
      this.hud.hitmarker(part === 'head', killed);
      this.audio.hitmarker(part === 'head');
    } else if (attacker && attacker.isRemote && this.isHost) {
      this.net.sendTo(attacker.peerId, { t: 'hit', h: part === 'head' ? 1 : 0, k: killed ? 1 : 0 });
    }
    if (killed) {
      victim.health = 0;
      this.kill(victim, attacker, def, part === 'head');
    }
  }

  kill(victim, attacker, def, headshot) {
    victim.alive = false;
    victim.deaths++;
    victim.deathTime = this.time;
    victim.vel.set(0, 0, 0);
    victim.crouching = false;
    if (attacker && attacker !== victim && this.isEnemy(attacker, victim)) {
      attacker.kills++;
      if (headshot) attacker.headshots++;
    }
    this.hud.killfeed(attacker, victim, def, headshot, this);
    if (this.isHost) this.net.broadcast({ t: 'kf', a: attacker ? attacker.id : -1, v: victim.id, w: def ? def.id : null, hs: headshot ? 1 : 0 });
    if (attacker === this.player) this.audio.killConfirm();
    const mode = this.config.mode;
    if (victim.isPlayer) {
      this.audio.death();
      this.deathCam = { killer: attacker, t: 0 };
      victim.zoomLevel = 0;
      this.hud.onDeath(attacker, def, this);
    }
    if (this.story) this.story.onKill(victim, attacker);
    victim.respawnTimer = mode === 'team' || mode === 'story' ? Infinity : mode === 'ffa' ? 3 : (victim.isPlayer || victim.isRemote ? 2.5 : 2);
    if (victim.isRemote && this.isHost) this.net.sendTo(victim.peerId, { t: 'died', k: attacker ? attacker.id : -1, w: def ? def.id : null, rt: victim.respawnTimer === Infinity ? null : victim.respawnTimer });
    if (mode === 'team') this.checkRoundEnd();
    if (mode === 'ffa' && attacker && attacker.kills >= this.config.scoreLimit) this.endMatch();
  }

  // ---------- atualização por quadro ----------
  update(dt) {
    // em cooperativo a pausa só bloqueia os comandos locais: a partida dos outros continua
    if (!this.active || (this.paused && !this.coop)) return;
    if (this.isClient) { this.clientUpdate(dt); return; }
    this.time += dt;
    const mode = this.config.mode;
    const p = this.player;

    // fases
    if (mode === 'team') {
      this.phaseT -= dt;
      if (this.phase === 'freeze' && this.phaseT <= 0) {
        this.phase = 'live';
        this.phaseT = this.config.roundTime;
        this.announce('VALENDO!', '', 1.2, null, 'roundStart');
      } else if (this.phase === 'live' && this.phaseT <= 0) {
        const alive = { A: 0, B: 0 }, hp = { A: 0, B: 0 };
        for (const c of this.combatants) if (c.alive) { alive[c.team]++; hp[c.team] += c.health; }
        const w = alive.A !== alive.B ? (alive.A > alive.B ? 'A' : 'B') : hp.A !== hp.B ? (hp.A > hp.B ? 'A' : 'B') : null;
        this.endRound(w);
      } else if (this.phase === 'roundEnd' && this.phaseT <= 0) {
        if (this.teamScore.A >= this.config.rounds || this.teamScore.B >= this.config.rounds) this.endMatch();
        else this.startRound();
      }
    } else if (mode === 'ffa' && this.phase === 'live') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) this.endMatch();
    }
    if (this.phase === 'matchEnd') {
      this.phaseT -= dt;
      if (this.phaseT <= 0 && this.onMatchEnd) {
        const cb = this.onMatchEnd;
        this.active = false;
        const res = this.results();
        if (this.isHost) this.net.broadcast({ t: 'end', r: this.serializeResults(res) });
        cb(res);
        return;
      }
    }

    // jogador
    const inp = this.inputBlocked || (this.story && this.story.blocksInput) ? EMPTY_INPUT : this.input;
    if (p.alive) {
      p.update(dt, inp, this);
      p.updateWeapons(dt);
    } else if (this.deathCam) {
      this.deathCam.t += dt;
      if (inp.mouse.leftPressed) this.spectateIdx++;
    }
    // convidados (corpo visível e caixas de acerto no anfitrião)
    for (const c of this.combatants) if (c.isRemote) c.update(dt);
    // bots
    for (const b of this.bots) {
      if (b.alive) b.updateWeapons(dt);
      b.update(dt, this);
    }
    if (this.story) this.story.update(dt);
    for (const c of this.combatants) {
      if (c.pendingMelee) {
        c.pendingMelee.t -= dt;
        if (c.pendingMelee.t <= 0) {
          const pm = c.pendingMelee;
          c.pendingMelee = null;
          if (c.alive && this.canShoot(c)) this.resolveMelee(c, pm);
        }
      }
      if (c.spawnProtect > 0) c.spawnProtect -= dt;
      if (!c.alive && c.respawnTimer !== Infinity) {
        c.respawnTimer -= dt;
        if (c.respawnTimer <= 0 && this.phase !== 'matchEnd') this.respawn(c);
      }
    }

    // o que o jogador enxerga aparece no radar da equipe
    this.spotTimer -= dt;
    if (this.spotTimer <= 0 && p.alive) {
      this.spotTimer = 0.25;
      p.eyePos(_o);
      for (const c of this.bots) {
        if (!c.alive || !this.isEnemy(p, c)) continue;
        const dx = c.pos.x - p.pos.x, dz = c.pos.z - p.pos.z;
        const ang = Math.abs(Math.atan2(Math.sin(Math.atan2(-dx, -dz) - p.yaw), Math.cos(Math.atan2(-dx, -dz) - p.yaw)));
        if (ang < 0.9 && this.world.clear(_o.x, _o.y, _o.z, c.pos.x, c.pos.y + 1.4, c.pos.z)) this.markSpotted(c, p);
      }
    }

    if (this.isHost) this.hostTick(dt);
    this.frameTail(dt);
  }

  // Câmera, arma em primeira pessoa, efeitos, áudio e HUD (comum a anfitrião e convidado).
  frameTail(dt) {
    const p = this.player;
    // câmera
    if (p.alive) p.applyCamera(this.camera, dt);
    else this.updateDeathCamera(dt);
    const def = p.weapon.def;
    let targetFov = settings.fov;
    if (p.alive && p.zoomLevel > 0 && def.zoom) targetFov = def.zoom[p.zoomLevel - 1];
    else if (p.alive) targetFov = settings.fov / lerp(1, def.adsZoom || 1, p.ads);
    this.currentFov = p.zoomLevel > 0 ? targetFov : damp(this.currentFov, targetFov, 16, dt);
    if (Math.abs(this.camera.fov - this.currentFov) > 0.01) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
      this.effects.setScale(this.renderHeight || window.innerHeight, this.currentFov);
    }

    this.viewmodel.update(dt, {
      speed: p.speed, sprint: p.sprinting, sprintBlend: p.sprintBlend, ads: p.ads, crouch: p.crouchT > 0.5,
      reload: p.weapon.reloading ? p.weapon.reloadProgress : null,
      mdx: this.input.mouse.dx, mdy: this.input.mouse.dy, onGround: p.onGround,
      scoped: p.zoomLevel > 0, alive: p.alive, empty: p.weapon.mag === 0 && !p.weapon.def.melee,
    });
    this.effects.update(dt);

    // trilha dinâmica: combate recente puxa o rock; calmaria volta ao suspense
    const hot = p.alive && (p.spottedUntil > this.time - 2.5 || this.time - p.lastDamageTime < 5);
    this.audio.setMusicIntensity(hot || this.phase === 'roundEnd' ? 1 : 0);

    // ouvinte de áudio
    this.listenerPos.copy(this.camera.position);
    this.camera.getWorldDirection(_look);
    this.audio.updateListener(this.listenerPos, _look);

    this.hud.update(this, dt);
  }

  spectateTarget() {
    const mates = this.combatants.filter((c) => c.alive && !c.isPlayer && c.team === this.player.team);
    if (!mates.length) return null;
    return mates[this.spectateIdx % mates.length];
  }

  updateDeathCamera(dt) {
    const p = this.player;
    const cam = this.camera;
    const dc = this.deathCam || { t: 0 };
    const mode = this.config.mode;
    if (mode === 'team' && dc.t > 2.5) {
      const t = this.spectateTarget();
      if (t) {
        forward(t.yaw, t.pitch * 0.5, _look);
        t.eyePos(_tmp);
        cam.position.copy(_tmp).addScaledVector(_look, -2.4).add(_m.set(0, 0.45, 0));
        cam.lookAt(_tmp.addScaledVector(_look, 6));
        this.hud.spectating(t);
        return;
      }
    }
    this.hud.spectating(null);
    const e = Math.min(1, dc.t / 1.2);
    const ease = 1 - Math.pow(1 - e, 3);
    cam.position.set(p.pos.x, p.pos.y + lerp(1.5, 3.4, ease), p.pos.z);
    cam.position.x += Math.sin(p.yaw) * ease * 1.5;
    cam.position.z += Math.cos(p.yaw) * ease * 1.5;
    const k = dc.killer;
    if (k && k !== p && k.alive) _look.set(k.pos.x, k.pos.y + 1.2, k.pos.z);
    else _look.set(p.pos.x, p.pos.y, p.pos.z);
    cam.lookAt(_look);
  }
}

installCoop(Game);

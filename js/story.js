// Modo história: campanha individual do Agente Falcão (unidade tática) contra a organização
// criminosa Crakem, liderada pelo terrorista Vugo.
//
// O motor de missões cuida de objetivos, alarme, rádio, rendição e prisão de criminosos,
// reféns, extração, pontuação e progresso salvo. Cada missão descreve seu cenário e regras
// em CAMPAIGN; a partida em si continua sendo a do jogo (física, tiros, bots, HUD).
import * as THREE from 'three';
import { Bot } from './bot.js';
import { settings, saveSettings } from './settings.js';
import { cellToWorld, charAt } from './map.js';
import { SKINS, EYES, HAIRS, HAIR_COLORS } from './profiles.js';
import { pick, rand, shuffle, angleDiff } from './utils.js';

export const AGENT = { name: 'Agente Falcão', callsign: 'Falcão' };
export const ORG = 'Crakem';
export const LEADER = 'Vugo';
// codinomes fictícios dos integrantes da Crakem (nunca nomes de alunos ou de pessoas reais)
const CREW = ['Corvo', 'Sombra', 'Dente', 'Faísca', 'Rato', 'Lâmina', 'Cobra', 'Trovão', 'Ferrugem', 'Gancho', 'Tatu', 'Fumaça'];

const CRIM_COLOR = 0x2a2b2e;
const SCORE = { saved: 500, cuffed: 400, surrendered: 200, down: 100, stealth: 600, excessive: -500 };

// ------------------------------------------------------------------ campanha
export const CAMPAIGN = [
  {
    id: 'm1', n: 1, map: 'ferrugem', ready: true,
    title: 'Resgate no Distrito Ferrugem',
    tag: 'Sequestro · dia',
    brief: [
      'A Crakem invadiu um depósito do Distrito Ferrugem e mantém três funcionários como reféns no armazém nordeste.',
      'Entre, liberte os reféns e leve-os até a viatura no pátio. Prefira dar voz de prisão: criminosos rendidos e algemados valem mais do que abatidos.',
      'Se o alarme soar, você terá 90 segundos para libertar todos os reféns.',
    ],
    controls: 'E (ou AÇÃO no celular): dar voz de prisão mirando no suspeito · segurar E: algemar rendidos e libertar reféns.',
    alarmTime: 90,
    stars: [2200, 3300],
    // posições em células do mapa (coluna, linha)
    hostages: [[24, 2], [29, 4], [33, 6]],
    crew: [
      { at: [25, 6], hold: true, look: [24, 2] },
      { at: [31, 5], hold: true, look: [29, 4] },
      { at: [33, 2], hold: true, look: [33, 6] },
      { at: [31, 9], post: true },
      { at: [20, 4], post: true },
      { route: [[28, 10], [33, 10], [33, 15], [26, 15]] },
      { route: [[13, 2], [20, 2], [20, 7], [13, 7]] },
    ],
    zone: { c0: [23, 1], c1: [34, 7], label: 'armazém nordeste' },
    extract: [32, 13],
    van: [33.6, 12.4],
  },
  {
    id: 'm2', n: 2, map: 'noite', ready: false,
    title: 'Contagem regressiva', tag: 'Atentado a bomba · noite',
    brief: ['A Crakem plantou um artefato no distrito. Localize-o com os óculos de visão noturna e desarme-o antes que o tempo acabe.'],
  },
  {
    id: 'm3', n: 3, map: 'selva', ready: false,
    title: 'A caçada a Vugo', tag: 'Captura · selva',
    brief: [`O líder ${LEADER} foge pela Selva Esmeralda. Encurrale-o e prenda-o vivo.`],
  },
  {
    id: 'm4', n: 4, map: 'ruinas', ready: false,
    title: 'Olho no alto', tag: 'Tiro de precisão · ruínas',
    brief: ['Do alto das Ruínas de Aruanã, proteja a equipe e identifique o alvo entre os civis.'],
  },
];
export const missionById = (id) => CAMPAIGN.find((m) => m.id === id);

export function storyProgress() {
  if (!settings.story || typeof settings.story !== 'object') settings.story = {};
  return settings.story;
}

// ------------------------------------------------------------------ utilidades de mapa
const PASS = new Set(['.', ',', 'v', 'Z', 'A', 'd']);
function walkableCell(cx, cy) {
  if (PASS.has(charAt(cx, cy))) return [cx, cy];
  for (let r = 1; r < 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (PASS.has(charAt(cx + dx, cy + dy))) return [cx + dx, cy + dy];
  }
  return [cx, cy];
}
const W = ([cx, cy]) => { const [x, y] = walkableCell(cx, cy); return { x: cellToWorld(x), z: cellToWorld(y) }; };
const yawTo = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z));

const _v = new THREE.Vector3();
const _d = new THREE.Vector3();

// ------------------------------------------------------------------ missão em andamento
export class StoryMission {
  constructor(game, def) {
    this.game = game;
    this.def = def;
    this.objs = [];
    this.lines = [];
    this.radioQ = [];
    this.radioT = 0;
    this.alarm = false;
    this.alarmT = 0;
    this.ended = false;
    this.penalties = 0;
    this.excessive = 0;
    this.holdT = 0;
    this.holdTarget = null;
    this.orderCD = 0;
    this.objects = [];
    this.entered = false;
    this.timers = [];
  }

  // agenda uma ação no relógio do jogo (congela durante a pausa)
  after(sec, fn) { this.timers.push({ t: this.game.time + sec, fn }); }

  // ---------- montagem ----------
  setup() {
    const g = this.game;
    const d = this.def;
    document.body.classList.add('story');
    this.buildHud();
    // criminosos
    const names = shuffle(CREW.slice());
    this.crew = d.crew.map((c, i) => {
      const b = new Bot({ id: 10 + i, name: names[i % names.length], team: 'B', color: CRIM_COLOR, style: { kind: 'crim' } }, g.config.difficulty);
      b.setLoadout(pick(['ratel', 'tempest', 'bulldog', 'ratel']), 'vp9', false, 'katana');
      b.swordsman = false;
      b.isCrim = true;
      const at = W(c.at || c.route[0]);
      b.home = at;
      b.hold = !!c.hold;
      b.post = !!c.post || !!c.hold;
      b.route = c.route ? c.route.map(W) : null;
      b.routeIdx = 0;
      b.lookAt = c.look ? W(c.look) : null;
      g.scene.add(b.model.root);
      return { b, at, c };
    });
    // reféns
    this.hostages = d.hostages.map((h, i) => {
      const look = { skin: pick(SKINS).id, eyes: pick(EYES).id, hair: pick(HAIRS).id, hairColor: pick(HAIR_COLORS).id, camo: 'urbano' };
      const style = { kind: 'civil', shirt: pick([0x8a9bb0, 0xb07a5a, 0x6f8a62, 0xc9b98f, 0x9a6f8e]), pants: pick([0x34465e, 0x2e3a2a, 0x4a3a2c]) };
      const b = new Bot({ id: 40 + i, name: `Refém ${i + 1}`, team: 'C', color: 0x8a9bb0, look, style }, 'recruta');
      b.setLoadout(null, 'vp9', false, 'katana');
      b.isHostage = true;
      b.pose = 'kneel';
      b.hState = 'tied';
      b.ctrl = (dt, game) => this.hostageCtrl(b, dt, game);
      g.scene.add(b.model.root);
      return { b, at: W(h) };
    });
    g.bots = [...this.crew.map((c) => c.b), ...this.hostages.map((h) => h.b)];
    // viatura e ponto de extração
    this.extract = W(d.extract);
    this.addVan(d.van);
    this.addExtractMarker(this.extract);
    // objetivos
    const nCrew = this.crew.length;
    this.objs = [
      { id: 'reach', text: `Infiltre-se no ${d.zone.label}`, done: false },
      { id: 'free', text: 'Liberte os reféns', n: 0, of: this.hostages.length, done: false },
      { id: 'extract', text: 'Leve os reféns até a viatura', n: 0, of: this.hostages.length, done: false },
      { id: 'crew', text: 'Neutralize os sequestradores (prisão vale mais)', n: 0, of: nCrew, done: false },
    ];
    this.renderObjs();
  }

  // posiciona tudo no início (chamado depois do player nascer)
  spawnAll() {
    const g = this.game;
    const sp = g.map.teamSpawns.A[0];
    g.spawnCombatant(g.player, sp.x, sp.z, yawTo(sp, W(this.def.zone.c0)));
    g.player.spawnProtect = 1;
    for (const { b, at, c } of this.crew) {
      g.spawnCombatant(b, at.x, at.z, b.lookAt ? yawTo(at, b.lookAt) : rand(-3, 3));
      b.respawnTimer = Infinity;
      if (c.hold || c.post) b.state = 'search';
    }
    for (const { b, at } of this.hostages) {
      g.spawnCombatant(b, at.x, at.z, rand(-3, 3));
      b.respawnTimer = Infinity;
    }
    this.radio('Central', `${AGENT.callsign}, aqui é a Central. Três reféns no ${this.def.zone.label}. A Crakem tem homens no pátio.`, 5);
    this.radio('Central', 'Dê voz de prisão sempre que puder. Queremos esses criminosos vivos.', 4.5);
  }

  addVan([cx, cy]) {
    const g = this.game;
    const grp = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: 0x1d2a3d, roughness: 0.5, metalness: 0.3 });
    const white = new THREE.MeshStandardMaterial({ color: 0xe6e9ee, roughness: 0.5 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x0c1118, roughness: 0.1, metalness: 0.8 });
    const tire = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; grp.add(o); return o; };
    add(new THREE.BoxGeometry(2.1, 1.7, 4.8), body, 0, 1.25, 0);
    add(new THREE.BoxGeometry(2.12, 0.28, 4.82), white, 0, 1.15, 0);
    add(new THREE.BoxGeometry(2.0, 0.7, 0.05), glass, 0, 1.75, -2.41);
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.05, 0.6, 1.2), glass, sx * 1.06, 1.75, -1.4);
    for (const sx of [-1, 1]) for (const sz of [-1.5, 1.5]) { const t = add(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 14), tire, sx * 0.95, 0.38, sz); t.rotation.z = Math.PI / 2; }
    this.lights = [
      add(new THREE.BoxGeometry(0.5, 0.12, 0.3), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff2020, emissiveIntensity: 2 }), -0.4, 2.16, -1.2),
      add(new THREE.BoxGeometry(0.5, 0.12, 0.3), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x2050ff, emissiveIntensity: 2 }), 0.4, 2.16, -1.2),
    ];
    grp.position.set(cellToWorld(cx), 0, cellToWorld(cy));
    g.scene.add(grp);
    this.objects.push(grp);
  }

  addExtractMarker(p) {
    const g = this.game;
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.0, 40), new THREE.MeshBasicMaterial({ color: 0x6dff9e, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(p.x, 0.03, p.z);
    g.scene.add(ring);
    this.ring = ring;
    this.objects.push(ring);
  }

  dispose() {
    document.body.classList.remove('story');
    for (const o of this.objects) o.removeFromParent();
    this.objects = [];
    if (this.hud) this.hud.root.remove();
    this.hud = null;
  }

  // ---------- HUD ----------
  buildHud() {
    const host = document.getElementById('hud');
    const root = document.createElement('div');
    root.id = 'story-hud';
    root.innerHTML = `
      <div class="st-obj"><h4></h4><ul></ul><div class="st-alarm hidden"></div></div>
      <div class="st-radio hidden"><b></b><span></span></div>
      <div class="st-prompt hidden"><span></span><i><em></em></i></div>
      <div class="st-wp hidden"><i></i><span></span></div>`;
    host.appendChild(root);
    const q = (s) => root.querySelector(s);
    this.hud = {
      root, title: q('.st-obj h4'), list: q('.st-obj ul'), alarm: q('.st-alarm'),
      radio: q('.st-radio'), who: q('.st-radio b'), say: q('.st-radio span'),
      prompt: q('.st-prompt'), ptext: q('.st-prompt span'), pbar: q('.st-prompt em'),
      wp: q('.st-wp'), wpd: q('.st-wp span'),
    };
    this.hud.title.textContent = `Missão ${this.def.n} · ${this.def.title}`;
  }

  renderObjs() {
    if (!this.hud) return;
    const ul = this.hud.list;
    ul.innerHTML = '';
    for (const o of this.objs) {
      const li = document.createElement('li');
      li.className = o.done ? 'done' : '';
      li.textContent = o.of ? `${o.text} (${o.n}/${o.of})` : o.text;
      ul.appendChild(li);
    }
  }

  setObj(id, n, done) {
    const o = this.objs.find((x) => x.id === id);
    if (!o) return;
    const changed = o.n !== n || o.done !== done;
    if (n !== undefined) o.n = n;
    if (done !== undefined) {
      if (done && !o.done) this.game.audio.beep(1200, 0.09, 0.12);
      o.done = done;
    }
    if (changed) this.renderObjs();
  }

  radio(who, text, dur = 4) { this.radioQ.push({ who, text, dur }); }

  // ---------- regras consultadas pelo jogo ----------
  isEnemy(a, b) {
    if (a.isHostage || b.isHostage) return false;
    if (a.surrendered || b.surrendered) return a.isPlayer || b.isPlayer; // rendidos não atacam
    return a.team !== b.team;
  }

  // dano: colete reforçado do agente; reféns imunes aos tiros da Crakem; força excessiva
  filterDamage(victim, dmg, attacker) {
    if (victim.isHostage) return attacker && attacker.isPlayer ? dmg : 0;
    if (victim.isPlayer) return dmg * 0.6;
    if (victim.surrendered && attacker && attacker.isPlayer && !victim.excessive) {
      victim.excessive = true;
      this.excessive++;
      this.radio('Central', `${AGENT.callsign}, o suspeito estava rendido! Uso excessivo da força.`, 4);
    }
    return dmg;
  }

  hostageHit(shooter) {
    if (shooter && shooter.isPlayer) this.fail('Você atingiu um refém.');
  }

  onKill(victim) {
    if (victim.isPlayer) this.after(1.4, () => this.fail('O Agente Falcão foi abatido.'));
  }

  roamGoal(bot) {
    if (bot.route) {
      bot.routeIdx = (bot.routeIdx + 1) % bot.route.length;
      const p = bot.route[bot.routeIdx];
      return { x: p.x + rand(-0.5, 0.5), z: p.z + rand(-0.5, 0.5) };
    }
    if (bot.post && bot.home) return { x: bot.home.x + rand(-1.2, 1.2), z: bot.home.z + rand(-1.2, 1.2) };
    return null;
  }

  // ---------- comportamento de reféns e rendidos ----------
  hostageCtrl(b, dt, game) {
    b.vel.x = b.vel.z = 0;
    if (b.hState === 'walk') {
      if (!b.path) b.setPath(game, this.extract.x + rand(-0.8, 0.8), this.extract.z + rand(-0.8, 0.8));
      b.mv.x = b.mv.z = 0;
      const moving = b.followPath();
      if (moving) {
        b.vel.x = b.mv.x * 3.2;
        b.vel.z = b.mv.z * 3.2;
        b.yaw = Math.atan2(-b.mv.x, -b.mv.z);
      }
      if (Math.hypot(b.pos.x - this.extract.x, b.pos.z - this.extract.z) < 2.4 || (!moving && !b.path)) {
        b.hState = 'safe';
        b.pose = 'civil';
      }
    }
    game.world.move(b, dt);
    b.model.update(dt, b);
    return true;
  }

  surrender(b, line) {
    if (b.surrendered) return;
    b.surrendered = true;
    b.pose = 'surrender';
    b.target = null;
    b.weapon.cancelReload();
    b.ctrl = (dt, game) => {
      b.vel.x = b.vel.z = 0;
      const p = game.player;
      if (!b.cuffed) b.yaw += angleDiff(b.yaw, yawTo(b.pos, p.pos)) * Math.min(1, dt * 2);
      game.world.move(b, dt);
      b.model.update(dt, b);
      return true;
    };
    this.radio(b.name, line || pick(['Não atira! Eu me rendo!', 'Tá bom, tá bom! Perdi!', 'Calma! Tô largando a arma!']), 2.6);
    this.game.audio.beep(1200, 0.09, 0.12);
  }

  // voz de prisão: chance maior se o suspeito estiver desprevenido, ferido, perto e sozinho
  orderSurrender(b) {
    const g = this.game;
    const p = g.player;
    const dist = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z);
    const unaware = b.state !== 'engage' || !b.targetVisible;
    let ch = unaware ? 0.62 : 0.2;
    if (b.health < 60) ch += 0.3;
    if (dist < 6) ch += 0.2;
    if (b.hold) ch -= 0.1;
    for (const o of this.crew) {
      const ob = o.b;
      if (ob !== b && ob.alive && !ob.surrendered && Math.hypot(ob.pos.x - b.pos.x, ob.pos.z - b.pos.z) < 9) ch -= 0.15;
    }
    ch = Math.min(0.95, Math.max(0.05, ch));
    this.radio(AGENT.callsign, pick(['Polícia! Mãos para o alto!', 'Larga a arma! Agora!', 'Unidade tática! No chão!']), 1.6);
    g.audio.beep(1700, 0.04, 0.08);
    if (Math.random() < ch) this.after(0.45, () => { if (b.alive) this.surrender(b); });
    else {
      b.orderCD = g.time + 2.5;
      b.target = p;
      b.lastKnown.copy(p.pos);
      if (!b.hold) b.state = 'chase';
      this.radio(b.name, pick(['Nem pensar!', 'Vem me pegar!', 'Aqui ninguém se rende!']), 1.8);
    }
  }

  // ---------- quadro ----------
  update(dt) {
    const g = this.game;
    if (this.ended || !g.active) return;
    const p = g.player;
    const inp = g.inputBlocked ? null : g.input;
    for (let i = this.timers.length - 1; i >= 0; i--) if (g.time >= this.timers[i].t) { const t = this.timers.splice(i, 1)[0]; t.fn(); if (this.ended) return; }

    // rádio
    this.radioT -= dt;
    if (this.radioT <= 0) {
      const m = this.radioQ.shift();
      if (m) {
        this.hud.who.textContent = `${m.who}:`;
        this.hud.say.textContent = m.text;
        this.hud.radio.classList.remove('hidden');
        this.radioT = m.dur;
        g.audio.beep(1700, 0.04, 0.08);
      } else this.hud.radio.classList.add('hidden');
    }

    // alarme: qualquer criminoso em combate ou em perseguição
    if (!this.alarm && this.crew.some(({ b }) => b.alive && !b.surrendered && (b.state === 'engage' || b.state === 'chase'))) {
      this.alarm = true;
      this.alarmT = this.def.alarmTime;
      this.radio('Central', `Alarme disparado! ${AGENT.callsign}, você tem ${this.def.alarmTime} segundos para tirar os reféns!`, 4);
      g.announce('ALARME!', `Liberte os reféns em ${this.def.alarmTime} s`, 2.2, '#ff6b5b', 'beep');
    }
    const allFree = this.hostages.every(({ b }) => b.hState !== 'tied');
    if (this.alarm && !allFree) {
      this.alarmT -= dt;
      this.hud.alarm.classList.remove('hidden');
      this.hud.alarm.textContent = `ALARME · ${Math.max(0, Math.ceil(this.alarmT))} s`;
      if (this.alarmT <= 0) { this.fail('O tempo acabou e os sequestradores feriram os reféns.'); return; }
    } else this.hud.alarm.classList.add('hidden');

    // entrada no armazém
    const z = this.def.zone;
    const inZone = (q) => q.x > cellToWorld(z.c0[0]) - 1 && q.x < cellToWorld(z.c1[0]) + 1 && q.z > cellToWorld(z.c0[1]) - 1 && q.z < cellToWorld(z.c1[1]) + 1;
    if (!this.entered && p.alive && inZone(p.pos)) {
      this.entered = true;
      this.setObj('reach', undefined, true);
      this.radio('Central', 'Você está dentro. Cuidado com os reféns na linha de tiro.', 3.5);
    }

    // rendição espontânea: ferido, encurralado e com o agente por perto
    for (const { b } of this.crew) {
      if (!b.alive || b.surrendered || b.triedGiveUp) continue;
      if (b.health < 40 && p.alive && Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z) < 11) {
        b.triedGiveUp = true;
        if (Math.random() < 0.55) this.surrender(b);
      }
    }

    // interação: libertar, algemar ou dar voz de prisão
    this.interact(dt, inp);

    // contagem dos objetivos
    const freed = this.hostages.filter(({ b }) => b.hState !== 'tied').length;
    const saved = this.hostages.filter(({ b }) => b.hState === 'safe').length;
    const neutral = this.crew.filter(({ b }) => !b.alive || b.surrendered).length;
    this.setObj('free', freed, freed === this.hostages.length);
    this.setObj('extract', saved, saved === this.hostages.length);
    this.setObj('crew', neutral, neutral === this.crew.length);
    if (saved === this.hostages.length && neutral === this.crew.length) { this.win(); return; }

    // marcador do próximo objetivo
    this.updateWaypoint();
    // luzes da viatura
    if (this.lights) { const on = Math.floor(g.time * 3) % 2; this.lights[0].visible = !!on; this.lights[1].visible = !on; }
    if (this.ring) this.ring.material.opacity = 0.45 + Math.sin(g.time * 4) * 0.25;
  }

  // alvo de interação mais próximo à frente do agente
  interact(dt, inp) {
    const g = this.game;
    const p = g.player;
    let target = null, verb = '', need = 0;
    if (p.alive) {
      p.eyePos(_v);
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
      let best = 2.3;
      const consider = (b, v, t) => {
        const dx = b.pos.x - p.pos.x, dz = b.pos.z - p.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist > best) return;
        if ((dx * fx + dz * fz) / Math.max(0.01, dist) < 0.35 && dist > 0.9) return;
        best = dist; target = b; verb = v; need = t;
      };
      for (const { b } of this.hostages) if (b.hState === 'tied') consider(b, 'Libertar refém', 1.5);
      for (const { b } of this.crew) if (b.alive && b.surrendered && !b.cuffed) consider(b, `Algemar ${b.name}`, 1.3);
    }
    const holding = inp && inp.keys.has('KeyE');
    if (target) {
      const key = document.body.classList.contains('touch') ? 'AÇÃO' : 'E';
      this.hud.prompt.classList.remove('hidden');
      if (holding && this.holdTarget === target) this.holdT += dt;
      else this.holdT = holding ? dt : 0;
      this.holdTarget = target;
      this.hud.ptext.textContent = `Segure ${key}: ${verb}`;
      this.hud.pbar.style.width = `${Math.min(100, (this.holdT / need) * 100)}%`;
      if (this.holdT >= need) {
        this.holdT = 0;
        if (target.isHostage) {
          target.hState = 'walk';
          target.pose = 'civil';
          target.path = null;
          this.radio(target.name, pick(['Obrigado! Obrigado!', 'Graças a Deus vocês chegaram!', 'Pensei que não ia sair daqui...']), 2.4);
          this.radio('Central', 'Refém liberado. Ele está indo para a viatura.', 2.6);
        } else {
          target.cuffed = true;
          target.pose = 'cuffed';
          this.radio('Central', `${target.name} sob custódia. Bom trabalho.`, 2.4);
        }
        g.audio.beep(1200, 0.09, 0.12);
      }
      return;
    }
    this.holdT = 0;
    this.holdTarget = null;
    // sem alvo próximo: voz de prisão para o suspeito na mira
    let aimed = null;
    if (p.alive) {
      p.eyePos(_v);
      _d.set(-Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.yaw) * Math.cos(p.pitch));
      let bestDot = 0.965;
      for (const { b } of this.crew) {
        if (!b.alive || b.surrendered) continue;
        const dx = b.pos.x - _v.x, dy = b.pos.y + 1.2 - _v.y, dz = b.pos.z - _v.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist > 16) continue;
        const dot = (dx * _d.x + dy * _d.y + dz * _d.z) / dist;
        if (dot > bestDot && g.world.clear(_v.x, _v.y, _v.z, b.pos.x, b.pos.y + 1.3, b.pos.z)) { bestDot = dot; aimed = b; }
      }
    }
    if (aimed) {
      this.hud.prompt.classList.remove('hidden');
      this.hud.ptext.textContent = `${document.body.classList.contains('touch') ? 'AÇÃO' : 'E'}: dar voz de prisão a ${aimed.name}`;
      this.hud.pbar.style.width = '0%';
      if (inp && inp.justPressed('KeyE') && g.time > (aimed.orderCD || 0) && g.time > this.orderCD) {
        this.orderCD = g.time + 1.2;
        this.orderSurrender(aimed);
      }
    } else this.hud.prompt.classList.add('hidden');
  }

  updateWaypoint() {
    const g = this.game;
    let t = null, label = '';
    const tied = this.hostages.find(({ b }) => b.hState === 'tied');
    const walking = this.hostages.find(({ b }) => b.hState === 'walk');
    if (tied) { t = tied.b.pos; label = 'Refém'; }
    else if (walking) { t = this.extract; label = 'Viatura'; }
    else {
      const left = this.crew.find(({ b }) => b.alive && !b.surrendered && b.spotted && b.spotted.A > g.time - 30);
      if (left) { t = left.b.pos; label = 'Suspeito'; }
    }
    const wp = this.hud.wp;
    if (!t || !g.player.alive) { wp.classList.add('hidden'); return; }
    _v.set(t.x, (t.y || 0) + 1.2, t.z).project(g.camera);
    const behind = _v.z > 1;
    let x = _v.x, y = _v.y;
    if (behind) { x = -x; y = -y; }
    const m = Math.max(Math.abs(x), Math.abs(y));
    if (behind || m > 0.9) { x = (x / Math.max(m, 0.001)) * 0.9; y = (y / Math.max(m, 0.001)) * 0.9; }
    wp.classList.remove('hidden');
    wp.style.left = `${(x * 0.5 + 0.5) * 100}%`;
    wp.style.top = `${(-y * 0.5 + 0.5) * 100}%`;
    const dist = Math.hypot(t.x - g.player.pos.x, t.z - g.player.pos.z);
    this.hud.wpd.textContent = `${label} · ${Math.round(dist)} m`;
  }

  // ---------- fim ----------
  fail(reason) {
    if (this.ended) return;
    this.ended = true;
    this.success = false;
    this.reason = reason;
    this.finish('MISSÃO FRACASSADA', reason, '#ff6b5b');
  }

  win() {
    if (this.ended) return;
    this.ended = true;
    this.success = true;
    this.radio('Central', 'Reféns a salvo e área limpa. Excelente trabalho, Falcão. Volte para a base.', 4);
    this.finish('MISSÃO CUMPRIDA', 'Reféns a salvo e área sob controle.', '#6dff9e');
  }

  finish(title, sub, color) {
    const g = this.game;
    this.hud.prompt.classList.add('hidden');
    this.hud.wp.classList.add('hidden');
    this.endTime = g.time;
    g.phase = 'matchEnd';
    g.phaseT = 3.2;
    g.announce(title, sub, 3, color, 'matchEnd', { win: this.success });
  }

  results() {
    const g = this.game;
    const p = g.player;
    const lines = [];
    let score = 0;
    const add = (label, count, pts) => { if (!count) return; lines.push([label, count, count * pts]); score += count * pts; };
    const saved = this.hostages.filter(({ b }) => b.hState === 'safe').length;
    const cuffed = this.crew.filter(({ b }) => b.alive && b.cuffed).length;
    const surr = this.crew.filter(({ b }) => b.alive && b.surrendered && !b.cuffed).length;
    const down = this.crew.filter(({ b }) => !b.alive).length;
    add('Reféns salvos', saved, SCORE.saved);
    add('Criminosos presos', cuffed, SCORE.cuffed);
    add('Criminosos rendidos (sem algemas)', surr, SCORE.surrendered);
    add('Criminosos abatidos', down, SCORE.down);
    if (this.success && !this.alarm) add('Sem disparar o alarme', 1, SCORE.stealth);
    if (this.success) { const tb = Math.max(0, Math.round((300 - (this.endTime || g.time)) * 2)); if (tb) { lines.push(['Bônus de tempo', `${Math.round(this.endTime || g.time)} s`, tb]); score += tb; } }
    add('Uso excessivo da força', this.excessive, SCORE.excessive);
    score = Math.max(0, score);
    const [s2, s3] = this.def.stars;
    const stars = this.success ? (score >= s3 ? 3 : score >= s2 ? 2 : 1) : 0;
    const prog = storyProgress();
    const prev = prog[this.def.id] || {};
    const best = Math.max(prev.best || 0, this.success ? score : 0);
    if (this.success) {
      prog[this.def.id] = { done: true, best, stars: Math.max(prev.stars || 0, stars) };
      saveSettings();
    }
    const acc = p.shots ? Math.round((p.hits / p.shots) * 100) : 0;
    return {
      mode: 'story', rows: [p], title: this.success ? 'MISSÃO CUMPRIDA' : 'MISSÃO FRACASSADA',
      subtitle: this.success ? `Missão ${this.def.n} · ${this.def.title}` : this.reason,
      color: this.success ? '#6dff9e' : '#ff6b5b', playerWon: this.success, acc, hs: 0, time: g.time, teamScore: { A: 0, B: 0 },
      story: { mission: this.def.id, success: this.success, lines, score, stars, best, isBest: this.success && score >= best, next: CAMPAIGN[this.def.n] || null },
    };
  }
}

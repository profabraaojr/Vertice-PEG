// Modo história: campanha individual do Agente Falcão (unidade tática) contra a organização
// criminosa Crakem, liderada pelo terrorista Vugo.
//
// O motor de missões cuida do que é comum a todas as operações (criminosos com rotas e postos,
// rádio, alarme, voz de prisão, rendição, algemas, marcador de objetivo, falha, pontuação,
// estrelas e progresso salvo). Cada tipo de missão (KINDS) acrescenta suas regras: reféns,
// artefato explosivo, fuga do líder ou proteção da equipe com o rifle de precisão.
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
const ALLIES = ['Agente Lima', 'Agente Prado', 'Agente Reis'];

const CRIM_COLOR = 0x2a2b2e;
const PTS = { saved: 500, cuffed: 400, surrendered: 200, down: 100, stealth: 600, excessive: -500 };

// ------------------------------------------------------------------ campanha
export const CAMPAIGN = [
  {
    id: 'm1', n: 1, kind: 'hostage', map: 'ferrugem', ready: true,
    title: 'Resgate no Distrito Ferrugem', tag: 'Sequestro · dia',
    brief: [
      'A Crakem invadiu um depósito do Distrito Ferrugem e mantém três funcionários como reféns no armazém nordeste.',
      'Entre, liberte os reféns e leve-os até a viatura no pátio. Prefira dar voz de prisão: criminosos rendidos e algemados valem mais do que abatidos.',
      'Se o alarme soar, você terá 90 segundos para libertar todos os reféns.',
    ],
    controls: 'E (ou AÇÃO no celular): dar voz de prisão mirando no suspeito · segurar E: algemar rendidos e libertar reféns.',
    alarmTime: 90, stars: [2200, 3300],
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
    extract: [32, 13], van: [33.6, 12.4],
  },
  {
    id: 'm2', n: 2, kind: 'bomb', map: 'noite', ready: true,
    title: 'Contagem regressiva', tag: 'Atentado a bomba · noite',
    brief: [
      'Uma ligação anônima avisou: a Crakem escondeu um artefato explosivo num dos prédios do Distrito Ferrugem. A energia foi cortada.',
      'Use os óculos de visão noturna (X ou NV), siga o sinal do detector e desarme o artefato antes do fim da contagem. Homens da Crakem vigiam a área.',
      'Para desarmar, corte os fios na ordem dos símbolos mostrados no visor do artefato. Um fio fora de ordem tira 25 segundos do relógio.',
    ],
    controls: 'X: visão noturna · segurar E: abrir o painel do artefato · 1 a 4 (ou toque nos fios): cortar · E: voz de prisão.',
    time: { recruta: 300, soldado: 240, veterano: 190 }, stars: [2200, 3100],
    sites: [[5, 13], [29, 4], [30, 22]],
    crew: [
      { at: [7, 11], post: true },
      { at: [27, 6], post: true },
      { at: [28, 24], post: true },
      { route: [[14, 10], [20, 14], [16, 17], [12, 12]] },
      { route: [[22, 20], [30, 18], [28, 28], [20, 25]] },
      { route: [[13, 2], [21, 3], [21, 7], [14, 7]] },
    ],
  },
  {
    id: 'm3', n: 3, kind: 'capture', map: 'selva', ready: true,
    title: 'A caçada a Vugo', tag: 'Captura · selva',
    brief: [
      `Depois dos atentados, a inteligência localizou ${LEADER}, líder da Crakem, numa cabana na Selva Esmeralda, protegido por guarda-costas.`,
      `${LEADER} precisa ser capturado vivo para responder à Justiça. Os tiros não o matam: ferido, ele se rende. Ao perceber a sua chegada, ele foge para um barco a oeste.`,
      'Se ele alcançar o barco, a missão fracassa. Dar voz de prisão sem disparar contra ele vale mais pontos.',
    ],
    controls: 'E: voz de prisão (mirando) · segurar E: algemar · Shift: correr atrás do fugitivo.',
    stars: [2600, 3500],
    leader: { at: [31, 6] },
    escape: [3, 15],
    crew: [
      { at: [32, 7], hold: true },
      { at: [31, 3], post: true },
      { at: [26, 7], post: true },
      { route: [[20, 2], [26, 4], [22, 9], [16, 6]] },
      { route: [[24, 12], [32, 12], [30, 16], [22, 15]] },
    ],
    camp: { c0: [28, 4], c1: [34, 9], label: 'cabana de Vugo' },
  },
  {
    id: 'm4', n: 4, kind: 'sniper', map: 'ruinas', ready: true,
    title: 'Olho no alto', tag: 'Tiro de precisão · ruínas',
    brief: [
      'A Crakem armou uma emboscada nas Ruínas de Aruanã para impedir que a equipe tática chegue ao templo, onde estão as provas contra a organização.',
      'Do alto de um bloco de pedra, com o rifle de precisão, cubra o avanço dos agentes Lima, Prado e Reis. Elimine os atiradores emboscados, inclusive o atirador de elite "Agulha", de colete vermelho.',
      'Camuflado no alto, você só é localizado por alguns segundos depois de cada disparo: escolha bem a hora de atirar.',
      'Há civis na praça. Atingir um civil encerra a missão.',
    ],
    controls: 'Botão direito (ou MIRA): luneta com 2 níveis de zoom · com a luneta, E dá voz de prisão a até 30 m.',
    stars: [2400, 3300],
    perch: [14.5, 25.5],
    allyStart: [[29, 31], [31, 31], [30, 33]],
    allyRoute: [[27, 27], [22, 22], [19, 17], [21, 12], [23, 6], [21, 3]],
    crew: [
      { at: [25, 17], hold: true },
      { at: [18, 14], hold: true },
      { at: [27, 11], hold: true },
      { at: [15, 9], hold: true },
      { at: [24, 7], hold: true },
      { at: [17, 4], hold: true },
      { at: [32, 2], hold: true, marksman: true },
    ],
    civilians: [[19, 20], [22, 18], [20, 16], [16, 22]],
  },
];
export const missionById = (id) => CAMPAIGN.find((m) => m.id === id);

export function storyProgress() {
  if (!settings.story || typeof settings.story !== 'object') settings.story = {};
  return settings.story;
}

// ------------------------------------------------------------------ utilidades
const PASS = new Set(['.', ',', 'v', 'Z', 'A', 'd']);
function walkableCell(cx, cy) {
  if (PASS.has(charAt(cx, cy))) return [cx, cy];
  for (let r = 1; r < 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (PASS.has(charAt(cx + dx, cy + dy))) return [cx + dx, cy + dy];
  }
  return [cx, cy];
}
const W = ([cx, cy]) => { const [x, y] = walkableCell(Math.round(cx), Math.round(cy)); return { x: cellToWorld(x), z: cellToWorld(y) }; };
const yawTo = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z));
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const inBox = (q, z) => q.x > cellToWorld(z.c0[0]) - 1 && q.x < cellToWorld(z.c1[0]) + 1 && q.z > cellToWorld(z.c0[1]) - 1 && q.z < cellToWorld(z.c1[1]) + 1;
const randomLook = () => ({ skin: pick(SKINS).id, eyes: pick(EYES).id, hair: pick(HAIRS).id, hairColor: pick(HAIR_COLORS).id, camo: 'urbano' });
const civilStyle = () => ({ kind: 'civil', shirt: pick([0x8a9bb0, 0xb07a5a, 0x6f8a62, 0xc9b98f, 0x9a6f8e, 0xd0d4d8]), pants: pick([0x34465e, 0x2e3a2a, 0x4a3a2c]) });
const stars = (n) => `${'★'.repeat(n)}${'☆'.repeat(3 - n)}`;
export { stars as starText };

const _v = new THREE.Vector3();
const _d = new THREE.Vector3();

// ------------------------------------------------------------------ missão em andamento
export class StoryMission {
  constructor(game, def) {
    this.game = game;
    this.def = def;
    this.kind = KINDS[def.kind];
    this.objs = [];
    this.radioQ = [];
    this.radioT = 0;
    this.alarm = false;
    this.ended = false;
    this.excessive = 0;
    this.holdT = 0;
    this.holdTarget = null;
    this.orderCD = 0;
    this.objects = [];
    this.timers = [];
    this.crew = [];
    this.hostages = [];
    this.allies = [];
    this.civilians = [];
    this.blocksInput = false;
    this.extraLines = [];
  }

  after(sec, fn) { this.timers.push({ t: this.game.time + sec, fn }); }
  radio(who, text, dur = 4) { this.radioQ.push({ who, text, dur }); }

  // ---------- montagem ----------
  setup() {
    document.body.classList.add('story');
    this.buildHud();
    const names = shuffle(CREW.slice());
    this.crew = (this.def.crew || []).map((c, i) => this.makeCrim(names[i % names.length], c, i));
    this.kind.setup(this);
    this.game.bots = [...this.crew.map((c) => c.b), ...this.hostages.map((h) => h.b), ...this.allies.map((a) => a.b), ...this.civilians.map((c) => c.b)];
    this.renderObjs();
  }

  makeCrim(name, c, i, extra = {}) {
    const g = this.game;
    const style = { kind: 'crim', leader: !!extra.leader, marksman: !!c.marksman };
    const b = new Bot({ id: 10 + i, name: extra.name || (c.marksman ? 'Agulha' : name), team: 'B', color: CRIM_COLOR, style }, g.config.difficulty);
    b.setLoadout(c.marksman ? 'longinus' : extra.leader ? null : pick(['ratel', 'tempest', 'bulldog', 'ratel', 'kestrel']), 'vp9', false, 'katana');
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
  }

  makeCivil(i, name, at) {
    const g = this.game;
    const b = new Bot({ id: 40 + i, name, team: 'C', color: 0x8a9bb0, look: randomLook(), style: civilStyle() }, 'recruta');
    b.setLoadout(null, 'vp9', false, 'katana');
    b.isCivilian = true;
    g.scene.add(b.model.root);
    return { b, at };
  }

  // posiciona tudo no início (chamado depois de montar a partida)
  spawnAll() {
    const g = this.game;
    const sp = this.kind.playerStart ? this.kind.playerStart(this) : g.map.teamSpawns.A[0];
    g.spawnCombatant(g.player, sp.x, sp.z, sp.yaw ?? 0);
    g.player.spawnProtect = 1;
    if (sp.y) g.player.pos.y = sp.y;
    for (const { b, at, c } of this.crew) {
      g.spawnCombatant(b, at.x, at.z, b.lookAt ? yawTo(at, b.lookAt) : rand(-3, 3));
      b.respawnTimer = Infinity;
      if (c.hold || c.post) b.state = 'search';
    }
    for (const list of [this.hostages, this.civilians, this.allies]) for (const { b, at } of list) {
      g.spawnCombatant(b, at.x, at.z, at.yaw ?? rand(-3, 3));
      b.respawnTimer = Infinity;
    }
    this.kind.start && this.kind.start(this);
  }

  addRing(p, color = 0x6dff9e, r = 1.85) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.15, r + 0.15, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(p.x, (p.y || 0) + 0.04, p.z);
    this.game.scene.add(ring);
    this.objects.push(ring);
    return ring;
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
      <div class="st-obj"><h4></h4><ul></ul><div class="st-meter hidden"></div><div class="st-alarm hidden"></div></div>
      <div class="st-radio hidden"><b></b><span></span></div>
      <div class="st-prompt hidden"><span></span><i><em></em></i></div>
      <div class="st-wp hidden"><i></i><span></span></div>
      <div class="st-bomb hidden"><h3>Painel do artefato</h3><div class="sb-display"></div><p class="sb-help"></p><div class="sb-wires"></div><p class="sb-msg"></p></div>
      <div class="st-flash"></div>`;
    host.appendChild(root);
    const q = (s) => root.querySelector(s);
    this.hud = {
      root, title: q('.st-obj h4'), list: q('.st-obj ul'), alarm: q('.st-alarm'), meter: q('.st-meter'),
      radio: q('.st-radio'), who: q('.st-radio b'), say: q('.st-radio span'),
      prompt: q('.st-prompt'), ptext: q('.st-prompt span'), pbar: q('.st-prompt em'),
      wp: q('.st-wp'), wpd: q('.st-wp span'), bomb: q('.st-bomb'), flash: q('.st-flash'),
    };
    this.hud.title.textContent = `Missão ${this.def.n} · ${this.def.title}`;
  }

  renderObjs() {
    if (!this.hud) return;
    const ul = this.hud.list;
    ul.innerHTML = '';
    for (const o of this.objs) {
      const li = document.createElement('li');
      li.className = (o.done ? 'done' : '') + (o.optional ? ' bonus' : '');
      const mark = document.createElement('i');
      mark.textContent = o.done ? '◆' : '◇';
      const t = document.createElement('span');
      t.textContent = (o.of ? `${o.text} (${o.n}/${o.of})` : o.text) + (o.optional ? ' · bônus' : '');
      li.append(mark, t);
      ul.appendChild(li);
    }
  }

  setObj(id, n, done) {
    const o = this.objs.find((x) => x.id === id);
    if (!o) return;
    const changed = (n !== undefined && o.n !== n) || (done !== undefined && o.done !== done);
    if (n !== undefined) o.n = n;
    if (done !== undefined) {
      if (done && !o.done) this.game.audio.beep(1320, 0.12, 0.14);
      o.done = done;
    }
    if (changed) this.renderObjs();
  }

  setTimer(text, danger) {
    const el = this.hud.alarm;
    el.classList.toggle('hidden', !text);
    if (text) { el.textContent = text; el.classList.toggle('calm', !danger); }
  }

  // ---------- regras consultadas pelo jogo ----------
  isEnemy(a, b) {
    if (a.isHostage || b.isHostage || a.isCivilian || b.isCivilian) return false;
    if (a.surrendered || b.surrendered) return a.isPlayer || b.isPlayer; // rendidos não atacam
    if (a.team === b.team) return false;
    // no alto, camuflado, o atirador de elite só é localizado logo depois de disparar ou de perto
    if (this.def.kind === 'sniper' && b.isPlayer && a.isCrim) return this.exposed(a, b);
    return true;
  }

  exposed(crim, p) {
    const g = this.game;
    if (p.shots > (this.lastShots || 0)) { this.lastShots = p.shots; this.shotT = g.time; }
    return g.time - (this.shotT ?? -99) < 3.5 || dist2(crim.pos, p.pos) < 12;
  }

  // colete reforçado do agente e da equipe; inocentes só se ferem pelo agente; força excessiva
  filterDamage(victim, dmg, attacker) {
    if (victim.isHostage || victim.isCivilian) return attacker && attacker.isPlayer ? dmg : 0;
    if (victim.isPlayer) return dmg * (this.def.kind === 'sniper' ? 0.3 : 0.6); // no alto, o agente fica protegido pela pedra
    if (victim.isAlly) return attacker && attacker.isPlayer ? 0 : dmg * 0.45;
    if (victim.isLeader) {
      // Vugo precisa ser capturado vivo: os tiros o ferem, mas não o matam
      const hp = Math.max(8, victim.health - dmg);
      dmg = victim.health - hp;
      if (attacker && attacker.isPlayer) victim.shotByAgent = true;
      if (hp < 50 && !victim.surrendered) this.after(0.3, () => this.surrender(victim, 'Chega! Eu me rendo... não atira!'));
      if (dmg <= 0) { victim.lastAttacker = attacker; return 0; }
    }
    if (victim.surrendered && attacker && attacker.isPlayer && !victim.excessive) {
      victim.excessive = true;
      this.excessive++;
      this.radio('Central', `${AGENT.callsign}, o suspeito estava rendido! Uso excessivo da força.`, 4);
    }
    return dmg;
  }

  innocentHit(shooter, victim) {
    if (!shooter || !shooter.isPlayer) return;
    this.fail(victim.isHostage ? 'Você atingiu um refém.' : 'Você atingiu um civil.');
  }

  onKill(victim) {
    if (victim.isPlayer) this.after(1.4, () => this.fail('O Agente Falcão foi abatido.'));
    else if (this.kind.onKill) this.kind.onKill(this, victim);
  }

  roamGoal(bot) {
    if (bot.route) {
      if (bot.isAlly) return bot.route[Math.min(bot.routeIdx, bot.route.length - 1)];
      bot.routeIdx = (bot.routeIdx + 1) % bot.route.length;
      const p = bot.route[bot.routeIdx];
      return { x: p.x + rand(-0.5, 0.5), z: p.z + rand(-0.5, 0.5) };
    }
    if (bot.post && bot.home) return { x: bot.home.x + rand(-1.2, 1.2), z: bot.home.z + rand(-1.2, 1.2) };
    return null;
  }

  // movimento simples para quem é controlado pela missão (reféns, civis, fugitivo)
  walk(b, dt, game, speed, goal) {
    b.vel.x = b.vel.z = 0;
    if (goal) {
      if (!b.path || b.goalKey !== `${goal.x.toFixed(1)},${goal.z.toFixed(1)}`) { b.goalKey = `${goal.x.toFixed(1)},${goal.z.toFixed(1)}`; b.setPath(game, goal.x, goal.z); }
      b.mv.x = b.mv.z = 0;
      if (b.followPath()) {
        b.vel.x = b.mv.x * speed;
        b.vel.z = b.mv.z * speed;
        b.yaw += angleDiff(b.yaw, Math.atan2(-b.mv.x, -b.mv.z)) * Math.min(1, dt * 8);
      }
    }
    game.world.move(b, dt);
    b.model.update(dt, b);
  }

  // ---------- rendição e prisão ----------
  surrender(b, line) {
    if (b.surrendered || !b.alive) return;
    b.surrendered = true;
    b.pose = 'surrender';
    b.target = null;
    b.weapon.cancelReload();
    b.ctrl = (dt, game) => {
      b.vel.x = b.vel.z = 0;
      if (!b.cuffed) b.yaw += angleDiff(b.yaw, yawTo(b.pos, game.player.pos)) * Math.min(1, dt * 2);
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
    const dist = dist2(b.pos, p.pos);
    const unaware = b.state !== 'engage' || !b.targetVisible;
    let ch = unaware ? 0.62 : 0.2;
    if (b.isLeader) ch = b.fleeing ? 0.3 : 0.2;
    if (b.health < 60) ch += 0.3;
    if (dist < 6) ch += 0.2;
    if (b.hold && !b.isLeader) ch -= 0.1;
    for (const o of this.crew) {
      const ob = o.b;
      if (ob !== b && ob.alive && !ob.surrendered && dist2(ob.pos, b.pos) < 9) ch -= 0.15;
    }
    ch = Math.min(0.95, Math.max(0.05, ch));
    this.radio(AGENT.callsign, pick(['Polícia! Mãos para o alto!', 'Larga a arma! Agora!', 'Unidade tática! No chão!']), 1.6);
    g.audio.beep(1700, 0.04, 0.08);
    if (Math.random() < ch) this.after(0.45, () => { if (b.alive) this.surrender(b); });
    else {
      b.orderCD = g.time + 2.5;
      if (!b.isLeader) {
        b.target = p;
        b.lastKnown.copy(p.pos);
        if (!b.hold) b.state = 'chase';
      }
      this.radio(b.name, b.isLeader ? pick(['Você nunca vai me pegar!', 'A Crakem não se rende!']) : pick(['Nem pensar!', 'Vem me pegar!', 'Aqui ninguém se rende!']), 1.8);
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

    // alarme: algum criminoso em combate ou em perseguição
    if (!this.alarm && this.crew.some(({ b }) => b.alive && !b.surrendered && (b.state === 'engage' || b.state === 'chase'))) {
      this.alarm = true;
      if (this.kind.onAlarm) this.kind.onAlarm(this);
    }

    // rendição espontânea: ferido, encurralado e com o agente por perto
    for (const { b } of this.crew) {
      if (!b.alive || b.surrendered || b.triedGiveUp || b.isLeader) continue;
      if (b.health < 40 && p.alive && dist2(b.pos, p.pos) < 11) {
        b.triedGiveUp = true;
        if (Math.random() < 0.55) this.surrender(b);
      }
    }

    this.interact(dt, this.blocksInput ? g.input : inp);
    this.kind.update(this, dt);
    if (this.ended) return;
    this.updateWaypoint();
  }

  // alvo de interação mais próximo à frente do agente
  interact(dt, inp) {
    const g = this.game;
    const p = g.player;
    if (this.blocksInput) { this.hud.prompt.classList.add('hidden'); return; }
    let target = null, verb = '', need = 0, act = null;
    const key = document.body.classList.contains('touch') ? 'AÇÃO' : 'E';
    if (p.alive) {
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
      let best = 2.3;
      const consider = (pos, v, t, fn, reach = 2.3) => {
        const dx = pos.x - p.pos.x, dz = pos.z - p.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > Math.min(best, reach)) return;
        if ((dx * fx + dz * fz) / Math.max(0.01, d) < 0.35 && d > 0.9) return;
        best = d; target = pos; verb = v; need = t; act = fn;
      };
      if (this.kind.interactables) for (const it of this.kind.interactables(this)) consider(it.pos, it.verb, it.need, it.act, it.reach);
      for (const { b } of this.crew) if (b.alive && b.surrendered && !b.cuffed) {
        consider(b.pos, `Algemar ${b.name}`, 1.3, () => {
          b.cuffed = true;
          b.pose = 'cuffed';
          this.radio('Central', b.isLeader ? `${LEADER} sob custódia! Missão cumprida, ${AGENT.callsign}.` : `${b.name} sob custódia. Bom trabalho.`, 2.6);
        });
      }
    }
    const holding = inp && inp.keys.has('KeyE');
    if (target) {
      this.hud.prompt.classList.remove('hidden');
      if (holding && this.holdTarget === target) this.holdT += dt;
      else this.holdT = holding ? dt : 0;
      this.holdTarget = target;
      this.hud.ptext.textContent = `Segure ${key}: ${verb}`;
      this.hud.pbar.style.width = `${Math.min(100, (this.holdT / need) * 100)}%`;
      if (this.holdT >= need) {
        this.holdT = 0;
        act();
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
      let bestDot = p.zoomLevel > 0 ? 0.995 : 0.965;
      const range = p.zoomLevel > 0 ? 30 : 16;
      for (const { b } of this.crew) {
        if (!b.alive || b.surrendered) continue;
        const dx = b.pos.x - _v.x, dy = b.pos.y + 1.2 - _v.y, dz = b.pos.z - _v.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist > range) continue;
        const dot = (dx * _d.x + dy * _d.y + dz * _d.z) / dist;
        if (dot > bestDot && g.world.clear(_v.x, _v.y, _v.z, b.pos.x, b.pos.y + 1.3, b.pos.z)) { bestDot = dot; aimed = b; }
      }
    }
    if (aimed) {
      this.hud.prompt.classList.remove('hidden');
      this.hud.ptext.textContent = `${key}: dar voz de prisão a ${aimed.name}`;
      this.hud.pbar.style.width = '0%';
      if (inp && inp.justPressed('KeyE') && g.time > (aimed.orderCD || 0) && g.time > this.orderCD) {
        this.orderCD = g.time + 1.2;
        this.orderSurrender(aimed);
      }
    } else this.hud.prompt.classList.add('hidden');
  }

  updateWaypoint() {
    const g = this.game;
    const w = this.kind.waypoint(this);
    const wp = this.hud.wp;
    if (!w || !g.player.alive || this.blocksInput) { wp.classList.add('hidden'); return; }
    const t = w.pos;
    _v.set(t.x, (t.y || 0) + 1.2, t.z).project(g.camera);
    const behind = _v.z > 1;
    let x = _v.x, y = _v.y;
    if (behind) { x = -x; y = -y; }
    const m = Math.max(Math.abs(x), Math.abs(y));
    if (behind || m > 0.9) { x = (x / Math.max(m, 0.001)) * 0.9; y = (y / Math.max(m, 0.001)) * 0.9; }
    wp.classList.remove('hidden');
    wp.classList.toggle('red', !!w.red);
    wp.style.left = `${(x * 0.5 + 0.5) * 100}%`;
    wp.style.top = `${(-y * 0.5 + 0.5) * 100}%`;
    this.hud.wpd.textContent = `${w.label} · ${Math.round(dist2(t, g.player.pos))} m`;
  }

  crewStatus() {
    return {
      cuffed: this.crew.filter(({ b }) => b.alive && b.cuffed).length,
      surr: this.crew.filter(({ b }) => b.alive && b.surrendered && !b.cuffed).length,
      down: this.crew.filter(({ b }) => !b.alive).length,
      neutral: this.crew.filter(({ b }) => !b.alive || b.surrendered).length,
    };
  }

  // ---------- fim ----------
  fail(reason) {
    if (this.ended) return;
    this.ended = true;
    this.success = false;
    this.reason = reason;
    this.blocksInput = false;
    this.hud.bomb.classList.add('hidden');
    this.finish('MISSÃO FRACASSADA', reason, '#ff6b5b');
  }

  win(line, sub) {
    if (this.ended) return;
    this.ended = true;
    this.success = true;
    this.blocksInput = false;
    this.hud.bomb.classList.add('hidden');
    if (line) this.radio('Central', line, 4);
    this.finish('MISSÃO CUMPRIDA', sub || '', '#6dff9e');
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
    const addRaw = (label, shown, pts) => { if (!pts) return; lines.push([label, shown, pts]); score += pts; };
    this.kind.score(this, add, addRaw);
    const cs = this.crewStatus();
    const leaderFilter = (f) => this.crew.filter(({ b }) => !b.isLeader && f(b)).length;
    add('Criminosos presos', leaderFilter((b) => b.alive && b.cuffed), PTS.cuffed);
    add('Criminosos rendidos (sem algemas)', leaderFilter((b) => b.alive && b.surrendered && !b.cuffed), PTS.surrendered);
    add('Criminosos abatidos', leaderFilter((b) => !b.alive), PTS.down);
    void cs;
    if (this.success && !this.alarm && this.kind.stealthBonus !== false) add('Sem disparar o alarme', 1, PTS.stealth);
    if (this.success) {
      const T = this.endTime || g.time;
      const tb = Math.max(0, Math.round((this.kind.parTime || 300) - T) * 2);
      addRaw('Bônus de tempo', `${Math.round(T)} s`, tb);
    }
    add('Uso excessivo da força', this.excessive, PTS.excessive);
    score = Math.max(0, score);
    const [s2, s3] = this.def.stars;
    const st = this.success ? (score >= s3 ? 3 : score >= s2 ? 2 : 1) : 0;
    const prog = storyProgress();
    const prev = prog[this.def.id] || {};
    const best = Math.max(prev.best || 0, this.success ? score : 0);
    if (this.success) {
      prog[this.def.id] = { done: true, best, stars: Math.max(prev.stars || 0, st) };
      saveSettings();
    }
    const acc = p.shots ? Math.round((p.hits / p.shots) * 100) : 0;
    return {
      mode: 'story', rows: [p], title: this.success ? 'MISSÃO CUMPRIDA' : 'MISSÃO FRACASSADA',
      subtitle: this.success ? `Missão ${this.def.n} · ${this.def.title}` : this.reason,
      color: this.success ? '#6dff9e' : '#ff6b5b', playerWon: this.success, acc, hs: 0, time: g.time, teamScore: { A: 0, B: 0 },
      story: { mission: this.def.id, success: this.success, lines, score, stars: st, best, isBest: this.success && score >= best, next: CAMPAIGN[this.def.n] || null },
    };
  }
}

// ------------------------------------------------------------------ tipos de missão
const KINDS = {};

// ===== Missão 1 · reféns =====
KINDS.hostage = {
  parTime: 300,
  setup(m) {
    const d = m.def;
    m.hostages = d.hostages.map((h, i) => {
      const c = m.makeCivil(i, `Refém ${i + 1}`, W(h));
      const b = c.b;
      b.isHostage = true;
      b.isCivilian = false;
      b.pose = 'kneel';
      b.hState = 'tied';
      b.ctrl = (dt, game) => {
        if (b.hState === 'walk') {
          m.walk(b, dt, game, 3.2, m.extract);
          if (dist2(b.pos, m.extract) < 2.4) { b.hState = 'safe'; b.path = null; }
        } else m.walk(b, dt, game, 0, null);
        return true;
      };
      return c;
    });
    m.extract = W(d.extract);
    addVan(m, d.van);
    m.ring = m.addRing(m.extract);
    m.objs = [
      { id: 'reach', text: `Infiltre-se no ${d.zone.label}`, done: false },
      { id: 'free', text: 'Liberte os reféns', n: 0, of: m.hostages.length, done: false },
      { id: 'extract', text: 'Leve os reféns até a viatura', n: 0, of: m.hostages.length, done: false },
      { id: 'crew', text: 'Neutralize os sequestradores (prisão vale mais)', n: 0, of: m.crew.length, done: false },
    ];
  },
  playerStart(m) { const sp = m.game.map.teamSpawns.A[0]; return { x: sp.x, z: sp.z, yaw: yawTo(sp, W(m.def.zone.c0)) }; },
  start(m) {
    m.radio('Central', `${AGENT.callsign}, aqui é a Central. Três reféns no ${m.def.zone.label}. A Crakem tem homens no pátio.`, 5);
    m.radio('Central', 'Dê voz de prisão sempre que puder. Queremos esses criminosos vivos.', 4.5);
  },
  onAlarm(m) {
    m.alarmT = m.def.alarmTime;
    m.radio('Central', `Alarme disparado! ${AGENT.callsign}, você tem ${m.def.alarmTime} segundos para tirar os reféns!`, 4);
    m.game.announce('ALARME!', `Liberte os reféns em ${m.def.alarmTime} s`, 2.2, '#ff6b5b', 'beep');
  },
  interactables(m) {
    return m.hostages.filter(({ b }) => b.hState === 'tied').map(({ b }) => ({
      pos: b.pos, verb: 'Libertar refém', need: 1.5,
      act: () => {
        b.hState = 'walk';
        b.pose = 'civil';
        b.path = null;
        m.radio(b.name, pick(['Obrigado! Obrigado!', 'Graças a Deus vocês chegaram!', 'Pensei que não ia sair daqui...']), 2.4);
        m.radio('Central', 'Refém liberado. Ele está indo para a viatura.', 2.6);
      },
    }));
  },
  update(m, dt) {
    const p = m.game.player;
    const allFree = m.hostages.every(({ b }) => b.hState !== 'tied');
    if (m.alarm && !allFree) {
      m.alarmT -= dt;
      m.setTimer(`ALARME · ${Math.max(0, Math.ceil(m.alarmT))} s`, true);
      if (m.alarmT <= 0) { m.fail('O tempo acabou e os sequestradores feriram os reféns.'); return; }
    } else m.setTimer(null);
    if (!m.entered && p.alive && inBox(p.pos, m.def.zone)) {
      m.entered = true;
      m.setObj('reach', undefined, true);
      m.radio('Central', 'Você está dentro. Cuidado com os reféns na linha de tiro.', 3.5);
    }
    const freed = m.hostages.filter(({ b }) => b.hState !== 'tied').length;
    const saved = m.hostages.filter(({ b }) => b.hState === 'safe').length;
    const { neutral } = m.crewStatus();
    m.setObj('free', freed, freed === m.hostages.length);
    m.setObj('extract', saved, saved === m.hostages.length);
    m.setObj('crew', neutral, neutral === m.crew.length);
    if (saved === m.hostages.length && neutral === m.crew.length) { m.win('Reféns a salvo e área limpa. Excelente trabalho, Falcão.', 'Reféns a salvo e área sob controle.'); return; }
    blinkVan(m);
    if (m.ring) m.ring.material.opacity = 0.45 + Math.sin(m.game.time * 4) * 0.25;
  },
  waypoint(m) {
    const tied = m.hostages.find(({ b }) => b.hState === 'tied');
    if (tied) return { pos: tied.b.pos, label: 'Refém' };
    if (m.hostages.some(({ b }) => b.hState === 'walk')) return { pos: m.extract, label: 'Viatura' };
    return spottedCrim(m);
  },
  score(m, add) {
    add('Reféns salvos', m.hostages.filter(({ b }) => b.hState === 'safe').length, PTS.saved);
  },
};

// ===== Missão 2 · artefato explosivo =====
const SYMBOLS = ['▲', '●', '■', '◆'];
const WIRES = [{ name: 'Vermelho', css: '#e0453a' }, { name: 'Azul', css: '#3d8bff' }, { name: 'Amarelo', css: '#f3c93a' }, { name: 'Verde', css: '#3fc86a' }];
KINDS.bomb = {
  parTime: 240,
  setup(m) {
    const d = m.def;
    const site = pick(d.sites);
    m.bombPos = W(site);
    m.bombSite = site;
    m.bombTime = (d.time[m.game.config.difficulty] || d.time.soldado);
    m.bombLeft = m.bombTime;
    m.found = false;
    m.defused = false;
    m.wrong = 0;
    // fios: cada um com um símbolo; o visor mostra a ordem de 3 deles (o quarto é isca)
    const syms = shuffle(SYMBOLS.slice());
    m.wires = WIRES.map((w, i) => ({ ...w, sym: syms[i], cut: false }));
    m.order = shuffle([0, 1, 2, 3]).slice(0, 3);
    m.step = 0;
    m.bombObj = addBomb(m, m.bombPos, m.order.map((i) => m.wires[i].sym).join('  '));
    m.objs = [
      { id: 'find', text: 'Localize o artefato pelo sinal do detector', done: false },
      { id: 'defuse', text: 'Desarme o artefato', done: false },
      { id: 'crew', text: 'Neutralize os vigias da Crakem', n: 0, of: m.crew.length, done: false, optional: true },
    ];
    m.hud.meter.classList.remove('hidden');
    m.beepT = 0;
    buildBombPanel(m);
  },
  playerStart(m) { const sp = m.game.map.teamSpawns.A[0]; return { x: sp.x, z: sp.z, yaw: Math.PI }; },
  start(m) {
    m.radio('Central', `${AGENT.callsign}, a energia do distrito caiu. Ligue os óculos de visão noturna.`, 4);
    m.radio('Central', 'O detector capta o sinal do artefato: quanto mais forte o sinal, mais perto você está.', 4.5);
    const s = m.bombSite;
    const ns = s[1] < 18 ? 'norte' : 'sul', ew = s[0] < 18 ? 'oeste' : 'leste';
    m.after(35, () => { if (!m.found) m.radio('Central', `A triangulação indica a metade ${ns} do distrito.`, 4); });
    m.after(80, () => { if (!m.found) m.radio('Central', `Mais preciso agora: setor ${ns}-${ew}, dentro de um prédio.`, 4); });
  },
  onAlarm(m) { m.radio('Central', 'Eles sabem que você está aí. Não perca tempo com tiroteio: o artefato é a prioridade.', 4); },
  interactables(m) {
    if (m.defused) return [];
    return [{
      pos: m.bombPos, verb: 'Abrir o painel do artefato', need: 1.0, reach: 2.2,
      act: () => openBombPanel(m),
    }];
  },
  update(m, dt) {
    const g = m.game;
    const p = g.player;
    if (!m.defused) {
      m.bombLeft -= dt;
      const t = Math.max(0, Math.ceil(m.bombLeft));
      m.setTimer(`ARTEFATO · ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`, m.bombLeft < 60);
      if (m.bombLeft <= 0) { explode(m); return; }
      // sinal do detector e bipe que acelera com a proximidade
      const d = dist2(p.pos, m.bombPos);
      const lvl = d < 6 ? 5 : d < 12 ? 4 : d < 20 ? 3 : d < 32 ? 2 : 1;
      m.hud.meter.innerHTML = `Sinal do detector <b>${'▮'.repeat(lvl)}${'▯'.repeat(5 - lvl)}</b>`;
      m.beepT -= dt;
      if (m.beepT <= 0) {
        m.beepT = Math.max(0.18, Math.min(1.6, d / 22));
        g.audio.beep(d < 12 ? 2100 : 1500, 0.05, Math.max(0.03, 0.22 - d / 260));
      }
      if (!m.found && p.alive && d < 7 && g.world.clear(p.pos.x, 1.5, p.pos.z, m.bombPos.x, 0.6, m.bombPos.z)) {
        m.found = true;
        m.setObj('find', undefined, true);
        m.radio('Central', 'Artefato à vista! Abra o painel e siga a ordem do visor.', 3.5);
      }
      const led = m.bombObj.led;
      led.visible = Math.floor(g.time * (m.bombLeft < 60 ? 6 : 2)) % 2 === 0;
    }
    if (m.blocksInput) bombPanelInput(m);
    const { neutral } = m.crewStatus();
    m.setObj('crew', neutral, neutral === m.crew.length);
  },
  waypoint(m) {
    if (m.found && !m.defused) return { pos: m.bombPos, label: 'Artefato', red: true };
    return m.found ? null : spottedCrim(m);
  },
  score(m, add, addRaw) {
    if (m.defused) {
      add('Artefato desarmado', 1, 1500);
      addRaw('Tempo restante no relógio', `${Math.ceil(m.bombLeft)} s`, Math.round(m.bombLeft * 5));
    }
    add('Fios cortados fora de ordem', m.wrong, -150);
  },
};

function buildBombPanel(m) {
  const box = m.hud.bomb.querySelector('.sb-wires');
  box.innerHTML = '';
  m.wires.forEach((w, i) => {
    const b = document.createElement('button');
    b.className = 'sb-wire';
    b.style.setProperty('--c', w.css);
    b.innerHTML = `<i></i><span>${i + 1} · ${w.name}</span><b>${w.sym}</b>`;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); cutWire(m, i); });
    box.appendChild(b);
    w.btn = b;
  });
}

function openBombPanel(m) {
  m.blocksInput = true;
  const h = m.hud.bomb;
  h.classList.remove('hidden');
  h.querySelector('.sb-display').textContent = m.order.map((i) => m.wires[i].sym).join('   ');
  const touch = document.body.classList.contains('touch');
  h.querySelector('.sb-help').textContent = `Corte os fios na ordem dos símbolos do visor (${touch ? 'toque no fio' : 'teclas 1 a 4'}). Um dos fios é isca: não precisa ser cortado.`;
  h.querySelector('.sb-msg').textContent = '';
}

function bombPanelInput(m) {
  const inp = m.game.input;
  ['Digit1', 'Digit2', 'Digit3', 'Digit4'].forEach((k, i) => { if (inp.justPressed(k)) cutWire(m, i); });
  if (!m.game.player.alive) { m.blocksInput = false; m.hud.bomb.classList.add('hidden'); }
}

function cutWire(m, i) {
  if (!m.blocksInput || m.defused || m.ended) return;
  const w = m.wires[i];
  if (w.cut) return;
  const msg = m.hud.bomb.querySelector('.sb-msg');
  if (i === m.order[m.step]) {
    w.cut = true;
    w.btn.classList.add('cut');
    m.step++;
    m.game.audio.beep(2400, 0.03, 0.2);
    msg.textContent = `Fio ${w.name.toLowerCase()} cortado.`;
    msg.className = 'sb-msg ok';
    if (m.step >= m.order.length) {
      m.defused = true;
      m.blocksInput = false;
      m.hud.bomb.classList.add('hidden');
      m.bombObj.led.visible = false;
      m.bombObj.led.material.emissive.setHex(0x22ff66);
      m.bombObj.led.visible = true;
      m.setObj('defuse', undefined, true);
      m.setTimer(null);
      m.hud.meter.classList.add('hidden');
      m.win('Artefato desarmado. O distrito está seguro. Ótimo trabalho, Falcão.', 'Artefato desarmado com sucesso.');
    }
  } else {
    m.wrong++;
    m.bombLeft -= 25;
    m.game.audio.beep(320, 0.25, 0.25);
    msg.textContent = `Fio fora de ordem! O artefato reagiu: −25 s. Siga o visor: ${m.order.map((k) => m.wires[k].sym).join(' → ')}.`;
    msg.className = 'sb-msg bad';
    w.btn.classList.add('shake');
    setTimeout(() => w.btn && w.btn.classList.remove('shake'), 400);
  }
}

function explode(m) {
  const g = m.game;
  m.hud.flash.classList.add('on');
  g.audio.noiseBurst && g.audio.ctx && g.audio.noiseBurst(g.audio.sfx, g.audio.ctx.currentTime, 1.2, 'lowpass', 900, 0.9, 0.7, 80);
  g.player.shake = 2;
  m.fail('O tempo acabou: o artefato detonou. Ninguém ficou ferido, mas o distrito sofreu danos.');
}

// ===== Missão 3 · captura de Vugo =====
KINDS.capture = {
  parTime: 280,
  setup(m) {
    const d = m.def;
    const L = m.makeCrim(LEADER, d.leader, 30, { leader: true, name: LEADER });
    L.b.isLeader = true;
    L.b.hold = true;
    L.b.post = true;
    L.b.passive = true; // Vugo não dispara: só tenta fugir
    m.leader = L.b;
    m.crew.push(L);
    m.escape = W(d.escape);
    m.escapeRing = m.addRing(m.escape, 0xff4d4d, 2.2);
    addBoat(m, m.escape);
    m.objs = [
      { id: 'camp', text: `Localize a ${d.camp.label}`, done: false },
      { id: 'catch', text: `Capture ${LEADER} vivo (renda e algeme)`, done: false },
      { id: 'crew', text: 'Neutralize os guarda-costas', n: 0, of: m.crew.length - 1, done: false, optional: true },
    ];
  },
  playerStart(m) { const sp = m.game.map.teamSpawns.A[0]; return { x: sp.x, z: sp.z, yaw: yawTo(sp, W(m.def.leader.at)) }; },
  start(m) {
    m.radio('Central', `${AGENT.callsign}, ${LEADER} está escondido na cabana a nordeste. Ele tem guarda-costas.`, 4.5);
    m.radio('Central', `Lembre-se: queremos ${LEADER} vivo. Se ele chegar ao barco, perdemos o rastro.`, 4.5);
  },
  onAlarm(m) { m.radio('Central', `Os guarda-costas viram você. Fique de olho em ${LEADER}: ele vai tentar fugir!`, 4); },
  update(m, dt) {
    const g = m.game;
    const p = g.player;
    const L = m.leader;
    if (!m.campFound && p.alive && (inBox(p.pos, m.def.camp) || (dist2(p.pos, L.pos) < 18 && g.world.clear(p.pos.x, 1.6, p.pos.z, L.pos.x, 1.4, L.pos.z)))) {
      m.campFound = true;
      m.setObj('camp', undefined, true);
      m.radio('Central', `Contato visual com ${LEADER}!`, 3);
    }
    // fuga: com o alarme e o agente por perto, ou ao vê-lo
    if (!L.fleeing && !L.surrendered && L.alive) {
      const near = dist2(p.pos, L.pos) < 26;
      const sees = dist2(p.pos, L.pos) < 30 && g.world.clear(L.pos.x, 1.6, L.pos.z, p.pos.x, 1.4, p.pos.z);
      if ((m.alarm && near) || (sees && p.alive)) {
        L.fleeing = true;
        L.ctrl = (dt2, game) => {
          m.walk(L, dt2, game, L.health < 70 ? 3.3 : 4.1, m.escape);
          return true;
        };
        m.radio(LEADER, pick(['Segurem ele! Eu vou para o barco!', 'Vocês nunca vão me pegar!']), 3);
        m.radio('Central', `${LEADER} está fugindo para o barco a oeste! Atrás dele!`, 3.5);
        g.announce('FUGA!', `${LEADER} corre para o barco`, 2, '#ffb057', 'beep');
      }
    }
    if (L.fleeing && !L.surrendered) {
      const d = dist2(L.pos, m.escape);
      m.setTimer(`${LEADER} A ${Math.round(d)} m DO BARCO`, d < 20);
      if (d < 2.6) { m.fail(`${LEADER} alcançou o barco e escapou.`); return; }
    } else m.setTimer(null);
    const guards = m.crew.filter(({ b }) => !b.isLeader);
    const neutral = guards.filter(({ b }) => !b.alive || b.surrendered).length;
    m.setObj('crew', neutral, neutral === guards.length);
    if (L.cuffed) { m.setObj('catch', undefined, true); m.win(`${LEADER} está preso. A Crakem perdeu o seu líder. Missão cumprida, Falcão!`, `${LEADER} capturado vivo.`); return; }
    if (m.escapeRing) m.escapeRing.material.opacity = 0.45 + Math.sin(g.time * 5) * 0.3;
  },
  waypoint(m) {
    const L = m.leader;
    if (L.surrendered && !L.cuffed) return { pos: L.pos, label: `Algemar ${LEADER}` };
    if (L.fleeing || m.campFound) return { pos: L.pos, label: LEADER, red: true };
    return { pos: W(m.def.leader.at), label: 'Cabana' };
  },
  score(m, add) {
    const L = m.leader;
    if (L.cuffed) {
      add(`${LEADER} capturado vivo`, 1, 1500);
      if (!L.shotByAgent) add(`${LEADER} rendido sem disparos`, 1, 500);
    }
  },
};

// ===== Missão 4 · atirador de elite =====
KINDS.sniper = {
  parTime: 330,
  stealthBonus: false,
  setup(m) {
    const d = m.def;
    m.player0 = { x: cellToWorld(0) + d.perch[0] * 2, z: cellToWorld(0) + d.perch[1] * 2 };
    m.allies = d.allyStart.map((c, i) => {
      const b = new Bot({ id: 60 + i, name: ALLIES[i], team: 'A', color: 0x1c2532, style: { kind: 'swat' } }, 'recruta');
      b.setLoadout('kestrel', 'vp9', false, 'katana');
      b.swordsman = false;
      b.isAlly = true;
      b.hold = true; // avançam só pela rota, sem perseguir barulhos: a cobertura vem do atirador
      b.route = d.allyRoute.map(W);
      b.routeIdx = 0;
      m.game.scene.add(b.model.root);
      const at = W(c);
      at.yaw = yawTo(at, b.route[0]);
      return { b, at };
    });
    m.civilians = d.civilians.map((c, i) => {
      const civ = m.makeCivil(i, `Civil ${i + 1}`, W(c));
      const b = civ.b;
      b.home = W(c);
      b.pose = 'civil';
      b.ctrl = (dt, game) => {
        // passeiam pela praça; com tiros por perto, abaixam-se
        if (m.alarm) { b.pose = 'kneel'; m.walk(b, dt, game, 0, null); return true; }
        if (!b.wgoal || dist2(b.pos, b.wgoal) < 0.8 || (b.wT = (b.wT || 0) - dt) < 0) { b.wgoal = { x: b.home.x + rand(-4, 4), z: b.home.z + rand(-4, 4) }; b.wT = rand(5, 9); b.path = null; }
        m.walk(b, dt, game, 1.2, b.wgoal);
        return true;
      };
      return civ;
    });
    const sharp = m.crew.find(({ c }) => c.marksman);
    if (sharp) m.marksman = sharp.b;
    m.waypointIdx = 0;
    m.objs = [
      { id: 'cover', text: 'Proteja a equipe até o templo', done: false },
      { id: 'marks', text: 'Elimine o atirador de elite "Agulha"', done: false },
      { id: 'crew', text: 'Neutralize os atiradores emboscados', n: 0, of: m.crew.length, done: false },
      { id: 'civ', text: 'Nenhum civil ferido', done: true },
    ];
  },
  playerStart(m) { return { x: m.player0.x, z: m.player0.z, y: 2.7, yaw: Math.PI * 0.85 }; },
  start(m) {
    const g = m.game;
    g.player.setLoadout('longinus', 'vp9', false, 'katana');
    g.player.resetView();
    g.viewmodel.setWeapon(g.player.weapon.def, false);
    g.player.pos.y = 2.7;
    m.radio('Central', `${AGENT.callsign}, você está no ponto de observação. A equipe vai avançar até o templo ao norte.`, 4.5);
    m.radio('Agente Lima', 'Equipe pronta. Contamos com você lá em cima, Falcão.', 3.5);
    m.radio('Central', 'Atenção: o atirador "Agulha" usa colete vermelho e fica perto do templo. Civis na praça.', 4.5);
    m.after(6, () => { m.advance = true; });
  },
  onAlarm(m) { m.radio('Agente Prado', 'Contato! Emboscada à frente!', 2.6); },
  onKill(m, victim) {
    if (victim === m.marksman) m.radio('Central', 'Agulha neutralizado! Belo tiro.', 3);
    if (victim.isAlly) m.radio('Central', `${victim.name} foi atingido! Proteja os outros.`, 3);
  },
  update(m, dt) {
    const g = m.game;
    // a equipe avança de ponto em ponto quando não há atirador ativo perto do próximo ponto
    const alive = m.allies.filter(({ b }) => b.alive);
    if (!alive.length) { m.fail('Toda a equipe foi abatida.'); return; }
    if (m.advance) {
      const route = m.def.allyRoute.map(W);
      const next = route[m.waypointIdx];
      const threat = m.crew.some(({ b }) => b.alive && !b.surrendered && dist2(b.pos, next) < 15);
      const arrived = alive.every(({ b }) => dist2(b.pos, next) < 4 || b.state === 'engage');
      if (!threat && arrived && m.waypointIdx < route.length - 1) {
        m.waypointIdx++;
        if (m.waypointIdx === route.length - 1) m.radio('Agente Lima', 'Templo à vista. Último trecho!', 3);
      }
      for (const { b } of alive) {
        b.routeIdx = threat && m.waypointIdx > 0 ? m.waypointIdx - 1 : m.waypointIdx;
        if (b.state === 'roam' && !b.path) { const goal = route[b.routeIdx]; b.setPath(g, goal.x + rand(-1.5, 1.5), goal.z + rand(-1.5, 1.5)); }
      }
      const route2 = route[route.length - 1];
      const done = m.waypointIdx === route.length - 1 && alive.some(({ b }) => dist2(b.pos, route2) < 5);
      const { neutral } = m.crewStatus();
      m.setObj('crew', neutral, neutral === m.crew.length);
      m.setObj('marks', undefined, !m.marksman || !m.marksman.alive || m.marksman.surrendered);
      m.setObj('cover', undefined, done);
      if (done && neutral === m.crew.length) { m.win('A equipe chegou ao templo e as provas estão seguras. Excelente cobertura, Falcão.', 'Equipe protegida e provas recuperadas.'); return; }
    }
    m.setTimer(`EQUIPE · ${alive.length}/3 de pé`, alive.length < 3);
  },
  waypoint(m) {
    if (m.marksman && m.marksman.alive && !m.marksman.surrendered && m.marksman.spotted && m.marksman.spotted.A > m.game.time - 20) return { pos: m.marksman.pos, label: 'Agulha', red: true };
    const lead = m.allies.find(({ b }) => b.alive);
    return lead ? { pos: lead.b.pos, label: lead.b.name } : null;
  },
  score(m, add) {
    add('Agentes da equipe de pé', m.allies.filter(({ b }) => b.alive).length, 500);
    if (m.marksman && (!m.marksman.alive || m.marksman.surrendered)) add('Atirador "Agulha" neutralizado', 1, 600);
  },
};

function spottedCrim(m) {
  const g = m.game;
  const left = m.crew.find(({ b }) => b.alive && !b.surrendered && b.spotted && b.spotted.A > g.time - 30);
  return left ? { pos: left.b.pos, label: 'Suspeito' } : null;
}

// ------------------------------------------------------------------ objetos de cena
function addVan(m, [cx, cy]) {
  const g = m.game;
  const grp = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0x1d2a3d, roughness: 0.5, metalness: 0.3 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe6e9ee, roughness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0c1118, roughness: 0.1, metalness: 0.8 });
  const tire = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const add = (geo, mt, x, y, z) => { const o = new THREE.Mesh(geo, mt); o.position.set(x, y, z); o.castShadow = true; grp.add(o); return o; };
  add(new THREE.BoxGeometry(2.1, 1.7, 4.8), body, 0, 1.25, 0);
  add(new THREE.BoxGeometry(2.12, 0.28, 4.82), white, 0, 1.15, 0);
  add(new THREE.BoxGeometry(2.0, 0.7, 0.05), glass, 0, 1.75, -2.41);
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.05, 0.6, 1.2), glass, sx * 1.06, 1.75, -1.4);
  for (const sx of [-1, 1]) for (const sz of [-1.5, 1.5]) { const t = add(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 14), tire, sx * 0.95, 0.38, sz); t.rotation.z = Math.PI / 2; }
  m.lights = [
    add(new THREE.BoxGeometry(0.5, 0.12, 0.3), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff2020, emissiveIntensity: 2 }), -0.4, 2.16, -1.2),
    add(new THREE.BoxGeometry(0.5, 0.12, 0.3), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x2050ff, emissiveIntensity: 2 }), 0.4, 2.16, -1.2),
  ];
  grp.position.set(cellToWorld(cx), 0, cellToWorld(cy));
  g.scene.add(grp);
  m.objects.push(grp);
}
function blinkVan(m) {
  if (!m.lights) return;
  const on = Math.floor(m.game.time * 3) % 2;
  m.lights[0].visible = !!on;
  m.lights[1].visible = !on;
}

function addBomb(m, p, seq) {
  const g = m.game;
  const grp = new THREE.Group();
  const add = (geo, mt, x, y, z) => { const o = new THREE.Mesh(geo, mt); o.position.set(x, y, z); grp.add(o); return o; };
  add(new THREE.BoxGeometry(0.62, 0.3, 0.42), new THREE.MeshStandardMaterial({ color: 0x3a3f36, roughness: 0.7 }), 0, 0.15, 0);
  // visor com a sequência de símbolos
  const c = document.createElement('canvas');
  c.width = 256; c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#081208'; ctx.fillRect(0, 0, 256, 96);
  ctx.fillStyle = '#5dff7a'; ctx.font = 'bold 54px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(seq, 128, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const scr = add(new THREE.PlaneGeometry(0.36, 0.135), new THREE.MeshBasicMaterial({ map: tex, fog: false }), 0, 0.302, 0.02);
  scr.rotation.x = -Math.PI / 2;
  WIRES.forEach((w, i) => add(new THREE.BoxGeometry(0.018, 0.018, 0.34), new THREE.MeshStandardMaterial({ color: w.css, roughness: 0.5 }), -0.22 + i * 0.03, 0.31, -0.02));
  const led = add(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff2020, emissiveIntensity: 3, fog: false }), 0.24, 0.32, 0.14);
  grp.position.set(p.x, 0, p.z);
  grp.rotation.y = rand(0, Math.PI * 2);
  g.scene.add(grp);
  m.objects.push(grp);
  return { grp, led };
}

function addBoat(m, p) {
  const g = m.game;
  const grp = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.8 });
  const add = (geo, mt, x, y, z) => { const o = new THREE.Mesh(geo, mt); o.position.set(x, y, z); o.castShadow = true; grp.add(o); return o; };
  add(new THREE.BoxGeometry(1.6, 0.5, 4.2), hull, 0, 0.3, 0);
  add(new THREE.BoxGeometry(1.2, 0.08, 3.8), new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.8 }), 0, 0.56, 0);
  add(new THREE.BoxGeometry(0.4, 0.5, 0.4), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 }), 0, 0.8, 1.9);
  grp.position.set(p.x - 2.2, 0, p.z);
  g.scene.add(grp);
  m.objects.push(grp);
}

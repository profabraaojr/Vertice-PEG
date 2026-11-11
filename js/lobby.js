// Sala de espera do multijogador: membros, times, "pronto", configurações do anfitrião e chat.
//
// O anfitrião mantém o estado oficial da sala e o envia a todos a cada mudança.
// Os convidados pedem troca de time, marcam "pronto" e enviam mensagens; o anfitrião valida.
import { settings, saveSettings } from './settings.js';
import { TEAMS } from './config.js';
import { MAPS, MAP_IDS } from './map.js';
import { activeProfile, activeLook } from './profiles.js';
import { normalizeCode } from './net.js';

const $ = (id) => document.getElementById(id);
const TEAM_MAX = 4;
const LOBBY_MSGS = new Set(['team', 'ready', 'chat']);

export class Lobby {
  constructor(app) {
    this.app = app;
    this.net = app.net;
    this.state = null; // estado da sala (no anfitrião é o oficial; no convidado, a última cópia recebida)
    this.myId = 0;
    this.view = 'entry';
    if (!settings.room) settings.room = { mode: 'pvp', format: 'team', map: 'ferrugem', rounds: 5, difficulty: 'soldado', enemyBots: 4, fill: true };
    this.bind();
    this.checkInviteLink();
  }

  get isHost() { return this.net.role === 'host'; }
  isLobbyMsg(t) { return LOBBY_MSGS.has(t); }

  // ---------- interface ----------
  bind() {
    const nameEl = $('mp-name');
    nameEl.value = settings.nickname || activeProfile() || '';
    nameEl.addEventListener('input', () => { settings.nickname = nameEl.value.trim().slice(0, 18); saveSettings(); });
    const code = $('mp-code');
    code.addEventListener('input', () => { code.value = normalizeCode(code.value); });
    code.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('mp-join').click(); });
    $('mp-create').addEventListener('click', (e) => this.busy(e.currentTarget, () => this.create()));
    $('mp-join').addEventListener('click', (e) => this.busy(e.currentTarget, () => this.join(code.value)));
    $('coop-leave').addEventListener('click', () => this.leave());
    $('coop-start').addEventListener('click', () => this.start());
    $('mp-ready').addEventListener('click', () => this.toggleReady());
    document.querySelectorAll('.mp-jointeam').forEach((b) => b.addEventListener('click', () => this.chooseTeam(b.dataset.team)));
    $('mp-copy-code').addEventListener('click', () => this.copy(this.state ? this.state.code : ''));
    $('mp-copy-link').addEventListener('click', () => this.copy(this.inviteLink()));
    if (navigator.share) {
      $('mp-share').classList.remove('hidden');
      $('mp-share').addEventListener('click', () => {
        navigator.share({ title: 'VÉRTICE PEG', text: `Entre na minha sala do VÉRTICE: código ${this.state.code}`, url: this.inviteLink() }).catch(() => {});
      });
    }
    $('mp-chat-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = $('mp-chat-input');
      this.sendChat(inp.value);
      inp.value = '';
    });
    // configurações (só o anfitrião altera)
    MAP_IDS.forEach((id) => {
      const o = document.createElement('option');
      o.value = id; o.textContent = `${MAPS[id].name} (${MAPS[id].tag})`;
      $('mp-map').appendChild(o);
    });
    const set = (key, val) => { if (!this.isHost) return; settings.room[key] = val; saveSettings(); this.applyRules(); this.broadcast(); this.render(); };
    $('mp-mode').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => set('mode', b.dataset.v)));
    $('mp-format').addEventListener('change', (e) => set('format', e.target.value));
    $('mp-map').addEventListener('change', (e) => set('map', e.target.value));
    $('mp-diff').addEventListener('change', (e) => set('difficulty', e.target.value));
    $('mp-rounds').addEventListener('input', (e) => set('rounds', Number(e.target.value)));
    $('mp-enemy').addEventListener('input', (e) => set('enemyBots', Number(e.target.value)));
    $('mp-fill').addEventListener('change', (e) => set('fill', e.target.checked));
    this.bindManual();
  }

  // conexão manual antiga, mantida como alternativa quando o servidor de salas estiver indisponível
  bindManual() {
    const net = this.net;
    $('coop-host').addEventListener('click', (e) => this.busy(e.currentTarget, async () => {
      if (net.role !== 'host') { net.close(); this.hostInit('MANUAL'); }
      $('coop-invite').value = await net.createInvite(this.name());
      this.status('Convite gerado. Envie ao convidado e cole a resposta dele abaixo.');
    }));
    $('coop-copy-invite').addEventListener('click', () => this.copy($('coop-invite').value));
    $('coop-connect').addEventListener('click', (e) => this.busy(e.currentTarget, async () => {
      await net.acceptAnswer($('coop-answer').value);
      $('coop-answer').value = '';
      this.status('Conectando… quando o convidado entrar, a sala abre.');
    }));
    $('coop-make-answer').addEventListener('click', (e) => this.busy(e.currentTarget, async () => {
      $('coop-answer-out').value = await net.joinWithInvite($('coop-invite-in').value, this.name(), settings.loadout, activeLook());
      this.status('Envie a resposta ao anfitrião e aguarde.');
    }));
    $('coop-copy-answer').addEventListener('click', () => this.copy($('coop-answer-out').value));
  }

  name() { return ($('mp-name').value.trim() || activeProfile() || 'Jogador').slice(0, 18); }

  async busy(btn, fn) {
    btn.disabled = true;
    try { await fn(); } catch (e) { this.status(e.message || String(e), true); } finally { btn.disabled = false; }
  }

  async copy(text) {
    if (!text) return;
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      ta.remove();
    }
    this.app.toast(ok ? 'Copiado. Envie aos colegas por mensagem.' : text);
  }

  inviteLink() {
    const base = location.href.split('#')[0].split('?')[0];
    return this.state ? `${base}#sala-${this.state.code}` : base;
  }

  status(text, err = false) {
    const el = $('coop-status');
    el.textContent = text;
    el.classList.toggle('err', err);
  }

  // Link de convite (#sala-CODIGO): abre direto a tela de entrar com o código preenchido.
  checkInviteLink() {
    const m = /^#sala-([A-Za-z0-9]{6})$/.exec(location.hash || '');
    if (!m) return;
    this.pendingCode = m[1].toUpperCase();
    setTimeout(() => {
      this.open();
      $('mp-code').value = this.pendingCode;
      this.status(`Convite para a sala ${this.pendingCode}. Confira seu nome e toque em Entrar.`);
    }, 300);
  }

  open() {
    this.app.menu.show('screen-coop');
    this.showView(this.state ? 'lobby' : 'entry');
    this.render();
  }

  showView(v) {
    this.view = v;
    $('mp-entry').classList.toggle('hidden', v !== 'entry');
    $('mp-lobby').classList.toggle('hidden', v !== 'lobby');
    $('coop-leave').textContent = v === 'lobby' ? 'Sair da sala' : 'Voltar';
    if (v === 'entry') { $('coop-start').classList.add('hidden'); $('mp-ready').classList.add('hidden'); }
  }

  // ---------- anfitrião ----------
  hostInit(code) {
    const r = settings.room;
    this.myId = 0;
    this.state = {
      code, inGame: false,
      settings: { ...r },
      members: [{ id: 0, name: this.name(), team: 'A', ready: true, host: true }],
    };
    this.chatLog = [];
    this.showView('lobby');
    this.render();
  }

  async create() {
    this.app.audio.init();
    this.status('Criando a sala…');
    const code = await this.net.createRoom(this.name());
    this.hostInit(code);
    this.status('Sala criada. Envie o código ou o link aos colegas.');
    this.addChat(null, null, `Sala ${code} criada. Compartilhe o código para os colegas entrarem.`);
  }

  // mantém a lista de membros igual à de conexões abertas
  syncPeers() {
    if (!this.isHost || !this.state) return;
    const st = this.state;
    const peers = this.net.connectedPeers;
    const before = new Set(st.members.map((m) => m.id));
    for (const p of peers) {
      if (before.has(p.id)) continue;
      st.members.push({ id: p.id, name: p.name, team: this.autoTeam(), ready: false, host: false });
      this.addChat(null, null, `${p.name} entrou na sala.`, true);
      if (this.view !== 'lobby') this.app.toast(`${p.name} entrou na sala.`);
    }
    const alive = new Set([0, ...peers.map((p) => p.id)]);
    st.members = st.members.filter((m) => alive.has(m.id));
    if (this.view === 'entry' && peers.length) this.showView('lobby'); // conexão manual: a sala abre quando alguém entra
    this.applyRules();
    this.broadcast();
    this.render();
  }

  peerLeft(name) {
    if (!this.state) return;
    this.addChat(null, null, `${name} saiu da sala.`, true);
    this.syncPeers();
  }

  autoTeam() {
    const st = this.state;
    if (st.settings.mode === 'coop') return 'A';
    const a = st.members.filter((m) => m.team === 'A').length;
    const b = st.members.filter((m) => m.team === 'B').length;
    return b < a ? 'B' : 'A';
  }

  // Ajusta os times às regras do modo atual.
  applyRules() {
    const st = this.state;
    if (!st) return;
    st.settings = { ...settings.room };
    if (st.settings.mode === 'coop') {
      for (const m of st.members) m.team = 'A';
    } else {
      // no PvP, nenhum time passa de 4
      for (const t of ['A', 'B']) {
        const list = st.members.filter((m) => m.team === t);
        const other = t === 'A' ? 'B' : 'A';
        while (list.length > TEAM_MAX && st.members.filter((m) => m.team === other).length < TEAM_MAX) list.pop().team = other;
      }
    }
  }

  broadcast() {
    if (!this.isHost || !this.state) return;
    const st = this.state;
    for (const p of this.net.connectedPeers) this.net.send(p, { t: 'lobby', you: p.id, ...st });
  }

  hostHandle(peerId, msg) {
    const st = this.state;
    if (!st) return;
    const m = st.members.find((x) => x.id === peerId);
    if (!m) return;
    if (msg.t === 'team') {
      if (st.settings.mode !== 'pvp' || st.inGame) return;
      const t = msg.team === 'B' ? 'B' : 'A';
      if (st.members.filter((x) => x.team === t && x !== m).length >= TEAM_MAX) return;
      m.team = t;
      m.ready = false;
    } else if (msg.t === 'ready') {
      m.ready = !!msg.ready;
    } else if (msg.t === 'chat') {
      const text = String(msg.text || '').slice(0, 120).trim();
      if (!text) return;
      this.relayChat(m, text, peerId);
      return;
    }
    this.broadcast();
    this.render();
  }

  // valida a sala e inicia a partida para todos
  validate() {
    const st = this.state;
    const mode = st.settings.mode;
    const A = st.members.filter((m) => m.team === 'A').length;
    const B = st.members.filter((m) => m.team === 'B').length;
    const notReady = st.members.filter((m) => !m.ready).map((m) => m.name);
    if (mode === 'coop' && st.members.length > TEAM_MAX) return `No cooperativo a equipe tem até ${TEAM_MAX} jogadores (há ${st.members.length} na sala). Mude para PvP ou peça para alguém sair.`;
    if (mode === 'pvp' && (A > TEAM_MAX || B > TEAM_MAX)) return `Cada time comporta até ${TEAM_MAX} jogadores.`;
    if (mode === 'pvp' && !st.settings.fill && (A === 0 || B === 0)) return 'No PvP, os dois times precisam de jogadores. Distribua a sala ou ative "Completar times com bots".';
    if (notReady.length) return `Aguardando ficar pronto: ${notReady.join(', ')}.`;
    return null;
  }

  start() {
    if (!this.isHost || !this.state) return;
    const err = this.validate();
    if (err) { this.status(err, true); return; }
    const st = this.state;
    const s = st.settings;
    const humans = { A: 0, B: 0 };
    const teams = {};
    let hostTeam = 'A';
    for (const m of st.members) {
      humans[m.team]++;
      if (m.host) hostTeam = m.team; else teams[m.id] = m.team;
    }
    const training = s.format === 'training';
    let botsA = 0, botsB = 0;
    if (s.mode === 'pvp') {
      if (s.fill) { botsA = TEAM_MAX - humans.A; botsB = TEAM_MAX - humans.B; }
    } else {
      botsA = s.fill && !training ? TEAM_MAX - humans.A : 0;
      botsB = s.enemyBots;
    }
    if (training) botsA = 0;
    st.inGame = true;
    this.broadcast();
    this.app.startMatch({
      map: s.map, mode: training ? 'training' : 'team', difficulty: s.difficulty, rounds: s.rounds,
      timeLimit: 8, scoreLimit: 25, botsShoot: true, bots: botsA + botsB,
      net: { hostTeam, teams, botsA, botsB, pvp: s.mode === 'pvp' },
    });
  }

  // fim da partida: todos voltam para a sala, e os convidados precisam marcar "pronto" de novo
  matchOver() {
    if (!this.state) return;
    this.state.inGame = false;
    if (this.isHost) {
      for (const m of this.state.members) if (!m.host) m.ready = false;
      this.broadcast();
    }
    this.render();
  }

  // ---------- convidado ----------
  async join(code) {
    this.app.audio.init();
    code = normalizeCode(code);
    if (code.length !== 6) throw new Error('Digite o código de 6 caracteres da sala.');
    this.status('Entrando na sala…');
    this.chatLog = [];
    await this.net.joinRoom(code, this.name(), settings.loadout, activeLook());
    this.status('Conectado. Aguardando a sala…');
    if (location.hash) history.replaceState(null, '', location.href.split('#')[0]);
  }

  onLobby(msg) {
    const first = !this.state;
    this.myId = msg.you;
    this.net.myId = msg.you; // usado pelo convidado para achar o próprio personagem na partida
    this.state = { code: msg.code, inGame: msg.inGame, settings: msg.settings, members: msg.members };
    if (first) {
      this.addChat(null, null, `Você entrou na sala ${msg.code}.`);
      if (this.app.state === 'menu' || this.app.menu.current === 'screen-coop') { this.app.menu.show('screen-coop'); this.showView('lobby'); }
    }
    this.render();
  }

  onFull() {
    this.status('Esta sala está cheia (8 jogadores).', true);
    this.net.close();
  }

  me() { return this.state ? this.state.members.find((m) => m.id === this.myId) : null; }

  chooseTeam(team) {
    if (!this.state) return;
    if (this.isHost) {
      const st = this.state;
      if (st.settings.mode !== 'pvp') return;
      const me = this.me();
      if (st.members.filter((x) => x.team === team && x !== me).length >= TEAM_MAX) { this.status('Esse time já tem 4 jogadores.', true); return; }
      me.team = team;
      this.broadcast();
      this.render();
    } else {
      this.net.toHost({ t: 'team', team });
    }
  }

  toggleReady() {
    const me = this.me();
    if (!me || this.isHost) return;
    this.net.toHost({ t: 'ready', ready: !me.ready });
  }

  // ---------- chat ----------
  sendChat(text) {
    text = String(text || '').slice(0, 120).trim();
    if (!text || !this.net.active) return;
    if (this.isHost) {
      this.relayChat(this.me() || { name: this.name(), team: 'A' }, text, null);
    } else {
      const me = this.me();
      this.addChat(me ? me.name : this.name(), me ? me.team : 'A', text);
      this.net.toHost({ t: 'chat', text });
    }
  }

  relayChat(member, text, fromPeer) {
    this.addChat(member.name, member.team, text);
    this.net.broadcast({ t: 'chat', name: member.name, team: member.team, text }, false, fromPeer);
  }

  onChat(msg) {
    this.addChat(msg.name, msg.team, msg.text);
  }

  // mensagem na sala e, durante a partida, na tela do jogo
  addChat(name, team, text, system = false) {
    if (!this.chatLog) this.chatLog = [];
    const entry = { name, team, text, system: system || !name };
    this.chatLog.push(entry);
    if (this.chatLog.length > 60) this.chatLog.shift();
    const log = $('mp-chat-log');
    log.appendChild(this.chatLine(entry));
    while (log.children.length > 60) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
    if (this.app.state === 'playing' || this.app.state === 'paused') this.app.chat.show(entry);
    if (name && this.app.audio.ctx && this.view === 'lobby') this.app.audio.uiHover();
  }

  chatLine(e) {
    const d = document.createElement('div');
    d.className = e.system ? 'sys' : '';
    if (e.name) {
      const b = document.createElement('b');
      b.textContent = `${e.name}: `;
      b.style.color = TEAMS[e.team] ? TEAMS[e.team].css : '#ddd';
      d.appendChild(b);
    }
    d.appendChild(document.createTextNode(e.text));
    return d;
  }

  // ---------- saída ----------
  leave() {
    if (this.net.active) this.net.close();
    this.reset();
    this.app.menu.reset('screen-main');
  }

  reset() {
    this.state = null;
    this.chatLog = [];
    $('mp-chat-log').innerHTML = '';
    this.showView('entry');
    this.status('');
  }

  // ---------- desenho da sala ----------
  render() {
    const st = this.state;
    if (!st || this.view !== 'lobby') return;
    const host = this.isHost;
    const s = st.settings;
    const coop = s.mode === 'coop';
    $('mp-room-code').textContent = st.code;
    $('mp-copy-code').classList.toggle('hidden', st.code === 'MANUAL');
    $('mp-copy-link').classList.toggle('hidden', st.code === 'MANUAL');
    $('mp-share').classList.toggle('hidden', !navigator.share || st.code === 'MANUAL');
    const n = st.members.length;
    $('mp-room-sub').textContent = `${n} de 8 jogadores · ${coop ? 'Cooperativo contra bots' : 'PvP entre times'} · ${MAPS[s.map] ? MAPS[s.map].name : ''}${st.inGame ? ' · partida em andamento' : ''}`;
    const me = this.me();
    for (const t of ['A', 'B']) {
      const ul = $(`mp-list-${t}`);
      ul.innerHTML = '';
      const list = st.members.filter((m) => m.team === t);
      for (const m of list) {
        const li = document.createElement('li');
        if (m.id === this.myId) li.className = 'me';
        const nm = document.createElement('span');
        nm.textContent = m.name + (m.id === this.myId ? ' (você)' : '');
        li.appendChild(nm);
        const tag = document.createElement('em');
        tag.textContent = m.host ? 'anfitrião' : m.ready ? 'pronto' : 'aguardando';
        tag.className = m.host ? 'host' : m.ready ? 'ok' : 'wait';
        li.appendChild(tag);
        ul.appendChild(li);
      }
      // vagas: bots ou lugares livres
      let bots = 0;
      if (coop) bots = t === 'A' ? (s.fill && s.format !== 'training' ? Math.max(0, TEAM_MAX - list.length) : 0) : s.enemyBots;
      else if (s.fill) bots = Math.max(0, TEAM_MAX - list.length);
      for (let i = 0; i < bots; i++) { const li = document.createElement('li'); li.className = 'bot'; li.textContent = 'Bot'; ul.appendChild(li); }
      const free = coop ? (t === 'A' ? Math.max(0, TEAM_MAX - list.length - bots) : 0) : Math.max(0, TEAM_MAX - list.length - bots);
      for (let i = 0; i < free; i++) { const li = document.createElement('li'); li.className = 'free'; li.textContent = 'Vaga livre'; ul.appendChild(li); }
      $(`mp-count-${t}`).textContent = coop && t === 'B' ? `${s.enemyBots} bots` : `${list.length}/${TEAM_MAX}`;
      const btn = document.querySelector(`.mp-jointeam[data-team="${t}"]`);
      btn.classList.toggle('hidden', coop || !me || me.team === t || st.inGame);
      btn.disabled = list.length >= TEAM_MAX;
    }
    document.querySelector('.mp-team[data-team="B"] h4 span').textContent = coop ? 'Sentinela (bots)' : 'Sentinela';
    // configurações
    $('mp-mode').querySelectorAll('button').forEach((b) => { b.classList.toggle('active', b.dataset.v === s.mode); b.disabled = !host; });
    for (const [id, v] of [['mp-format', s.format], ['mp-map', s.map], ['mp-diff', s.difficulty]]) { $(id).value = v; $(id).disabled = !host; }
    $('mp-rounds').value = s.rounds; $('mp-out-rounds').textContent = s.rounds; $('mp-rounds').disabled = !host;
    $('mp-enemy').value = s.enemyBots; $('mp-out-enemy').textContent = s.enemyBots; $('mp-enemy').disabled = !host;
    $('mp-fill').checked = !!s.fill; $('mp-fill').disabled = !host;
    $('mp-fill-label').textContent = coop ? 'Completar a equipe com bots aliados' : 'Completar times com bots';
    $('mp-rounds-wrap').classList.toggle('hidden', s.format === 'training');
    $('mp-enemy-wrap').classList.toggle('hidden', !coop);
    $('mp-format').querySelector('option[value="training"]').disabled = !coop;
    if (!coop && s.format === 'training' && host) { settings.room.format = 'team'; saveSettings(); s.format = 'team'; }
    $('mp-settings-note').textContent = host ? '' : '· definida pelo anfitrião';
    // rodapé
    const startBtn = $('coop-start');
    const readyBtn = $('mp-ready');
    startBtn.classList.toggle('hidden', !host);
    readyBtn.classList.toggle('hidden', host);
    if (host) {
      const err = this.validate();
      startBtn.disabled = !!err || st.inGame;
      if (!st.inGame) this.status(err || 'Todos prontos. Inicie quando quiser.', false);
    } else if (me) {
      readyBtn.textContent = me.ready ? 'Cancelar pronto' : 'Estou pronto';
      readyBtn.classList.toggle('primary', !me.ready);
      readyBtn.disabled = st.inGame;
      this.status(st.inGame ? 'Partida em andamento. Você entra na próxima.' : me.ready ? 'Pronto. Aguardando o anfitrião iniciar.' : 'Escolha seu time e marque "Estou pronto".');
    }
  }
}

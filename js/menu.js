// Navegação entre telas, opções de partida, seleção de armas e configurações.
import { settings, saveSettings, resetSettings } from './settings.js';
import { WEAPONS, PRIMARY_IDS, SECONDARY_IDS, MELEE_IDS, MODE_INFO, weaponStats, TEAMS } from './config.js';
import { EMBEDDED, BLOCKED_MSG } from './net.js';
import { MAPS, MAP_IDS } from './map.js';
import { pwa, isStandalone, platform, promptInstall } from './pwa.js';
import { STUDENTS, SCHOOL, CLASSES, SKINS, EYES, HAIRS, HAIR_COLORS, CAMOS, getLook, setLook, defaultLook, activeProfile, activeLook, setActiveProfile, camoCanvas, lookColors } from './profiles.js';

const $ = (id) => document.getElementById(id);
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;

export class Menu {
  constructor(app) {
    this.app = app;
    this.stack = [];
    this.current = 'screen-main';
    this.loSel = { ...settings.loadout };
    this.loContext = 'main';
    this.loFocus = this.loSel.primary;

    document.querySelectorAll('#menus [data-action]').forEach((b) => {
      b.addEventListener('click', () => { app.audio.init(); app.audio.uiClick(); this.action(b.dataset.action); });
    });
    document.getElementById('menus').addEventListener('mouseover', (e) => {
      const t = e.target.closest('.btn, .mode-card, .wcard');
      if (t && t !== this.lastHover) { this.lastHover = t; app.audio.uiHover(); }
    });
    this.initPlay();
    this.initProfiles();
    this.initInstall();
    this.initCoop();
    this.initSettings();
    this.buildLoadout();
  }

  show(id, push = true) {
    if (push && this.current && this.current !== id) this.stack.push(this.current);
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    this.current = id;
  }

  hideAll() {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    this.current = null;
    this.stack = [];
  }

  reset(id) {
    this.stack = [];
    this.current = null;
    this.show(id, false);
  }

  back() {
    const prev = this.stack.pop();
    if (prev) this.show(prev, false);
    else if (this.app.state === 'paused') this.show('screen-pause', false);
    else this.show('screen-main', false);
  }

  action(a) {
    const app = this.app;
    switch (a) {
      case 'play': this.show('screen-play'); break;
      case 'profile': this.openProfiles(); break;
      case 'install': this.openInstall(); break;
      case 'coop': this.openCoop(); break;
      case 'quick-training': app.startMatch({ map: settings.match.map, mode: 'training', bots: 6, difficulty: settings.match.difficulty, botsShoot: true, timeLimit: 0, scoreLimit: 0, rounds: 0 }); break;
      case 'loadout': this.openLoadout('main'); break;
      case 'loadout-from-play': this.openLoadout('play'); break;
      case 'loadout-ingame': this.openLoadout('ingame'); break;
      case 'loadout-confirm': this.confirmLoadout(); break;
      case 'settings': this.syncSettings(); this.show('screen-settings'); break;
      case 'controls': this.show('screen-controls'); break;
      case 'back': this.back(); break;
      case 'start': app.startMatch(this.matchConfig()); break;
      case 'resume': app.resume(); break;
      case 'restart': app.restart(); break;
      case 'quit': app.quitToMenu(); break;
      case 'reset-settings':
        resetSettings();
        this.syncSettings();
        app.applySettings();
        app.toast('Configurações restauradas.');
        break;
      default: break;
    }
  }

  // ---------- seleção de partida ----------
  matchConfig() {
    const m = settings.match;
    return { map: m.map, mode: m.mode, bots: m.bots, difficulty: m.difficulty, timeLimit: m.timeLimit, scoreLimit: m.scoreLimit, rounds: m.rounds, botsShoot: m.botsShoot };
  }

  initPlay() {
    const cards = $('map-cards');
    MAP_IDS.forEach((id) => {
      const m = MAPS[id];
      const el = document.createElement('button');
      el.className = 'map-card';
      el.dataset.map = id;
      el.innerHTML = '<small></small><b></b>';
      el.querySelector('small').textContent = m.tag;
      el.querySelector('b').textContent = m.name;
      el.addEventListener('click', () => {
        this.app.audio.uiClick();
        settings.match.map = id;
        saveSettings();
        this.syncPlay();
        if (this.app.state === 'menu') this.app.loadMap(id); // mostra o mapa escolhido ao fundo
      });
      cards.appendChild(el);
      const opt = document.createElement('option');
      opt.value = id; opt.textContent = `${m.name} (${m.tag})`;
      $('coop-map').appendChild(opt);
    });
    document.querySelectorAll('.mode-card').forEach((card) => {
      card.querySelector('p').textContent = MODE_INFO[card.dataset.mode].desc;
      card.addEventListener('click', () => { settings.match.mode = card.dataset.mode; saveSettings(); this.syncPlay(); });
    });
    const bindRange = (id, out, key, fmt = (v) => v) => {
      const el = $(id);
      el.addEventListener('input', () => {
        settings.match[key] = Number(el.value);
        $(out).textContent = fmt(settings.match[key]);
        saveSettings();
      });
    };
    bindRange('opt-bots', 'out-bots', 'bots');
    bindRange('opt-rounds', 'out-rounds', 'rounds');
    bindRange('opt-score', 'out-score', 'scoreLimit');
    bindRange('opt-time', 'out-time', 'timeLimit');
    $('opt-diff').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      settings.match.difficulty = b.dataset.v; saveSettings(); this.syncPlay();
    }));
    $('opt-botshoot').addEventListener('change', (e) => { settings.match.botsShoot = e.target.checked; saveSettings(); });
    this.syncPlay();
  }

  syncPlay() {
    const m = settings.match;
    document.querySelectorAll('.mode-card').forEach((c) => c.classList.toggle('active', c.dataset.mode === m.mode));
    if (!MAPS[m.map]) m.map = 'ferrugem';
    document.querySelectorAll('.map-card').forEach((c) => c.classList.toggle('active', c.dataset.map === m.map));
    $('map-desc').textContent = `${MAPS[m.map].name}: ${MAPS[m.map].desc}`;
    document.querySelectorAll('.opts [data-for]').forEach((o) => o.classList.toggle('hidden', o.dataset.for !== m.mode));
    const set = (id, out, v) => { $(id).value = v; $(out).textContent = v; };
    set('opt-bots', 'out-bots', m.bots);
    set('opt-rounds', 'out-rounds', m.rounds);
    set('opt-score', 'out-score', m.scoreLimit);
    set('opt-time', 'out-time', m.timeLimit);
    $('opt-diff').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.v === m.difficulty));
    $('opt-botshoot').checked = m.botsShoot;
  }

  // ---------- seleção de armas ----------
  buildLoadout() {
    const mk = (ids, box, slot) => {
      box.innerHTML = '';
      ids.forEach((id) => {
        const def = WEAPONS[id];
        const b = document.createElement('button');
        b.className = 'wcard';
        b.dataset.id = id;
        b.innerHTML = `<small></small><b></b><canvas></canvas>`;
        b.querySelector('small').textContent = def.category;
        b.querySelector('b').textContent = def.name;
        b.addEventListener('click', () => { this.app.audio.uiClick(); this.loSel[slot] = id; this.loFocus = id; this.renderLoadout(); });
        b.addEventListener('mouseenter', () => { this.loFocus = id; this.renderDetail(); });
        box.appendChild(b);
      });
    };
    mk(PRIMARY_IDS, $('lo-primary'), 'primary');
    mk(SECONDARY_IDS, $('lo-secondary'), 'secondary');
    mk(MELEE_IDS, $('lo-melee'), 'melee');
  }

  openLoadout(ctx) {
    this.loContext = ctx;
    const game = this.app.game;
    this.loSel = ctx === 'ingame' && game.player ? { ...(game.pendingLoadout || game.player.loadout) } : { ...settings.loadout };
    if (!this.loSel.melee) this.loSel.melee = 'katana';
    this.loFocus = this.loSel.primary;
    const btn = $('lo-confirm');
    btn.textContent = ctx === 'play' ? 'Iniciar partida' : ctx === 'ingame' ? 'Equipar e voltar' : 'Salvar';
    let note = 'Escolha uma arma principal, uma pistola e uma espada.';
    if (ctx === 'ingame' && !game.canChangeLoadoutNow()) note = 'Fora da fase de preparação: a escolha valerá na próxima rodada.';
    else if (ctx === 'ingame' && game.config.mode === 'ffa') note = 'Nos primeiros segundos após renascer a troca é imediata; depois, vale no próximo renascimento.';
    $('loadout-note').textContent = note;
    if (ctx === 'ingame') this.reset('screen-loadout'); else this.show('screen-loadout');
    this.previewYaw = 0.5;
    this.previewAuto = 0;
    requestAnimationFrame(() => {
      // miniaturas 3D dos cartões (desenhadas uma vez por abertura)
      document.querySelectorAll('.wcard').forEach((c) => this.app.preview.render(WEAPONS[c.dataset.id], c.querySelector('canvas'), 0.32, 0.1));
      this.renderLoadout();
    });
  }

  renderLoadout() {
    document.querySelectorAll('.wcard').forEach((c) => {
      const id = c.dataset.id;
      c.classList.toggle('active', this.loSel.primary === id || this.loSel.secondary === id || this.loSel.melee === id);
    });
    this.renderDetail();
  }

  renderDetail() {
    const def = WEAPONS[this.loFocus] || WEAPONS[this.loSel.primary];
    const box = $('lo-detail');
    const st = weaponStats(def);
    box.innerHTML = `<div class="cat"></div><h3></h3><canvas id="lo-preview" title="Arraste para girar"></canvas><p></p><div class="bars"></div><div class="specs"></div>`;
    this.previewDef = def;
    const cv = box.querySelector('canvas');
    cv.addEventListener('pointerdown', (e) => { this.previewDrag = { x: e.clientX, yaw: this.previewYaw }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => { if (this.previewDrag) this.previewYaw = this.previewDrag.yaw + (e.clientX - this.previewDrag.x) * 0.012; });
    const end = () => { this.previewDrag = null; };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    box.querySelector('.cat').textContent = def.category;
    box.querySelector('h3').textContent = def.name;
    box.querySelector('p').textContent = def.desc;
    const bars = box.querySelector('.bars');
    for (const [k, v] of Object.entries(st)) {
      const row = document.createElement('div');
      row.className = 'stat';
      row.innerHTML = `<span></span><div class="bar"><i></i></div><em></em>`;
      row.querySelector('span').textContent = k;
      row.querySelector('i').style.width = `${Math.round(v * 100)}%`;
      row.querySelector('em').textContent = Math.round(v * 100);
      bars.appendChild(row);
    }
    const specs = def.melee ? [
      ['Corte', def.damage],
      ['Golpe pesado', def.heavyDamage],
      ['Pelas costas', `${def.damage * 2} / ${def.heavyDamage * 2}`],
      ['Alcance', `${def.reach.toFixed(1)} m`],
      ['Golpes/min', def.rpm],
      ['Mobilidade', `${Math.round(def.speed * 100)}%`],
    ] : [
      ['Dano', def.pellets > 1 ? `${def.damage} × ${def.pellets}` : def.damage],
      ['Cadência', `${def.rpm} dpm`],
      ['Pente', `${def.mag} / ${def.reserve}`],
      ['Recarga', `${def.reload.toFixed(1)} s`],
      ['Modo', def.beam ? 'Feixe perfurante' : def.auto ? 'Automático' : def.zoom ? 'Ferrolho' : def.pellets > 1 ? 'Bombeamento' : 'Semiautomático'],
      ['Mobilidade', `${Math.round(def.speed * 100)}%`],
    ];
    const sp = box.querySelector('.specs');
    specs.forEach(([k, v]) => { const d = document.createElement('div'); d.innerHTML = '<span></span>: <b></b>'; d.querySelector('span').textContent = k; d.querySelector('b').textContent = v; sp.appendChild(d); });
  }

  // Chamado a cada quadro enquanto o arsenal está aberto: gira a prévia 3D.
  tickPreview(dt) {
    if (this.current !== 'screen-loadout' || !this.previewDef) return;
    const cv = document.getElementById('lo-preview');
    if (!cv || !cv.clientWidth) return;
    if (!this.previewDrag) { this.previewAuto += dt; this.previewYaw += dt * 0.35; }
    this.app.preview.render(this.previewDef, cv, this.previewYaw, 0.14);
  }

  confirmLoadout() {
    settings.loadout = { ...this.loSel };
    saveSettings();
    if (this.loContext === 'play') {
      this.app.startMatch(this.matchConfig());
    } else if (this.loContext === 'ingame') {
      const msg = this.app.game.setPlayerLoadout(this.loSel.primary, this.loSel.secondary, this.loSel.melee);
      this.app.toast(msg);
      this.app.resume();
    } else {
      this.app.toast('Arsenal salvo.');
      this.back();
    }
  }

  // ---------- configurações ----------
  initSettings() {
    document.querySelectorAll('#set-tabs button').forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll('#set-tabs button').forEach((x) => x.classList.toggle('active', x === b));
      document.querySelectorAll('.tab-body').forEach((t) => t.classList.toggle('active', t.dataset.tab === b.dataset.tab));
    }));
    const pct = (v) => `${Math.round(v * 100)}%`;
    this.ranges = [
      ['set-scale', 'out-scale', 'renderScale', pct],
      ['set-fov', 'out-fov', 'fov', (v) => `${v}°`],
      ['set-master', 'out-master', 'master', pct],
      ['set-sfx', 'out-sfx', 'sfx', pct],
      ['set-music', 'out-music', 'music', pct],
      ['set-sens', 'out-sens', 'sensitivity', (v) => v.toFixed(2)],
      ['set-touch', 'out-touch', 'touchSens', (v) => v.toFixed(2)],
      ['set-scope', 'out-scope', 'scopeSens', (v) => v.toFixed(2)],
    ];
    for (const [id, out, key, fmt] of this.ranges) {
      $(id).addEventListener('input', (e) => {
        settings[key] = Number(e.target.value);
        $(out).textContent = fmt(settings[key]);
        this.app.applySettings();
        saveSettings();
      });
    }
    this.checks = [['set-fps', 'showFps'], ['set-music-game', 'musicInGame'], ['set-invert', 'invertY'], ['set-ch-dot', 'crosshairDot'], ['set-ch-dyn', 'crosshairDynamic'], ['set-radar', 'radar']];
    for (const [id, key] of this.checks) {
      $(id).addEventListener('change', (e) => { settings[key] = e.target.checked; this.app.applySettings(); saveSettings(); });
    }
    $('set-quality').addEventListener('change', (e) => { settings.quality = e.target.value; this.app.applySettings(); saveSettings(); });
    $('set-ch-color').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      settings.crosshairColor = b.dataset.v; this.syncSettings(); this.app.applySettings(); saveSettings();
    }));
    this.syncSettings();
  }

  syncSettings() {
    for (const [id, out, key, fmt] of this.ranges) { $(id).value = settings[key]; $(out).textContent = fmt(settings[key]); }
    for (const [id, key] of this.checks) $(id).checked = !!settings[key];
    $('set-quality').value = settings.quality;
    $('set-ch-color').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.v === settings.crosshairColor));
  }

  // ---------- instalação ----------
  initInstall() {
    const refresh = () => {
      const standalone = isStandalone();
      $('btn-install').classList.toggle('hidden', standalone);
      const btn = $('install-now');
      btn.disabled = !pwa.prompt;
      btn.textContent = pwa.prompt ? 'Instalar agora' : pwa.installed ? 'Instalado' : 'Use o menu do navegador';
    };
    pwa.onChange = refresh;
    $('install-now').addEventListener('click', async () => {
      const r = await promptInstall();
      if (r === 'accepted') this.app.toast('Instalando o VÉRTICE…');
      refresh();
    });
    $('install-url').textContent = location.href.split('?')[0].split('#')[0];
    if (this.app.touch) $('main-foot').textContent = 'Toque em Jogar para entrar em tela cheia · use os controles na tela';
    refresh();
  }

  openInstall() {
    const pf = platform();
    ['android', 'ios', 'desktop'].forEach((k) => $(`install-${k}`).classList.toggle('current', k === pf));
    // mostra primeiro as instruções do aparelho atual
    const box = $(`install-${pf}`);
    box.parentNode.insertBefore(box, box.parentNode.querySelector('.install-box'));
    if (pwa.prompt) $('install-desktop').appendChild($('install-now'));
    if (pf === 'android' || !pwa.prompt) $('install-android').appendChild($('install-now'));
    this.show('screen-install');
  }

  // ---------- perfis ----------
  initProfiles() {
    const homage = `Homenagem aos alunos da ${SCHOOL} · ${CLASSES}`;
    $('homage').textContent = homage;
    $('profile-homage').textContent = `${homage}. Escolha seu nome e personalize a aparência.`;
    this.pfSel = activeProfile() || STUDENTS[0];
    this.pfYaw = 0.5;
    const grid = $('pf-grid');
    STUDENTS.forEach((name) => {
      const b = document.createElement('button');
      b.className = 'pf-card';
      b.dataset.name = name;
      b.innerHTML = '<i></i><span></span>';
      b.querySelector('span').textContent = name;
      b.querySelector('i').textContent = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
      b.addEventListener('click', () => { this.app.audio.uiClick(); this.pfSel = name; this.renderProfiles(); });
      grid.appendChild(b);
    });
    const hex = (h) => `#${h.toString(16).padStart(6, '0')}`;
    const swatches = (box, list, key) => list.forEach((o) => {
      const b = document.createElement('button');
      b.style.setProperty('--c', hex(o.hex));
      b.title = o.name;
      b.setAttribute('aria-label', o.name);
      b.dataset.v = o.id;
      b.addEventListener('click', () => this.pfSet({ [key]: o.id }));
      box.appendChild(b);
    });
    swatches($('pf-skin'), SKINS, 'skin');
    swatches($('pf-eyes'), EYES, 'eyes');
    swatches($('pf-haircolor'), HAIR_COLORS, 'hairColor');
    HAIRS.forEach((o) => {
      const b = document.createElement('button');
      b.textContent = o.name;
      b.dataset.v = o.id;
      b.addEventListener('click', () => this.pfSet({ hair: o.id }));
      $('pf-hair').appendChild(b);
    });
    CAMOS.forEach((o) => {
      const b = document.createElement('button');
      b.dataset.v = o.id;
      b.title = o.name;
      const c = camoCanvas(o.id, 64);
      b.appendChild(c);
      const t = document.createElement('span');
      t.textContent = o.name;
      b.appendChild(t);
      b.addEventListener('click', () => this.pfSet({ camo: o.id }));
      $('pf-camo').appendChild(b);
    });
    $('pf-random').addEventListener('click', () => {
      const r = (list) => list[Math.floor(Math.random() * list.length)].id;
      this.pfSet({ skin: r(SKINS), eyes: r(EYES), hair: r(HAIRS), hairColor: r(HAIR_COLORS), camo: r(CAMOS) });
    });
    $('pf-use').addEventListener('click', () => {
      setActiveProfile(this.pfSel);
      settings.nickname = this.pfSel;
      saveSettings();
      this.app.onProfileChange();
      this.app.toast(`Perfil de ${this.pfSel} ativado.`);
      this.renderProfiles();
    });
    const cv = $('pf-body');
    cv.addEventListener('pointerdown', (e) => { this.pfDrag = { x: e.clientX, yaw: this.pfYaw }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => { if (this.pfDrag) this.pfYaw = this.pfDrag.yaw + (e.clientX - this.pfDrag.x) * 0.012; });
    const end = () => { this.pfDrag = null; };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    this.updateProfileLabel();
  }

  pfSet(patch) {
    this.app.audio.uiClick();
    setLook(this.pfSel, patch);
    if (this.pfSel === activeProfile()) this.app.onProfileChange();
    this.renderProfiles();
  }

  openProfiles() {
    this.pfSel = activeProfile() || this.pfSel || STUDENTS[0];
    this.show('screen-profile');
    requestAnimationFrame(() => this.renderProfiles());
  }

  renderProfiles() {
    const look = getLook(this.pfSel);
    const active = activeProfile();
    const lc = lookColors(look);
    document.querySelectorAll('.pf-card').forEach((c) => {
      const n = c.dataset.name;
      c.classList.toggle('sel', n === this.pfSel);
      c.classList.toggle('active', n === active);
      c.querySelector('i').style.background = `#${lookColors(getLook(n)).skin.toString(16).padStart(6, '0')}`;
    });
    const mark = (id, v) => $(id).querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.v === v));
    mark('pf-skin', look.skin); mark('pf-eyes', look.eyes); mark('pf-hair', look.hair); mark('pf-haircolor', look.hairColor); mark('pf-camo', look.camo);
    $('pf-name').textContent = this.pfSel;
    $('pf-team').textContent = this.pfSel === active ? 'Perfil em uso · uniforme padrão' : 'Uniforme padrão da equipe';
    const use = $('pf-use');
    use.textContent = this.pfSel === active ? 'Perfil em uso' : `Jogar como ${this.pfSel}`;
    use.disabled = this.pfSel === active;
    this.pfDirty = true;
    void lc;
  }

  tickProfile(dt) {
    if (this.current !== 'screen-profile') return;
    const body = $('pf-body'), face = $('pf-face');
    if (!body.clientWidth) return;
    if (!this.pfDrag) this.pfYaw += dt * 0.5;
    const look = getLook(this.pfSel);
    const color = 0xff7a2f;
    this.app.preview.renderCharacter(look, color, body, this.pfYaw, false);
    if (this.pfDirty) { this.app.preview.renderCharacter(look, color, face, 0, true); this.pfDirty = false; }
  }

  updateProfileLabel() {
    const p = activeProfile();
    $('current-profile').textContent = p ? `Perfil: ${p}` : 'Nenhum perfil escolhido · clique em Perfil';
  }

  // ---------- cooperativo ----------
  initCoop() {
    const app = this.app;
    const net = app.net;
    const nameEl = $('coop-name');
    nameEl.value = settings.nickname || activeProfile() || '';
    nameEl.addEventListener('input', () => { settings.nickname = nameEl.value.trim().slice(0, 18); saveSettings(); });
    const name = () => (nameEl.value.trim() || 'Jogador').slice(0, 18);
    const busy = async (btn, fn) => {
      btn.disabled = true;
      try { await fn(); } catch (e) { this.coopStatus(e.message || String(e), true); } finally { btn.disabled = false; }
    };
    const copy = async (el) => {
      if (!el.value) return;
      el.select();
      let ok = false;
      try { await navigator.clipboard.writeText(el.value); ok = true; } catch (e) { try { ok = document.execCommand('copy'); } catch (e2) { ok = false; } }
      app.toast(ok ? 'Código copiado. Envie por mensagem.' : 'Selecione o texto e copie com Ctrl+C.');
    };
    const newInvite = async () => {
      $('coop-invite').value = '';
      this.coopStatus('Gerando convite… (pode levar alguns segundos)');
      $('coop-invite').value = await net.createInvite(name());
      this.coopStatus('Convite pronto. Envie ao amigo e cole a resposta dele no passo 2.');
      this.renderCoopList();
    };
    $('coop-host').addEventListener('click', (e) => busy(e.currentTarget, async () => {
      app.audio.init();
      if (net.role !== 'host') net.close();
      $('coop-host-panel').classList.remove('hidden');
      $('coop-guest-panel').classList.add('hidden');
      $('coop-start').classList.remove('hidden');
      await newInvite();
    }));
    $('coop-new-invite').addEventListener('click', (e) => busy(e.currentTarget, newInvite));
    $('coop-copy-invite').addEventListener('click', () => copy($('coop-invite')));
    $('coop-connect').addEventListener('click', (e) => busy(e.currentTarget, async () => {
      await net.acceptAnswer($('coop-answer').value);
      $('coop-answer').value = '';
      this.coopStatus('Conectando… quando o nome do amigo aparecer na lista, a conexão está pronta.');
      this.renderCoopList();
    }));
    $('coop-join').addEventListener('click', () => {
      app.audio.init();
      net.close();
      $('coop-guest-panel').classList.remove('hidden');
      $('coop-host-panel').classList.add('hidden');
      $('coop-start').classList.add('hidden');
      $('coop-answer-out').value = '';
      this.coopStatus('Cole o convite que o anfitrião enviou.');
    });
    $('coop-make-answer').addEventListener('click', (e) => busy(e.currentTarget, async () => {
      this.coopStatus('Gerando resposta…');
      $('coop-answer-out').value = await net.joinWithInvite($('coop-invite-in').value, name(), settings.loadout, activeLook());
      this.coopStatus('Envie a resposta ao anfitrião e aguarde a conexão.');
    }));
    $('coop-copy-answer').addEventListener('click', () => copy($('coop-answer-out')));
    $('coop-leave').addEventListener('click', () => {
      net.close();
      $('coop-host-panel').classList.add('hidden');
      $('coop-guest-panel').classList.add('hidden');
      $('coop-start').classList.add('hidden');
      this.coopStatus('');
      this.reset('screen-main');
    });
    $('coop-start').addEventListener('click', () => {
      if (!net.connectedPeers.length) { this.coopStatus('Nenhum convidado conectado ainda.', true); return; }
      const c = settings.coop;
      app.startMatch({ map: c.map, mode: c.mode, bots: c.bots, difficulty: c.difficulty, rounds: c.rounds, timeLimit: 8, scoreLimit: 25, botsShoot: true });
    });
    // opções da partida cooperativa
    const sync = () => {
      const c = settings.coop;
      if (!MAPS[c.map]) c.map = 'ferrugem';
      $('coop-map').value = c.map;
      $('coop-mode').value = c.mode; $('coop-diff').value = c.difficulty;
      $('coop-bots').value = c.bots; $('coop-out-bots').textContent = c.bots;
      $('coop-rounds').value = c.rounds; $('coop-out-rounds').textContent = c.rounds;
      $('coop-rounds-wrap').classList.toggle('hidden', c.mode !== 'team');
    };
    $('coop-map').addEventListener('change', (e) => { settings.coop.map = e.target.value; saveSettings(); });
    $('coop-mode').addEventListener('change', (e) => { settings.coop.mode = e.target.value; saveSettings(); sync(); });
    $('coop-diff').addEventListener('change', (e) => { settings.coop.difficulty = e.target.value; saveSettings(); });
    $('coop-bots').addEventListener('input', (e) => { settings.coop.bots = Number(e.target.value); saveSettings(); sync(); });
    $('coop-rounds').addEventListener('input', (e) => { settings.coop.rounds = Number(e.target.value); saveSettings(); sync(); });
    sync();
    net.onPeersChange = () => {
      this.renderCoopList();
      const n = net.connectedPeers.length;
      if (n) this.coopStatus(`${n} ${n === 1 ? 'convidado conectado' : 'convidados conectados'}. Inicie quando quiser ou convide mais alguém.`);
    };
    net.onStatus = (st) => {
      if (st === 'connected') this.coopStatus('Conectado! Aguardando o anfitrião iniciar a partida.');
    };
  }

  openCoop() {
    this.show('screen-coop');
    if (EMBEDDED) { this.coopStatus(BLOCKED_MSG, true); this.renderCoopList(); return; }
    if (this.app.net.role === 'guest' && this.app.net.host) this.coopStatus('Conectado! Aguardando o anfitrião iniciar a partida.');
    this.renderCoopList();
  }

  coopStatus(text, err = false) {
    const el = $('coop-status');
    el.textContent = text;
    el.classList.toggle('err', err);
  }

  renderCoopList() {
    const ul = $('coop-list');
    if (!ul) return;
    const net = this.app.net;
    ul.innerHTML = '';
    const li = (text, pending) => { const l = document.createElement('li'); l.textContent = text; if (pending) l.className = 'pending'; ul.appendChild(l); };
    li(`${($('coop-name').value.trim() || 'Jogador')} (anfitrião)`);
    for (const p of net.peers.values()) {
      if (p.open) li(p.name);
      else li(p.answered ? 'Conectando…' : 'Convite aguardando resposta', true);
    }
  }

  // ---------- pausa e fim ----------
  showPause(note = '') {
    const coop = this.app.game.coop;
    $('pause-note').textContent = note || (coop ? 'Partida cooperativa: o jogo continua enquanto você está no menu.' : 'A partida está pausada.');
    document.querySelector('#screen-pause [data-action="restart"]').classList.toggle('hidden', this.app.game.isClient);
    const canLo = this.app.game.config && (this.app.game.config.mode !== 'team' || true);
    document.querySelector('[data-action="loadout-ingame"]').classList.toggle('hidden', !canLo);
    this.reset('screen-pause');
  }

  showEnd(r) {
    $('end-title').textContent = r.title;
    $('end-title').style.color = r.color || '';
    $('end-sub').textContent = r.subtitle;
    const p = r.rows.find((c) => c.isPlayer);
    const stats = [
      ['Eliminações', p.kills], ['Mortes', p.deaths], ['Precisão', `${r.acc}%`], ['Na cabeça', `${r.hs}%`],
    ];
    const box = $('end-stats');
    box.innerHTML = '';
    stats.forEach(([k, v]) => { const d = document.createElement('div'); d.innerHTML = '<b></b><span></span>'; d.querySelector('b').textContent = v; d.querySelector('span').textContent = k; box.appendChild(d); });
    const board = $('end-board');
    board.innerHTML = '';
    const table = (title, list, color) => {
      const wrap = document.createElement('div');
      wrap.className = 'sb-team';
      const h = document.createElement('h3');
      h.textContent = title;
      if (color) h.style.color = color;
      wrap.appendChild(h);
      const t = document.createElement('table');
      t.innerHTML = '<thead><tr><th>Combatente</th><th>Elim.</th><th>Mortes</th><th>Cabeça</th><th>Dano</th></tr></thead>';
      const tb = document.createElement('tbody');
      list.forEach((c) => {
        const tr = document.createElement('tr');
        if (c.isPlayer) tr.className = 'me';
        [c.name, c.kills, c.deaths, c.headshots, Math.round(c.damageDealt)].forEach((v, i) => {
          const td = document.createElement('td');
          td.textContent = v;
          if (i === 0) {
            const dot = document.createElement('i');
            dot.className = 'sb-dot';
            dot.style.background = r.mode === 'ffa' ? hex(c.color) : (TEAMS[c.team]?.css || '#ccc');
            td.prepend(dot);
          }
          tr.appendChild(td);
        });
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      wrap.appendChild(t);
      return wrap;
    };
    if (r.mode === 'team') {
      board.appendChild(table(`${TEAMS.A.name} — ${r.teamScore.A}`, r.rows.filter((c) => c.team === 'A'), TEAMS.A.css));
      board.appendChild(table(`${TEAMS.B.name} — ${r.teamScore.B}`, r.rows.filter((c) => c.team === 'B'), TEAMS.B.css));
    } else {
      board.appendChild(table('Classificação', r.rows, null));
    }
    const rb = document.querySelector('#screen-end [data-action="restart"]');
    rb.textContent = this.app.net.role === 'guest' ? 'Aguardar próxima partida' : 'Jogar novamente';
    this.reset('screen-end');
  }
}

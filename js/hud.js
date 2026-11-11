// Interface durante a partida: mira, vida, munição, placar, radar, mensagens e indicadores.
import { TEAMS } from './config.js';
import { settings } from './settings.js';
import { formatTime, angleDiff } from './utils.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(map) {
    this.map = map;
    this.el = {
      root: $('hud'), crosshair: $('crosshair'), hit: $('hitmarker'), scope: $('scope'),
      vignette: $('damage-vignette'), lowhp: $('lowhp-vignette'), indicators: $('damage-indicators'),
      radar: $('radar'), timer: $('timer'), roundLabel: $('round-label'),
      leftName: $('ts-left-name'), leftVal: $('ts-left-val'), rightName: $('ts-right-name'), rightVal: $('ts-right-val'),
      pipsL: $('pips-left'), pipsR: $('pips-right'), tsLeft: $('ts-left'), tsRight: $('ts-right'),
      killfeed: $('killfeed'), hp: $('hp-value'), hpFill: $('hp-fill'),
      wName: $('weapon-name'), wCat: $('weapon-cat'), mag: $('ammo-mag'), res: $('ammo-res'),
      reload: $('reload-bar'), reloadFill: $('reload-fill'), slots: $('weapon-slots'),
      center: $('center-msg'), centerTitle: $('center-title'), centerSub: $('center-sub'),
      hint: $('hint'), fps: $('fps'), scoreboard: $('scoreboard'), protect: $('protect'),
      death: $('death-panel'), stats: $('train-stats'),
    };
    this.radarCtx = this.el.radar.getContext('2d');
    this.cache = {};
    this.centerT = 0;
    this.hitT = 0;
    this.vignetteT = 0;
    this.fpsAcc = 0;
    this.fpsFrames = 0;
    this.sbTimer = 0;
    this.indicators = [];
    this.spectateTarget = null;
  }

  set(key, el, value, prop = 'textContent') {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    el[prop] = value;
  }

  setNightVision(on, available) {
    const el = document.getElementById('nv-tag');
    el.classList.toggle('hidden', !available);
    el.classList.toggle('on', on);
    el.textContent = on ? 'VISÃO NOTURNA ATIVA [X]' : 'VISÃO NOTURNA [X]';
  }

  show(v) { this.el.root.classList.toggle('hidden', !v); }

  applySettings() {
    const ch = this.el.crosshair;
    ch.style.setProperty('--ch-color', settings.crosshairColor);
    ch.classList.toggle('with-dot', settings.crosshairDot);
    this.el.radar.classList.toggle('hidden', !settings.radar);
    this.el.fps.classList.toggle('hidden', !settings.showFps);
  }

  setupMatch(game) {
    this.cache = {};
    this.el.killfeed.innerHTML = '';
    this.el.indicators.innerHTML = '';
    this.indicators = [];
    this.el.death.classList.add('hidden');
    this.el.scoreboard.classList.add('hidden');
    const mode = game.config.mode;
    this.el.tsLeft.style.setProperty('--team', mode === 'ffa' ? '#6dff9e' : TEAMS.A.css);
    this.el.tsRight.style.setProperty('--team', mode === 'ffa' ? '#ffd166' : mode === 'training' ? '#cfd6de' : TEAMS.B.css);
    this.el.stats.classList.toggle('hidden', mode !== 'training');
    this.applySettings();
    this.show(true);
  }

  center(title, sub = '', duration = 2.5, color = null) {
    this.el.centerTitle.textContent = title;
    this.el.centerSub.textContent = sub;
    this.el.centerTitle.style.color = color || '';
    this.el.center.classList.add('show');
    this.centerT = duration;
  }

  hitmarker(head, kill) {
    const h = this.el.hit;
    h.classList.remove('show', 'kill', 'head');
    void h.offsetWidth;
    h.classList.add('show');
    if (kill) h.classList.add('kill');
    else if (head) h.classList.add('head');
  }

  damage(attacker, game) {
    this.vignetteT = 1;
    if (!attacker) return;
    const el = document.createElement('div');
    el.className = 'dmg-ind';
    this.el.indicators.appendChild(el);
    this.indicators.push({ el, attacker, t: 1.4 });
    if (this.indicators.length > 6) { const o = this.indicators.shift(); o.el.remove(); }
  }

  killfeed(attacker, victim, def, headshot, game) {
    const row = document.createElement('div');
    row.className = 'kf-row';
    const name = (c) => {
      const s = document.createElement('span');
      s.className = 'kf-name';
      s.textContent = c.name;
      const col = game.config.mode === 'ffa' ? `#${c.color.toString(16).padStart(6, '0')}` : (TEAMS[c.team] ? TEAMS[c.team].css : '#ddd');
      s.style.color = col;
      if (c.isPlayer) s.classList.add('me');
      return s;
    };
    if (attacker && attacker !== victim) row.appendChild(name(attacker));
    const w = document.createElement('span');
    w.className = 'kf-weapon';
    w.textContent = def ? def.name : '—';
    row.appendChild(w);
    if (headshot) {
      const hs = document.createElement('span');
      hs.className = 'kf-hs';
      hs.title = 'Disparo na cabeça';
      hs.textContent = 'HS';
      row.appendChild(hs);
    }
    row.appendChild(name(victim));
    if (attacker?.isPlayer || victim.isPlayer) row.classList.add('involved');
    this.el.killfeed.prepend(row);
    while (this.el.killfeed.children.length > 6) this.el.killfeed.lastChild.remove();
    setTimeout(() => row.classList.add('fade'), 5000);
    setTimeout(() => row.remove(), 5600);
  }

  onDeath(attacker, def, game) {
    const d = this.el.death;
    d.classList.remove('hidden');
    const by = attacker && attacker !== game.player ? `Eliminado por ${attacker.name}` : 'Você foi eliminado';
    d.querySelector('.dp-title').textContent = by;
    d.querySelector('.dp-sub').textContent = def ? `${def.name} · vida restante do adversário: ${attacker ? Math.max(0, attacker.health) : 0}` : '';
  }

  onRespawn() {
    this.el.death.classList.add('hidden');
  }

  spectating(t) {
    this.spectateTarget = t;
  }

  update(game, dt) {
    const p = game.player;
    const el = this.el;
    const mode = game.config.mode;

    // FPS
    this.fpsAcc += dt; this.fpsFrames++;
    if (this.fpsAcc > 0.5) {
      if (settings.showFps) el.fps.textContent = `${Math.round(this.fpsFrames / this.fpsAcc)} FPS`;
      this.fpsAcc = 0; this.fpsFrames = 0;
    }

    // mensagem central
    if (this.centerT > 0) {
      this.centerT -= dt;
      if (this.centerT <= 0) el.center.classList.remove('show');
    }

    // vinhetas
    if (this.vignetteT > 0) this.vignetteT = Math.max(0, this.vignetteT - dt * 1.6);
    this.set('vig', el.vignette.style, String(this.vignetteT * 0.9), 'opacity');
    const low = p.alive && p.health < 35 ? (1 - p.health / 35) * 0.8 : 0;
    this.set('low', el.lowhp.style, String(low.toFixed(2)), 'opacity');

    // indicadores de direção do dano
    for (let i = this.indicators.length - 1; i >= 0; i--) {
      const ind = this.indicators[i];
      ind.t -= dt;
      if (ind.t <= 0) { ind.el.remove(); this.indicators.splice(i, 1); continue; }
      const a = ind.attacker;
      const ang = Math.atan2(-(a.pos.x - p.pos.x), -(a.pos.z - p.pos.z));
      const rel = angleDiff(p.yaw, ang);
      ind.el.style.transform = `translate(-50%, -50%) rotate(${-rel}rad)`;
      ind.el.style.opacity = Math.min(1, ind.t * 1.5);
    }

    // mira dinâmica
    const w = p.weapon;
    const def = w.def;
    const scoped = p.alive && p.zoomLevel > 0;
    el.scope.classList.toggle('hidden', !scoped);
    const hideCross = !p.alive || scoped || p.ads > 0.6 || (def.zoom && !scoped) || p.sprintBlend > 0.5;
    el.crosshair.classList.toggle('hidden', hideCross);
    el.crosshair.classList.toggle('melee', !!def.melee);
    if (!hideCross) {
      const spread = w.spread(p.speed, !p.onGround, p.crouchT > 0.5, false, false) + (def.pellets > 1 ? def.pelletSpread : 0);
      const h = window.innerHeight;
      let gap = settings.crosshairDynamic ? (Math.tan(spread) / Math.tan((game.currentFov * Math.PI) / 360)) * (h / 2) : 6;
      gap = Math.max(4, Math.min(80, gap));
      const gs = `${gap.toFixed(1)}px`;
      if (this.cache.gap !== gs) { this.cache.gap = gs; el.crosshair.style.setProperty('--gap', gs); }
    }
    // marcador de acerto
    el.hit.classList.toggle('hidden', !p.alive);

    // vida
    this.set('hp', el.hp, String(Math.max(0, Math.ceil(p.health))));
    const hpPct = Math.max(0, p.health) / 100;
    this.set('hpw', el.hpFill.style, `${(hpPct * 100).toFixed(1)}%`, 'width');
    const hpColor = hpPct > 0.6 ? '#6dff9e' : hpPct > 0.3 ? '#ffd166' : '#ff5b4a';
    this.set('hpc', el.hpFill.style, hpColor, 'background');
    this.set('prot', el.protect.style, p.alive && p.spawnProtect > 0 ? 'block' : 'none', 'display');

    // munição
    this.set('wn', el.wName, def.name);
    this.set('wc', el.wCat, def.category);
    this.set('mag', el.mag, def.melee ? '—' : String(w.mag));
    this.set('res', el.res, def.melee ? '' : w.infinite ? '/ ∞' : `/ ${w.reserve}`);
    el.mag.classList.toggle('low', !def.melee && w.mag <= Math.ceil(def.mag * 0.25));
    if (w.reloading) {
      el.reload.querySelector('span').textContent = def.beam ? 'RECARREGANDO CÉLULAS' : 'RECARREGANDO';
      el.reload.classList.remove('hidden');
      el.reloadFill.style.width = `${(w.reloadProgress * 100).toFixed(1)}%`;
    } else el.reload.classList.add('hidden');
    const slotsKey = `${p.weapons.primary?.def.id}|${p.weapons.secondary?.def.id}|${p.weapons.melee?.def.id}|${p.slot}`;
    if (this.cache.slots !== slotsKey) {
      this.cache.slots = slotsKey;
      el.slots.innerHTML = '';
      [['primary', '1'], ['secondary', '2'], ['melee', '3']].forEach(([s, k]) => {
        const ww = p.weapons[s];
        if (!ww) return;
        const d = document.createElement('div');
        d.className = `slot${p.slot === s ? ' active' : ''}`;
        d.innerHTML = `<b>${k}</b><span></span>`;
        d.querySelector('span').textContent = ww.def.name;
        el.slots.appendChild(d);
      });
    }

    // barra superior
    if (mode === 'team') {
      this.set('ln', el.leftName, TEAMS.A.name);
      this.set('rn', el.rightName, TEAMS.B.name);
      this.set('lv', el.leftVal, String(game.teamScore.A));
      this.set('rv', el.rightVal, String(game.teamScore.B));
      const pipKey = game.combatants.map((c) => (c.alive ? 1 : 0) + c.team).join('');
      if (this.cache.pips !== pipKey) {
        this.cache.pips = pipKey;
        for (const [team, box] of [['A', el.pipsL], ['B', el.pipsR]]) {
          box.innerHTML = '';
          game.combatants.filter((c) => c.team === team).forEach((c) => {
            const i = document.createElement('i');
            if (!c.alive) i.className = 'dead';
            if (c.isPlayer) i.classList.add('me');
            box.appendChild(i);
          });
        }
      }
      const t = game.phase === 'freeze' ? game.phaseT : game.phase === 'live' ? game.phaseT : 0;
      this.set('timer', el.timer, formatTime(Math.ceil(t)));
      this.set('rl', el.roundLabel, game.phase === 'freeze' ? `RODADA ${game.round} · PREPARAÇÃO` : `RODADA ${game.round} · ATÉ ${game.config.rounds}`);
      el.timer.classList.toggle('urgent', game.phase === 'live' && game.phaseT < 15);
    } else if (mode === 'ffa') {
      const sorted = game.combatants.slice().sort((a, b) => b.kills - a.kills);
      const leader = sorted[0] === p ? sorted[1] : sorted[0];
      this.set('ln', el.leftName, 'Você');
      this.set('lv', el.leftVal, String(p.kills));
      this.set('rn', el.rightName, sorted[0] === p ? `2º ${leader.name}` : `Líder ${leader.name}`);
      this.set('rv', el.rightVal, String(leader.kills));
      this.set('timer', el.timer, formatTime(Math.ceil(game.phaseT)));
      this.set('rl', el.roundLabel, `MATA-MATA · LIMITE ${game.config.scoreLimit}`);
      el.timer.classList.toggle('urgent', game.phaseT < 30);
      if (this.cache.pips !== 'ffa') { this.cache.pips = 'ffa'; el.pipsL.innerHTML = ''; el.pipsR.innerHTML = ''; }
    } else {
      const acc = p.shots ? Math.round((p.hits / p.shots) * 100) : 0;
      this.set('ln', el.leftName, 'Eliminações');
      this.set('lv', el.leftVal, String(p.kills));
      this.set('rn', el.rightName, 'Precisão');
      this.set('rv', el.rightVal, `${acc}%`);
      this.set('timer', el.timer, formatTime(game.time));
      this.set('rl', el.roundLabel, 'TREINAMENTO');
      if (this.cache.pips !== 'tr') { this.cache.pips = 'tr'; el.pipsL.innerHTML = ''; el.pipsR.innerHTML = ''; }
      const hs = p.kills ? Math.round((p.headshots / p.kills) * 100) : 0;
      this.set('stats', el.stats, `Disparos ${p.shots} · Acertos ${p.hits} · Cabeça ${hs}% · Mortes ${p.deaths}`);
    }

    // dica inferior
    let hint = '';
    if (!p.alive) {
      if (mode === 'team') {
        const t = this.spectateTarget;
        hint = t ? `Observando ${t.name} · clique para alternar` : 'Aguardando o fim da rodada';
      } else hint = `Renascendo em ${Math.max(0, p.respawnTimer).toFixed(1)} s`;
    } else if (def.melee && game.time - (p.switchTime || -10) < 3.5) hint = 'Esquerdo: corte · Direito: golpe pesado · pelas costas causa o dobro';
    else if (mode === 'team' && game.phase === 'freeze') hint = '[B] Seleção de armas';
    else if (w.mag === 0 && !w.reloading && w.reserve === 0 && !w.infinite) hint = 'Sem munição · troque de arma [Q]';
    this.set('hint', el.hint, hint);

    // placar (Tab)
    const showSb = game.input.down('Tab') || game.phase === 'matchEnd';
    el.scoreboard.classList.toggle('hidden', !showSb);
    if (showSb) {
      this.sbTimer -= dt;
      if (this.sbTimer <= 0) { this.sbTimer = 0.25; this.renderScoreboard(game); }
    }

    if (settings.radar) this.drawRadar(game);
  }

  renderScoreboard(game) {
    const mode = game.config.mode;
    const row = (c) => {
      const acc = c.shots ? Math.round((c.hits / c.shots) * 100) : 0;
      const tr = document.createElement('tr');
      if (c.isPlayer) tr.className = 'me';
      if (!c.alive) tr.classList.add('dead');
      const cells = [c.name, c.kills, c.deaths, c.headshots, `${acc}%`, Math.round(c.damageDealt)];
      cells.forEach((v, i) => {
        const td = document.createElement('td');
        td.textContent = v;
        if (i === 0) {
          const dot = document.createElement('i');
          dot.className = 'sb-dot';
          dot.style.background = mode === 'ffa' ? `#${c.color.toString(16).padStart(6, '0')}` : (TEAMS[c.team]?.css || '#ccc');
          td.prepend(dot);
        }
        tr.appendChild(td);
      });
      return tr;
    };
    const table = (title, list, color) => {
      const wrap = document.createElement('div');
      wrap.className = 'sb-team';
      const h = document.createElement('h3');
      h.textContent = title;
      if (color) h.style.color = color;
      wrap.appendChild(h);
      const t = document.createElement('table');
      t.innerHTML = '<thead><tr><th>Combatente</th><th>Elim.</th><th>Mortes</th><th>Cabeça</th><th>Precisão</th><th>Dano</th></tr></thead>';
      const tb = document.createElement('tbody');
      list.sort((a, b) => b.kills - a.kills || a.deaths - b.deaths).forEach((c) => tb.appendChild(row(c)));
      t.appendChild(tb);
      wrap.appendChild(t);
      return wrap;
    };
    const sb = this.el.scoreboard;
    sb.innerHTML = '';
    if (mode === 'team') {
      sb.appendChild(table(`${TEAMS.A.name} — ${game.teamScore.A}`, game.combatants.filter((c) => c.team === 'A'), TEAMS.A.css));
      sb.appendChild(table(`${TEAMS.B.name} — ${game.teamScore.B}`, game.combatants.filter((c) => c.team === 'B'), TEAMS.B.css));
    } else {
      sb.appendChild(table(mode === 'ffa' ? 'Mata-mata' : 'Treinamento', game.combatants.slice(), null));
    }
  }

  drawRadar(game) {
    const ctx = this.radarCtx;
    const cv = this.el.radar;
    const S = cv.width;
    const p = game.player;
    const map = this.map;
    const ppm = map.radarPPM;
    const k = 3.2 / ppm; // 3,2 px por metro no radar
    ctx.save();
    ctx.clearRect(0, 0, S, S);
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(10,12,14,0.75)';
    ctx.fillRect(0, 0, S, S);
    ctx.translate(S / 2, S / 2);
    ctx.rotate(p.yaw);
    ctx.scale(k, k);
    ctx.translate(-(p.pos.x + 36) * ppm, -(p.pos.z + 36) * ppm);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(map.radarImg, 0, 0);
    ctx.globalAlpha = 1;
    const t = game.time;
    for (const c of game.combatants) {
      if (c === p || !c.alive) continue;
      const friendly = !game.isEnemy(p, c);
      const visible = friendly || (c.spotted && c.spotted[p.team] > t) || (c.spottedUntil > t && c.pos.distanceTo(p.pos) < 30);
      if (!visible) continue;
      const x = (c.pos.x + 36) * ppm, z = (c.pos.z + 36) * ppm;
      ctx.fillStyle = friendly ? (TEAMS[c.team]?.css || '#6dff9e') : '#ff4a3d';
      ctx.beginPath();
      ctx.arc(x, z, 2.6 / k, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // jogador (sempre no centro, apontando para cima)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(S / 2, S / 2 - 7);
    ctx.lineTo(S / 2 - 5, S / 2 + 5);
    ctx.lineTo(S / 2, S / 2 + 2);
    ctx.lineTo(S / 2 + 5, S / 2 + 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// Controles de toque para celulares e tablets.
//
// Metade esquerda da tela: joystick virtual que aparece onde o polegar toca (anda; empurrado
// até a borda para a frente, corre). Metade direita: arrastar mira. Botões à direita: disparo
// (também mira enquanto arrasta), mira de precisão, pulo, agachar, recarregar e trocar arma.
// Os controles escrevem no mesmo estado de entrada usado por teclado e mouse.

import { settings } from './settings.js';

const STICK_R = 56; // raio útil do joystick, em pixels

export function isTouchDevice() {
  try {
    return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;
  } catch (e) {
    return 'ontouchstart' in window;
  }
}

export class TouchControls {
  constructor(app) {
    this.app = app;
    this.input = app.input;
    this.input.stick = { x: 0, y: 0 };
    this.moveId = null;
    this.lookIds = new Map(); // identificador -> último ponto (arrastes de mira, inclusive sobre o botão de disparo)
    this.held = new Map(); // identificador -> ação de botão segurado
    this.adsOn = false;
    this.crouchOn = false;
    this.build();
  }

  build() {
    const ui = document.createElement('div');
    ui.id = 'touch-ui';
    ui.className = 'hidden';
    ui.innerHTML = `
      <div class="t-zone t-move" data-zone="move"></div>
      <div class="t-zone t-look" data-zone="look"></div>
      <div class="t-stick hidden"><div class="t-knob"></div></div>
      <div class="t-top">
        <button class="t-sbtn" data-act="nv" aria-label="Visão noturna">NV</button>
        <button class="t-sbtn" data-act="loadout" aria-label="Seleção de armas">ARMAS</button>
        <button class="t-sbtn" data-act="board" aria-label="Placar">PLACAR</button>
        <button class="t-sbtn" data-act="fs" aria-label="Tela cheia">⛶</button>
        <button class="t-sbtn" data-act="pause" aria-label="Pausa">❚❚</button>
      </div>
      <div class="t-cluster">
        <button class="t-btn t-fire" data-act="fire" aria-label="Disparar"><span>FOGO</span></button>
        <button class="t-btn t-ads" data-act="ads" aria-label="Mira de precisão"><span>MIRA</span></button>
        <button class="t-btn t-jump" data-act="jump" aria-label="Pular"><span>PULAR</span></button>
        <button class="t-btn t-crouch" data-act="crouch" aria-label="Agachar"><span>AGACHAR</span></button>
        <button class="t-btn t-reload" data-act="reload" aria-label="Recarregar"><span>RECARGA</span></button>
        <button class="t-btn t-swap" data-act="swap" aria-label="Trocar arma"><span>TROCAR</span></button>
      </div>
      <button class="t-btn t-fire2" data-act="fire" aria-label="Disparar"><span>FOGO</span></button>
    `;
    document.getElementById('hud').appendChild(ui);
    this.ui = ui;
    this.stickEl = ui.querySelector('.t-stick');
    this.knob = ui.querySelector('.t-knob');
    this.nvBtn = ui.querySelector('[data-act="nv"]');
    this.adsBtn = ui.querySelector('[data-act="ads"]');
    this.crouchBtn = ui.querySelector('[data-act="crouch"]');
    const opts = { passive: false };
    ui.addEventListener('touchstart', (e) => this.onStart(e), opts);
    ui.addEventListener('touchmove', (e) => this.onMove(e), opts);
    ui.addEventListener('touchend', (e) => this.onEnd(e), opts);
    ui.addEventListener('touchcancel', (e) => this.onEnd(e), opts);
    // evita o menu de contexto e a lupa em toques longos
    ui.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  show(on) {
    this.ui.classList.toggle('hidden', !on);
    if (!on) this.releaseAll();
  }

  // Atualiza os botões que dependem do estado da partida (chamado a cada quadro).
  sync(game) {
    const night = !!this.app.map.night;
    this.nvBtn.classList.toggle('hidden', !night);
    this.nvBtn.classList.toggle('on', !!this.app.nv);
    const p = game.player;
    if (p && p.weapon) {
      const d = p.weapon.def;
      // armas sem mira contínua (espadas e luneta) usam toques, não alternância
      if ((d.melee || d.zoom) && this.adsOn) this.setAds(false);
      if (p.sprinting && this.adsOn) this.setAds(false);
      this.adsBtn.querySelector('span').textContent = d.melee ? 'GOLPE' : d.zoom ? 'LUNETA' : 'MIRA';
    }
  }

  releaseAll() {
    const inp = this.input;
    this.moveId = null;
    this.lookIds.clear();
    this.held.clear();
    inp.stick.x = inp.stick.y = 0;
    inp.mouse.left = false;
    inp.mouse.right = false;
    for (const k of ['KeyW', 'ShiftLeft', 'Space', 'Tab', 'KeyC']) inp.keys.delete(k);
    this.adsOn = false;
    this.crouchOn = false;
    this.adsBtn.classList.remove('on');
    this.crouchBtn.classList.remove('on');
    this.stickEl.classList.add('hidden');
    this.ui.querySelectorAll('.t-btn.down, .t-sbtn.down').forEach((b) => b.classList.remove('down'));
  }

  setAds(on) {
    this.adsOn = on;
    this.input.mouse.right = on;
    if (on) this.input.mouse.rightPressed = true;
    this.adsBtn.classList.toggle('on', on);
  }

  lookScale() {
    const s = settings.touchSens || 1;
    return 1.7 * s;
  }

  onStart(e) {
    e.preventDefault();
    this.app.audio.init();
    for (const t of e.changedTouches) {
      const el = document.elementFromPoint(t.clientX, t.clientY);
      const btn = el && el.closest('[data-act]');
      if (btn && this.ui.contains(btn)) { this.press(btn, t); continue; }
      const zone = el && el.closest('[data-zone]');
      if (zone && zone.dataset.zone === 'move' && this.moveId === null) {
        this.moveId = t.identifier;
        this.stickOrigin = { x: t.clientX, y: t.clientY };
        this.stickEl.style.left = `${t.clientX}px`;
        this.stickEl.style.top = `${t.clientY}px`;
        this.stickEl.classList.remove('hidden');
        this.knob.style.transform = 'translate(-50%, -50%)';
      } else {
        this.lookIds.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
    }
  }

  onMove(e) {
    e.preventDefault();
    const inp = this.input;
    for (const t of e.changedTouches) {
      if (t.identifier === this.moveId) {
        let dx = t.clientX - this.stickOrigin.x;
        let dy = t.clientY - this.stickOrigin.y;
        const len = Math.hypot(dx, dy);
        if (len > STICK_R) { dx *= STICK_R / len; dy *= STICK_R / len; }
        this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        const nx = dx / STICK_R, ny = -dy / STICK_R;
        const mag = Math.hypot(nx, ny);
        // zona morta pequena no centro
        inp.stick.x = mag < 0.12 ? 0 : nx;
        inp.stick.y = mag < 0.12 ? 0 : ny;
        // empurrado até a borda para a frente: corre
        if (ny > 0.88 && len >= STICK_R * 0.98) inp.keys.add('ShiftLeft'); else inp.keys.delete('ShiftLeft');
        continue;
      }
      const last = this.lookIds.get(t.identifier);
      if (last) {
        const k = this.lookScale();
        inp.mouse.dx += (t.clientX - last.x) * k;
        inp.mouse.dy += (t.clientY - last.y) * k;
        last.x = t.clientX;
        last.y = t.clientY;
      }
    }
  }

  onEnd(e) {
    e.preventDefault();
    const inp = this.input;
    for (const t of e.changedTouches) {
      if (t.identifier === this.moveId) {
        this.moveId = null;
        inp.stick.x = inp.stick.y = 0;
        inp.keys.delete('ShiftLeft');
        this.stickEl.classList.add('hidden');
      }
      this.lookIds.delete(t.identifier);
      const act = this.held.get(t.identifier);
      if (act) {
        this.held.delete(t.identifier);
        this.release(act);
      }
    }
  }

  press(btn, t) {
    const act = btn.dataset.act;
    const inp = this.input;
    btn.classList.add('down');
    const hold = (a) => { this.held.set(t.identifier, { act: a, btn }); };
    switch (act) {
      case 'fire':
        inp.mouse.left = true;
        inp.mouse.leftPressed = true;
        hold('fire');
        // o polegar no botão de disparo também mira ao arrastar
        this.lookIds.set(t.identifier, { x: t.clientX, y: t.clientY });
        break;
      case 'ads': {
        const d = this.app.game.player && this.app.game.player.weapon ? this.app.game.player.weapon.def : null;
        if (d && (d.melee || d.zoom)) { inp.mouse.rightPressed = true; inp.mouse.right = !!d.melee; hold('tap-right'); }
        else { this.setAds(!this.adsOn); hold('noop'); }
        break;
      }
      case 'jump':
        inp.pressed.add('Space');
        inp.keys.add('Space');
        hold('jump');
        break;
      case 'crouch':
        this.crouchOn = !this.crouchOn;
        if (this.crouchOn) inp.keys.add('KeyC'); else inp.keys.delete('KeyC');
        this.crouchBtn.classList.toggle('on', this.crouchOn);
        hold('noop');
        break;
      case 'reload': inp.pressed.add('KeyR'); hold('noop'); break;
      case 'swap': inp.mouse.wheel += 1; this.setAds(false); hold('noop'); break;
      case 'nv': inp.pressed.add('KeyX'); hold('noop'); break;
      case 'loadout': inp.pressed.add('KeyB'); hold('noop'); break;
      case 'board': inp.keys.add('Tab'); hold('board'); break;
      case 'fs': this.app.toggleFullscreen(); hold('noop'); break;
      case 'pause': hold('noop'); this.app.pause(); break;
      default: hold('noop');
    }
    if (navigator.vibrate && (act === 'fire' || act === 'jump')) { try { navigator.vibrate(8); } catch (e2) { /* sem vibração */ } }
  }

  release(h) {
    const inp = this.input;
    h.btn.classList.remove('down');
    switch (h.act) {
      case 'fire':
        // só solta o gatilho se nenhum outro dedo segura um botão de disparo
        if (![...this.held.values()].some((o) => o.act === 'fire')) inp.mouse.left = false;
        break;
      case 'tap-right': inp.mouse.right = false; break;
      case 'jump': inp.keys.delete('Space'); break;
      case 'board': inp.keys.delete('Tab'); break;
      default: break;
    }
  }
}

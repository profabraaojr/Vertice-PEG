// Controles de toque desenhados a partir do layout do perfil ativo (touchlayout.js).
//
// A mesma classe serve à partida e ao modo de teste do editor: muda só o "destino" (sink)
// para onde os comandos vão. Na partida, o destino é o objeto Input compartilhado com teclado
// e mouse; no teste, um registro do que foi acionado. Usa eventos de ponteiro (vários dedos ao
// mesmo tempo, e mouse no editor) e bloqueia rolagem e zoom do navegador sobre os controles.
import { settings } from './settings.js';
import { COMMANDS, activeLayout, computeRects } from './touchlayout.js';

// Detecção automática: só considera aparelho de toque quando o ponteiro principal é o dedo e não há
// mouse ou trackpad. Notebooks e PCs com Windows costumam informar suporte a toque (maxTouchPoints)
// mesmo sem tela sensível; por isso esse indicador sozinho não basta.
export function isTouchDevice() {
  try {
    const mq = (q) => window.matchMedia(q).matches;
    const coarse = mq('(pointer: coarse)');
    const fine = mq('(any-pointer: fine)');
    const hover = mq('(any-hover: hover)');
    if (coarse && !fine) return true;
    if (!coarse && (fine || hover)) return false;
    return navigator.maxTouchPoints > 1 && !fine;
  } catch (e) {
    return 'ontouchstart' in window && !window.matchMedia;
  }
}

// Escolha do jogador em Configurações → Controles: 'auto', 'touch' ou 'pc'.
export function resolveTouchMode(mode) {
  const q = new URLSearchParams(location.search);
  if (q.has('touch')) return true;
  if (mode === 'touch') return true;
  if (mode === 'pc') return false;
  return isTouchDevice();
}

// Áreas seguras do aparelho (recorte da câmera, barra de navegação), lidas do CSS.
let probe = null;
export function readSafeInsets() {
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;inset:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
    document.body.appendChild(probe);
  }
  const cs = getComputedStyle(probe);
  return { top: parseFloat(cs.paddingTop) || 0, right: parseFloat(cs.paddingRight) || 0, bottom: parseFloat(cs.paddingBottom) || 0, left: parseFloat(cs.paddingLeft) || 0 };
}

// Destino dos comandos na partida: o mesmo estado de entrada lido pelo jogador.
export function gameSink(app) {
  const inp = app.input;
  if (!inp.stick) inp.stick = { x: 0, y: 0 };
  return {
    stick(x, y) { inp.stick.x = x; inp.stick.y = y; },
    keyDown(k) { inp.keys.add(k); },
    keyUp(k) { inp.keys.delete(k); },
    press(k) { inp.pressed.add(k); },
    fire(down, pressed) { inp.mouse.left = down; if (pressed) inp.mouse.leftPressed = true; },
    right(down, pressed) { inp.mouse.right = down; if (pressed) inp.mouse.rightPressed = true; },
    wheel(n) { inp.mouse.wheel += n; },
    look(dx, dy) { inp.mouse.dx += dx; inp.mouse.dy += dy; },
    action(name) {
      if (name === 'pause') app.pause();
      else if (name === 'fullscreen') app.toggleFullscreen();
      else if (name === 'chat') setTimeout(() => app.chat.open(), 0);
    },
    weapon() { const p = app.game && app.game.player; return p && p.weapon ? p.weapon.def : null; },
    sprinting() { const p = app.game && app.game.player; return !!(p && p.sprinting); },
  };
}

export class TouchControls {
  /*
   * opts: container (elemento), sink, getSize() -> { W, H, insets }, getLayout(), ctx() -> { night, net },
   *       toLocal(clientX, clientY) -> {x, y}, onEvent(texto) para o modo de teste
   */
  constructor(app, opts = {}) {
    this.app = app;
    this.container = opts.container || document.getElementById('hud');
    this.sink = opts.sink || gameSink(app);
    this.getSize = opts.getSize || (() => ({ W: window.innerWidth, H: window.innerHeight, insets: readSafeInsets() }));
    this.getLayout = opts.getLayout || activeLayout;
    this.ctx = opts.ctx || (() => ({ night: !!(app.map && app.map.night), net: !!(app.net && app.net.active), story: !!(app.game && app.game.story) }));
    this.toLocal = opts.toLocal || ((x, y) => ({ x, y }));
    this.onEvent = opts.onEvent || null;
    this.isGame = !opts.container;
    this.ptr = new Map(); // pointerId -> { kind: 'stick'|'look'|'btn', ... }
    this.toggles = {}; // cmd -> ligado
    this.stickId = null;
    this.rects = [];
    this.nodes = new Map();
    this.build();
  }

  build() {
    const ui = document.createElement('div');
    ui.className = 't-root hidden';
    if (this.isGame) ui.id = 'touch-ui';
    this.container.appendChild(ui);
    this.ui = ui;
    this.stickEl = document.createElement('div');
    this.stickEl.className = 't-stick-live hidden';
    this.stickEl.innerHTML = '<div class="t-knob"></div>';
    ui.appendChild(this.stickEl);
    this.knob = this.stickEl.firstChild;
    ui.addEventListener('pointerdown', (e) => this.onDown(e));
    ui.addEventListener('pointermove', (e) => this.onMove(e));
    ui.addEventListener('pointerup', (e) => this.onUp(e));
    ui.addEventListener('pointercancel', (e) => this.onUp(e));
    ui.addEventListener('lostpointercapture', (e) => this.onUp(e));
    // impede rolagem, zoom e menu de toque longo do navegador sobre os controles
    for (const ev of ['touchstart', 'touchmove', 'touchend']) ui.addEventListener(ev, (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    ui.addEventListener('contextmenu', (e) => e.preventDefault());
    ui.addEventListener('gesturestart', (e) => e.preventDefault());
    if (this.isGame) {
      window.addEventListener('resize', () => this.relayout());
      window.addEventListener('orientationchange', () => setTimeout(() => this.relayout(), 250));
    }
  }

  show(on) {
    this.ui.classList.toggle('hidden', !on);
    if (on) this.relayout();
    else this.releaseAll();
  }

  get layout() { return this.getLayout(); }

  // Posiciona os botões conforme o layout e o tamanho atual da tela.
  relayout() {
    const { W, H, insets } = this.getSize();
    this.size = { W, H, insets };
    const ctx = this.ctx();
    this.rects = computeRects(this.layout, W, H, insets, ctx);
    const seen = new Set();
    for (const r of this.rects) {
      const id = r.e.uid;
      seen.add(id);
      let n = this.nodes.get(id);
      if (!n) {
        n = document.createElement('div');
        n.dataset.uid = id;
        n.innerHTML = '<span></span>';
        this.ui.appendChild(n);
        this.nodes.set(id, n);
      }
      const stick = r.cmd.kind === 'stick';
      n.className = `t-ctl t-${r.e.shape}${stick ? ' t-stickbase' : ''}${this.toggles[r.e.cmd] ? ' on' : ''}`;
      n.style.left = `${r.cx - r.size / 2}px`;
      n.style.top = `${r.cy - r.size / 2}px`;
      n.style.width = n.style.height = `${r.size}px`;
      n.style.opacity = String(stick && this.layout.moveMode === 'dynamic' ? r.opacity * 0.45 : r.opacity);
      n.style.display = r.e.visible && r.available ? '' : 'none';
      const label = this.labelFor(r);
      const sp = n.firstChild;
      if (sp.textContent !== label) sp.textContent = label;
      sp.style.fontSize = `${Math.max(9, Math.min(15, r.size * (label.length > 6 ? 0.13 : 0.18)))}px`;
      r.node = n;
    }
    for (const [id, n] of this.nodes) if (!seen.has(id)) { n.remove(); this.nodes.delete(id); }
    if (this.isGame) {
      // HUD de vida vai para o lado oposto ao do conjunto de ações (destro/canhoto)
      const fires = this.rects.filter((r) => r.e.cmd === 'fire' && r.e.visible).sort((a, b) => b.size - a.size);
      document.body.classList.toggle('t-lefty', !!fires[0] && fires[0].cx < W / 2);
    }
  }

  labelFor(r) {
    if (r.e.cmd === 'ads') {
      const d = this.sink.weapon && this.sink.weapon();
      return d ? (d.melee ? 'GOLPE' : d.zoom ? 'LUNETA' : 'MIRA') : r.cmd.short;
    }
    return r.cmd.short;
  }

  // Estado da partida que muda o que aparece (visão noturna, chat, rótulo da mira).
  sync() {
    const ctx = this.ctx();
    for (const r of this.rects) {
      const avail = !r.cmd.when || !!ctx[r.cmd.when];
      if (avail !== r.available) { this.relayout(); return; }
    }
    const d = this.sink.weapon && this.sink.weapon();
    if (this.toggles.ads && (!d || d.melee || d.zoom || (this.sink.sprinting && this.sink.sprinting()))) this.setToggle('ads', false);
    const ads = this.rects.find((r) => r.e.cmd === 'ads');
    if (ads && ads.node) {
      const l = this.labelFor(ads);
      if (ads.node.firstChild.textContent !== l) ads.node.firstChild.textContent = l;
    }
  }

  // ---------- toques ----------
  hit(x, y) {
    let best = null, bestD = Infinity;
    for (const r of this.rects) {
      if (!r.e.visible || !r.available) continue;
      const half = r.size / 2;
      const dx = Math.abs(x - r.cx), dy = Math.abs(y - r.cy);
      const inside = r.e.shape === 'circle' || r.e.shape === 'hex' ? Math.hypot(dx, dy) <= half * 1.08 : dx <= half * 1.04 && dy <= half * 1.04;
      if (!inside) continue;
      const d = Math.hypot(dx, dy) / half;
      if (d < bestD) { bestD = d; best = r; }
    }
    return best;
  }

  onDown(e) {
    e.preventDefault();
    if (this.app.audio) this.app.audio.init();
    try { this.ui.setPointerCapture(e.pointerId); } catch (err) { /* sem captura */ }
    const p = this.toLocal(e.clientX, e.clientY);
    const r = this.hit(p.x, p.y);
    const L = this.layout;
    if (r && r.cmd.kind === 'stick') { this.startStick(e.pointerId, L.moveMode === 'fixed' ? { x: r.cx, y: r.cy } : p, r); return; }
    if (r) { this.press(e.pointerId, r, p); return; }
    const mv = this.rects.find((x) => x.cmd.kind === 'stick' && x.e.visible);
    if (mv && L.moveMode === 'dynamic' && this.stickId === null && (p.x < this.size.W / 2) === (mv.cx < this.size.W / 2)) {
      this.startStick(e.pointerId, p, mv);
      return;
    }
    this.ptr.set(e.pointerId, { kind: 'look', x: p.x, y: p.y, k: 1.7 * (settings.touchSens || 1) });
  }

  onMove(e) {
    const t = this.ptr.get(e.pointerId);
    if (!t) return;
    e.preventDefault();
    const p = this.toLocal(e.clientX, e.clientY);
    if (t.kind === 'stick') {
      const R = t.radius;
      let dx = p.x - t.ox, dy = p.y - t.oy;
      const len = Math.hypot(dx, dy);
      if (len > R) { dx *= R / len; dy *= R / len; }
      this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const sens = t.rect.e.sens || 1;
      let nx = (dx / R) * sens, ny = (-dy / R) * sens;
      const mag = Math.hypot(nx, ny);
      if (mag > 1) { nx /= mag; ny /= mag; }
      const dead = mag < 0.12;
      this.sink.stick(dead ? 0 : nx, dead ? 0 : ny);
      // empurrado até a borda para a frente: corre (além do botão Correr, se existir)
      const edge = ny > 0.88 && len >= R * 0.98;
      if (edge && !t.sprint) { t.sprint = true; this.sink.keyDown('ShiftLeft'); }
      else if (!edge && t.sprint && !this.toggles.sprint) { t.sprint = false; this.sink.keyUp('ShiftLeft'); }
      return;
    }
    if (t.kind === 'look' || t.look) {
      this.sink.look((p.x - t.x) * t.k, (p.y - t.y) * t.k);
      t.x = p.x; t.y = p.y;
    }
  }

  onUp(e) {
    const t = this.ptr.get(e.pointerId);
    if (!t) return;
    this.ptr.delete(e.pointerId);
    if (t.kind === 'stick') {
      this.stickId = null;
      this.sink.stick(0, 0);
      if (t.sprint && !this.toggles.sprint) this.sink.keyUp('ShiftLeft');
      this.stickEl.classList.add('hidden');
      if (t.rect.node) t.rect.node.classList.remove('active');
      return;
    }
    if (t.kind === 'btn') this.release(t);
  }

  startStick(id, at, r) {
    const R = r.size / 2;
    this.stickId = id;
    this.ptr.set(id, { kind: 'stick', ox: at.x, oy: at.y, radius: R * 0.82, rect: r });
    const s = this.stickEl;
    s.style.left = `${at.x}px`;
    s.style.top = `${at.y}px`;
    s.style.width = s.style.height = `${r.size}px`;
    s.style.opacity = String(Math.max(0.5, r.opacity));
    s.classList.remove('hidden');
    this.knob.style.transform = 'translate(-50%, -50%)';
    if (r.node) r.node.classList.add('active');
    this.log('Movimento');
  }

  setToggle(cmd, on) {
    this.toggles[cmd] = on;
    for (const r of this.rects) if (r.e.cmd === cmd && r.node) r.node.classList.toggle('on', on);
  }

  log(text) { if (this.onEvent) this.onEvent(text); }

  press(id, r, p) {
    const c = r.cmd, s = this.sink, cmd = r.e.cmd;
    const t = { kind: 'btn', r, cmd };
    if (r.node) r.node.classList.add('down');
    switch (cmd) {
      case 'fire':
        s.fire(true, true);
        // o polegar no botão de disparo também mira ao arrastar
        Object.assign(t, { look: true, x: p.x, y: p.y, k: 1.7 * (settings.touchSens || 1) * (r.e.sens || 1) });
        break;
      case 'ads': {
        const d = s.weapon && s.weapon();
        if (d && (d.melee || d.zoom)) { s.right(!!d.melee, true); t.tapRight = true; }
        else { const on = !this.toggles.ads; this.setToggle('ads', on); s.right(on, on); }
        break;
      }
      default:
        if (c.kind === 'hold') { if (c.press) s.press(c.key); s.keyDown(c.key); }
        else if (c.kind === 'toggle') {
          const on = !this.toggles[cmd];
          this.setToggle(cmd, on);
          if (on) s.keyDown(c.key); else s.keyUp(c.key);
        } else if (c.kind === 'tap') {
          if (c.key) s.press(c.key);
          if (c.wheel) s.wheel(c.wheel);
          if (c.action) s.action(c.action);
          if (cmd === 'swap' && this.toggles.ads) { this.setToggle('ads', false); s.right(false, false); }
        }
    }
    this.ptr.set(id, t);
    this.log(c.label + (c.kind === 'toggle' || cmd === 'ads' ? (this.toggles[cmd] ? ' (ligado)' : ' (desligado)') : ''));
    if (this.isGame && navigator.vibrate && (cmd === 'fire' || cmd === 'jump')) { try { navigator.vibrate(8); } catch (err) { /* sem vibração */ } }
  }

  release(t) {
    const s = this.sink, c = t.r.cmd;
    if (t.r.node) t.r.node.classList.remove('down');
    if (t.cmd === 'fire') {
      // solta o gatilho só se nenhum outro dedo segura um botão de disparo
      if (![...this.ptr.values()].some((o) => o.cmd === 'fire')) s.fire(false, false);
    } else if (t.tapRight) s.right(false, false);
    else if (c.kind === 'hold') s.keyUp(c.key);
  }

  releaseAll() {
    for (const t of this.ptr.values()) if (t.kind === 'btn') this.release(t);
    this.ptr.clear();
    this.stickId = null;
    this.sink.stick(0, 0);
    for (const [cmd, on] of Object.entries(this.toggles)) {
      if (!on) continue;
      if (cmd === 'ads') this.sink.right(false, false);
      else if (COMMANDS[cmd] && COMMANDS[cmd].key) this.sink.keyUp(COMMANDS[cmd].key);
    }
    this.sink.keyUp('ShiftLeft');
    this.toggles = {};
    this.stickEl.classList.add('hidden');
    for (const n of this.nodes.values()) n.classList.remove('down', 'on', 'active');
  }

  destroy() {
    this.releaseAll();
    this.ui.remove();
  }
}

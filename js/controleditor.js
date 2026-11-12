// Editor "Personalizar controles": simulação de celular, arraste, ajustes por botão,
// layouts prontos, perfis, teste dos comandos e exportação/importação.
// Trabalha sobre uma cópia (rascunho) do perfil; só grava ao tocar em Salvar.
import { settings } from './settings.js';
import {
  COMMANDS, COMMAND_IDS, SHAPES, PRESETS, HANDS, MIN_TOUCH_PX, makeLayout, sanitizeLayout,
  profiles, saveProfiles, newProfileId, exportProfile, importProfile, computeRects, pxToNorm, overlaps,
} from './touchlayout.js';
import { TouchControls, readSafeInsets, isTouchDevice } from './touch.js';

const $ = (id) => document.getElementById(id);
const clone = (o) => JSON.parse(JSON.stringify(o));

// aparelhos simulados: tamanho lógico em paisagem e áreas seguras por orientação
const DEVICES = {
  current: { name: 'Este aparelho' },
  small: { name: 'Celular pequeno · 360 × 640', w: 640, h: 360, land: { left: 0, right: 0, top: 0, bottom: 0 }, port: { top: 24, bottom: 0, left: 0, right: 0 } },
  android: { name: 'Android grande · 412 × 915 (barra de navegação)', w: 915, h: 412, land: { left: 0, right: 48, top: 0, bottom: 0 }, port: { top: 32, bottom: 48, left: 0, right: 0 } },
  iphone: { name: 'iPhone com recorte · 390 × 844', w: 844, h: 390, land: { left: 47, right: 47, top: 0, bottom: 21 }, port: { top: 47, bottom: 34, left: 0, right: 0 }, notch: true },
  tablet: { name: 'Tablet · 768 × 1024', w: 1024, h: 768, land: { top: 20, bottom: 20, left: 0, right: 0 }, port: { top: 24, bottom: 20, left: 0, right: 0 } },
};

export class ControlEditor {
  constructor(app) {
    this.app = app;
    this.device = isTouchDevice() ? 'current' : 'iphone';
    this.orient = 'land';
    this.sel = null;
    this.dirty = false;
    this.testing = null;
    this.bind();
  }

  // ---------- abertura e rascunho ----------
  open() {
    const tp = profiles();
    this.profileId = tp.active;
    this.loadDraft();
    this.app.menu.show('screen-ctl');
    requestAnimationFrame(() => this.render());
  }

  loadDraft() {
    const p = profiles().list.find((x) => x.id === this.profileId);
    this.draft = clone(p.layout);
    this.sel = null;
    this.setDirty(false);
  }

  setDirty(v) {
    this.dirty = v;
    $('ctl-save').classList.toggle('primary', v);
    $('ctl-save').textContent = v ? 'Salvar alterações' : 'Salvo';
    this.confirmLeave = false;
  }

  changed(markCustom = true) {
    if (markCustom && this.draft.preset !== 'custom') this.bake();
    if (markCustom) { this.draft.preset = 'custom'; this.draft.hand = 'custom'; }
    this.setDirty(true);
    this.render();
  }

  // Ao editar um layout pronto, grava as posições já ajustadas para esta tela nas duas
  // orientações, para nada "pular" quando o layout passa a ser personalizado.
  bake() {
    for (const o of ['land', 'port']) {
      const { W, H, insets } = this.deviceSize(o);
      for (const r of computeRects(this.draft, W, H, insets, { night: true, net: true, story: true })) {
        r.e[o] = pxToNorm({ ...this.draft, spacing: this.draft.spacing }, W, H, insets, r.cx, r.cy);
      }
    }
  }

  status(t, err = false) {
    const el = $('ctl-status');
    el.textContent = t;
    el.classList.toggle('err', err);
  }

  // ---------- interface ----------
  bind() {
    const dev = $('ctl-device');
    for (const [id, d] of Object.entries(DEVICES)) { const o = document.createElement('option'); o.value = id; o.textContent = d.name; dev.appendChild(o); }
    dev.addEventListener('change', () => { this.device = dev.value; this.render(); });
    $('ctl-orient').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { this.orient = b.dataset.v; this.render(); }));
    $('ctl-test').addEventListener('click', () => this.toggleTest());
    // perfis
    $('ctl-profile').addEventListener('change', (e) => {
      if (this.dirty && !this.confirmSwitch) { this.confirmSwitch = true; e.target.value = this.profileId; this.status('Há alterações não salvas. Salve ou escolha o perfil de novo para descartá-las.', true); return; }
      this.confirmSwitch = false;
      this.profileId = e.target.value;
      profiles().active = this.profileId;
      saveProfiles();
      this.loadDraft();
      this.render();
      this.status('Perfil carregado e ativado para as partidas.');
    });
    $('ctl-new').addEventListener('click', () => this.addProfile('Novo perfil', makeLayout('classic', 'right')));
    $('ctl-dup').addEventListener('click', () => this.addProfile(`${this.profile().name} (cópia)`, clone(this.draft)));
    $('ctl-rename').addEventListener('click', () => {
      const box = $('ctl-rename-box');
      box.classList.toggle('hidden');
      $('ctl-name').value = this.profile().name;
      $('ctl-name').focus();
    });
    $('ctl-rename-ok').addEventListener('click', () => {
      const n = $('ctl-name').value.trim().slice(0, 30);
      if (!n) return;
      this.profile().name = n;
      saveProfiles();
      $('ctl-rename-box').classList.add('hidden');
      this.render();
      this.status('Perfil renomeado.');
    });
    $('ctl-del').addEventListener('click', () => {
      const tp = profiles();
      if (tp.list.length <= 1) { this.status('É preciso manter pelo menos um perfil.', true); return; }
      if (!this.confirmDel) { this.confirmDel = true; this.status(`Toque em Excluir de novo para apagar "${this.profile().name}".`, true); return; }
      this.confirmDel = false;
      tp.list = tp.list.filter((p) => p.id !== this.profileId);
      tp.active = tp.list[0].id;
      this.profileId = tp.active;
      saveProfiles();
      this.loadDraft();
      this.render();
      this.status('Perfil excluído.');
    });
    $('ctl-export').addEventListener('click', () => this.exportCurrent());
    $('ctl-import').addEventListener('click', () => $('ctl-file').click());
    $('ctl-file').addEventListener('change', (e) => this.importFile(e.target.files[0]));
    // layouts prontos e mão
    $('ctl-preset').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { this.pendingPreset = b.dataset.v; this.renderSide(); }));
    $('ctl-hand').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { this.pendingHand = b.dataset.v; this.renderSide(); }));
    $('ctl-apply').addEventListener('click', () => {
      const preset = this.pendingPreset || (PRESETS[this.draft.preset] ? this.draft.preset : 'classic');
      const hand = this.pendingHand || (HANDS[this.draft.hand] && this.draft.hand !== 'custom' ? this.draft.hand : 'right');
      const keep = { scale: this.draft.scale, spacing: this.draft.spacing, opacity: this.draft.opacity, moveMode: this.draft.moveMode, orient: this.draft.orient };
      this.draft = makeLayout(preset, hand, keep);
      this.pendingPreset = this.pendingHand = null;
      this.sel = null;
      this.changed(false);
      this.status(`Layout ${PRESETS[preset].name} · ${HANDS[hand]} aplicado. Salve para usar na partida.`);
    });
    // ajustes gerais
    const gen = (id, key, fmt) => $(id).addEventListener('input', (e) => { this.draft[key] = Number(e.target.value); $(`${id}-out`).textContent = fmt(this.draft[key]); this.changed(false); });
    gen('ctl-scale', 'scale', (v) => `${Math.round(v * 100)}%`);
    gen('ctl-spacing', 'spacing', (v) => `${Math.round(v * 100)}%`);
    gen('ctl-opacity', 'opacity', (v) => `${Math.round(v * 100)}%`);
    $('ctl-move').addEventListener('change', (e) => this.setMoveMode(e.target.value));
    $('ctl-gorient').addEventListener('change', (e) => { this.draft.orient = e.target.value; this.changed(false); });
    // botão selecionado
    const sel = $('ctl-cmd');
    for (const id of COMMAND_IDS) { const o = document.createElement('option'); o.value = id; o.textContent = COMMANDS[id].label; sel.appendChild(o); }
    const add = $('ctl-add-cmd');
    for (const id of COMMAND_IDS) { const o = document.createElement('option'); o.value = id; o.textContent = COMMANDS[id].label; add.appendChild(o); }
    sel.addEventListener('change', (e) => { const el = this.selected(); if (el) { el.cmd = e.target.value; this.changed(); } });
    const prop = (id, key, fmt) => $(id).addEventListener('input', (e) => { const el = this.selected(); if (!el) return; el[key] = Number(e.target.value); $(`${id}-out`).textContent = fmt(el[key]); this.changed(); });
    prop('ctl-size', 'size', (v) => `${Math.round(v * 100)}`);
    prop('ctl-eopacity', 'opacity', (v) => `${Math.round(v * 100)}%`);
    prop('ctl-sens', 'sens', (v) => v.toFixed(2));
    const shapes = $('ctl-shape');
    for (const [id, n] of Object.entries(SHAPES)) { const b = document.createElement('button'); b.dataset.v = id; b.textContent = n; b.addEventListener('click', () => { const el = this.selected(); if (el) { el.shape = id; this.changed(); } }); shapes.appendChild(b); }
    $('ctl-visible').addEventListener('change', (e) => { const el = this.selected(); if (el) { el.visible = e.target.checked; this.changed(); } });
    $('ctl-remove').addEventListener('click', () => {
      const el = this.selected();
      if (!el) return;
      if (el.cmd === 'move' && this.draft.elements.filter((x) => x.cmd === 'move').length === 1 && this.draft.moveMode !== 'dpad') { this.status('O joystick é necessário para andar. Oculte-o ou mude o movimento para botões direcionais.', true); return; }
      this.draft.elements = this.draft.elements.filter((x) => x !== el);
      this.sel = null;
      this.changed();
    });
    $('ctl-add').addEventListener('click', () => {
      const cmd = $('ctl-add-cmd').value;
      const e = { uid: `b${Date.now().toString(36)}`, cmd, land: { x: 0.5, y: 0.5 }, port: { x: 0.5, y: 0.5 }, size: cmd === 'move' ? 0.32 : 0.14, opacity: 0.85, shape: 'circle', visible: true, sens: 1 };
      this.draft.elements.push(e);
      this.sel = e.uid;
      this.changed();
      this.status(`"${COMMANDS[cmd].label}" adicionado no centro. Arraste para posicionar.`);
    });
    // rodapé
    $('ctl-save').addEventListener('click', () => this.save());
    $('ctl-reset').addEventListener('click', () => {
      if (!this.confirmReset) { this.confirmReset = true; this.status('Toque em Restaurar de novo para voltar ao layout original (Clássico, destro).', true); return; }
      this.confirmReset = false;
      this.draft = makeLayout('classic', 'right');
      this.sel = null;
      this.changed(false);
      this.status('Layout original restaurado. Salve para confirmar.');
    });
    $('ctl-back').addEventListener('click', () => {
      if (this.dirty && !this.confirmLeave) { this.confirmLeave = true; this.status('Há alterações não salvas. Toque em Voltar de novo para descartá-las, ou em Salvar.', true); return; }
      this.stopTest();
      this.app.menu.back();
    });
    // arraste e redimensionamento na tela simulada
    const scr = $('ctl-screen');
    scr.addEventListener('pointerdown', (e) => this.onDown(e));
    scr.addEventListener('pointermove', (e) => this.onMove(e));
    scr.addEventListener('pointerup', (e) => this.onUp(e));
    scr.addEventListener('pointercancel', (e) => this.onUp(e));
    for (const ev of ['touchstart', 'touchmove']) scr.addEventListener(ev, (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    window.addEventListener('resize', () => { if (this.app.menu.current === 'screen-ctl') this.render(); });
  }

  profile() { return profiles().list.find((p) => p.id === this.profileId); }
  selected() { return this.draft.elements.find((e) => e.uid === this.sel) || null; }

  addProfile(name, layout) {
    const tp = profiles();
    const id = newProfileId();
    tp.list.push({ id, name: name.slice(0, 30), layout: sanitizeLayout(layout) });
    tp.active = id;
    this.profileId = id;
    saveProfiles();
    this.loadDraft();
    this.render();
    this.status(`Perfil "${name}" criado e ativado.`);
  }

  setMoveMode(mode) {
    this.draft.moveMode = mode;
    if (mode === 'dpad' && !this.draft.elements.some((e) => e.cmd === 'up')) {
      // cria a cruz direcional onde estava o joystick
      const mv = this.draft.elements.find((e) => e.cmd === 'move') || { land: { x: 0.17, y: 0.7 }, port: { x: 0.25, y: 0.8 } };
      const off = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
      for (const [cmd, [dx, dy]] of Object.entries(off)) {
        this.draft.elements.push({ uid: `d${cmd}${Date.now().toString(36)}`, cmd, land: { x: mv.land.x + dx * 0.075, y: mv.land.y + dy * 0.15 }, port: { x: mv.port.x + dx * 0.15, y: mv.port.y + dy * 0.07 }, size: 0.13, opacity: 0.85, shape: 'rounded', visible: true, sens: 1 });
      }
    }
    this.changed(false);
  }

  save() {
    const p = this.profile();
    p.layout = sanitizeLayout(this.draft);
    profiles().active = p.id;
    saveProfiles();
    this.draft = clone(p.layout);
    this.setDirty(false);
    this.render();
    this.status(`Perfil "${p.name}" salvo e ativado. Os controles da partida já usam este layout.`);
  }

  exportCurrent() {
    const p = { ...this.profile(), layout: sanitizeLayout(this.draft) };
    const text = exportProfile(p);
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      a.download = `controles-${p.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      this.status('Arquivo de controles baixado. Use Importar em outro aparelho para carregá-lo.');
    } catch (e) {
      this.status('Não foi possível baixar o arquivo neste navegador.', true);
    }
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
  }

  importFile(file) {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const p = importProfile(String(fr.result));
        this.addProfile(p.name, p.layout);
        this.status(`Perfil "${p.name}" importado e ativado.`);
      } catch (e) { this.status(e.message, true); }
      $('ctl-file').value = '';
    };
    fr.readAsText(file);
  }

  // ---------- simulação ----------
  deviceSize(orient = this.orient) {
    const d = DEVICES[this.device];
    if (this.device === 'current') {
      const W = window.screen ? Math.max(window.screen.width, window.screen.height) : 844;
      const H = window.screen ? Math.min(window.screen.width, window.screen.height) : 390;
      const ins = readSafeInsets();
      const land = { left: Math.max(ins.left, ins.right), right: Math.max(ins.left, ins.right), top: 0, bottom: ins.bottom };
      const port = { top: Math.max(ins.top, ins.left), bottom: Math.max(ins.bottom, 0), left: 0, right: 0 };
      return orient === 'land' ? { W, H, insets: land } : { W: H, H: W, insets: port };
    }
    return orient === 'land' ? { W: d.w, H: d.h, insets: d.land, notch: d.notch } : { W: d.h, H: d.w, insets: d.port, notch: d.notch };
  }

  scaleFit() {
    const wrap = $('ctl-stage');
    const { W, H } = this.deviceSize();
    const availW = Math.max(200, wrap.parentElement.clientWidth - 24);
    const availH = Math.max(200, Math.min(window.innerHeight * 0.62, 560));
    return Math.min(availW / W, availH / H, 1);
  }

  render() {
    if (!this.draft) return;
    const { W, H, insets, notch } = this.deviceSize();
    const k = this.scaleFit();
    this.k = k;
    const phone = $('ctl-phone');
    const scr = $('ctl-screen');
    phone.style.width = `${W * k + 16}px`;
    phone.style.height = `${H * k + 16}px`;
    scr.style.width = `${W}px`;
    scr.style.height = `${H}px`;
    scr.style.transform = `scale(${k})`;
    // áreas seguras: faixas sombreadas e contorno tracejado da área útil
    const safe = $('ctl-safe');
    safe.style.left = `${insets.left}px`; safe.style.top = `${insets.top}px`;
    safe.style.right = `${insets.right}px`; safe.style.bottom = `${insets.bottom}px`;
    const nt = $('ctl-notch');
    nt.classList.toggle('hidden', !notch && !(insets.left || insets.top));
    if (this.orient === 'land') nt.style.cssText = `left:0;top:${H / 2 - 70}px;width:${Math.max(insets.left, 0)}px;height:140px`;
    else nt.style.cssText = `top:0;left:${W / 2 - 70}px;height:${Math.max(insets.top, 0)}px;width:140px`;
    $('ctl-orient').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.v === this.orient));
    $('ctl-device').value = this.device;
    if (!this.testing) this.renderControls(W, H, insets);
    this.renderSide();
  }

  renderControls(W, H, insets) {
    const box = $('ctl-ctls');
    box.innerHTML = '';
    const rects = computeRects(this.draft, W, H, insets, { night: true, net: true, story: true });
    this.rects = rects;
    const bad = overlaps(rects);
    for (const r of rects) {
      const n = document.createElement('div');
      const stick = r.cmd.kind === 'stick';
      n.className = `t-ctl t-${r.e.shape}${stick ? ' t-stickbase' : ''}${r.e.uid === this.sel ? ' sel' : ''}${bad.has(r.e.uid) ? ' overlap' : ''}${r.e.visible ? '' : ' off'}`;
      n.style.left = `${r.cx - r.size / 2}px`;
      n.style.top = `${r.cy - r.size / 2}px`;
      n.style.width = n.style.height = `${r.size}px`;
      n.style.opacity = String(r.e.visible ? Math.max(0.35, r.opacity) : 0.25);
      n.dataset.uid = r.e.uid;
      const sp = document.createElement('span');
      sp.textContent = stick ? 'MOVER' : r.cmd.short;
      sp.style.fontSize = `${Math.max(9, Math.min(15, r.size * (sp.textContent.length > 6 ? 0.13 : 0.18)))}px`;
      n.appendChild(sp);
      if (r.e.uid === this.sel) {
        const h = document.createElement('i');
        h.className = 'ctl-handle';
        h.title = 'Arraste para redimensionar';
        n.appendChild(h);
      }
      box.appendChild(n);
    }
    $('ctl-warn').textContent = bad.size ? 'Botões em vermelho estão sobrepostos ou muito próximos: separe-os para evitar toques acidentais.' : '';
  }

  renderSide() {
    const tp = profiles();
    const ps = $('ctl-profile');
    ps.innerHTML = '';
    for (const p of tp.list) { const o = document.createElement('option'); o.value = p.id; o.textContent = p.name + (p.id === tp.active ? ' (ativo)' : ''); ps.appendChild(o); }
    ps.value = this.profileId;
    const d = this.draft;
    const preset = this.pendingPreset || d.preset;
    const hand = this.pendingHand || d.hand;
    $('ctl-preset').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.v === preset));
    $('ctl-hand').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.v === hand));
    $('ctl-layout-state').textContent = d.preset === 'custom' ? 'Personalizado' : `${PRESETS[d.preset] ? PRESETS[d.preset].name : ''} · ${HANDS[d.hand] || ''}`;
    for (const [id, key] of [['ctl-scale', 'scale'], ['ctl-spacing', 'spacing'], ['ctl-opacity', 'opacity']]) { $(id).value = d[key]; $(`${id}-out`).textContent = `${Math.round(d[key] * 100)}%`; }
    $('ctl-move').value = d.moveMode;
    $('ctl-gorient').value = d.orient;
    const el = this.selected();
    $('ctl-sel').classList.toggle('hidden', !el);
    $('ctl-nosel').classList.toggle('hidden', !!el);
    if (el) {
      $('ctl-cmd').value = el.cmd;
      $('ctl-size').value = el.size; $('ctl-size-out').textContent = `${Math.round(el.size * 100)}`;
      $('ctl-eopacity').value = el.opacity; $('ctl-eopacity-out').textContent = `${Math.round(el.opacity * 100)}%`;
      $('ctl-sens').value = el.sens; $('ctl-sens-out').textContent = el.sens.toFixed(2);
      $('ctl-sens-wrap').classList.toggle('hidden', !COMMANDS[el.cmd].sens);
      $('ctl-sens-label').textContent = el.cmd === 'move' ? 'Sensibilidade do joystick' : 'Sensibilidade da mira ao arrastar';
      $('ctl-shape').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.v === el.shape));
      $('ctl-visible').checked = el.visible;
      const r = (this.rects || []).find((x) => x.e.uid === el.uid);
      $('ctl-sel-info').textContent = r ? `${Math.round(r.size)} px na tela simulada${r.size <= MIN_TOUCH_PX + 0.5 ? ' (tamanho mínimo de toque)' : ''}` : '';
    }
    $('ctl-test').textContent = this.testing ? 'Voltar a editar' : 'Testar comandos';
    $('ctl-test').classList.toggle('primary', !!this.testing);
  }

  // ---------- arraste ----------
  local(e) {
    const r = $('ctl-screen').getBoundingClientRect();
    return { x: (e.clientX - r.left) / this.k, y: (e.clientY - r.top) / this.k };
  }

  onDown(e) {
    if (this.testing) return;
    const node = e.target.closest('.t-ctl');
    if (!node) { this.sel = null; this.render(); return; }
    e.preventDefault();
    const uid = node.dataset.uid;
    const r = this.rects.find((x) => x.e.uid === uid);
    if (!r) return;
    this.sel = uid;
    const p = this.local(e);
    const resize = e.target.classList.contains('ctl-handle');
    this.drag = { id: e.pointerId, uid, resize, dx: p.x - r.cx, dy: p.y - r.cy, cx: r.cx, cy: r.cy, moved: false };
    try { $('ctl-screen').setPointerCapture(e.pointerId); } catch (err) { /* */ }
    this.render();
  }

  onMove(e) {
    const d = this.drag;
    if (!d || d.id !== e.pointerId) return;
    e.preventDefault();
    const el = this.selected();
    if (!el) return;
    const p = this.local(e);
    const { W, H, insets } = this.deviceSize();
    if (d.resize) {
      const short = Math.min(W, H);
      const px = Math.max(MIN_TOUCH_PX, Math.max(Math.abs(p.x - d.cx), Math.abs(p.y - d.cy)) * 2);
      el.size = Math.min(0.5, Math.max(0.06, px / (short * this.draft.scale)));
    } else {
      const n = pxToNorm(this.draft, W, H, insets, p.x - d.dx, p.y - d.dy);
      el[this.orient] = n;
    }
    d.moved = true;
    this.changed();
  }

  onUp(e) {
    if (this.drag && this.drag.id === e.pointerId) {
      if (this.drag.moved) this.status(this.drag.resize ? 'Tamanho ajustado.' : `Posição ajustada na orientação ${this.orient === 'land' ? 'horizontal' : 'vertical'}.`);
      this.drag = null;
    }
  }

  // ---------- teste dos comandos ----------
  toggleTest() {
    if (this.testing) { this.stopTest(); this.render(); return; }
    const scr = $('ctl-screen');
    $('ctl-ctls').innerHTML = '';
    const log = $('ctl-log');
    log.innerHTML = '';
    const write = (t) => {
      const line = document.createElement('div');
      line.textContent = t;
      log.prepend(line);
      while (log.children.length > 6) log.lastChild.remove();
    };
    const state = $('ctl-state');
    const show = (s) => { state.textContent = s; };
    let stick = [0, 0], lookN = 0;
    const sink = {
      stick(x, y) { stick = [x, y]; show(`Joystick: ${x.toFixed(2)}, ${y.toFixed(2)}`); },
      keyDown() {}, keyUp() {}, press() {},
      fire() {}, right() {}, wheel() {},
      look(dx, dy) { lookN += Math.abs(dx) + Math.abs(dy); show(`Mirando… (${Math.round(lookN)})`); },
      action(name) { write(`Ação: ${name === 'pause' ? 'pausa' : name === 'fullscreen' ? 'tela cheia' : 'chat'}`); },
      weapon: () => null,
      sprinting: () => false,
    };
    const { W, H, insets } = this.deviceSize();
    this.testing = new TouchControls(this.app, {
      container: scr,
      sink,
      getSize: () => ({ W, H, insets }),
      getLayout: () => this.draft,
      ctx: () => ({ night: true, net: true, story: true }),
      toLocal: (x, y) => this.local({ clientX: x, clientY: y }),
      onEvent: write,
    });
    this.testing.show(true);
    void stick;
    show('Toque nos botões para testar. Nada é enviado à partida.');
    this.status('Modo de teste: os comandos são registrados abaixo da tela.');
    this.renderSide();
  }

  stopTest() {
    if (!this.testing) return;
    this.testing.destroy();
    this.testing = null;
    $('ctl-state').textContent = '';
  }
}

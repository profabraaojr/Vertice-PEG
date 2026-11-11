// Ponto de entrada: renderizador, laço principal e transições entre menu e partida.
import * as THREE from 'three';
import { settings, QUALITY, saveSettings } from './settings.js';
import { TouchControls, isTouchDevice } from './touch.js';
import { setupPWA } from './pwa.js';
import { Lobby } from './lobby.js';
import { Chat } from './chat.js';
import { buildMap, MAPS } from './map.js';
import { World } from './physics.js';
import { Nav } from './nav.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { Effects } from './effects.js';
import { ViewModel } from './viewmodel.js';
import { HUD } from './hud.js';
import { Game } from './game.js';
import { Menu } from './menu.js';
import { Net } from './net.js';
import { initGunEnvironment } from './guns.js';
import { WeaponPreview } from './preview.js';
import { activeLook } from './profiles.js';

class App {
  constructor() {
    const canvas = document.getElementById('game');
    this.canvas = canvas;
    this.noLock = new URLSearchParams(location.search).has('nolock');
    // celulares e tablets: sem captura de mouse, com controles na tela
    this.touch = isTouchDevice() || new URLSearchParams(location.search).has('touch');
    if (this.touch) {
      this.noLock = true;
      document.body.classList.add('touch');
      if (!settings.touchDefaults) {
        // primeira abertura no celular: qualidade mais leve para manter a fluidez
        settings.quality = 'media';
        settings.renderScale = 0.75;
        settings.touchDefaults = true;
        saveSettings();
      }
    }
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = false;

    initGunEnvironment(this.renderer); // reflexos do metal das armas
    this.preview = new WeaponPreview(this.renderer);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(settings.fov, window.innerWidth / window.innerHeight, 0.05, 500);
    this.camera.rotation.order = 'YXZ';

    this.map = buildMap(this.scene, this.renderer, MAPS[settings.match.map] ? settings.match.map : 'ferrugem');
    this.nv = false;
    this.world = new World(this.map.boxes);
    this.nav = new Nav(this.map.walk);
    this.audio = new AudioEngine();
    this.input = new Input(canvas);
    this.effects = new Effects(this.scene);
    this.viewmodel = new ViewModel();
    this.hud = new HUD(this.map);
    this.game = new Game({
      scene: this.scene, camera: this.camera, world: this.world, nav: this.nav, map: this.map,
      audio: this.audio, input: this.input, effects: this.effects, viewmodel: this.viewmodel, hud: this.hud,
    });
    this.net = new Net();
    this.game.net = this.net;
    this.net.onMessage = (peerId, msg) => this.onNetMessage(peerId, msg);
    this.net.onPeerLost = (id, name) => {
      if (this.game.active && this.game.isHost) this.game.removePeer(id, name);
      this.lobby.peerLeft(name);
    };
    this.net.onHostLost = () => {
      this.toast('A conexão com o anfitrião foi encerrada.');
      if (this.state !== 'menu') this.quitToMenu();
      this.lobby.reset();
      if (this.menu.current === 'screen-coop') this.lobby.status('A sala foi encerrada pelo anfitrião ou a conexão caiu.', true);
    };
    this.net.onPeersChange = () => this.lobby.syncPeers();
    this.menu = new Menu(this);
    this.lobby = new Lobby(this);
    this.chat = new Chat(this);
    this.touchUI = this.touch ? new TouchControls(this) : null;
    this.state = 'menu';
    this.menuT = 0;
    this.suppressPause = false;
    this.lastConfig = null;

    this.input.onLockChange = (locked) => {
      if (locked || this.noLock) return;
      if (this.suppressPause) { this.suppressPause = false; return; }
      if (this.state === 'playing') this.pause();
    };
    // Se a captura do ponteiro for recusada (ex.: página dentro de um iframe), o jogo
    // passa a um modo alternativo: a mira segue o movimento do mouse e Esc/P pausam.
    this.input.onLockError = () => {
      if (this.noLock) return;
      this.lockFails = (this.lockFails || 0) + 1;
      if (this.lockFails >= 2 || window.self !== window.top) {
        this.noLock = true;
        this.fallbackMouse = true;
        if (this.state === 'playing') this.input.locked = true;
        this.toast('Captura do mouse indisponível: modo alternativo ativo. Use Esc ou P para pausar.');
      } else if (this.state === 'playing') {
        this.pause('O navegador recusou a captura do mouse. Aguarde um instante e clique em Continuar.');
      }
    };
    window.addEventListener('keydown', (e) => {
      if (this.fallbackMouse && this.state === 'playing' && (e.code === 'Escape' || e.code === 'KeyP')) this.pause();
    });
    this.game.onMatchEnd = (r) => this.endMatch(r);
    this.viewmodel.setLook(activeLook());

    // o áudio só pode iniciar após um gesto do usuário
    const unlock = () => {
      this.audio.init();
      this.applyAudio();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
      this.updateBackgroundTicker();
    });

    this.applySettings();
    this.last = performance.now();
    this.renderer.setAnimationLoop((t) => this.frame(t));
    window.__vertice = this; // útil para depuração no console
  }

  // Perfil ativo mudou: atualiza mangas da arma em primeira pessoa e o rótulo do menu.
  onProfileChange() {
    this.viewmodel.setLook(activeLook());
    this.menu.updateProfileLabel();
  }

  // ---------- mapas ----------
  // Troca o cenário: descarta o atual e monta o escolhido, com colisores e navegação novos.
  loadMap(id) {
    if (!MAPS[id]) id = 'ferrugem';
    if (this.map && this.map.id === id) return;
    this.setNightVision(false);
    this.game.cleanup();
    this.effects.clear();
    this.map.dispose();
    this.map = buildMap(this.scene, this.renderer, id);
    this.world = new World(this.map.boxes);
    this.nav = new Nav(this.map.walk);
    this.game.map = this.map;
    this.game.world = this.world;
    this.game.nav = this.nav;
    this.hud.map = this.map;
    this.applySettings();
  }

  // Óculos de visão noturna (só no mapa noturno): amplificam a pouca luz e tingem a imagem de verde.
  setNightVision(on) {
    on = !!on && !!this.map.night;
    if (this.nv === on) return;
    this.nv = on;
    document.getElementById('app').classList.toggle('nv', on);
    this.map.hemi.intensity = this.map.baseHemi * (on ? 3 : 1);
    this.hud.setNightVision(on, this.map.night);
    if (this.audio.ctx) {
      this.audio.beep(on ? 1400 : 700, 0.08, 0.1);
      if (on) setTimeout(() => this.audio.beep(2100, 0.25, 0.06), 90);
    }
  }

  // ---------- configurações ----------
  applySettings() {
    const q = QUALITY[settings.quality] || QUALITY.alta;
    const r = this.renderer;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, q.pixelRatio) * settings.renderScale;
    r.setPixelRatio(this.pixelRatio);
    if (r.shadowMap.enabled !== q.shadows) {
      r.shadowMap.enabled = q.shadows;
      this.scene.traverse((o) => {
        if (!o.material) return;
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; });
      });
    }
    const sun = this.map.sun;
    sun.castShadow = q.shadows;
    if (sun.shadow.mapSize.x !== q.shadowSize) {
      sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    this.map.interiorLights.forEach((l) => { l.visible = q.lights; });
    this.effects.density = q.particles;
    if (!this.game.active) this.game.currentFov = settings.fov;
    this.hud.applySettings();
    this.applyAudio();
    this.resize();
  }

  applyAudio() {
    this.audio.setVolumes(settings.master, settings.sfx, settings.music);
    // no menu as seções se revezam sozinhas; na partida o jogo dita a intensidade
    if (this.state !== 'playing' && this.state !== 'paused') this.audio.setMusicIntensity(null);
    if (!this.audio.ctx) return;
    const wantMusic = settings.music > 0 && (this.state !== 'playing' || settings.musicInGame);
    if (wantMusic) this.audio.startMusic(); else this.audio.stopMusic();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.viewmodel.setAspect(w / h);
    this.game.renderHeight = h * this.pixelRatio;
    this.effects.setScale(h * this.pixelRatio, this.camera.fov);
  }

  toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this.toastId);
    this.toastId = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ---------- simulação com a aba oculta ----------
  // O navegador congela requestAnimationFrame em abas ocultas. Em cooperativo isso pararia
  // a partida de todos, então um Web Worker (cujos temporizadores não são congelados)
  // passa a ditar o ritmo da simulação enquanto a aba estiver em segundo plano.
  updateBackgroundTicker() {
    const want = document.hidden && this.net.active && this.game.active && this.game.coop;
    if (want && !this.bgOn) {
      this.bgOn = true;
      this.bgLast = performance.now();
      try {
        if (!this.bgWorker) {
          const src = 'let id=null;onmessage=(e)=>{clearInterval(id);if(e.data>0)id=setInterval(()=>postMessage(0),e.data);};';
          this.bgWorker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
          this.bgWorker.onmessage = () => this.backgroundTick();
        }
        this.bgWorker.postMessage(33);
      } catch (e) {
        this.bgWorker = null;
        this.bgInterval = setInterval(() => this.backgroundTick(), 33);
      }
    } else if (!want && this.bgOn) {
      this.bgOn = false;
      if (this.bgWorker) this.bgWorker.postMessage(0);
      if (this.bgInterval) { clearInterval(this.bgInterval); this.bgInterval = null; }
      this.last = performance.now();
    }
  }

  backgroundTick() {
    if (!this.bgOn || !this.game.active || !this.game.coop) return;
    const now = performance.now();
    let dt = Math.min(1, (now - this.bgLast) / 1000);
    this.bgLast = now;
    this.game.inputBlocked = true;
    while (dt > 0.0001) { const step = Math.min(0.05, dt); this.game.update(step); dt -= step; }
  }

  // ---------- rede ----------
  onNetMessage(peerId, msg) {
    if (this.net.role === 'host') {
      if (this.lobby.isLobbyMsg(msg.t)) this.lobby.hostHandle(peerId, msg);
      else if (this.game.active && this.game.coop) this.game.hostHandle(peerId, msg);
      return;
    }
    if (msg.t === 'lobby') this.lobby.onLobby(msg);
    else if (msg.t === 'chat') this.lobby.onChat(msg);
    else if (msg.t === 'full') this.lobby.onFull();
    else if (msg.t === 'start') this.startCoopClient(msg);
    else if (msg.t === 'bye') this.net.lost(0);
    else if (this.game.active && this.game.isClient) this.game.clientHandle(msg);
  }

  startCoopClient(msg) {
    this.audio.init();
    this.lastConfig = null;
    this.menu.hideAll();
    this.loadMap(msg.config.map || 'ferrugem');
    this.setNightVision(false);
    this.game.startClient(msg);
    this.hud.setNightVision(false, this.map.night);
    if (this.map.night) this.toast('Mapa noturno: pressione X para ligar os óculos de visão noturna.');
    this.updateBackgroundTicker();
    this.input.enabled = true;
    this.state = 'playing';
    this.applyAudio();
    // sem um clique do jogador o navegador não libera a captura do mouse
    if (this.noLock) this.lockPointer();
    else this.pause('A partida começou! Clique em Continuar para entrar.');
  }

  // ---------- tela cheia ----------
  // Precisa partir de um toque ou clique; no iPhone o Safari não oferece tela cheia para páginas
  // (o app instalado na Tela de Início já abre em tela cheia).
  enterFullscreen() {
    const doc = document;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) return;
    const el = doc.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return;
    const lock = () => {
      try {
        const o = screen.orientation;
        if (o && o.lock) o.lock('landscape').catch(() => {});
      } catch (e) { /* orientação livre */ }
    };
    try {
      const p = req.call(el, { navigationUI: 'hide' });
      if (p && p.then) p.then(lock).catch(() => {}); else lock();
    } catch (e) { /* navegador recusou */ }
  }

  toggleFullscreen() {
    const doc = document;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
      if (exit) try { exit.call(doc); } catch (e) { /* já saiu */ }
    } else this.enterFullscreen();
  }

  // ---------- transições ----------
  lockPointer() {
    if (this.touchUI) { this.touchUI.show(true); this.enterFullscreen(); }
    if (this.noLock) { this.input.locked = true; return; }
    this.input.requestLock();
  }

  releasePointer() {
    if (this.touchUI) this.touchUI.show(false);
    if (this.noLock) { this.input.locked = false; return; }
    if (document.pointerLockElement) {
      this.suppressPause = true;
      this.input.exitLock();
    }
  }

  startMatch(cfg) {
    this.audio.init();
    this.lastConfig = { ...cfg };
    this.menu.hideAll();
    this.loadMap(cfg.map || 'ferrugem');
    this.setNightVision(false);
    this.game.start(cfg);
    this.state = 'playing';
    this.hud.setNightVision(false, this.map.night);
    if (this.map.night) this.toast('Mapa noturno: pressione X para ligar os óculos de visão noturna.');
    this.updateBackgroundTicker();
    this.input.enabled = true;
    this.applyAudio();
    this.lockPointer();
  }

  pause(note) {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.game.paused = true;
    this.input.enabled = false;
    this.releasePointer();
    this.menu.showPause(note);
    this.applyAudio();
  }

  resume() {
    if (!this.game.active) return;
    this.menu.hideAll();
    this.state = 'playing';
    this.game.paused = false;
    this.input.enabled = true;
    this.applyAudio();
    this.lockPointer();
  }

  openIngameLoadout() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.game.paused = true;
    this.input.enabled = false;
    this.releasePointer();
    this.menu.openLoadout('ingame');
  }

  // Multijogador: depois da partida, todos voltam para a sala sem desconectar.
  backToRoom() {
    this.setNightVision(false);
    this.game.cleanup();
    this.effects.clear();
    this.hud.show(false);
    this.state = 'menu';
    this.input.enabled = false;
    this.releasePointer();
    this.menu.reset('screen-coop');
    this.lobby.matchOver();
    this.lobby.open();
    this.applyAudio();
  }

  restart() {
    if (this.net.active && this.state === 'ended') { this.backToRoom(); return; }
    if (this.net.role === 'guest') { this.backToRoom(); return; }
    if (this.lastConfig) this.startMatch(this.lastConfig);
  }

  quitToMenu() {
    if (this.net.active) this.net.close();
    if (this.lobby) this.lobby.reset();
    this.setNightVision(false);
    this.game.cleanup();
    this.effects.clear();
    this.hud.show(false);
    this.state = 'menu';
    this.input.enabled = false;
    this.releasePointer();
    this.menu.reset('screen-main');
    this.applyAudio();
  }

  endMatch(r) {
    if (this.net.active) this.lobby.matchOver();
    this.state = 'ended';
    this.input.enabled = false;
    this.releasePointer();
    this.hud.show(false);
    this.menu.showEnd(r);
    this.applyAudio();
  }

  // ---------- laço ----------
  frame(now) {
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;

    document.body.classList.toggle('ingame', this.state === 'playing');
    if (this.state === 'playing') {
      if (this.touchUI && this.game.active) this.touchUI.sync(this.game);
      this.game.inputBlocked = false;
      if (this.input.justPressed('KeyX') && this.map.night && this.game.player && this.game.player.alive) this.setNightVision(!this.nv);
      if (this.net.active && !this.chat.isOpen && (this.input.justPressed('Enter') || this.input.justPressed('KeyT'))) { this.chat.open(); this.input.keys.clear(); }
      if (this.input.justPressed('KeyB')) this.openIngameLoadout();
      else this.game.update(dt);
    } else if (this.state === 'paused' && this.game.active && this.game.coop) {
      // cooperativo: a partida segue enquanto o menu está aberto
      this.game.inputBlocked = true;
      this.game.update(dt);
    } else if (this.state === 'menu' || this.state === 'ended') {
      this.menuT += dt;
      const a = this.menuT * 0.045 + 0.6;
      this.camera.position.set(Math.cos(a) * 30, 15 + Math.sin(this.menuT * 0.2) * 2, Math.sin(a) * 30);
      this.camera.lookAt(0, 1.5, 0);
      if (this.camera.fov !== settings.fov) { this.camera.fov = settings.fov; this.camera.updateProjectionMatrix(); }
      this.effects.update(dt);
    }

    if (this.menu.current === 'screen-loadout') this.menu.tickPreview(dt);
    if (this.menu.current === 'screen-profile') this.menu.tickProfile(dt);

    const r = this.renderer;
    r.clear();
    r.toneMappingExposure = this.map.exposure * (this.nv ? 4.5 : 1);
    r.render(this.scene, this.camera);
    const inGame = (this.state === 'playing' || this.state === 'paused') && this.game.active && this.game.player && this.game.player.alive;
    if (inGame) {
      r.clearDepth();
      r.toneMappingExposure = this.map.vmLight * (this.nv ? 5 : 1); // a arma acompanha a luz do mapa
      r.render(this.viewmodel.scene, this.viewmodel.camera);
    }
    this.input.endFrame();

    if (!this.loaded) {
      this.loaded = true;
      document.getElementById('loading').classList.add('done');
    }
  }
}

setupPWA();

try {
  new App();
} catch (e) {
  console.error(e);
  const l = document.getElementById('loading');
  if (l) l.querySelector('p').textContent = `Falha ao iniciar o WebGL: ${e.message}`;
}

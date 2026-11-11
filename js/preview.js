// Prévia 3D das armas no arsenal. Usa o renderizador principal para desenhar numa textura
// e copia o resultado para um canvas comum da interface.
import * as THREE from 'three';
import { buildGun, gunEnvironment } from './guns.js';
import { CharacterModel } from './models.js';

export class WeaponPreview {
  constructor(renderer) {
    this.r = renderer;
    this.scene = new THREE.Scene();
    this.scene.environment = gunEnvironment();
    this.scene.add(new THREE.HemisphereLight(0xe8eef8, 0x4a4038, 0.45));
    const key = new THREE.DirectionalLight(0xfff0dc, 1.9);
    key.position.set(2, 3, 2.5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fc4ff, 1.2);
    rim.position.set(-2.5, 1, -2);
    this.scene.add(rim);
    this.cam = new THREE.PerspectiveCamera(24, 2, 0.05, 20);
    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);
    this.models = new Map();
    this.rt = null;
    this.buf = null;
    this.current = null;
  }

  modelFor(def) {
    if (this.models.has(def.id)) return this.models.get(def.id);
    const gun = buildGun(def);
    const box = new THREE.Box3().setFromObject(gun.group);
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    gun.group.position.sub(c);
    const wrap = new THREE.Group();
    wrap.add(gun.group);
    wrap.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
    const entry = { wrap, size };
    this.models.set(def.id, entry);
    return entry;
  }

  // Personagem com a aparência do perfil. close = enquadra só a cabeça.
  renderCharacter(look, color, canvas, yaw = 0, close = false) {
    const key = `char|${JSON.stringify(look)}|${color}`;
    let entry = this.models.get(key);
    if (!entry) {
      for (const [k, v] of this.models) if (k.startsWith('char|')) { this.models.delete(k); if (this.current === v) { this.pivot.remove(v.wrap); this.current = null; } }
      const ch = new CharacterModel(color, look);
      ch.update(0, { pos: new THREE.Vector3(), yaw: 0, pitch: 0, alive: true, vel: new THREE.Vector3(), crouchT: 0 });
      const wrap = new THREE.Group();
      ch.root.rotation.y = -Math.PI / 2; // de frente para a câmera
      wrap.add(ch.root);
      wrap.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
      entry = { wrap, size: new THREE.Vector3(0.7, 1.9, 0.7), char: true, model: ch };
      this.models.set(key, entry);
    }
    this.draw(entry, canvas, yaw, close ? { y: 1.6, h: 0.42, pitch: 0.05 } : { y: 0.95, h: 2.05, pitch: 0.1 });
  }

  // Desenha a arma no canvas de destino. yaw = 0 mostra o lado direito, cano para a direita.
  render(def, canvas, yaw = 0, pitch = 0.12) {
    this.draw(this.modelFor(def), canvas, yaw, null, pitch);
  }

  draw(m, canvas, yaw, frame, pitch = 0.12) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(16, Math.round((canvas.clientWidth || 160) * dpr));
    const H = Math.max(16, Math.round((canvas.clientHeight || 60) * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    if (!this.rt || this.rt.width !== W || this.rt.height !== H) {
      if (this.rt) this.rt.dispose();
      this.rt = new THREE.WebGLRenderTarget(W, H, { depthBuffer: true });
      // marca como alvo de saída final para receber espaço de cor sRGB e mapeamento de tons
      this.rt.isXRRenderTarget = true;
      this.rt.texture.colorSpace = THREE.SRGBColorSpace;
      this.buf = new Uint8Array(W * H * 4);
    }
    if (this.current !== m) {
      if (this.current) this.pivot.remove(this.current.wrap);
      this.pivot.add(m.wrap);
      this.current = m;
    }
    this.pivot.rotation.set(0, yaw, 0);
    // enquadra pelo maior entre largura e altura aparentes
    const aspect = W / H;
    const vf = (this.cam.fov * Math.PI) / 360;
    this.cam.aspect = aspect;
    if (frame) {
      const d = (frame.h * 0.5) / Math.tan(vf) * 1.08;
      this.cam.position.set(d * Math.cos(frame.pitch), frame.y + d * Math.sin(frame.pitch), 0);
      this.cam.lookAt(0, frame.y, 0);
    } else {
      const len = Math.abs(Math.cos(yaw)) * m.size.z + Math.abs(Math.sin(yaw)) * m.size.x;
      const dW = (len * 0.5) / (Math.tan(vf) * aspect);
      const dH = (m.size.y * 0.5) / Math.tan(vf);
      const d = Math.max(dW, dH) * 1.12 + 0.12 + m.size.x * 0.6;
      this.cam.position.set(d * Math.cos(pitch), d * Math.sin(pitch), 0);
      this.cam.lookAt(0, 0, 0);
    }
    this.cam.updateProjectionMatrix();

    const r = this.r;
    const prevTarget = r.getRenderTarget();
    const prevAlpha = r.getClearAlpha();
    const prevColor = r.getClearColor(new THREE.Color());
    const prevExp = r.toneMappingExposure;
    r.toneMappingExposure = 1;
    r.setRenderTarget(this.rt);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(this.scene, this.cam);
    r.readRenderTargetPixels(this.rt, 0, 0, W, H, this.buf);
    r.setRenderTarget(prevTarget);
    r.toneMappingExposure = prevExp;
    r.setClearColor(prevColor, prevAlpha);

    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(W, H);
    const row = W * 4;
    for (let y = 0; y < H; y++) img.data.set(this.buf.subarray((H - 1 - y) * row, (H - y) * row), y * row);
    ctx.putImageData(img, 0, 0);
  }
}

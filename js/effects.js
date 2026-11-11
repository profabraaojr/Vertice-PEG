// Efeitos de mundo: partículas, traçantes, marcas de bala e clarões dos bots.
import * as THREE from 'three';
import { bulletHole, muzzleFlash } from './textures.js';
import { rand } from './utils.js';

const MAX_P = 900;

class Particles {
  constructor(scene, blending) {
    this.count = MAX_P;
    this.pos = new Float32Array(MAX_P * 3);
    this.col = new Float32Array(MAX_P * 4);
    this.size = new Float32Array(MAX_P);
    this.vel = new Float32Array(MAX_P * 3);
    this.life = new Float32Array(MAX_P);
    this.max = new Float32Array(MAX_P);
    this.grav = new Float32Array(MAX_P);
    this.drag = new Float32Array(MAX_P);
    this.grow = new Float32Array(MAX_P);
    this.alpha0 = new Float32Array(MAX_P);
    this.next = 0;
    const g = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.posAttr);
    g.setAttribute('pcolor', this.colAttr);
    g.setAttribute('psize', this.sizeAttr);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending,
      uniforms: { uScale: { value: 500 } },
      vertexShader: `attribute vec4 pcolor; attribute float psize; uniform float uScale; varying vec4 vColor;
        void main(){ vColor = pcolor; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = psize * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec4 vColor; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c);
        if (d > 0.5) discard; float a = vColor.a * smoothstep(0.5, 0.15, d); gl_FragColor = vec4(vColor.rgb, a); }`,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  emit(x, y, z, vx, vy, vz, life, size, r, g, b, a, grav = 0, drag = 0, grow = 0) {
    const i = this.next;
    this.next = (this.next + 1) % MAX_P;
    const i3 = i * 3, i4 = i * 4;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.col[i4] = r; this.col[i4 + 1] = g; this.col[i4 + 2] = b; this.col[i4 + 3] = a;
    this.alpha0[i] = a;
    this.size[i] = size;
    this.life[i] = life; this.max[i] = life;
    this.grav[i] = grav; this.drag[i] = drag; this.grow[i] = grow;
  }

  update(dt) {
    for (let i = 0; i < MAX_P; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const i3 = i * 3;
      if (this.life[i] <= 0) {
        this.col[i * 4 + 3] = 0;
        this.size[i] = 0;
        continue;
      }
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i3] *= dr; this.vel[i3 + 1] = this.vel[i3 + 1] * dr - this.grav[i] * dt; this.vel[i3 + 2] *= dr;
      this.pos[i3] += this.vel[i3] * dt; this.pos[i3 + 1] += this.vel[i3 + 1] * dt; this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.pos[i3 + 1] < 0.01) { this.pos[i3 + 1] = 0.01; this.vel[i3 + 1] *= -0.3; }
      this.size[i] += this.grow[i] * dt;
      this.col[i * 4 + 3] = this.alpha0[i] * (this.life[i] / this.max[i]);
    }
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
  }
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.density = 1;
    this.soft = new Particles(scene, THREE.NormalBlending);
    this.glow = new Particles(scene, THREE.AdditiveBlending);

    // traçantes
    const tg = new THREE.BoxGeometry(0.018, 0.018, 1);
    tg.translate(0, 0, -0.5);
    this.tracers = [];
    for (let i = 0; i < 48; i++) {
      const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      m.visible = false;
      m.frustumCulled = false;
      scene.add(m);
      this.tracers.push({ mesh: m, active: false, o: new THREE.Vector3(), d: new THREE.Vector3(), dist: 0, head: 0, len: 4 });
    }
    this.tIdx = 0;

    // marcas de bala
    this.maxDecals = 160;
    const dg = new THREE.PlaneGeometry(0.13, 0.13);
    const dm = new THREE.MeshStandardMaterial({ map: bulletHole(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 1 });
    this.decals = new THREE.InstancedMesh(dg, dm, this.maxDecals);
    this.decals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.maxDecals; i++) this.decals.setMatrixAt(i, zero);
    this.decals.frustumCulled = false;
    scene.add(this.decals);
    this.dIdx = 0;

    // clarões de disparo no mundo
    const fm = new THREE.SpriteMaterial({ map: muzzleFlash(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: 0xffcf8a, fog: false });
    this.flashMat = fm;
    this.beamFlashMat = fm.clone();
    this.beamFlashMat.color.setHex(0x8ff6ff);
    this.flashes = [];
    for (let i = 0; i < 16; i++) {
      const s = new THREE.Sprite(fm);
      s.visible = false;
      scene.add(s);
      this.flashes.push({ s, t: 0 });
    }
    this.fIdx = 0;
    // luzes de clarão fixas na cena (mudar a contagem de luzes forçaria recompilar shaders)
    this.lights = [];
    for (let i = 0; i < 2; i++) {
      const l = new THREE.PointLight(0xffb060, 0, 9, 2);
      scene.add(l);
      this.lights.push({ l, t: 0 });
    }
    this.lIdx = 0;

    // feixes de energia (núcleo claro + halo)
    const bg = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
    bg.rotateX(Math.PI / 2);
    this.beams = [];
    for (let i = 0; i < 24; i++) {
      const core = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: 0x7ff0ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      const halo = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: 0x0090ff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      for (const m of [core, halo]) { m.visible = false; m.frustumCulled = false; scene.add(m); }
      this.beams.push({ core, halo, t: 0, life: 0.14 });
    }
    this.bIdx = 0;

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
    this._z = new THREE.Vector3(0, 0, 1);
  }

  setScale(height, fov) {
    const s = height / (2 * Math.tan((fov * Math.PI) / 360));
    this.soft.material.uniforms.uScale.value = s;
    this.glow.material.uniforms.uScale.value = s;
  }

  clear() {
    for (const t of this.tracers) { t.active = false; t.mesh.visible = false; }
    for (const b of this.beams) { b.t = 0; b.core.visible = b.halo.visible = false; }
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.maxDecals; i++) this.decals.setMatrixAt(i, zero);
    this.decals.instanceMatrix.needsUpdate = true;
    for (const p of [this.soft, this.glow]) { p.life.fill(0); p.size.fill(0); }
  }

  tracer(o, end, speed = 260) {
    const t = this.tracers[this.tIdx];
    this.tIdx = (this.tIdx + 1) % this.tracers.length;
    t.o.copy(o);
    t.d.subVectors(end, o);
    t.dist = t.d.length();
    if (t.dist < 1) return;
    t.d.divideScalar(t.dist);
    t.head = Math.min(2, t.dist);
    t.len = Math.min(5, t.dist * 0.5);
    t.speed = speed;
    t.active = true;
    t.mesh.visible = true;
  }

  decal(p, n) {
    this._v.set(p.x + n.x * 0.01, p.y + n.y * 0.01, p.z + n.z * 0.01);
    this._q.setFromUnitVectors(this._z, n);
    const r = new THREE.Quaternion().setFromAxisAngle(n, Math.random() * 6.28);
    this._q.premultiply(r);
    const sc = 0.7 + Math.random() * 0.6;
    this._s.set(sc, sc, sc);
    this._m.compose(this._v, this._q, this._s);
    this.decals.setMatrixAt(this.dIdx, this._m);
    this.dIdx = (this.dIdx + 1) % this.maxDecals;
    this.decals.instanceMatrix.needsUpdate = true;
  }

  impact(p, n, mat) {
    const k = this.density;
    const dust = mat === 'wood' ? [0.45, 0.33, 0.2] : mat === 'metal' ? [0.5, 0.5, 0.52] : [0.62, 0.56, 0.47];
    const nd = Math.round(7 * k);
    for (let i = 0; i < nd; i++) {
      this.soft.emit(p.x, p.y, p.z,
        n.x * rand(0.5, 2) + rand(-0.8, 0.8), n.y * rand(0.5, 2) + rand(0.2, 1.2), n.z * rand(0.5, 2) + rand(-0.8, 0.8),
        rand(0.4, 0.9), rand(0.05, 0.12), dust[0], dust[1], dust[2], 0.55, 1.5, 2.5, 0.25);
    }
    const ns = Math.round((mat === 'metal' ? 9 : 4) * k);
    for (let i = 0; i < ns; i++) {
      this.glow.emit(p.x, p.y, p.z,
        n.x * rand(2, 6) + rand(-2.5, 2.5), n.y * rand(2, 6) + rand(0, 3), n.z * rand(2, 6) + rand(-2.5, 2.5),
        rand(0.12, 0.3), rand(0.018, 0.035), 1, 0.7, 0.3, 1, 9, 0.5);
    }
    this.decal(p, n);
  }

  blood(p, dir, head = false) {
    const n = Math.round((head ? 16 : 9) * this.density);
    for (let i = 0; i < n; i++) {
      this.soft.emit(p.x, p.y, p.z,
        dir.x * rand(0.5, 2.5) + rand(-1, 1), dir.y * rand(0.5, 2) + rand(-0.4, 1.4), dir.z * rand(0.5, 2.5) + rand(-1, 1),
        rand(0.3, 0.7), rand(0.05, 0.1), 0.55, 0.05, 0.05, 0.85, 7, 1.5, 0.08);
    }
  }

  beam(o, end) {
    const b = this.beams[this.bIdx];
    this.bIdx = (this.bIdx + 1) % this.beams.length;
    const len = o.distanceTo(end);
    if (len < 0.2) return;
    for (const m of [b.core, b.halo]) {
      m.position.copy(o).lerp(end, 0.5);
      m.lookAt(end);
      m.visible = true;
    }
    b.len = len;
    b.t = b.life;
    this.updateBeam(b);
  }

  updateBeam(b) {
    const k = b.t / b.life;
    b.core.scale.set(0.018 + 0.014 * k, 0.018 + 0.014 * k, b.len);
    b.halo.scale.set(0.085 * (0.4 + k), 0.085 * (0.4 + k), b.len);
    b.core.material.opacity = k;
    b.halo.material.opacity = 0.6 * k;
  }

  energyImpact(p, n) {
    const k = this.density;
    for (let i = 0; i < Math.round(12 * k); i++) {
      this.glow.emit(p.x, p.y, p.z,
        n.x * rand(1, 4) + rand(-2, 2), n.y * rand(1, 4) + rand(-1, 2.5), n.z * rand(1, 4) + rand(-2, 2),
        rand(0.15, 0.4), rand(0.02, 0.05), 0.35, 0.95, 1, 1, 4, 1.5);
    }
    this.glow.emit(p.x, p.y, p.z, 0, 0, 0, 0.12, 0.35, 0.5, 0.95, 1, 0.9, 0, 0, -1);
    this.soft.emit(p.x, p.y, p.z, n.x * 0.4, 0.5, n.z * 0.4, 0.8, 0.12, 0.25, 0.25, 0.28, 0.4, -0.3, 1, 0.4);
    this.decal(p, n);
  }

  energyHit(p, dir) {
    for (let i = 0; i < Math.round(10 * this.density); i++) {
      this.glow.emit(p.x, p.y, p.z, dir.x * rand(0.5, 2) + rand(-1.5, 1.5), rand(-0.5, 2), dir.z * rand(0.5, 2) + rand(-1.5, 1.5),
        rand(0.15, 0.35), rand(0.03, 0.06), 0.5, 1, 1, 1, 2, 2);
    }
    this.blood(p, dir, false);
  }

  // rastro luminoso de um corte de espada
  slash(p, dir) {
    const rx = -dir.z, rz = dir.x;
    for (let i = 0; i < 14; i++) {
      const t = (i / 13 - 0.5) * 0.9;
      this.glow.emit(p.x + rx * t, p.y + t * 0.5, p.z + rz * t, dir.x * 0.5, 0.1, dir.z * 0.5,
        0.18, 0.06, 1, 0.95, 0.9, 0.9, 0, 3);
    }
  }

  muzzle(p, dir, beam = false) {
    const f = this.flashes[this.fIdx];
    this.fIdx = (this.fIdx + 1) % this.flashes.length;
    f.s.position.copy(p);
    f.s.scale.setScalar(rand(0.35, 0.55));
    f.s.material.rotation = Math.random() * 6;
    f.s.visible = true;
    f.t = 0.05;
    const l = this.lights[this.lIdx];
    this.lIdx = (this.lIdx + 1) % this.lights.length;
    l.l.position.copy(p);
    l.l.color.setHex(beam ? 0x40d8ff : 0xffb060);
    l.l.intensity = 8;
    l.t = 0.05;
    f.s.material = beam ? this.beamFlashMat : this.flashMat;
    this.soft.emit(p.x, p.y, p.z, dir.x * 0.6, dir.y * 0.6 + 0.3, dir.z * 0.6, 0.6, 0.1, 0.7, 0.7, 0.7, 0.18, -0.4, 1, 0.5);
  }

  playerMuzzleLight(p, beam = false) {
    const l = this.lights[this.lIdx];
    this.lIdx = (this.lIdx + 1) % this.lights.length;
    l.l.color.setHex(beam ? 0x40d8ff : 0xffb060);
    l.l.position.copy(p);
    l.l.intensity = 6;
    l.t = 0.04;
  }

  update(dt) {
    this.soft.update(dt);
    this.glow.update(dt);
    for (const t of this.tracers) {
      if (!t.active) continue;
      t.head += t.speed * dt;
      const tail = t.head - t.len;
      if (tail >= t.dist) { t.active = false; t.mesh.visible = false; continue; }
      const h = Math.min(t.head, t.dist);
      const ta = Math.max(0, tail);
      const m = t.mesh;
      m.position.copy(t.o).addScaledVector(t.d, h);
      this._v.copy(m.position).sub(t.d);
      m.lookAt(this._v.x, this._v.y, this._v.z);
      m.rotateY(Math.PI);
      m.scale.set(1, 1, Math.max(0.01, h - ta));
    }
    for (const b of this.beams) {
      if (b.t <= 0) continue;
      b.t -= dt;
      if (b.t <= 0) { b.core.visible = b.halo.visible = false; continue; }
      this.updateBeam(b);
    }
    for (const f of this.flashes) {
      if (f.t > 0) { f.t -= dt; if (f.t <= 0) f.s.visible = false; }
    }
    for (const l of this.lights) {
      if (l.t > 0) { l.t -= dt; if (l.t <= 0) l.l.intensity = 0; }
    }
  }
}

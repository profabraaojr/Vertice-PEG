// Visão telescópica: ocular com sombra de borda, retículo de precisão e transição suave.
//
// Como nas lunetas táticas de segundo plano focal (por exemplo, a usada no M82), o retículo é
// calibrado na ampliação máxima: nela, 1 mil (milirradiano) na tela corresponde exatamente a
// 1 mil no mundo, e os pontos servem para compensar a queda do projétil e o desvio do vento.
// O retículo mantém o mesmo tamanho em qualquer ampliação e fica sempre no centro da tela;
// só a sombra da ocular acompanha levemente o movimento.

const RETICLES = {
  // mil-dot: padrão das lunetas táticas usadas no M82 e em rifles de longo alcance
  mildot(ctx, cx, cy, mil, R, ink) {
    const thin = Math.max(1.2, mil * 0.04);
    const post = Math.max(3.5, mil * 0.34);
    ctx.fillStyle = ink;
    // linhas finas até 5 mils, postes grossos dali até a borda
    ctx.fillRect(cx - 5 * mil, cy - thin / 2, 10 * mil, thin);
    ctx.fillRect(cx - thin / 2, cy - 5 * mil, thin, 10 * mil);
    ctx.fillRect(cx - R, cy - post / 2, R - 5 * mil, post);
    ctx.fillRect(cx + 5 * mil, cy - post / 2, R - 5 * mil, post);
    ctx.fillRect(cx - post / 2, cy + 5 * mil, post, R - 5 * mil);
    ctx.fillRect(cx - post / 2, cy - R, post, R - 5 * mil);
    // pontos a cada 1 mil (diâmetro de 0,25 mil)
    const dot = Math.max(2, mil * 0.125);
    for (let i = -4; i <= 4; i++) {
      if (!i) continue;
      for (const [x, y] of [[cx + i * mil, cy], [cx, cy + i * mil]]) {
        ctx.beginPath();
        ctx.ellipse(x, y, dot * (y === cy ? 0.8 : 1), dot * (y === cy ? 1 : 0.8), 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
};

export class ScopeView {
  constructor() {
    const root = document.createElement('div');
    root.id = 'scope2';
    root.className = 'hidden';
    root.innerHTML = '<canvas></canvas><div class="sc-tunnel"></div><div class="sc-lens"></div><div class="sc-mag"></div>';
    document.getElementById('hud').appendChild(root);
    this.root = root;
    this.canvas = root.querySelector('canvas');
    this.tunnel = root.querySelector('.sc-tunnel');
    this.mag = root.querySelector('.sc-mag');
    this.key = '';
    this.shift = { x: 0, y: 0 };
  }

  // t: progresso da transição (0 = visão normal, 1 = luneta plena); fov em graus (vertical)
  update(t, fov, baseFov, def, mdx, mdy, dt) {
    const on = t > 0.02;
    this.root.classList.toggle('hidden', !on);
    document.body.classList.toggle('scoped', t > 0.6);
    if (!on) return;
    const W = window.innerWidth, H = window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // fechamento do túnel (aproximação do olho) e revelação da imagem ampliada
    const reveal = Math.min(1, Math.max(0, (t - 0.45) / 0.45));
    this.root.style.setProperty('--tunnel', String(Math.min(1, t / 0.5)));
    this.root.style.setProperty('--reveal', String(reveal));
    // sombra da ocular: desloca-se um pouco com o movimento rápido e volta ao centro
    const k = Math.min(1, dt * 7);
    this.shift.x += (Math.max(-1, Math.min(1, -mdx * 0.02)) * 0.9 - this.shift.x) * k;
    this.shift.y += (Math.max(-1, Math.min(1, -mdy * 0.02)) * 0.9 - this.shift.y) * k;
    const R = Math.min(W, H) * 0.47;
    this.root.style.setProperty('--r', `${R}px`);
    this.root.style.setProperty('--sx', `${this.shift.x * R * 0.06}px`);
    this.root.style.setProperty('--sy', `${this.shift.y * R * 0.06}px`);
    this.mag.textContent = `${(baseFov / fov).toFixed(1).replace('.0', '')}×`;
    // retículo redesenhado só quando muda a ampliação ou o tamanho da tela
    const calib = Math.min(...(def.zoom || [fov]));
    const key = `${W}x${H}@${calib}:${def.id}`;
    if (key === this.key) return;
    this.key = key;
    const c = this.canvas;
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    c.style.width = `${W}px`;
    c.style.height = `${H}px`;
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const pxPerRad = (H / 2) / Math.tan((calib * Math.PI) / 360);
    const mil = pxPerRad * 0.001;
    const cx = W / 2, cy = H / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();
    const draw = RETICLES[def.reticle] || RETICLES.mildot;
    // contorno claro sutil para o retículo continuar legível sobre fundos escuros
    ctx.globalAlpha = 0.18;
    ctx.translate(0.6, 0.6);
    draw(ctx, cx, cy, mil, R, '#d8d4c4');
    ctx.translate(-0.6, -0.6);
    ctx.globalAlpha = 1;
    draw(ctx, cx, cy, mil, R, '#0b0c0d');
    ctx.restore();
  }
}

export { RETICLES };

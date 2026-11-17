// Rifles de precisão adicionais, modelados por código com o mesmo kit das demais armas
// (perfis laterais extrudados, tubos e peças de detalhe). Convenção: u = para a frente,
// y = para cima, origem no topo do punho. Cada modelo devolve as partes animadas (carregador,
// ferrolho ou manopla de manejo, coronha) e a altura do eixo da luneta (sightY).
import { gunMat as mat, railPts, triggerGuard } from './guns.js';

export const RIFLE_TYPES = new Set(['m82', 'svd', 'spectre', 'lr50']);

// luneta genérica: tubo de 30/34 mm, sino da objetiva, ocular, torres e lentes
function bigScope(k, o) {
  const { u0, u1, y, tube = 0.0155, obj = 0.03, objLen = 0.075, eye = 0.019, x = 0 } = o;
  const body = mat('gunmetal', o.color || 0x1d1f22);
  const grip = mat('rubber', 0x141516);
  const glass = mat('glass', 0x16324a);
  const objStart = u1 - objLen;
  k.tube(tube, u0 + 0.05, objStart - 0.04, y, body, { seg: 24, x });
  k.tube(tube, objStart - 0.04, objStart, y, body, { r2: obj, seg: 28, x });
  k.tube(obj, objStart, u1, y, body, { seg: 28, x });
  k.tube(tube, u0 + 0.015, u0 + 0.05, y, body, { r2: tube, seg: 24, x });
  k.tube(eye, u0 - 0.025, u0 + 0.015, y, body, { r2: tube, seg: 24, x });
  k.tube(eye + 0.0015, u0 - 0.04, u0 - 0.025, y, grip, { seg: 24, x });
  k.disc(obj - 0.003, u1 + 0.0005, y, glass, { x, seg: 28 });
  k.disc(eye - 0.004, u0 - 0.0405, y, glass, { back: true, x, seg: 24 });
  // torres de elevação (topo) e deriva (direita), com anel de ajuste grafado
  const tu = o.turret ?? (u0 + (objStart - u0) * 0.45);
  const tr = o.turretR || 0.013;
  k.cylY(tr, 0.026, x, y + tube + 0.013, tu, body);
  k.cylY(tr + 0.001, 0.008, x, y + tube + 0.03, tu, mat('steel', 0x3a3d42));
  k.cylX(tr, 0.026, x + tube + 0.013, y, tu, body);
  k.cylX(tr + 0.001, 0.008, x + tube + 0.03, y, tu, mat('steel', 0x3a3d42));
  if (o.parallax) k.cylX(0.018, 0.012, x - tube - 0.006, y, tu, body); // roda de paralaxe à esquerda
  if (o.shade) k.tube(obj + 0.001, u1, u1 + o.shade, y, body, { seg: 28, x, open: true }); // parasol
}

// argolas de montagem sobre trilho
function rings(k, us, y, yRail, w = 0.03) {
  const gm = mat('gunmetal', 0x26282c);
  for (const u of us) {
    k.box(w, y - yRail, 0.02, 0, (y + yRail) / 2 - 0.004, u, gm, { b: 0.002 });
    k.tube(0.0185, u - 0.01, u + 0.01, y, gm, { seg: 20 });
  }
}

export function buildRifle(md, k, out, sub, M) {
  const { gunmetal, steelDark, polyDark, rubber, bore } = M;
  switch (md.type) {
    // ============================================================ M82 .50 BMG
    case 'm82': {
      const recv = mat('gunmetal', md.body);
      const dark = mat('polymer', 0x1b1c1e);
      // caixa inferior (com o poço do carregador à frente do punho)
      k.prof([[-0.14, 0.03], [0.44, 0.03], [0.44, -0.004], [0.2, -0.012], [0.2, -0.03], [0.09, -0.03], [0.09, -0.01], [-0.02, -0.01], [-0.06, -0.006], [-0.14, -0.006]], 0.056, recv, { b: 0.004 });
      // caixa superior com recortes de alívio de peso
      k.prof([[-0.32, 0.03], [-0.32, 0.098], [0.6, 0.098], [0.62, 0.085], [0.62, 0.03]], 0.062, recv, {
        b: 0.004,
        holes: [0, 1, 2, 3].map((i) => { const u = 0.04 + i * 0.12; return [[u, 0.045], [u + 0.08, 0.045], [u + 0.08, 0.075], [u, 0.075]]; }),
      });
      k.box(0.05, 0.03, 0.88, 0, 0.064, 0.15, dark, { b: 0.002 }); // núcleo (visto pelos recortes)
      k.prof(railPts(-0.28, 0.55, 0.098, 0.108), 0.024, gunmetal, { b: 0 });
      for (const u of [-0.25, -0.05, 0.25, 0.5]) for (const sx of [-1, 1]) k.cylX(0.0045, 0.002, sx * 0.032, 0.05, u, steelDark, { seg: 8 });
      // camisa perfurada do cano, cano grosso e freio de boca em ponta de flecha
      k.tube(0.03, 0.62, 0.78, 0.064, recv, { seg: 20 });
      for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) k.box(0.002, 0.018, 0.02, sx * 0.0302, 0.064, 0.645 + i * 0.035, bore, { b: 0 });
      k.tube(0.0175, 0.78, 1.02, 0.064, steelDark, { r2: 0.016, seg: 20 });
      k.fprof([[-0.016, -0.026], [0.016, -0.026], [0.042, 0.0], [0.016, 0.028], [-0.016, 0.028], [-0.042, 0.0]], 1.02, 1.11, recv, { y: 0.064, b: 0.004 });
      for (const sx of [-1, 1]) for (const u of [1.04, 1.075]) k.box(0.012, 0.03, 0.022, sx * 0.034, 0.064, u, bore, { b: 0 });
      k.disc(0.009, 1.111, 0.064, bore);
      // bipé recolhido sob a camisa
      k.box(0.05, 0.016, 0.03, 0, 0.026, 0.66, gunmetal, { b: 0.003 });
      for (const sx of [-1, 1]) {
        k.tube(0.007, 0.36, 0.66, 0.012, steelDark, { x: sx * 0.022, seg: 10 });
        k.box(0.02, 0.012, 0.03, sx * 0.022, 0.012, 0.35, rubber, { b: 0.003 });
      }
      // punho, guarda-mato, carregador de 10 cartuchos
      k.prof([[-0.056, -0.006], [-0.012, -0.012], [-0.022, -0.118], [-0.072, -0.116], [-0.064, -0.05]], 0.036, dark, { b: 0.008, bs: 2 });
      triggerGuard(k, -0.01, 0.07, -0.01, -0.05, recv, steelDark);
      out.mag = sub((s) => {
        s.box(0.046, 0.15, 0.1, 0, -0.1, 0.145, gunmetal, { b: 0.004 });
        for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) s.box(0.002, 0.11, 0.008, sx * 0.0232, -0.1, 0.11 + i * 0.035, steelDark, { b: 0 });
        s.box(0.05, 0.012, 0.106, 0, -0.178, 0.145, polyDark, { b: 0.002 });
      });
      // manopla de manejo (recua a cada disparo: ação semiautomática)
      out.slide = sub((s) => {
        s.box(0.03, 0.012, 0.03, 0.044, 0.07, 0.08, steelDark, { b: 0.002 });
        s.box(0.012, 0.022, 0.02, 0.062, 0.07, 0.08, polyDark, { b: 0.003 });
      });
      // coronha com tubo do amortecedor, apoio de rosto e soleira grossa
      out.stock.push(sub((s) => {
        s.prof([[-0.32, 0.098], [-0.36, 0.105], [-0.52, 0.105], [-0.54, 0.09], [-0.54, -0.07], [-0.5, -0.075], [-0.38, -0.02], [-0.32, -0.006]], 0.05, recv, { b: 0.008, bs: 2, holes: [[[-0.36, 0.07], [-0.47, 0.07], [-0.47, 0.0], [-0.39, 0.02]]] });
        s.prof([[-0.36, 0.105], [-0.37, 0.13], [-0.5, 0.13], [-0.51, 0.105]], 0.04, dark, { b: 0.008, bs: 2 });
        s.box(0.058, 0.17, 0.035, 0, 0.012, -0.56, rubber, { b: 0.008 });
      }));
      rings(k, [-0.06, 0.18], 0.142, 0.108);
      bigScope(k, { u0: -0.11, u1: 0.32, y: 0.142, obj: 0.029, objLen: 0.075 });
      out.sightY = 0.142;
      out.muzzle.position.set(0, 0.064, -1.12);
      out.flashScale = 0.34;
      break;
    }
    // ============================================================ SVD-63
    case 'svd': {
      const wood = mat('wood', 0xc58a52);
      const steel = mat('steel', 0x2c2e31);
      // caixa da culatra estampada e tampa
      k.prof([[-0.12, 0.004], [-0.12, 0.06], [-0.1, 0.066], [0.2, 0.066], [0.205, 0.058], [0.205, 0.006], [0.07, 0.0], [0.05, -0.008], [-0.02, -0.008], [-0.04, 0.0]], 0.042, steel, { b: 0.004 });
      k.prof([[-0.115, 0.066], [-0.108, 0.078], [0.13, 0.078], [0.145, 0.066]], 0.038, gunmetal, { b: 0.006, bs: 2 });
      k.box(0.002, 0.012, 0.09, 0.022, 0.026, 0.02, steelDark, { b: 0.0005, rx: 0.05 }); // seletor
      // guarda-mão de madeira com respiros e tubo de gases
      k.prof([[0.205, 0.006], [0.205, 0.05], [0.42, 0.05], [0.432, 0.04], [0.432, 0.014], [0.41, 0.006]], 0.046, wood, { b: 0.008, bs: 2, holes: [0, 1, 2].map((i) => { const u = 0.24 + i * 0.06; return [[u, 0.02], [u + 0.035, 0.02], [u + 0.035, 0.034], [u, 0.034]]; }) });
      k.prof([[0.205, 0.054], [0.205, 0.074], [0.41, 0.074], [0.42, 0.062], [0.42, 0.054]], 0.038, wood, { b: 0.007, bs: 2 });
      k.tube(0.0095, 0.42, 0.56, 0.064, steel);
      k.box(0.022, 0.04, 0.026, 0, 0.05, 0.56, steel, { b: 0.004 });
      // cano longo e quebra-chamas com fendas
      k.tube(0.009, 0.2, 0.8, 0.034, gunmetal, { r2: 0.0085 });
      k.tube(0.0125, 0.78, 0.85, 0.034, steel, { seg: 16 });
      for (let i = 0; i < 5; i++) k.box(0.0262, 0.004, 0.034, 0, 0.034, 0.815, bore, { b: 0, rz: (i * Math.PI) / 5 });
      k.disc(0.0065, 0.8505, 0.034, bore);
      k.box(0.004, 0.03, 0.012, 0, 0.055, 0.74, steel, { b: 0.001 }); // massa de mira
      // carregador curvo de 10
      out.mag = sub((s) => {
        s.prof([[0.065, 0.0], [0.13, 0.0], [0.145, -0.05], [0.17, -0.1], [0.125, -0.118], [0.1, -0.07], [0.076, -0.03]], 0.026, gunmetal, { b: 0.003 });
        for (let i = 0; i < 4; i++) s.box(0.0272, 0.003, 0.03, 0, -0.02 - i * 0.022, 0.1 + i * 0.012, steelDark, { b: 0, rx: -0.4 });
      });
      triggerGuard(k, -0.012, 0.06, -0.008, -0.048, steel, steelDark);
      // manopla de manejo à direita (semiautomática)
      out.slide = sub((s) => { s.cylX(0.006, 0.026, 0.032, 0.05, 0.11, steelDark); s.sphere(0.008, 0.046, 0.05, 0.11, steelDark); });
      // luneta lateral estilo PSO (montada à esquerda), com para-sol e protetor de borracha
      const px = -0.034, py = 0.112;
      k.box(0.016, 0.05, 0.12, -0.026, 0.07, 0.02, gunmetal, { b: 0.003 }); // trilho lateral e base
      k.box(0.022, 0.034, 0.05, px, 0.09, 0.03, gunmetal, { b: 0.004 });
      bigScope(k, { u0: -0.1, u1: 0.16, y: py, x: px, tube: 0.0135, obj: 0.021, objLen: 0.05, eye: 0.018, turret: 0.03, turretR: 0.012, shade: 0.04 });
      k.tube(0.021, -0.16, -0.14, py, rubber, { x: px, r2: 0.019, seg: 20 }); // protetor de olho
      k.box(0.014, 0.024, 0.026, px - 0.022, py, 0.06, gunmetal, { b: 0.004 }); // compartimento da pilha
      // coronha vazada (punho integrado) com apoio de rosto
      out.stock.push(sub((s) => {
        s.prof([[-0.12, 0.05], [-0.42, 0.06], [-0.44, 0.045], [-0.44, -0.07], [-0.4, -0.075], [-0.2, -0.03], [-0.1, -0.012], [-0.07, -0.11], [-0.03, -0.115], [-0.02, -0.01], [-0.06, 0.0], [-0.12, 0.004]], 0.036, wood, { b: 0.008, bs: 2, holes: [[[-0.15, 0.03], [-0.36, 0.035], [-0.36, -0.03], [-0.22, -0.01], [-0.12, -0.0]]] });
        s.prof([[-0.18, 0.06], [-0.19, 0.085], [-0.33, 0.085], [-0.34, 0.062]], 0.034, mat('wood', 0xa8743f), { b: 0.008, bs: 2 });
        s.box(0.04, 0.13, 0.012, 0, -0.005, -0.446, rubber, { b: 0.004 });
      }));
      out.sightY = py;
      out.sightX = px;
      out.muzzle.position.set(0, 0.034, -0.86);
      out.flashScale = 0.2;
      break;
    }
    // ============================================================ Espectro .338 LM
    case 'spectre': {
      const fde = mat('polymer', md.body);
      const black = mat('polymer', 0x18191b);
      const alu = mat('gunmetal', 0x2b2d30);
      // chassi de alumínio e guarda-mão octogonal com encaixes
      k.prof([[-0.1, 0.004], [-0.1, 0.058], [0.18, 0.058], [0.18, 0.004], [0.06, -0.008], [-0.02, -0.008]], 0.05, fde, { b: 0.006 });
      k.fprof([[-0.02, -0.032], [0.02, -0.032], [0.032, -0.02], [0.032, 0.02], [0.02, 0.032], [-0.02, 0.032], [-0.032, 0.02], [-0.032, -0.02]], 0.18, 0.56, fde, { y: 0.046, b: 0.002 });
      for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) k.box(0.002, 0.012, 0.03, sx * 0.0322, 0.046, 0.22 + i * 0.055, black, { b: 0 });
      k.prof(railPts(-0.08, 0.55, 0.078, 0.086), 0.022, alu, { b: 0 });
      // ação redonda, cano canelado e supressor
      k.tube(0.0195, -0.1, 0.18, 0.058, mat('steel', 0x34373b), { seg: 24 });
      k.tube(0.0125, 0.56, 0.66, 0.046, alu, { seg: 16 });
      k.tube(0.0215, 0.66, 0.9, 0.046, black, { seg: 28 });
      k.tube(0.0225, 0.66, 0.675, 0.046, alu, { seg: 28 });
      k.disc(0.006, 0.9005, 0.046, bore);
      for (let i = 0; i < 5; i++) k.tube(0.0222, 0.7 + i * 0.04, 0.705 + i * 0.04, 0.046, alu, { seg: 28 });
      // punho ergonômico, guarda-mato e carregador AICS
      k.prof([[-0.054, -0.006], [-0.012, -0.012], [-0.02, -0.118], [-0.07, -0.118], [-0.064, -0.05]], 0.034, black, { b: 0.009, bs: 2 });
      triggerGuard(k, -0.008, 0.062, -0.01, -0.048, fde, steelDark);
      out.mag = sub((s) => {
        s.box(0.032, 0.07, 0.085, 0, -0.035, 0.12, black, { b: 0.004 });
        s.box(0.034, 0.008, 0.088, 0, -0.072, 0.12, fde, { b: 0.002 });
      });
      // ferrolho com manopla grande
      out.slide = sub((s) => {
        s.box(0.036, 0.008, 0.008, 0.036, 0.05, -0.065, steelDark, { b: 0.001, rz: -0.35 });
        s.sphere(0.014, 0.055, 0.042, -0.065, black);
        s.tube(0.013, -0.125, -0.1, 0.058, steelDark, { seg: 16 });
      });
      // coronha dobrável regulável com apoio de rosto e monopé
      out.stock.push(sub((s) => {
        s.box(0.03, 0.03, 0.06, 0, 0.04, -0.13, alu, { b: 0.004 });
        s.prof([[-0.16, 0.06], [-0.4, 0.06], [-0.42, 0.045], [-0.42, -0.07], [-0.39, -0.075], [-0.33, -0.02], [-0.2, 0.0], [-0.16, 0.02]], 0.044, fde, { b: 0.007, holes: [[[-0.2, 0.04], [-0.33, 0.04], [-0.33, 0.0], [-0.22, 0.012]]] });
        s.prof([[-0.2, 0.06], [-0.205, 0.088], [-0.34, 0.088], [-0.345, 0.06]], 0.034, black, { b: 0.008, bs: 2 });
        s.box(0.048, 0.13, 0.016, 0, -0.005, -0.428, rubber, { b: 0.004 });
        s.tube(0.006, -0.33, -0.33, -0.07, alu, { seg: 8 });
        s.cylY(0.006, 0.07, 0, -0.1, -0.33, alu);
      }));
      rings(k, [-0.04, 0.14], 0.122, 0.086);
      bigScope(k, { u0: -0.1, u1: 0.29, y: 0.122, obj: 0.028, objLen: 0.07, parallax: true });
      out.sightY = 0.122;
      out.muzzle.position.set(0, 0.046, -0.91);
      out.flashScale = 0.05; // supressor: clarão quase invisível
      break;
    }
    // ============================================================ Horizonte .50 LR
    case 'lr50': {
      const od = mat('polymer', md.body);
      const black = mat('polymer', 0x161718);
      const steel = mat('steel', 0x2f3236);
      // chassi longo com guarda-mão de tubo largo
      k.prof([[-0.12, 0.004], [-0.12, 0.064], [0.22, 0.064], [0.22, 0.004], [0.07, -0.012], [-0.02, -0.012]], 0.058, od, { b: 0.006 });
      k.fprof([[-0.034, -0.03], [0.034, -0.03], [0.04, -0.02], [0.04, 0.026], [0.034, 0.036], [-0.034, 0.036], [-0.04, 0.026], [-0.04, -0.02]], 0.22, 0.7, od, { y: 0.05, b: 0.003 });
      for (let i = 0; i < 8; i++) for (const sx of [-1, 1]) k.box(0.002, 0.016, 0.034, sx * 0.0402, 0.05, 0.26 + i * 0.054, black, { b: 0 });
      k.prof(railPts(-0.1, 0.68, 0.086, 0.095), 0.026, black, { b: 0 }); // trilho com inclinação de 30 MOA
      // ação maciça, cano muito longo e canelado, freio radial
      k.tube(0.024, -0.12, 0.22, 0.064, steel, { seg: 24 });
      k.tube(0.019, 0.7, 1.22, 0.06, steel, { r2: 0.0165, seg: 20 });
      for (let i = 0; i < 6; i++) k.box(0.002, 0.005, 0.45, Math.cos((i * Math.PI) / 3) * 0.018, 0.06 + Math.sin((i * Math.PI) / 3) * 0.018, 0.96, black, { b: 0, rz: (i * Math.PI) / 3 });
      k.tube(0.028, 1.22, 1.33, 0.06, steel, { seg: 24 });
      for (let r = 0; r < 3; r++) for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        k.cylX(0.0045, 0.004, Math.cos(a) * 0.0285, 0.06 + Math.sin(a) * 0.0285, 1.245 + r * 0.03, black, { seg: 6 });
      }
      k.disc(0.01, 1.3305, 0.06, bore);
      // bipé estendido para a frente e punho
      k.box(0.06, 0.018, 0.03, 0, 0.014, 0.66, black, { b: 0.003 });
      for (const sx of [-1, 1]) k.tube(0.008, 0.66, 0.98, 0.014, steel, { x: sx * 0.026, seg: 10 });
      k.prof([[-0.058, -0.006], [-0.012, -0.012], [-0.022, -0.122], [-0.074, -0.12], [-0.066, -0.05]], 0.036, black, { b: 0.009, bs: 2 });
      triggerGuard(k, -0.01, 0.064, -0.012, -0.05, od, steelDark);
      out.mag = sub((s) => {
        s.box(0.05, 0.1, 0.12, 0, -0.06, 0.14, black, { b: 0.004 });
        s.box(0.054, 0.01, 0.124, 0, -0.112, 0.14, od, { b: 0.002 });
      });
      // ferrolho grande (ciclo lento)
      out.slide = sub((s) => {
        s.box(0.044, 0.01, 0.01, 0.042, 0.056, -0.08, steelDark, { b: 0.001, rz: -0.3 });
        s.sphere(0.017, 0.066, 0.048, -0.08, black);
        s.tube(0.016, -0.15, -0.12, 0.064, steelDark, { seg: 18 });
      });
      // coronha com apoio de rosto ajustável e espigão traseiro
      out.stock.push(sub((s) => {
        s.prof([[-0.12, 0.064], [-0.46, 0.07], [-0.48, 0.05], [-0.48, -0.085], [-0.44, -0.09], [-0.36, -0.03], [-0.2, -0.006], [-0.12, 0.004]], 0.05, od, { b: 0.008, holes: [[[-0.18, 0.045], [-0.38, 0.05], [-0.38, 0.0], [-0.22, 0.014]]] });
        s.prof([[-0.2, 0.07], [-0.205, 0.105], [-0.4, 0.105], [-0.405, 0.07]], 0.038, black, { b: 0.008, bs: 2 });
        s.box(0.056, 0.17, 0.022, 0, -0.008, -0.49, rubber, { b: 0.006 });
        s.cylY(0.007, 0.09, 0, -0.13, -0.4, steel);
        s.cylY(0.012, 0.012, 0, -0.18, -0.4, black);
      }));
      // luneta gigante 6–50× com parasol, nível de bolha e roda de paralaxe
      rings(k, [-0.06, 0.2], 0.142, 0.095, 0.034);
      bigScope(k, { u0: -0.12, u1: 0.4, y: 0.142, tube: 0.017, obj: 0.034, objLen: 0.09, eye: 0.02, parallax: true, shade: 0.07, turretR: 0.016 });
      k.box(0.008, 0.006, 0.018, -0.024, 0.128, -0.06, mat('glass', 0x2f6a34), { b: 0.002 }); // nível de bolha
      out.sightY = 0.142;
      out.muzzle.position.set(0, 0.06, -1.34);
      out.flashScale = 0.3;
      break;
    }
    default: break;
  }
}

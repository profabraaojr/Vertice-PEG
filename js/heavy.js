// Armas pesadas modeladas por código com o mesmo kit das demais (u = para a frente, y = para
// cima, origem no topo do punho): metralhadora rotativa Ciclone R6, de seis canos, e bazuca (lança-foguetes).
// Partes animadas: out.spinner (feixe de canos que gira) e out.rocket (ogiva visível quando carregada).
import * as THREE from 'three';
import { gunMat as mat, triggerGuard } from './guns.js';

export const HEAVY_TYPES = new Set(['minigun', 'launcher']);

const AXIS_Y = 0.035; // eixo do feixe de canos da minigun

export function buildHeavy(md, k, out, sub, M) {
  const { steelDark, polyDark, rubber, bore } = M;
  switch (md.type) {
    // ============================================================ Ciclone R6 (id 'm134', modelo 'minigun')
    case 'minigun': {
      const body = mat('gunmetal', md.body);
      const od = mat('polymer', md.accent);
      const steel = mat('steel', 0x34373b);
      // carcaça do mecanismo, motor elétrico e tampa traseira
      k.box(0.11, 0.1, 0.27, 0, AXIS_Y, 0.065, body, { b: 0.01 });
      k.tube(0.03, -0.1, 0.14, 0.108, body, { seg: 18, x: 0.034 });
      k.disc(0.03, -0.1005, 0.108, steelDark, { back: true, x: 0.034, seg: 18 });
      for (let i = 0; i < 5; i++) k.tube(0.0315, -0.08 + i * 0.035, -0.07 + i * 0.035, 0.108, steel, { seg: 18, x: 0.034 }); // aletas do motor
      k.tube(0.05, -0.075, -0.06, AXIS_Y, body, { seg: 22 });
      // alça superior de transporte (a mão de apoio pode pegar aqui) e chave de acionamento
      k.box(0.018, 0.016, 0.24, -0.012, 0.165, 0.08, polyDark, { b: 0.006 });
      for (const u of [-0.02, 0.18]) k.box(0.014, 0.05, 0.02, -0.012, 0.13, u, steelDark, { b: 0.003 });
      k.box(0.012, 0.012, 0.02, 0.0, 0.022, -0.005, mat('polymer', 0xb33a2a), { b: 0.003 });
      // punho traseiro e guarda-mato
      k.prof([[-0.05, -0.0], [-0.008, -0.012], [-0.02, -0.12], [-0.068, -0.118], [-0.06, -0.05]], 0.038, rubber, { b: 0.008, bs: 2 });
      triggerGuard(k, -0.004, 0.066, -0.013, -0.05, body, steelDark);
      // empunhadura de apoio sob o feixe (barra horizontal com suporte)
      k.box(0.03, 0.05, 0.03, 0, -0.012, 0.22, body, { b: 0.004 });
      k.tube(0.013, 0.2, 0.37, -0.04, rubber, { seg: 14 });
      for (const u of [0.2, 0.37]) k.disc(0.013, u, -0.04, steelDark, { back: u < 0.3, seg: 14 });
      // caixa de munição à esquerda e calha de alimentação até a carcaça
      k.box(0.085, 0.13, 0.17, -0.115, -0.02, 0.03, od, { b: 0.008 });
      k.box(0.088, 0.014, 0.174, -0.115, 0.048, 0.03, mat('polymer', 0x2f3324), { b: 0.004 });
      for (let i = 0; i < 6; i++) {
        const t = i / 5;
        k.box(0.03, 0.03, 0.035, -0.11 + t * 0.06, 0.06 + Math.sin(t * Math.PI) * 0.035, 0.05 + t * 0.05, body, { b: 0.004, rz: 0.4 - t * 0.8 });
      }
      // feixe de seis canos (gira): cubo traseiro, braçadeiras e bocas
      const pivot = new THREE.Group();
      pivot.position.set(0, AXIS_Y, 0);
      const cluster = sub((s) => {
        s.tube(0.052, 0.2, 0.25, AXIS_Y, steel, { seg: 24 });
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const x = Math.cos(a) * 0.032, y = AXIS_Y + Math.sin(a) * 0.032;
          s.tube(0.0078, 0.25, 0.8, y, steelDark, { seg: 10, x });
          s.disc(0.0042, 0.8005, y, bore, { x, seg: 8 });
        }
        for (const u of [0.42, 0.73]) s.tube(0.045, u, u + 0.022, AXIS_Y, body, { seg: 24 });
        s.tube(0.012, 0.25, 0.75, AXIS_Y, steel, { seg: 10 }); // eixo central
      });
      g_reparent(cluster, pivot, AXIS_Y);
      out.group.add(pivot);
      out.spinner = pivot;
      out.sightY = 0.16;
      out.muzzle.position.set(0, AXIS_Y, -0.81);
      out.flashScale = 0.55;
      break;
    }
    // ============================================================ Bazuca (lança-foguetes)
    case 'launcher': {
      const tubeM = mat('polymer', md.body);
      const dark = mat('polymer', md.accent);
      const steel = mat('steel', 0x3a3d40);
      const Y = 0.078;
      // tubo de lançamento, proteção térmica com nervuras e venturi traseiro aberto
      k.tube(0.042, -0.5, 0.42, Y, tubeM, { seg: 26 });
      k.tube(0.0485, -0.14, 0.14, Y, dark, { seg: 26 });
      for (let i = 0; i < 6; i++) k.tube(0.0505, -0.125 + i * 0.05, -0.115 + i * 0.05, Y, mat('rubber', 0x1a1b1c), { seg: 26 });
      k.tube(0.042, -0.62, -0.5, Y, steel, { r2: 0.042, seg: 26 });
      k.tube(0.06, -0.66, -0.6, Y, steel, { r2: 0.044, seg: 26, open: true });
      k.disc(0.036, -0.6, Y, bore, { back: true, seg: 22 });
      k.tube(0.045, 0.4, 0.43, Y, steel, { seg: 26 });
      k.disc(0.036, 0.4305, Y, bore, { seg: 22 });
      // apoio de ombro, punho com guarda-mato e punho dianteiro
      k.box(0.05, 0.03, 0.14, 0, Y - 0.05, -0.3, rubber, { b: 0.008 });
      k.box(0.03, 0.028, 0.07, 0, 0.03, 0.0, dark, { b: 0.004 });
      k.prof([[-0.048, 0.004], [-0.006, -0.008], [-0.018, -0.115], [-0.064, -0.112], [-0.058, -0.045]], 0.036, dark, { b: 0.008, bs: 2 });
      triggerGuard(k, 0.0, 0.065, -0.008, -0.048, tubeM, steelDark);
      k.box(0.03, 0.028, 0.06, 0, 0.032, 0.24, dark, { b: 0.004 });
      k.prof([[0.215, 0.02], [0.262, 0.02], [0.256, -0.08], [0.222, -0.08]], 0.034, dark, { b: 0.008, bs: 2 });
      // alça de mira rebatível com escala de distâncias (lado esquerdo do tubo)
      k.box(0.012, 0.05, 0.03, -0.038, Y + 0.05, 0.16, steelDark, { b: 0.002 });
      k.box(0.03, 0.03, 0.004, -0.038, Y + 0.085, 0.16, steelDark, { b: 0.001 });
      k.box(0.012, 0.03, 0.012, -0.038, Y + 0.06, -0.04, steelDark, { b: 0.002 });
      // ogiva do foguete (some depois do disparo e volta na recarga)
      out.rocket = sub((s) => {
        s.tube(0.03, 0.43, 0.5, Y, mat('polymer', 0x3d4a2c), { seg: 20 });
        s.tube(0.046, 0.5, 0.6, Y, mat('polymer', 0x55602f), { r2: 0.046, seg: 22 });
        s.tube(0.046, 0.6, 0.72, Y, mat('polymer', 0x55602f), { r2: 0.008, seg: 22 });
        s.tube(0.006, 0.72, 0.745, Y, steel, { seg: 10 });
        s.tube(0.0465, 0.53, 0.545, Y, mat('polymer', 0xc8a23c), { seg: 22 }); // faixa de identificação
      });
      out.sightY = Y + 0.085;
      out.sightX = -0.038;
      out.muzzle.position.set(0, Y, -0.45);
      out.flashScale = 0.7;
      break;
    }
    default: break;
  }
}

// move o grupo para dentro de um pivô no eixo (para girar em torno dele)
function g_reparent(grp, pivot, y) {
  grp.removeFromParent();
  grp.position.y -= y;
  pivot.add(grp);
}

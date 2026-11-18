// Configurações estáticas do jogo: equipes, armas, dificuldade e nomes de bots.

export const GAME_TITLE = 'VÉRTICE';

export const TEAMS = {
  A: { id: 'A', name: 'Vanguarda', color: 0xff7a2f, css: '#ff8a3d' },
  B: { id: 'B', name: 'Sentinela', color: 0x2fa8ff, css: '#3db8ff' },
};

// Cores usadas no mata-mata (cada combatente tem a sua).
export const FFA_COLORS = [
  0xff7a2f, 0x2fa8ff, 0x6ee26e, 0xe2d24a, 0xc46ee2, 0xe25a5a,
  0x4ae2c9, 0xf0f0f0, 0x9a7a52, 0xff4fa0, 0x8fa3ff, 0xb4ff4f,
];

export const BOT_NAMES = [
  'Raposa', 'Coruja', 'Jaguar', 'Gavião', 'Lince', 'Tatu', 'Carcará', 'Sucuri',
  'Tucano', 'Lobo', 'Onça', 'Falcão', 'Piranha', 'Arara', 'Quati', 'Cascavel',
  'Tamanduá', 'Urutau', 'Jacaré', 'Mandi',
];

// Parâmetros por dificuldade. aimError em graus, reaction em segundos.
export const DIFFICULTY = {
  recruta: { label: 'Recruta', reaction: 0.8, aimError: 7.5, turnSpeed: 3.2, burst: [2, 4], headChance: 0.05, viewDist: 38, accuracyGain: 0.5, recoilControl: 0.2, stopToShoot: false, strafeChance: 0.35 },
  soldado: { label: 'Soldado', reaction: 0.52, aimError: 4.6, turnSpeed: 4.8, burst: [3, 6], headChance: 0.15, viewDist: 55, accuracyGain: 0.9, recoilControl: 0.45, stopToShoot: false, strafeChance: 0.55 },
  veterano: { label: 'Veterano', reaction: 0.34, aimError: 2.8, turnSpeed: 7, burst: [4, 8], headChance: 0.3, viewDist: 70, accuracyGain: 1.5, recoilControl: 0.65, stopToShoot: true, strafeChance: 0.7 },
  elite: { label: 'Elite', reaction: 0.21, aimError: 1.6, turnSpeed: 10, burst: [5, 10], headChance: 0.5, viewDist: 90, accuracyGain: 2.2, recoilControl: 0.85, stopToShoot: true, strafeChance: 0.85 },
};

/*
 * Armas. Unidades:
 *  - damage: dano por projétil (corpo, a curta distância)
 *  - rpm: disparos por minuto
 *  - spread/moveSpread/airSpread/perShot/maxSpread: radianos
 *  - recoil/recoilH: graus de coice vertical/horizontal por disparo
 *  - recoilRecover: graus por segundo de retorno da mira
 *  - range: distância (m) com dano integral; minFalloff: multiplicador mínimo
 *  - speed: multiplicador de velocidade de movimento
 */
export const WEAPONS = {
  vp9: {
    id: 'vp9', name: 'VP-9', caliber: '9 × 19 mm', optic: 'Mira aberta', rangeText: '5 a 30 m', category: 'Pistola', slot: 'secondary',
    damage: 26, headMult: 3.4, legMult: 0.75, rpm: 400, auto: false, pellets: 1,
    mag: 15, reserve: 75, reload: 1.45,
    spread: 0.006, moveSpread: 0.03, airSpread: 0.1, crouchMult: 0.75, adsMult: 0.55,
    perShot: 0.011, maxSpread: 0.05, spreadRecover: 0.16,
    recoil: 1.4, recoilH: 0.35, recoilRecover: 10,
    range: 26, minFalloff: 0.6, speed: 1.0, adsZoom: 1.15,
    sound: { freq: 1100, low: 150, decay: 0.13, gain: 0.75, tail: 0.15 },
    model: { type: 'pistol', body: 0x2b2f36, accent: 0x9aa1ab },
    bot: { pref: 14 },
    desc: 'Semiautomática leve e precisa. Recarga rápida e boa mobilidade.',
  },
  brasa: {
    id: 'brasa', name: 'Brasa .50', caliber: '.50 AE', optic: 'Mira aberta', rangeText: '5 a 35 m', category: 'Pistola', slot: 'secondary',
    damage: 55, headMult: 2.7, legMult: 0.75, rpm: 165, auto: false, pellets: 1,
    mag: 7, reserve: 35, reload: 2.1,
    spread: 0.007, moveSpread: 0.055, airSpread: 0.16, crouchMult: 0.75, adsMult: 0.5,
    perShot: 0.03, maxSpread: 0.08, spreadRecover: 0.12,
    recoil: 4.4, recoilH: 0.9, recoilRecover: 8,
    range: 34, minFalloff: 0.65, speed: 0.98, adsZoom: 1.2,
    sound: { freq: 650, low: 95, decay: 0.26, gain: 1.0, tail: 0.45 },
    model: { type: 'revolver', body: 0x6b6f75, accent: 0xb5712d },
    bot: { pref: 16 },
    desc: 'Pistola pesada. Um disparo na cabeça elimina; o coice cobra disciplina.',
  },
  ratel: {
    id: 'ratel', name: 'Ratel MK2', caliber: '9 × 19 mm', optic: 'Mira holográfica', rangeText: '5 a 35 m', category: 'Submetralhadora', slot: 'primary',
    damage: 21, headMult: 2.8, legMult: 0.75, rpm: 880, auto: true, pellets: 1,
    mag: 32, reserve: 160, reload: 2.0,
    spread: 0.011, moveSpread: 0.018, airSpread: 0.09, crouchMult: 0.8, adsMult: 0.65,
    perShot: 0.0045, maxSpread: 0.055, spreadRecover: 0.2,
    recoil: 0.55, recoilH: 0.45, recoilRecover: 12,
    range: 16, minFalloff: 0.5, speed: 1.06, adsZoom: 1.15,
    sound: { freq: 1500, low: 170, decay: 0.08, gain: 0.6, tail: 0.1 },
    model: { type: 'smg', body: 0x30353b, accent: 0x5f8f5a },
    bot: { pref: 10 },
    desc: 'Cadência altíssima e mobilidade superior. Perde força com a distância.',
  },
  tempest: {
    id: 'tempest', name: 'Tempest AR-K', caliber: '7,62 × 39 mm', optic: 'Mira aberta de alça e massa', rangeText: '10 a 60 m', category: 'Rifle de assalto', slot: 'primary',
    damage: 34, headMult: 3.8, legMult: 0.75, rpm: 600, auto: true, pellets: 1,
    mag: 30, reserve: 120, reload: 2.45,
    spread: 0.004, moveSpread: 0.065, airSpread: 0.17, crouchMult: 0.7, adsMult: 0.5,
    perShot: 0.0072, maxSpread: 0.07, spreadRecover: 0.15,
    recoil: 1.1, recoilH: 0.6, recoilRecover: 8,
    range: 45, minFalloff: 0.75, speed: 0.92, adsZoom: 1.3,
    sound: { freq: 900, low: 110, decay: 0.15, gain: 0.95, tail: 0.35 },
    model: { type: 'ar', body: 0x3a3127, accent: 0x9c6b3a },
    bot: { pref: 22 },
    desc: 'Rifle de alto dano, letal na cabeça. Exige controle do recuo vertical.',
  },
  kestrel: {
    id: 'kestrel', name: 'Kestrel M7', caliber: '5,56 × 45 mm', optic: 'Mira holográfica', rangeText: '10 a 70 m', category: 'Rifle de assalto', slot: 'primary',
    damage: 29, headMult: 3.8, legMult: 0.75, rpm: 690, auto: true, pellets: 1,
    mag: 30, reserve: 120, reload: 2.2,
    spread: 0.0035, moveSpread: 0.055, airSpread: 0.16, crouchMult: 0.7, adsMult: 0.5,
    perShot: 0.006, maxSpread: 0.06, spreadRecover: 0.17,
    recoil: 0.82, recoilH: 0.42, recoilRecover: 9,
    range: 42, minFalloff: 0.75, speed: 0.94, adsZoom: 1.3,
    sound: { freq: 1200, low: 130, decay: 0.12, gain: 0.85, tail: 0.28 },
    model: { type: 'ar2', body: 0x2a2e33, accent: 0x4d6b8a },
    bot: { pref: 22 },
    desc: 'Rifle estável e controlável. Menos dano por tiro, mais consistência.',
  },
  longinus: {
    id: 'longinus', name: 'Longinus .338', caliber: '.338 Lapua Magnum', optic: 'Luneta 4–16× · retículo mil-dot', rangeText: '30 a 300 m', category: 'Rifle de precisão', slot: 'primary',
    damage: 118, headMult: 2.5, legMult: 0.8, rpm: 44, auto: false, pellets: 1,
    mag: 5, reserve: 25, reload: 3.3,
    spread: 0.085, scopedSpread: 0.0004, moveSpread: 0.12, airSpread: 0.25, crouchMult: 0.8, adsMult: 1,
    perShot: 0, maxSpread: 0, spreadRecover: 1,
    recoil: 5.0, recoilH: 0.6, recoilRecover: 7,
    range: 200, minFalloff: 1, speed: 0.82, zoom: [20, 5], reticle: 'mildot', action: 'bolt', zero: 100,
    sound: { freq: 520, low: 70, decay: 0.32, gain: 1.15, tail: 0.9 },
    model: { type: 'sniper', body: 0x3b4234, accent: 0x1d1f22 },
    bot: { pref: 35 },
    desc: 'Ferrolho com luneta de dois níveis. Elimina com um disparo no tronco.',
  },
  m82: {
    id: 'm82', name: 'M82 .50 BMG', category: 'Rifle de precisão semiautomático', slot: 'primary',
    damage: 165, headMult: 2.2, legMult: 0.85, rpm: 70, auto: false, pellets: 1,
    mag: 10, reserve: 30, reload: 4.2, pierce: 2,
    spread: 0.11, scopedSpread: 0.0005, moveSpread: 0.16, airSpread: 0.3, crouchMult: 0.75, adsMult: 1,
    perShot: 0, maxSpread: 0, spreadRecover: 1,
    recoil: 8.5, recoilH: 1.1, recoilRecover: 5.5,
    range: 400, minFalloff: 1, speed: 0.7, zoom: [18, 4.5], reticle: 'mildot', action: 'semi',
    ballistic: { v: 853, c: 0.0004 }, zero: 300,
    caliber: '.50 BMG (12,7 × 99 mm)', optic: 'Luneta 4–18× · retículo mil-dot', rangeText: '100 a 1.000 m',
    sound: { freq: 360, low: 42, decay: 0.55, gain: 1.45, tail: 1.6 },
    model: { type: 'm82', body: 0x2c2f33, accent: 0x1b1c1e },
    bot: { pref: 45 },
    desc: 'Semiautomático de grande calibre, inspirado no Barrett M82. Pesado e de recuo forte; o projétil atravessa dois alvos e chega longe com pouca queda.',
  },
  svd: {
    id: 'svd', name: 'SVD-63', category: 'Rifle de precisão semiautomático', slot: 'primary',
    damage: 92, headMult: 2.4, legMult: 0.8, rpm: 140, auto: false, pellets: 1,
    mag: 10, reserve: 40, reload: 2.8,
    spread: 0.06, scopedSpread: 0.0012, moveSpread: 0.09, airSpread: 0.2, crouchMult: 0.8, adsMult: 1,
    perShot: 0.004, maxSpread: 0.02, spreadRecover: 1.5,
    recoil: 3.4, recoilH: 0.7, recoilRecover: 9,
    range: 160, minFalloff: 0.9, speed: 0.86, zoom: [22, 5.5], reticle: 'pso', action: 'semi',
    ballistic: { v: 830, c: 0.0013 }, zero: 300,
    caliber: '7,62 × 54 mm R', optic: 'Luneta tipo PSO 4–15× · retículo de chevrons', rangeText: '50 a 600 m',
    sound: { freq: 620, low: 80, decay: 0.3, gain: 1.1, tail: 0.75 },
    model: { type: 'svd', body: 0x2c2e31, accent: 0xc58a52 },
    bot: { pref: 30 },
    desc: 'Semiautomático leve, inspirado no Dragunov SVD: disparos rápidos, recuo moderado e boa mobilidade. Precisa de dois acertos no tronco.',
  },
  spectre: {
    id: 'spectre', name: 'Espectro .338 LM', category: 'Rifle de precisão', slot: 'primary',
    damage: 125, headMult: 2.5, legMult: 0.8, rpm: 50, auto: false, pellets: 1,
    mag: 5, reserve: 25, reload: 3.0,
    spread: 0.08, scopedSpread: 0.0003, moveSpread: 0.11, airSpread: 0.24, crouchMult: 0.8, adsMult: 1,
    perShot: 0, maxSpread: 0, spreadRecover: 1,
    recoil: 4.2, recoilH: 0.5, recoilRecover: 8,
    range: 260, minFalloff: 1, speed: 0.84, zoom: [20, 4], reticle: 'tree', action: 'bolt', cycle: 0.62, suppressed: true,
    ballistic: { v: 900, c: 0.0009 }, zero: 200,
    caliber: '.338 Lapua Magnum', optic: 'Luneta tática 4–20× · retículo em árvore (mrad)', rangeText: '100 a 1.200 m',
    sound: { freq: 300, low: 60, decay: 0.12, gain: 0.55, tail: 0.25, suppressed: true },
    model: { type: 'spectre', body: 0x8a7a5a, accent: 0x18191b },
    bot: { pref: 35 },
    desc: 'Ferrolho moderno com chassi de alumínio e supressor, de estética militar contemporânea. Silencioso, estável e muito preciso.',
  },
  lr50: {
    id: 'lr50', name: 'Horizonte .50 LR', category: 'Rifle de precisão de longo alcance', slot: 'primary',
    damage: 190, headMult: 2.2, legMult: 0.9, rpm: 30, auto: false, pellets: 1,
    mag: 5, reserve: 20, reload: 4.6, pierce: 2,
    spread: 0.13, scopedSpread: 0.0002, moveSpread: 0.2, airSpread: 0.35, crouchMult: 0.7, adsMult: 1,
    perShot: 0, maxSpread: 0, spreadRecover: 1,
    recoil: 9, recoilH: 0.8, recoilRecover: 4.5,
    range: 600, minFalloff: 1, speed: 0.66, zoom: [14, 4, 1.6], reticle: 'tree', reticleFFP: true, action: 'bolt', cycle: 1.1,
    ballistic: { v: 900, c: 0.00032 }, zero: 1000,
    caliber: '.50 BMG (12,7 × 99 mm)', optic: 'Luneta 6–50× (três ampliações) · retículo em árvore no primeiro plano focal', rangeText: '1.000 a 2.000 m',
    sound: { freq: 330, low: 38, decay: 0.62, gain: 1.5, tail: 2.2 },
    model: { type: 'lr50', body: 0x4a4f3a, accent: 0x161718 },
    bot: { pref: 0 },
    desc: 'Ferrolho de cano longo para distâncias extremas. Muito pesado e lento de manejar; a luneta tem três ampliações e retículo em árvore para segurar queda e vento.',
  },
  bulldog: {
    id: 'bulldog', name: 'Bulldog 12', caliber: 'Calibre 12', optic: 'Mira aberta', rangeText: '2 a 15 m', category: 'Escopeta', slot: 'primary',
    damage: 17, headMult: 2.0, legMult: 0.75, rpm: 70, auto: false, pellets: 9, pelletSpread: 0.062,
    mag: 7, reserve: 35, reload: 2.8,
    spread: 0.01, moveSpread: 0.02, airSpread: 0.06, crouchMult: 0.9, adsMult: 0.8,
    perShot: 0, maxSpread: 0, spreadRecover: 1,
    recoil: 5.5, recoilH: 1.2, recoilRecover: 7,
    range: 7, minFalloff: 0.15, speed: 0.95, adsZoom: 1.1,
    sound: { freq: 480, low: 80, decay: 0.3, gain: 1.15, tail: 0.6 },
    model: { type: 'shotgun', body: 0x2c2620, accent: 0x7a4b2a },
    bot: { pref: 6 },
    desc: 'Escopeta de bombeamento. Devastadora em corredores, inútil a distância.',
  },
  // armas pesadas (restritas): só no modo história, no treino e, nas partidas, pela foto do
  // professor (minigun) ou pela caixa de armamento (bazuca) — ver js/ordnance.js
  m134: {
    id: 'm134', name: 'Minigun M134', caliber: '7,62 × 51 mm', optic: 'Sem mira óptica', rangeText: '5 a 50 m', category: 'Metralhadora rotativa · restrita', slot: 'primary', heavy: true,
    damage: 15, headMult: 2.2, legMult: 0.8, rpm: 1500, auto: true, pellets: 1,
    mag: 300, reserve: 300, reload: 5.2,
    spread: 0.022, moveSpread: 0.03, airSpread: 0.12, crouchMult: 0.8, adsMult: 0.85,
    perShot: 0.0006, maxSpread: 0.045, spreadRecover: 0.3,
    recoil: 0.18, recoilH: 0.35, recoilRecover: 10,
    range: 50, minFalloff: 0.6, speed: 0.62, adsZoom: 1.05,
    spin: { up: 0.55, down: 1.2 }, heat: { perShot: 0.0042, cool: 0.32, lock: 2.6 },
    sound: { freq: 760, low: 95, decay: 0.05, gain: 0.55, tail: 0.12 },
    model: { type: 'minigun', body: 0x2b2d30, accent: 0x5a5d33 },
    bot: { pref: 18 },
    desc: 'Seis canos giratórios, cadência altíssima. Precisa girar antes de disparar (segure o gatilho ou o botão direito), esquenta com rajadas longas e deixa o jogador lento.',
  },
  rpg: {
    id: 'rpg', name: 'Bazuca', caliber: 'Foguete de 84 mm', optic: 'Alça de mira rebatível', rangeText: '10 a 120 m', category: 'Lança-foguetes · restrita', slot: 'primary', heavy: true,
    damage: 135, headMult: 1, legMult: 1, rpm: 40, auto: false, pellets: 1,
    mag: 1, reserve: 5, reload: 2.9,
    spread: 0.006, moveSpread: 0.03, airSpread: 0.1, crouchMult: 0.8, adsMult: 0.5,
    perShot: 0, maxSpread: 0, spreadRecover: 1,
    recoil: 4.5, recoilH: 0.6, recoilRecover: 6,
    range: 120, minFalloff: 1, speed: 0.78, adsZoom: 1.25,
    rocket: { speed: 48, radius: 5.5, minDamage: 15, self: 0.5, gravity: 1.2, life: 4 },
    sound: { freq: 220, low: 55, decay: 0.4, gain: 1.1, tail: 1.2 },
    model: { type: 'launcher', body: 0x4a5235, accent: 0x2a2c2e },
    bot: { pref: 25 },
    desc: 'Lança um foguete com tempo de voo e explosão em área; o dano cai com a distância do centro e atinge também quem dispara muito perto. Um foguete por recarga.',
  },
  fulgor: {
    id: 'fulgor', name: 'Manoplas Fulgor', caliber: 'Feixe de energia', optic: 'Sem mira óptica', rangeText: '5 a 40 m', category: 'Energia', slot: 'primary',
    damage: 25, headMult: 2.4, legMult: 0.8, rpm: 480, auto: true, pellets: 1,
    mag: 36, reserve: 144, reload: 2.2, beam: true, pierce: 3,
    spread: 0.003, moveSpread: 0.025, airSpread: 0.08, crouchMult: 0.8, adsMult: 0.6,
    perShot: 0.003, maxSpread: 0.03, spreadRecover: 0.25,
    recoil: 0.35, recoilH: 0.2, recoilRecover: 12,
    range: 200, minFalloff: 1, speed: 1.0, adsZoom: 1.2,
    sound: { laser: true, freq: 1900, low: 220, decay: 0.16, gain: 0.7 },
    model: { type: 'gauntlet', body: 0x2b2f38, accent: 0x38e8ff },
    bot: { pref: 20 },
    desc: 'Par de manoplas que disparam feixes de luz fulminante, alternando as mãos. O feixe não perde força com a distância e atravessa até três alvos em linha. Células recarregáveis.',
  },
  katana: {
    id: 'katana', name: 'Katana Kaze', caliber: '—', optic: '—', rangeText: 'Até 2,3 m', category: 'Corpo a corpo', slot: 'melee', melee: true,
    damage: 55, heavyDamage: 95, headMult: 1, legMult: 1, rpm: 140, heavyRpm: 60, auto: true, pellets: 1,
    mag: 1, reserve: 0, reload: 0, reach: 2.3, arc: 0.75,
    spread: 0, moveSpread: 0, airSpread: 0, crouchMult: 1, adsMult: 1, perShot: 0, maxSpread: 0, spreadRecover: 1,
    recoil: 0, recoilH: 0, recoilRecover: 10, range: 2.3, minFalloff: 1, speed: 1.12,
    sound: { melee: true },
    model: { type: 'katana', body: 0xd9dde2, accent: 0x7a1d1d },
    bot: { pref: 1.6 },
    desc: 'Lâmina leve e veloz. Clique esquerdo corta em sequência; o direito desfere um golpe pesado. Golpes pelas costas causam o dobro de dano.',
  },
  nodachi: {
    id: 'nodachi', name: 'Nodachi Raijin', caliber: '—', optic: '—', rangeText: 'Até 2,9 m', category: 'Corpo a corpo', slot: 'melee', melee: true,
    damage: 75, heavyDamage: 130, headMult: 1, legMult: 1, rpm: 85, heavyRpm: 42, auto: true, pellets: 1,
    mag: 1, reserve: 0, reload: 0, reach: 2.9, arc: 0.85,
    spread: 0, moveSpread: 0, airSpread: 0, crouchMult: 1, adsMult: 1, perShot: 0, maxSpread: 0, spreadRecover: 1,
    recoil: 0, recoilH: 0, recoilRecover: 10, range: 2.9, minFalloff: 1, speed: 1.04,
    sound: { melee: true, heavy: true },
    model: { type: 'nodachi', body: 0xc9d4e0, accent: 0x1d2a4a },
    bot: { pref: 2.0 },
    desc: 'Espada longa de duas mãos: alcance maior e cortes devastadores, ao custo de golpes mais lentos.',
  },
};

export const PRIMARY_IDS = ['tempest', 'kestrel', 'ratel', 'longinus', 'm82', 'svd', 'spectre', 'lr50', 'bulldog', 'fulgor'];
// armas pesadas: aparecem no arsenal, mas só valem no modo história e no treino
export const HEAVY_IDS = ['m134', 'rpg'];
export const heavyAllowed = (mode) => mode === 'story' || mode === 'training';
// arma pesada fora do modo história e do treino: volta para o rifle padrão
export const safePrimary = (id, mode) => (WEAPONS[id] && WEAPONS[id].heavy && !heavyAllowed(mode) ? 'tempest' : id);
export const SECONDARY_IDS = ['vp9', 'brasa'];
export const MELEE_IDS = ['katana', 'nodachi'];

// Barras de atributos (0..1) para a tela de seleção de armas.
export function weaponStats(def) {
  if (def.melee) {
    return {
      Dano: Math.min(1, def.damage / 140),
      'Golpe pesado': Math.min(1, def.heavyDamage / 140),
      Velocidade: Math.min(1, def.rpm / 160),
      Alcance: Math.min(1, def.reach / 3.2),
      Mobilidade: Math.min(1, (def.speed - 0.75) / 0.4),
    };
  }
  const dps = (def.damage * def.pellets * def.rpm) / 60;
  const precision = 1 - Math.min(1, (def.spread + (def.pelletSpread || 0) + def.perShot * 6 + def.recoil * 0.01) / 0.12);
  return {
    Dano: Math.min(1, (def.damage * def.pellets) / 140),
    Cadência: Math.min(1, def.rpm / 900),
    'DPS': Math.min(1, dps / 340),
    Precisão: Math.max(0.05, precision),
    Alcance: Math.min(1, def.range / (def.zoom ? 600 : 60)),
    Mobilidade: Math.max(0.03, Math.min(1, (def.speed - 0.6) / 0.47)),
    Estabilidade: Math.max(0.05, 1 - Math.min(1, (def.moveSpread + def.airSpread * 0.4) / 0.32)),
    'Controle de recuo': Math.max(0.05, 1 - Math.min(1, def.recoil / 10)),
  };
}

export const MODE_INFO = {
  ffa: {
    name: 'Mata-mata',
    desc: 'Todos contra todos. Renascimento automático. Vence quem atingir o limite de eliminações ou liderar ao fim do tempo.',
  },
  team: {
    name: 'Equipe contra equipe',
    desc: 'Vanguarda contra Sentinela em rodadas de eliminação, sem renascimento durante a rodada. Vence a equipe que conquistar o número de rodadas definido.',
  },
  training: {
    name: 'Treinamento',
    desc: 'Campo livre contra bots que renascem continuamente. Munição de reserva infinita e estatísticas de precisão.',
  },
};

// Homenagem à turma: os nomes aparecem numa moldura na abertura do jogo e o mural com a foto
// da turma continua nos mapas (js/map.js). Os nomes não são mais usados como perfis nem pelos bots.
export const SCHOOL = 'Escola Estadual Cívico Militar Joaquim Nunes Rocha';
export const CLASSES = '1º, 2º e 3º ano PEG';
export const HONOREES = [
  'Ana', 'Carlos', 'Damarys', 'Daniel', 'David', 'Enzo', 'Eros', 'Gustavo Correa', 'Gustavo Luiz', 'Gustavo Hideki',
  'Jhon', 'João', 'Kayleb', 'Larissa', 'Luiz', 'Matheus', 'Rafael', 'Renato', 'Tamyris',
];

// Moldura de abertura: aparece a cada abertura do jogo, antes do menu; fecha com um toque,
// clique ou tecla. Devolve uma promessa resolvida quando a moldura some.
export function showHomageFrame() {
  return new Promise((resolve) => {
    if (new URLSearchParams(location.search).has('nohomage')) { resolve(); return; }
    const el = document.createElement('div');
    el.id = 'homage-frame';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Homenagem à turma');
    el.innerHTML = `
      <div class="hf-frame">
        <i class="hf-corner tl"></i><i class="hf-corner tr"></i><i class="hf-corner bl"></i><i class="hf-corner br"></i>
        <p class="hf-kicker">Homenagem</p>
        <h2 class="hf-title">VÉRTICE</h2>
        <p class="hf-school"></p>
        <p class="hf-classes"></p>
        <ul class="hf-names"></ul>
        <button class="btn primary hf-go" type="button">Entrar no jogo</button>
        <p class="hf-hint">Toque, clique ou pressione qualquer tecla</p>
      </div>`;
    el.querySelector('.hf-school').textContent = SCHOOL;
    el.querySelector('.hf-classes').textContent = `Alunos do ${CLASSES}`;
    const ul = el.querySelector('.hf-names');
    for (const n of HONOREES) { const li = document.createElement('li'); li.textContent = n; ul.appendChild(li); }
    document.body.appendChild(el);
    const t0 = performance.now();
    const close = (e) => {
      if (performance.now() - t0 < 600) return; // evita fechar com o clique que abriu a página
      if (e) e.preventDefault();
      window.removeEventListener('keydown', close, true);
      el.removeEventListener('pointerup', close);
      el.classList.add('out');
      setTimeout(() => { el.remove(); resolve(); }, 420);
    };
    el.addEventListener('pointerup', close);
    window.addEventListener('keydown', close, true);
  });
}

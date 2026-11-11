# VÉRTICE — FPS tático em HTML5

Jogo de tiro em primeira pessoa com rodadas, bots, cinco categorias de armas e um mapa 3D original (*Distrito Ferrugem*). Foi escrito em HTML, CSS e JavaScript, com renderização WebGL via Three.js. Texturas e sons são gerados por código: o projeto não depende de imagens nem de arquivos de áudio externos e funciona sem internet. Só as fontes vêm do Google Fonts; se elas não carregarem, o navegador usa fontes do sistema.

## Jogar online

O jogo está publicado no GitHub Pages: **https://profabraaojr.github.io/Vertice-PEG/**

Nesse endereço tudo funciona, inclusive o modo cooperativo. Não é preciso instalar nada: basta abrir o link no Chrome, Edge ou Firefox de um computador com teclado e mouse.

### Atualizar o jogo publicado

Envie as alterações para a branch `main`. O fluxo `.github/workflows/publicar.yml` copia a `main` para a branch `gh-pages`, de onde o GitHub Pages publica o site. A nova versão aparece no endereço em um ou dois minutos. Se o navegador ainda mostrar a versão antiga, recarregue com Ctrl+F5.

## Como executar

### Opção 1: arquivo único (mais simples)

Abra `dist/vertice.html` com um duplo clique. Não precisa de servidor, porque o arquivo já contém todo o código, o CSS e o Three.js.

### Opção 2: código-fonte modular (para estudar ou modificar)

Os módulos ES (`<script type="module">`) não carregam via `file://`, então é preciso um servidor local. Na pasta do projeto, rode:

```bash
python3 -m http.server 8000
```

Depois abra `http://localhost:8000` no navegador. Também funciona com `npx serve` ou com qualquer outro servidor estático.

### Gerar novamente o arquivo único

```bash
npm install
```

```bash
npm run build
```

Requer Node.js 18 ou mais recente. O script `build.mjs` empacota os módulos com esbuild e grava `dist/vertice.html`.

Navegadores recomendados: Chrome, Edge ou Firefox atualizados. Clique na tela para capturar o mouse; a tecla Esc libera o cursor e pausa a partida.

## Perfis

O jogo homenageia os alunos da Escola Estadual Cívico Militar Joaquim Nunes Rocha (1º, 2º e 3º ano PEG). Em **Perfil**, cada aluno escolhe o próprio nome entre os 19 perfis (Ana, Carlos, Damarys, Daniel, David, Enzo, Eros, Gustavo Correa, Gustavo Luiz, Gustavo Hideki, Jhon, João, Kayleb, Larissa, Luiz, Matheus, Rafael, Renato e Tamyris) e personaliza:

- tom de pele (7 opções);
- cor dos olhos (6);
- estilo de cabelo (8: raspado, curto, topete, cacheado, longo liso, rabo de cavalo, tranças e coque) e cor do cabelo (6);
- camuflagem da farda (6: mata, deserto, urbano, digital, tigrado e noturno).

O uniforme em si (colete, cinto, coturnos, luvas e as cores da equipe) é igual para todos; a camuflagem muda só a estampa da farda e das mangas. O personagem aparece em 3D, girando, com um close do rosto. As escolhas ficam salvas no navegador.

O nome do perfil ativo aparece no placar e no feed de eliminações. Os bots recebem os nomes dos demais alunos, com a aparência salva para cada um. No cooperativo, a aparência de cada jogador é enviada aos outros.

## Mapas

A tela **Jogar** (e a sala cooperativa) permite escolher entre quatro mapas, todos com 72 × 72 m e bases simétricas:

| Mapa | Ambiente |
|---|---|
| Distrito Ferrugem | Complexo industrial de dia: depósitos, escritórios e pátio de contêineres |
| Ferrugem à Noite | O mesmo distrito sob a lua, com postes e interiores iluminados. A tecla **X** liga os óculos de visão noturna, disponíveis só neste mapa. No escuro, os bots também enxergam menos |
| Selva Esmeralda | Clareiras entre árvores altas, moitas que escondem (mas não param balas), rochas e cabanas de bambu |
| Ruínas de Aruanã | Templo de pedra ao entardecer: colunatas, câmaras, muros em ruínas e pirâmides no horizonte |

## Cooperativo (até 4 jogadores)

Você e até três amigos jogam na mesma equipe contra bots, no modo equipe contra equipe ou no treinamento. A conexão é direta entre os navegadores (WebRTC) e não exige servidor:

1. O anfitrião abre **Cooperativo**, digita o nome, clica em **Criar sala** e envia o **convite** (um código que começa com `VTX`) por mensagem.
2. O convidado abre **Cooperativo → Entrar numa sala**, cola o convite, clica em **Gerar resposta** e devolve a resposta ao anfitrião.
3. O anfitrião cola a resposta e clica em **Conectar**. Quando o nome do amigo aparece na lista, a conexão está pronta. Para mais jogadores, use **Convidar outro jogador** e repita os passos.
4. O anfitrião escolhe modo, bots e dificuldade e clica em **Iniciar partida**.

O computador do anfitrião roda as regras, os bots e o dano; os convidados enviam movimento, mira e disparos, e recebem o estado do mundo cerca de 20 vezes por segundo. Por isso, o desempenho do anfitrião afeta todos, e a partida não pausa quando alguém abre o menu. Se o anfitrião sair, a sala se encerra.

Limitações conhecidas: a conexão direta depende das redes envolvidas. Em redes domésticas comuns costuma funcionar; redes corporativas, de escola ou algumas operadoras móveis podem bloqueá-la, porque o jogo não usa servidor de retransmissão (TURN). Os códigos valem para uma única conexão: se algo falhar, gere um novo convite. O movimento de cada convidado é decidido no próprio computador dele, o que pressupõe confiança entre os participantes.

## Controles

| Tecla | Ação |
|---|---|
| W A S D | Caminhar |
| Shift | Correr (não dispara enquanto corre) |
| C ou Ctrl | Agachar: mais precisão e passos silenciosos |
| Espaço | Pular (dá para subir em caixas baixas) |
| Mouse / botão esquerdo | Mirar / disparar |
| Botão direito | Mira de precisão; no rifle de precisão, alterna dois níveis de luneta |
| R | Recarregar |
| 1, 2, 3, Q, roda do mouse | Arma principal, secundária, espada, última arma |
| Com a espada | Esquerdo corta, direito desfere golpe pesado |
| F | Inspecionar a arma |
| X | Óculos de visão noturna (mapa noturno) |
| B | Seleção de armas |
| Tab | Placar |
| Esc | Pausa |

## O que está implementado

**Modos.** *Equipe contra equipe* (Vanguarda × Sentinela) em rodadas de eliminação, com fase de preparação, cronômetro de 1:55 e vitória por número de rodadas; quando o tempo acaba, vence a equipe com mais sobreviventes ou, em caso de empate, a que tem mais vida somada. *Mata-mata*, todos contra todos, com renascimento em pontos seguros e limite de eliminações ou de tempo. *Treinamento*, com bots que renascem continuamente, munição infinita, estatísticas de precisão e a opção de bots que não revidam.

**Armas.** Dez armas em sete categorias: pistolas (VP-9 e Brasa .50), submetralhadora (Ratel MK2), rifles de assalto (Tempest AR-K e Kestrel M7), rifle de precisão (Longinus .338), escopeta (Bulldog 12), energia (Manoplas Fulgor) e corpo a corpo (katanas Kaze e Nodachi Raijin). Cada uma tem dano, multiplicador na cabeça, cadência, pente, reserva, tempo de recarga, recuo vertical e horizontal, dispersão (que cresce com movimento, salto e disparos seguidos e diminui agachado ou mirando), queda de dano com a distância, mobilidade, modelo 3D e som próprios.

**Manoplas e katanas.** As Manoplas Fulgor são um par de luvas de energia que disparam feixes de luz alternando as mãos; o feixe não perde força com a distância, atravessa até três combatentes em linha (as paredes o detêm) e as células se recarregam com R. As espadas ocupam um terceiro espaço (tecla 3): o botão esquerdo corta em sequência, o direito desfere um golpe pesado, e um golpe pelas costas causa o dobro de dano. A Katana Kaze é leve e rápida; a Nodachi Raijin tem mais alcance e dano, com golpes mais lentos. Parte dos bots tem perfil de espadachim e avança com a lâmina.

**Jogabilidade.** Física de colisão por caixas alinhadas, subida em obstáculos baixos, agachamento com verificação de teto, corrida, passos audíveis, recuo que volta sozinho e pode ser compensado com o mouse, disparos instantâneos (hitscan) com caixas de acerto para cabeça, tronco e pernas, proteção breve ao renascer e câmera de morte. No modo por equipes, o jogador eliminado acompanha um colega.

**Bots.** Visão com campo de 120° e checagem de linha de visada; audição de disparos e de passos de corrida; navegação por A* na grade do mapa, com suavização do trajeto e detecção de travamento; tempo de reação, erro de mira que diminui enquanto acompanham o alvo, controle de recuo e rajadas variáveis conforme a dificuldade (Recruta, Soldado, Veterano, Elite); movimento lateral durante o combate, distância preferida por tipo de arma, recuo tático quando estão com pouca vida, troca para a pistola quando o pente acaba e reação ao dano, virando-se para quem atirou.

**Interface.** Mira dinâmica que abre conforme a dispersão real, marcador de acerto (na cabeça e eliminação), barra de vida, munição, arma equipada, barra de recarga, cronômetro, placar das equipes com indicadores de sobreviventes, radar giratório, feed de eliminações, indicador da direção do dano, vinheta de vida baixa, luneta e placar completo no Tab.

**Menus.** Tela inicial, seleção de partida (modo, quantidade de bots, dificuldade, limites), seleção de armas com atributos e silhueta, configurações gráficas (qualidade, escala de renderização, campo de visão, contador de FPS), volumes (geral, efeitos e música), sensibilidade do mouse e da luneta, inversão do eixo vertical, cor e estilo da mira, menu de pausa e tela de resultados. As preferências ficam salvas no navegador.

**Áudio.** Disparos sintetizados por arma, com ambiência, recargas em etapas, ferrolho e bombeamento, passos, impactos por material (concreto, madeira e metal), zunido de projéteis que passam perto, sons de interface e de rodada, posicionamento 3D dos sons dos bots e música generativa opcional.

**Otimização.** A geometria estática é unida por material (poucas chamadas de desenho), barris e marcas de bala são instanciados, partículas e traçantes vêm de conjuntos pré-alocados, as luzes de clarão são fixas (o que evita recompilar shaders) e há quatro níveis de qualidade, além da escala de renderização ajustável.

## Estrutura do código

```
index.html          telas, HUD e menus
css/style.css       identidade visual e layout responsivo
js/main.js          renderizador, laço principal, transições de estado
js/game.js          regras dos modos, rodadas, disparos, dano, renascimento
js/player.js        movimento, câmera, recuo e uso das armas pelo jogador
js/bot.js           percepção, navegação e combate dos bots
js/combatant.js     base comum (vida, armas, caixas de acerto)
js/weapon.js        munição, cadência, recarga e dispersão
js/config.js        armas, equipes, dificuldades, modos
js/map.js           layouts e temas dos quatro mapas, geometria, colisores, radar
js/physics.js       colisão e raycast contra o cenário
js/nav.js           A* e suavização de trajetos
js/guns.js          modelos detalhados das armas (perfis extrudados, materiais, reflexos)
js/preview.js       prévia 3D das armas no arsenal
js/models.js        modelos dos personagens (rosto, olhos, cabelo, farda)
js/profiles.js      perfis dos alunos, opções de aparência e camuflagens
js/viewmodel.js     arma em primeira pessoa e animações
js/effects.js       partículas, traçantes, marcas de bala, clarões
js/hud.js           interface durante a partida e radar
js/menu.js          navegação, seleção de armas, configurações
js/audio.js         síntese de efeitos e música (Web Audio)
js/input.js         teclado, mouse e captura do ponteiro
js/textures.js      texturas procedurais em canvas
js/settings.js      preferências persistentes
vendor/             Three.js r160 (licença MIT)
```

## Editando o mapa

Cada mapa é uma grade de caracteres em `js/map.js` (constantes `TOP_URBAN`, `TOP_JUNGLE` e `TOP_RUINS`), associada a um tema visual em `THEMES`. Cada caractere corresponde a 2 × 2 m: `#` parede, `w` janela, `d` porta, `x` caixa baixa, `X` pilha de caixas, `K` contêiner, `b` barris, `T` árvore, `o` coluna, `v` moita, `,` piso coberto, `.` piso externo, `Z` base da Sentinela. A metade inferior é gerada por espelhamento pontual, o que garante simetria entre as bases. Colisores, navegação dos bots, pontos de renascimento e radar são recalculados automaticamente.

## Parâmetro de depuração

`?nolock` na URL dispensa a captura do ponteiro, o que é útil em testes automatizados. No console, `window.__vertice` dá acesso ao estado do jogo.

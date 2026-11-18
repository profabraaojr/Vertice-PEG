# VÉRTICE — FPS tático em HTML5

Jogo de tiro em primeira pessoa com rodadas, bots, cinco categorias de armas e um mapa 3D original (*Distrito Ferrugem*). Foi escrito em HTML, CSS e JavaScript, com renderização WebGL via Three.js. Texturas e sons são gerados por código: o projeto não depende de imagens nem de arquivos de áudio externos e funciona sem internet. Só as fontes vêm do Google Fonts; se elas não carregarem, o navegador usa fontes do sistema.

## Jogar online

O jogo está publicado no GitHub Pages: **https://profabraaojr.github.io/Vertice-PEG/**

Nesse endereço tudo funciona, inclusive o modo cooperativo. Não é preciso instalar nada: basta abrir o link no Chrome, Edge ou Firefox de um computador com teclado e mouse.

### Celular e tablet

No celular, o jogo detecta a tela de toque e mostra controles na tela. No layout padrão (Clássico, destro):

- **polegar esquerdo:** joystick que aparece onde você toca. Empurrado até a borda para a frente, corre;
- **arrastar em área livre:** mira (também funciona arrastando sobre o botão FOGO);
- **botões à direita:** fogo, mira de precisão (luneta ou golpe pesado, conforme a arma), pular, agachar, recarregar e trocar arma. Há um segundo botão de fogo à esquerda;
- **botões no topo:** chat (multijogador), visão noturna (mapa noturno), armas, placar, tela cheia e pausa.

Ao tocar em Jogar, o jogo entra em tela cheia. Na primeira abertura no celular, a qualidade gráfica começa em Média para manter a fluidez; a sensibilidade da mira por arraste fica em Configurações → Controles.

#### Modo de controle

Em **Configurações → Controles → Modo de controle** há três opções:

- **Automático** (padrão): celulares e tablets (inclusive o iPad) abrem com controles na tela; computadores (Windows, Linux, macOS, ChromeOS) abrem no modo de teclado e mouse, mesmo quando têm tela sensível ao toque. Depois, o próprio uso corrige a escolha: um toque na tela liga os controles de toque, e mover o mouse ou apertar W, A, S ou D volta ao teclado e mouse. Com o mouse capturado na partida, um toque acidental na tela do notebook não troca os controles; ao voltar para o mouse no meio da partida, o jogo pausa para que um clique em Continuar capture o mouse de novo;
- **Controles de toque**: sempre mostra os controles na tela, sem capturar o mouse;
- **Modo PC**: sempre usa teclado e mouse, sem controles na tela (útil também em tablets com teclado e mouse).

A troca vale na hora, inclusive com a partida pausada, e fica salva no aparelho.

#### Personalizar controles

Em **Configurações → Controles → Personalizar controles** há um editor com uma simulação do celular:

- **arrastar** qualquer botão para outra posição e usar a alça verde para redimensioná-lo. Cada orientação (horizontal e vertical) guarda posições próprias;
- **por botão:** função, tamanho, opacidade, formato (circular, quadrado, arredondado, hexagonal), visibilidade e, no joystick e no FOGO, sensibilidade. Também é possível adicionar ou remover botões (por exemplo, botões diretos de arma principal, secundária e espada);
- **ajustes gerais:** escala de todos os botões, espaçamento, opacidade geral, tipo de movimento (joystick dinâmico, fixo ou botões direcionais) e orientação da partida (livre, só horizontal ou só vertical);
- **layouts prontos:** Clássico, Compacto e Ergonômico, cada um para destro, canhoto ou simétrico. Os layouts prontos se ajustam sozinhos para não haver botões sobrepostos em celulares pequenos ou tablets;
- **perfis:** cinco perfis iniciais (Celular pequeno, Celular grande, Modo canhoto, Modo destro, Personalizado), com criar, duplicar, renomear, excluir, exportar (arquivo JSON) e importar;
- **simulação:** este aparelho, celular pequeno, Android com barra de navegação, iPhone com recorte e tablet, nas duas orientações, com a área segura marcada. Botões sobrepostos aparecem em vermelho;
- **Testar comandos:** toca-se nos botões da simulação e o editor mostra o comando executado, sem afetar a partida;
- **Salvar** grava o perfil no aparelho e ativa-o na hora; **Restaurar padrão** volta ao Clássico destro. As posições são guardadas em coordenadas relativas à tela, e os botões nunca entram nas áreas de recorte ou nas barras do sistema.

### Instalar como aplicativo (iOS e Android)

O jogo é um aplicativo web instalável (PWA): ganha ícone na tela inicial, abre em tela cheia na horizontal e funciona sem internet depois da primeira abertura (o cooperativo precisa de internet).

- **Android (Chrome, Edge, Samsung Internet):** menu **Instalar no celular → Instalar agora**, ou no menu do navegador (⋮) → **Instalar app**.
- **iPhone e iPad:** abra o link no **Safari** → **Compartilhar** → **Adicionar à Tela de Início**. No iPhone, a tela cheia só existe com o app instalado, porque o Safari não a oferece para páginas.

Publicar nas lojas (Google Play e App Store) é possível a partir desta mesma versão, empacotando o aplicativo web, mas exige contas de desenvolvedor pagas e revisão das lojas.

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

## Modo História

Campanha individual do **Agente Falcão**, da unidade tática, com farda própria, contra a organização criminosa **Crakem**, liderada pelo terrorista **Vugo**. Os criminosos usam codinomes fictícios.

| Missão | Cenário | Objetivo |
|---|---|---|
| 1. Resgate no Distrito Ferrugem | Distrito Ferrugem (dia) | libertar 3 reféns, levá-los à viatura e neutralizar os sequestradores |
| 2. Contagem regressiva | Ferrugem à Noite | achar o artefato pelo sinal do detector e desarmá-lo antes do fim da contagem |
| 3. A caçada a Vugo | Selva Esmeralda | capturar Vugo vivo antes que ele alcance o barco |
| 4. Olho no alto | Ruínas de Aruanã | do alto, com o rifle de precisão, proteger a equipe até o templo e abater o atirador "Agulha" |

Regras comuns a todas as missões:

- **Voz de prisão:** mire num suspeito e pressione **E** (no celular, o botão **AÇÃO**). A chance de rendição é maior se ele estiver desprevenido, ferido, perto e sem comparsas ao lado. Criminosos muito feridos também podem se render sozinhos;
- **Algemar e interagir:** aproxime-se e **segure E** (algemar, libertar refém, abrir o painel do artefato);
- **Pontuação:** criminoso preso 400, rendido sem algemas 200, abatido 100, missão sem alarme 600, bônus de tempo; atirar em quem já se rendeu tira 500 ("uso excessivo da força"). Cada missão vale até três estrelas, e o melhor resultado fica salvo.

Detalhes de cada missão:

1. **Resgate:** se o alarme soar, o agente tem 90 segundos para libertar todos os reféns. Falha se um refém for atingido pelo agente ou se o tempo acabar.
2. **Bomba:** o artefato fica num de três prédios, sorteado a cada partida. O detector mostra a força do sinal e o bipe acelera com a proximidade; a Central dá pistas do setor. No painel, cortam-se os fios na ordem dos símbolos do visor (teclas 1 a 4 ou toque); um fio fora de ordem tira 25 segundos. Tempo: 5 min (Recruta), 4 min (Soldado), 3 min 10 s (Veterano).
3. **Captura:** Vugo foge quando percebe o agente. Os tiros o ferem, mas não o matam: ferido, ele se rende. Render Vugo sem disparar contra ele vale 500 pontos extras.
4. **Atirador de elite:** o agente começa no alto de um bloco de pedra com o Longinus .338. Camuflado, só é localizado por alguns segundos depois de cada disparo (ou se um criminoso chegar muito perto). A equipe avança de ponto em ponto quando o caminho está livre. Falha se toda a equipe cair ou se um civil for atingido.

Falhas comuns: o agente ser abatido.

## Luneta, vento e birutas

**Luneta.** Nos rifles de precisão, o botão direito (no celular, o botão LUNETA) alterna dois níveis de ampliação (no Longinus, cerca de 4× e 16×). A arma sobe até o olho, a imagem se fecha num túnel e a ampliação cresce suavemente; a precisão total vale quando a imagem estabiliza. O retículo depende do rifle (veja Rifles de precisão). No Longinus e no M82 é mil-dot de segundo plano focal, como nas lunetas táticas usadas no M82: fica fixo no centro, tem o mesmo tamanho nos dois níveis e, na ampliação máxima, cada ponto vale 1 mil (1 metro a 1.000 m, 10 cm a 100 m). Use os pontos para compensar o vento e a queda.

**Vento.** Toda partida tem vento, com direção e intensidade que mudam aos poucos: cada condição dura de 25 a 45 segundos e há pequenas rajadas naturais. O vento desvia os projéteis conforme o "atraso" do projétil no ar (lag = c · D² / v0), então o efeito cresce com o quadrado da distância: quase nada nos tiros curtos dos mapas e bastante no estande. A mira não corrige o vento automaticamente. No multijogador, o anfitrião envia o vento para todos.

**Birutas.** Há birutas em todos os mapas (sobre telhados, rochedos e ao longo da raia do estande). Elas mostram exatamente o vento usado pela física: apontam para onde o vento sopra, ficam murchas e penduradas sem vento, caídas no meio com vento moderado e esticadas na horizontal com vento forte, e tremulam mais quanto mais forte ele é. Não mostram números.

**Indicador na tela** (opcional, em Configurações → Interface): seta da direção relativa ao seu olhar e três barras (fraco, moderado, forte), sem números.

## Rifles de precisão

Cinco rifles de precisão, todos com luneta, retículo próprio, sons, recuo e animações independentes, e integrados ao vento e à balística. Os nomes indicam a inspiração sem reproduzir marcas.

| Rifle | Ação | Calibre | Luneta e retículo | Distância prevista |
|---|---|---|---|---|
| Longinus .338 | ferrolho | .338 Lapua Magnum | 4–16×, mil-dot | 30 a 300 m |
| M82 .50 BMG | semiautomática | .50 BMG | 4–18×, mil-dot; bipé e freio de boca | 100 a 1.000 m |
| SVD-63 | semiautomática | 7,62 × 54 mm R | tipo PSO 4–15×, montada à esquerda, com chevrons, escala de deriva e curva de distância | 50 a 600 m |
| Espectro .338 LM | ferrolho | .338 Lapua Magnum | tática 4–20×, retículo em árvore (mrad); chassi moderno e supressor | 100 a 1.200 m |
| Horizonte .50 LR | ferrolho | .50 BMG | 6–50× em três ampliações, retículo em árvore no primeiro plano focal | 1.000 a 2.000 m |

O M82 inspira-se no Barrett M82, o SVD-63 no Dragunov SVD e o Espectro na estética militar contemporânea de jogos de atirador de elite; o Horizonte é um projeto próprio para distâncias extremas. O M82 e o Horizonte atravessam dois alvos. O M82 recua com a culatra e o SVD com o ferrolho a cada tiro; o Espectro e o Horizonte exigem o ciclo do ferrolho (o do Horizonte é mais lento). O Espectro é suprimido: o disparo é um estalo abafado. A ficha de cada arma no arsenal mostra categoria, calibre, luneta, distância prevista, ação, ampliações e barras de dano, cadência, precisão, alcance, mobilidade, estabilidade e controle de recuo.

No retículo de primeiro plano focal (Horizonte), o desenho cresce com a ampliação e cada marca vale sempre 1 mil. Nos de segundo plano focal (os demais), o retículo tem tamanho fixo e está calibrado na ampliação máxima.

## Armas pesadas: Minigun M134 e bazuca

Duas armas restritas, com modelo, sons, recuo e animações próprios:

- **Minigun M134** (7,62 × 51 mm, seis canos): os canos precisam girar antes de disparar (cerca de meio segundo segurando o gatilho ou o botão direito, que só gira sem atirar). Dispara 1.500 tiros por minuto de uma cinta de 300, esquenta com rajadas longas (barra "CANOS" no HUD) e trava por superaquecimento até esfriar. Deixa o jogador lento (62% da velocidade) e não tem mira.
- **Bazuca** (foguete de 84 mm): o foguete voa a 48 m/s com leve queda e explode ao bater no cenário ou num combatente. O dano cai com a distância do centro (raio de 5,5 m), só atinge quem está à vista da explosão (paredes protegem) e fere também quem disparou muito perto, pela metade. Um foguete por recarga, cinco de reserva. A ogiva aparece no tubo quando ele está carregado.

**Onde usar:**

- **Modo história:** a tela da missão tem a opção **Arma principal** (padrão da missão, Minigun M134 ou bazuca), que vale para as quatro missões.
- **Treino:** escolha no arsenal.
- **Partidas (equipe e mata-mata, inclusive no multijogador):** as escolhas do arsenal não valem; o jogador entra com o Tempest. A **foto do professor** (Prof. Esp. Abraão Junio de Souza Costa) aparece emoldurada numa parede sorteada a cada partida; quem chegar perto e apertar **E** (no celular, **AÇÃO**) recebe a minigun. Uma **caixa de armamento** em outro local sorteado entrega a bazuca do mesmo jeito. Só uma pessoa por vez fica com cada arma; quando ela cai, perde a arma, e a foto (ou a caixa) reaparece em outro lugar depois de 8 segundos. Os bots não pegam essas armas.

No multijogador, o anfitrião sorteia os locais, decide quem pegou e resolve o dano das explosões; os convidados veem a foto, a caixa, os foguetes e as explosões conforme o anfitrião. Um convidado que declare uma arma pesada sem tê-la pegado aparece com o rifle padrão, e os foguetes dele são recusados.

## Centro de treinamento

No menu principal, **Centro de treinamento** leva a um complexo com duas áreas (dá para ir de uma à outra a pé):

**Estande de longa distância**
- Raia de 24 m de largura que sai do galpão de tiro e vai até uma barreira de terra a 230 m, com placas de distância e birutas.
- **Pista padrão:** alvos de aço com anéis de 1 a 10 pontos a 25, 50, 100, 150 e 200 m. Ao serem atingidos, balançam, e o "tim" do aço chega com atraso nas distâncias longas (velocidade do som).
- Painel de observação: mostra a face do alvo com os últimos impactos e diz a distância do centro (por exemplo, "6 cm abaixo, 4 cm à direita").
- **Balística básica:** o tiro segue reto até o alvo.
- **Pista extrema:** a barreira do fundo some e o terreno se abre até o horizonte; os alvos ficam a 500, 1.000, 1.500 e 2.000 m (diâmetros de 2 a 5,2 m), em ângulos diferentes para que nenhum encubra outro. O projétil leva segundos para chegar (cerca de 1,5 s a 1.000 m e 3,7 s a 2.000 m com o Horizonte .50): o acerto, ou a nuvem de poeira do erro, aparece depois do tempo de voo. Um observador informa o desvio em metros e em miliradianos, a unidade do retículo em árvore, para o ajuste do disparo seguinte. Birutas maiores ao longo da pista continuam legíveis pela luneta.
- **Rifle:** Longinus, M82 .50, SVD-63, Espectro .338 ou Horizonte .50; o menu mostra calibre, luneta e distância prevista de cada um.
- **Balística realista:** o projétil cai com a gravidade e é desviado pelo vento. A luneta vem zerada na distância padrão de cada rifle (Longinus 100 m, Espectro 200 m, M82 e SVD 300 m, Horizonte 1.000 m); a tecla Z ou o botão no painel muda a zeragem (100 a 2.000 m), como girar a torre de elevação. Com o Horizonte zerado a 1.000 m, o tiro a 2.000 m cai cerca de 44 m (22 mil), além do retículo: é preciso rezerar.
- **Vento** (cenários de treino): sem vento, fraco, moderado ou forte lateral, frontal, traseiro ou variável. A 200 m, o vento forte lateral desloca o impacto cerca de 36 cm (≈1,8 mil); a 25 m, menos de 1 cm.
- **Livre** ou **Desafio**: dois alvos por distância, da mais curta à mais longa, um disparo cada; os pontos do anel valem mais quanto maior a distância (na pista padrão, 25 m vale 1× e 200 m vale 8×; na extrema, 500 m vale 2× e 2.000 m vale 8×).

**Dojô · cortes em bambu**
- Doze suportes de bambu. Golpe leve corta na diagonal (alternando o lado); golpe pesado (botão direito ou MIRA) corta na horizontal. O corte acontece na altura da mira, a parte de cima cai, e o bambu é reposto quando fica curto.
- Katana ou nodachi (que alcança mais longe).
- **Livre** ou **Desafio de 60 segundos**: corte o bambu marcado com o tipo de corte pedido (100 pontos; tipo errado, 40). Cortes seguidos em até 2,5 s multiplicam os pontos, até 5×.

Os recordes dos desafios ficam salvos no aparelho.

## Homenagem e perfil

**Homenagem.** O jogo homenageia os alunos da Escola Estadual Cívico Militar Joaquim Nunes Rocha (1º, 2º e 3º ano PEG). A cada abertura, uma moldura mostra a escola, as turmas e os nomes dos 19 alunos (Ana, Carlos, Damarys, Daniel, David, Enzo, Eros, Gustavo Correa, Gustavo Luiz, Gustavo Hideki, Jhon, João, Kayleb, Larissa, Luiz, Matheus, Rafael, Renato e Tamyris); um toque, clique ou tecla a fecha. O mural com a foto da turma continua nos mapas. Os nomes não são usados como perfis nem pelos bots.

**Perfil.** Em **Perfil**, cada pessoa cria o próprio perfil:

- apelido de 2 a 16 caracteres (letras, números, espaço, ponto, hífen e sublinhado); palavrões e ofensas comuns são recusados, porque o apelido aparece para os outros jogadores;
- tom de pele (7 opções), cor dos olhos (6), estilo de cabelo (8) e cor do cabelo (6);
- camuflagem da farda (6: mata, deserto, urbano, digital, tigrado e noturno);
- **cabeça:** nenhum, capacete tático (corte alto, trilhos laterais e suporte para visão noturna), capacete antidistúrbio (cobre as orelhas, com viseira e proteção de nuca), capacete clássico (aba em volta) ou capuz de fleece com gola alta; os capacetes contornam o formato da cabeça e encaixam sobre a balaclava e as máscaras;
- **rosto:** nenhum, balaclava, máscara de tela ou máscara de gás (com dois filtros laterais e válvula central);
- **cor do equipamento** (5: preto, azul-marinho, cinza, verde-oliva e areia);
- **sigla SWAT** opcional no colete (costas e peito) e, com o capacete antidistúrbio, na viseira.

Todas as peças ficam livres desde o início. São só visuais: não protegem e não aparecem na visão em primeira pessoa. A máscara de gás não encaixa com o capuz nem com o capacete antidistúrbio (o editor bloqueia a combinação), e o cabelo fica escondido sob capacete, capuz ou balaclava. Metade dos bots também usa capacete ou máscara.

O uniforme em si (colete, cinto, coturnos, luvas e as cores da equipe) é igual para todos; a camuflagem muda só a estampa da farda e das mangas. O personagem aparece em 3D, girando, com um close do rosto. O perfil fica salvo só no navegador do aparelho e pode ser apagado a qualquer momento. Perfis de versões anteriores com nomes dos alunos são apagados automaticamente.

O apelido aparece no placar e no feed de eliminações e é o nome usado nas salas multijogador (um apelido recusado vira "Jogador N"). Os bots usam codinomes de bichos do Brasil (Raposa, Coruja, Jaguar…), com número quando há muitos ("Lobo 2"). No multijogador, a aparência de cada jogador é enviada aos outros.

## Níveis e ranking TOP 100

Cada partida concluída rende pontos: a missão cumprida vale a pontuação do relatório; o desafio do estande vale os pontos × 5, e o do dojô, os pontos; nas partidas (equipe ou mata-mata, contra bots ou no multijogador), cada eliminação vale 50, na cabeça mais 25, e a vitória 300. Missões falhadas, treino livre e partidas abandonadas não contam. Os pontos somam o **nível** (500 pontos para o nível 2, 2.000 para o 3, 4.500 para o 4…), salvo no aparelho e mostrado no menu e no fim de cada partida.

Com perfil criado, os pontos também vão para o **Ranking** (menu principal), que mostra os 100 primeiros com apelido, nível, pontos e partidas. O ranking usa um banco de dados no Supabase:

- O jogo usa só a chave pública (anon), que permite chamar três funções do banco e nada mais; a tabela não pode ser lida nem alterada diretamente.
- O servidor valida cada envio: limite por partida (história 6.000, treino 4.000, partidas 6.000), no máximo 120 pontos por segundo de jogo, um envio a cada 20 segundos e apelido válido.
- Cada aparelho tem um identificador e um segredo aleatórios; só o hash do segredo fica no servidor, então ninguém altera nem apaga o registro de outra pessoa. Em **Ranking → Remover meus dados do ranking**, a pessoa apaga o próprio registro.
- Como o jogo roda no navegador, alguém com conhecimento técnico ainda pode forjar pontuações dentro desses limites; registros suspeitos podem ser apagados no painel do Supabase (Table Editor → ranking).

**Ativação:** a chave pública já está em `js/ranking.js`. Falta executar o script `supabase/ranking.sql` no painel do projeto (SQL Editor → New query → Run); pelo celular, a página `supabase/` do site (https://profabraaojr.github.io/Vertice-PEG/supabase/) tem um botão para copiar o script, um link direto para o editor SQL e uma verificação do ranking. Até lá, o ranking aparece como "em preparação".

## Mapas

A tela **Jogar** (e a sala cooperativa) permite escolher entre quatro mapas, todos com 72 × 72 m e bases simétricas:

| Mapa | Ambiente |
|---|---|
| Distrito Ferrugem | Complexo industrial de dia: depósitos, escritórios e pátio de contêineres |
| Ferrugem à Noite | O mesmo distrito sob a lua, com postes e interiores iluminados. A tecla **X** liga os óculos de visão noturna, disponíveis só neste mapa. No escuro, os bots também enxergam menos |
| Selva Esmeralda | Clareiras entre árvores altas, moitas que escondem (mas não param balas), rochas e cabanas de bambu |
| Ruínas de Aruanã | Templo de pedra ao entardecer: colunatas, câmaras, muros em ruínas e pirâmides no horizonte |

## Multijogador (até 8 jogadores)

No menu **Multijogador**, qualquer jogador cria uma sala privada e vira o anfitrião. Os colegas entram com o **código de 6 caracteres** ou pelo **link de convite** (que já abre com o código preenchido). Cada sala comporta até 8 jogadores, em dois times de até 4.

**Na sala de espera:**

- todos veem quem entrou, em qual time e quem está pronto;
- cada jogador escolhe seu time (Vanguarda ou Sentinela) e marca **Estou pronto**;
- há um chat para combinar a partida;
- o anfitrião escolhe a modalidade, o formato, o mapa, a dificuldade dos bots e o número de rodadas, e inicia a partida quando todos estiverem prontos.

**Modalidades:**

| Modalidade | Como funciona |
|---|---|
| PvP | Os jogadores se dividem em dois times e competem entre si. Vagas vazias podem ser preenchidas por bots |
| Cooperativo | Até 4 jogadores na mesma equipe contra bots (1 a 8 inimigos), com opção de completar a equipe com bots aliados. Formatos: rodadas por eliminação ou treinamento com renascimento |

Durante a partida, **Enter** ou **T** abre o chat (no celular, o botão CHAT). No fim, todos voltam à sala com **Voltar à sala** e podem jogar de novo sem reconectar.

**Como funciona por dentro:** o computador do anfitrião roda as regras, os bots e o dano; os demais enviam movimento, mira, disparos e golpes, e recebem o estado do mundo cerca de 20 vezes por segundo. A conexão é direta entre os aparelhos (WebRTC). O serviço público e gratuito PeerJS (0.peerjs.com) só serve para encontrar a sala pelo código, e os servidores de retransmissão (TURN) do PeerJS entram em ação quando a rede bloqueia a conexão direta (comum em redes de escola e 4G).

**Limitações:**

- o anfitrião precisa manter o jogo aberto; se ele sair, a sala se encerra;
- o desempenho e a conexão do anfitrião afetam todos;
- o servidor de salas e os de retransmissão são gratuitos e mantidos pelo projeto PeerJS, sem garantia de disponibilidade. Se estiverem fora do ar, há uma **conexão alternativa sem servidor** (troca manual de códigos) na própria tela, que funciona melhor entre aparelhos da mesma rede;
- o movimento de cada jogador é decidido no próprio aparelho, o que pressupõe confiança entre os participantes.

## Segurança

Proteções em vigor (revisadas na verificação de segurança do projeto):

- **Sem segredos no código:** o repositório tem só a chave pública do Supabase, feita para ficar no site; tokens e chaves secretas nunca são gravados.
- **Sem injeção de código na página:** apelidos, chat e ranking são exibidos como texto, nunca como HTML.
- **Multijogador (o anfitrião é a autoridade):** cada mensagem de um convidado é conferida. Números inválidos e mensagens grandes demais são descartados. Os disparos respeitam a cadência e o pente de cada arma, e só valem com as armas do equipamento do convidado (ou com a arma pesada que ele pegou). O deslocamento é limitado à velocidade máxima de corrida, sem teletransporte, e as trocas de armas aceitam só armas existentes, cada uma na sua categoria.
- **Nomes e chat:** o nome de quem entra na sala passa pelo mesmo filtro do apelido (um nome recusado vira "Jogador N"); no chat, palavras ofensivas viram asteriscos, e cada convidado envia no máximo uma mensagem por segundo (cinco a cada dez segundos).
- **Ranking:** o servidor valida cada envio (ver *Níveis e ranking TOP 100*): limite por partida, no máximo 120 pontos por segundo medidos pelo relógio do servidor, 60.000 pontos por dia por jogador, 60 jogadores novos por hora, apelidos ofensivos recusados e o registro de cada aparelho protegido por um segredo próprio.
- **Publicação:** o workflow do GitHub usa a ação de checkout fixada pelo código da versão.

Limites conhecidos: como o jogo roda no navegador, quem altera o próprio jogo ainda consegue, por exemplo, mirar automaticamente; o anfitrião confia na direção dos tiros informada pelos convidados. No multijogador, os aparelhos se conectam diretamente (WebRTC), então os jogadores de uma sala podem ver o endereço IP uns dos outros. O site carrega fontes do Google. Os nomes dos alunos na moldura de homenagem e o mural da turma são públicos; recomenda-se manter a autorização da escola ou dos responsáveis.

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
| E | Modo história: voz de prisão (mirando) · segurar para algemar ou libertar refém |
| X | Óculos de visão noturna (mapa noturno) |
| B | Seleção de armas |
| Tab | Placar |
| Esc | Pausa |

## O que está implementado

**Modos.** *Equipe contra equipe* (Vanguarda × Sentinela) em rodadas de eliminação, com fase de preparação, cronômetro de 1:55 e vitória por número de rodadas; quando o tempo acaba, vence a equipe com mais sobreviventes ou, em caso de empate, a que tem mais vida somada. *Mata-mata*, todos contra todos, com renascimento em pontos seguros e limite de eliminações ou de tempo. *Treinamento*, com bots que renascem continuamente, munição infinita, estatísticas de precisão e a opção de bots que não revidam.

**Armas.** Dezesseis armas em nove categorias, incluindo as armas pesadas restritas (Minigun M134 e bazuca): pistolas (VP-9 e Brasa .50), submetralhadora (Ratel MK2), rifles de assalto (Tempest AR-K e Kestrel M7), rifles de precisão (Longinus .338, M82 .50 BMG, SVD-63, Espectro .338 LM e Horizonte .50 LR), escopeta (Bulldog 12), energia (Manoplas Fulgor) e corpo a corpo (katanas Kaze e Nodachi Raijin). Cada uma tem dano, multiplicador na cabeça, cadência, pente, reserva, tempo de recarga, recuo vertical e horizontal, dispersão (que cresce com movimento, salto e disparos seguidos e diminui agachado ou mirando), queda de dano com a distância, mobilidade, modelo 3D e som próprios.

**Mãos em primeira pessoa.** As mãos usam luvas táticas montadas por código: cada dedo tem três falanges que afinam da base à ponta, levemente achatadas, com saliência e vinco nas articulações, protetores de borracha nos nós e pontas reforçadas; a palma tem o volume das bases do polegar e do mínimo, e o dorso é abaulado. O tecido tem trama fina, costuras, vincos de dobra e um brilho rasante que contorna os dedos. Os dedos se fecham junta por junta até encostar na arma (punho, guarda-mão, cabo ou barra de apoio), então a pegada se adapta a cada modelo.

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
js/rifles.js        modelos dos rifles M82, SVD-63, Espectro e Horizonte
js/heavy.js         modelos da Minigun M134 (canos giratórios) e da bazuca
js/ordnance.js      foguetes, explosões, foto do professor e caixa de armamento
js/ranking.js       pontos, níveis e ranking TOP 100 (Supabase)
supabase/ranking.sql tabela e funções do ranking (executar no painel do Supabase)
js/preview.js       prévia 3D das armas no arsenal
js/models.js        modelos dos personagens (rosto, olhos, cabelo, farda)
js/profiles.js      perfil do jogador (apelido, validação, aparência) e camuflagens
js/homage.js        homenagem à turma: nomes e moldura de abertura
js/touch.js         controles de toque (joystick, mira por arraste, botões) a partir do layout ativo
js/touchlayout.js   comandos, layouts prontos, perfis, geometria e exportação dos controles de toque
js/controleditor.js editor "Personalizar controles"
js/story.js         modo história: campanha, motor de missões, rendição, prisão, reféns e relatório
js/hands.js         mãos enluvadas articuladas da visão em primeira pessoa (falanges, articulações, tecido)
js/training.js      centro de treinamento: estande de longa distância e dojô de bambus
js/scope.js         luneta: ocular, retículos (mil-dot, PSO, árvore; segundo ou primeiro plano focal) e transição
js/wind.js          vento dinâmico, desvio balístico, birutas e indicador
js/pwa.js           instalação como aplicativo e registro do service worker
js/lobby.js         sala de espera: times, pronto, configurações do anfitrião e chat
js/chat.js          chat durante a partida
vendor/peerjs.min.js  biblioteca PeerJS (salas por código e retransmissão)
sw.js               service worker (cache para abrir sem internet)
manifest.webmanifest  dados do aplicativo instalável (nome, ícones, tela cheia)
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

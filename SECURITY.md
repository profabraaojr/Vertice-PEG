# Política de segurança

## Versão com suporte

Só a versão publicada no GitHub Pages (branch `main`) recebe correções:
https://profabraaojr.github.io/Vertice-PEG/

## Como relatar uma vulnerabilidade

**Não abra uma issue pública.** Use o botão **Report a vulnerability** na aba
**Security** deste repositório (relato privado). Descreva o problema, como
reproduzi-lo e o impacto que você observou.

- Confirmação do recebimento: em até 72 horas.
- Correção ou resposta com um plano: em até 30 dias.
- Quem relatar será creditado na correção, se quiser.

## Escopo

Cobertos:

- código do jogo (js/, index.html, sw.js) e o arquivo compilado (dist/);
- funções e regras do banco do ranking (supabase/ranking.sql);
- validação das mensagens do multijogador (o anfitrião é a autoridade);
- workflows do GitHub Actions;
- qualquer exposição de dados pessoais (prioridade máxima, principalmente se
  envolver alunos).

Fora do escopo:

- trapaças feitas no próprio navegador sem afetar outros jogadores
  (por exemplo, alterar o próprio nível salvo no aparelho);
- falhas dos serviços de terceiros (GitHub, Supabase, servidores do PeerJS,
  Google Fonts), que devem ser relatadas a eles;
- ataques de negação de serviço, engenharia social e testes que exijam acesso
  a contas de outras pessoas.

## Porto seguro

Pesquisas feitas de boa-fé, sem prejudicar outros jogadores, sem acessar,
alterar ou apagar dados de terceiros e sem interromper o serviço, não serão
alvo de nenhuma medida. Não use pontuações forjadas no ranking público para
testar: use um apelido de teste e apague o registro em seguida
(Ranking → Remover meus dados do ranking).

## Medidas em vigor

As proteções atuais estão descritas na seção **Segurança** do README.

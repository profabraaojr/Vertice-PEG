# Componentes de terceiros

## three.js 0.187.0 — vendor/three.module.min.js

Licença MIT. Copyright © 2010-2025 three.js authors.
A partir da versão 0.17x o pacote não traz mais o arquivo minificado; `vendor/three.module.min.js`
é gerado com `npm run vendor:three` (esbuild junta `three.module.js` e `three.core.js` do pacote
oficial num único arquivo minificado, sem alterar o código).
https://github.com/mrdoob/three.js — o texto completo da licença acompanha o
pacote `three` no npm (arquivo LICENSE).

## PeerJS 1.5.5 — vendor/peerjs.min.js

Licença MIT. Copyright © 2015 Michelle Bu and Eric Zhang, http://peerjs.com
https://github.com/peers/peerjs — o texto completo da licença acompanha o
pacote `peerjs` no npm (arquivo LICENSE).

## Fontes Chakra Petch e Inter (Google Fonts)

Carregadas de fonts.googleapis.com. Licença SIL Open Font License 1.1.

## esbuild (somente para gerar dist/vertice.html; não é distribuído no jogo)

Licença MIT.

A integridade dos arquivos em vendor/ pode ser conferida com
`sha256sum -c CHECKSUMS` dentro da pasta vendor. O PeerJS é idêntico ao arquivo do pacote
oficial do npm; o three.js é o resultado de `npm run vendor:three` sobre o pacote oficial.

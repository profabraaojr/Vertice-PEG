// Gera dist/vertice.html: jogo completo em um único arquivo, que abre direto no navegador (file://).
import { build } from 'esbuild';
import fs from 'node:fs';

const result = await build({
  entryPoints: ['js/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  write: false,
  legalComments: 'none',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync('css/style.css', 'utf8');
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace('<link rel="stylesheet" href="css/style.css">', () => `<style>\n${css}\n</style>`);
html = html.replace(/\s*<script type="importmap">[\s\S]*?<\/script>/, '');
html = html.replace('<script type="module" src="js/main.js"></script>', () => `<script>\n${js}\n</script>`);
// biblioteca de salas (PeerJS) embutida para o arquivo único funcionar sem os outros arquivos
const peer = fs.readFileSync('vendor/peerjs.min.js', 'utf8').replace(/<\/script/gi, '<\\/script');
html = html.replace('<script src="vendor/peerjs.min.js"></script>', () => `<script>\n${peer}\n</script>`);
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/vertice.html', html);
console.log(`dist/vertice.html gerado (${(html.length / 1024).toFixed(0)} KB)`);

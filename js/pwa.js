// Aplicativo instalável (PWA): registro do service worker e convite de instalação.
// No Android (Chrome, Edge, Samsung Internet) o navegador oferece o botão de instalar;
// no iPhone e no iPad a instalação é pelo menu Compartilhar → "Adicionar à Tela de Início".

export const pwa = {
  prompt: null, // evento beforeinstallprompt guardado para usar num clique
  installed: false,
  onChange: null,
};

export function isStandalone() {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
  } catch (e) {
    return false;
  }
}

export function platform() {
  const ua = navigator.userAgent || '';
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/i.test(ua) || iPadOS) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export function setupPWA() {
  let embedded = false;
  try { embedded = window.self !== window.top; } catch (e) { embedded = true; }
  // service worker: guarda os arquivos para abrir mais rápido e funcionar sem internet
  if ('serviceWorker' in navigator && window.isSecureContext && location.protocol !== 'file:' && !embedded) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* sem cache offline; o jogo funciona igual */ });
    });
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pwa.prompt = e;
    if (pwa.onChange) pwa.onChange();
  });
  window.addEventListener('appinstalled', () => {
    pwa.prompt = null;
    pwa.installed = true;
    if (pwa.onChange) pwa.onChange();
  });
}

// Abre o diálogo de instalação do navegador. Retorna 'accepted', 'dismissed' ou 'unavailable'.
export async function promptInstall() {
  if (!pwa.prompt) return 'unavailable';
  const e = pwa.prompt;
  pwa.prompt = null;
  e.prompt();
  try {
    const choice = await e.userChoice;
    if (pwa.onChange) pwa.onChange();
    return choice.outcome;
  } catch (err) {
    return 'dismissed';
  }
}

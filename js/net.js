// Rede cooperativa: conexão direta entre navegadores (WebRTC) com troca manual de códigos.
//
// Não há servidor de jogo. O anfitrião gera um "convite" (oferta WebRTC compactada),
// o convidado responde com outro código (resposta WebRTC) e a conexão se estabelece.
// Servidores STUN públicos só ajudam cada navegador a descobrir o próprio endereço.

const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
export const MAX_GUESTS = 3;

function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function encode(obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream !== 'undefined') {
    const stream = new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'));
    const buf = new Uint8Array(await new Response(stream).arrayBuffer());
    return `VTX1.${toB64(buf)}`;
  }
  return `VTX0.${toB64(raw)}`;
}

async function decode(code) {
  const str = String(code || '').replace(/\s+/g, '');
  const m = /^VTX([01])\.(.+)$/.exec(str);
  if (!m) throw new Error('Código inválido. Copie o texto completo, começando por VTX.');
  let bytes = fromB64(m[2]);
  if (m[1] === '1') {
    if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador não consegue ler o código compactado.');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

// Espera a coleta de candidatos ICE terminar (os códigos levam os endereços embutidos).
function waitIce(pc, timeout = 5000) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => { pc.removeEventListener('icegatheringstatechange', check); resolve(); };
    const check = () => { if (pc.iceGatheringState === 'complete') done(); };
    pc.addEventListener('icegatheringstatechange', check);
    setTimeout(done, timeout);
  });
}

// Páginas publicadas no claude.ai rodam num quadro protegido que bloqueia WebRTC.
export const EMBEDDED = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
export const BLOCKED_MSG = 'O cooperativo não funciona dentro da página publicada no claude.ai, que bloqueia conexões diretas entre navegadores. Abra o arquivo vertice.html direto no navegador (Chrome, Edge ou Firefox) e use o Cooperativo por ele.';

function newPeerConnection() {
  if (typeof RTCPeerConnection === 'undefined') throw new Error(EMBEDDED ? BLOCKED_MSG : 'Este navegador não oferece conexão direta (WebRTC). Use Chrome, Edge ou Firefox atualizados.');
  try {
    return new RTCPeerConnection({ iceServers: ICE });
  } catch (e) {
    throw new Error(EMBEDDED ? BLOCKED_MSG : `O navegador recusou a conexão direta: ${e.message}`);
  }
}

// Sem nenhum endereço (candidato ICE) no código, o outro lado não teria como se conectar.
function checkCandidates(sdp) {
  if (!/a=candidate:/.test(sdp)) throw new Error(EMBEDDED ? BLOCKED_MSG : 'O navegador não informou nenhum endereço de rede. Verifique se alguma extensão ou configuração bloqueia WebRTC e tente de novo.');
}

export class Net {
  constructor() {
    this.role = null; // 'host' | 'guest' | null
    this.peers = new Map(); // anfitrião: id -> { id, pc, ctrl, fast, name, loadout, open }
    this.host = null; // convidado: { pc, ctrl, fast }
    this.myId = 0;
    this.myName = 'Jogador';
    this.nextId = 1;
    this.onMessage = null; // (peerId, msg) — no convidado, peerId = 0 (anfitrião)
    this.onPeersChange = null;
    this.onStatus = null; // convidado: texto de estado
    this.onHostLost = null;
    this.onPeerLost = null;
  }

  get active() { return this.role !== null; }
  get connectedPeers() { return [...this.peers.values()].filter((p) => p.open); }

  setupChannel(ch, peerId, kind, peer) {
    ch.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch (err) { return; }
      if (this.role === 'host' && msg.t === 'hello') {
        peer.name = String(msg.name || `Jogador ${peerId + 1}`).slice(0, 18);
        peer.loadout = msg.loadout;
        peer.look = msg.look || null;
        peer.open = true;
        if (this.onPeersChange) this.onPeersChange();
        return;
      }
      if (this.onMessage) this.onMessage(peerId, msg);
    };
    if (kind === 'ctrl') {
      ch.onopen = () => {
        if (this.role === 'guest') {
          this.send(this.host, { t: 'hello', name: this.myName, loadout: this.myLoadout, look: this.myLook || null });
          if (this.onStatus) this.onStatus('connected');
        }
      };
      ch.onclose = () => this.lost(peerId);
    }
  }

  lost(peerId) {
    if (this.role === 'host') {
      const p = this.peers.get(peerId);
      if (!p) return;
      const was = p.open;
      this.peers.delete(peerId);
      try { p.pc.close(); } catch (e) { /* já fechado */ }
      if (this.onPeersChange) this.onPeersChange();
      if (was && this.onPeerLost) this.onPeerLost(peerId, p.name);
    } else if (this.role === 'guest' && this.host) {
      try { this.host.pc.close(); } catch (e) { /* já fechado */ }
      this.host = null;
      this.role = null;
      if (this.onHostLost) this.onHostLost();
    }
  }

  watch(pc, peerId) {
    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.lost(peerId);
    });
  }

  // ---------- anfitrião ----------
  async createInvite(name) {
    this.role = 'host';
    this.myName = name;
    // descarta convites antigos que nunca foram respondidos
    for (const p of [...this.peers.values()]) if (!p.open && !p.answered) { try { p.pc.close(); } catch (e) { /* */ } this.peers.delete(p.id); }
    if (this.connectedPeers.length >= MAX_GUESTS) throw new Error(`Limite de ${MAX_GUESTS} convidados atingido.`);
    const pc = newPeerConnection();
    const id = this.nextId++;
    const peer = { id, pc, name: `Jogador ${id + 1}`, loadout: null, open: false, answered: false };
    peer.ctrl = pc.createDataChannel('ctrl', { ordered: true });
    peer.fast = pc.createDataChannel('fast', { ordered: false, maxRetransmits: 0 });
    this.setupChannel(peer.ctrl, id, 'ctrl', peer);
    this.setupChannel(peer.fast, id, 'fast', peer);
    this.watch(pc, id);
    this.peers.set(id, peer);
    await pc.setLocalDescription(await pc.createOffer());
    await waitIce(pc);
    try { checkCandidates(pc.localDescription.sdp); } catch (e) { this.peers.delete(id); pc.close(); throw e; }
    return encode({ t: 'offer', id, sdp: pc.localDescription.sdp });
  }

  async acceptAnswer(code) {
    const m = await decode(code);
    if (m.t !== 'answer') throw new Error('Este código não é uma resposta de convidado.');
    const peer = this.peers.get(m.id);
    if (!peer) throw new Error('Esta resposta corresponde a um convite antigo. Gere um novo convite.');
    if (peer.answered) throw new Error('Esta resposta já foi usada.');
    peer.answered = true;
    await peer.pc.setRemoteDescription({ type: 'answer', sdp: m.sdp });
  }

  // ---------- convidado ----------
  async joinWithInvite(code, name, loadout, look = null) {
    const m = await decode(code);
    if (m.t !== 'offer') throw new Error('Este código não é um convite de anfitrião.');
    this.close();
    this.role = 'guest';
    this.myName = name;
    this.myLoadout = loadout;
    this.myLook = look;
    this.myId = m.id;
    const pc = newPeerConnection();
    this.host = { pc, ctrl: null, fast: null };
    pc.ondatachannel = (e) => {
      const ch = e.channel;
      if (ch.label === 'ctrl') this.host.ctrl = ch; else this.host.fast = ch;
      this.setupChannel(ch, 0, ch.label, this.host);
    };
    this.watch(pc, 0);
    await pc.setRemoteDescription({ type: 'offer', sdp: m.sdp });
    await pc.setLocalDescription(await pc.createAnswer());
    await waitIce(pc);
    checkCandidates(pc.localDescription.sdp);
    if (this.onStatus) this.onStatus('waiting');
    return encode({ t: 'answer', id: m.id, sdp: pc.localDescription.sdp });
  }

  // ---------- envio ----------
  send(peer, msg, fast = false) {
    if (!peer) return;
    const ch = fast ? peer.fast : peer.ctrl;
    if (!ch || ch.readyState !== 'open') return;
    try { ch.send(typeof msg === 'string' ? msg : JSON.stringify(msg)); } catch (e) { /* canal saturado ou fechado */ }
  }

  sendTo(peerId, msg, fast = false) { this.send(this.peers.get(peerId), msg, fast); }

  broadcast(msg, fast = false, exceptId = null) {
    const data = JSON.stringify(msg);
    for (const p of this.peers.values()) if (p.open && p.id !== exceptId) this.send(p, data, fast);
  }

  toHost(msg, fast = false) { this.send(this.host, msg, fast); }

  close() {
    for (const p of this.peers.values()) { try { this.send(p, { t: 'bye' }); p.pc.close(); } catch (e) { /* */ } }
    this.peers.clear();
    if (this.host) { try { this.host.pc.close(); } catch (e) { /* */ } }
    this.host = null;
    this.role = null;
    this.nextId = 1;
  }
}

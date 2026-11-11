// Rede cooperativa: conexão direta entre navegadores (WebRTC) com troca manual de códigos.
//
// Não há servidor de jogo. O anfitrião gera um "convite" (oferta WebRTC compactada),
// o convidado responde com outro código (resposta WebRTC) e a conexão se estabelece.
// Servidores STUN públicos só ajudam cada navegador a descobrir o próprio endereço.

const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
export const MAX_GUESTS = 7; // sala com até 8 jogadores (2 times de 4)
const ROOM_PREFIX = 'vertice-peg-sala-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem letras e números parecidos (O/0, I/1)

export function newRoomCode() {
  let c = '';
  const r = new Uint32Array(6);
  crypto.getRandomValues(r);
  for (const v of r) c += CODE_CHARS[v % CODE_CHARS.length];
  return c;
}
export const normalizeCode = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

// Canal de dados do PeerJS com a mesma interface de um RTCDataChannel (onmessage, onopen, send, readyState).
function wrapConn(conn) {
  const ch = {
    conn,
    onmessage: null,
    onopen: null,
    onclose: null,
    get readyState() { return conn.open ? 'open' : 'connecting'; },
    send(data) { conn.send(data); },
    close() { try { conn.close(); } catch (e) { /* já fechado */ } },
  };
  conn.on('data', (d) => { if (ch.onmessage) ch.onmessage({ data: typeof d === 'string' ? d : JSON.stringify(d) }); });
  conn.on('open', () => { if (ch.onopen) ch.onopen(); });
  conn.on('close', () => { if (ch.onclose) ch.onclose(); });
  conn.on('error', () => { if (ch.onclose) ch.onclose(); });
  return ch;
}

function peerLib() {
  const lib = window.peerjs;
  if (!lib || !lib.Peer) throw new Error('Não foi possível carregar o módulo de salas. Verifique a internet e recarregue a página.');
  return lib.Peer;
}

const PEER_ERRORS = {
  'peer-unavailable': 'Sala não encontrada. Confira o código ou peça um convite novo ao anfitrião.',
  'network': 'Sem conexão com o servidor de salas. Verifique a internet e tente de novo.',
  'server-error': 'O servidor de salas não respondeu. Tente de novo em instantes.',
  'socket-error': 'Sem conexão com o servidor de salas. Verifique a internet e tente de novo.',
  'browser-incompatible': 'Este navegador não permite partidas online. Use Chrome, Edge, Firefox ou Safari atualizados.',
  'webrtc': 'A conexão entre os aparelhos falhou. Tente de novo ou use outra rede.',
};
const peerError = (err) => new Error(PEER_ERRORS[err && err.type] || `Falha na conexão: ${(err && (err.type || err.message)) || 'desconhecida'}.`);

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
      try { if (p.pc) p.pc.close(); } catch (e) { /* já fechado */ }
      for (const ch of [p.ctrl, p.fast]) if (ch && ch.close && !p.pc) ch.close();
      if (this.onPeersChange) this.onPeersChange();
      if (was && this.onPeerLost) this.onPeerLost(peerId, p.name);
    } else if (this.role === 'guest' && this.host) {
      try { if (this.host.pc) this.host.pc.close(); } catch (e) { /* já fechado */ }
      for (const ch of [this.host.ctrl, this.host.fast]) if (ch && ch.close && !this.host.pc) ch.close();
      if (this.peer) { try { this.peer.destroy(); } catch (e) { /* */ } this.peer = null; }
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

  // ---------- salas por código (servidor público de sinalização + retransmissão TURN) ----------
  // Cria a sala e devolve o código de 6 caracteres. Os convidados entram só com o código.
  async createRoom(name) {
    const Peer = peerLib();
    this.close();
    this.role = 'host';
    this.myName = name;
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = newRoomCode();
      try {
        const peer = await new Promise((resolve, reject) => {
          const pr = new Peer(ROOM_PREFIX + code, { debug: 0 });
          const t = setTimeout(() => { pr.destroy(); reject(new Error(PEER_ERRORS.network)); }, 15000);
          pr.on('open', () => { clearTimeout(t); resolve(pr); });
          pr.on('error', (err) => { clearTimeout(t); pr.destroy(); reject(err.type === 'unavailable-id' ? Object.assign(new Error('id'), { retry: true }) : peerError(err)); });
        });
        this.peer = peer;
        this.roomCode = code;
        peer.on('connection', (conn) => this.acceptConn(conn));
        // se a ligação com o servidor cair, as partidas em andamento continuam; reconecta para aceitar novos jogadores
        peer.on('disconnected', () => { try { if (!peer.destroyed) peer.reconnect(); } catch (e) { /* */ } });
        peer.on('error', () => { /* erros de convidados individuais são tratados em cada conexão */ });
        return code;
      } catch (e) {
        lastErr = e;
        if (!e.retry) break;
      }
    }
    this.role = null;
    throw lastErr && !lastErr.retry ? lastErr : new Error(PEER_ERRORS['server-error']);
  }

  acceptConn(conn) {
    const remote = conn.peer;
    let peer = [...this.peers.values()].find((p) => p.remote === remote);
    if (!peer) {
      if (this.peers.size >= MAX_GUESTS) {
        conn.on('open', () => { try { conn.send(JSON.stringify({ t: 'full' })); } catch (e) { /* */ } setTimeout(() => conn.close(), 800); });
        return;
      }
      const id = this.nextId++;
      peer = { id, remote, name: `Jogador ${id + 1}`, loadout: null, open: false, answered: true, via: 'room' };
      this.peers.set(id, peer);
    }
    const ch = wrapConn(conn);
    const label = conn.label === 'fast' ? 'fast' : 'ctrl';
    peer[label] = ch;
    this.setupChannel(ch, peer.id, label, peer);
  }

  // Entra na sala do código informado. Resolve quando o anfitrião aceitar a conexão.
  async joinRoom(code, name, loadout, look = null) {
    const Peer = peerLib();
    code = normalizeCode(code);
    if (code.length !== 6) throw new Error('O código da sala tem 6 caracteres.');
    this.close();
    this.role = 'guest';
    this.myName = name;
    this.myLoadout = loadout;
    this.myLook = look;
    this.roomCode = code;
    if (this.onStatus) this.onStatus('joining');
    try {
      const peer = await new Promise((resolve, reject) => {
        const pr = new Peer({ debug: 0 });
        const t = setTimeout(() => { pr.destroy(); reject(new Error(PEER_ERRORS.network)); }, 15000);
        pr.on('open', () => { clearTimeout(t); resolve(pr); });
        pr.on('error', (err) => { clearTimeout(t); pr.destroy(); reject(peerError(err)); });
      });
      this.peer = peer;
      await new Promise((resolve, reject) => {
        const target = ROOM_PREFIX + code;
        const ctrl = wrapConn(peer.connect(target, { label: 'ctrl', reliable: true, serialization: 'raw' }));
        const fast = wrapConn(peer.connect(target, { label: 'fast', reliable: false, serialization: 'raw' }));
        this.host = { ctrl, fast, via: 'room' };
        this.setupChannel(fast, 0, 'fast', this.host);
        this.setupChannel(ctrl, 0, 'ctrl', this.host);
        const prevOpen = ctrl.onopen;
        const t = setTimeout(() => reject(new Error('Não foi possível entrar na sala. O anfitrião pode estar numa rede que bloqueia a conexão. Tentem de novo ou usem outra rede.')), 20000);
        ctrl.onopen = () => { clearTimeout(t); prevOpen(); resolve(); };
        peer.on('error', (err) => { clearTimeout(t); reject(peerError(err)); });
      });
    } catch (e) {
      this.close();
      throw e;
    }
  }

  // ---------- conexão manual (alternativa sem servidor) ----------
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
    for (const p of this.peers.values()) {
      try { this.send(p, { t: 'bye' }); } catch (e) { /* */ }
      try { if (p.pc) p.pc.close(); else for (const ch of [p.ctrl, p.fast]) if (ch && ch.close) ch.close(); } catch (e) { /* */ }
    }
    this.peers.clear();
    if (this.host) {
      try { if (this.host.pc) this.host.pc.close(); else for (const ch of [this.host.ctrl, this.host.fast]) if (ch && ch.close) ch.close(); } catch (e) { /* */ }
    }
    this.host = null;
    if (this.peer) { const pr = this.peer; this.peer = null; setTimeout(() => { try { pr.destroy(); } catch (e) { /* */ } }, 300); }
    this.roomCode = null;
    this.role = null;
    this.nextId = 1;
  }
}

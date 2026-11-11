// Chat durante a partida: mensagens da sala aparecem no canto da tela e somem sozinhas.
// Computador: Enter ou T abre o campo, Enter envia, Esc cancela. Celular: botão CHAT.
import { TEAMS } from './config.js';

export class Chat {
  constructor(app) {
    this.app = app;
    this.log = document.getElementById('chat-log');
    this.form = document.getElementById('chat-form');
    this.input = document.getElementById('chat-input');
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.input.value;
      this.input.value = '';
      this.close();
      if (text.trim()) this.app.lobby.sendChat(text);
    });
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); this.input.value = ''; this.close(); }
      e.stopPropagation();
    });
    this.input.addEventListener('blur', () => setTimeout(() => this.close(), 0));
  }

  get isOpen() { return !this.form.classList.contains('hidden'); }

  open() {
    if (!this.app.net.active) return;
    this.form.classList.remove('hidden');
    this.log.classList.add('open');
    this.input.focus();
  }

  close() {
    if (!this.isOpen) return;
    this.form.classList.add('hidden');
    this.log.classList.remove('open');
    this.input.blur();
    // limpa teclas presas que foram pressionadas antes de abrir o campo
    this.app.input.keys.clear();
  }

  show(e) {
    const d = document.createElement('div');
    d.className = `cl${e.system ? ' sys' : ''}`;
    if (e.name) {
      const b = document.createElement('b');
      b.textContent = `${e.name}: `;
      b.style.color = TEAMS[e.team] ? TEAMS[e.team].css : '#ddd';
      d.appendChild(b);
    }
    d.appendChild(document.createTextNode(e.text));
    this.log.appendChild(d);
    while (this.log.children.length > 7) this.log.firstChild.remove();
    setTimeout(() => d.classList.add('fade'), 8000);
    setTimeout(() => d.remove(), 8800);
  }
}

const SOCKET_URL = 'https://painel.amiconnect.com.br';
let socket = null;
let pedidosPendentes = 0;

function iniciarSocket() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (!user.id) return;
  const empresaId = user.role === 'admin'
    ? (parseInt(localStorage.getItem('adminEmpresaId')) || null)
    : user.empresa_id;
  if (!empresaId) return;
  socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
  socket.on('connect', () => {
    console.log('🔌 Socket conectado:', socket.id);
    socket.emit('join_empresa', empresaId);
  });
  socket.on('disconnect', () => console.log('🔌 Socket desconectado'));
  socket.on('novo_alerta', (data) => {
    console.log('🔔 Novo alerta:', data);
    if (typeof atualizarBadgeAlertas === 'function') atualizarBadgeAlertas();
    tocarSomAlerta();
  });
  socket.on('nova_mensagem', (data) => {
    console.log('💬 Nova mensagem:', data);
    if (typeof chatTelefone !== 'undefined' && chatTelefone === data.telefone) {
      if (typeof carregarMensagens === 'function') carregarMensagens();
    }
    if (typeof loadConversas === 'function') loadConversas();
  });
  socket.on('novo_pedido', (data) => {
    console.log('🧾 Novo pedido:', data);
    if (typeof loadPedidos === 'function') loadPedidos();
    if (typeof atualizarBadgeAlertas === 'function') atualizarBadgeAlertas();
    pedidosPendentes++;
    atualizarBadgePedidos();
    tocarSomPedido();
  });
}

function tocarSomAlerta() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 1050;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {}
}

function tocarSomPedido() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25].forEach(offset => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 520;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.2);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.2);
    });
  } catch (e) {}
}

function tocarSomNotificacao() { tocarSomAlerta(); }

function atualizarBadgePedidos() {
  const badge = document.getElementById('pedidosBadge');
  if (!badge) return;
  if (pedidosPendentes > 0) {
    badge.textContent = pedidosPendentes > 9 ? '9+' : pedidosPendentes;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function zerarBadgePedidos() {
  pedidosPendentes = 0;
  atualizarBadgePedidos();
}

document.addEventListener('DOMContentLoaded', iniciarSocket);

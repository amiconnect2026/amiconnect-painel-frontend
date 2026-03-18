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
    // carregarAlertas() detecta o novo ID e toca o som via alertas.js
    if (typeof carregarAlertas === 'function') carregarAlertas().then(() => atualizarBadge());
  });
  socket.on('nova_mensagem', (data) => {
    console.log('💬 Nova mensagem:', data);
    if (typeof chatTelefone !== 'undefined' && chatTelefone === data.telefone) {
      if (typeof carregarMensagens === 'function') carregarMensagens();
    }
    if (typeof loadConversas === 'function') loadConversas();
    if (typeof incrementarBadgeConversas === 'function') incrementarBadgeConversas();
  });
  socket.on('novo_pedido', (data) => {
    console.log('🧾 Novo pedido:', data);
    if (typeof registrarNovoPedidoSom === 'function') registrarNovoPedidoSom(data.pedido_id);
    if (typeof loadPedidos === 'function') loadPedidos();
    pedidosPendentes++;
    atualizarBadgePedidos();
  });
}

function tocarSomNotificacao() {
  if (typeof tocarSomAlerta === 'function') tocarSomAlerta();
}

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

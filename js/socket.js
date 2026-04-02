const SOCKET_URL = 'https://painel.amiconnect.com.br';
let socket = null;
let pedidosPendentes = 0;
let socketConectadoEm = null;
const pedidosSomDisparado = new Set();

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
    socketConectadoEm = Date.now();
    socket.emit('join_empresa', empresaId);
  });
  socket.on('disconnect', () => console.log('🔌 Socket desconectado'));
  socket.on('novo_alerta', (data) => {
    console.log('🔔 Novo alerta:', data);
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

    // Ignorar se chegou nos primeiros 3s após conexão
    if (socketConectadoEm && Date.now() - socketConectadoEm < 3000) {
      console.log('[Audio Pedido] Ignorado — reconexão recente');
      return;
    }

    // Ignorar duplicata pelo pedido_id
    if (data.pedido_id && pedidosSomDisparado.has(data.pedido_id)) {
      console.log('[Audio Pedido] Ignorado — duplicata');
      return;
    }
    if (data.pedido_id) pedidosSomDisparado.add(data.pedido_id);

    if (typeof loadPedidos === 'function') loadPedidos();
    if (typeof atualizarBadgeAlertas === 'function') atualizarBadgeAlertas();
    pedidosPendentes++;
    atualizarBadgePedidos();
    if (typeof registrarNovoPedidoSom === 'function') registrarNovoPedidoSom(data.pedido_id, 'socket');
    else tocarSomPedido();
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

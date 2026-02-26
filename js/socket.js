// ==========================================
// AmiConnect - Socket.io Client
// ==========================================

const SOCKET_URL = 'https://painel.amiconnect.com.br';

let socket = null;

function iniciarSocket() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (!user.id) return;

  const empresaId = user.role === 'admin'
    ? (parseInt(localStorage.getItem('adminEmpresaId')) || null)
    : user.empresa_id;

  if (!empresaId) return;

  // Conecta ao servidor
  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    console.log('🔌 Socket conectado:', socket.id);
    // Entra na sala da empresa
    socket.emit('join_empresa', empresaId);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Socket desconectado');
  });

  // ==========================================
  // NOVO ALERTA — atualiza badge e lista
  // ==========================================
  socket.on('novo_alerta', (data) => {
    console.log('🔔 Novo alerta:', data);
    // Atualiza badge de alertas se a função existir
    if (typeof atualizarBadgeAlertas === 'function') {
      atualizarBadgeAlertas();
    }
    // Toca som de notificação
    tocarSomNotificacao();
  });

  // ==========================================
  // NOVA MENSAGEM — atualiza chat e lista de conversas
  // ==========================================
  socket.on('nova_mensagem', (data) => {
    console.log('💬 Nova mensagem:', data);
    // Atualiza chat ao vivo se estiver aberto na mesma conversa
    if (typeof chatTelefone !== 'undefined' && chatTelefone === data.telefone) {
      if (typeof carregarMensagens === 'function') {
        carregarMensagens();
      }
    }
    // Atualiza lista de conversas
    if (typeof loadConversas === 'function') {
      loadConversas();
    }
  });

  // ==========================================
  // NOVO PEDIDO — atualiza lista de pedidos
  // ==========================================
  socket.on('novo_pedido', (data) => {
    console.log('🛒 Novo pedido:', data);
    if (typeof loadPedidos === 'function') {
      loadPedidos();
    }
    if (typeof atualizarBadgeAlertas === 'function') {
      atualizarBadgeAlertas();
    }
    tocarSomNotificacao();
  });
}

function tocarSomNotificacao() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {}
}

// Inicia automaticamente quando o script carrega
document.addEventListener('DOMContentLoaded', iniciarSocket);

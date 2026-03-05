let botPausado = false;

async function carregarStatusBot() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const empresaId = user.role === 'admin'
      ? (parseInt(localStorage.getItem('adminEmpresaId')) || null)
      : user.empresa_id;
    if (!empresaId) return;

    const res = await apiRequest(`/conversas/config/bot-status?empresa_id=${empresaId}`);
    botPausado = res.bot_pausado || false;
    atualizarBotaoPausa();
  } catch (e) {
    console.error('Erro ao carregar status bot:', e);
  }
}

function atualizarBotaoPausa() {
  const btn = document.getElementById('btnPausa');
  const icon = document.getElementById('btnPausaIcon');
  const texto = document.getElementById('btnPausaTexto');
  if (!btn) return;

  if (botPausado) {
    btn.className = 'relative flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold transition-all bg-red-100 text-red-700 hover:bg-red-200';
    icon.className = 'w-2 h-2 rounded-full bg-red-500 inline-block animate-pulse';
    texto.textContent = 'Pausado';
  } else {
    btn.className = 'relative flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold transition-all bg-green-100 text-green-700 hover:bg-green-200';
    icon.className = 'w-2 h-2 rounded-full bg-green-500 inline-block';
    texto.textContent = 'Bot ativo';
  }
}

async function toggleBotPausa() {
  if (botPausado) {
    if (!confirm('Deseja reativar o bot?')) return;
    await reativarBot();
  } else {
    const mensagem = prompt('Digite a mensagem que os clientes vão receber enquanto o bot estiver pausado:', 'Estamos pausados no momento. Em breve voltamos! 🙏');
    if (mensagem === null) return;
    if (!mensagem.trim()) return alert('Digite uma mensagem de pausa!');
    await pausarBot(mensagem.trim());
  }
}

async function pausarBot(mensagem_pausa) {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const empresaId = user.role === 'admin'
      ? (parseInt(localStorage.getItem('adminEmpresaId')) || null)
      : user.empresa_id;

    const res = await apiRequest('/conversas/pausar', {
      method: 'POST',
      body: JSON.stringify({ empresa_id: empresaId, mensagem_pausa })
    });

    botPausado = true;
    atualizarBotaoPausa();

    if (res.conversas_assumidas > 0) {
      alert(`Bot pausado! ${res.conversas_assumidas} conversa(s) ativa(s) foram assumidas para atendimento humano.`);
    } else {
      alert('Bot pausado! Clientes receberão a mensagem de pausa.');
    }
  } catch (e) {
    alert('Erro ao pausar bot: ' + e.message);
  }
}

async function reativarBot() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const empresaId = user.role === 'admin'
      ? (parseInt(localStorage.getItem('adminEmpresaId')) || null)
      : user.empresa_id;

    await apiRequest('/conversas/reativar', {
      method: 'POST',
      body: JSON.stringify({ empresa_id: empresaId })
    });

    botPausado = false;
    atualizarBotaoPausa();
    alert('Bot reativado com sucesso! ✅');
  } catch (e) {
    alert('Erro ao reativar bot: ' + e.message);
  }
}

// Atualizar botão quando socket receber evento
if (typeof socket !== 'undefined') {
  socket.on('bot_status', (data) => {
    botPausado = data.bot_pausado;
    atualizarBotaoPausa();
  });
}

document.addEventListener('DOMContentLoaded', carregarStatusBot);

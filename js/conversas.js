const user = checkAuth();
if (!user) {
    window.location.href = 'index.html';
}

document.getElementById('userName').textContent = user.nome;

let conversas = [];
let intervalId = null;
let chatTelefone = null;
let chatEmpresaId = null;
let chatIntervalId = null;

// ==========================================
// CARREGAR CONVERSAS
// ==========================================
async function loadConversas() {
    try {
        const empresaId = user.role === 'admin' 
            ? (parseInt(localStorage.getItem('adminEmpresaId')) || null)
            : user.empresa_id;

        if (!empresaId) return;

        const response = await API.getConversas(empresaId);
        conversas = response.conversas || [];
        renderConversas();
        updateStats();
    } catch (error) {
        console.error('Erro ao carregar conversas:', error);
    }
}

function renderConversas() {
    const container = document.getElementById('conversasContainer');
    const loading = document.getElementById('loading');
    const emptyState = document.getElementById('emptyState');

    loading.classList.add('hidden');

    if (conversas.length === 0) {
        emptyState.classList.remove('hidden');
        container.classList.add('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    container.classList.remove('hidden');

    container.innerHTML = conversas.map(conv => `
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div class="flex items-center justify-between">
                <div class="flex-1">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                            <span class="text-xl">👤</span>
                        </div>
                        <div>
                            <h3 class="font-semibold text-gray-900">${conv.cliente_nome || formatPhone(conv.cliente_telefone)}</h3>
                            <p class="text-sm text-gray-500">${formatPhone(conv.cliente_telefone)}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-4 mt-3 text-xs text-gray-500">
                        <span>🕐 ${formatDate(conv.ultima_msg_em)}</span>
                        ${conv.ultima_msg_texto ? `<span class="truncate max-w-xs">💬 ${conv.ultima_msg_texto}</span>` : ''}
                        ${conv.atendente_nome ? `<span>👤 ${conv.atendente_nome}</span>` : ''}
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <div class="px-4 py-2 rounded-lg font-medium ${conv.modo === 'bot' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}">
                        ${conv.modo === 'bot' ? '🤖 Bot' : '👤 Manual'}
                    </div>
                    ${conv.modo === 'bot' ? `
                        <button onclick="assumirConversa('${conv.cliente_telefone}')" class="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition">
                            Assumir
                        </button>
                    ` : `
                        <button onclick="abrirChat('${conv.cliente_telefone}')" class="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition">
                            💬 Abrir Chat
                        </button>
                        <button onclick="liberarConversa('${conv.cliente_telefone}')" class="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition">
                            Liberar pro Bot
                        </button>
                    `}
                </div>
            </div>
        </div>
    `).join('');
}

function updateStats() {
    document.getElementById('totalConversas').textContent = conversas.length;
    document.getElementById('conversasBot').textContent = conversas.filter(c => c.modo === 'bot').length;
    document.getElementById('conversasManual').textContent = conversas.filter(c => c.modo === 'manual').length;
}

// ==========================================
// ASSUMIR / LIBERAR
// ==========================================
async function assumirConversa(telefone) {
    try {
        const empresaId = user.role === 'admin'
            ? (parseInt(localStorage.getItem('adminEmpresaId')) || 1)
            : user.empresa_id;
        await API.assumirConversa(telefone, empresaId);
        await loadConversas();
        abrirChat(telefone);
    } catch (error) {
        alert('❌ Erro: ' + error.message);
    }
}

async function liberarConversa(telefone) {
    if (!confirm('Liberar para o bot?')) return;
    try {
        const empresaId = user.role === 'admin'
            ? (parseInt(localStorage.getItem('adminEmpresaId')) || 1)
            : user.empresa_id;
        await API.liberarConversa(telefone, empresaId);
        await loadConversas();
    } catch (error) {
        alert('❌ Erro: ' + error.message);
    }
}

async function liberarParaBot() {
    if (!chatTelefone) return;
    if (!confirm('Liberar para o bot?')) return;
    await liberarConversa(chatTelefone);
    fecharChat();
}

// ==========================================
// CHAT AO VIVO
// ==========================================
async function abrirChat(telefone) {
    chatTelefone = telefone;
    chatEmpresaId = user.role === 'admin'
        ? (parseInt(localStorage.getItem('adminEmpresaId')) || 1)
        : user.empresa_id;

    const conv = conversas.find(c => c.cliente_telefone === telefone);
    document.getElementById('chatClienteNome').textContent = conv?.cliente_nome || formatPhone(telefone);
    document.getElementById('chatClienteTelefone').textContent = formatPhone(telefone);
    document.getElementById('chatModal').classList.remove('hidden');

    await carregarMensagens();

    // Auto refresh a cada 5 segundos
    chatIntervalId = setInterval(carregarMensagens, 5000);
}

function fecharChat() {
    document.getElementById('chatModal').classList.add('hidden');
    chatTelefone = null;
    if (chatIntervalId) {
        clearInterval(chatIntervalId);
        chatIntervalId = null;
    }
}

async function carregarMensagens() {
    if (!chatTelefone) return;
    try {
        const query = user.role === 'admin' ? `?empresa_id=${chatEmpresaId}&t=${Date.now()}` : `?t=${Date.now()}`;
        const response = await apiRequest(`/conversas/mensagens/${chatTelefone}${query}`);
        renderMensagens(response.mensagens || []);
    } catch (error) {
        console.error('Erro ao carregar mensagens:', error);
    }
}

function renderMensagens(mensagens) {
    const container = document.getElementById('chatMensagens');
    
    if (mensagens.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-400 text-sm py-8">Nenhuma mensagem ainda</div>';
        return;
    }

    container.innerHTML = mensagens.map(msg => {
        const isUser = msg.role === 'user';
        const hora = new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        if (isUser) {
            return `
                <div class="flex justify-start">
                    <div class="max-w-xs lg:max-w-md">
                        <div class="msg-bot px-4 py-2 text-gray-800">${msg.content}</div>
                        <p class="text-xs text-gray-400 mt-1 ml-2">${hora}</p>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="flex justify-end">
                    <div class="max-w-xs lg:max-w-md">
                        <div class="msg-atendente px-4 py-2">${msg.content}</div>
                        <p class="text-xs text-gray-400 mt-1 mr-2 text-right">${hora}</p>
                    </div>
                </div>
            `;
        }
    }).join('');

    container.scrollTop = container.scrollHeight;
}

async function enviarMensagem() {
    const input = document.getElementById('chatInput');
    const mensagem = input.value.trim();
    if (!mensagem || !chatTelefone) return;

    input.value = '';
    input.disabled = true;

    try {
        await apiRequest(`/conversas/mensagens/${chatTelefone}`, {
            method: 'POST',
            body: JSON.stringify({
                mensagem,
                empresa_id: chatEmpresaId
            })
        });
        await carregarMensagens();
    } catch (error) {
        alert('Erro ao enviar: ' + error.message);
        input.value = mensagem;
    } finally {
        input.disabled = false;
        input.focus();
    }
}

// ==========================================
// UTILITÁRIOS
// ==========================================
function formatPhone(phone) {
    if (!phone) return 'Cliente';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length >= 11) {
        const ddd = cleaned.slice(-11, -9);
        const part1 = cleaned.slice(-9, -4);
        const part2 = cleaned.slice(-4);
        return `(${ddd}) ${part1}-${part2}`;
    }
    return phone;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins} min atrás`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h atrás`;
    return date.toLocaleDateString('pt-BR');
}

function startAutoRefresh() {
    intervalId = setInterval(loadConversas, 10000);
}

// ==========================================
// INICIALIZAR
// ==========================================
loadConversas();
startAutoRefresh();

window.addEventListener('beforeunload', () => {
    if (intervalId) clearInterval(intervalId);
    if (chatIntervalId) clearInterval(chatIntervalId);
});

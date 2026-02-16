const user = checkAuth();
if (!user) {
    window.location.href = 'index.html';
}

document.getElementById('userName').textContent = user.nome;

let conversas = [];
let intervalId = null;

async function loadConversas() {
    try {
        const empresaId = user.role === 'admin' ? 1 : user.empresa_id;
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
                            <h3 class="font-semibold text-gray-900">${formatPhone(conv.cliente_telefone)}</h3>
                            <p class="text-sm text-gray-500">${conv.cliente_telefone}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-4 mt-3 ml-15 text-xs text-gray-500">
                        <span>🕐 ${formatDate(conv.ultima_msg_em)}</span>
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

async function assumirConversa(telefone) {
    try {
        const empresaId = user.role === 'admin' ? 1 : user.empresa_id;
        await API.assumirConversa(telefone, empresaId);
        await loadConversas();
        alert('✅ Conversa assumida!');
    } catch (error) {
        alert('❌ Erro: ' + error.message);
    }
}

async function liberarConversa(telefone) {
    if (!confirm('Liberar para o bot?')) return;
    try {
        const empresaId = user.role === 'admin' ? 1 : user.empresa_id;
        await API.liberarConversa(telefone, empresaId);
        await loadConversas();
        alert('✅ Conversa liberada!');
    } catch (error) {
        alert('❌ Erro: ' + error.message);
    }
}

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
    intervalId = setInterval(() => {
        loadConversas();
    }, 10000);
}

loadConversas();
startAutoRefresh();

window.addEventListener('beforeunload', () => {
    if (intervalId) clearInterval(intervalId);
});

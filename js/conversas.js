// Verificar autenticação
const user = checkAuth();
if (!user) {
    window.location.href = 'index.html';
}

// Mostrar nome do usuário
document.getElementById('userName').textContent = user.nome;

// Variáveis globais
let conversas = [];
let intervalId = null;

// Carregar conversas
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

// Renderizar conversas
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
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:border-indigo-300 transition">
            <div class="flex items-center justify-between">
                
                <!-- Info da Conversa -->
                <div class="flex-1">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                            <span class="text-xl">👤</span>
                        </div>
                        <div>
                            <h3 class="font-semibold text-gray-900">
                                ${conv.cliente_nome || formatPhone(conv.cliente_telefone)}
                            </h3>
                            <p class="text-sm text-gray-500">${conv.cliente_telefone}</p>
                        </div>
                    </div>
                    
                    ${conv.ultima_msg_texto ? `
                        <p class="text-sm text-gray-600 mt-3 ml-15 italic">
                            "${conv.ultima_msg_texto.substring(0, 80)}${conv.ultima_msg_texto.length > 80 ? '...' : ''}"
                        </p>
                    ` : ''}
                    
                    <div class="flex items-center gap-4 mt-3 ml-15 text-xs text-gray-500">
                        <span>🕐 ${formatDate(conv.ultima_msg_em)}</span>
                        ${conv.atendente_nome ? `<span>👤 ${conv.atendente_nome}</span>` : ''}
                    </div>
                </div>

                <!-- Modo e Ações -->
                <div class="flex items-center gap-3">
                    
                    <!-- Badge Modo -->
                    <div class="px-4 py-2 rounded-lg font-medium ${
                        conv.modo === 'bot' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-orange-100 text-orange-700'
                    }">
                        ${conv.modo === 'bot' ? '🤖 Bot' : '👤 Manual'}
                    </div>

                    <!-- Botão Ação -->
                    ${conv.modo === 'bot' ? `
                        <button 
                            onclick="assumirConversa('${conv.cliente_telefone}')"
                            class="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition"
                        >
                            Assumir
                        </button>
                    ` : `
                        <button 
                            onclick="liberarConversa('${conv.cliente_telefone}')"
                            class="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition"
                        >
                            Liberar pro Bot
                        </button>
                    `}

                </div>

            </div>
        </div>
    `).join('');
}

// Atualizar estatísticas
function updateStats() {
    document.getElementById('totalConversas').textContent = conversas.length;
    document.getElementById('conversasBot').textContent = conversas.filter(c => c.modo === 'bot').length;
    document.getElementById('conversasManual').textContent = conversas.filter(c => c.modo === 'manual').length;
}

// Assumir conversa
async function assumirConversa(telefone) {
    try {
        const empresaId = user.role === 'admin' ? 1 : user.empresa_id;
        await API.assumirConversa(telefone, empresaId);
        
        // Atualizar lista
        await loadConversas();
        
        alert('✅ Conversa assumida! Você está atendendo este cliente.');

    } catch (error) {
        alert('❌ Erro ao assumir conversa: ' + error.message);
    }
}

// Liberar conversa pro bot
async function liberarConversa(telefone) {
    if (!confirm('Tem certeza que deseja liberar esta conversa para o bot?')) return;

    try {
        const empresaId = user.role === 'admin' ? 1 : user.empresa_id;
        await API.liberarConversa(telefone, empresaId);
        
        // Atualizar lista
        await loadConversas();
        
        alert('✅ Conversa liberada! O bot voltou a atender este cliente.');

    } catch (error) {
        alert('❌ Erro ao liberar conversa: ' + error.message);
    }
}

// Formatar telefone
function formatPhone(phone) {
    if (!phone) return 'Cliente';
    // Remove país e formata: (XX) XXXXX-XXXX
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length >= 11) {
        const ddd = cleaned.slice(-11, -9);
        const part1 = cleaned.slice(-9, -4);
        const part2 = cleaned.slice(-4);
        return `(${ddd}) ${part1}-${part2}`;
    }
    return phone;
}

// Formatar data
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
    
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'});
}

// Auto-refresh a cada 10 segundos
function startAutoRefresh() {
    intervalId = setInterval(() => {
        loadConversas();
    }, 10000); // 10 segundos
}

function stopAutoRefresh() {
    if (intervalId) {
        clearInterval(intervalId);
    }
}

// Inicializar
loadConversas();
startAutoRefresh();

// Parar refresh quando sair da página
window.addEventListener('beforeunload', stopAutoRefresh);

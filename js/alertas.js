let alertasNaoLidos = 0;
let todosAlertas = [];
let intervalAlertas = null;

async function iniciarAlertas() {
    await carregarAlertas();
    atualizarBadge();
    
    intervalAlertas = setInterval(async () => {
        await carregarAlertas();
        atualizarBadge();
    }, 15000);
}

async function carregarAlertas() {
    try {
        const [alertasRes, naoLidosRes] = await Promise.all([
            API.getAlertas(),
            API.getAlertasNaoLidos()
        ]);
        
        todosAlertas = alertasRes.alertas || [];
        alertasNaoLidos = naoLidosRes.total || 0;
        
    } catch (error) {
        console.error('Erro ao carregar alertas:', error);
    }
}

function atualizarBadge() {
    const badge = document.getElementById('alertasBadge');
    if (!badge) return;
    
    if (alertasNaoLidos > 0) {
        badge.textContent = alertasNaoLidos > 9 ? '9+' : alertasNaoLidos;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function mostrarAlertas() {
    const modal = document.getElementById('alertasModal');
    const lista = document.getElementById('alertasLista');
    
    if (todosAlertas.length === 0) {
        lista.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <span class="text-4xl">🔔</span>
                <p class="mt-2">Nenhuma notificação</p>
            </div>
        `;
    } else {
        lista.innerHTML = todosAlertas.map(alerta => `
            <div class="p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer ${!alerta.lido ? 'bg-blue-50' : ''}" 
                 onclick="marcarComoLido(${alerta.id}, '${alerta.link || ''}')">
                <div class="flex items-start gap-3">
                    <span class="text-2xl">${getIconeAlerta(alerta.tipo)}</span>
                    <div class="flex-1">
                        <h4 class="font-semibold text-gray-900">${alerta.titulo}</h4>
                        <p class="text-sm text-gray-600 mt-1">${alerta.mensagem}</p>
                        <span class="text-xs text-gray-400 mt-2 block">${formatarData(alerta.created_at)}</span>
                    </div>
                    ${!alerta.lido ? '<div class="w-2 h-2 bg-blue-500 rounded-full"></div>' : ''}
                </div>
            </div>
        `).join('');
    }
    
    modal.classList.remove('hidden');
}

function fecharAlertas() {
    document.getElementById('alertasModal').classList.add('hidden');
}

async function marcarComoLido(id, link) {
    try {
        await API.marcarAlertaLido(id);
        await carregarAlertas();
        atualizarBadge();
        
        fecharAlertas();
        
        if (link) {
            window.location.href = link;
        }
        
    } catch (error) {
        console.error('Erro ao marcar alerta:', error);
    }
}

function getIconeAlerta(tipo) {
    const icones = {
        'cliente_pediu_atendente': '🆘',
        'bot_nao_respondeu': '⚠️',
        'pedido_confirmado': '✅',
        'nova_conversa': '💬',
        'volume_alto': '🔴',
        'default': '🔔'
    };
    return icones[tipo] || icones.default;
}

function formatarData(data) {
    const date = new Date(data);
    const agora = new Date();
    const diff = agora - date;
    const minutos = Math.floor(diff / 60000);
    
    if (minutos < 1) return 'Agora';
    if (minutos < 60) return `${minutos} min atrás`;
    
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `${horas}h atrás`;
    
    return date.toLocaleDateString('pt-BR');
}

window.addEventListener('beforeunload', () => {
    if (intervalAlertas) clearInterval(intervalAlertas);
});

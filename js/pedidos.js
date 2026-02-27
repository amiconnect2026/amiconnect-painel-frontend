const user = checkAuth();
if (!user) {
    window.location.href = 'index.html';
}

document.getElementById('userName').textContent = user.nome;

let pedidos = [];
let filtroAtual = 'todos';

async function loadPedidos() {
    try {
        const empresaId = user.role === 'admin' ? (parseInt(localStorage.getItem('adminEmpresaId')) || user.empresa_id) : user.empresa_id;
        const response = await API.getPedidos(empresaId, filtroAtual !== 'todos' ? filtroAtual : null);
        
        pedidos = response.pedidos || [];
        renderPedidos();

    } catch (error) {
        console.error('Erro ao carregar pedidos:', error);
    }
}

function renderPedidos() {
    const container = document.getElementById('pedidosContainer');
    const loading = document.getElementById('loading');
    const emptyState = document.getElementById('emptyState');

    loading.classList.add('hidden');

    if (pedidos.length === 0) {
        emptyState.classList.remove('hidden');
        container.classList.add('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    container.classList.remove('hidden');

    container.innerHTML = pedidos.map(pedido => `
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:border-indigo-300 transition cursor-pointer"
             onclick="verDetalhes(${pedido.id})">
            <div class="flex items-center justify-between">
                <div class="flex-1">
                    <div class="flex items-center gap-3 mb-2">
                        <span class="text-2xl font-bold text-indigo-600">#${pedido.id}</span>
                        <span class="px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(pedido.status)}">
                            ${getStatusLabel(pedido.status)}
                        </span>
                        ${!pedido.impresso ? '<span class="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">⚠️ Não impresso</span>' : ''}
                    </div>
                    <div class="grid grid-cols-2 gap-4 mt-3">
                        <div>
                            <p class="text-sm text-gray-500">Cliente</p>
                            <p class="font-semibold text-gray-900">${pedido.cliente_nome || 'Não informado'}</p>
                            <p class="text-sm text-gray-600">${formatPhone(pedido.cliente_telefone)}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">Total</p>
                            <p class="text-2xl font-bold text-green-600">R$ ${parseFloat(pedido.total).toFixed(2)}</p>
                        </div>
                    </div>
                    <div class="mt-3">
                        <p class="text-sm text-gray-500">Endereço</p>
                        <p class="text-sm text-gray-900">${pedido.cliente_endereco || 'Não informado'}</p>
                    </div>
                    <p class="text-xs text-gray-400 mt-3">🕐 ${formatDate(pedido.created_at)}</p>
                </div>
            </div>
        </div>
    `).join('');
}

function filtrarStatus(status) {
    filtroAtual = status;
    
    document.querySelectorAll('[id^="btn-"]').forEach(btn => {
        btn.className = 'px-4 py-2 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200';
    });
    
    document.getElementById(`btn-${status}`).className = 'px-4 py-2 rounded-lg font-medium bg-indigo-100 text-indigo-700';
    
    loadPedidos();
}

async function verDetalhes(id) {
    try {
        const empresaId = user.role === 'admin' ? (parseInt(localStorage.getItem('adminEmpresaId')) || user.empresa_id) : user.empresa_id;
        const response = await API.getPedido(id, empresaId);
        const pedido = response.pedido;
        const itens = pedido.itens;
        
        const detalhes = document.getElementById('pedidoDetalhes');
        detalhes.innerHTML = `
            <div class="space-y-6">
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="text-2xl font-bold text-gray-900">Pedido #${pedido.id}</h4>
                        <p class="text-gray-600">${formatDate(pedido.created_at)}</p>
                    </div>
                    <span class="px-4 py-2 rounded-full font-medium ${getStatusColor(pedido.status)}">
                        ${getStatusLabel(pedido.status)}
                    </span>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <p class="text-sm font-medium text-gray-500">Cliente</p>
                        <p class="text-lg font-semibold text-gray-900">${pedido.cliente_nome || 'Não informado'}</p>
                        <p class="text-gray-600">${formatPhone(pedido.cliente_telefone)}</p>
                    </div>
                    <div>
                        <p class="text-sm font-medium text-gray-500">Endereço</p>
                        <p class="text-gray-900">${pedido.cliente_endereco || 'Não informado'}</p>
                        ${pedido.cliente_bairro ? `<p class="text-gray-600">${pedido.cliente_bairro}</p>` : ''}
                    </div>
                </div>

                <div>
                    <p class="text-sm font-medium text-gray-500 mb-2">Itens do Pedido</p>
                    <div class="bg-gray-50 rounded-lg p-4 space-y-2">
                        ${itens.map(item => `
                            <div class="flex justify-between">
                                <span>${item.quantidade}x ${item.nome}</span>
                                <span class="font-semibold">R$ ${(item.quantidade * item.preco).toFixed(2)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="border-t pt-4">
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-600">Subtotal</span>
                        <span>R$ ${parseFloat(pedido.subtotal).toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-600">Taxa de Entrega</span>
                        <span>R$ ${parseFloat(pedido.taxa_entrega).toFixed(2)}</span>
                    </div>
                    ${pedido.desconto > 0 ? `
                        <div class="flex justify-between text-sm text-green-600">
                            <span>Desconto</span>
                            <span>- R$ ${parseFloat(pedido.desconto).toFixed(2)}</span>
                        </div>
                    ` : ''}
                    <div class="flex justify-between text-xl font-bold mt-2 pt-2 border-t">
                        <span>Total</span>
                        <span class="text-green-600">R$ ${parseFloat(pedido.total).toFixed(2)}</span>
                    </div>
                </div>

                ${pedido.forma_pagamento ? `
                    <div>
                        <p class="text-sm font-medium text-gray-500">Forma de Pagamento</p>
                        <p class="text-gray-900">${pedido.forma_pagamento}</p>
                        ${pedido.troco_para ? `<p class="text-sm text-gray-600">Troco para: R$ ${parseFloat(pedido.troco_para).toFixed(2)}</p>` : ''}
                    </div>
                ` : ''}

                ${pedido.observacoes ? `
                    <div>
                        <p class="text-sm font-medium text-gray-500">Observações</p>
                        <p class="text-gray-900">${pedido.observacoes}</p>
                    </div>
                ` : ''}

                <div class="flex gap-3 pt-4">
                    ${!pedido.impresso ? `
                        <button onclick="imprimirPedido(${pedido.id})" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition">
                            🖨️ Imprimir
                        </button>
                    ` : `
                        <div class="flex-1 bg-green-100 text-green-700 font-semibold py-3 rounded-lg text-center">
                            ✅ Impresso em ${formatDate(pedido.impresso_em)}
                        </div>
                    `}
                    <button onclick="fecharModal()" class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 rounded-lg transition">
                        Fechar
                    </button>
                </div>
            </div>
        `;
        
        document.getElementById('pedidoModal').classList.remove('hidden');
        
    } catch (error) {
        alert('Erro ao carregar detalhes: ' + error.message);
    }
}

function fecharModal() {
    document.getElementById('pedidoModal').classList.add('hidden');
}

async function imprimirPedido(id) {
    try {
        const empresaId = user.role === 'admin' ? (parseInt(localStorage.getItem('adminEmpresaId')) || user.empresa_id) : user.empresa_id;
        const response = await API.getPedido(id, empresaId);
        const pedido = response.pedido;

        const itensHtml = pedido.itens.map(item => `
            <tr>
                <td>${item.quantidade}x ${item.nome}</td>
                <td style="text-align:right">R$ ${(item.quantidade * item.preco).toFixed(2)}</td>
            </tr>
        `).join('');

        const janela = window.open('', '_blank', 'width=400,height=600');
        janela.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Pedido #${pedido.id}</title>
                <style>
                    body { font-family: monospace; font-size: 13px; padding: 16px; max-width: 300px; margin: 0 auto; }
                    h2 { text-align: center; font-size: 16px; margin: 4px 0; }
                    p { margin: 2px 0; }
                    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
                    td { padding: 2px 0; }
                    .linha { border-top: 1px dashed #000; margin: 8px 0; }
                    .total { font-weight: bold; font-size: 15px; }
                    .centro { text-align: center; }
                </style>
            </head>
            <body>
                <h2>PEDIDO #${pedido.id}</h2>
                <p class="centro">${formatDate(pedido.created_at)}</p>
                <div class="linha"></div>
                <p><b>Cliente:</b> ${pedido.cliente_nome || '-'}</p>
                <p><b>Tel:</b> ${formatPhone(pedido.cliente_telefone)}</p>
                <p><b>End:</b> ${pedido.cliente_endereco || '-'}</p>
                <div class="linha"></div>
                <table>${itensHtml}</table>
                <div class="linha"></div>
                <table>
                    <tr><td>Subtotal</td><td style="text-align:right">R$ ${parseFloat(pedido.subtotal).toFixed(2)}</td></tr>
                    <tr><td>Entrega</td><td style="text-align:right">R$ ${parseFloat(pedido.taxa_entrega).toFixed(2)}</td></tr>
                    <tr class="total"><td>TOTAL</td><td style="text-align:right">R$ ${parseFloat(pedido.total).toFixed(2)}</td></tr>
                </table>
                <div class="linha"></div>
                <p><b>Pagamento:</b> ${pedido.forma_pagamento || '-'}</p>
                ${pedido.troco_para ? `<p><b>Troco para:</b> R$ ${parseFloat(pedido.troco_para).toFixed(2)}</p>` : ''}
                ${pedido.observacoes ? `<p><b>Obs:</b> ${pedido.observacoes}</p>` : ''}
                <script>window.onload = function(){ window.print(); window.close(); }<\/script>
            </body>
            </html>
        `);
        janela.document.close();

        await API.marcarPedidoImpresso(id, empresaId);
        fecharModal();
        loadPedidos();

    } catch (error) {
        alert('Erro ao imprimir: ' + error.message);
    }
}

function getStatusColor(status) {
    const colors = {
        'pendente': 'bg-yellow-100 text-yellow-700',
        'confirmado': 'bg-blue-100 text-blue-700',
        'preparando': 'bg-orange-100 text-orange-700',
        'saiu_entrega': 'bg-purple-100 text-purple-700',
        'entregue': 'bg-green-100 text-green-700',
        'cancelado': 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
}

function getStatusLabel(status) {
    const labels = {
        'pendente': 'Pendente',
        'confirmado': 'Confirmado',
        'preparando': 'Preparando',
        'saiu_entrega': 'Saiu p/ Entrega',
        'entregue': 'Entregue',
        'cancelado': 'Cancelado'
    };
    return labels[status] || status;
}

function formatPhone(phone) {
    if (!phone) return '';
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
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR');
}

loadPedidos();
setInterval(loadPedidos, 30000);

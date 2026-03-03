const user = checkAuth();
if (!user) { window.location.href = 'index.html'; }
document.getElementById('userName').textContent = user.nome;
let pedidos = [];
let filtroAtual = 'todos';
let empresaIdAtual = user.role === 'admin' ? (parseInt(localStorage.getItem('adminEmpresaId')) || null) : user.empresa_id;

function getEmpresaId() {
    return empresaIdAtual;
}

async function carregarSeletorEmpresas() {
    if (user.role !== 'admin') {
        if (empresaIdAtual) loadPedidos();
        return;
    }
    try {
        const res = await apiRequest('/empresas');
        const empresas = res.empresas || [];
        const seletor = document.getElementById('seletorEmpresa');
        seletor.classList.remove('hidden');
        const select = document.getElementById('selectEmpresa');
        select.innerHTML = '<option value="">Selecione um restaurante...</option>';
        empresas.forEach(e => {
            select.innerHTML += `<option value="${e.id}" ${e.id == empresaIdAtual ? 'selected' : ''}>${e.nome}</option>`;
        });
        select.addEventListener('change', (ev) => {
            const id = parseInt(ev.target.value);
            if (!id) return;
            localStorage.setItem('adminEmpresaId', id);
            empresaIdAtual = id;
            loadPedidos();
        });
        if (empresaIdAtual) loadPedidos();
    } catch(e) { console.error(e); }
}

async function loadPedidos() {
    if (!empresaIdAtual) return;
    try {
        let status = null;
        if (filtroAtual === 'novos') status = 'pendente';
        if (filtroAtual === 'finalizados') status = 'entregue';
        const response = await API.getPedidos(empresaIdAtual, status);
        pedidos = response.pedidos || [];
        if (filtroAtual === 'novos') pedidos = pedidos.filter(p => !p.impresso);
        renderPedidos();
    } catch (error) { console.error('Erro:', error); }
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
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:border-indigo-300 transition cursor-pointer" onclick="verDetalhes(${pedido.id})">
            <div class="flex items-center gap-3 mb-2">
                <span class="text-2xl font-bold text-indigo-600">#${pedido.id}</span>
                <span class="px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(pedido.status)}">${getStatusLabel(pedido.status)}</span>
                ${!pedido.impresso ? '<span class="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">Nao impresso</span>' : ''}
            </div>
            <div class="grid grid-cols-2 gap-4 mt-3">
                <div>
                    <p class="text-sm text-gray-500">Cliente</p>
                    <p class="font-semibold text-gray-900">${pedido.cliente_nome || '-'}</p>
                    <p class="text-sm text-gray-600">${formatPhone(pedido.cliente_telefone)}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-500">Total</p>
                    <p class="text-2xl font-bold text-green-600">R$ ${parseFloat(pedido.total).toFixed(2)}</p>
                </div>
            </div>
            <div class="mt-3">
                <p class="text-sm text-gray-500">Endereco</p>
                <p class="text-sm text-gray-900">${(pedido.cliente_endereco || '-').split('📍')[0].trim()}</p>
            </div>
            <p class="text-xs text-gray-400 mt-3">🕐 ${formatDate(pedido.created_at)}</p>
        </div>
    `).join('');
}

function filtrarStatus(status) {
    filtroAtual = status;
    document.querySelectorAll('[id^="btn-"]').forEach(btn => {
        btn.className = 'px-4 py-2 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200';
    });
    document.getElementById('btn-' + status).className = 'px-4 py-2 rounded-lg font-medium bg-indigo-100 text-indigo-700';
    loadPedidos();
}

async function verDetalhes(id) {
    try {
        const response = await API.getPedido(id, getEmpresaId());
        const pedido = response.pedido;
        const itens = pedido.itens;
        const enderecoPartes = (pedido.cliente_endereco || '').split('📍');
        const enderecoTexto = enderecoPartes[0].trim();
        const localizacaoLink = enderecoPartes[1] ? enderecoPartes[1].trim() : null;
        document.getElementById('pedidoDetalhes').innerHTML = `
            <div class="space-y-6">
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="text-2xl font-bold text-gray-900">Pedido #${pedido.id}</h4>
                        <p class="text-gray-600">${formatDate(pedido.created_at)}</p>
                    </div>
                    <span id="statusBadge" class="px-4 py-2 rounded-full font-medium ${getStatusColor(pedido.status)}">${getStatusLabel(pedido.status)}</span>
                </div>
                <div>
                    <p class="text-sm font-medium text-gray-500 mb-2">Alterar Status</p>
                    <div class="flex gap-2 flex-wrap">
                        <button onclick="mudarStatus(${pedido.id}, 'pendente')" class="px-3 py-1 rounded-lg text-sm font-medium bg-yellow-100 text-yellow-700 hover:bg-yellow-200">Pendente</button>
                        <button onclick="mudarStatus(${pedido.id}, 'confirmado')" class="px-3 py-1 rounded-lg text-sm font-medium bg-blue-100 text-blue-700 hover:bg-blue-200">Confirmado/Impresso</button>
                        <button onclick="mudarStatus(${pedido.id}, 'entregue')" class="px-3 py-1 rounded-lg text-sm font-medium bg-green-100 text-green-700 hover:bg-green-200">Entregue</button>
                        <button onclick="mudarStatus(${pedido.id}, 'cancelado')" class="px-3 py-1 rounded-lg text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200">Cancelado</button>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <p class="text-sm font-medium text-gray-500">Cliente</p>
                        <p class="text-lg font-semibold text-gray-900">${pedido.cliente_nome || '-'}</p>
                        <p class="text-gray-600">${formatPhone(pedido.cliente_telefone)}</p>
                    </div>
                    <div>
                        <p class="text-sm font-medium text-gray-500">Endereco</p>
                        <p class="text-gray-900">${enderecoTexto || '-'}</p>
                        ${localizacaoLink ? '<a href="' + localizacaoLink + '" target="_blank" class="text-indigo-600 text-sm">Ver no mapa</a>' : ''}
                    </div>
                </div>
                <div>
                    <p class="text-sm font-medium text-gray-500 mb-2">Itens do Pedido</p>
                    <div class="bg-gray-50 rounded-lg p-4 space-y-2">
                        ${itens.map(item => '<div class="flex justify-between"><span>' + item.quantidade + 'x ' + item.nome + '</span><span class="font-semibold">R$ ' + (item.quantidade * item.preco).toFixed(2) + '</span></div>').join('')}
                    </div>
                </div>
                <div class="border-t pt-4">
                    <div class="flex justify-between text-sm"><span class="text-gray-600">Subtotal</span><span>R$ ${parseFloat(pedido.subtotal).toFixed(2)}</span></div>
                    <div class="flex justify-between text-sm"><span class="text-gray-600">Taxa de Entrega</span><span>R$ ${parseFloat(pedido.taxa_entrega).toFixed(2)}</span></div>
                    <div class="flex justify-between text-xl font-bold mt-2 pt-2 border-t"><span>Total</span><span class="text-green-600">R$ ${parseFloat(pedido.total).toFixed(2)}</span></div>
                </div>
                ${pedido.forma_pagamento ? '<div><p class="text-sm font-medium text-gray-500">Forma de Pagamento</p><p class="text-gray-900">' + pedido.forma_pagamento + '</p>' + (pedido.troco_para ? '<p class="text-sm text-gray-600">Troco para: R$ ' + parseFloat(pedido.troco_para).toFixed(2) + '</p>' : '') + '</div>' : ''}
                ${pedido.observacoes ? '<div><p class="text-sm font-medium text-gray-500">Observacoes</p><p class="text-gray-900">' + pedido.observacoes + '</p></div>' : ''}
                <div class="flex gap-3 pt-4">
                    <button onclick="imprimirPedido(${pedido.id})" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition">Imprimir</button>
                    <button onclick="fecharModal()" class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 rounded-lg transition">Fechar</button>
                </div>
            </div>
        `;
        document.getElementById('pedidoModal').classList.remove('hidden');
    } catch (error) { alert('Erro: ' + error.message); }
}

async function mudarStatus(id, novoStatus) {
    try {
        await API.atualizarStatusPedido(id, novoStatus, getEmpresaId());
        const badge = document.getElementById('statusBadge');
        if (badge) {
            badge.className = 'px-4 py-2 rounded-full font-medium ' + getStatusColor(novoStatus);
            badge.textContent = getStatusLabel(novoStatus);
        }
        loadPedidos();
    } catch (error) { alert('Erro: ' + error.message); }
}

function fecharModal() {
    document.getElementById('pedidoModal').classList.add('hidden');
}

async function imprimirPedido(id) {
    try {
        const response = await API.getPedido(id, getEmpresaId());
        const pedido = response.pedido;
        const enderecoTexto = (pedido.cliente_endereco || '').split('📍')[0].trim();
        const itensHtml = pedido.itens.map(item => '<tr><td>' + item.quantidade + 'x ' + item.nome + '</td><td style="text-align:right">R$ ' + (item.quantidade * item.preco).toFixed(2) + '</td></tr>').join('');
        const janela = window.open('', '_blank', 'width=400,height=600');
        janela.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Pedido #' + pedido.id + '</title><style>body{font-family:monospace;font-size:13px;padding:16px;max-width:300px;margin:0 auto}h2{text-align:center;font-size:16px;margin:4px 0}p{margin:2px 0}table{width:100%;border-collapse:collapse;margin:8px 0}td{padding:2px 0}.linha{border-top:1px dashed #000;margin:8px 0}.total{font-weight:bold;font-size:15px}.centro{text-align:center}</style></head><body><h2>PEDIDO #' + pedido.id + '</h2><p class="centro">' + formatDate(pedido.created_at) + '</p><div class="linha"></div><p><b>Cliente:</b> ' + (pedido.cliente_nome || '-') + '</p><p><b>Tel:</b> ' + formatPhone(pedido.cliente_telefone) + '</p><p><b>End:</b> ' + (enderecoTexto || '-') + '</p><div class="linha"></div><table>' + itensHtml + '</table><div class="linha"></div><table><tr><td>Subtotal</td><td style="text-align:right">R$ ' + parseFloat(pedido.subtotal).toFixed(2) + '</td></tr><tr><td>Entrega</td><td style="text-align:right">R$ ' + parseFloat(pedido.taxa_entrega).toFixed(2) + '</td></tr><tr class="total"><td>TOTAL</td><td style="text-align:right">R$ ' + parseFloat(pedido.total).toFixed(2) + '</td></tr></table><div class="linha"></div><p><b>Pagamento:</b> ' + (pedido.forma_pagamento || '-') + '</p>' + (pedido.troco_para ? '<p><b>Troco para:</b> R$ ' + parseFloat(pedido.troco_para).toFixed(2) + '</p>' : '') + (pedido.observacoes ? '<p><b>Obs:</b> ' + pedido.observacoes + '</p>' : '') + '<scr' + 'ipt>window.onload=function(){window.print();window.close();}<\/scr' + 'ipt></body></html>');
        janela.document.close();
        await API.marcarPedidoImpresso(id, getEmpresaId());
        await API.atualizarStatusPedido(id, 'confirmado', getEmpresaId());
        const badge = document.getElementById('statusBadge');
        if (badge) {
            badge.className = 'px-4 py-2 rounded-full font-medium bg-blue-100 text-blue-700';
            badge.textContent = 'Confirmado/Impresso';
        }
        loadPedidos();
    } catch (error) { alert('Erro ao imprimir: ' + error.message); }
}

function getStatusColor(status) {
    const colors = { 'pendente': 'bg-yellow-100 text-yellow-700', 'confirmado': 'bg-blue-100 text-blue-700', 'entregue': 'bg-green-100 text-green-700', 'cancelado': 'bg-red-100 text-red-700' };
    return colors[status] || 'bg-gray-100 text-gray-700';
}

function getStatusLabel(status) {
    const labels = { 'pendente': 'Pendente', 'confirmado': 'Confirmado/Impresso', 'entregue': 'Entregue', 'cancelado': 'Cancelado' };
    return labels[status] || status;
}

function formatPhone(phone) {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length >= 11) return '(' + cleaned.slice(-11,-9) + ') ' + cleaned.slice(-9,-4) + '-' + cleaned.slice(-4);
    return phone;
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleString('pt-BR');
}

carregarSeletorEmpresas();
setInterval(loadPedidos, 30000);

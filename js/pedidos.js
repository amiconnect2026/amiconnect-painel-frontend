const user = checkAuth();
if (!user) { window.location.href = 'index.html'; }
document.getElementById('userName').textContent = user.nome;
let pedidos = [];
let filtroAtual = 'todos';
let tabAtual = 'ativos';
let pedidosSelecionados = new Set();
let empresaIdAtual = user.role === 'admin' ? (parseInt(localStorage.getItem('adminEmpresaId')) || null) : user.empresa_id;

// Silencia o repetidor global ao abrir a página de pedidos
if (typeof silenciarPedidoSom === 'function') silenciarPedidoSom();

// ── Som de pedido ─────────────────────────────────────────────────────────────
// tocarSomPedido() e registrarNovoPedidoSom() definidos em alertas.js (carrega em todas as páginas)

const _STORAGE_PEDIDOS_VISTOS = 'amiconnect_pedidos_som_vistos';
const _pedidosSomJaDisparado = new Set(); // in-memory: evita repetir no mesmo carregamento
let _intervalSomPedido = null;
let _primeiraCarregaPedidos = true; // na primeira carga não toca — só marca os pendentes existentes

function _getPedidosSomVistos() {
    try { return new Set(JSON.parse(localStorage.getItem(_STORAGE_PEDIDOS_VISTOS) || '[]')); }
    catch { return new Set(); }
}

function _salvarPedidoSomVisto(id) {
    const vistos = _getPedidosSomVistos();
    vistos.add(id);
    localStorage.setItem(_STORAGE_PEDIDOS_VISTOS, JSON.stringify([...vistos].slice(-500)));
}

function _temPendentesNaoOuvidos() {
    // Repete som apenas pelos pedidos que dispararam som nesta sessão
    // e o atendente ainda não abriu (não está no localStorage)
    const vistos = _getPedidosSomVistos();
    return pedidos.some(p =>
        (p.status === 'pendente' || p.status === 'confirmado') &&
        _pedidosSomJaDisparado.has(p.id) &&
        !vistos.has(p.id)
    );
}

function _iniciarRepetidorSom() {
    if (_intervalSomPedido) return;
    _intervalSomPedido = setInterval(() => {
        if (_temPendentesNaoOuvidos()) {
            tocarSomPedido();
        } else {
            clearInterval(_intervalSomPedido);
            _intervalSomPedido = null;
        }
    }, 30 * 1000); // 30s: pedido novo precisa de resposta rápida
}

// ── Fim som de pedido ─────────────────────────────────────────────────────────

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
            tabAtual === 'ativos' ? loadPedidos() : loadPedidosArquivados();
        });
        if (empresaIdAtual) loadPedidos();
    } catch(e) { console.error(e); }
}

async function loadPedidos() {
    if (!empresaIdAtual) return;
    try {
        let url = `/pedidos?empresa_id=${empresaIdAtual}&arquivado=false&limit=100`;
        if (filtroAtual === 'novos') url += '&status=pendente';
        if (filtroAtual === 'finalizados') url += '&status=entregue';
        const response = await apiRequest(url);
        pedidos = response.pedidos || [];
        if (filtroAtual === 'novos') pedidos = pedidos.filter(p => !p.impresso);

        // Detectar pedidos pendentes novos não ouvidos ainda (localStorage + in-memory)
        const somVistos = _getPedidosSomVistos();
        const novosPendentes = pedidos.filter(p =>
            (p.status === 'pendente' || p.status === 'confirmado') &&
            !_pedidosSomJaDisparado.has(p.id) &&
            !somVistos.has(p.id)
        );
        if (novosPendentes.length > 0) {
            novosPendentes.forEach(p => _pedidosSomJaDisparado.add(p.id));
            if (!_primeiraCarregaPedidos) {
                // Só toca imediatamente para pedidos que chegaram depois da página abrir
                tocarSomPedido();
            }
            _iniciarRepetidorSom(); // inicia repetidor sempre (inclusive no primeiro carregamento)
        }
        _primeiraCarregaPedidos = false;

        // Atualizar contagem de pedidos pendentes no título da aba
        const pendentesCount = pedidos.filter(p => p.status === 'pendente').length;
        setPedidosPendentesCount(pendentesCount);

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

    const grupos = {};
    pedidos.forEach(p => {
        const chave = new Date(p.created_at).toISOString().split('T')[0];
        if (!grupos[chave]) grupos[chave] = [];
        grupos[chave].push(p);
    });
    const chaves = Object.keys(grupos).sort((a, b) => b.localeCompare(a));

    container.innerHTML = chaves.map(chave => {
        const label = formatarDataGrupo(chave);
        const cards = grupos[chave].map(pedido => {
            const selecionado = pedidosSelecionados.has(pedido.id);
            const podeArquivar = pedido.impresso || pedido.status === 'cancelado';
            const podeSairEntrega = pedido.status !== 'pendente' && pedido.status !== 'saiu_entrega' && pedido.status !== 'entregue' && pedido.status !== 'cancelado';
            return `
            <div class="rounded-xl shadow-sm border-2 transition ${selecionado ? 'border-indigo-400' : 'border-gray-200 hover:border-gray-300'}" style="border-left: 6px solid ${getStatusBorderColor(pedido.status)}; background-color: ${getStatusBgColor(pedido.status)}">
                <div class="flex items-start gap-3 p-6">
                    ${podeArquivar ? `<input type="checkbox" class="mt-1 w-4 h-4 flex-shrink-0 cursor-pointer accent-indigo-600" ${selecionado ? 'checked' : ''} onchange="toggleSelecao(${pedido.id})">` : '<div class="w-4 flex-shrink-0 mt-1"></div>'}
                    <div class="flex-1 cursor-pointer min-w-0" onclick="verDetalhes(${pedido.id})">
                        <div class="flex items-center gap-3 mb-2 flex-wrap">
                            <span class="text-2xl font-bold text-indigo-600">#${pedido.numero_diario || pedido.id}</span>
                            <span class="px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(pedido.status)}">${getStatusLabel(pedido.status)}</span>
                            ${pedido.impresso
                                ? '<span class="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">✓ Impresso</span>'
                                : '<span class="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">Não impresso</span>'}
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
                            <p class="text-sm text-gray-500">Endereço</p>
                            <p class="text-sm text-gray-900">${(pedido.cliente_endereco || '-').split('📍')[0].trim()}</p>
                        </div>
                        <p class="text-xs text-gray-400 mt-3">🕐 ${formatDate(pedido.created_at)}</p>
                    </div>
                    <div class="flex flex-col gap-2 flex-shrink-0 items-end pt-1">
                        ${podeSairEntrega ? `<button onclick="sairParaEntrega(${pedido.id})" class="text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-lg transition whitespace-nowrap">🛵 Saiu para entrega</button>` : ''}
                        ${podeArquivar ? `<button onclick="confirmarArquivar(${pedido.id})" class="text-sm text-gray-400 hover:text-orange-600 transition whitespace-nowrap">☐ Arquivar pedido</button>` : ''}
                    </div>
                </div>
            </div>`;
        }).join('');
        return `
            <div class="mb-6">
                <div class="flex items-center gap-3 mb-3">
                    <span class="text-sm font-bold text-gray-600">📅 ${label}</span>
                    <hr class="flex-1 border-gray-300">
                </div>
                <div class="space-y-4">${cards}</div>
            </div>`;
    }).join('');
}

function filtrarStatus(status) {
    filtroAtual = status;
    document.querySelectorAll('[id^="btn-"]').forEach(btn => {
        btn.className = 'px-4 py-2 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200';
    });
    document.getElementById('btn-' + status).className = 'px-4 py-2 rounded-lg font-medium bg-indigo-100 text-indigo-700';
    loadPedidos();
}

function switchTab(tab) {
    tabAtual = tab;
    const isAtivos = tab === 'ativos';
    document.getElementById('tab-ativos').className = isAtivos
        ? 'px-5 py-2 rounded-lg font-semibold text-sm bg-indigo-600 text-white transition'
        : 'px-5 py-2 rounded-lg font-semibold text-sm text-gray-600 hover:bg-gray-100 transition';
    document.getElementById('tab-arquivados').className = !isAtivos
        ? 'px-5 py-2 rounded-lg font-semibold text-sm bg-indigo-600 text-white transition'
        : 'px-5 py-2 rounded-lg font-semibold text-sm text-gray-600 hover:bg-gray-100 transition';
    document.getElementById('secaoAtivos').classList.toggle('hidden', !isAtivos);
    document.getElementById('secaoArquivados').classList.toggle('hidden', isAtivos);
    document.getElementById('btnPedidoManual').classList.toggle('hidden', !isAtivos);
    if (isAtivos) {
        loadPedidos();
    } else {
        limparSelecao();
        loadPedidosArquivados();
    }
}

function toggleSelecao(id) {
    if (pedidosSelecionados.has(id)) {
        pedidosSelecionados.delete(id);
    } else {
        pedidosSelecionados.add(id);
    }
    atualizarBarraSelecionados();
    renderPedidos();
}

function atualizarBarraSelecionados() {
    const barra = document.getElementById('barraSelecao');
    const count = pedidosSelecionados.size;
    if (count > 0) {
        document.getElementById('countSelecionados').textContent = `${count} pedido${count > 1 ? 's' : ''} selecionado${count > 1 ? 's' : ''}`;
        barra.classList.remove('hidden');
    } else {
        barra.classList.add('hidden');
    }
}

function limparSelecao() {
    pedidosSelecionados.clear();
    atualizarBarraSelecionados();
}

async function sairParaEntrega(id) {
    if (!confirm('Confirmar que o pedido saiu para entrega?')) return;
    try {
        await apiRequest(`/pedidos/${id}/saiu-entrega`, {
            method: 'PATCH',
            body: JSON.stringify({ empresa_id: empresaIdAtual })
        });
        await loadPedidos();
    } catch (error) { alert('Erro: ' + error.message); }
}

function confirmarArquivar(id) {
    if (!confirm('Tem certeza que deseja arquivar este pedido?')) return;
    arquivarPedido(id);
}

async function arquivarPedido(id) {
    try {
        await apiRequest(`/pedidos/${id}/arquivar`, {
            method: 'PATCH',
            body: JSON.stringify({ empresa_id: empresaIdAtual })
        });
        pedidosSelecionados.delete(id);
        atualizarBarraSelecionados();
        await loadPedidos();
    } catch (error) { alert('Erro ao arquivar: ' + error.message); }
}

async function arquivarSelecionados() {
    if (pedidosSelecionados.size === 0) return;
    const ids = [...pedidosSelecionados];
    try {
        await Promise.all(ids.map(id => apiRequest(`/pedidos/${id}/arquivar`, {
            method: 'PATCH',
            body: JSON.stringify({ empresa_id: empresaIdAtual })
        })));
        limparSelecao();
        await loadPedidos();
    } catch (error) { alert('Erro ao arquivar: ' + error.message); }
}

async function loadPedidosArquivados() {
    if (!empresaIdAtual) return;
    const container = document.getElementById('arquivadosContainer');
    container.innerHTML = '<div class="text-center py-12"><div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div><p class="text-gray-600 mt-4">Carregando...</p></div>';
    try {
        const response = await apiRequest(`/pedidos?empresa_id=${empresaIdAtual}&arquivado=true&limit=200`);
        renderPedidosArquivados(response.pedidos || []);
    } catch (error) { console.error('Erro:', error); }
}

function renderPedidosArquivados(lista) {
    const container = document.getElementById('arquivadosContainer');
    if (lista.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
                <span class="text-6xl">📦</span>
                <h3 class="text-xl font-semibold text-gray-900 mt-4">Nenhum pedido arquivado</h3>
                <p class="text-gray-600 mt-2">Pedidos entregues ou cancelados arquivados aparecerão aqui.</p>
            </div>`;
        return;
    }
    const grupos = {};
    lista.forEach(p => {
        const chave = new Date(p.created_at).toISOString().split('T')[0];
        if (!grupos[chave]) grupos[chave] = [];
        grupos[chave].push(p);
    });
    const chaves = Object.keys(grupos).sort((a, b) => b.localeCompare(a));
    container.innerHTML = chaves.map(chave => {
        const label = formatarDataGrupo(chave);
        const rows = grupos[chave].map(pedido => `
            <div class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 cursor-pointer transition" onclick="verDetalhes(${pedido.id})">
                <span class="text-gray-500 text-sm font-medium w-24 flex-shrink-0">[Pedido #${pedido.numero_diario || pedido.id}]</span>
                <span class="text-gray-800 text-sm flex-1 truncate">${pedido.cliente_nome || '-'}</span>
                <span class="text-gray-500 text-sm">-</span>
                <span class="text-green-700 text-sm font-medium flex-shrink-0">R$ ${parseFloat(pedido.total).toFixed(2)}</span>
                <span class="text-gray-500 text-sm">-</span>
                <span class="text-gray-500 text-sm flex-shrink-0">${getStatusLabel(pedido.status).toLowerCase()}</span>
            </div>`).join('');
        return `
            <div class="mb-4 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <p class="text-sm font-bold text-gray-700 mb-2">📅 ${label}</p>
                <hr class="border-gray-100 mb-2">
                ${rows}
            </div>`;
    }).join('');
}

function formatarDataGrupo(dataStr) {
    const d = new Date(dataStr + 'T12:00:00');
    const semana = d.toLocaleDateString('pt-BR', { weekday: 'long' });
    const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return semana.charAt(0).toUpperCase() + semana.slice(1) + ', ' + data;
}

async function verDetalhes(id) {
    _salvarPedidoSomVisto(id);
    _pedidosSomJaDisparado.add(id);
    if (!_temPendentesNaoOuvidos()) {
        clearInterval(_intervalSomPedido);
        _intervalSomPedido = null;
    }
    try {
        const response = await API.getPedido(id, getEmpresaId());
        const pedido = response.pedido;
        const itens = pedido.itens;
        const enderecoPartes = (pedido.cliente_endereco || '').split('📍');
        const enderecoTexto = enderecoPartes[0].trim();
        const localizacaoLink = enderecoPartes[1] ? enderecoPartes[1].trim() : null;
        document.getElementById('pedidoDetalhes').innerHTML = `
            <div class="space-y-3">
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="text-lg font-bold text-gray-900">Pedido #${pedido.numero_diario || pedido.id}</h4>
                        <p class="text-xs text-gray-500">${formatDate(pedido.created_at)}</p>
                    </div>
                    <span id="statusBadge" class="px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(pedido.status)}">${getStatusLabel(pedido.status)}</span>
                </div>
                <div>
                    <p class="text-xs font-medium text-gray-500 mb-1">Alterar Status</p>
                    <div class="flex gap-1.5 flex-wrap">
                        <button onclick="mudarStatus(${pedido.id}, 'pendente')" class="px-2 py-1 rounded-lg text-xs font-medium bg-yellow-100 text-yellow-700 hover:bg-yellow-200">Pendente</button>
                        <button onclick="mudarStatus(${pedido.id}, 'confirmado')" class="px-2 py-1 rounded-lg text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200">Confirmado</button>
                        <button onclick="mudarStatus(${pedido.id}, 'entregue')" class="px-2 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200">Entregue</button>
                        <button onclick="mudarStatus(${pedido.id}, 'cancelado')" class="px-2 py-1 rounded-lg text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200">Cancelado</button>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <p class="text-xs font-medium text-gray-500">Cliente</p>
                        <p class="text-sm font-semibold text-gray-900">${pedido.cliente_nome || '-'}</p>
                        <p class="text-xs text-gray-600">${formatPhone(pedido.cliente_telefone)}</p>
                    </div>
                    <div>
                        <p class="text-xs font-medium text-gray-500">Endereço</p>
                        <p class="text-xs text-gray-900">${enderecoTexto || '-'}</p>
                        ${localizacaoLink ? '<a href="' + localizacaoLink + '" target="_blank" class="text-indigo-600 text-xs">Ver no mapa</a>' : ''}
                    </div>
                </div>
                <div>
                    <p class="text-xs font-medium text-gray-500 mb-1">Itens do Pedido</p>
                    <div class="bg-gray-50 rounded-lg p-3 space-y-1">
                        ${itens.map(item => '<div class="flex justify-between text-sm"><span>' + item.quantidade + 'x ' + item.nome + '</span><span class="font-semibold">R$ ' + (item.quantidade * item.preco).toFixed(2) + '</span></div>').join('')}
                    </div>
                </div>
                <div class="border-t pt-2">
                    <div class="flex justify-between text-xs"><span class="text-gray-600">Subtotal</span><span>R$ ${parseFloat(pedido.subtotal).toFixed(2)}</span></div>
                    <div class="flex justify-between text-xs"><span class="text-gray-600">Taxa de Entrega</span><span>R$ ${parseFloat(pedido.taxa_entrega).toFixed(2)}</span></div>
                    <div class="flex justify-between text-base font-bold mt-1 pt-1 border-t"><span>Total</span><span class="text-green-600">R$ ${parseFloat(pedido.total).toFixed(2)}</span></div>
                </div>
                ${pedido.forma_pagamento ? '<div><p class="text-xs font-medium text-gray-500">Forma de Pagamento</p><p class="text-sm text-gray-900">' + pedido.forma_pagamento + '</p>' + (pedido.troco_para ? '<p class="text-xs text-gray-600">Troco para: R$ ' + parseFloat(pedido.troco_para).toFixed(2) + '</p>' : '') + '</div>' : ''}
                ${pedido.observacoes ? '<div><p class="text-xs font-medium text-gray-500">Observações</p><p class="text-sm text-gray-900">' + pedido.observacoes + '</p></div>' : ''}
                <div class="flex gap-2 pt-2">
                    <button onclick="imprimirPedido(${pedido.id})" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg text-sm transition">Imprimir</button>
                    <button onclick="fecharModal()" class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 rounded-lg text-sm transition">Fechar</button>
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

        function ascii(str) {
            return (str || '').replace(/[ãâà]/g,'a').replace(/[áä]/g,'a').replace(/[êè]/g,'e').replace(/[éë]/g,'e')
                .replace(/[îì]/g,'i').replace(/[íï]/g,'i').replace(/[õôò]/g,'o').replace(/[óö]/g,'o')
                .replace(/[ûù]/g,'u').replace(/[úü]/g,'u').replace(/ç/g,'c').replace(/[ÃÂÀ]/g,'A')
                .replace(/[ÁÄ]/g,'A').replace(/[ÊÈ]/g,'E').replace(/[ÉË]/g,'E').replace(/[ÎÌ]/g,'I')
                .replace(/[ÍÏ]/g,'I').replace(/[ÕÔÒ]/g,'O').replace(/[ÓÖ]/g,'O').replace(/[ÛÙ]/g,'U')
                .replace(/[ÚÜ]/g,'U').replace(/Ç/g,'C');
        }

        const enderecoTexto = ascii((pedido.cliente_endereco || '').split('📍')[0].trim());
        const enderecoExibir = enderecoTexto || 'RETIRADA NO LOCAL';
        const itensHtml = pedido.itens.map(item =>
            '<tr>' +
            '<td style="font-size:22px;font-weight:bold;padding:4px 0;">' + item.quantidade + 'x ' + ascii(item.nome) + '</td>' +
            '<td style="font-size:16px;text-align:right;vertical-align:middle;white-space:nowrap;">R$ ' + (item.quantidade * item.preco).toFixed(2) + '</td>' +
            '</tr>'
        ).join('');

        const cupom = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<title>Pedido #${pedido.id}</title>
<style>
  body { font-family: monospace; width: 72mm; margin: 0 auto; padding: 0; }
  @media print { @page { margin: 4mm; size: 80mm auto; } }
  p { margin: 3px 0; font-size: 16px; }
  table { width: 100%; border-collapse: collapse; margin: 4px 0; }
  td { padding: 2px 0; vertical-align: middle; }
  .linha { border-top: 1px dashed #000; margin: 8px 0; }
  .centro { text-align: center; }
</style>
</head>
<body>
<p class="centro" style="font-size:40px;font-weight:bold;margin:8px 0;">#${pedido.id}</p>
<p class="centro" style="font-size:13px;">${formatDate(pedido.created_at)}</p>
<div class="linha"></div>
<table>${itensHtml}</table>
<div class="linha"></div>
<table>
  <tr><td style="font-size:16px;">Subtotal</td><td style="font-size:16px;text-align:right;">R$ ${parseFloat(pedido.subtotal).toFixed(2)}</td></tr>
  <tr><td style="font-size:16px;">Entrega</td><td style="font-size:16px;text-align:right;">R$ ${parseFloat(pedido.taxa_entrega).toFixed(2)}</td></tr>
  <tr><td style="font-size:16px;font-weight:bold;">TOTAL</td><td style="font-size:16px;font-weight:bold;text-align:right;">R$ ${parseFloat(pedido.total).toFixed(2)}</td></tr>
  ${pedido.troco_para ? '<tr><td style="font-size:16px;">Troco para</td><td style="font-size:16px;text-align:right;">R$ ' + parseFloat(pedido.troco_para).toFixed(2) + '</td></tr>' : ''}
</table>
<div class="linha"></div>
<p><b>Cliente:</b> ${ascii(pedido.cliente_nome) || '-'}</p>
<p><b>Tel:</b> ${formatPhone(pedido.cliente_telefone)}</p>
<p><b>End:</b> ${enderecoExibir}</p>
<p><b>Pgto:</b> ${ascii(pedido.forma_pagamento) || '-'}</p>
${pedido.observacoes ? '<p><b>Obs:</b> ' + ascii(pedido.observacoes) + '</p>' : ''}
<div class="linha"></div>
<p class="centro" style="font-size:12px;">AmiConnect</p>
<script>window.onload = function() { window.print(); setTimeout(function(){ window.close(); }, 500); };<\/script>
</body>
</html>`;
        const janela = window.open('', '_blank', 'width=340,height=700');
        janela.document.write(cupom);
        janela.document.close();
        await API.marcarPedidoImpresso(id, getEmpresaId());
        await API.atualizarStatusPedido(id, 'confirmado', getEmpresaId());
        const badge = document.getElementById('statusBadge');
        if (badge) {
            badge.className = 'px-4 py-2 rounded-full font-medium bg-blue-100 text-blue-700';
            badge.textContent = 'Confirmado';
        }
        loadPedidos();
    } catch (error) { alert('Erro ao imprimir: ' + error.message); }
}

function getStatusBorderColor(status) {
    const colors = {
        'pendente':     '#F59E0B',
        'confirmado':   '#06B6D4',
        'saiu_entrega': '#8B5CF6',
        'entregue':     '#10B981',
        'cancelado':    '#EF4444'
    };
    return colors[status] || '#D1D5DB';
}

function getStatusBgColor(status) {
    const colors = {
        'pendente':     '#FFFBEB',
        'confirmado':   '#ECFEFF',
        'saiu_entrega': '#F5F3FF',
        'entregue':     '#F0FDF4',
        'cancelado':    '#FFF1F2'
    };
    return colors[status] || '#FFFFFF';
}

function getStatusColor(status) {
    const colors = {
        'pendente': 'bg-yellow-100 text-yellow-700',
        'confirmado': 'bg-blue-100 text-blue-700',
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
        'saiu_entrega': '🛵 Saiu para entrega',
        'entregue': 'Entregue',
        'cancelado': 'Cancelado'
    };
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
setInterval(() => { if (tabAtual === 'ativos') loadPedidos(); }, 30000);

// ===== PEDIDO MANUAL =====
let itensManuais = [];
let produtosDisponiveis = [];
let _pmTipoEntrega = 'entrega';
let _pmPerfil = null;
let _pmEnderecosSalvos = [];
let _pmTaxas = [];
let _pmTaxaPadrao = 0;
let _pmEmpresaLat = null;
let _pmEmpresaLng = null;

async function abrirPedidoManual() {
    itensManuais = [];
    _pmTipoEntrega = 'entrega';
    _pmPerfil = null;
    _pmEnderecosSalvos = [];
    _pmResultados = [];
    pmFecharDropdown();
    document.getElementById('pm_nome').value = '';
    document.getElementById('pm_telefone').value = '';
    document.getElementById('pm_endereco').value = '';
    document.getElementById('pm_endereco').classList.remove('hidden');
    document.getElementById('pm_endereco_select').classList.add('hidden');
    document.getElementById('pm_endereco_select').innerHTML = '';
    document.getElementById('pm_perfil_status').classList.add('hidden');
    document.getElementById('pm_pagamento').value = '';
    document.getElementById('pm_troco').value = '';
    document.getElementById('pm_obs').value = '';
    selecionarTipoEntregaManual('entrega');
    renderItensManual();
    atualizarTotaisManual();
    // Abrir modal imediatamente, carregar dados em paralelo
    document.getElementById('pedidoManualModal').classList.remove('hidden');

    const [prodRes, empresaRes, taxasRes] = await Promise.allSettled([
        API.getProdutos(empresaIdAtual),
        API.getEmpresa(empresaIdAtual),
        apiRequest(`/empresas/${empresaIdAtual}/taxas-entrega`)
    ]);

    if (prodRes.status === 'fulfilled') {
        produtosDisponiveis = (prodRes.value.produtos || []).filter(p => p.disponivel);
        const select = document.getElementById('pm_produto_select');
        select.innerHTML = '<option value="">Selecione um produto...</option>';
        produtosDisponiveis.forEach(p => {
            select.innerHTML += `<option value="${p.id}" data-preco="${p.preco}" data-nome="${p.nome}">${p.nome} - R$ ${parseFloat(p.preco).toFixed(2)}</option>`;
        });
    }
    if (empresaRes.status === 'fulfilled') {
        _pmTaxaPadrao = parseFloat(empresaRes.value.empresa.taxa_entrega) || 0;
        _pmEmpresaLat = parseFloat(empresaRes.value.empresa.latitude) || null;
        _pmEmpresaLng = parseFloat(empresaRes.value.empresa.longitude) || null;
        setTaxaManual(_pmTaxaPadrao);
    }
    _pmTaxas = taxasRes.status === 'fulfilled' ? (taxasRes.value.taxas || []) : [];
}

function selecionarTipoEntregaManual(tipo) {
    _pmTipoEntrega = tipo;
    const btnE = document.getElementById('pm_btn_entrega');
    const btnR = document.getElementById('pm_btn_retirada');
    const endSec = document.getElementById('pm_endereco_section');
    const ativo = 'flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold text-sm';
    const inativo = 'flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-gray-200 text-gray-500 font-semibold text-sm';
    if (tipo === 'entrega') {
        btnE.className = ativo; btnR.className = inativo;
        endSec.classList.remove('hidden');
        onEnderecoSelecionadoManual();
    } else {
        btnR.className = ativo; btnE.className = inativo;
        endSec.classList.add('hidden');
        setTaxaManual(0);
    }
}

// ── Autocomplete de perfil ────────────────────────────────────────────────────

let _pmDebounceTimer = null;
let _pmResultados = []; // cache dos últimos resultados do dropdown

let _pmAnchorId = 'pm_nome'; // campo que disparou a busca

function pmDebounce(q, fieldId) {
    _pmAnchorId = fieldId || 'pm_nome';
    clearTimeout(_pmDebounceTimer);
    if (!q || q.length < 1) { pmFecharDropdown(); return; }
    _pmDebounceTimer = setTimeout(() => pmBuscarDropdown(q), 300);
}

async function pmBuscarDropdown(q) {
    try {
        const res = await apiRequest(`/perfis/buscar?q=${encodeURIComponent(q)}`);
        _pmResultados = res.perfis || [];
        pmRenderDropdown(_pmResultados);
    } catch(e) { pmFecharDropdown(); }
}

function pmRenderDropdown(perfis) {
    const dropdown = document.getElementById('pm_dropdown');
    if (!perfis.length) { pmFecharDropdown(); return; }

    // Posicionar abaixo do campo que disparou
    const anchor = document.getElementById(_pmAnchorId);
    if (anchor) {
        const rect = anchor.getBoundingClientRect();
        dropdown.style.top  = (rect.bottom + 4) + 'px';
        dropdown.style.left = rect.left + 'px';
        dropdown.style.width = rect.width + 'px';
    }

    dropdown.innerHTML = perfis.map((p, i) => `
        <div class="px-4 py-2.5 hover:bg-indigo-50 cursor-pointer border-b border-gray-100 last:border-0"
             onmousedown="pmSelecionarPerfil(${i})">
            <p class="font-semibold text-gray-900 text-sm">${p.nome}</p>
            <p class="text-gray-400 text-xs">${p.telefone}</p>
        </div>`).join('');
    dropdown.classList.remove('hidden');
}

function pmFecharDropdown() {
    const el = document.getElementById('pm_dropdown');
    if (el) el.classList.add('hidden');
}

async function pmSelecionarPerfil(idx) {
    pmFecharDropdown();
    const p = _pmResultados[idx];
    if (!p) return;
    document.getElementById('pm_nome').value = p.nome;
    document.getElementById('pm_telefone').value = p.telefone;
    _pmEnderecosSalvos = p.enderecos || [];
    // Se a busca não incluiu endereços, buscar separado
    if (!_pmEnderecosSalvos.length) {
        try {
            const endRes = await apiRequest(`/perfis/${p.id}/enderecos`);
            _pmEnderecosSalvos = endRes.enderecos || [];
        } catch(e) {}
    }
    pmAplicarEnderecos(_pmEnderecosSalvos);
}

function pmAplicarEnderecos(enderecos) {
    const statusEl = document.getElementById('pm_perfil_status');
    const nome = document.getElementById('pm_nome').value;
    statusEl.textContent = `✅ Cliente encontrado: ${nome}`;
    statusEl.classList.remove('hidden');
    if (enderecos.length > 0) {
        const sel = document.getElementById('pm_endereco_select');
        sel.innerHTML = '';
        enderecos.forEach((e, i) => {
            const label = [e.rua, e.numero, e.bairro, e.cidade, e.complemento].filter(Boolean).join(', ');
            sel.innerHTML += `<option value="${i}" data-lat="${e.lat || ''}" data-lng="${e.lng || ''}">${label}</option>`;
        });
        sel.innerHTML += `<option value="outro">+ Outro endereço</option>`;
        sel.classList.remove('hidden');
        document.getElementById('pm_endereco').classList.add('hidden');
        document.getElementById('pm_endereco').value = '';
        onEnderecoSelecionadoManual();
    }
}

async function buscarPerfilManual() {
    // Mantido como fallback no blur — usa o valor do telefone
    const tel = document.getElementById('pm_telefone').value.trim().replace(/\D/g, '');
    if (tel.length < 10) return;
    try {
        const res = await apiRequest(`/perfis/buscar?q=${tel}`);
        const perfis = res.perfis || [];
        if (!perfis.length) return;
        const p = perfis[0];
        if (!document.getElementById('pm_nome').value) document.getElementById('pm_nome').value = p.nome;
        _pmEnderecosSalvos = p.enderecos || [];
        pmAplicarEnderecos(_pmEnderecosSalvos);
    } catch(e) { console.warn('Erro ao buscar perfil:', e); }
}

function onEnderecoSelecionadoManual() {
    if (_pmTipoEntrega === 'retirada') return;
    const sel = document.getElementById('pm_endereco_select');
    const input = document.getElementById('pm_endereco');
    if (sel.classList.contains('hidden')) {
        setTaxaManual(_pmTaxaPadrao);
        return;
    }
    if (sel.value === 'outro') {
        input.classList.remove('hidden');
        input.value = '';
        setTaxaManual(_pmTaxaPadrao);
        return;
    }
    input.classList.add('hidden');
    const opt = sel.options[sel.selectedIndex];
    const lat = parseFloat(opt.dataset.lat);
    const lng = parseFloat(opt.dataset.lng);
    if (lat && lng && _pmEmpresaLat && _pmEmpresaLng && _pmTaxas.length > 0) {
        setTaxaManual(calcularTaxaPorDistancia(lat, lng));
    } else {
        setTaxaManual(_pmTaxaPadrao);
    }
}

function calcularTaxaPorDistancia(lat, lng) {
    const R = 6371;
    const dLat = (lat - _pmEmpresaLat) * Math.PI / 180;
    const dLng = (lng - _pmEmpresaLng) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(_pmEmpresaLat * Math.PI/180) * Math.cos(lat * Math.PI/180) * Math.sin(dLng/2)**2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const taxas = [..._pmTaxas].sort((a, b) => a.distancia_ate_km - b.distancia_ate_km);
    for (const faixa of taxas) {
        if (dist <= faixa.distancia_ate_km) return parseFloat(faixa.taxa);
    }
    return taxas.length > 0 ? parseFloat(taxas[taxas.length-1].taxa) : _pmTaxaPadrao;
}

function setTaxaManual(valor) {
    document.getElementById('pm_taxa').value = parseFloat(valor).toFixed(2);
    atualizarTotaisManual();
}

function fecharPedidoManual() {
    document.getElementById('pedidoManualModal').classList.add('hidden');
}

function adicionarItemManual() {
    const select = document.getElementById('pm_produto_select');
    const opt = select.options[select.selectedIndex];
    const qty = parseInt(document.getElementById('pm_quantidade').value) || 1;
    if (!opt.value) return alert('Selecione um produto!');
    const existente = itensManuais.find(i => i.id == opt.value);
    if (existente) {
        existente.quantidade += qty;
    } else {
        itensManuais.push({ id: opt.value, nome: opt.dataset.nome, preco: parseFloat(opt.dataset.preco), quantidade: qty });
    }
    renderItensManual();
    atualizarTotaisManual();
    select.value = '';
    document.getElementById('pm_quantidade').value = 1;
}

function removerItemManual(id) {
    itensManuais = itensManuais.filter(i => i.id != id);
    renderItensManual();
    atualizarTotaisManual();
}

function renderItensManual() {
    const container = document.getElementById('pm_itens');
    if (itensManuais.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-sm text-center">Nenhum item adicionado</p>';
        return;
    }
    container.innerHTML = itensManuais.map(item => `<div class="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-200"><span class="text-sm font-medium">${item.quantidade}x ${item.nome}</span><div class="flex items-center gap-3"><span class="text-sm font-bold text-indigo-600">R$ ${(item.preco * item.quantidade).toFixed(2)}</span><button onclick="removerItemManual('${item.id}')" class="text-red-400 hover:text-red-600 font-bold text-lg leading-none">&times;</button></div></div>`).join('');
}

function atualizarTotaisManual() {
    const subtotal = itensManuais.reduce((acc, i) => acc + i.preco * i.quantidade, 0);
    const taxa = parseFloat(document.getElementById('pm_taxa').value) || 0;
    document.getElementById('pm_subtotal').textContent = `R$ ${subtotal.toFixed(2)}`;
    document.getElementById('pm_total').textContent = `R$ ${(subtotal + taxa).toFixed(2)}`;
}

async function salvarPedidoManual() {
    const nome = document.getElementById('pm_nome').value.trim();
    const telefone = document.getElementById('pm_telefone').value.trim();
    const pagamento = document.getElementById('pm_pagamento').value.trim();
    const troco = parseFloat(document.getElementById('pm_troco').value) || null;
    const obs = document.getElementById('pm_obs').value.trim();
    const retirada = _pmTipoEntrega === 'retirada';

    // Resolver endereço
    let endereco = '';
    if (!retirada) {
        const sel = document.getElementById('pm_endereco_select');
        if (!sel.classList.contains('hidden') && sel.value !== 'outro') {
            endereco = sel.options[sel.selectedIndex].text;
        } else {
            endereco = document.getElementById('pm_endereco').value.trim();
        }
    }

    if (!nome || !telefone || !pagamento) return alert('Preencha nome, telefone e forma de pagamento!');
    if (!retirada && !endereco) return alert('Preencha o endereço de entrega!');
    if (itensManuais.length === 0) return alert('Adicione pelo menos um item!');

    const taxa = parseFloat(document.getElementById('pm_taxa').value) || 0;
    const subtotal = itensManuais.reduce((acc, i) => acc + i.preco * i.quantidade, 0);
    const total = subtotal + taxa;
    try {
        await apiRequest('/pedidos/manual', {
            method: 'POST',
            body: JSON.stringify({ empresa_id: empresaIdAtual, cliente_nome: nome, cliente_telefone: telefone, cliente_endereco: endereco, itens: itensManuais.map(i => ({ nome: i.nome, quantidade: i.quantidade, preco: i.preco })), subtotal, taxa_entrega: taxa, total, forma_pagamento: pagamento, troco_para: troco, observacoes: obs, retirada })
        });
        fecharPedidoManual();
        loadPedidos();
        alert('Pedido criado com sucesso!');
    } catch(e) {
        alert('Erro ao salvar pedido: ' + e.message);
    }
}

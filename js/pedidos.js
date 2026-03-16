const user = checkAuth();
if (!user) { window.location.href = 'index.html'; }
document.getElementById('userName').textContent = user.nome;
let pedidos = [];
let filtroAtual = 'todos';
let tabAtual = 'ativos';
let pedidosSelecionados = new Set();
let empresaIdAtual = user.role === 'admin' ? (parseInt(localStorage.getItem('adminEmpresaId')) || null) : user.empresa_id;

// ── Som de pedido ─────────────────────────────────────────────────────────────

// Som de pedido novo
let _pedidoAudio = null;
let _pedidoUserInteracted = false;

document.addEventListener('click',    () => { _pedidoUserInteracted = true; });
document.addEventListener('keydown',  () => { _pedidoUserInteracted = true; });
document.addEventListener('touchstart', () => { _pedidoUserInteracted = true; });

// Pré-carrega o áudio na primeira interação para evitar delay
document.addEventListener('click', () => {
    if (!_pedidoAudio) _pedidoAudio = new Audio('/sounds/pedido.mp3');
}, { once: true });

function tocarSomPedido() {
    if (!_pedidoUserInteracted) return;
    try {
        if (!_pedidoAudio) _pedidoAudio = new Audio('/sounds/pedido.mp3');
        _pedidoAudio.volume = 1.0;
        _pedidoAudio.currentTime = 0;
        _pedidoAudio.play().catch(e => console.warn('Áudio pedido bloqueado:', e.message));
    } catch (e) { console.warn('Áudio pedido:', e.message); }
}

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

// Chamado pelo socket quando chega novo pedido — independente do filtro ativo
function registrarNovoPedidoSom(pedidoId) {
    if (_pedidosSomJaDisparado.has(pedidoId)) return;
    _pedidosSomJaDisparado.add(pedidoId);
    tocarSomPedido();
    _iniciarRepetidorSom();
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
                // Só toca para pedidos que chegaram depois da página abrir
                tocarSomPedido();
                _iniciarRepetidorSom();
            }
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
            <div class="bg-white rounded-xl shadow-sm border-2 transition ${selecionado ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'}">
                <div class="flex items-start gap-3 p-6">
                    ${podeArquivar ? `<input type="checkbox" class="mt-1 w-4 h-4 flex-shrink-0 cursor-pointer accent-indigo-600" ${selecionado ? 'checked' : ''} onchange="toggleSelecao(${pedido.id})">` : '<div class="w-4 flex-shrink-0 mt-1"></div>'}
                    <div class="flex-1 cursor-pointer min-w-0" onclick="verDetalhes(${pedido.id})">
                        <div class="flex items-center gap-3 mb-2 flex-wrap">
                            <span class="text-2xl font-bold text-indigo-600">#${pedido.id}</span>
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
                <span class="text-gray-500 text-sm font-medium w-24 flex-shrink-0">[Pedido #${pedido.id}]</span>
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
                        <button onclick="mudarStatus(${pedido.id}, 'confirmado')" class="px-3 py-1 rounded-lg text-sm font-medium bg-blue-100 text-blue-700 hover:bg-blue-200">Confirmado</button>
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

async function abrirPedidoManual() {
    itensManuais = [];
    document.getElementById('pm_nome').value = '';
    document.getElementById('pm_telefone').value = '';
    document.getElementById('pm_endereco').value = '';
    document.getElementById('pm_pagamento').value = '';
    document.getElementById('pm_troco').value = '';
    document.getElementById('pm_obs').value = '';
    renderItensManual();
    atualizarTotaisManual();
    try {
        const res = await API.getProdutos(empresaIdAtual);
        produtosDisponiveis = (res.produtos || []).filter(p => p.disponivel);
        const select = document.getElementById('pm_produto_select');
        select.innerHTML = '<option value="">Selecione um produto...</option>';
        produtosDisponiveis.forEach(p => {
            select.innerHTML += `<option value="${p.id}" data-preco="${p.preco}" data-nome="${p.nome}">${p.nome} - R$ ${parseFloat(p.preco).toFixed(2)}</option>`;
        });
    } catch(e) { console.error(e); }
    try {
        const res = await API.getEmpresa(empresaIdAtual);
        document.getElementById('pm_taxa').textContent = `R$ ${parseFloat(res.empresa.taxa_entrega).toFixed(2)}`;
    } catch(e) {}
    document.getElementById('pedidoManualModal').classList.remove('hidden');
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
    const taxaTexto = document.getElementById('pm_taxa').textContent.replace('R$ ', '').replace(',', '.');
    const taxa = parseFloat(taxaTexto) || 0;
    document.getElementById('pm_subtotal').textContent = `R$ ${subtotal.toFixed(2)}`;
    document.getElementById('pm_total').textContent = `R$ ${(subtotal + taxa).toFixed(2)}`;
}

async function salvarPedidoManual() {
    const nome = document.getElementById('pm_nome').value.trim();
    const telefone = document.getElementById('pm_telefone').value.trim();
    const endereco = document.getElementById('pm_endereco').value.trim();
    const pagamento = document.getElementById('pm_pagamento').value.trim();
    const troco = parseFloat(document.getElementById('pm_troco').value) || null;
    const obs = document.getElementById('pm_obs').value.trim();
    if (!nome || !telefone || !endereco || !pagamento) return alert('Preencha nome, telefone, endereço e forma de pagamento!');
    if (itensManuais.length === 0) return alert('Adicione pelo menos um item!');
    const taxaTexto = document.getElementById('pm_taxa').textContent.replace('R$ ', '').replace(',', '.');
    const taxa = parseFloat(taxaTexto) || 0;
    const subtotal = itensManuais.reduce((acc, i) => acc + i.preco * i.quantidade, 0);
    const total = subtotal + taxa;
    try {
        await apiRequest('/pedidos', {
            method: 'POST',
            body: JSON.stringify({ empresa_id: empresaIdAtual, cliente_nome: nome, cliente_telefone: telefone, cliente_endereco: endereco, itens: itensManuais.map(i => ({ nome: i.nome, quantidade: i.quantidade, preco: i.preco })), subtotal, taxa_entrega: taxa, total, forma_pagamento: pagamento, troco_para: troco, observacoes: obs, status: 'pendente' })
        });
        fecharPedidoManual();
        loadPedidos();
        alert('Pedido criado com sucesso!');
    } catch(e) {
        alert('Erro ao salvar pedido: ' + e.message);
    }
}

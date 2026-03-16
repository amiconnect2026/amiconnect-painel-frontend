let alertasNaoLidos = 0;
let todosAlertas = [];
let intervalAlertas = null;

// ── Audio engine ──────────────────────────────────────────────────────────────

let _audioCtx = null;
let _userInteracted = false;
const _tituloOriginal = document.title;

['click', 'keydown', 'touchstart'].forEach(ev =>
    document.addEventListener(ev, () => { _userInteracted = true; }, { once: true })
);

function _getAudioCtx() {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    return _audioCtx;
}

function tocarBeep(freq, dur, vol, tipo = 'square') {
    if (!_userInteracted) return;
    try {
        const ctx = _getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = tipo;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        osc.start();
        osc.stop(ctx.currentTime + dur);
    } catch (e) { console.warn('Áudio:', e.message); }
}

// Som de pedido novo — caixa registradora: ding → tchink → cling
function tocarSomPedido() {
    tocarBeep(1400, 0.08, 0.8, 'sine');                          // ding
    setTimeout(() => tocarBeep(2200, 0.06, 0.8, 'triangle'), 120); // tchink metálico
    setTimeout(() => tocarBeep(1800, 0.10, 0.8, 'sine'),       200); // cling final
}

// Som de alerta — MSN Messenger: B5 → E6
function tocarSomAlerta() {
    tocarBeep(988,  0.12, 0.5, 'sine');                         // B5
    setTimeout(() => tocarBeep(1319, 0.18, 0.5, 'sine'), 150); // E6
}

// ── Fim audio engine ──────────────────────────────────────────────────────────

// ── Title badge (pedidos + alertas) ──────────────────────────────────────────

let _pedidosPendentesCount = 0;

function setPedidosPendentesCount(n) {
    _pedidosPendentesCount = n;
    atualizarTitulo();
}

function atualizarTitulo() {
    const partes = [];
    if (_pedidosPendentesCount > 0) partes.push(`${_pedidosPendentesCount} pedido${_pedidosPendentesCount > 1 ? 's' : ''}`);
    if (alertasNaoLidos > 0) partes.push(`${alertasNaoLidos} alerta${alertasNaoLidos > 1 ? 's' : ''}`);
    document.title = partes.length > 0 ? `(${partes.join(', ')}) ${_tituloOriginal}` : _tituloOriginal;
}

// ── Fim title badge ───────────────────────────────────────────────────────────

// ── Controle de som de alertas ────────────────────────────────────────────────

const _STORAGE_ALERTAS_VISTOS = 'amiconnect_alertas_som_vistos';
const _alertasSomJaDisparado = new Set(); // in-memory: evita repetir no mesmo carregamento
let _intervalSomAlerta = null;

function _getAlertasSomVistos() {
    try { return new Set(JSON.parse(localStorage.getItem(_STORAGE_ALERTAS_VISTOS) || '[]')); }
    catch { return new Set(); }
}

function _salvarAlertasSomVistos(ids) {
    const vistos = _getAlertasSomVistos();
    ids.forEach(id => vistos.add(id));
    localStorage.setItem(_STORAGE_ALERTAS_VISTOS, JSON.stringify([...vistos].slice(-500)));
}

function _temAlertasNaoOuvidos() {
    const vistos = _getAlertasSomVistos();
    return todosAlertas.some(a => !a.lido && !vistos.has(a.id));
}

function _iniciarRepetidorAlerta() {
    if (_intervalSomAlerta) return;
    _intervalSomAlerta = setInterval(() => {
        if (_temAlertasNaoOuvidos()) {
            tocarSomAlerta();
        } else {
            clearInterval(_intervalSomAlerta);
            _intervalSomAlerta = null;
        }
    }, 60 * 1000); // 60s: alertas menos urgentes que pedidos
}

// ── Fim controle de som de alertas ────────────────────────────────────────────

function getEmpresaIdAtual() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.role === 'admin' ? (parseInt(localStorage.getItem('adminEmpresaId')) || null) : user.empresa_id;
}

async function iniciarAlertas() {
    await carregarAlertas();
    atualizarBadge();

    intervalAlertas = setInterval(async () => {
        await carregarAlertas();
        atualizarBadge();
    }, 5000);
}

async function carregarAlertas() {
    try {
        const empresaId = getEmpresaIdAtual();
        const [alertasRes, naoLidosRes] = await Promise.all([
            API.getAlertas(empresaId),
            API.getAlertasNaoLidos(empresaId)
        ]);

        todosAlertas = alertasRes.alertas || [];
        alertasNaoLidos = naoLidosRes.total || 0;

        // Detectar alertas novos não ouvidos ainda (localStorage + in-memory)
        const somVistos = _getAlertasSomVistos();
        const novosNaoOuvidos = todosAlertas.filter(a =>
            !a.lido && !_alertasSomJaDisparado.has(a.id) && !somVistos.has(a.id)
        );
        if (novosNaoOuvidos.length > 0) {
            novosNaoOuvidos.forEach(a => _alertasSomJaDisparado.add(a.id));
            tocarSomAlerta();
            _iniciarRepetidorAlerta();
        }

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
    atualizarTitulo();
}

function mostrarAlertas() {
    // Silencia o som: marca alertas não lidos como ouvidos no localStorage e para o intervalo
    const naoLidosIds = todosAlertas.filter(a => !a.lido).map(a => a.id);
    _salvarAlertasSomVistos(naoLidosIds);
    naoLidosIds.forEach(id => _alertasSomJaDisparado.add(id));
    clearInterval(_intervalSomAlerta);
    _intervalSomAlerta = null;

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
        const btnMarcarTodos = alertasNaoLidos > 0
            ? `<div class="px-4 py-2 border-b border-gray-200 flex justify-end">
                <button onclick="marcarTodosComoLido()" class="text-sm text-blue-600 hover:text-blue-800 font-medium">Marcar todos como lido</button>
               </div>`
            : '';

        lista.innerHTML = btnMarcarTodos + todosAlertas.map(alerta => `
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

        const alerta = todosAlertas.find(a => a.id === id);
        if (alerta) alerta.lido = true;
        alertasNaoLidos = todosAlertas.filter(a => !a.lido).length;

        mostrarAlertas();
        atualizarBadge();

        if (link) {
            fecharAlertas();
            window.location.href = link;
        }

    } catch (error) {
        console.error('Erro ao marcar alerta:', error);
    }
}

async function marcarTodosComoLido() {
    try {
        const naoLidos = todosAlertas.filter(a => !a.lido);
        await Promise.all(naoLidos.map(a => API.marcarAlertaLido(a.id)));

        todosAlertas.forEach(a => a.lido = true);
        alertasNaoLidos = 0;

        mostrarAlertas();
        atualizarBadge();

    } catch (error) {
        console.error('Erro ao marcar todos alertas como lido:', error);
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
    if (_intervalSomAlerta) clearInterval(_intervalSomAlerta);
});

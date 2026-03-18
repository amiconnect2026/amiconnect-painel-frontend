let alertasNaoLidos = 0;
let todosAlertas = [];
let intervalAlertas = null;

// ── Sons ──────────────────────────────────────────────────────────────────────

const _tituloOriginal = document.title;

// ── Som de alerta ─────────────────────────────────────────────────────────────
let _ctxAlerta = null;
let _bufAlerta  = null;

async function _initAlertaAudio() {
    if (_ctxAlerta) return;
    try {
        _ctxAlerta = new (window.AudioContext || window.webkitAudioContext)();
        if (localStorage.getItem('amiconnect_audio_unlocked') === '1') _ctxAlerta.resume().catch(() => {});
        const resp = await fetch('/sounds/alerta.mp3');
        const arr  = await resp.arrayBuffer();
        _bufAlerta = await _ctxAlerta.decodeAudioData(arr);
    } catch(e) { console.warn('Init áudio alerta:', e); }
}

function tocarSomAlerta() {
    if (!_ctxAlerta || !_bufAlerta) return;
    const play = () => {
        try {
            const src = _ctxAlerta.createBufferSource();
            const gain = _ctxAlerta.createGain();
            const comp = _ctxAlerta.createDynamicsCompressor();
            src.buffer = _bufAlerta;
            gain.gain.value = 2.0;
            src.connect(gain); gain.connect(comp); comp.connect(_ctxAlerta.destination);
            src.start(0);
        } catch(e) { console.warn('Play alerta:', e); }
    };
    if (_ctxAlerta.state === 'suspended') _ctxAlerta.resume().then(play).catch(() => {});
    else play();
}

_initAlertaAudio();

// ── Som de pedido (carregado em todas as páginas) ─────────────────────────────
let _ctxPedido = null;
let _bufPedido  = null;
const _pedidosSomJaDisparadoGlobal = new Set();

async function _initPedidoAudio() {
    if (_ctxPedido) return;
    try {
        _ctxPedido = new (window.AudioContext || window.webkitAudioContext)();
        if (localStorage.getItem('amiconnect_audio_unlocked') === '1') _ctxPedido.resume().catch(() => {});
        const resp = await fetch('/sounds/pedido.mp3');
        const arr  = await resp.arrayBuffer();
        _bufPedido = await _ctxPedido.decodeAudioData(arr);
        console.log('[Audio Pedido] Buffer carregado');
    } catch(e) { console.warn('Init áudio pedido:', e); }
}

function tocarSomPedido() {
    if (!_ctxPedido || !_bufPedido) { console.warn('[Audio Pedido] ctx ou buffer ausente'); return; }
    const play = () => {
        try {
            const src = _ctxPedido.createBufferSource();
            const gain = _ctxPedido.createGain();
            const comp = _ctxPedido.createDynamicsCompressor();
            src.buffer = _bufPedido;
            gain.gain.value = 3.0;
            src.connect(gain); gain.connect(comp); comp.connect(_ctxPedido.destination);
            src.start(0);
            console.log('[Audio Pedido] ✅ Som tocado');
        } catch(e) { console.error('[Audio Pedido] Play erro:', e); }
    };
    if (_ctxPedido.state === 'suspended') _ctxPedido.resume().then(play).catch(e => console.error('[Audio Pedido] Resume falhou:', e));
    else play();
}

// Repetidor global de pedido para páginas sem pedidos.js (máx 10x = 5 min)
let _intervalRepetidorPedidoGlobal = null;

function _iniciarRepetidorPedidoGlobal() {
    if (typeof _iniciarRepetidorSom === 'function') return; // pedidos.js gerencia
    if (_intervalRepetidorPedidoGlobal) return;
    let count = 0;
    _intervalRepetidorPedidoGlobal = setInterval(() => {
        count++;
        if (_pedidosSomJaDisparadoGlobal.size > 0 && count <= 10) {
            tocarSomPedido();
        } else {
            clearInterval(_intervalRepetidorPedidoGlobal);
            _intervalRepetidorPedidoGlobal = null;
        }
    }, 30 * 1000);
}

// Chamado pelo socket em qualquer página
function registrarNovoPedidoSom(pedidoId) {
    if (_pedidosSomJaDisparadoGlobal.has(pedidoId)) return;
    _pedidosSomJaDisparadoGlobal.add(pedidoId);
    // Sincroniza com o set do pedidos.js para evitar double-play no polling
    if (typeof _pedidosSomJaDisparado !== 'undefined') _pedidosSomJaDisparado.add(pedidoId);
    tocarSomPedido();
    if (typeof _iniciarRepetidorSom === 'function') _iniciarRepetidorSom();
    else _iniciarRepetidorPedidoGlobal();
}

_initPedidoAudio();

// ── Unlock unificado ──────────────────────────────────────────────────────────
function _unlockAudio() {
    localStorage.setItem('amiconnect_audio_unlocked', '1');
    if (_ctxAlerta && _ctxAlerta.state === 'suspended') _ctxAlerta.resume().catch(() => {});
    if (_ctxPedido && _ctxPedido.state === 'suspended') _ctxPedido.resume().catch(() => {});
    const b = document.getElementById('_bannerAudio');
    if (b) b.remove();
}
document.addEventListener('click',      _unlockAudio);
document.addEventListener('keydown',    _unlockAudio);
document.addEventListener('touchstart', _unlockAudio);

// ── Badge de novas conversas na nav ──────────────────────────────────────────

let _novasConversasCount = 0;

function _injetarBadgeConversas() {
    const link = document.querySelector('a[href="conversas.html"]');
    if (!link || link.querySelector('#conversasBadge')) return;
    const badge = document.createElement('span');
    badge.id = 'conversasBadge';
    badge.style.cssText = 'display:none;background:#22c55e;color:white;font-size:11px;font-weight:700;border-radius:9999px;min-width:18px;height:18px;align-items:center;justify-content:center;padding:0 4px;margin-left:4px;';
    link.style.display = 'inline-flex';
    link.style.alignItems = 'center';
    link.appendChild(badge);
}

function incrementarBadgeConversas() {
    if (window.location.pathname.includes('conversas')) return;
    _novasConversasCount++;
    const badge = document.getElementById('conversasBadge');
    if (!badge) return;
    badge.textContent = _novasConversasCount > 9 ? '9+' : _novasConversasCount;
    badge.style.display = 'inline-flex';
}

document.addEventListener('DOMContentLoaded', () => {
    _injetarBadgeConversas();
    // Zera o badge quando está na página de conversas
    if (window.location.pathname.includes('conversas')) {
        _novasConversasCount = 0;
    }
});

// ── Banner de ativação de áudio ───────────────────────────────────────────────
function _mostrarBannerAudio() {
    if (document.getElementById('_bannerAudio')) return;
    const b = document.createElement('div');
    b.id = '_bannerAudio';
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#f59e0b;color:#1a1a1a;text-align:center;padding:12px 16px;font-weight:700;cursor:pointer;font-size:15px;box-shadow:0 2px 8px rgba(0,0,0,.2);';
    b.innerHTML = '🔔 Clique aqui para ativar os alertas sonoros';
    b.onclick = _unlockAudio;
    document.body.appendChild(b);
}

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('amiconnect_audio_unlocked') !== '1') {
        _mostrarBannerAudio();
    }
});

// ── Fim sons ──────────────────────────────────────────────────────────────────

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
let _primeiraCarregaAlertas = true; // na primeira carga não toca — só marca os existentes

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
    // Repete som apenas pelos alertas que dispararam som nesta sessão
    // e o usuário ainda não abriu o sino (não está no localStorage)
    const vistos = _getAlertasSomVistos();
    return todosAlertas.some(a =>
        !a.lido &&
        _alertasSomJaDisparado.has(a.id) &&
        !vistos.has(a.id)
    );
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
            if (!_primeiraCarregaAlertas) {
                // Só toca para alertas que chegaram depois da página abrir
                tocarSomAlerta();
                _iniciarRepetidorAlerta();
            }
        }
        _primeiraCarregaAlertas = false;

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
    if (_intervalRepetidorPedidoGlobal) clearInterval(_intervalRepetidorPedidoGlobal);
});

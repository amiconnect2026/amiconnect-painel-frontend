// ── Auth ────────────────────────────────────────────────────────────────────

function checkGerenteAuth() {
    const token = sessionStorage.getItem('gerente_token');
    const nome  = sessionStorage.getItem('gerente_nome');
    if (!token) {
        window.location.href = 'gerente.html';
        return null;
    }
    return { token, nome, empresa_id: parseInt(sessionStorage.getItem('gerente_empresa_id')) };
}

function logoutGerente() {
    sessionStorage.removeItem('gerente_token');
    sessionStorage.removeItem('gerente_empresa_id');
    sessionStorage.removeItem('gerente_nome');
    window.location.href = 'gerente.html';
}

// ── Login form ───────────────────────────────────────────────────────────────

async function handleGerenteLogin(event) {
    event.preventDefault();

    const slug    = document.getElementById('empresa_slug').value.trim();
    const senha   = document.getElementById('senha_gerente').value;
    const btn     = document.getElementById('btnEntrar');
    const errEl   = document.getElementById('errorMessage');

    errEl.classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'Entrando...';

    try {
        const data = await API.loginGerente(slug, senha);

        sessionStorage.setItem('gerente_token',      data.token);
        sessionStorage.setItem('gerente_empresa_id', data.empresa.id);
        sessionStorage.setItem('gerente_nome',       data.empresa.nome);

        window.location.href = 'gerente-relatorios.html';

    } catch (error) {
        errEl.textContent = error.message || 'Credenciais inválidas.';
        errEl.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'Entrar';
    }
}

// ── API com token do gerente (sessionStorage) ────────────────────────────────

async function gerenteApiRequest(endpoint) {
    const token = sessionStorage.getItem('gerente_token');
    const response = await fetch(`${API_URL}${endpoint}`, {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Erro na requisição');
    return data;
}

// ── Relatórios ───────────────────────────────────────────────────────────────

let periodoGerenteAtual = 'mensal';

function setPeriodoGerente(periodo) {
    periodoGerenteAtual = periodo;
    document.querySelectorAll('.btn-periodo').forEach(btn => {
        const isActive = btn.dataset.periodo === periodo;
        btn.className = isActive
            ? 'btn-periodo px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white transition'
            : 'btn-periodo px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-gray-300 text-gray-600 hover:border-indigo-400 hover:text-indigo-600 transition';
    });
    carregarRelatoriosGerente(periodo);
}

async function carregarRelatoriosGerente(periodo) {
    const gerente = checkGerenteAuth();
    if (!gerente) return;

    const empresaId = gerente.empresa_id;
    const qs = `empresa_id=${empresaId}&periodo=${periodo}`;

    setGerenteLoading(true);

    try {
        const [faturamento, itens, horario, formas, clientes] = await Promise.all([
            gerenteApiRequest(`/relatorios/faturamento?${qs}`),
            gerenteApiRequest(`/relatorios/itens?${qs}`),
            gerenteApiRequest(`/relatorios/horario-pico?${qs}`),
            gerenteApiRequest(`/relatorios/formas-pagamento?${qs}`),
            gerenteApiRequest(`/relatorios/clientes?${qs}`)
        ]);

        renderFaturamento(faturamento);
        renderItens(itens.itens || []);
        renderHorario(horario.horarios || []);
        renderFormas(formas.formas || []);
        renderClientes(clientes.clientes || []);

    } catch (error) {
        if (error.message && error.message.includes('403')) {
            document.getElementById('relatoriosContent').innerHTML = `
                <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
                    <span class="text-5xl">🔒</span>
                    <h3 class="text-xl font-bold text-yellow-800 mt-4">Recurso exclusivo do plano Profissional</h3>
                    <p class="text-yellow-700 mt-2">Entre em contato com o suporte para fazer upgrade.</p>
                </div>
            `;
            return;
        }
        if (error.message && (error.message.includes('401') || error.message.includes('403'))) {
            logoutGerente();
            return;
        }
        console.error('Erro ao carregar relatórios:', error);
    } finally {
        setGerenteLoading(false);
    }
}

function setGerenteLoading(loading) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.toggle('hidden', !loading);
}

// ── Render (compartilhado com relatorios.js) ─────────────────────────────────

function formatCurrency(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function renderFaturamento(data) {
    document.getElementById('totalPedidos').textContent = data.total_pedidos ?? '-';
    document.getElementById('faturamentoTotal').textContent = formatCurrency(data.faturamento_total);
    document.getElementById('ticketMedio').textContent = formatCurrency(data.ticket_medio);
}

function renderItens(itens) {
    const tbody = document.getElementById('tbodyItens');
    if (itens.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center py-6 text-gray-400">Nenhum dado no período</td></tr>`;
        return;
    }
    tbody.innerHTML = itens.map((item, i) => `
        <tr class="border-b border-gray-100 hover:bg-gray-50">
            <td class="py-3 px-4"><span class="inline-flex items-center gap-2"><span class="text-xs font-bold text-gray-400">#${i + 1}</span>${item.nome}</span></td>
            <td class="py-3 px-4 text-center font-semibold text-gray-800">${item.quantidade_total}</td>
            <td class="py-3 px-4 text-right font-semibold text-green-600">${formatCurrency(item.receita_total)}</td>
        </tr>
    `).join('');
}

function renderHorario(horarios) {
    const tbody = document.getElementById('tbodyHorario');
    if (horarios.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" class="text-center py-6 text-gray-400">Nenhum dado no período</td></tr>`;
        return;
    }
    const maxQtd = Math.max(...horarios.map(h => h.quantidade_pedidos));
    tbody.innerHTML = horarios.map(h => {
        const pct = maxQtd > 0 ? Math.round((h.quantidade_pedidos / maxQtd) * 100) : 0;
        return `
        <tr class="border-b border-gray-100 hover:bg-gray-50">
            <td class="py-3 px-4 font-medium text-gray-800">${String(h.hora).padStart(2, '0')}h</td>
            <td class="py-3 px-4">
                <div class="flex items-center gap-3">
                    <div class="flex-1 bg-gray-100 rounded-full h-2">
                        <div class="bg-indigo-500 h-2 rounded-full" style="width:${pct}%"></div>
                    </div>
                    <span class="text-sm font-semibold text-gray-700 w-8 text-right">${h.quantidade_pedidos}</span>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function renderFormas(formas) {
    const tbody = document.getElementById('tbodyFormas');
    if (formas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-gray-400">Nenhum dado no período</td></tr>`;
        return;
    }
    tbody.innerHTML = formas.map(f => `
        <tr class="border-b border-gray-100 hover:bg-gray-50">
            <td class="py-3 px-4 font-medium text-gray-800">${f.forma || '-'}</td>
            <td class="py-3 px-4 text-center text-gray-700">${f.quantidade}</td>
            <td class="py-3 px-4 text-right font-semibold text-green-600">${formatCurrency(f.total)}</td>
            <td class="py-3 px-4 text-right"><span class="inline-block bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-full">${f.percentual}%</span></td>
        </tr>
    `).join('');
}

function renderClientes(clientes) {
    const tbody = document.getElementById('tbodyClientes');
    if (clientes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-gray-400">Nenhum dado no período</td></tr>`;
        return;
    }
    tbody.innerHTML = clientes.map((c, i) => `
        <tr class="border-b border-gray-100 hover:bg-gray-50">
            <td class="py-3 px-4"><span class="flex items-center gap-2"><span class="text-xs font-bold text-gray-400">#${i + 1}</span><span class="font-medium text-gray-800">${c.cliente_nome || '-'}</span></span></td>
            <td class="py-3 px-4 text-gray-600 text-sm">${c.cliente_telefone || '-'}</td>
            <td class="py-3 px-4 text-center font-semibold text-gray-700">${c.total_pedidos}</td>
            <td class="py-3 px-4 text-right font-semibold text-green-600">${formatCurrency(c.total_gasto)}</td>
        </tr>
    `).join('');
}

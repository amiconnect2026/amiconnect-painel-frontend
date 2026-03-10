let periodoAtual = 'mensal';

const SENHA_SESSION_PREFIX = 'relatorios_auth_exp_';

function getEmpresaIdAtual() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.role === 'admin' ? (parseInt(localStorage.getItem('adminEmpresaId')) || null) : user.empresa_id;
}

function initRelatorios() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (user.role === 'admin') {
        carregarRelatorios(periodoAtual);
        return;
    }

    const empresaId = getEmpresaIdAtual();
    const expiry = parseInt(sessionStorage.getItem(`${SENHA_SESSION_PREFIX}${empresaId}`) || '0');

    if (Date.now() < expiry) {
        carregarRelatorios(periodoAtual);
        return;
    }

    document.getElementById('senhaGerenteModal').classList.remove('hidden');
}

async function submeterSenhaGerente(event) {
    event.preventDefault();
    const senha  = document.getElementById('senhaGerenteInput').value;
    const errEl  = document.getElementById('senhaGerenteErro');
    const btn    = document.getElementById('btnSenhaGerente');
    const empresaId = getEmpresaIdAtual();

    errEl.classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'Verificando...';

    try {
        await API.verificarSenhaGerente(empresaId, senha);

        sessionStorage.setItem(
            `${SENHA_SESSION_PREFIX}${empresaId}`,
            String(Date.now() + 8 * 60 * 60 * 1000)
        );

        document.getElementById('senhaGerenteModal').classList.add('hidden');
        carregarRelatorios(periodoAtual);

    } catch (error) {
        errEl.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'Entrar';
    }
}

function cancelarSenhaGerente() {
    window.location.href = 'dashboard.html';
}

function formatCurrency(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function setPeriodo(periodo) {
    periodoAtual = periodo;
    document.querySelectorAll('.btn-periodo').forEach(btn => {
        const isActive = btn.dataset.periodo === periodo;
        btn.className = isActive
            ? 'btn-periodo px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white transition'
            : 'btn-periodo px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-gray-300 text-gray-600 hover:border-indigo-400 hover:text-indigo-600 transition';
    });
    carregarRelatorios(periodo);
}

async function carregarRelatorios(periodo) {
    const empresaId = getEmpresaIdAtual();
    if (!empresaId) return;

    setLoading(true);

    try {
        const [faturamento, itens, horario, formas, clientes] = await Promise.all([
            API.getRelatorioFaturamento(empresaId, periodo),
            API.getRelatorioItens(empresaId, periodo),
            API.getRelatorioHorarioPico(empresaId, periodo),
            API.getRelatorioFormasPagamento(empresaId, periodo),
            API.getRelatorioClientes(empresaId, periodo)
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
                    <p class="text-yellow-700 mt-2">Faça upgrade do seu plano para acessar os relatórios completos.</p>
                </div>
            `;
            return;
        }
        console.error('Erro ao carregar relatórios:', error);
    } finally {
        setLoading(false);
    }
}

function setLoading(loading) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.toggle('hidden', !loading);
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
            <td class="py-3 px-4">
                <span class="inline-flex items-center gap-2">
                    <span class="text-xs font-bold text-gray-400">#${i + 1}</span>
                    ${item.nome}
                </span>
            </td>
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
        </tr>
    `}).join('');
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
            <td class="py-3 px-4 text-right">
                <span class="inline-block bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-full">${f.percentual}%</span>
            </td>
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
            <td class="py-3 px-4">
                <span class="flex items-center gap-2">
                    <span class="text-xs font-bold text-gray-400">#${i + 1}</span>
                    <span class="font-medium text-gray-800">${c.cliente_nome || '-'}</span>
                </span>
            </td>
            <td class="py-3 px-4 text-gray-600 text-sm">${c.cliente_telefone || '-'}</td>
            <td class="py-3 px-4 text-center font-semibold text-gray-700">${c.total_pedidos}</td>
            <td class="py-3 px-4 text-right font-semibold text-green-600">${formatCurrency(c.total_gasto)}</td>
        </tr>
    `).join('');
}

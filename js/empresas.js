const user = checkAuth();
if (!user) window.location.href = 'index.html';
if (user.role !== 'admin') window.location.href = 'dashboard.html';
document.getElementById('userName').textContent = user.nome;

let empresas = [];
let editingId = null;

async function loadEmpresas() {
    try {
        const res = await apiRequest('/empresas');
        empresas = res.empresas || [];
        renderEmpresas();
    } catch (e) {
        console.error(e);
        alert('Erro ao carregar empresas: ' + e.message);
    }
}

function renderEmpresas() {
    const tbody = document.getElementById('tbodyEmpresas');
    if (!empresas.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-gray-400">Nenhuma empresa cadastrada.</td></tr>';
        return;
    }
    tbody.innerHTML = empresas.map(e => `
        <tr class="border-t border-gray-100 hover:bg-gray-50">
            <td class="px-4 py-3 font-medium text-gray-900">${e.nome}</td>
            <td class="px-4 py-3">
                <span class="px-2 py-1 rounded-full text-xs font-semibold ${e.plano === 'profissional' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}">${e.plano || 'basico'}</span>
            </td>
            <td class="px-4 py-3 text-sm">
                ${e.phone_number_id ? '<span class="text-green-600 font-medium">✓ Conectado</span>' : '<span class="text-gray-400">—</span>'}
            </td>
            <td class="px-4 py-3">
                <span class="px-2 py-1 rounded-full text-xs font-semibold ${e.ativo !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}">${e.ativo !== false ? 'Ativo' : 'Inativo'}</span>
            </td>
            <td class="px-4 py-3">
                <div class="flex gap-3">
                    <button onclick='openModal(${JSON.stringify(e)})' class="text-indigo-600 hover:text-indigo-800 text-sm font-medium">Editar</button>
                    <button onclick="toggleAtivo(${e.id}, ${e.ativo !== false})" class="text-sm font-medium ${e.ativo !== false ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'}">${e.ativo !== false ? 'Desativar' : 'Ativar'}</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openModal(empresa = null) {
    editingId = empresa ? empresa.id : null;
    document.getElementById('modalTitulo').textContent = empresa ? 'Editar Empresa' : 'Nova Empresa';
    document.getElementById('inputNome').value = empresa?.nome || '';
    document.getElementById('inputWhatsapp').value = empresa?.whatsapp || '+55';
    document.getElementById('inputEmail').value = empresa?.email || '';
    document.getElementById('inputSenha').value = '';
    document.getElementById('inputPlano').value = empresa?.plano || 'basico';
    document.getElementById('inputSenhaGerente').value = empresa?.senha_gerente || '';
    document.getElementById('senhaRow').classList.toggle('hidden', !!editingId);
    document.getElementById('modalEmpresa').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modalEmpresa').classList.add('hidden');
    editingId = null;
}

async function saveEmpresa() {
    const nome = document.getElementById('inputNome').value.trim();
    const whatsapp = document.getElementById('inputWhatsapp').value.trim();
    const email = document.getElementById('inputEmail').value.trim();
    const senha = document.getElementById('inputSenha').value;
    const plano = document.getElementById('inputPlano').value;
    const senha_gerente = document.getElementById('inputSenhaGerente').value.trim();

    if (!nome) return alert('Nome é obrigatório!');

    const dados = { nome, whatsapp, plano, senha_gerente };

    try {
        if (editingId) {
            await apiRequest(`/empresas/${editingId}`, {
                method: 'PATCH',
                body: JSON.stringify(dados)
            });
        } else {
            if (!email || !senha) return alert('Email e senha são obrigatórios para nova empresa!');
            await apiRequest('/empresas/cadastrar', {
                method: 'POST',
                body: JSON.stringify({ ...dados, email, senha })
            });
        }
        closeModal();
        loadEmpresas();
    } catch (e) {
        alert('Erro ao salvar: ' + e.message);
    }
}

async function toggleAtivo(id, atualmenteAtivo) {
    const acao = atualmenteAtivo ? 'desativar' : 'ativar';
    if (!confirm(`Deseja ${acao} esta empresa?`)) return;
    try {
        await apiRequest(`/empresas/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ ativo: !atualmenteAtivo })
        });
        loadEmpresas();
    } catch (e) {
        alert('Erro: ' + e.message);
    }
}

loadEmpresas();

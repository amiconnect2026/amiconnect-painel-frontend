// Verificar autenticação
const user = checkAuth();
if (!user) {
    window.location.href = 'index.html';
}

document.getElementById('userName').textContent = user.nome;

const isAdmin = user.role === 'admin';

let empresaSelecionadaId = isAdmin
    ? (parseInt(localStorage.getItem('adminEmpresaId')) || null)
    : user.empresa_id;

let categorias = [];
let editingCategoriaId = null;

async function init() {
    if (isAdmin) {
        await carregarSeletorEmpresas();
    }

    if (empresaSelecionadaId) {
        await carregarCategorias(empresaSelecionadaId);
    } else {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('selecioneEmpresa').classList.remove('hidden');
        document.getElementById('btnAdicionarCategoria').classList.add('hidden');
    }
}

async function carregarSeletorEmpresas() {
    try {
        const res = await apiRequest('/empresas');
        const empresas = res.empresas || [];

        const seletor = document.getElementById('seletorEmpresa');
        seletor.classList.remove('hidden');

        const select = document.getElementById('selectEmpresa');
        select.innerHTML = '<option value="">Selecione um restaurante...</option>';
        empresas.forEach(e => {
            select.innerHTML += `<option value="${e.id}" ${e.id == empresaSelecionadaId ? 'selected' : ''}>${e.nome}</option>`;
        });

        select.addEventListener('change', async (ev) => {
            const id = parseInt(ev.target.value);
            if (!id) return;
            localStorage.setItem('adminEmpresaId', id);
            empresaSelecionadaId = id;
            document.getElementById('selecioneEmpresa').classList.add('hidden');
            document.getElementById('categoriasContainer').classList.add('hidden');
            document.getElementById('loading').classList.remove('hidden');
            document.getElementById('btnAdicionarCategoria').classList.remove('hidden');
            await carregarCategorias(id);
        });
    } catch (error) {
        console.error('Erro ao carregar empresas:', error);
    }
}

async function carregarCategorias(empresaId) {
    try {
        const res = await API.getCategorias(empresaId);
        categorias = res.categorias || [];
        renderCategorias();
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
        alert('Erro ao carregar categorias. Verifique sua conexão.');
    }
}

function renderCategorias() {
    const container = document.getElementById('categoriasContainer');
    const loading = document.getElementById('loading');
    const emptyState = document.getElementById('emptyState');
    const dica = document.getElementById('dicaOrdem');

    loading.classList.add('hidden');

    if (categorias.length === 0) {
        emptyState.classList.remove('hidden');
        container.classList.add('hidden');
        dica.classList.add('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    container.classList.remove('hidden');
    dica.classList.remove('hidden');

    container.innerHTML = '';
    categorias.forEach((cat, index) => {
        const isFirst = index === 0;
        const isLast = index === categorias.length - 1;

        container.innerHTML += `
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-4">
                <div class="flex flex-col gap-1">
                    <button
                        onclick="moverCategoria(${index}, 'up')"
                        class="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition disabled:opacity-30 disabled:cursor-not-allowed"
                        ${isFirst ? 'disabled' : ''}
                        title="Mover para cima"
                    >▲</button>
                    <button
                        onclick="moverCategoria(${index}, 'down')"
                        class="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition disabled:opacity-30 disabled:cursor-not-allowed"
                        ${isLast ? 'disabled' : ''}
                        title="Mover para baixo"
                    >▼</button>
                </div>
                <div class="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-sm flex-shrink-0">
                    ${index + 1}
                </div>
                <div class="flex-1">
                    <span class="text-gray-900 font-semibold text-lg">${cat.nome}</span>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="editCategoria(${cat.id})" class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Editar">✏️</button>
                    <button onclick="deleteCategoria(${cat.id}, '${cat.nome.replace(/'/g, "\\'")}')" class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Deletar">🗑️</button>
                </div>
            </div>
        `;
    });
}

async function moverCategoria(index, direcao) {
    const novoIndex = direcao === 'up' ? index - 1 : index + 1;
    if (novoIndex < 0 || novoIndex >= categorias.length) return;

    // Trocar posições localmente
    [categorias[index], categorias[novoIndex]] = [categorias[novoIndex], categorias[index]];

    // Atualizar ordem no backend
    const ordens = categorias.map((cat, i) => ({ id: cat.id, ordem: i + 1 }));
    try {
        await API.reordenarCategorias(ordens);
    } catch (error) {
        console.error('Erro ao reordenar categorias:', error);
        alert('Erro ao salvar ordem: ' + error.message);
        await carregarCategorias(empresaSelecionadaId);
        return;
    }

    renderCategorias();
}

function openAddModal() {
    if (!empresaSelecionadaId) {
        alert('Selecione um restaurante primeiro!');
        return;
    }
    editingCategoriaId = null;
    document.getElementById('modalTitle').textContent = 'Adicionar Categoria';
    document.getElementById('categoriaForm').reset();
    document.getElementById('categoriaId').value = '';
    document.getElementById('categoriaModal').classList.remove('hidden');
    document.getElementById('categoriaNome').focus();
}

function editCategoria(id) {
    const cat = categorias.find(c => c.id === id);
    if (!cat) return;

    editingCategoriaId = id;
    document.getElementById('modalTitle').textContent = 'Editar Categoria';
    document.getElementById('categoriaId').value = cat.id;
    document.getElementById('categoriaNome').value = cat.nome;
    document.getElementById('categoriaModal').classList.remove('hidden');
    document.getElementById('categoriaNome').focus();
}

function closeModal() {
    document.getElementById('categoriaModal').classList.add('hidden');
    editingCategoriaId = null;
}

async function deleteCategoria(id, nome) {
    if (!confirm(`Tem certeza que deseja deletar a categoria "${nome}"?\n\nAtenção: os produtos desta categoria ficarão sem categoria.`)) return;
    try {
        await API.deleteCategoria(id);
        categorias = categorias.filter(c => c.id !== id);
        renderCategorias();
    } catch (error) {
        alert('Erro ao deletar categoria: ' + error.message);
    }
}

document.getElementById('categoriaForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const nome = document.getElementById('categoriaNome').value.trim();
    if (!nome) return;

    const dados = {
        empresa_id: empresaSelecionadaId,
        nome
    };

    try {
        if (editingCategoriaId) {
            const res = await API.updateCategoria(editingCategoriaId, dados);
            const cat = categorias.find(c => c.id === editingCategoriaId);
            if (cat) cat.nome = nome;
        } else {
            const res = await API.createCategoria(dados);
            const novaCat = res.categoria || { id: res.id, nome, ordem: categorias.length + 1 };
            categorias.push(novaCat);
        }

        closeModal();
        renderCategorias();
    } catch (error) {
        alert('Erro ao salvar categoria: ' + error.message);
    }
});

// Fechar modal ao clicar fora
document.getElementById('categoriaModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('categoriaModal')) {
        closeModal();
    }
});

init();

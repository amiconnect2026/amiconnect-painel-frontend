// Verificar autenticação
const user = checkAuth();
if (!user) {
    window.location.href = 'index.html';
}

document.getElementById('userName').textContent = user.nome;

const isAdmin = user.role === 'admin';

// Empresa selecionada atualmente
let empresaSelecionadaId = isAdmin 
    ? (parseInt(localStorage.getItem('adminEmpresaId')) || null)
    : user.empresa_id;

let categorias = [];
let produtos = [];
let editingProductId = null;
let selectedImageFile = null;

// Inicializar
async function init() {
    if (isAdmin) {
        document.getElementById('btnAdicionarProduto').classList.remove('hidden');
        await carregarSeletorEmpresas();
    }

    if (empresaSelecionadaId) {
        await carregarProdutos(empresaSelecionadaId);
    } else {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('selecioneEmpresa').classList.remove('hidden');
    }
}

// Carregar seletor de empresas (apenas admin)
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
            document.getElementById('produtosContainer').classList.add('hidden');
            document.getElementById('loading').classList.remove('hidden');
            await carregarProdutos(id);
        });
    } catch (error) {
        console.error('Erro ao carregar empresas:', error);
    }
}

// Carregar produtos da empresa
async function carregarProdutos(empresaId) {
    try {
        const [categoriasRes, produtosRes] = await Promise.all([
            API.getCategorias(empresaId),
            API.getProdutos(empresaId)
        ]);

        categorias = categoriasRes.categorias;
        produtos = produtosRes.produtos;

        const selectCategoria = document.getElementById('produtoCategoria');
        selectCategoria.innerHTML = '<option value="">Selecione...</option>';
        categorias.forEach(cat => {
            selectCategoria.innerHTML += `<option value="${cat.id}">${cat.nome}</option>`;
        });

        renderProdutos();
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        alert('Erro ao carregar dados. Verifique sua conexão.');
    }
}

// Renderizar produtos por categoria
function renderProdutos() {
    const container = document.getElementById('produtosContainer');
    const loading = document.getElementById('loading');
    const emptyState = document.getElementById('emptyState');

    loading.classList.add('hidden');

    if (produtos.length === 0) {
        emptyState.classList.remove('hidden');
        container.classList.add('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    container.classList.remove('hidden');

    const produtosPorCategoria = {};
    produtos.forEach(produto => {
        const categoriaNome = produto.categoria_nome || 'Sem categoria';
        if (!produtosPorCategoria[categoriaNome]) {
            produtosPorCategoria[categoriaNome] = [];
        }
        produtosPorCategoria[categoriaNome].push(produto);
    });

    container.innerHTML = '';
    Object.keys(produtosPorCategoria).forEach(categoriaNome => {
        const prods = produtosPorCategoria[categoriaNome];

        container.innerHTML += `
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 class="text-xl font-bold text-gray-900 mb-4">${categoriaNome}</h3>
                <div class="space-y-3">
                    ${prods.map(p => `
                        <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-indigo-300 transition gap-4">
                            <div class="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                                ${p.imagem_url 
                                    ? `<img src="${p.imagem_url}" alt="${p.nome}" class="w-full h-full object-cover">`
                                    : `<div class="w-full h-full flex items-center justify-center text-2xl">🍽️</div>`
                                }
                            </div>
                            <div class="flex-1">
                                <div class="flex items-center gap-3">
                                    <h4 class="font-semibold text-gray-900">${p.nome}</h4>
                                    <span class="text-lg font-bold text-indigo-600">R$ ${parseFloat(p.preco).toFixed(2)}</span>
                                </div>
                                ${p.descricao ? `<p class="text-sm text-gray-600 mt-1">${p.descricao}</p>` : ''}
                            </div>
                            <div class="flex items-center gap-2">
                                <button 
                                    onclick="toggleDisponivel(${p.id})" 
                                    class="px-4 py-2 rounded-lg font-medium transition ${p.disponivel ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}"
                                >
                                    ${p.disponivel ? '✅ Disponível' : '❌ Indisponível'}
                                </button>
                                ${isAdmin ? `
                                    <button onclick="editProduto(${p.id})" class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Editar">✏️</button>
                                    <button onclick="deleteProduto(${p.id}, '${p.nome}')" class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Deletar">🗑️</button>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });
}

function previewImagem(input) {
    const file = input.files[0];
    if (!file) return;
    selectedImageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('imagemPreview').src = e.target.result;
        document.getElementById('imagemPreviewContainer').classList.remove('hidden');
        document.getElementById('imagemPlaceholder').classList.add('hidden');
    };
    reader.readAsDataURL(file);
}

function removerImagem() {
    selectedImageFile = null;
    document.getElementById('imagemInput').value = '';
    document.getElementById('imagemPreviewContainer').classList.add('hidden');
    document.getElementById('imagemPlaceholder').classList.remove('hidden');
    document.getElementById('removerImagemFlag').value = 'true';
}

function openAddModal() {
    if (!isAdmin) return;
    if (!empresaSelecionadaId) {
        alert('Selecione um restaurante primeiro!');
        return;
    }
    editingProductId = null;
    selectedImageFile = null;
    document.getElementById('modalTitle').textContent = 'Adicionar Produto';
    document.getElementById('produtoForm').reset();
    document.getElementById('produtoId').value = '';
    document.getElementById('removerImagemFlag').value = 'false';
    document.getElementById('produtoDisponivel').checked = true;
    document.getElementById('imagemPreviewContainer').classList.add('hidden');
    document.getElementById('imagemPlaceholder').classList.remove('hidden');
    document.getElementById('produtoIsNovo').checked = false;
    document.getElementById('produtoDestaque').checked = false;
    document.getElementById('produtoTipoDestaque').value = 'mais_pedido';
    document.getElementById('produtoPromocao').checked = false;
    document.getElementById('produtoDesconto').value = '';
    document.getElementById('precoComDesconto').textContent = '';
    toggleTipoDestaque();
    toggleDesconto();
    document.getElementById('produtoModal').classList.remove('hidden');
}

function editProduto(id) {
    if (!isAdmin) return;
    const produto = produtos.find(p => p.id === id);
    if (!produto) return;

    editingProductId = id;
    selectedImageFile = null;

    document.getElementById('modalTitle').textContent = 'Editar Produto';
    document.getElementById('produtoId').value = produto.id;
    document.getElementById('removerImagemFlag').value = 'false';
    document.getElementById('produtoNome').value = produto.nome;
    document.getElementById('produtoDescricao').value = produto.descricao || '';
    document.getElementById('produtoPreco').value = produto.preco;
    document.getElementById('produtoCategoria').value = produto.categoria_id;
    document.getElementById('produtoDisponivel').checked = produto.disponivel;
    document.getElementById('produtoIsNovo').checked = produto.is_novo || false;
    document.getElementById('produtoDestaque').checked = produto.destaque || false;
    document.getElementById('produtoTipoDestaque').value = produto.tipo_destaque || 'mais_pedido';
    document.getElementById('produtoPromocao').checked = produto.promocao_ativa || false;
    document.getElementById('produtoDesconto').value = produto.desconto_percent || '';
    toggleTipoDestaque();
    toggleDesconto();
    atualizarPrecoDesconto();

    if (produto.imagem_url) {
        document.getElementById('imagemPreview').src = produto.imagem_url;
        document.getElementById('imagemPreviewContainer').classList.remove('hidden');
        document.getElementById('imagemPlaceholder').classList.add('hidden');
    } else {
        document.getElementById('imagemPreviewContainer').classList.add('hidden');
        document.getElementById('imagemPlaceholder').classList.remove('hidden');
    }

    document.getElementById('produtoModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('produtoModal').classList.add('hidden');
    editingProductId = null;
    selectedImageFile = null;
}

async function toggleDisponivel(id) {
    try {
        await API.toggleProduto(id);
        const produto = produtos.find(p => p.id === id);
        if (produto) produto.disponivel = !produto.disponivel;
        renderProdutos();
    } catch (error) {
        alert('Erro ao alterar disponibilidade: ' + error.message);
    }
}

async function deleteProduto(id, nome) {
    if (!isAdmin) return;
    if (!confirm(`Tem certeza que deseja deletar "${nome}"?`)) return;
    try {
        await API.deleteProduto(id);
        produtos = produtos.filter(p => p.id !== id);
        renderProdutos();
        alert('Produto deletado com sucesso!');
    } catch (error) {
        alert('Erro ao deletar produto: ' + error.message);
    }
}

document.getElementById('produtoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    const formData = new FormData();
    formData.append('empresa_id', empresaSelecionadaId);
    formData.append('categoria_id', document.getElementById('produtoCategoria').value);
    formData.append('nome', document.getElementById('produtoNome').value);
    formData.append('descricao', document.getElementById('produtoDescricao').value);
    formData.append('preco', document.getElementById('produtoPreco').value);
    formData.append('disponivel', document.getElementById('produtoDisponivel').checked);

    if (selectedImageFile) {
        formData.append('imagem', selectedImageFile);
    }
    formData.append('remover_imagem', document.getElementById('removerImagemFlag').value);
    formData.append('is_novo', document.getElementById('produtoIsNovo').checked);
    formData.append('destaque', document.getElementById('produtoDestaque').checked);
    formData.append('tipo_destaque', document.getElementById('produtoTipoDestaque').value);
    formData.append('promocao_ativa', document.getElementById('produtoPromocao').checked);
    formData.append('desconto_percent', document.getElementById('produtoDesconto').value || '');

    try {
        if (editingProductId) {
            await API.updateProduto(editingProductId, formData);
            alert('Produto atualizado com sucesso!');
        } else {
            const response = await API.createProduto(formData);
            produtos.push(response.produto);
            alert('Produto criado com sucesso!');
        }

        document.getElementById('removerImagemFlag').value = 'false';
        closeModal();
        await carregarProdutos(empresaSelecionadaId);
    } catch (error) {
        alert('Erro ao salvar produto: ' + error.message);
    }
});

function toggleTipoDestaque() {
    const checked = document.getElementById('produtoDestaque').checked;
    document.getElementById('produtoTipoDestaque').classList.toggle('hidden', !checked);
}

function toggleDesconto() {
    const checked = document.getElementById('produtoPromocao').checked;
    document.getElementById('descontoContainer').classList.toggle('hidden', !checked);
    if (!checked) document.getElementById('precoComDesconto').textContent = '';
}

function atualizarPrecoDesconto() {
    const preco = parseFloat(document.getElementById('produtoPreco').value) || 0;
    const desconto = parseFloat(document.getElementById('produtoDesconto').value) || 0;
    const span = document.getElementById('precoComDesconto');
    span.textContent = desconto > 0 && preco > 0 ? `→ R$ ${(preco * (1 - desconto / 100)).toFixed(2)}` : '';
}

init();

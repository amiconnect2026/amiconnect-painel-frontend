// Verificar autenticação
const user = checkAuth();
if (!user) {
    window.location.href = 'index.html';
}

document.getElementById('userName').textContent = user.nome;

const isAdmin = user.role === 'admin';
// Apenas admin pode adicionar, deletar e editar modal
const canEditModal = user.role === 'admin';

// Empresa selecionada atualmente
let empresaSelecionadaId = isAdmin
    ? (parseInt(localStorage.getItem('adminEmpresaId')) || null)
    : user.empresa_id;

let categorias = [];
let produtos = [];
let empresaAtual = null;
let editingProductId = null;
let selectedImageFile = null;
let modoSelecao = false;
let produtosSelecionados = new Set();
const descontoTimers = {};

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
        const [categoriasRes, produtosRes, empresaRes] = await Promise.all([
            API.getCategorias(empresaId),
            API.getProdutos(empresaId),
            API.getEmpresa(empresaId)
        ]);

        categorias = categoriasRes.categorias;
        produtos = produtosRes.produtos;
        empresaAtual = empresaRes.empresa;

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
                        <div class="border border-gray-200 rounded-lg hover:border-indigo-300 transition" id="card-${p.id}">
                            <div class="flex items-center gap-4 p-4">
                                ${modoSelecao ? `<input type="checkbox" class="w-5 h-5 flex-shrink-0" ${produtosSelecionados.has(p.id) ? 'checked' : ''} onchange="toggleSelecionarProduto(${p.id}, this.checked)">` : ''}
                                <div class="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                                    ${p.imagem_url
                                        ? `<img src="${p.imagem_url}" alt="${p.nome}" class="w-full h-full object-cover">`
                                        : `<div class="w-full h-full flex items-center justify-center text-2xl">🍽️</div>`
                                    }
                                </div>
                                <div class="flex-1">
                                    <div class="flex items-center gap-3 flex-wrap">
                                        <h4 class="font-semibold text-gray-900">${p.nome}</h4>
                                        <span class="text-lg font-bold text-indigo-600">R$ ${parseFloat(p.preco).toFixed(2)}</span>
                                        ${p.promocao_ativa && p.desconto_percent > 0 ? `<span class="text-sm text-green-600 font-medium line-through opacity-60">R$ ${parseFloat(p.preco).toFixed(2)}</span><span class="text-sm font-bold text-green-600">R$ ${(parseFloat(p.preco) * (1 - p.desconto_percent / 100)).toFixed(2)}</span>` : ''}
                                    </div>
                                    ${p.descricao ? `<p class="text-sm text-gray-600 mt-1">${p.descricao}</p>` : ''}
                                </div>
                                <div class="flex items-center gap-2 flex-shrink-0">
                                    <button
                                        onclick="toggleDisponivel(${p.id})"
                                        class="px-4 py-2 rounded-lg font-medium transition ${p.disponivel ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}"
                                    >
                                        ${p.disponivel ? '✅ Disponível' : '❌ Indisponível'}
                                    </button>
                                    ${canEditModal ? `
                                        <button onclick="editProduto(${p.id})" class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Editar">✏️</button>
                                        <button onclick="deleteProduto(${p.id}, '${p.nome.replace(/'/g, "\\'")}')" class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Deletar">🗑️</button>
                                    ` : ''}
                                </div>
                            </div>
                            <!-- Inline controls row -->
                            <div class="px-4 pb-3 flex items-center gap-4 flex-wrap border-t border-gray-100 pt-3">
                                <label class="flex items-center gap-1.5 cursor-pointer select-none">
                                    <input type="checkbox" class="w-4 h-4 accent-indigo-600"
                                        ${p.destaque ? 'checked' : ''}
                                        onchange="saveDestaqueToggle(${p.id}, this.checked)"
                                    >
                                    <span class="text-sm text-gray-700">🔥 Destaque</span>
                                </label>
                                <select
                                    id="tipoDestaque-${p.id}"
                                    class="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 transition ${p.destaque ? '' : 'opacity-40 pointer-events-none'}"
                                    onchange="saveTipoDestaque(${p.id}, this.value)"
                                >
                                    <option value="mais_pedido" ${p.tipo_destaque === 'mais_pedido' || !p.tipo_destaque ? 'selected' : ''}>🔥 Os mais pedidos</option>
                                    <option value="sugestao" ${p.tipo_destaque === 'sugestao' ? 'selected' : ''}>💡 Sugestão</option>
                                    <option value="destaque_dia" ${p.tipo_destaque === 'destaque_dia' ? 'selected' : ''}>⭐ Destaque do dia</option>
                                </select>
                                <label class="flex items-center gap-1.5 cursor-pointer select-none">
                                    <input type="checkbox" class="w-4 h-4 accent-green-600"
                                        ${p.is_novo ? 'checked' : ''}
                                        onchange="saveIsNovo(${p.id}, this.checked)"
                                    >
                                    <span class="text-sm text-gray-700">🆕 Novo</span>
                                </label>
                                <label class="flex items-center gap-1.5 cursor-pointer select-none">
                                    <input type="checkbox" class="w-4 h-4 accent-orange-500"
                                        ${p.promocao_ativa ? 'checked' : ''}
                                        onchange="savePromocaoToggle(${p.id}, this.checked)"
                                    >
                                    <span class="text-sm text-gray-700">🏷️ Promoção</span>
                                </label>
                                <input type="number" min="0" max="100" step="1"
                                    value="${p.desconto_percent || ''}"
                                    placeholder="% off"
                                    id="desconto-${p.id}"
                                    class="w-20 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-400 transition ${p.promocao_ativa ? '' : 'opacity-40 pointer-events-none'}"
                                    oninput="scheduleDescontoSave(${p.id}, this.value)"
                                >
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });
}

// ── Inline save helpers ───────────────────────────────────────────────────────

async function saveProductField(productId, fields) {
    const produto = produtos.find(p => p.id === productId);
    if (!produto) return;

    const formData = new FormData();
    formData.append('empresa_id', empresaSelecionadaId);
    formData.append('categoria_id', produto.categoria_id);
    formData.append('nome', produto.nome);
    formData.append('descricao', produto.descricao || '');
    formData.append('preco', produto.preco);
    formData.append('disponivel', produto.disponivel);
    formData.append('remover_imagem', 'false');
    formData.append('is_novo', fields.is_novo !== undefined ? fields.is_novo : (produto.is_novo || false));
    formData.append('destaque', fields.destaque !== undefined ? fields.destaque : (produto.destaque || false));
    formData.append('tipo_destaque', fields.tipo_destaque !== undefined ? fields.tipo_destaque : (produto.tipo_destaque || 'mais_pedido'));
    formData.append('promocao_ativa', fields.promocao_ativa !== undefined ? fields.promocao_ativa : (produto.promocao_ativa || false));
    const descPct = fields.desconto_percent !== undefined ? fields.desconto_percent : (produto.desconto_percent || '');
    formData.append('desconto_percent', descPct !== null ? descPct : '');

    await API.updateProduto(productId, formData);
    Object.assign(produto, fields);
}

async function saveDestaqueToggle(productId, checked) {
    const tipoSelect = document.getElementById(`tipoDestaque-${productId}`);
    if (tipoSelect) {
        tipoSelect.classList.toggle('opacity-40', !checked);
        tipoSelect.classList.toggle('pointer-events-none', !checked);
    }
    try {
        await saveProductField(productId, { destaque: checked });
    } catch (e) {
        alert('Erro ao salvar destaque: ' + e.message);
    }
}

async function saveTipoDestaque(productId, value) {
    try {
        await saveProductField(productId, { tipo_destaque: value });
    } catch (e) {
        alert('Erro ao salvar tipo de destaque: ' + e.message);
    }
}

async function saveIsNovo(productId, checked) {
    try {
        await saveProductField(productId, { is_novo: checked });
    } catch (e) {
        alert('Erro ao salvar: ' + e.message);
    }
}

async function savePromocaoToggle(productId, checked) {
    const descontoInput = document.getElementById(`desconto-${productId}`);
    if (descontoInput) {
        descontoInput.classList.toggle('opacity-40', !checked);
        descontoInput.classList.toggle('pointer-events-none', !checked);
    }
    try {
        await saveProductField(productId, { promocao_ativa: checked });
    } catch (e) {
        alert('Erro ao salvar promoção: ' + e.message);
    }
}

function scheduleDescontoSave(productId, value) {
    if (descontoTimers[productId]) clearTimeout(descontoTimers[productId]);
    descontoTimers[productId] = setTimeout(async () => {
        try {
            const desconto = value !== '' ? parseFloat(value) : null;
            await saveProductField(productId, { desconto_percent: desconto });
        } catch (e) {
            console.error('Erro ao salvar desconto:', e);
        }
    }, 800);
}

// ── Bulk selection ────────────────────────────────────────────────────────────

function toggleModoSelecao() {
    modoSelecao = !modoSelecao;
    produtosSelecionados.clear();
    const btn = document.getElementById('btnModoSelecao');
    const toolbar = document.getElementById('bulkActionsBar');
    if (btn) btn.textContent = modoSelecao ? '✕ Cancelar seleção' : '☑️ Selecionar produtos';
    if (toolbar) toolbar.classList.toggle('hidden', !modoSelecao);
    renderProdutos();
}

function toggleSelecionarProduto(productId, checked) {
    if (checked) produtosSelecionados.add(productId);
    else produtosSelecionados.delete(productId);
}

async function aplicarDescontoBulk() {
    if (produtosSelecionados.size === 0) return alert('Selecione ao menos um produto.');
    const pct = parseFloat(document.getElementById('bulkDesconto').value);
    if (isNaN(pct) || pct < 0 || pct > 100) return alert('Digite um desconto válido (0-100).');
    try {
        await Promise.all([...produtosSelecionados].map(id =>
            saveProductField(id, { desconto_percent: pct, promocao_ativa: true })
        ));
        await carregarProdutos(empresaSelecionadaId);
    } catch (e) {
        alert('Erro ao aplicar desconto: ' + e.message);
    }
}

async function removerDescontoBulk() {
    if (produtosSelecionados.size === 0) return alert('Selecione ao menos um produto.');
    if (!confirm('Remover desconto dos produtos selecionados?')) return;
    try {
        await Promise.all([...produtosSelecionados].map(id =>
            saveProductField(id, { desconto_percent: null, promocao_ativa: false })
        ));
        await carregarProdutos(empresaSelecionadaId);
    } catch (e) {
        alert('Erro ao remover desconto: ' + e.message);
    }
}

// ── Modal image helpers ───────────────────────────────────────────────────────

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

// ── Modal open/close ──────────────────────────────────────────────────────────

async function openAddModal() {
    if (!canEditModal) return;
    if (!empresaSelecionadaId) {
        alert('Selecione um restaurante primeiro!');
        return;
    }
    // Plano limit check
    if (empresaAtual && empresaAtual.plano === 'basico' && produtos.length >= 30) {
        alert('Limite de 30 produtos atingido no plano básico. Faça upgrade para adicionar mais produtos.');
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
    document.getElementById('produtoModal').classList.remove('hidden');
}

function editProduto(id) {
    if (!canEditModal) return;
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

// ── Toggle disponivel ─────────────────────────────────────────────────────────

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

// ── Delete ────────────────────────────────────────────────────────────────────

async function deleteProduto(id, nome) {
    if (!canEditModal) return;
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

// ── Form submit ───────────────────────────────────────────────────────────────

document.getElementById('produtoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!canEditModal) return;

    const produto = editingProductId ? produtos.find(p => p.id === editingProductId) : null;

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

    // Preserve existing destaque/promo values when editing via modal
    formData.append('is_novo', produto ? (produto.is_novo || false) : false);
    formData.append('destaque', produto ? (produto.destaque || false) : false);
    formData.append('tipo_destaque', produto ? (produto.tipo_destaque || 'mais_pedido') : 'mais_pedido');
    formData.append('promocao_ativa', produto ? (produto.promocao_ativa || false) : false);
    formData.append('desconto_percent', produto ? (produto.desconto_percent || '') : '');

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

init();

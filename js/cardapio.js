// Verificar autenticação
const user = checkAuth();
if (!user) {
    window.location.href = 'index.html';
}

// Mostrar nome do usuário
document.getElementById('userName').textContent = user.nome;

// Variáveis globais
let categorias = [];
let produtos = [];
let editingProductId = null;

// Carregar dados iniciais
async function init() {
    try {
        const empresaId = user.role === 'admin' ? 1 : user.empresa_id;
        
        // Carregar categorias e produtos
        const [categoriasRes, produtosRes] = await Promise.all([
            API.getCategorias(empresaId),
            API.getProdutos(empresaId)
        ]);

        categorias = categoriasRes.categorias;
        produtos = produtosRes.produtos;

        // Preencher select de categorias no modal
        const selectCategoria = document.getElementById('produtoCategoria');
        selectCategoria.innerHTML = '<option value="">Selecione...</option>';
        categorias.forEach(cat => {
            selectCategoria.innerHTML += `<option value="${cat.id}">${cat.nome}</option>`;
        });

        // Renderizar produtos
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

    // Agrupar produtos por categoria
    const produtosPorCategoria = {};
    produtos.forEach(produto => {
        const categoriaNome = produto.categoria_nome || 'Sem categoria';
        if (!produtosPorCategoria[categoriaNome]) {
            produtosPorCategoria[categoriaNome] = [];
        }
        produtosPorCategoria[categoriaNome].push(produto);
    });

    // Renderizar
    container.innerHTML = '';
    Object.keys(produtosPorCategoria).forEach(categoriaNome => {
        const prods = produtosPorCategoria[categoriaNome];
        
        container.innerHTML += `
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 class="text-xl font-bold text-gray-900 mb-4">${categoriaNome}</h3>
                <div class="space-y-3">
                    ${prods.map(p => `
                        <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-indigo-300 transition">
                            <div class="flex-1">
                                <div class="flex items-center gap-3">
                                    <h4 class="font-semibold text-gray-900">${p.nome}</h4>
                                    <span class="text-lg font-bold text-indigo-600">R$ ${parseFloat(p.preco).toFixed(2)}</span>
                                </div>
                                ${p.descricao ? `<p class="text-sm text-gray-600 mt-1">${p.descricao}</p>` : ''}
                            </div>
                            <div class="flex items-center gap-2">
                                <!-- Toggle Disponível -->
                                <button 
                                    onclick="toggleDisponivel(${p.id})" 
                                    class="px-4 py-2 rounded-lg font-medium transition ${p.disponivel ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}"
                                >
                                    ${p.disponivel ? '✅ Disponível' : '❌ Indisponível'}
                                </button>
                                
                                <!-- Editar -->
                                <button onclick="editProduto(${p.id})" class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Editar">
                                    ✏️
                                </button>
                                
                                <!-- Deletar -->
                                <button onclick="deleteProduto(${p.id}, '${p.nome}')" class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Deletar">
                                    🗑️
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });
}

// Abrir modal para adicionar
function openAddModal() {
    editingProductId = null;
    document.getElementById('modalTitle').textContent = 'Adicionar Produto';
    document.getElementById('produtoForm').reset();
    document.getElementById('produtoId').value = '';
    document.getElementById('produtoDisponivel').checked = true;
    document.getElementById('produtoModal').classList.remove('hidden');
}

// Editar produto
function editProduto(id) {
    const produto = produtos.find(p => p.id === id);
    if (!produto) return;

    editingProductId = id;
    document.getElementById('modalTitle').textContent = 'Editar Produto';
    document.getElementById('produtoId').value = produto.id;
    document.getElementById('produtoNome').value = produto.nome;
    document.getElementById('produtoDescricao').value = produto.descricao || '';
    document.getElementById('produtoPreco').value = produto.preco;
    document.getElementById('produtoCategoria').value = produto.categoria_id;
    document.getElementById('produtoDisponivel').checked = produto.disponivel;
    document.getElementById('produtoModal').classList.remove('hidden');
}

// Fechar modal
function closeModal() {
    document.getElementById('produtoModal').classList.add('hidden');
    editingProductId = null;
}

// Toggle disponível
async function toggleDisponivel(id) {
    try {
        await API.toggleProduto(id);
        
        // Atualizar localmente
        const produto = produtos.find(p => p.id === id);
        if (produto) {
            produto.disponivel = !produto.disponivel;
        }
        
        renderProdutos();
    } catch (error) {
        alert('Erro ao alterar disponibilidade: ' + error.message);
    }
}

// Deletar produto
async function deleteProduto(id, nome) {
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

// Submit do formulário
document.getElementById('produtoForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const empresaId = user.role === 'admin' ? 1 : user.empresa_id;
    const data = {
        empresa_id: empresaId,
        categoria_id: parseInt(document.getElementById('produtoCategoria').value),
        nome: document.getElementById('produtoNome').value,
        descricao: document.getElementById('produtoDescricao').value,
        preco: parseFloat(document.getElementById('produtoPreco').value),
        disponivel: document.getElementById('produtoDisponivel').checked
    };

    try {
        if (editingProductId) {
            // Editar
            await API.updateProduto(editingProductId, data);
            const index = produtos.findIndex(p => p.id === editingProductId);
            if (index !== -1) {
                produtos[index] = { ...produtos[index], ...data };
            }
            alert('Produto atualizado com sucesso!');
        } else {
            // Criar
            const response = await API.createProduto(data);
            produtos.push(response.produto);
            alert('Produto criado com sucesso!');
        }

        closeModal();
        renderProdutos();

    } catch (error) {
        alert('Erro ao salvar produto: ' + error.message);
    }
});

// Inicializar
init();

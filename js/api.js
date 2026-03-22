const API_URL = 'https://painel.amiconnect.com.br/api';

async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...options.headers
        },
        ...options
    };

    // Se for FormData, remover Content-Type para o browser definir automaticamente
    if (options.body instanceof FormData) {
        delete config.headers['Content-Type'];
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, config);
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Erro na requisição');
        }
        return data;
    } catch (error) {
        console.error('Erro na API:', error);
        throw error;
    }
}

const API = {
    async login(email, password) {
        return await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    },
    async getMe() {
        return await apiRequest('/auth/me');
    },
    async logout() {
        return await apiRequest('/auth/logout', { method: 'POST' });
    },
    async getProdutos(empresaId = null) {
        const query = empresaId ? `?empresa_id=${empresaId}` : '';
        return await apiRequest(`/produtos${query}`);
    },
    async getProduto(id) {
        return await apiRequest(`/produtos/${id}`);
    },
    async createProduto(formData) {
        return await apiRequest('/produtos', {
            method: 'POST',
            body: formData
        });
    },
    async updateProduto(id, formData) {
        return await apiRequest(`/produtos/${id}`, {
            method: 'PUT',
            body: formData
        });
    },
    async toggleProduto(id) {
        return await apiRequest(`/produtos/${id}/toggle`, {
            method: 'PATCH'
        });
    },
    async deleteProduto(id) {
        return await apiRequest(`/produtos/${id}`, {
            method: 'DELETE'
        });
    },
    async getCategorias(empresaId = null) {
        const query = empresaId ? `?empresa_id=${empresaId}` : '';
        return await apiRequest(`/categorias${query}`);
    },
    async createCategoria(data) {
        return await apiRequest('/categorias', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    async updateCategoria(id, data) {
        return await apiRequest(`/categorias/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },
    async deleteCategoria(id) {
        return await apiRequest(`/categorias/${id}`, {
            method: 'DELETE'
        });
    },
    async reordenarCategorias(ordens) {
        return await apiRequest('/categorias/reordenar', {
            method: 'PATCH',
            body: JSON.stringify({ ordens })
        });
    },
    async getConversas(empresaId = null) {
        const query = empresaId ? `?empresa_id=${empresaId}` : '';
        return await apiRequest(`/conversas${query}`);
    },
    async assumirConversa(telefone, empresaId) {
        return await apiRequest(`/conversas/${telefone}/assumir`, {
            method: 'PATCH',
            body: JSON.stringify({ empresa_id: empresaId })
        });
    },
    async liberarConversa(telefone, empresaId) {
        return await apiRequest(`/conversas/${telefone}/liberar`, {
            method: 'PATCH',
            body: JSON.stringify({ empresa_id: empresaId })
        });
    },
    async getAlertas(empresaId = null) {
        const query = empresaId ? `?empresa_id=${empresaId}` : '';
        return await apiRequest(`/alertas${query}`);
    },
    async getAlertasNaoLidos(empresaId = null) {
        const query = empresaId ? `?empresa_id=${empresaId}` : '';
        return await apiRequest(`/alertas/nao-lidos${query}`);
    },
    async marcarAlertaLido(id) {
        return await apiRequest(`/alertas/${id}/marcar-lido`, {
            method: 'PATCH'
        });
    },
    async criarAlerta(data) {
        return await apiRequest('/alertas', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    async getEmpresa(id) {
        return await apiRequest(`/empresas/${id}`);
    },
    async atualizarEmpresa(id, dados) {
        return await apiRequest(`/empresas/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(dados)
        });
    },
    async getPedidos(empresaId, status = null) {
        let query = `?empresa_id=${empresaId}`;
        if (status) query += `&status=${status}`;
        return await apiRequest(`/pedidos${query}`);
    },
    async getPedido(id, empresaId) {
        return await apiRequest(`/pedidos/${id}?empresa_id=${empresaId}`);
    },
    async atualizarStatusPedido(id, status, empresaId) {
        return await apiRequest(`/pedidos/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status, empresa_id: empresaId })
        });
    },
    async marcarPedidoImpresso(id, empresaId) {
        return await apiRequest(`/pedidos/${id}/imprimir`, {
            method: 'PATCH',
            body: JSON.stringify({ empresa_id: empresaId })
        });
    },
    async getRelatorioFaturamento(empresaId, periodo) {
        return await apiRequest(`/relatorios/faturamento?empresa_id=${empresaId}&periodo=${periodo}`);
    },
    async getRelatorioItens(empresaId, periodo) {
        return await apiRequest(`/relatorios/itens?empresa_id=${empresaId}&periodo=${periodo}`);
    },
    async getRelatorioHorarioPico(empresaId, periodo) {
        return await apiRequest(`/relatorios/horario-pico?empresa_id=${empresaId}&periodo=${periodo}`);
    },
    async getRelatorioFormasPagamento(empresaId, periodo) {
        return await apiRequest(`/relatorios/formas-pagamento?empresa_id=${empresaId}&periodo=${periodo}`);
    },
    async getRelatorioClientes(empresaId, periodo) {
        return await apiRequest(`/relatorios/clientes?empresa_id=${empresaId}&periodo=${periodo}`);
    },
    async loginGerente(empresa_slug, senha_gerente) {
        return await apiRequest('/auth/gerente', {
            method: 'POST',
            body: JSON.stringify({ empresa_slug, senha_gerente })
        });
    },
    async verificarSenhaGerente(empresa_id, senha) {
        return await apiRequest('/auth/verificar-senha-gerente', {
            method: 'POST',
            body: JSON.stringify({ empresa_id, senha })
        });
    },
    // Complementos
    async getComplementos(produtoId) {
        return await apiRequest(`/produtos/${produtoId}/complementos`);
    },
    async getGrupos(produtoId) {
        return await apiRequest(`/produtos/${produtoId}/grupos`);
    },
    async createGrupo(produtoId, data) {
        return await apiRequest(`/produtos/${produtoId}/grupos`, { method: 'POST', body: JSON.stringify(data) });
    },
    async updateGrupo(id, data) {
        return await apiRequest(`/produtos/grupos/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deleteGrupo(id) {
        return await apiRequest(`/produtos/grupos/${id}`, { method: 'DELETE' });
    },
    async createOpcao(grupoId, data) {
        return await apiRequest(`/produtos/grupos/${grupoId}/opcoes`, { method: 'POST', body: JSON.stringify(data) });
    },
    async updateOpcao(id, data) {
        return await apiRequest(`/produtos/opcoes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deleteOpcao(id) {
        return await apiRequest(`/produtos/opcoes/${id}`, { method: 'DELETE' });
    },
    async adicionarComplementoBulk(produtoIds, grupo) {
        return await apiRequest('/produtos/grupos/bulk', { method: 'POST', body: JSON.stringify({ produto_ids: produtoIds, grupo }) });
    },
    // Pizza
    async getPizzaPublico(empresaId) {
        return await apiRequest(`/pizzas/publico/${empresaId}`);
    },
    async getPizzaTamanhos(empresaId = null) {
        const query = empresaId ? `?empresa_id=${empresaId}` : '';
        return await apiRequest(`/pizzas/tamanhos${query}`);
    },
    async createPizzaTamanho(data, empresaId = null) {
        const query = empresaId ? `?empresa_id=${empresaId}` : '';
        return await apiRequest(`/pizzas/tamanhos${query}`, { method: 'POST', body: JSON.stringify(data) });
    },
    async updatePizzaTamanho(id, data) {
        return await apiRequest(`/pizzas/tamanhos/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deletePizzaTamanho(id) {
        return await apiRequest(`/pizzas/tamanhos/${id}`, { method: 'DELETE' });
    },
    async getPizzaSubcategorias(empresaId = null) {
        const query = empresaId ? `?empresa_id=${empresaId}` : '';
        return await apiRequest(`/pizzas/subcategorias${query}`);
    },
    async createPizzaSubcategoria(data, empresaId = null) {
        const query = empresaId ? `?empresa_id=${empresaId}` : '';
        return await apiRequest(`/pizzas/subcategorias${query}`, { method: 'POST', body: JSON.stringify(data) });
    },
    async updatePizzaSubcategoria(id, data) {
        return await apiRequest(`/pizzas/subcategorias/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deletePizzaSubcategoria(id) {
        return await apiRequest(`/pizzas/subcategorias/${id}`, { method: 'DELETE' });
    },
    async getPizzaSabores(empresaId = null, subcategoriaId = null) {
        let query = empresaId ? `?empresa_id=${empresaId}` : '';
        if (subcategoriaId) query += `${query ? '&' : '?'}subcategoria_id=${subcategoriaId}`;
        return await apiRequest(`/pizzas/sabores${query}`);
    },
    async createPizzaSabor(data, empresaId = null) {
        const query = empresaId ? `?empresa_id=${empresaId}` : '';
        return await apiRequest(`/pizzas/sabores${query}`, { method: 'POST', body: JSON.stringify(data) });
    },
    async updatePizzaSabor(id, data) {
        return await apiRequest(`/pizzas/sabores/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deletePizzaSabor(id) {
        return await apiRequest(`/pizzas/sabores/${id}`, { method: 'DELETE' });
    },
    async getPizzaBordas(empresaId = null) {
        const query = empresaId ? `?empresa_id=${empresaId}` : '';
        return await apiRequest(`/pizzas/bordas${query}`);
    },
    async createPizzaBorda(data, empresaId = null) {
        const query = empresaId ? `?empresa_id=${empresaId}` : '';
        return await apiRequest(`/pizzas/bordas${query}`, { method: 'POST', body: JSON.stringify(data) });
    },
    async updatePizzaBorda(id, data) {
        return await apiRequest(`/pizzas/bordas/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deletePizzaBorda(id) {
        return await apiRequest(`/pizzas/bordas/${id}`, { method: 'DELETE' });
    },
    async getSaborPrecos(saborId) {
        return await apiRequest(`/pizzas/sabores/${saborId}/precos`);
    },
    async saveSaborPrecos(saborId, precos) {
        return await apiRequest(`/pizzas/sabores/${saborId}/precos`, { method: 'POST', body: JSON.stringify({ precos }) });
    },
    async getPizzaConfig(produtoId) {
        return await apiRequest(`/pizzas/config/${produtoId}`);
    },
    async updatePizzaConfig(produtoId, data) {
        return await apiRequest(`/pizzas/config/${produtoId}`, { method: 'PUT', body: JSON.stringify(data) });
    }
};

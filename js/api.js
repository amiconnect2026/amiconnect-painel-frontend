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
    async getAlertas() {
        return await apiRequest('/alertas');
    },
    async getAlertasNaoLidos() {
        return await apiRequest('/alertas/nao-lidos');
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
    async getPedidos(empresaId, status = null) {
        let query = `?empresa_id=${empresaId}`;
        if (status) query += `&status=${status}`;
        return await apiRequest(`/pedidos${query}`);
    },
    async getPedido(id, empresaId) {
        return await apiRequest(`/pedidos/${id}?empresa_id=${empresaId}`);
    },
    async marcarPedidoImpresso(id, empresaId) {
        return await apiRequest(`/pedidos/${id}/imprimir`, {
            method: 'PATCH',
            body: JSON.stringify({ empresa_id: empresaId })
        });
    }
};

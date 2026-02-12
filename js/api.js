// Configuração da API
const API_URL = 'https://painel.amiconnect.com.br/api';

// Helper para fazer requisições
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

// Funções da API
const API = {
    // Autenticação
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

    // Produtos
    async getProdutos(empresaId = null) {
        const query = empresaId ? `?empresa_id=${empresaId}` : '';
        return await apiRequest(`/produtos${query}`);
    },

    async getProduto(id) {
        return await apiRequest(`/produtos/${id}`);
    },

    async createProduto(data) {
        return await apiRequest('/produtos', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async updateProduto(id, data) {
        return await apiRequest(`/produtos/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
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

    // Categorias
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
    }
};

const user = checkAuth();
if (!user) window.location.href = 'index.html';
document.getElementById('userName').textContent = user.nome;

const empresaId = user.role === 'admin' ? (parseInt(localStorage.getItem('adminEmpresaId')) || user.empresa_id) : user.empresa_id;

async function carregarConfiguracoes() {
    try {
        const response = await API.getEmpresa(empresaId);
        const empresa = response.empresa;

        document.getElementById('tempo_entrega_min').value = empresa.tempo_entrega_min || '';
        document.getElementById('tempo_entrega_max').value = empresa.tempo_entrega_max || '';
        document.getElementById('taxa_entrega').value = empresa.taxa_entrega || '';
        document.getElementById('pedido_minimo').value = empresa.pedido_minimo || '';
        document.getElementById('formas_pagamento').value = empresa.formas_pagamento || '';

        document.getElementById('loading').classList.add('hidden');
        document.getElementById('formContainer').classList.remove('hidden');
    } catch (error) {
        alert('Erro ao carregar configuracoes: ' + error.message);
    }
}

async function salvarConfiguracoes() {
    try {
        const dados = {
            tempo_entrega_min: parseInt(document.getElementById('tempo_entrega_min').value),
            tempo_entrega_max: parseInt(document.getElementById('tempo_entrega_max').value),
            taxa_entrega: parseFloat(document.getElementById('taxa_entrega').value),
            pedido_minimo: parseFloat(document.getElementById('pedido_minimo').value),
            formas_pagamento: document.getElementById('formas_pagamento').value
        };

        await API.atualizarEmpresa(empresaId, dados);

        const msg = document.getElementById('mensagem');
        msg.textContent = 'Configuracoes salvas com sucesso!';
        msg.className = 'text-center py-3 rounded-lg font-medium bg-green-100 text-green-700';
        msg.classList.remove('hidden');
        setTimeout(() => msg.classList.add('hidden'), 3000);
    } catch (error) {
        alert('Erro ao salvar: ' + error.message);
    }
}

carregarConfiguracoes();

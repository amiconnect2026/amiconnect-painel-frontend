const user = checkAuth();
if (!user) window.location.href = 'index.html';
document.getElementById('userName').textContent = user.nome;

let empresaIdAtual = user.role === 'admin' ? (parseInt(localStorage.getItem('adminEmpresaId')) || null) : user.empresa_id;

async function carregarSeletorEmpresas() {
    if (user.role !== 'admin') {
        if (empresaIdAtual) carregarConfiguracoes(empresaIdAtual);
        return;
    }
    try {
        const res = await apiRequest('/empresas');
        const empresas = res.empresas || [];
        const seletor = document.getElementById('seletorEmpresa');
        seletor.classList.remove('hidden');
        const select = document.getElementById('selectEmpresa');
        select.innerHTML = '<option value="">Selecione um restaurante...</option>';
        empresas.forEach(e => {
            select.innerHTML += `<option value="${e.id}" ${e.id == empresaIdAtual ? 'selected' : ''}>${e.nome}</option>`;
        });
        select.addEventListener('change', (ev) => {
            const id = parseInt(ev.target.value);
            if (!id) return;
            localStorage.setItem('adminEmpresaId', id);
            empresaIdAtual = id;
            carregarConfiguracoes(id);
        });
        if (empresaIdAtual) carregarConfiguracoes(empresaIdAtual);
    } catch(e) { console.error(e); }
}

async function carregarConfiguracoes(empresaId) {
    try {
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('formContainer').classList.add('hidden');
        const response = await API.getEmpresa(empresaId);
        const empresa = response.empresa;
        document.getElementById('tempo_entrega_min').value = empresa.tempo_entrega_min || '';
        document.getElementById('tempo_entrega_max').value = empresa.tempo_entrega_max || '';
        document.getElementById('taxa_entrega').value = empresa.taxa_entrega || '';
        document.getElementById('pedido_minimo').value = empresa.pedido_minimo || '';
        document.getElementById('formas_pagamento').value = empresa.formas_pagamento || '';
        document.getElementById('endereco_restaurante').value = empresa.endereco_restaurante || '';
        document.getElementById('raio_entrega_km').value = empresa.raio_entrega_km || '';
        document.getElementById('latitude').value = empresa.latitude || '';
        document.getElementById('longitude').value = empresa.longitude || '';
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('formContainer').classList.remove('hidden');
    } catch (error) {
        alert('Erro ao carregar configuracoes: ' + error.message);
    }
}

async function salvarConfiguracoes() {
    if (!empresaIdAtual) return alert('Selecione um restaurante!');
    try {
        const dados = {
            tempo_entrega_min: parseInt(document.getElementById('tempo_entrega_min').value),
            tempo_entrega_max: parseInt(document.getElementById('tempo_entrega_max').value),
            taxa_entrega: parseFloat(document.getElementById('taxa_entrega').value),
            pedido_minimo: parseFloat(document.getElementById('pedido_minimo').value),
            formas_pagamento: document.getElementById('formas_pagamento').value,
            endereco_restaurante: document.getElementById('endereco_restaurante').value,
            raio_entrega_km: parseFloat(document.getElementById('raio_entrega_km').value) || null,
            latitude: parseFloat(document.getElementById('latitude').value) || null,
            longitude: parseFloat(document.getElementById('longitude').value) || null
        };
        await API.atualizarEmpresa(empresaIdAtual, dados);
        const msg = document.getElementById('mensagem');
        msg.textContent = 'Configuracoes salvas com sucesso!';
        msg.className = 'text-center py-3 rounded-lg font-medium bg-green-100 text-green-700';
        msg.classList.remove('hidden');
        setTimeout(() => msg.classList.add('hidden'), 3000);
    } catch (error) {
        alert('Erro ao salvar: ' + error.message);
    }
}

carregarSeletorEmpresas();

async function geocodificarEndereco() {
    const endereco = document.getElementById('endereco_restaurante').value.trim();
    if (!endereco) return alert('Digite o endereco primeiro!');
    try {
        const res = await apiRequest('/empresas/geocodificar?endereco=' + encodeURIComponent(endereco));
        document.getElementById('latitude').value = res.latitude;
        document.getElementById('longitude').value = res.longitude;
        alert('Coordenadas atualizadas!');
    } catch (error) {
        alert('Erro ao geocodificar: ' + error.message);
    }
}

const user = checkAuth();
if (!user) window.location.href = 'index.html';
document.getElementById('userName').textContent = user.nome;

let empresaIdAtual = user.role === 'admin' ? (parseInt(localStorage.getItem('adminEmpresaId')) || null) : user.empresa_id;
let fotoCapa_file = null;
let fotoCapa_remover = false;

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
        document.getElementById('horario_funcionamento').value = empresa.horario_funcionamento || '';
        // hora_abertura/fechamento vem como "HH:MM:SS" do PostgreSQL TIME — pegar só HH:MM
        document.getElementById('hora_abertura').value = (empresa.hora_abertura || '09:00').substring(0, 5);
        document.getElementById('hora_fechamento').value = (empresa.hora_fechamento || '22:00').substring(0, 5);
        document.getElementById('endereco_restaurante').value = empresa.endereco_restaurante || '';
        document.getElementById('raio_entrega_km').value = empresa.raio_entrega_km || '';
        document.getElementById('latitude').value = empresa.latitude || '';
        document.getElementById('longitude').value = empresa.longitude || '';
        document.getElementById('permite_retirada').checked = empresa.permite_retirada !== false;
        document.getElementById('tipo_negocio').value = empresa.tipo_negocio || 'restaurante';
        localStorage.setItem('empresaTipoNegocio', empresa.tipo_negocio || 'restaurante');
        carregarTaxas(empresaId);
        if (empresa.foto_capa) {
            document.getElementById('fotoCapa_preview').src = empresa.foto_capa;
            document.getElementById('fotoCapa_previewContainer').classList.remove('hidden');
            document.getElementById('fotoCapa_placeholder').classList.add('hidden');
        } else {
            document.getElementById('fotoCapa_previewContainer').classList.add('hidden');
            document.getElementById('fotoCapa_placeholder').classList.remove('hidden');
        }
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('formContainer').classList.remove('hidden');
    } catch (error) {
        alert('Erro ao carregar configuracoes: ' + error.message);
    }
}

function previewFotoCapa(input) {
    const file = input.files[0];
    if (!file) return;
    fotoCapa_file = file;
    fotoCapa_remover = false;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('fotoCapa_preview').src = e.target.result;
        document.getElementById('fotoCapa_previewContainer').classList.remove('hidden');
        document.getElementById('fotoCapa_placeholder').classList.add('hidden');
    };
    reader.readAsDataURL(file);
}

function removerFotoCapa() {
    fotoCapa_file = null;
    fotoCapa_remover = true;
    document.getElementById('fotoCapa_input').value = '';
    document.getElementById('fotoCapa_previewContainer').classList.add('hidden');
    document.getElementById('fotoCapa_placeholder').classList.remove('hidden');
}

async function salvarFotoCapa() {
    if (!empresaIdAtual) return alert('Selecione um restaurante!');
    if (!fotoCapa_file && !fotoCapa_remover) return alert('Nenhuma alteração na foto de capa.');
    const formData = new FormData();
    if (fotoCapa_file) {
        formData.append('foto_capa', fotoCapa_file);
    } else {
        formData.append('remover_foto_capa', 'true');
    }
    try {
        await apiRequest(`/empresas/${empresaIdAtual}/foto-capa`, { method: 'PATCH', body: formData });
        fotoCapa_file = null;
        fotoCapa_remover = false;
        alert('Foto de capa salva com sucesso!');
    } catch(e) {
        alert('Erro ao salvar foto de capa: ' + e.message);
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
            horario_funcionamento: document.getElementById('horario_funcionamento').value,
            hora_abertura: document.getElementById('hora_abertura').value || '09:00',
            hora_fechamento: document.getElementById('hora_fechamento').value || '22:00',
            formas_pagamento: document.getElementById('formas_pagamento').value,
            endereco_restaurante: document.getElementById('endereco_restaurante').value,
            raio_entrega_km: parseFloat(document.getElementById('raio_entrega_km').value) || null,
            latitude: parseFloat(document.getElementById('latitude').value) || null,
            longitude: parseFloat(document.getElementById('longitude').value) || null,
            permite_retirada: document.getElementById('permite_retirada').checked,
            tipo_negocio: document.getElementById('tipo_negocio').value
        };
        await API.atualizarEmpresa(empresaIdAtual, dados);
        localStorage.setItem('empresaTipoNegocio', dados.tipo_negocio);
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

// ── Taxas por distância ───────────────────────────────────────────────────────

async function carregarTaxas(empresaId) {
    const container = document.getElementById('listaTaxas');
    if (!container) return;
    try {
        const res = await apiRequest(`/empresas/${empresaId}/taxas-entrega`);
        const taxas = res.taxas || [];
        if (taxas.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-400">Nenhuma faixa cadastrada.</p>';
            return;
        }
        container.innerHTML = taxas.map((t, i) => {
            const de = i === 0 ? 0 : parseFloat(taxas[i - 1].distancia_ate_km);
            const ate = parseFloat(t.distancia_ate_km);
            return `
            <div class="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                <span class="text-gray-700"><strong>${de.toFixed(1)} - ${ate.toFixed(1)} km</strong> → <strong>R$ ${parseFloat(t.taxa).toFixed(2)}</strong></span>
                <button onclick="removerTaxa(${t.id})" class="text-red-400 hover:text-red-600 font-bold text-lg leading-none ml-3" title="Remover">✕</button>
            </div>`;
        }).join('');
    } catch(e) {
        console.error('Erro ao carregar taxas:', e);
    }
}

async function adicionarTaxa() {
    if (!empresaIdAtual) return alert('Selecione um restaurante!');
    const distancia = parseFloat(document.getElementById('novaTaxaDistancia').value);
    const taxa = parseFloat(document.getElementById('novaTaxaValor').value);
    if (isNaN(distancia) || distancia <= 0) return alert('Digite uma distância válida.');
    if (isNaN(taxa) || taxa < 0) return alert('Digite uma taxa válida.');
    try {
        await apiRequest(`/empresas/${empresaIdAtual}/taxas-entrega`, {
            method: 'POST',
            body: JSON.stringify({ distancia_ate_km: distancia, taxa })
        });
        document.getElementById('novaTaxaDistancia').value = '';
        document.getElementById('novaTaxaValor').value = '';
        carregarTaxas(empresaIdAtual);
    } catch(e) {
        alert('Erro ao adicionar taxa: ' + e.message);
    }
}

async function removerTaxa(taxaId) {
    if (!confirm('Remover esta faixa de taxa?')) return;
    try {
        await apiRequest(`/empresas/${empresaIdAtual}/taxas-entrega/${taxaId}`, { method: 'DELETE' });
        carregarTaxas(empresaIdAtual);
    } catch(e) {
        alert('Erro ao remover taxa: ' + e.message);
    }
}

// ── WhatsApp Business Embedded Signup ────────────────────────────────────────

// Facebook SDK loader
window.fbAsyncInit = function() {
    FB.init({
        appId: '1719530826122495',
        autoLogAppEvents: true,
        xfbml: true,
        version: 'v25.0'
    });
};

(function(d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) return;
    js = d.createElement(s); js.id = id;
    js.src = 'https://connect.facebook.net/en_US/sdk.js';
    fjs.parentNode.insertBefore(js, fjs);
}(document, 'script', 'facebook-jssdk'));

// Callback do FB.login
function fbLoginCallback(response) {
    if (response.authResponse?.code) {
        apiRequest(`/empresas/conectar-whatsapp`, {
            method: 'POST',
            body: JSON.stringify({
                empresa_id: empresaIdAtual,
                code: response.authResponse.code,
                usar_token_sistema: true
            })
        })
        .then(() => checkStatusWhatsApp())
        .catch(err => alert('Erro ao conectar WhatsApp: ' + err.message));
    }
}

async function conectarComTokenSistema() {
    if (!empresaIdAtual) return alert('Selecione um restaurante!');
    if (!confirm('Conectar WhatsApp usando o token do sistema?')) return;
    try {
        const res = await apiRequest('/empresas/conectar-whatsapp', {
            method: 'POST',
            body: JSON.stringify({ empresa_id: empresaIdAtual, usar_token_sistema: true })
        });
        alert(`Conectado com sucesso!\nWABA ID: ${res.waba_id}\nPhone Number ID: ${res.phone_number_id}`);
        checkStatusWhatsApp();
    } catch (err) {
        alert('Erro ao conectar: ' + err.message);
    }
}

// Abre o fluxo de Embedded Signup
function launchWhatsAppSignup() {
    FB.login(fbLoginCallback, {
        config_id: '1457165725893575',
        response_type: 'code',
        override_default_response_type: true,
        extras: {
            version: 'v3',
            featureType: 'whatsapp_business_app_onboarding'
        }
    });
}

// Verifica status de conexão e atualiza o div
async function checkStatusWhatsApp() {
    if (!empresaIdAtual) return;
    const el = document.getElementById('statusWhatsApp');
    if (!el) return;
    try {
        const res = await API.getEmpresa(empresaIdAtual);
        const empresa = res.empresa;
        if (empresa.phone_number_id) {
            el.innerHTML = `<span class="inline-flex items-center gap-2 text-green-700 font-medium"><span class="w-2 h-2 rounded-full bg-green-500 inline-block"></span>Conectado — número ID: ${empresa.phone_number_id}</span>`;
        } else {
            el.innerHTML = `<span class="inline-flex items-center gap-2 text-gray-500"><span class="w-2 h-2 rounded-full bg-gray-400 inline-block"></span>Nenhum número conectado</span>`;
        }
    } catch (e) {
        el.textContent = 'Erro ao verificar status.';
    }
}

checkStatusWhatsApp();

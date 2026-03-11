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

// Captura eventos do Embedded Signup
let waPhoneNumberId = null;
let waWabaId = null;

window.addEventListener('message', (event) => {
    if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://web.facebook.com') return;

    try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.type !== 'WA_EMBEDDED_SIGNUP') return;

        if (data.event === 'FINISH') {
            waPhoneNumberId = data.data?.phone_number_id || null;
            waWabaId = data.data?.waba_id || null;
        }
    } catch (e) {
        // evento não era JSON válido
    }
});

// Callback do FB.login
function fbLoginCallback(response) {
    if (response.authResponse?.code) {
        apiRequest(`/empresas/conectar-whatsapp`, {
            method: 'POST',
            body: JSON.stringify({
                empresa_id: empresaIdAtual,
                code: response.authResponse.code,
                phone_number_id: waPhoneNumberId,
                waba_id: waWabaId
            })
        })
        .then(() => checkStatusWhatsApp())
        .catch(err => alert('Erro ao conectar WhatsApp: ' + err.message));
    }
}

// Abre o fluxo de Embedded Signup
function launchWhatsAppSignup() {
    FB.login(fbLoginCallback, {
        config_id: '1457165725893575',
        response_type: 'code',
        override_default_response_type: true,
        extras: {
            version: 'v3'
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

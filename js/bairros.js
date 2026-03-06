let bairroEditandoId = null;

async function carregarBairros() {
  const empresaId = empresaIdAtual;
  if (!empresaId) return;
  try {
    const res = await API.getBairros(empresaId);
    const bairros = res.bairros || [];
    const lista = document.getElementById('listaBairros');
    if (!lista) return;
    if (bairros.length === 0) {
      lista.innerHTML = '<p class="text-gray-400 text-sm">Nenhum bairro cadastrado. Clique em + Adicionar Bairro.</p>';
      return;
    }
    lista.innerHTML = bairros.map(b => `
      <div class="flex items-center justify-between p-3 border border-gray-200 rounded-lg ${b.ativo ? '' : 'opacity-50'}">
        <div>
          <span class="font-medium text-gray-800">${b.bairro}</span>
          <span class="ml-3 text-sm text-indigo-600 font-semibold">R$ ${parseFloat(b.taxa_entrega).toFixed(2)}</span>
          ${!b.ativo ? '<span class="ml-2 text-xs text-gray-400">(inativo)</span>' : ''}
        </div>
        <div class="flex gap-2">
          <button onclick="editarBairro(${b.id}, '${b.bairro}', ${b.taxa_entrega}, ${b.ativo})" class="text-indigo-600 hover:text-indigo-800 text-sm font-medium">Editar</button>
          <button onclick="deletarBairro(${b.id})" class="text-red-500 hover:text-red-700 text-sm font-medium">Remover</button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error('Erro ao carregar bairros:', e);
  }
}

function abrirModalBairro() {
  bairroEditandoId = null;
  document.getElementById('modalBairroTitulo').textContent = 'Adicionar Bairro';
  document.getElementById('inputBairro').value = '';
  document.getElementById('inputTaxaBairro').value = '';
  document.getElementById('modalBairro').classList.remove('hidden');
}

function editarBairro(id, bairro, taxa, ativo) {
  bairroEditandoId = id;
  document.getElementById('modalBairroTitulo').textContent = 'Editar Bairro';
  document.getElementById('inputBairro').value = bairro;
  document.getElementById('inputTaxaBairro').value = taxa;
  document.getElementById('modalBairro').classList.remove('hidden');
}

function fecharModalBairro() {
  document.getElementById('modalBairro').classList.add('hidden');
}

async function salvarBairro() {
  const bairro = document.getElementById('inputBairro').value.trim();
  const taxa_entrega = parseFloat(document.getElementById('inputTaxaBairro').value);
  if (!bairro) return alert('Digite o nome do bairro!');
  if (isNaN(taxa_entrega)) return alert('Digite a taxa de entrega!');
  try {
    const dados = { bairro, taxa_entrega, ativo: true, empresa_id: empresaIdAtual };
    if (bairroEditandoId) {
      await API.atualizarBairro(bairroEditandoId, dados);
    } else {
      await API.criarBairro(dados);
    }
    fecharModalBairro();
    carregarBairros();
  } catch (e) {
    alert('Erro ao salvar bairro: ' + e.message);
  }
}

async function deletarBairro(id) {
  if (!confirm('Remover este bairro?')) return;
  try {
    await API.deletarBairro(id, empresaIdAtual);
    carregarBairros();
  } catch (e) {
    alert('Erro ao remover bairro: ' + e.message);
  }
}

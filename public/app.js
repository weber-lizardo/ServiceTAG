const LOCAIS = [
  'USEB', 'NET', 'FADMINAS', 'ADRA-ES', 'ADRA-MG', 'ADRA-RJ', 'IPAE', 'EDESSA', 'AES',
  'ASES', 'ARC', 'ARF', 'ARS', 'MMN', 'MMO', 'AMC', 'AMS', 'AML',
].sort((a, b) => a.localeCompare(b, 'pt-BR'));

const TABELA = 'servicetag_service_tags';
const SITUACAO = { pendente: 'Aguardando consulta', concluida: 'Consultada', erro: 'Erro' };

const $ = (id) => document.getElementById(id);
const { supabaseUrl, supabaseAnonKey } = window.SERVICETAG_CONFIG || {};
const db = supabaseUrl && supabaseAnonKey ? supabase.createClient(supabaseUrl, supabaseAnonKey) : null;

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function dataBR(iso) {
  return iso ? new Date(iso).toLocaleString('pt-BR') : '';
}

function lerTags(texto) {
  const tags = texto.toUpperCase().split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean);
  return [...new Set(tags)];
}

async function carregarRegistros() {
  if (!db) {
    $('registros').innerHTML = '<tr><td colspan="7" class="erro">Supabase não configurado (config.js).</td></tr>';
    return;
  }
  let query = db.from(TABELA).select('*').order('criado_em', { ascending: false });
  if ($('filtroLocal').value) query = query.eq('local', $('filtroLocal').value);
  const { data, error } = await query;
  if (error) {
    $('registros').innerHTML = `<tr><td colspan="7" class="erro">${esc(error.message)}</td></tr>`;
    return;
  }
  $('registros').innerHTML = data.length
    ? data.map((r) => `
        <tr>
          <td>${esc(r.local)}</td>
          <td class="tag">${esc(r.service_tag)}</td>
          <td>${esc(r.dispositivo)}</td>
          <td>${esc(r.garantia)}</td>
          <td class="status ${esc(r.garantia_status)}">${esc(r.garantia_status)}</td>
          <td class="situacao-${esc(r.situacao)}" title="${esc(r.erro)}">${esc(SITUACAO[r.situacao] || r.situacao)}${r.erro ? `: ${esc(r.erro)}` : ''}</td>
          <td>${esc(dataBR(r.consultado_em))}</td>
        </tr>`).join('')
    : '<tr><td colspan="7" class="pendente">Nenhum registro.</td></tr>';
}

$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const local = $('local').value;
  const tags = lerTags($('tags').value);
  if (!local || !tags.length || !db) return;

  const invalidas = tags.filter((t) => !/^[A-Z0-9]{5,7}$/.test(t));
  if (invalidas.length) {
    $('progresso').textContent = `Service Tag inválida (5 a 7 letras/números): ${invalidas.join(', ')}`;
    return;
  }

  $('enviar').disabled = true;
  $('progresso').textContent = 'Enviando…';
  const linhas = tags.map((t) => ({ local, service_tag: t, situacao: 'pendente', erro: null }));
  const { error } = await db.from(TABELA).upsert(linhas, { onConflict: 'service_tag' });
  $('enviar').disabled = false;

  if (error) {
    $('progresso').textContent = `Falha ao gravar: ${error.message}`;
    return;
  }
  $('progresso').textContent = `${tags.length} tag(s) enviada(s). A consulta na Dell roda em alguns minutos.`;
  $('tags').value = '';
  carregarRegistros();
});

for (const sel of [$('local'), $('filtroLocal')]) {
  for (const l of LOCAIS) sel.add(new Option(l, l));
}
$('filtroLocal').addEventListener('change', carregarRegistros);

carregarRegistros();
setInterval(carregarRegistros, 30000);

const $ = (id) => document.getElementById(id);

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function dataBR(iso) {
  return iso ? new Date(iso).toLocaleString('pt-BR') : '';
}

async function carregarLocais() {
  const locais = await fetch('/api/locais').then((r) => r.json());
  for (const sel of [$('local'), $('filtroLocal')]) {
    for (const l of locais) sel.add(new Option(l, l));
  }
}

async function carregarRegistros() {
  const local = $('filtroLocal').value;
  const url = '/api/registros' + (local ? `?local=${encodeURIComponent(local)}` : '');
  const resp = await fetch(url);
  const dados = await resp.json();
  if (!resp.ok) {
    $('registros').innerHTML = `<tr><td colspan="6" class="erro">${esc(dados.erro)}</td></tr>`;
    return;
  }
  $('registros').innerHTML = dados.length
    ? dados.map((r) => `
        <tr>
          <td>${esc(r.local)}</td>
          <td class="tag">${esc(r.service_tag)}</td>
          <td>${esc(r.dispositivo)}</td>
          <td>${esc(r.garantia)}</td>
          <td class="status ${esc(r.garantia_status)}">${esc(r.garantia_status)}</td>
          <td>${esc(dataBR(r.consultado_em))}</td>
        </tr>`).join('')
    : '<tr><td colspan="6" class="pendente">Nenhum registro.</td></tr>';
}

function lerTags(texto) {
  const tags = texto.toUpperCase().split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean);
  return [...new Set(tags)];
}

$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const local = $('local').value;
  const tags = lerTags($('tags').value);
  if (!local || !tags.length) return;

  $('enviar').disabled = true;
  $('secResultado').hidden = false;
  $('resultado').innerHTML = tags.map((t, i) => `
    <tr id="linha-${i}">
      <td>${esc(local)}</td><td class="tag">${esc(t)}</td>
      <td colspan="3" class="pendente">Aguardando…</td>
    </tr>`).join('');

  let ok = 0;
  for (const [i, tag] of tags.entries()) {
    $('progresso').textContent = `Consultando ${i + 1} de ${tags.length}: ${tag}…`;
    const linha = $(`linha-${i}`);
    linha.cells[2].textContent = 'Consultando na Dell…';
    try {
      const resp = await fetch('/api/consultar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ local, serviceTag: tag }),
      });
      const r = await resp.json();
      if (!resp.ok) throw new Error(r.erro || resp.statusText);
      linha.innerHTML = `
        <td>${esc(r.local)}</td><td class="tag">${esc(r.service_tag)}</td>
        <td>${esc(r.dispositivo)}</td><td>${esc(r.garantia)}</td>
        <td class="status ${esc(r.garantia_status)}">${esc(r.garantia_status)}</td>`;
      ok++;
    } catch (err) {
      linha.innerHTML = `
        <td>${esc(local)}</td><td class="tag">${esc(tag)}</td>
        <td colspan="3" class="erro">${esc(err.message)}</td>`;
    }
  }

  $('progresso').textContent = `Concluído: ${ok} de ${tags.length} gravada(s).`;
  $('enviar').disabled = false;
  carregarRegistros();
});

$('filtroLocal').addEventListener('change', carregarRegistros);

carregarLocais();
carregarRegistros();

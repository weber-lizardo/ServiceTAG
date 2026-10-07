// Consulta na Dell as Service Tags com situação "pendente" e grava o resultado.
// Executado pelo GitHub Action .github/workflows/consultar-dell.yml
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { consultarServiceTag, fecharBrowser } = require('./dell');

const TABELA = 'servicetag_service_tags';
const LIMITE = Number(process.env.LIMITE || 100);

async function main() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: pendentes, error } = await supabase
    .from(TABELA)
    .select('id, service_tag')
    .eq('situacao', 'pendente')
    .order('criado_em')
    .limit(LIMITE);
  if (error) throw error;
  console.log(`${pendentes.length} tag(s) pendente(s)`);

  let falhas = 0;
  for (const { id, service_tag: tag } of pendentes) {
    let campos;
    try {
      const r = await consultarServiceTag(tag);
      campos = {
        dispositivo: r.dispositivo,
        garantia: r.texto,
        garantia_status: r.status,
        garantia_expira_em: r.expiraEm,
        situacao: 'concluida',
        erro: null,
      };
      console.log(`[${tag}] ${r.dispositivo} | ${r.texto} | ${r.status}`);
    } catch (err) {
      if (err.bloqueio) {
        // Mantém as tags pendentes para a próxima execução, de uma rede não bloqueada.
        await fecharBrowser();
        throw err;
      }
      falhas++;
      campos = { situacao: 'erro', erro: err.message.slice(0, 500) };
      console.error(`[${tag}] erro: ${err.message}`);
    }
    campos.consultado_em = new Date().toISOString();
    const { error: errUpd } = await supabase.from(TABELA).update(campos).eq('id', id);
    if (errUpd) console.error(`[${tag}] falha ao gravar: ${errUpd.message}`);
  }

  await fecharBrowser();
  if (pendentes.length && falhas === pendentes.length) {
    throw new Error('Todas as consultas falharam; verifique se a Dell está bloqueando o acesso');
  }
}

main().catch(async (err) => {
  console.error(err.message || err);
  await fecharBrowser();
  process.exit(1);
});

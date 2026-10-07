require('dotenv').config();
const path = require('path');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { consultarServiceTag, fecharBrowser } = require('./dell');

const LOCAIS = [
  'USEB', 'NET', 'FADMINAS', 'ADRA-ES', 'ADRA-MG', 'ADRA-RJ', 'IPAE', 'EDESSA', 'AES',
  'ASES', 'ARC', 'ARF', 'ARS', 'MMN', 'MMO', 'AMC', 'AMS', 'AML',
].sort((a, b) => a.localeCompare(b, 'pt-BR'));

const TABELA = 'servicetag_service_tags';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no arquivo .env');
  process.exit(1);
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/locais', (req, res) => res.json(LOCAIS));

// Consulta uma Service Tag na Dell e grava (ou atualiza) o registro no Supabase.
app.post('/api/consultar', async (req, res) => {
  const local = String(req.body.local || '').trim();
  const serviceTag = String(req.body.serviceTag || '').trim().toUpperCase();

  if (!LOCAIS.includes(local)) return res.status(400).json({ erro: 'Local inválido' });
  if (!/^[A-Z0-9]{5,7}$/.test(serviceTag)) {
    return res.status(400).json({ erro: 'Service Tag inválida (5 a 7 letras/números)' });
  }

  let dados;
  try {
    dados = await consultarServiceTag(serviceTag);
  } catch (err) {
    console.error(`[${serviceTag}]`, err.message);
    return res.status(502).json({ erro: `Falha ao consultar a Dell: ${err.message}` });
  }

  const registro = {
    local,
    service_tag: serviceTag,
    dispositivo: dados.dispositivo,
    garantia: dados.texto,
    garantia_status: dados.status,
    garantia_expira_em: dados.expiraEm,
    consultado_em: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(TABELA)
    .upsert(registro, { onConflict: 'service_tag' })
    .select()
    .single();

  if (error) {
    console.error(`[${serviceTag}] Supabase:`, error.message);
    return res.status(500).json({ erro: `Falha ao gravar no Supabase: ${error.message}`, registro });
  }
  res.json(data);
});

app.get('/api/registros', async (req, res) => {
  let query = supabase.from(TABELA).select('*').order('consultado_em', { ascending: false });
  if (req.query.local) query = query.eq('local', req.query.local);
  const { data, error } = await query;
  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

const port = process.env.PORT || 3000;
const server = app.listen(port, () => console.log(`ServiceTAG em http://localhost:${port}`));

for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.on(sinal, async () => {
    server.close();
    await fecharBrowser();
    process.exit(0);
  });
}

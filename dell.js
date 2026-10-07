const { chromium } = require('playwright');

const HOME = 'https://www.dell.com/support/home/pt-br';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

const MESES = {
  jan: 1, fev: 2, feb: 2, mar: 3, abr: 4, apr: 4, mai: 5, may: 5, jun: 6,
  jul: 7, ago: 8, aug: 8, set: 9, sep: 9, out: 10, oct: 10, nov: 11, dez: 12, dec: 12,
};

// Página de bloqueio da proteção anti-robô (Akamai) da Dell.
class BloqueioDell extends Error {
  constructor() {
    super('Acesso bloqueado pela Dell (Access Denied). Rode a consulta a partir de outra rede.');
    this.bloqueio = true;
  }
}

let browserPromise = null;

function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium
      .launch({
        headless: process.env.HEADLESS !== 'false',
        // Ex.: BROWSER_CHANNEL=msedge ou chrome para usar o navegador instalado na máquina
        channel: process.env.BROWSER_CHANNEL || undefined,
        executablePath: process.env.CHROMIUM_PATH || undefined,
        args: ['--disable-blink-features=AutomationControlled'],
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

async function fecharBrowser() {
  if (browserPromise) {
    const browser = await browserPromise.catch(() => null);
    browserPromise = null;
    if (browser) await browser.close();
  }
}

// Consultas são feitas uma de cada vez para não sobrecarregar o site da Dell.
let fila = Promise.resolve();
function consultarServiceTag(tag) {
  const tarefa = fila.then(() => consultar(tag));
  fila = tarefa.catch(() => {});
  return tarefa;
}

async function consultar(tag) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    locale: 'pt-BR',
    userAgent: USER_AGENT,
    viewport: { width: 1366, height: 900 },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  const page = await context.newPage();

  // Guarda respostas JSON de garantia que o próprio site carrega.
  const jsonGarantia = [];
  page.on('response', async (resp) => {
    const tipo = resp.headers()['content-type'] || '';
    if (/warrant|garantia|entitlement/i.test(resp.url()) && tipo.includes('json')) {
      try {
        jsonGarantia.push(await resp.json());
      } catch {}
    }
  });

  try {
    await page.goto(HOME, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await verificarBloqueio(page);
    await aceitarCookies(page);

    // Campo "Identifique um produto ou pergunte ao suporte"
    const campo = await localizarCampoBusca(page);
    if (campo) {
      await campo.fill(tag);
      await campo.press('Enter');
      await page.waitForURL(/servicetag/i, { timeout: 45000 }).catch(() => {});
    }

    // Se a busca não levou à página do produto, abre a página da tag diretamente.
    if (!/servicetag/i.test(page.url())) {
      await page.goto(`${HOME}/product-support/servicetag/${tag}/overview`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
    }

    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await verificarBloqueio(page);
    await aceitarCookies(page);

    const dispositivo = await extrairDispositivo(page);
    const garantia = await extrairGarantia(page, jsonGarantia);

    if (!dispositivo && !garantia.texto) {
      throw new Error('Service Tag não encontrada ou página da Dell não carregou');
    }

    return { dispositivo, ...garantia };
  } finally {
    await context.close();
  }
}

async function verificarBloqueio(page) {
  const titulo = await page.title().catch(() => '');
  const h1 = await page.locator('h1').first().innerText({ timeout: 2000 }).catch(() => '');
  if (/access denied/i.test(titulo) || /access denied/i.test(h1)) throw new BloqueioDell();
}

async function aceitarCookies(page) {
  const botao = page
    .locator('#onetrust-accept-btn-handler, button:has-text("Aceitar todos"), button:has-text("Aceitar")')
    .first();
  if (await botao.isVisible({ timeout: 2000 }).catch(() => false)) {
    await botao.click().catch(() => {});
  }
}

async function localizarCampoBusca(page) {
  const candidatos = [
    page.getByPlaceholder(/Identifique um produto|pergunte ao suporte/i),
    page.locator('#mh-search-input'),
    page.locator('input#inpEntrySelection'),
    page.locator('input[type="search"]'),
  ];
  for (const c of candidatos) {
    const el = c.first();
    if (await el.isVisible({ timeout: 5000 }).catch(() => false)) return el;
  }
  return null;
}

async function extrairDispositivo(page) {
  const seletores = [
    '#psProductName',
    '.product-name',
    '[data-testid="product-name"]',
    'h1',
  ];
  for (const sel of seletores) {
    const texto = await page
      .locator(sel)
      .first()
      .innerText({ timeout: 3000 })
      .catch(() => '');
    const limpo = texto.replace(/\s+/g, ' ').trim();
    if (limpo && !/^suporte$|identifique|bem-vindo|access denied/i.test(limpo)) return limpo;
  }
  // Ex.: "Suporte para Latitude 5420 | Visão geral | Dell Brasil"
  const titulo = await page.title();
  const m = titulo.match(/Suporte para (.+?)\s*\|/i);
  return m ? m[1].trim() : null;
}

async function extrairGarantia(page, jsonGarantia) {
  const corpo = await page.locator('body').innerText().catch(() => '');

  // Ex.: "Expira em 12 FEV. 2027", "Expirou em 01/03/2023", "Expirada em 5 de mai. de 2024"
  const re =
    /(Expira(?:da|do)?|Expirou|Vence|Válid[ao] até|Garantia ativa até)\s*(?:em)?\s*:?\s*(\d{1,2}\s*(?:de\s*)?[A-Za-zÀ-ú]{3,}\.?\s*(?:de\s*)?\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i;
  let m = corpo.match(re);

  let texto = null;
  let expiraEm = null;
  if (m) {
    texto = m[0].replace(/\s+/g, ' ').trim();
    expiraEm = parseData(m[2]);
  } else {
    expiraEm = dataDoJson(jsonGarantia);
    if (expiraEm) texto = `Expira em ${expiraEm.split('-').reverse().join('/')}`;
  }

  if (!texto) {
    const linha = corpo.split('\n').find((l) => /garantia/i.test(l) && /\d{4}/.test(l));
    if (linha) {
      texto = linha.trim();
      const d = linha.match(/\d{1,2}\s*(?:de\s*)?[A-Za-zÀ-ú]{3,}\.?\s*(?:de\s*)?\d{4}|\d{1,2}\/\d{1,2}\/\d{4}/);
      if (d) expiraEm = parseData(d[0]);
    }
  }

  let status = null;
  if (texto && /expirad|expirou/i.test(texto)) status = 'Expirada';
  else if (expiraEm) status = new Date(expiraEm) < hoje() ? 'Expirada' : 'Ativa';

  return { texto, status, expiraEm };
}

function hoje() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Retorna "AAAA-MM-DD" ou null
function parseData(str) {
  if (!str) return null;
  let m = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return iso(+m[3], +m[2], +m[1]);
  m = str.match(/(\d{1,2})\s*(?:de\s*)?([A-Za-zÀ-ú]{3,})\.?\s*(?:de\s*)?(\d{4})/);
  if (m) {
    const mes = MESES[m[2].slice(0, 3).toLowerCase()];
    if (mes) return iso(+m[3], mes, +m[1]);
  }
  return null;
}

function iso(ano, mes, dia) {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

// Procura a maior data de término em respostas JSON capturadas.
function dataDoJson(lista) {
  let maior = null;
  const visitar = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && /end.?date|expir/i.test(k)) {
        const d = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
        const data = d ? `${d[1]}-${d[2]}-${d[3]}` : parseData(v);
        if (data && (!maior || data > maior)) maior = data;
      } else {
        visitar(v);
      }
    }
  };
  lista.forEach(visitar);
  return maior;
}

module.exports = { consultarServiceTag, fecharBrowser, parseData };

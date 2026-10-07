# ServiceTAG

Página para consultar uma lista de Service Tags Dell e gravar no Supabase o **Local**, a **Service Tag**,
a **identificação do dispositivo** e a **garantia** de cada uma.

A consulta usa o site público de suporte da Dell (https://www.dell.com/support/home/pt-br), sem login:
um navegador Chromium controlado pelo servidor (Playwright) digita a tag no campo
"Identifique um produto ou pergunte ao suporte", abre a página do produto e lê o nome do equipamento e a
data de garantia. O navegador do usuário não consegue consultar a Dell diretamente (bloqueio de CORS), por isso
a consulta é feita pelo servidor.

## Configuração

1. No Supabase, abra o **SQL Editor** e execute `supabase/schema.sql`.
2. Copie `.env.example` para `.env` e preencha `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`
   (Settings > API). A chave fica só no servidor.
3. Instale e rode (Node 18+):

   ```bash
   npm install        # também baixa o Chromium do Playwright
   npm start
   ```

4. Acesse http://localhost:3000, escolha o local, cole as Service Tags (uma por linha ou separadas por
   vírgula/espaço) e clique em **Consultar e gravar**.

## Tabela `service_tags`

| coluna               | conteúdo                                         |
|----------------------|--------------------------------------------------|
| `local`              | local escolhido na lista                         |
| `service_tag`        | Service Tag (única; consultar de novo atualiza)  |
| `dispositivo`        | nome do equipamento exibido pela Dell            |
| `garantia`           | texto da garantia, ex.: `Expira em 12 FEV. 2027` |
| `garantia_status`    | `Ativa` ou `Expirada`                            |
| `garantia_expira_em` | data de término da garantia                      |
| `consultado_em`      | data/hora da consulta                            |

## Observações

- As tags são consultadas uma por vez; cada uma leva alguns segundos.
- Se o site da Dell bloquear o navegador em modo invisível, rode com `HEADLESS=false` no `.env`.
- Se a Dell mudar o layout da página, os seletores ficam em `dell.js`.

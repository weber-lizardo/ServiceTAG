# ServiceTAG

Página para informar uma lista de Service Tags Dell e gravar no Supabase o **Local**, a **Service Tag**,
a **identificação do dispositivo** e a **garantia** de cada uma.

## Como funciona

1. **Página (GitHub Pages)** — `public/`. O usuário escolhe o local, cola as Service Tags e clica em
   **Enviar para consulta**. As tags são gravadas direto no Supabase com situação `pendente`.
   A página não tem login: qualquer pessoa com o link vê os registros e pode enviar tags.
2. **Consulta na Dell (GitHub Actions)** — `.github/workflows/consultar-dell.yml` roda a cada ~10 minutos
   (ou manualmente em *Actions > Consultar Service Tags na Dell > Run workflow*). Se houver tags pendentes,
   abre um Chromium (Playwright), digita cada tag no campo "Identifique um produto ou pergunte ao suporte"
   em https://www.dell.com/support/home/pt-br, lê o dispositivo e a garantia e grava o resultado
   (`worker.js` + `dell.js`). Não é necessário login na Dell.

A página se atualiza a cada 30 segundos e mostra a situação de cada tag (Aguardando consulta, Consultada ou Erro).

## Configuração

### 1. Supabase
Abra o **SQL Editor** e execute `supabase/schema.sql`. Ele cria a tabela e as permissões:
a página (anon key) só consegue ler e enviar tags como `pendente`; dispositivo e garantia só são gravados
pelo GitHub Action (service_role key). Ninguém consegue apagar registros pela página.

### 2. GitHub — variáveis e secret
Em **Settings > Secrets and variables > Actions**:

| tipo     | nome                        | valor (Supabase > Settings > API Keys)  |
|----------|-----------------------------|-----------------------------------------|
| Secret   | `SUPABASE_SERVICE_ROLE_KEY` | secret key (`sb_secret_...`) ou service_role |

A URL do projeto e a publishable key já estão em `public/config.js` (a publishable key é pública e fica
visível na página; é normal). Opcionalmente, as variáveis `SUPABASE_URL` e `SUPABASE_ANON_KEY`
substituem esses valores. A secret key nunca sai do GitHub Actions.

### 3. GitHub Pages
1. Em **Settings > Pages**, em *Source*, escolha **GitHub Actions** (recomendado).
   Se ficar em *Deploy from a branch* (raiz), o `index.html` da raiz redireciona para `public/`.
2. O workflow `.github/workflows/pages.yml` publica a pasta `public/` a cada push na `main` que altere a página
   (ou manualmente em *Actions > Publicar no GitHub Pages > Run workflow*).
3. O endereço fica em `https://<usuario>.github.io/ServiceTAG/`.

## Tabela `servicetag_service_tags`

Padrão do projeto: toda tabela criada no Supabase começa com `servicetag_`.

| coluna               | conteúdo                                         |
|----------------------|--------------------------------------------------|
| `local`              | local escolhido na lista                         |
| `service_tag`        | Service Tag (única; reenviar atualiza)           |
| `dispositivo`        | nome do equipamento exibido pela Dell            |
| `garantia`           | texto da garantia, ex.: `Expira em 12 FEV. 2027` |
| `garantia_status`    | `Ativa` ou `Expirada`                            |
| `garantia_expira_em` | data de término da garantia                      |
| `situacao`           | `pendente`, `concluida` ou `erro`                |
| `erro`               | mensagem quando a consulta falha                 |
| `criado_em`          | quando a tag foi enviada                         |
| `consultado_em`      | quando a Dell foi consultada                     |

## Observações

- O agendamento do GitHub pode atrasar alguns minutos em horários de pico.
- Em repositórios públicos, o GitHub desativa workflows agendados após 60 dias sem commits;
  reative em *Actions* se isso acontecer.
- Se a Dell mudar o layout da página, os seletores ficam em `dell.js`.
- Para rodar a consulta localmente: copie `.env.example` para `.env`, `npm install`,
  `npx playwright install chromium` e `npm run consultar`.

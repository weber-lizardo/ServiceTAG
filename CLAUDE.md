# Convenções do projeto

- Toda tabela do Supabase deve ter o prefixo `servicetag_` (ex.: `servicetag_service_tags`).
  Índices seguem o mesmo prefixo.
- O schema fica em `supabase/schema.sql`.
- A página (`public/`) é estática e publicada no GitHub Pages; acessa o Supabase com a anon key (RLS em `schema.sql`).
- A consulta à Dell roda no GitHub Actions (`worker.js` + `dell.js`) com a service_role key.

## Why

O CRM roda apenas em `localhost`, na máquina de um único usuário. Para ser a ferramenta de vendas da guardon.me no dia a dia, ele precisa estar acessível na internet para 3–4 pessoas, com login restrito, dados persistentes e sincronização de e-mail funcionando — e, por decisão de custo, dentro do plano gratuito (Hobby) da Vercel enquanto o uso é avaliado.

## What Changes

- Criar um repositório próprio no GitHub (fork de `trycompai/crm`) como origem dos deploys, mantendo `trycompai/crm` como `upstream` para receber atualizações.
- Provisionar Postgres gerenciado (Neon Free, via Vercel Marketplace) e aplicar as migrations em produção.
- Publicar `apps/app` e `apps/api` como dois projetos Vercel sob `crm.guardon.me` e `api.guardon.me`, compartilhando sessão via `AUTH_COOKIE_DOMAIN=.guardon.me`.
- Adaptar as crons de `apps/api/vercel.json` ao limite do plano Hobby (execução no máximo diária) e mover a sincronização de caixas de e-mail para um agendador externo gratuito (GitHub Actions) que chama `/internal/sync/mailboxes` com `CRON_SECRET`.
- Configurar o OAuth do Google para produção (origem e URI de redirecionamento de `api.guardon.me`), mantendo o app em modo **Teste** com os e-mails da equipe como usuários de teste.
- Restringir o acesso via `ALLOWED_SIGN_IN` à lista explícita de e-mails da equipe.
- Publicar `apps/agent` somente após uma investigação (spike) confirmar que o agendamento por minuto do eve e o sandbox cabem no plano Hobby; até lá o CRM opera sem o agente, que é opcional por desenho.

## Capabilities

### New Capabilities
- `operacao-producao`: requisitos operacionais do ambiente de produção — acesso restrito, sessão entre subdomínios, agendamento de tarefas periódicas dentro do plano gratuito e comportamento do CRM com o agente ausente.

### Modified Capabilities
<!-- Nenhuma: não existem specs anteriores neste repositório. -->

## Impact

- **Código**: `apps/api/vercel.json` (frequência das crons); novo workflow em `.github/workflows/` para a sincronização de e-mail. Nenhuma mudança em lógica de aplicação.
- **Infraestrutura**: 2 projetos Vercel (3 se o agente for aprovado no spike), banco Neon, DNS de `guardon.me`, projeto `MyCRM` no Google Cloud.
- **Segredos**: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `CRON_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `ALLOWED_SIGN_IN`, `AGENT_BRIDGE_SECRET` configurados na Vercel e, para `CRON_SECRET`, também no GitHub.
- **Limitações aceitas**: login do Google expira a cada 7 dias em modo Teste; sincronização de e-mail sujeita ao atraso do agendador do GitHub Actions; termos do plano Hobby preveem uso não comercial — reavaliar o plano Pro quando o uso se consolidar.
- **Atualizações futuras**: merges de `upstream` podem conflitar com `apps/api/vercel.json`.

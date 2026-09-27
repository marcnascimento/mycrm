## 1. Repositório próprio

- [x] 1.1 Criar o fork de `trycompai/crm` na conta GitHub do usuário e verificar que ele aparece em `github.com/<usuario>/crm`
- [x] 1.2 Renomear o remote local `origin` para `upstream`, adicionar o fork como `origin` e verificar com `git remote -v`
- [x] 1.3 Commitar `openspec/` e as adaptações na branch `release` e verificar o push com `git log origin/release -1`
- [x] 1.5 No fork, habilitar Actions e desativar os workflows `auto-pr`, `release`, `pr-base` e `pr-title`; verificar que apenas `CI` e `Sync mailboxes` aparecem ativos
- [x] 1.4 Confirmar que `.env` não está versionado (`git check-ignore .env` retorna `.env`)

## 2. Adaptação ao plano Hobby

- [x] 2.1 Alterar `apps/api/vercel.json` para que todas as crons rodem no máximo uma vez por dia (mailboxes incluída como fallback diário) e verificar que nenhuma expressão tem frequência maior que diária
- [ ] 2.2 Criar `.github/workflows/sync-mailboxes.yml` agendado a cada 10 min que chama `GET $API_URL/internal/sync/mailboxes` com `Authorization: Bearer ${{ secrets.CRON_SECRET }}` e falha se a resposta não for 2xx; verificar a sintaxe com `workflow_dispatch` manual após o deploy
- [ ] 2.3 Commitar e dar push das adaptações e verificar que o fork contém os dois arquivos

## 3. Banco de dados

- [x] 3.1 Criar o banco Neon Free pela Vercel Marketplace (região `aws-eu-central-1` (Frankfurt)) e verificar que `DATABASE_URL` e `POSTGRES_URL_NON_POOLING` foram gerados

## 4. Projeto Vercel da API

- [ ] 4.1 Importar o fork na Vercel como projeto `crm-api`: Root Directory na raiz do repositório, Framework Preset "Other", Build Command `node apps/api/scripts/build-func.mjs`, Install Command `bun install`, Production Branch `release`; conectar o banco Neon ao projeto
- [x] 4.1.1 Fixar a região das funções da API em `fra1` e as crons diárias em `apps/api/scripts/build-func.mjs` (lendo de `apps/api/vercel.json`); verificado com build local: `.vc-config.json` com `fra1` e `config.json` com 5 crons diárias
- [ ] 4.2 Gerar segredos novos de produção (`BETTER_AUTH_SECRET`, `CRON_SECRET` ≥16 chars, `AGENT_BRIDGE_SECRET`) e guardá-los num gerenciador de senhas; verificar que nenhum é igual ao do `.env` local
- [ ] 4.3 Configurar as variáveis da API (`BETTER_AUTH_SECRET`, `ALLOWED_SIGN_IN`, `GOOGLE_CLIENT_ID/SECRET`, `CRON_SECRET`, `API_URL=https://api.guardon.me`, `APP_URL=https://crm.guardon.me`, `AUTH_COOKIE_DOMAIN=.guardon.me`) e verificar a lista na aba Environment Variables
- [ ] 4.4 Fazer o deploy e verificar no log de build que `prisma migrate deploy` aplicou todas as migrations e que a rota de health responde 200

## 5. Projeto Vercel do app

- [ ] 5.1 Importar o fork como projeto `crm-app`, Root Directory `apps/app`, com o mesmo banco e as mesmas variáveis de auth/URLs da API; verificar que `BETTER_AUTH_SECRET` é idêntico nos dois projetos
- [ ] 5.1.1 Definir Function Region `fra1` (Frankfurt) em Settings → Functions do projeto `crm-app` e verificar no log do deploy
- [ ] 5.2 Fazer o deploy e verificar que a URL `*.vercel.app` do app carrega a página de login

## 6. Domínios

- [ ] 6.1 Adicionar `crm.guardon.me` ao projeto app e `api.guardon.me` ao projeto API; criar os registros CNAME no DNS de `guardon.me` e verificar que a Vercel mostra "Valid Configuration" e certificado emitido
- [ ] 6.2 Redeploy dos dois projetos e verificar que `http://crm.guardon.me` redireciona para HTTPS

## 7. Google OAuth de produção

- [ ] 7.1 No cliente OAuth do projeto `MyCRM`, adicionar a origem `https://crm.guardon.me` e o redirecionamento `https://api.guardon.me/api/auth/callback/google`; verificar que as entradas de localhost continuam presentes
- [ ] 7.2 Adicionar os e-mails de toda a equipe como usuários de teste em Público-alvo e verificar a lista
- [ ] 7.3 Confirmar que Gmail API e Calendar API estão ativadas no projeto

## 8. Agendador externo

- [ ] 8.1 Criar o secret `CRON_SECRET` (e a variável `API_URL`) no fork em Settings → Secrets and variables → Actions
- [ ] 8.2 Rodar o workflow manualmente (`workflow_dispatch`) e verificar resposta 2xx; em seguida chamar a rota sem o header e verificar que é recusada

## 9. Validação ponta a ponta

- [ ] 9.1 Login do usuário principal em `https://crm.guardon.me` e verificar que ele vira owner do workspace e conclui o onboarding
- [ ] 9.1.1 Definir EUR como moeda base do workspace em Configurações → Moedas e verificar que um negócio novo nasce em EUR
- [ ] 9.2 Login de cada membro da equipe e verificar acesso; tentar com uma conta fora da lista e verificar recusa
- [ ] 9.3 Conectar o Gmail, enviar um e-mail de teste de um contato e verificar que aparece na linha do tempo em até ~15 min
- [ ] 9.4 Abrir a aba Agente de um contato e verificar a mensagem de "não configurado" sem quebrar a página

## 10. Spike do agente (decisão, não deploy)

- [ ] 10.1 Investigar como o eve publica `defineSchedule({ cron: "* * * * *" })` na Vercel e se o plano Hobby aceita; registrar o achado em `design.md`
- [ ] 10.2 Verificar se o disparo externo de `/internal/crm/dispatch` com `AGENT_BRIDGE_SECRET` substitui o agendamento por minuto, e estimar o custo de sandbox + AI Gateway no Hobby; registrar em `design.md`
- [ ] 10.3 Decidir com o usuário: publicar o agente (nova change) ou manter o CRM sem agente por ora

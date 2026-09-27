## Context

O repositório é um monorepo Turborepo/Bun com três processos (`apps/app` Next.js, `apps/api` NestJS, `apps/agent` eve) e um Postgres. O projeto original assume Vercel: crons em `apps/api/vercel.json`, migrations aplicadas no build quando `VERCEL_ENV=production`, IA do agente via Vercel AI Gateway com OIDC. Não há Dockerfiles.

Restrições que moldam o desenho:
- **Plano Hobby**: crons executam no máximo uma vez por dia; o repositório define `*/5 * * * *` para caixas de e-mail e o agente (`apps/agent/agent/schedules/dispatch.ts`) roda `* * * * *`.
- **App e API precisam concordar** em `DATABASE_URL` e `BETTER_AUTH_SECRET`; a API emite o cookie de sessão e o app o verifica.
- **Google OAuth** em modo Teste para contas `@gmail.com` (sem Workspace); tokens de atualização expiram em 7 dias.

## Goals / Non-Goals

**Goals:**
- App e API em produção, com custo de hospedagem zero.
- Um caminho claro para receber atualizações do `upstream` sem perder as adaptações.

**Non-Goals:**
- Publicar o agente nesta etapa sem validação prévia (fica condicionado ao spike).
- Sair do modo Teste do Google (verificação/CASA) ou adotar Google Workspace.
- Ambiente de staging/preview com banco próprio.

## Decisions

### D1 — Fork no GitHub como origem, `trycompai/crm` como `upstream`
Deploys da Vercel saem da branch `release` do fork (Production Branch na Vercel = `release`). Atualizações entram por `git fetch upstream && git merge upstream/release`.
- *Alternativa*: branch `main` do fork. Descartada: o `release.yml` herdado roda a cada push em `main` e abre PRs de versão do release-please no fork; `release` dispara apenas o `ci.yml`.
- *Alternativa*: cópia sem vínculo (novo repositório). Descartada: perde o caminho de atualização.
- Workflows herdados que não se aplicam ao fork (`auto-pr`, `release`, `pr-base`, `pr-title`) são desativados pela interface do GitHub (Actions → workflow → Disable), sem editar os arquivos, para não criar conflitos com o `upstream`.

### D2 — Dois projetos Vercel, um por app, com Root Directory em `apps/app` e `apps/api`
É o modelo que o projeto original já espera (um `vercel.json` por app). Domínios: `crm.guardon.me` → app, `api.guardon.me` → API. `AUTH_COOKIE_DOMAIN=.guardon.me` para uma sessão cobrir ambos.
- *Alternativa*: API servida sob o mesmo domínio do app via rewrites. Descartada: diverge do upstream e complica `/api/auth/*`.

### D3 — Neon Free via Vercel Marketplace
Integração injeta `DATABASE_URL` (pooled) e `POSTGRES_URL_NON_POOLING`; o build usa a conexão direta para `prisma migrate deploy`. 0,5 GB atende 3–4 usuários.
- *Alternativa*: Supabase Free. Equivalente; Neon escolhido pela integração nativa e pelo suporte explícito a `POSTGRES_URL_NON_POOLING` no `.env.example`.

### D4 — Crons diárias na Vercel + GitHub Actions para caixas de e-mail
`apps/api/vercel.json` passa a ter todas as crons diárias (compatível com Hobby). Um workflow agendado no fork chama `GET https://api.guardon.me/internal/sync/mailboxes` com `Authorization: Bearer $CRON_SECRET` a cada 10 minutos. As rotas já aceitam GET e POST e já validam `CRON_SECRET` em tempo constante.
- *Alternativa*: cron-job.org. Viável, mas coloca o segredo em mais um serviço externo; GitHub Actions mantém tudo no fork.
- *Trade-off*: o agendamento do GitHub Actions atrasa em horários de pico e é pausado após 60 dias sem atividade no repositório.

### D5 — Agente condicionado a spike
Antes de publicar `apps/agent`, verificar: (a) como o eve mapeia `defineSchedule({ cron: "* * * * *" })` na Vercel e se o Hobby rejeita o deploy; (b) se o disparo externo (`/internal/crm/dispatch`, já usado pelo "poke" da API com `AGENT_BRIDGE_SECRET`) substitui o agendamento por minuto; (c) custo/limite do sandbox e do AI Gateway no Hobby. O CRM já degrada sem o agente (ver spec, requisito "Funcionamento sem o agente").

### D6 — `ALLOWED_SIGN_IN` com e-mails individuais
Sem domínio próprio no Google, a lista contém os endereços da equipe separados por vírgula. Nunca `gmail.com` inteiro.

## Risks / Trade-offs

- [Sessão Google expira a cada 7 dias em modo Teste] → Aceito; documentar para a equipe. Saída futura: Google Workspace em `guardon.me` com app Interno.
- [Termos do Hobby preveem uso não comercial] → Aceito conscientemente para avaliação; reavaliar o Pro quando o uso se consolidar.
- [Mismatch de `BETTER_AUTH_SECRET` entre app e API causa loop de redirecionamento] → Definir o valor uma vez e conferir nos dois projetos antes do primeiro login.
- [Merge do `upstream` conflitar em `apps/api/vercel.json`] → Mudança pequena e isolada; resolver manualmente mantendo frequências diárias.
- [GitHub Actions pausa agendamentos em repositório inativo] → Um commit ou reativação manual a cada 60 dias; monitorar pela aba Actions.
- [`.env` local contém segredos] → Nunca commitar; segredos de produção gerados novamente, não reaproveitados do ambiente local.

## Migration Plan

1. Fork e remotes; push da branch de trabalho.
2. Neon + projeto Vercel da API → deploy → migrations aplicadas no build.
3. Projeto Vercel do app → deploy.
4. DNS e domínios; variáveis de URL; redeploy.
5. OAuth do Google com URIs de produção.
6. Workflow do GitHub Actions + `CRON_SECRET`.
7. Teste de login com cada membro; teste de sincronização.

Rollback: sem dados legados em produção; em caso de falha basta reverter o deploy na Vercel (instant rollback) ou remover os domínios. O ambiente local continua intacto.

## Open Questions

- Frequência exata do workflow de e-mail (10 vs 15 min) — ajustável sem alterar a spec.
- Se o repositório fork será público ou privado (Actions em repositório privado consome minutos gratuitos; o uso estimado cabe na cota).

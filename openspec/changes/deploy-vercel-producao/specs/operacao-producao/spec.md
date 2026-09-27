## Purpose

Define como o CRM se comporta quando publicado na internet para a equipe da guardon.me: quem consegue entrar, como a sessão funciona entre os subdomínios, como as tarefas periódicas rodam dentro do plano gratuito e o que acontece quando o agente não está publicado.

## ADDED Requirements

### Requirement: Acesso restrito à equipe
O sistema SHALL permitir login apenas a contas cujo e-mail conste explicitamente na lista de acesso de produção, e SHALL recusar qualquer outra conta, inclusive de domínios públicos como `gmail.com`.

#### Scenario: Membro da equipe entra
- **WHEN** uma pessoa cujo e-mail está na lista de acesso faz login com o Google em `crm.guardon.me`
- **THEN** o sistema cria a sessão e exibe o CRM

#### Scenario: Pessoa de fora é recusada
- **WHEN** uma conta Google válida que não está na lista de acesso tenta fazer login
- **THEN** o sistema recusa o login e não cria usuário nem sessão

#### Scenario: Lista de acesso vazia
- **WHEN** a lista de acesso de produção está vazia ou ausente
- **THEN** ninguém consegue fazer login

### Requirement: Sessão única entre app e API
O sistema SHALL manter uma única sessão válida para o app (`crm.guardon.me`) e para a API (`api.guardon.me`) após o login, sem loops de redirecionamento.

#### Scenario: Navegação após login
- **WHEN** um usuário conclui o login e o app faz chamadas à API
- **THEN** as chamadas são autenticadas com a mesma sessão, sem nova solicitação de login

### Requirement: Tráfego exclusivamente seguro
O sistema SHALL ser servido somente por HTTPS nos domínios de produção.

#### Scenario: Acesso por HTTP
- **WHEN** alguém acessa `http://crm.guardon.me`
- **THEN** é redirecionado para `https://crm.guardon.me`

### Requirement: Sincronização periódica de e-mail
O sistema SHALL executar a sincronização das caixas de e-mail conectadas com intervalo típico de até 15 minutos, disparada por um agendador autenticado com o segredo de cron, e SHALL recusar disparos sem o segredo correto.

#### Scenario: Disparo autenticado
- **WHEN** o agendador chama a rota de sincronização com o segredo de cron correto
- **THEN** o sistema sincroniza as caixas cujo prazo venceu e responde com sucesso

#### Scenario: Disparo sem segredo
- **WHEN** a rota de sincronização é chamada sem o segredo ou com um segredo incorreto
- **THEN** o sistema recusa a execução e não sincroniza nenhuma caixa

#### Scenario: Novo e-mail aparece no CRM
- **WHEN** um membro com o Gmail conectado recebe um e-mail de um contato
- **THEN** o e-mail aparece na linha do tempo desse contato em até ~15 minutos

### Requirement: Tarefas de manutenção diárias
O sistema SHALL executar, ao menos uma vez por dia, a atualização de câmbio, a retenção de dados de rastreamento e a limpeza de arquivados.

#### Scenario: Execução diária
- **WHEN** passa um dia desde a última execução
- **THEN** cada tarefa de manutenção executou uma vez

### Requirement: Funcionamento sem o agente
O sistema SHALL permanecer utilizável — login, contatos, empresas, negócios, e-mail — quando o agente de pesquisa não estiver publicado, informando na aba do agente que ele não está configurado em vez de exibir erro.

#### Scenario: Aba do agente sem agente publicado
- **WHEN** um usuário abre a aba Agente de um contato e o agente não está publicado
- **THEN** o sistema informa que o agente não está configurado e as demais abas continuam funcionando

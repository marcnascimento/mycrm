## Purpose

Define as empresas emissoras em nome das quais as propostas são feitas, seus modelos Word, a ligação fixa entre cliente e emissor e quem pode ver essas informações.

## ADDED Requirements

### Requirement: Cadastro de emissores
O sistema SHALL permitir ao owner criar, editar e desativar emissores com nome, prefixo de numeração e condições de pagamento padrão (lista de parcelas com percentual e descrição, somando 100%). Um emissor já usado por cliente ou proposta MUST NOT ser apagado, apenas desativado.

#### Scenario: Criar emissor
- **WHEN** o owner cria o emissor "Emissor B" com prefixo "MMN-" e parcelas 50% "deposit required to schedule testing" e 50% "final payment upon delivery"
- **THEN** o emissor fica disponível para associação a clientes e para upload de modelos

#### Scenario: Parcelas que não somam 100%
- **WHEN** o owner salva parcelas padrão de 50% e 40%
- **THEN** o sistema recusa o salvamento e informa que as parcelas devem somar 100%

#### Scenario: Apagar emissor em uso
- **WHEN** o owner tenta apagar um emissor associado a um cliente
- **THEN** o sistema recusa e oferece desativar o emissor

### Requirement: Modelos Word por emissor
O sistema SHALL permitir ao owner enviar um ou mais arquivos `.docx` como modelos de um emissor. No upload, o sistema MUST validar a sintaxe dos marcadores e MUST recusar o arquivo quando ele tiver erro de sintaxe ou usar um marcador fora do contrato de marcadores. O sistema MUST listar os marcadores encontrados. O sistema MUST recusar arquivos que não sejam `.docx` e arquivos acima do limite de tamanho.

#### Scenario: Upload de modelo válido
- **WHEN** o owner envia um `.docx` com marcadores válidos para o emissor "Emissor A"
- **THEN** o modelo fica associado ao emissor e o sistema mostra a lista de marcadores reconhecidos

#### Scenario: Marcador desconhecido
- **WHEN** o modelo contém `{client_nme}`
- **THEN** o sistema recusa o upload e aponta o marcador desconhecido

#### Scenario: Arquivo PDF
- **WHEN** o owner envia um arquivo `.pdf`
- **THEN** o sistema recusa o upload e informa que só aceita `.docx`

### Requirement: Emissor associado ao cliente
Cada empresa-cliente SHALL ter no máximo um emissor. O emissor é definido na ficha da empresa. O sistema MUST usar o emissor da empresa do negócio para toda proposta desse negócio e MUST NOT oferecer a escolha de emissor na geração. Empresas sem emissor continuam válidas no CRM.

#### Scenario: Definir emissor no cadastro
- **WHEN** o owner define o emissor "Emissor B" na empresa "Cliente Exemplo"
- **THEN** toda proposta gerada em negócios da Cliente Exemplo usa a Emissor B e os modelos dela

#### Scenario: Cliente sem emissor ao gerar proposta
- **WHEN** o owner inicia uma proposta num negócio cuja empresa não tem emissor
- **THEN** o sistema pede para definir o emissor da empresa antes de continuar

### Requirement: Troca de emissor preserva propostas antigas
O sistema SHALL permitir trocar o emissor de uma empresa. Antes de trocar, quando a empresa já tem propostas, o sistema MUST avisar. As propostas existentes MUST manter o emissor e o arquivo com que foram geradas.

#### Scenario: Trocar emissor com propostas existentes
- **WHEN** o owner troca o emissor da empresa de "Emissor A" para "Emissor B" e a empresa tem a proposta v1 gerada pela Emissor A
- **THEN** o sistema avisa antes de salvar, a v1 continua registrada como Emissor A e novas propostas usam a Emissor B

### Requirement: Acesso restrito ao owner
Somente membros com papel owner SHALL ver ou alterar emissores, modelos, catálogo, propostas e o emissor de uma empresa. Para os demais membros, a API MUST NOT retornar o emissor de uma empresa, e a interface MUST NOT mostrar a aba de propostas, o campo de emissor nem as telas de configuração de propostas.

#### Scenario: Membro sem papel owner abre um cliente
- **WHEN** um membro com papel member abre a ficha da empresa "Cliente Exemplo"
- **THEN** a ficha não mostra o emissor e a resposta da API não contém o emissor

#### Scenario: Chamada direta à API por quem não é owner
- **WHEN** um membro com papel member chama um procedimento do módulo de propostas
- **THEN** a API responde com erro de permissão (403)

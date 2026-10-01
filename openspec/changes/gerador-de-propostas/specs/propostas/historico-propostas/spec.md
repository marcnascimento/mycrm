## Purpose

Guarda cada proposta gerada de um negócio como uma versão reproduzível, com o conteúdo usado e os arquivos, e acompanha o status da proposta ligado ao estágio do negócio.

## ADDED Requirements

### Requirement: Versões por negócio
Cada geração SHALL criar uma nova versão numerada em sequência por negócio (v1, v2…). A versão guarda data, autor, emissor, modelo, número, todo o conteúdo usado (snapshot) e o total em EUR. Uma nova versão MUST poder partir do conteúdo da versão anterior.

#### Scenario: Segunda versão
- **WHEN** o owner cria uma nova versão a partir da v1 e altera o preço
- **THEN** o histórico mostra v1 e v2, cada uma com seu total, e a v1 continua inalterada

### Requirement: Arquivo gerado reproduzível
A versão SHALL guardar o `.docx` exatamente como foi gerado. O download MUST devolver esse arquivo, mesmo depois de alterações no modelo, no catálogo ou no emissor do cliente.

#### Scenario: Download após troca de modelo
- **WHEN** o owner substitui o modelo do emissor e baixa a v1 gerada antes
- **THEN** o arquivo baixado é idêntico ao gerado originalmente

### Requirement: Versão final enviada
O sistema SHALL permitir anexar a uma versão o `.docx` final realmente enviado ao cliente, depois de edições manuais no Word. O download padrão da versão MUST ser o arquivo final quando ele existe. O arquivo gerado MUST continuar disponível.

#### Scenario: Anexar versão final
- **WHEN** o owner edita o número no Word e anexa o arquivo final à v2
- **THEN** o histórico indica que a v2 tem versão final, e os dois arquivos podem ser baixados

### Requirement: Status da proposta
Cada versão SHALL ter status DRAFT, SENT, ACCEPTED ou REJECTED, alterado manualmente pelo owner. Uma versão nasce como DRAFT. Mudar o status de uma versão MUST NOT alterar o status de outras versões.

#### Scenario: Marcar como enviada
- **WHEN** o owner marca a v2 como SENT
- **THEN** a v2 fica SENT com a data da mudança, e a v1 mantém seu status

### Requirement: Sugestão de estágio do negócio
Ao mudar o status de uma versão, o sistema SHALL oferecer mover o negócio: SENT sugere o estágio CONTRACT_SENT, e ACCEPTED sugere CLOSED_WON e a atualização do valor do negócio para o total da versão. REJECTED MUST NOT sugerir mudança. O negócio MUST mudar só com confirmação. A mudança MUST seguir o mesmo caminho de uma edição normal do estágio.

#### Scenario: Aceita pelo cliente
- **WHEN** o owner marca a v2 de 9.000€ como ACCEPTED e confirma as duas sugestões
- **THEN** o negócio fica em CLOSED_WON com valor 9000 em EUR

#### Scenario: Sugestão recusada
- **WHEN** o owner marca a versão como SENT e recusa a sugestão
- **THEN** a versão fica SENT e o estágio do negócio não muda

### Requirement: Ciclo de vida com o negócio
Arquivar um negócio SHALL manter suas propostas. Apagar definitivamente (purge) o negócio MUST apagar as propostas e os arquivos dele.

#### Scenario: Purge do negócio
- **WHEN** um negócio com três versões de proposta é apagado definitivamente
- **THEN** as três versões e seus arquivos deixam de existir

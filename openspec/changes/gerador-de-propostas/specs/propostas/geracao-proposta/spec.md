## Purpose

Monta uma proposta a partir do negócio, do cliente, do emissor e do catálogo, deixa o usuário ajustar os dados daquela proposta e produz o `.docx` preenchido com o modelo do emissor.

## ADDED Requirements

### Requirement: Criar proposta a partir do catálogo
Na aba de propostas do negócio, o sistema SHALL permitir escolher um serviço disponível para o emissor do cliente. O sistema MUST copiar para a proposta o conteúdo do serviço, o preço e os adicionais desse emissor, e as parcelas padrão do emissor. Na v1, a proposta tem exatamente um serviço.

#### Scenario: Nova proposta
- **WHEN** o owner cria uma proposta no negócio da "Cliente Exemplo" (emissor Emissor B) com o serviço "Web Application Penetration Test"
- **THEN** a proposta abre preenchida com o conteúdo do serviço, uma linha financeira com o preço da Emissor B e as parcelas padrão da Emissor B

### Requirement: Ajuste por proposta
Todo campo copiado do catálogo SHALL poder ser editado na proposta sem alterar o catálogo, incluindo descrição e valor da linha financeira, listas e adicionais.

#### Scenario: Editar escopo só nesta proposta
- **WHEN** o owner remove um item de escopo e altera o valor para 11.500€ na proposta
- **THEN** o documento gerado reflete a alteração e o serviço no catálogo continua igual

### Requirement: Campos da proposta
A proposta SHALL ter: número (texto livre, pré-preenchido com o prefixo do emissor), data (padrão: hoje), contato em atenção (A/C), escolhido entre os contatos do negócio, com nome e cargo, jurisdição (PT ou ES) e parcelas de pagamento (percentual + descrição). As parcelas MUST somar 100%. O valor de cada parcela MUST ser calculado a partir do total.

#### Scenario: Número pré-preenchido
- **WHEN** o owner cria uma proposta para cliente de emissor com prefixo "MMN-"
- **THEN** o campo número começa com "MMN-" e aceita qualquer texto

#### Scenario: Parcelas calculadas
- **WHEN** o total é 5.200€ e as parcelas são 50% e 50%
- **THEN** o documento mostra as duas parcelas com valor 2.600€

#### Scenario: Parcelas inválidas
- **WHEN** as parcelas somam 90%
- **THEN** o sistema não gera o documento e informa que as parcelas devem somar 100%

### Requirement: Texto de jurisdição
O sistema SHALL preencher o texto legal de jurisdição conforme a jurisdição escolhida. O texto padrão PT MUST citar a Lei do Cibercrime (Lei n.º 109/2009) e a lei portuguesa e da UE. O texto padrão ES MUST citar a lei espanhola e da UE. O texto pode ser ajustado na proposta.

#### Scenario: Cliente na Espanha
- **WHEN** a jurisdição escolhida é ES
- **THEN** o documento contém o texto de autorização legal sob a lei espanhola e da UE e não cita a lei portuguesa

### Requirement: Preenchimento do modelo
O sistema SHALL gerar o `.docx` preenchendo os marcadores do modelo do emissor com os dados da proposta, conforme o contrato de marcadores do `design.md`. Quando o emissor tem mais de um modelo, o usuário MUST escolher o modelo. Todo conteúdo fora dos marcadores (logo, imagens, estilos, textos do emissor) MUST permanecer inalterado. Um marcador sem valor MUST sair vazio, nunca com o texto do marcador.

#### Scenario: Gerar documento
- **WHEN** o owner gera a proposta com o modelo da Emissor B
- **THEN** o sistema entrega um `.docx` com o layout da Emissor B e os dados da proposta nos lugares dos marcadores

#### Scenario: Listas e tabelas
- **WHEN** a proposta tem cinco linhas de cronograma e quatro fases com passos
- **THEN** a tabela de cronograma tem cinco linhas e cada fase aparece com seus passos

### Requirement: Logo do cliente
O owner SHALL poder enviar, na ficha da empresa-cliente, um logo (PNG, JPEG ou SVG) para uso nas propostas. O owner pode substituir e remover esse logo. Quando o modelo usado tem um espaço de logo do cliente, o documento gerado MUST mostrar o logo desse cliente nesse espaço, centralizado e sem distorção. Sem logo cadastrado, o sistema MUST avisar antes de gerar. Se o owner confirmar mesmo assim, o espaço MUST sair vazio. O documento MUST NOT conter o logo de outro cliente nem a imagem-espaço do modelo.

#### Scenario: Cliente com logo
- **WHEN** o owner gera uma proposta com o modelo da Emissor A para um cliente com logo cadastrado
- **THEN** a capa mostra o logo do cliente no círculo, com a proporção original

#### Scenario: Cliente sem logo
- **WHEN** o owner gera uma proposta com o modelo da Emissor A para um cliente sem logo
- **THEN** o sistema avisa que falta o logo; na confirmação, a capa sai com o espaço vazio, sem o quadro "CLIENT LOGO"

#### Scenario: Modelo sem espaço de logo
- **WHEN** o owner gera uma proposta com um modelo sem espaço de logo do cliente
- **THEN** o sistema não pede o logo e gera o documento normalmente

#### Scenario: Troca do logo depois da proposta
- **WHEN** o owner substitui o logo do cliente depois de gerar a v1
- **THEN** o download da v1 mostra o logo antigo, e a v2 sai com o logo novo

### Requirement: Formato de valores
Todo valor monetário no documento SHALL usar o formato europeu com o símbolo depois do número: ponto como separador de milhar, vírgula decimal, centavos só quando diferentes de zero. Exemplos: `5.200€`, `1.234,50€`, `600€`.

#### Scenario: Valor inteiro
- **WHEN** o total é 10000
- **THEN** o documento mostra `10.000€`

#### Scenario: Valor com centavos
- **WHEN** o total é 1234.5
- **THEN** o documento mostra `1.234,50€`

### Requirement: Atualizar valor do negócio
Ao gerar uma proposta, o sistema SHALL perguntar se o valor do negócio deve passar a ser o total da proposta, em EUR. Na confirmação, o sistema MUST atualizar valor e moeda do negócio pelo mesmo caminho de uma edição normal do negócio, incluindo a conversão para a moeda de relatório. Na recusa, o negócio MUST ficar inalterado.

#### Scenario: Aceitar atualização
- **WHEN** o owner gera uma proposta de 9.000€ e confirma a atualização
- **THEN** o negócio passa a ter valor 9000 em EUR e o valor convertido é recalculado

#### Scenario: Recusar atualização
- **WHEN** o owner gera a proposta e recusa a atualização
- **THEN** o valor e a moeda do negócio não mudam

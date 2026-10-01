## Purpose

Mantém num catálogo único os serviços oferecidos, com o conteúdo técnico em campos estruturados e o preço e os serviços adicionais de cada emissor, para que as propostas partam de um padrão revisado e não de cópia.

## ADDED Requirements

### Requirement: Conteúdo técnico estruturado do serviço
O sistema SHALL permitir ao owner criar, editar e arquivar serviços. Cada serviço tem os campos: título, frase de proposta (pitch), desafio, riscos (lista), objetivo, escopo (lista de título + descrição), introdução da metodologia, fases da metodologia (lista de nome + passos), compliance, entregáveis (lista de nome + itens), fora de escopo, cronograma (lista de fase + duração), nota de esforço, requisitos do cliente (lista), contas de teste e "what's included" (lista). Todos os campos são texto simples ou listas de texto simples.

#### Scenario: Cadastrar serviço
- **WHEN** o owner cadastra "Web Application Penetration Test" com nove itens de escopo e quatro fases de metodologia
- **THEN** o serviço fica disponível para propostas com o conteúdo informado, na ordem informada

#### Scenario: Arquivar serviço
- **WHEN** o owner arquiva um serviço já usado em propostas
- **THEN** o serviço deixa de aparecer na escolha de novas propostas e as propostas existentes continuam intactas

### Requirement: Preço por emissor
Cada serviço SHALL ter um preço em EUR para cada emissor que o oferece. Um serviço sem preço para um emissor MUST NOT aparecer na escolha de serviço de propostas desse emissor.

#### Scenario: Mesmo serviço, preços diferentes
- **WHEN** o serviço "AI/LLM & Web Application Penetration Test" tem preço 10.000€ para Emissor A e 9.000€ para Emissor B
- **THEN** uma proposta de cliente da Emissor A começa com 10.000€ e uma de cliente da Emissor B começa com 9.000€

#### Scenario: Serviço sem preço para o emissor
- **WHEN** o serviço não tem preço definido para a Emissor B
- **THEN** o serviço não aparece na lista ao criar proposta para cliente da Emissor B

### Requirement: Serviços adicionais por emissor
Cada serviço SHALL ter, por emissor, uma lista de serviços adicionais com rótulo, preço em EUR e unidade (por exemplo "Extra retests", 600, "each"). Esses valores MUST NOT entrar no total da proposta.

#### Scenario: Adicionais na proposta
- **WHEN** uma proposta é criada a partir de um serviço com três serviços adicionais para o emissor do cliente
- **THEN** a proposta traz os três adicionais com os preços desse emissor, fora do total

### Requirement: Catálogo não muda propostas existentes
Alterações no catálogo SHALL valer só para propostas criadas depois da alteração.

#### Scenario: Preço alterado depois da proposta
- **WHEN** o owner altera o preço de um serviço depois de gerar a v1 de uma proposta
- **THEN** a v1 mantém o preço original e uma nova proposta começa com o preço novo

## Why

Hoje cada proposta comercial é montada à mão no Word, copiando texto de propostas anteriores. Isso gera erros reais: numa proposta da Emissor A apareceu o nome de outra empresa ("Emissor C"), o Annex 1 citava o número de outra proposta, a data ficou como `/Date` e faltou o nome do cliente numa cláusula. Como a mesma pessoa emite propostas em nome de três empresas diferentes, um nome trocado também é um problema de conflito de interesse. O CRM já tem cliente, contatos e negócio, e a estrutura das propostas é estável (mesmas seções, com conteúdo que varia por serviço). Por isso dá para gerar a proposta a partir de dados, e não por cópia. O projeto original não tem propostas, então esta funcionalidade é própria do fork.

## What Changes

- **Emissores**: cadastro das empresas em nome das quais as propostas são emitidas (v1: Emissor A e Emissor B; o terceiro entra depois só por cadastro). Cada emissor tem seus modelos `.docx`, com logo, textos institucionais, termos e assinatura escritos no próprio modelo, além de condições de pagamento padrão.
- **Emissor por cliente**: o emissor é definido no cadastro da empresa-cliente. Todos os negócios e propostas desse cliente saem por ele, sem escolha na hora de gerar. A troca é permitida, e as propostas antigas mantêm o emissor original.
- **Logo do cliente**: o owner envia o logo na ficha do cliente, uma vez. Os modelos que têm um espaço de logo do cliente (imagem com texto alternativo `client_logo`, como na capa da Emissor A) saem com esse logo. Sem logo cadastrado, o sistema avisa antes de gerar e nunca deixa sair o logo de outro cliente.
- **Catálogo de serviços**: um catálogo único, no qual cada serviço guarda o conteúdo técnico em campos (desafio, riscos, objetivo, escopo, metodologia por fases, compliance, entregáveis, fora de escopo, cronograma, esforço, requisitos, contas de teste, "what's included") e tem **preço e serviços adicionais por emissor**.
- **Geração**: na aba "Proposals" do negócio, o usuário escolhe o serviço. O sistema copia o conteúdo do catálogo para a proposta, onde tudo pode ser ajustado sem alterar o catálogo. O usuário informa número, contato em atenção (A/C), jurisdição (PT ou ES) e parcelas de pagamento. O sistema preenche o modelo do emissor e entrega o `.docx`. Valores saem no formato `5.200€` / `1.234,50€`.
- **Valor do negócio**: ao gerar, o sistema pergunta se atualiza o valor do negócio para o total da proposta, em EUR.
- **Histórico e status**: cada geração cria uma versão (v1, v2…) que guarda o conteúdo usado e o arquivo gerado. Também aceita o upload da versão final realmente enviada. O status (DRAFT → SENT → ACCEPTED/REJECTED) é marcado pelo usuário, e o sistema oferece mover o estágio do negócio.
- **Acesso**: só o owner do workspace vê e usa emissores, catálogo, modelos e propostas, incluindo o emissor na ficha do cliente.
- **v1 com um serviço por proposta**. A estrutura de dados já é uma lista de linhas, preparada para vários serviços numa change futura.
- **Fora de escopo**: vários serviços por proposta, jurisdições além de PT e ES, envio por e-mail, assinatura digital, redação por IA e conversão para PDF.

## Capabilities

### New Capabilities
- `propostas/emissores`: cadastro de emissores e seus modelos `.docx`, associação de emissor ao cliente e restrição de acesso ao owner.
- `propostas/catalogo-servicos`: serviços com conteúdo técnico estruturado, preço por emissor e serviços adicionais por emissor.
- `propostas/geracao-proposta`: montagem da proposta a partir do negócio e do catálogo, campos por proposta, preenchimento do modelo, logo do cliente, formatação de valores e atualização opcional do valor do negócio.
- `propostas/historico-propostas`: versões por negócio, download do arquivo gerado, upload da versão final e status com sugestão de estágio do negócio.

### Modified Capabilities
<!-- Nenhuma: não existem specs anteriores neste repositório. -->

## Impact

- **Banco**: tabelas novas (emissor, modelo, serviço, preço por emissor, proposta) e uma coluna nova `issuerId` em `Company` (um modelo do upstream: conflito pequeno e aceito em merges futuros).
- **API**: módulo isolado `apps/api/src/proposals` com roteador tRPC próprio. O preenchimento é determinístico e não viola a regra de "inteligência fora da API". A atualização do valor e do estágio do negócio passa pelos serviços de negócio existentes, respeitando `docs/currency.md`.
- **Auth**: nova permissão de owner em `@crm/auth` para o módulo de propostas.
- **App**: aba "Proposals" na ficha do negócio, campo de emissor na ficha da empresa (só owner) e telas de emissores e catálogo em Settings.
- **Dependência nova**: biblioteca de preenchimento de `.docx` na API, empacotada na função serverless.
- **Modelos**: os dois `.docx` atuais são propostas preenchidas. O usuário aplica os marcadores definidos no `design.md` antes do primeiro uso.
- **Limite**: upload e download passam pelo tRPC, sujeitos ao limite de corpo de requisição da Vercel (4,5 MB).

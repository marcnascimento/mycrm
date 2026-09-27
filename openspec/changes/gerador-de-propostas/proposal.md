## Why

Hoje cada proposta comercial da guardon.me é montada à mão no Word, copiando dados do cliente e preços de um modelo — trabalho repetitivo e sujeito a erro. Como o CRM já concentra empresa, contatos e valor de cada negócio, gerar a proposta a partir dele elimina a redigitação sem criar mais um sistema no dia a dia. O projeto original declara explicitamente que não terá orçamentos/propostas, então esta funcionalidade é própria do fork e não disputa espaço com atualizações futuras.

## What Changes

- **Catálogo de serviços**: tabela de serviços/itens com descrição e preço padrão, mantida pela equipe no próprio CRM.
- **Itens da proposta**: em cada negócio, a pessoa escolhe itens do catálogo e pode ajustar quantidade, preço e descrição daquela proposta sem alterar o catálogo.
- **Modelo Word**: upload de um modelo `.docx` com marcadores (ex.: empresa, contato, data, itens, total) que o sistema preenche.
- **Geração**: botão no negócio que gera o `.docx` preenchido para download; revisão e envio ao cliente continuam manuais, fora do CRM.
- **Histórico**: cada proposta gerada fica guardada no negócio como uma versão (v1, v2, …), com data, autor, itens e valor total, e pode ser baixada novamente.
- **Fora de escopo agora**: envio automático por e-mail, aceite/assinatura digital, redação de texto por IA (candidata a uma change futura usando o agente).

## Capabilities

### New Capabilities
- `propostas/catalogo-servicos`: cadastro e manutenção dos serviços e preços padrão usados nas propostas.
- `propostas/geracao-proposta`: montagem dos itens de uma proposta a partir de um negócio, preenchimento do modelo Word e download do documento.
- `propostas/historico-propostas`: versões de propostas guardadas por negócio e seu download posterior.

### Modified Capabilities
<!-- Nenhuma: não existem specs anteriores neste repositório. -->

## Impact

- **Banco**: novas tabelas (catálogo, propostas, itens de proposta, modelo) via nova migration; nenhuma alteração nas tabelas existentes além de relações com `Deal`.
- **API**: novo módulo isolado (roteador tRPC próprio) para catálogo, propostas e geração do `.docx`; preenchimento de modelo é determinístico e não viola a regra do projeto de manter "inteligência" fora da API.
- **App**: nova aba "Propostas" na página do negócio e uma tela de catálogo nas configurações.
- **Armazenamento de arquivos**: modelo e documentos gerados precisam de um lugar para ficar (Vercel Blob ou o próprio Postgres) — decisão no design.
- **Dependência nova**: biblioteca de preenchimento de `.docx` na API.
- **Pendente do usuário**: o modelo Word definitivo (em aprimoramento) — necessário para fechar a lista de marcadores, specs e design antes da implementação.

## Context

Motivação e escopo: ver `proposal.md`. Requisitos: ver `specs/propostas/*`.

Estado atual relevante:

- `Deal` pertence a uma `Company` e tem `amount`/`currency`. `baseAmount` é congelado pelo `ConversionService` (`docs/currency.md`). Contatos do negócio vêm de `DealContact` (com `role`).
- A ficha do negócio (`apps/app/components/crm/record-sheet/deal-sheet.tsx`) monta as abas como um array `DetailSheetTab[]`. Uma aba nova entra como mais um item.
- Permissões de owner seguem o padrão `canManageCurrency(await workspaceRoleOf(userId))` (`@crm/auth` + `currency.service.ts`): a mesma função guarda o serviço e desabilita a interface.
- Existe precedente de arquivo binário no Postgres: `AgentConversationAttachment.content Bytes`.
- REST é só auth e health. Dados passam por tRPC (`docs/api.md`). A API roda como função serverless na Vercel (Hobby), com limite de 4,5 MB no corpo da requisição e da resposta.
- Os modelos com marcadores estão em `C:\Projetos\CRM\modelos\` (`modelo-emissor-b.docx`, `modelo-emissor-a.docx`), fora do repositório. A capa da Emissor A tem um espaço de logo do cliente (`word/media/image1.png`, usado por "Oval 15" e "Picture 45"). O logo do Cliente Exemplo foi trocado por um quadro neutro "CLIENT LOGO".
- `Company.logoUrl` existe, mas só o agente o preenche, e o agente não está em produção.

## Goals / Non-Goals

**Goals:**
- Módulo isolado (`apps/api/src/proposals`, telas próprias no app) que toca o mínimo possível em arquivos do upstream.
- Um contrato de marcadores único, igual para todos os emissores. Um emissor novo entra só por cadastro e upload de modelo.
- Versões reproduzíveis byte a byte.

**Non-Goals:**
- Editor rico de texto (negrito, links) dentro dos campos. A formatação vem do modelo.
- Converter para PDF no servidor.
- Imagens dinâmicas além do logo do cliente. As outras imagens são fixas em cada modelo.
- Usar `Company.logoUrl` como fonte do logo (fica como sugestão futura).
- Vários serviços por proposta (a estrutura `lines[]` fica pronta, mas o modelo e a interface ficam para depois).

## Decisions

### D1. Emissor como entidade própria, com `Company.issuerId`
`Issuer` é uma tabela separada de `Company`. Uma empresa pode ser cliente de um emissor e, em outro contexto, ser o nome de um emissor (a Emissor A já foi cliente da Emissor B). `Company.issuerId String?` usa FK com `onDelete: Restrict`. A regra "um cliente, um emissor" fica garantida pelo banco.
- Alternativa: tabela de ligação `CompanyIssuer` sem tocar em `Company`. Rejeitada porque enfraquece a regra, e o conflito de merge de uma linha no `schema.prisma` é trivial (decisão do usuário).

### D2. Conteúdo em JSON validado por zod, não em tabelas normalizadas
`Service.content` e `Proposal.content` são `Json`, validados por um único schema zod `proposalContent` em `@crm/validation`. É o mesmo schema para catálogo e proposta. Justificativa: o conteúdo é um documento aninhado (fases → passos, entregáveis → itens), é copiado como snapshot, nunca é filtrado ou agregado no banco e muda de forma junto com os modelos.
- Alternativa: tabelas por lista (ScopeItem, Phase, Step…). Rejeitada: dez tabelas para dados que só são lidos inteiros.
- Campos com valor monetário ficam fora do JSON quando são somados (`Proposal.total Decimal(14,2)`). Os valores dentro de `lines`, `extras` e `payments` são `Decimal` serializado como string.

### D3. Modelo de dados

```
Issuer          id, name, numberPrefix, defaultPayments Json, active, timestamps
IssuerTemplate  id, issuerId, name, fileName, content Bytes, size, markers String[],
                uploadedById, createdAt, archivedAt
Company         + issuerId String? → Issuer (Restrict)
ClientLogo      companyId (PK) → Company (Cascade), content Bytes (PNG), width, height,
                uploadedById, updatedAt
Service         id, name, content Json, archivedAt, timestamps
ServicePrice    serviceId + issuerId (PK), amount Decimal(14,2), extras Json
Proposal        id, dealId → Deal (Cascade), version Int, issuerId, issuerName (snapshot),
                templateId?, templateName (snapshot), serviceId?, number, date,
                attentionContactId?, attentionName, attentionPosition,
                jurisdiction (PT|ES), jurisdictionText, content Json, lines Json,
                extras Json, payments Json, total Decimal(14,2), currency "EUR",
                status (DRAFT|SENT|ACCEPTED|REJECTED), statusChangedAt,
                generatedFile Bytes, generatedFileName, finalFile Bytes?, finalFileName?,
                finalUploadedAt?, createdById, createdAt
                @@unique([dealId, version])
```

`issuerName` e `templateName` são snapshots, e o histórico não depende de o emissor ou o modelo ainda existirem. `IssuerTemplate` é arquivado, nunca apagado, quando já foi usado. O purge do negócio apaga as propostas em cascata, conforme a spec de histórico.

### D4. Biblioteca: docxtemplater + pizzip
É JS puro e cabe no bundle esbuild da função, sem entrar em `EXTERNALS`. Suporta laços, laços aninhados e laços em linha de tabela (`paragraphLoop: true`, `linebreaks: true`). Tem `InspectModule` para listar os marcadores de um modelo, o que atende a validação no upload. Um `nullGetter` devolve string vazia, e marcador sem valor sai vazio.
- Alternativa: `docx-templates`. Só faria diferença com imagens dinâmicas, que estão fora do escopo.
- Verificar a licença do núcleo e o funcionamento no bundle antes de adotar (task 1.1).

### D5. Arquivos em `bytea`, trafegando em base64 pelo tRPC
Upload do modelo, download do gerado e upload do final passam por procedimentos tRPC com base64. Isso evita um serviço novo (Blob) e uma variável de ambiente nova. Limite prático: arquivo de até **3 MB** (base64 + JSON dentro dos 4,5 MB da Vercel), definido em `proposals.config.ts`. O modelo da Emissor A tem 0,8 MB.
- Alternativa: Vercel Blob. Fica como caminho de saída se os modelos crescerem (ver Riscos).

### D6. Permissão `canManageProposals(role)` em `@crm/auth`
Só owner. Ela guarda todos os procedimentos do roteador `proposals` e decide se a interface mostra a aba, o campo de emissor e o item "Proposals" em Settings. O emissor da empresa é lido e escrito **só por procedimentos do módulo de propostas** (`proposals.companyIssuer` / `setCompanyIssuer`). `companies.byId` e as listas do upstream não passam a selecionar `issuerId`, então nada muda para os outros membros e o arquivo do upstream fica intocado.

### D7. Valor e estágio do negócio via `DealsService`
"Atualizar valor" e "mover estágio" chamam os métodos existentes de atualização de negócio. Assim `ConversionService.dealFields`, `stageChangedAt`/`closedAt` e a invalidação de cache (`cache.deal(id)`) valem sem duplicar regra. As duas ações são mutações separadas, disparadas pelo diálogo de confirmação. A geração nunca muda o negócio sozinha.

### D8. Formatação de valores própria, sem Intl de locale
`formatEur(decimal)`: milhar com ponto, decimal com vírgula, centavos só quando diferentes de zero, `€` no fim sem espaço (`5.200€`, `1.234,50€`). `Intl.NumberFormat` não serve: `pt-PT` não agrupa milhares de 4 dígitos, e `de-DE` coloca espaço antes do `€`. A data sai como `DD-MM-YYYY`, como no modelo da Emissor B. Os formatos ficam em `proposals.config.ts`.

### D9. Contrato de marcadores (v1)
Sintaxe docxtemplater: `{campo}`, laço `{#lista}…{/lista}`, item simples `{.}`. Laço em linha de tabela: coloque `{#lista}` na primeira célula e `{/lista}` na última célula da mesma linha. Laços de parágrafo: `{#lista}` e `{/lista}` em parágrafos próprios, em volta do parágrafo com marcador de lista.

**Proposta**

| Marcador | Conteúdo |
|---|---|
| `{date}` | data da proposta, `DD-MM-YYYY` |
| `{number}` | número, texto livre (ex.: `MMN-0001`) |
| `{client_name}` | nome da empresa-cliente |
| `{attention_name}` / `{attention_position}` | contato em atenção (A/C) |
| `{jurisdiction_text}` | texto de autorização legal (PT/ES) |

**Serviço** (copiado do catálogo e editável)

| Marcador | Conteúdo |
|---|---|
| `{service_title}` | título do serviço |
| `{service_pitch}` | frase da executive summary ("a comprehensive web application…") |
| `{challenge}` | Understanding your challenge |
| `{#risks}{.}{/risks}` | Risk of not acting (lista) |
| `{objective}` | objetivo do engajamento |
| `{#scope}{title} - {description}{/scope}` | Scope of testing |
| `{methodology_intro}` | introdução da metodologia |
| `{#phases}{name}` … `{#steps}{.}{/steps}{/phases}` | fases → passos |
| `{compliance}` | Compliance support |
| `{#deliverables}{name}` … `{#items}{.}{/items}{/deliverables}` | entregáveis → itens |
| `{out_of_scope}` | Out of scope |
| `{#schedule}{phase}` \| `{duration}{/schedule}` | linha de tabela do cronograma |
| `{effort_note}` | nota de esforço total |
| `{#requirements}{.}{/requirements}` | Requirements from client |
| `{test_accounts}` | Test accounts for gray box testing |

**Financeiro**

| Marcador | Conteúdo |
|---|---|
| `{#lines}{description}` \| `{amount}{/lines}` | linha de tabela: serviço e valor |
| `{total}` | total (TCV), ex.: `5.200€` |
| `{#included}{.}{/included}` | What's included |
| `{#extras}{label}: {price}{unit}{/extras}` | Additional services (fora do total). `unit` que começa com letra ou número ganha um espaço antes (`each` → `600€ each`); `/hour` fica colado (`300€/hour`) |
| `{#payments}{percent}% {label} ({amount}){/payments}` | parcelas com valor calculado |

**Fica escrito no modelo, sem marcador:** capa e logo, "About", Testing approach (tabela Black/Gray/White), métodos de pagamento, Terms & Conditions (exceto jurisdição), assinatura do emissor, anexos (ética etc.). Isso impede, por construção, o nome de um emissor aparecer no modelo de outro.

Mapeamento nos modelos atuais. Já aplicado em `C:\Projetos\CRM\modelos\modelo-emissor-b.docx` e `modelo-emissor-a.docx` (tasks 7.1 e 7.2) e validado com docxtemplater 3.71.0 (MIT):
- **Emissor B** (`proposta-exemplo-b.docx`): `14-07-2026` → `{date}`; `Cliente Exemplo` (capa) → `{client_name}`; `[Client Name]` → `{client_name}`; `a comprehensive web application penetration test` → `{service_pitch}`; seções de "UNDERSTANDING YOUR CHALLENGE" a "Test Accounts" → marcadores de serviço; tabela financeira → `{#lines}`, com linha de total `{total}` a acrescentar; "What's Included", "Additional Services" e as duas parcelas → laços; "Lei do Cibercrime…" → `{jurisdiction_text}`. Aplicar logo e layout da Emissor B.
- **Emissor A** (`proposta-exemplo-a.docx`): `/Date` no cabeçalho → `{date}`; `Proposal nr … A/C Jane Doe` → `Proposal nr {number}  A/C {attention_name}`; "Cliente Exemplo" (várias cláusulas) e "the  will" → `{client_name}`; o número do Annex 1 (`OUTRA-REF-0000`) → `{number}`; remover "Emissor C" (vira texto fixo Emissor A); tabela Service/Investment/TCV → `{#lines}` + `{total}`; "Payment conditions" → `{#payments}`. Seções técnicas → marcadores de serviço.

### D10. Interface
- **Deal sheet**: aba "Proposals" (só owner) com o histórico (versão, número, status, total, data) e ações: New proposal, New version from…, Download, Upload final, Change status.
- **Editor de proposta**: um sheet/dialog com seções recolhíveis na ordem do documento. Listas simples usam textarea com um item por linha. Listas aninhadas (fases, entregáveis) usam grupos com título + textarea. O cronograma e as linhas usam uma tabela editável simples. Tudo com componentes de `@crm/ui`.
- **Company sheet**: campo "Issuer" (select) e "Proposal logo" (upload com prévia) na visão geral, só owner, lidos e gravados pelos procedimentos de propostas.
- **Settings → Proposals** (só owner): abas Issuers (dados, parcelas padrão, modelos com upload e lista de marcadores) e Services (conteúdo + preços e adicionais por emissor).
- Textos de interface em inglês, como o resto do app.

### D12. Logo do cliente sem o módulo pago de imagens
- **Marcação no modelo**: a imagem que recebe o logo tem texto alternativo (`wp:docPr descr`) igual a `client_logo`. A inspeção do upload informa se o modelo tem esse espaço e a proporção da imagem-espaço.
- **Troca**: depois do docxtemplater, o gerador procura os `w:drawing` com `descr="client_logo"`, resolve o `r:embed` pelo `document.xml.rels` e substitui o arquivo de mídia dentro do zip. Posição, tamanho, recorte (o círculo da Emissor A) e fallback VML ficam intactos, porque só os bytes mudam. Validado no protótipo com o `modelo-emissor-a.docx`.
- **Proporção**: no upload, o navegador converte o logo para PNG (lado máximo de 1000 px) e o sistema guarda esse original. Na geração, o navegador encaixa o logo na proporção do espaço do modelo escolhido (300×128 na Emissor A), centralizado com margem transparente de 12%, e envia o PNG pronto junto com o pedido de geração. Assim a API não precisa de biblioteca de imagem nativa, o que evita problemas no bundle da Vercel, e cada modelo recebe a proporção certa.
- **Armazenamento**: tabela `ClientLogo` separada. Um `Bytes` em `Company` seria lido em toda consulta de empresas sem `select`, além de mexer mais no modelo do upstream.
- **Sem logo**: a geração avisa. Se o owner confirmar mesmo assim, o espaço recebe um PNG transparente. O quadro "CLIENT LOGO" do modelo nunca chega ao cliente.
- **Snapshot**: o logo usado fica dentro do `.docx` gerado. Trocar o logo do cliente depois não altera versões antigas.
- Alternativas: módulo de imagem pago do docxtemplater (custo recorrente) e `docx-templates` (troca de biblioteca inteira por uma só imagem). As duas foram rejeitadas.

### D11. Configuração em um arquivo
`apps/api/src/proposals/proposals.config.ts`: tamanho máximo de arquivo, formato de data, formato de moeda e textos padrão de jurisdição (PT, ES). Textos de jurisdição ficam em código na v1. Um novo país é uma linha nova ali.

## Risks / Trade-offs

- [Modelo com imagens pesadas passa de 3 MB] → comprimir as imagens no Word ("Compress Pictures"). Se não bastar, migrar o armazenamento dos arquivos para Vercel Blob numa change própria.
- [O Word quebra um marcador em vários "runs" ao editar, e o marcador deixa de ser reconhecido] → a validação no upload lista os marcadores reconhecidos e acusa sintaxe quebrada. O guia orienta digitar cada marcador de uma vez, sem formatação parcial.
- [JSON sem schema no banco] → um único schema zod valida tudo na entrada e na leitura. Uma versão antiga lida com schema novo usa defaults, e os campos novos são opcionais.
- [O emissor vaza para quem não é owner por outro caminho: agente, busca, API REST gerada] → `issuerId` não é selecionado por nenhum procedimento fora do módulo. Task dedicada verifica a ponte do agente e o `/rest`.
- [Crescimento do banco (Neon Free 0,5 GB)] → cerca de 1 MB por versão (gerado + final), o que dá centenas de versões antes de preocupar. Monitorar na tela de uso do Neon.
- [Conflito de merge com o upstream em `schema.prisma` (Company) e `deal-sheet.tsx`/`company-sheet.tsx`] → as mudanças nesses arquivos se limitam a uma linha ou um item de array. Todo o resto fica em arquivos novos.

## Migration Plan

1. Migration Prisma aditiva: tabelas novas + `Company.issuerId` nulo. Nenhum dado existente muda. Rollback: reverter o deploy. A migration pode ficar, porque as colunas e tabelas novas são ignoradas pelo código antigo.
2. Deploy normal pelo fluxo `release` (CONTRIBUTING.md). As migrations rodam em produção como no deploy atual.
3. Pós-deploy (manual, pelo owner): cadastrar Emissor A e Emissor B, enviar os modelos com marcadores, cadastrar os dois serviços dos exemplos (AI/LLM e Web App) e definir o emissor dos clientes ativos.

## Open Questions

- O modelo da Emissor A não tem cláusula de autorização legal, então `{jurisdiction_text}` não aparece nele. Acrescentar a cláusula é uma edição do modelo, sem mudança de código.

- Formato da data: `DD-MM-YYYY` como padrão. Trocar por formato por extenso em inglês é só configuração.
- Texto de jurisdição ES: redação exata a confirmar pelo usuário. O padrão vem do PDF da Emissor B ("under applicable Spanish and EU law").

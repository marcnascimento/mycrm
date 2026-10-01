## 1. Base e dependências

- [x] 1.1 (Licenças já confirmadas: docxtemplater 3.71.0 MIT, pizzip 3.3.0 MIT/GPL-3.0) Confirmar a licença do núcleo do docxtemplater e do pizzip; adicionar os dois a `apps/api`; rodar `node apps/api/scripts/build-func.mjs` e verificar que o bundle os inclui sem entrar em `EXTERNALS`
- [x] 1.2 Criar `canManageProposals(role)` (só owner) em `packages/auth/src/organization.ts`, exportar no barrel e verificar com teste unitário que owner=true e member/admin=false
- [x] 1.3 Criar o schema zod `proposalContent` (conteúdo do serviço), `proposalLine`, `proposalExtra` e `proposalPayment` em `@crm/validation`, com teste que valida o conteúdo do serviço "Web Application Penetration Test" do modelo Emissor B e recusa parcelas que não somam 100
- [x] 1.4 Criar `apps/api/src/proposals/proposals.config.ts` (tamanho máximo 3 MB, formato de data, textos de jurisdição PT e ES) e verificar com typecheck

## 2. Banco

- [x] 2.1 Adicionar ao `schema.prisma` os modelos `Issuer`, `IssuerTemplate`, `Service`, `ServicePrice`, `Proposal`, os enums de status e jurisdição e `Company.issuerId` (FK Restrict), conforme D3; gerar a migration e verificar que `prisma migrate dev` aplica sem alterar dados existentes
- [x] 2.1.1 Adicionar o modelo `ClientLogo` (D3/D12) na mesma migration e verificar que `companies.list` não lê a coluna `Bytes`
- [x] 2.2 Verificar que o purge de um negócio apaga as propostas em cascata e que apagar um emissor em uso falha, com teste de integração do banco

## 3. Formatação e preenchimento (API)

- [x] 3.1 Implementar `formatEur` e a formatação de data (D8) e verificar com testes: 10000→`10.000€`, 1234.5→`1.234,50€`, 600→`600€`, 0.5→`0,50€`
- [x] 3.2 Implementar o montador de dados do modelo (proposta → objeto de marcadores do contrato D9), incluindo valores das parcelas calculados a partir do total, e verificar com teste de unidade (5.200€ em 50/50 → 2.600€ cada)
- [x] 3.3 Implementar o renderizador docxtemplater (`paragraphLoop`, `linebreaks`, `nullGetter` vazio) e verificar com um `.docx` de fixture com laço de parágrafo, laço aninhado e laço em linha de tabela que a saída contém os valores e nenhum `{`
- [x] 3.4 Implementar a inspeção de modelo, informando também se há espaço `client_logo` e a proporção da imagem-espaço, (InspectModule): lista de marcadores, erro de sintaxe e marcador fora do contrato; verificar com fixtures válida, com `{client_nme}` e com chave quebrada

- [x] 3.5 Implementar a troca de imagem por `descr="client_logo"` (D12) após o render e verificar com o `modelo-emissor-a.docx` que `word/media/image1.png` recebe o PNG enviado, e com PNG transparente quando não há logo

## 4. Roteador e serviços (API)

- [x] 4.1 Criar `ProposalsModule` com `proposals.router.ts` (AuthMiddleware) e serviços; todo procedimento chama `canManageProposals` e responde 403 para quem não é owner; verificar com teste de serviço usando um member
- [x] 4.2 Emissores: list/create/update/deactivate com parcelas padrão validadas; delete só sem uso; verificar os cenários da spec `emissores`
- [x] 4.3 Modelos: upload base64 (só `.docx`, até o limite), inspeção obrigatória, list, archive; verificar recusa de PDF, de arquivo grande e de marcador desconhecido
- [x] 4.4 Emissor do cliente: `companyIssuer`/`setCompanyIssuer`, com aviso (flag de retorno) quando a empresa já tem propostas; verificar que as propostas antigas mantêm `issuerId`/`issuerName`
- [x] 4.4.1 Logo do cliente: `clientLogo`/`setClientLogo`/`removeClientLogo` (PNG base64, até o limite), só owner; verificar os cenários da spec `geracao-proposta` → Logo do cliente
- [x] 4.5 Catálogo: CRUD de serviço, arquivamento, preços e extras por emissor; a lista para proposta filtra por emissor com preço; verificar os cenários da spec `catalogo-servicos`
- [x] 4.6 Propostas: `draftFromService` (copia conteúdo, preço, extras e parcelas do emissor do cliente; número pré-preenchido com o prefixo), `draftFromVersion`, `generate` (valida, renderiza, grava a versão v(n+1) com snapshot e arquivo); verificar que v1 e v2 coexistem e que a v1 não muda
- [x] 4.7 Arquivos: `download` (final quando existe, senão o gerado, com opção explícita de baixar o gerado) e `uploadFinal`; verificar que o download devolve bytes idênticos depois de substituir o modelo
- [x] 4.8 Status: `setStatus` sem efeito em outras versões, retornando as sugestões (SENT→CONTRACT_SENT; ACCEPTED→CLOSED_WON + valor); verificar a sugestão por status com teste
- [x] 4.9 Ações sobre o negócio pelos métodos existentes do `DealsService` (valor em EUR e estágio), verificando com teste que `baseAmount`/`fxRate` são recalculados e que `closedAt` é preenchido em CLOSED_WON
- [x] 4.10 Rodar `check-types` na API para regenerar e commitar `src/generated/server.ts`; verificar que o app enxerga `trpc.proposals.*`

## 5. Interface (app)

- [x] 5.1 Expor `canManageProposals` ao app pelo perfil/permissões já carregados e verificar que um member não vê nenhum ponto de entrada de propostas
- [x] 5.2 Settings → Proposals (item no `settings-sidebar.tsx`, só owner): aba Issuers com parcelas padrão e upload de modelos mostrando os marcadores reconhecidos ou os erros; verificar no navegador com o modelo marcado da Emissor B
- [x] 5.3 Settings → Proposals, aba Services: editor do conteúdo estruturado (textarea por linha, grupos para fases e entregáveis, tabela de cronograma) e preços/extras por emissor; verificar cadastrando o serviço Web App do modelo Emissor B
- [x] 5.4 Campo "Issuer" na ficha da empresa (só owner), com aviso de troca quando há propostas; verificar a troca e o aviso no navegador
- [x] 5.4.1 Campo "Proposal logo" na ficha da empresa (só owner): upload com conversão para PNG no navegador (lado máximo 1000 px), prévia, substituir e remover; verificar com PNG, JPEG e SVG
- [x] 5.5 Aba "Proposals" no `deal-sheet.tsx` (só owner): histórico com versão, número, status, total, data, arquivo final; verificar que a aba não aparece para um member
- [x] 5.6 Editor de proposta: escolha de serviço (ou de versão base), campos da proposta (número, data, A/C entre contatos do negócio, jurisdição, parcelas), conteúdo editável, escolha de modelo quando houver mais de um; pedido de emissor quando o cliente não tem; verificar gerando uma proposta completa
- [x] 5.6.1 Na geração: se o modelo tem espaço `client_logo`, encaixar o logo no navegador (canvas, proporção do espaço, margem 12%, fundo transparente) e enviar junto; sem logo, mostrar o aviso; verificar no Word que o logo sai centralizado e sem distorção
- [x] 5.7 Pós-geração: download automático e diálogo "Update deal amount to X€?"; verificar aceitar e recusar
- [x] 5.8 Ações de versão: download (final/gerado), upload do final, mudança de status com diálogo das sugestões de estágio/valor; invalidar com `cache.deal(id)`; verificar o fluxo SENT e ACCEPTED no navegador

## 6. Vazamento e segurança

- [x] 6.1 Verificar que nenhum procedimento fora do módulo (companies, search, bridge do agente, `/rest` do OpenAPI) retorna `issuerId` ou dados de propostas; registrar o resultado
- [x] 6.2 Verificar pelo `/rest` e por chamada direta que um member recebe 403 em todos os procedimentos `proposals.*`

## 7. Modelos e entrada em produção

- [x] 7.1 Aplicar os marcadores de D9 no `proposta-exemplo-b.docx` (Emissor B) → `modelos/modelo-emissor-b.docx`, com logo da Emissor B na capa; verificado por renderização com docxtemplater (0 marcadores restantes). Pendente: o usuário revisa o layout no Word
- [x] 7.2.1 Trocar o logo do Cliente Exemplo da capa da Emissor A por um quadro neutro "CLIENT LOGO" e marcar "Oval 15"/"Picture 45" com `descr="client_logo"`; verificado por protótipo de troca
- [x] 7.2 Aplicar os marcadores de D9 no modelo da Emissor A → `modelos/modelo-emissor-a.docx`, removendo "Emissor C", `/Date`, o número do Annex 1, "Cliente Exemplo", "Spain" e "outro cliente" do rodapé; verificado por renderização com docxtemplater (0 marcadores restantes)
- [x] 7.3 Gerar localmente a proposta Web App (Emissor B) e a AI/LLM (Emissor A) e comparar com os documentos de exemplo: mesmas seções, valores `5.200€`/`10.000€`, sem nomes do outro emissor
- [ ] 7.4 Deploy pelo fluxo `release`, verificar que a migration rodou em produção, cadastrar emissores, modelos e serviços, definir o emissor dos clientes ativos e gerar uma proposta real de teste
- [x] 7.5 Documentar o módulo em `docs/proposals.md` (contrato de marcadores, limites, permissão) e adicionar a linha na tabela do `AGENTS.md`; verificar o link

# Proposals — read when touching `apps/api/src/proposals` or its screens

A fork-only module. It turns a deal, its client and a catalog service into a Word
proposal, filled from the issuer's own template. Nothing upstream depends on it.

## Who sees it

- **Owner only.** `canManageProposals` (`@crm/auth`) is `role === "owner"`. Every
  `proposals.*` procedure calls `ProposalAccessService.requireOwner` first, except
  `proposals.access`, which tells the UI whether to show anything.
- **The issuer of a client is read only through `proposals.*`.** `companies.*`,
  search and the agent never select `Company.issuerId`. Keep it that way: the issuer
  tells a member which company serves the client, and members must not know.

## Data

- `Issuer` → its `IssuerTemplate`s (`.docx` bytes, markers, logo slot) and default
  payment instalments.
- `Company.issuerId` — one issuer per client. Changing it never touches existing
  proposals: each `Proposal` keeps `issuerName`/`templateName` as snapshots.
- `ClientLogo` — the client's logo as PNG, in its own table so no company read
  loads the bytes.
- `Service.content` + `ServicePrice` per issuer (amount and extras).
- `Proposal` — one row per version (`@@unique([dealId, version])`), the full content
  snapshot, the generated file and an optional final file. Purging a deal deletes
  its proposals.

`content`, `lines`, `extras` and `payments` are JSON, parsed by the schemas in
`@crm/validation/proposal`. Parse at the boundary; do not reach into the JSON.

## Templates and markers

`proposal-docx.ts` fills templates with docxtemplater (`paragraphLoop`,
`linebreaks`, empty `nullGetter`). The accepted markers are `PROPOSAL_MARKERS` in
`proposal-data.ts`; an upload with any other marker is refused. The full marker
contract, with examples, is decision D9 in
`openspec/changes/gerador-de-propostas/design.md` (archived under
`openspec/changes/archive/` once done).

- **Money** is formatted by `formatEur`: `5.200€`, `1.234,50€`. Never with `Intl`.
- **Extra units** get a space when they start with a letter (`each` → `600€ each`)
  and none otherwise (`/hour` → `300€/hour`).
- **Client logo**: an image whose alt text (`wp:docPr descr`) is `client_logo` is
  the slot. After rendering, the slot's media file is replaced with the PNG the
  browser fitted to the slot's size, or with a transparent PNG when the client has
  no logo. The slot image must be a PNG; the upload refuses anything else.

## Limits

Files travel as base64 through tRPC. `PROPOSALS.files.maxBytes` (3 MB) keeps a
request under Vercel's 4.5 MB body limit. Compress images in Word before
uploading a larger template.

## The deal

Generating or changing a proposal's status never changes the deal by itself. The
UI offers it and, on confirmation, calls the ordinary `deals.update` and
`deals.setStage`, so conversion and stage rules apply as for any edit.

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProposalJurisdiction" AS ENUM ('PT', 'ES');

-- AlterTable
ALTER TABLE "company" ADD COLUMN     "issuerId" TEXT;

-- CreateTable
CREATE TABLE "issuer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "numberPrefix" TEXT NOT NULL DEFAULT '',
    "defaultPayments" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issuer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issuerTemplate" (
    "id" TEXT NOT NULL,
    "issuerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "markers" TEXT[],
    "logoSlot" JSONB,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "issuerTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientLogo" (
    "companyId" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientLogo_pkey" PRIMARY KEY ("companyId")
);

-- CreateTable
CREATE TABLE "service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicePrice" (
    "serviceId" TEXT NOT NULL,
    "issuerId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "extras" JSONB NOT NULL,

    CONSTRAINT "servicePrice_pkey" PRIMARY KEY ("serviceId","issuerId")
);

-- CreateTable
CREATE TABLE "proposal" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "issuerId" TEXT NOT NULL,
    "issuerName" TEXT NOT NULL,
    "templateId" TEXT,
    "templateName" TEXT NOT NULL,
    "serviceId" TEXT,
    "number" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "attentionContactId" TEXT,
    "attentionName" TEXT NOT NULL DEFAULT '',
    "attentionPosition" TEXT NOT NULL DEFAULT '',
    "jurisdiction" "ProposalJurisdiction" NOT NULL,
    "jurisdictionText" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "lines" JSONB NOT NULL,
    "extras" JSONB NOT NULL,
    "payments" JSONB NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedFile" BYTEA NOT NULL,
    "generatedFileName" TEXT NOT NULL,
    "finalFile" BYTEA,
    "finalFileName" TEXT,
    "finalUploadedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "issuer_name_key" ON "issuer"("name");

-- CreateIndex
CREATE INDEX "issuerTemplate_issuerId_archivedAt_idx" ON "issuerTemplate"("issuerId", "archivedAt");

-- CreateIndex
CREATE INDEX "service_archivedAt_idx" ON "service"("archivedAt");

-- CreateIndex
CREATE INDEX "servicePrice_issuerId_idx" ON "servicePrice"("issuerId");

-- CreateIndex
CREATE INDEX "proposal_issuerId_idx" ON "proposal"("issuerId");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_dealId_version_key" ON "proposal"("dealId", "version");

-- CreateIndex
CREATE INDEX "company_issuerId_idx" ON "company"("issuerId");

-- AddForeignKey
ALTER TABLE "company" ADD CONSTRAINT "company_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "issuer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issuerTemplate" ADD CONSTRAINT "issuerTemplate_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "issuer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientLogo" ADD CONSTRAINT "clientLogo_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicePrice" ADD CONSTRAINT "servicePrice_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicePrice" ADD CONSTRAINT "servicePrice_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "issuer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "issuer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "issuerTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

import { Module } from "@nestjs/common";
import { TrpcModule } from "../trpc/trpc.module";
import { CatalogService } from "./catalog.service";
import { IssuersService } from "./issuers.service";
import { ProposalAccessService } from "./proposal-access.service";
import { ProposalsRouter } from "./proposals.router";
import { ProposalsService } from "./proposals.service";

@Module({
	imports: [TrpcModule],
	providers: [
		ProposalAccessService,
		IssuersService,
		CatalogService,
		ProposalsService,
		ProposalsRouter,
	],
})
export class ProposalsModule {}

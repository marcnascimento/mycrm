import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import type { z } from "zod";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import { CatalogService } from "./catalog.service";
import { IssuersService } from "./issuers.service";
import { ProposalAccessService } from "./proposal-access.service";
import { PROPOSALS } from "./proposals.config";
import {
	accessOutput,
	companyInput,
	companyProfileOutput,
	createIssuerInput,
	dealInput,
	dealProposalsOutput,
	downloadInput,
	draftInput,
	draftOutput,
	fileOutput,
	generateInput,
	generateOutput,
	idInput,
	issuersOutput,
	listServicesInput,
	okOutput,
	saveServiceInput,
	serviceOutput,
	servicesOutput,
	setClientLogoInput,
	setCompanyIssuerInput,
	setStatusInput,
	setStatusOutput,
	templateOutput,
	updateIssuerInput,
	uploadFinalInput,
	uploadTemplateInput,
} from "./proposals.contracts";
import { ProposalsService } from "./proposals.service";

const TAGS = ["Proposals"];

@Router({ alias: "proposals" })
@UseMiddlewares(AuthMiddleware)
export class ProposalsRouter {
	constructor(
		@Inject(ProposalAccessService)
		private readonly gate: ProposalAccessService,
		@Inject(IssuersService) private readonly issuerService: IssuersService,
		@Inject(CatalogService) private readonly catalog: CatalogService,
		@Inject(ProposalsService) private readonly proposals: ProposalsService,
	) {}

	@Query({
		output: accessOutput,
		meta: restMeta("GET", "/proposals/access", TAGS),
	})
	async access(@Ctx() ctx: AuthedTrpcContext) {
		return {
			canManage: await this.gate.canManage(ctx.user.id),
			maxFileBytes: PROPOSALS.files.maxBytes,
			maxLogoBytes: PROPOSALS.logo.maxBytes,
		};
	}

	@Query({
		output: issuersOutput,
		meta: restMeta("GET", "/proposals/issuers", TAGS),
	})
	async issuers(@Ctx() ctx: AuthedTrpcContext) {
		await this.gate.requireOwner(ctx.user.id);
		return this.issuerService.list();
	}

	@Mutation({
		input: createIssuerInput,
		output: idInput,
		meta: restMeta("POST", "/proposals/issuers", TAGS),
	})
	async createIssuer(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof createIssuerInput>,
	) {
		await this.gate.requireOwner(ctx.user.id);
		return this.issuerService.create(input);
	}

	@Mutation({
		input: updateIssuerInput,
		output: idInput,
		meta: restMeta("PATCH", "/proposals/issuers/{id}", TAGS),
	})
	async updateIssuer(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updateIssuerInput>,
	) {
		await this.gate.requireOwner(ctx.user.id);
		return this.issuerService.update(input);
	}

	@Mutation({
		input: idInput,
		output: okOutput,
		meta: restMeta("DELETE", "/proposals/issuers/{id}", TAGS),
	})
	async deleteIssuer(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof idInput>,
	) {
		await this.gate.requireOwner(ctx.user.id);
		return this.issuerService.remove(input.id);
	}

	@Mutation({
		input: uploadTemplateInput,
		output: templateOutput,
		meta: restMeta("POST", "/proposals/templates", TAGS),
	})
	async uploadTemplate(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof uploadTemplateInput>,
	) {
		await this.gate.requireOwner(ctx.user.id);
		return this.issuerService.uploadTemplate(ctx.user.id, input);
	}

	@Mutation({
		input: idInput,
		output: okOutput,
		meta: restMeta("POST", "/proposals/templates/{id}/archive", TAGS),
	})
	async archiveTemplate(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof idInput>,
	) {
		await this.gate.requireOwner(ctx.user.id);
		return this.issuerService.archiveTemplate(input.id);
	}

	@Query({
		input: idInput,
		output: fileOutput,
		meta: restMeta("GET", "/proposals/templates/{id}/file", TAGS),
	})
	async downloadTemplate(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof idInput>,
	) {
		await this.gate.requireOwner(ctx.user.id);
		return this.issuerService.downloadTemplate(input.id);
	}

	@Query({
		input: companyInput,
		output: companyProfileOutput,
		meta: restMeta("GET", "/proposals/companies/{companyId}", TAGS),
	})
	async companyProfile(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof companyInput>,
	) {
		await this.gate.requireOwner(ctx.user.id);
		return this.issuerService.companyProfile(input.companyId);
	}

	@Mutation({
		input: setCompanyIssuerInput,
		output: companyProfileOutput,
		meta: restMeta("PUT", "/proposals/companies/{companyId}/issuer", TAGS),
	})
	async setCompanyIssuer(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof setCompanyIssuerInput>,
	) {
		await this.gate.requireOwner(ctx.user.id);
		return this.issuerService.setCompanyIssuer(input.companyId, input.issuerId);
	}

	@Mutation({
		input: setClientLogoInput,
		output: companyProfileOutput,
		meta: restMeta("PUT", "/proposals/companies/{companyId}/logo", TAGS),
	})
	async setClientLogo(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof setClientLogoInput>,
	) {
		await this.gate.requireOwner(ctx.user.id);
		return this.issuerService.setClientLogo(ctx.user.id, input);
	}

	@Mutation({
		input: companyInput,
		output: companyProfileOutput,
		meta: restMeta("DELETE", "/proposals/companies/{companyId}/logo", TAGS),
	})
	async removeClientLogo(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof companyInput>,
	) {
		await this.gate.requireOwner(ctx.user.id);
		return this.issuerService.removeClientLogo(input.companyId);
	}

	@Query({
		input: listServicesInput,
		output: servicesOutput,
		meta: restMeta("GET", "/proposals/services", TAGS),
	})
	async services(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof listServicesInput>,
	) {
		await this.gate.requireOwner(ctx.user.id);
		return this.catalog.list(input.archived);
	}

	@Query({
		input: idInput,
		output: serviceOutput,
		meta: restMeta("GET", "/proposals/services/{id}", TAGS),
	})
	async service(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof idInput>,
	) {
		await this.gate.requireOwner(ctx.user.id);
		return this.catalog.byId(input.id);
	}

	@Mutation({
		input: saveServiceInput,
		output: serviceOutput,
		meta: restMeta("PUT", "/proposals/services", TAGS),
	})
	async saveService(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof saveServiceInput>,
	) {
		await this.gate.requireOwner(ctx.user.id);
		return this.catalog.save(input);
	}

	@Mutation({
		input: idInput,
		output: okOutput,
		meta: restMeta("POST", "/proposals/services/{id}/archive", TAGS),
	})
	async archiveService(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof idInput>,
	) {
		await this.gate.requireOwner(ctx.user.id);
		return this.catalog.setArchived(input.id, true);
	}

	@Mutation({
		input: idInput,
		output: okOutput,
		meta: restMeta("POST", "/proposals/services/{id}/restore", TAGS),
	})
	async restoreService(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof idInput>,
	) {
		await this.gate.requireOwner(ctx.user.id);
		return this.catalog.setArchived(input.id, false);
	}

	@Query({
		input: dealInput,
		output: dealProposalsOutput,
		meta: restMeta("GET", "/proposals/deals/{dealId}", TAGS),
	})
	async forDeal(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof dealInput>,
	) {
		await this.gate.requireOwner(ctx.user.id);
		return this.proposals.forDeal(input.dealId);
	}

	@Query({
		input: draftInput,
		output: draftOutput,
		meta: restMeta("GET", "/proposals/deals/{dealId}/draft", TAGS),
	})
	async draft(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof draftInput>,
	) {
		await this.gate.requireOwner(ctx.user.id);
		return this.proposals.draft(input);
	}

	@Mutation({
		input: generateInput,
		output: generateOutput,
		meta: restMeta("POST", "/proposals/deals/{dealId}/generate", TAGS),
	})
	async generate(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof generateInput>,
	) {
		await this.gate.requireOwner(ctx.user.id);
		return this.proposals.generate(ctx.user.id, input);
	}

	@Query({
		input: downloadInput,
		output: fileOutput,
		meta: restMeta("GET", "/proposals/{id}/file", TAGS),
	})
	async download(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof downloadInput>,
	) {
		await this.gate.requireOwner(ctx.user.id);
		return this.proposals.download(input.id, input.which);
	}

	@Mutation({
		input: uploadFinalInput,
		output: okOutput,
		meta: restMeta("PUT", "/proposals/{id}/final", TAGS),
	})
	async uploadFinal(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof uploadFinalInput>,
	) {
		await this.gate.requireOwner(ctx.user.id);
		return this.proposals.uploadFinal(input);
	}

	@Mutation({
		input: setStatusInput,
		output: setStatusOutput,
		meta: restMeta("PATCH", "/proposals/{id}/status", TAGS),
	})
	async setStatus(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof setStatusInput>,
	) {
		await this.gate.requireOwner(ctx.user.id);
		return this.proposals.setStatus(input.id, input.status);
	}
}

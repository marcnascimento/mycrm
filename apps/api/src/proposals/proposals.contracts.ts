import {
	eurAmount,
	proposalContent,
	proposalExtras,
	proposalJurisdiction,
	proposalLines,
	proposalPayments,
} from "@crm/validation/proposal";
import { z } from "zod";
import { PROPOSALS } from "./proposals.config";

const id = z.string().trim().min(1);

const base64 = (maxBytes: number) =>
	z
		.string()
		.min(1)
		.max(Math.ceil((maxBytes * 4) / 3) + 4, "The file is too large.")
		.regex(
			/^(?:[A-Za-z\d+/]{4})*(?:[A-Za-z\d+/]{2}==|[A-Za-z\d+/]{3}=)?$/,
			"The file content must be valid base64.",
		);

const fileName = z.string().trim().min(1).max(200);

const PROPOSAL_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED"] as const;

const DEAL_STAGE_SUGGESTIONS = ["CONTRACT_SENT", "CLOSED_WON"] as const;

export const accessOutput = z.object({
	canManage: z.boolean(),
	maxFileBytes: z.number(),
	maxLogoBytes: z.number(),
});

const issuerInput = z.object({
	name: z.string().trim().min(1).max(120),
	numberPrefix: z.string().trim().max(40).default(""),
	defaultPayments: proposalPayments,
});

export const createIssuerInput = issuerInput;

export const updateIssuerInput = issuerInput.extend({
	id,
	active: z.boolean(),
});

export const idInput = z.object({ id });

const logoSlotOutput = z
	.object({ width: z.number(), height: z.number() })
	.nullable();

export const templateOutput = z.object({
	id: z.string(),
	name: z.string(),
	fileName: z.string(),
	size: z.number(),
	markers: z.array(z.string()),
	logoSlot: logoSlotOutput,
	createdAt: z.string(),
	archived: z.boolean(),
});

export type TemplateOutput = z.infer<typeof templateOutput>;

const issuerOutput = z.object({
	id: z.string(),
	name: z.string(),
	numberPrefix: z.string(),
	defaultPayments: z.array(
		z.object({ percent: z.number(), label: z.string() }),
	),
	active: z.boolean(),
	clients: z.number(),
	proposals: z.number(),
	templates: z.array(templateOutput),
});

export type IssuerOutput = z.infer<typeof issuerOutput>;

export const issuersOutput = z.array(issuerOutput);

export const uploadTemplateInput = z.object({
	issuerId: id,
	name: z.string().trim().min(1).max(120),
	fileName,
	contentBase64: base64(PROPOSALS.files.maxBytes),
});

export const fileOutput = z.object({
	fileName: z.string(),
	contentBase64: z.string(),
});

export const companyInput = z.object({ companyId: id });

export const companyProfileOutput = z.object({
	companyId: z.string(),
	issuerId: z.string().nullable(),
	issuerName: z.string().nullable(),
	proposals: z.number(),
	logo: z
		.object({
			contentBase64: z.string(),
			width: z.number(),
			height: z.number(),
		})
		.nullable(),
});

export type CompanyProfileOutput = z.infer<typeof companyProfileOutput>;

export const setCompanyIssuerInput = z.object({
	companyId: id,
	issuerId: id.nullable(),
});

export const setClientLogoInput = z.object({
	companyId: id,
	contentBase64: base64(PROPOSALS.logo.maxBytes),
});

const priceInput = z.object({
	issuerId: id,
	amount: eurAmount,
	extras: proposalExtras,
});

export const saveServiceInput = z.object({
	id: id.optional(),
	name: z.string().trim().min(1).max(200),
	content: proposalContent,
	prices: z.array(priceInput).max(20),
});

const priceOutput = z.object({
	issuerId: z.string(),
	issuerName: z.string(),
	amount: z.string(),
	extras: z.array(
		z.object({ label: z.string(), price: z.string(), unit: z.string() }),
	),
});

const serviceSummaryOutput = z.object({
	id: z.string(),
	name: z.string(),
	archived: z.boolean(),
	prices: z.array(priceOutput),
	updatedAt: z.string(),
});

export const servicesOutput = z.array(serviceSummaryOutput);

export const serviceOutput = serviceSummaryOutput.extend({
	content: proposalContent,
});

export type ServiceOutput = z.infer<typeof serviceOutput>;

export const listServicesInput = z.object({
	archived: z.boolean().default(false),
});

export const dealInput = z.object({ dealId: id });

const versionOutput = z.object({
	id: z.string(),
	version: z.number(),
	number: z.string(),
	date: z.string(),
	status: z.enum(PROPOSAL_STATUSES),
	statusChangedAt: z.string(),
	total: z.string(),
	issuerName: z.string(),
	templateName: z.string(),
	generatedFileName: z.string(),
	finalFileName: z.string().nullable(),
	finalUploadedAt: z.string().nullable(),
	createdAt: z.string(),
	createdByName: z.string().nullable(),
});

export type VersionOutput = z.infer<typeof versionOutput>;

export const dealProposalsOutput = z.object({
	companyId: z.string(),
	companyName: z.string(),
	issuer: z.object({ id: z.string(), name: z.string() }).nullable(),
	hasLogo: z.boolean(),
	versions: z.array(versionOutput),
});

export const draftInput = z.object({
	dealId: id,
	serviceId: id.optional(),
	fromProposalId: id.optional(),
});

const draftTemplateOutput = z.object({
	id: z.string(),
	name: z.string(),
	logoSlot: logoSlotOutput,
});

export const draftOutput = z.object({
	dealId: z.string(),
	serviceId: z.string().nullable(),
	issuer: z.object({ id: z.string(), name: z.string() }),
	clientName: z.string(),
	templates: z.array(draftTemplateOutput),
	contacts: z.array(
		z.object({ id: z.string(), name: z.string(), title: z.string() }),
	),
	number: z.string(),
	date: z.string(),
	attentionContactId: z.string().nullable(),
	attentionName: z.string(),
	attentionPosition: z.string(),
	jurisdiction: proposalJurisdiction,
	jurisdictionText: z.string(),
	jurisdictionTexts: z.object({ PT: z.string(), ES: z.string() }),
	content: proposalContent,
	lines: proposalLines,
	extras: proposalExtras,
	payments: proposalPayments,
});

export type DraftOutput = z.infer<typeof draftOutput>;

export const generateInput = z.object({
	dealId: id,
	serviceId: id.nullable(),
	templateId: id,
	number: z.string().trim().min(1).max(120),
	date: z.iso.date(),
	attentionContactId: id.nullable(),
	attentionName: z.string().trim().max(200).default(""),
	attentionPosition: z.string().trim().max(200).default(""),
	jurisdiction: proposalJurisdiction,
	jurisdictionText: z.string().trim().min(1).max(1000),
	content: proposalContent,
	lines: proposalLines,
	extras: proposalExtras,
	payments: proposalPayments,
	logoBase64: base64(PROPOSALS.logo.maxBytes).nullable(),
});

export type GenerateInput = z.infer<typeof generateInput>;

export const generateOutput = z.object({
	id: z.string(),
	version: z.number(),
	total: z.string(),
	fileName: z.string(),
	contentBase64: z.string(),
});

export const downloadInput = z.object({
	id,
	which: z.enum(["preferred", "generated", "final"]).default("preferred"),
});

export const uploadFinalInput = z.object({
	id,
	fileName,
	contentBase64: base64(PROPOSALS.files.maxBytes),
});

export const setStatusInput = z.object({
	id,
	status: z.enum(PROPOSAL_STATUSES),
});

export const setStatusOutput = z.object({
	id: z.string(),
	dealId: z.string(),
	status: z.enum(PROPOSAL_STATUSES),
	suggestion: z.object({
		stage: z.enum(DEAL_STAGE_SUGGESTIONS).nullable(),
		amountCents: z.number().nullable(),
		currency: z.literal(PROPOSALS.format.currency).nullable(),
	}),
});

export const okOutput = z.object({ ok: z.literal(true) });

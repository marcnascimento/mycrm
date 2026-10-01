import type { Db, JsonValue, ProposalStatus } from "@crm/db";
import {
	type ProposalContent,
	type ProposalJurisdiction,
	parseProposalContent,
	parseProposalExtras,
	parseProposalLines,
	parseProposalPayments,
	readProposalLogoSlot,
} from "@crm/validation/proposal";
import {
	BadRequestException,
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { toBytes } from "./issuers.service";
import { prismaCode } from "./prisma-code";
import {
	proposalTotalCents,
	type TemplateData,
	templateData,
} from "./proposal-data";
import { imageSize, renderProposal, TemplateError } from "./proposal-docx";
import { centsToDecimal } from "./proposal-format";
import { PROPOSALS } from "./proposals.config";
import type {
	DraftOutput,
	GenerateInput,
	VersionOutput,
} from "./proposals.contracts";

const VERSION_SELECT = {
	id: true,
	version: true,
	number: true,
	date: true,
	status: true,
	statusChangedAt: true,
	total: true,
	issuerName: true,
	templateName: true,
	generatedFileName: true,
	finalFileName: true,
	finalUploadedAt: true,
	createdAt: true,
	createdById: true,
} as const;

function stageFor(
	status: ProposalStatus,
): "CONTRACT_SENT" | "CLOSED_WON" | null {
	if (status === "SENT") return "CONTRACT_SENT";
	if (status === "ACCEPTED") return "CLOSED_WON";
	return null;
}

function isoDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function contactName(contact: {
	firstName: string;
	lastName: string | null;
}): string {
	return [contact.firstName, contact.lastName].filter(Boolean).join(" ");
}

function safeFileName(value: string): string {
	return value
		.replace(/[\\/:*?"<>|]+/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 150);
}

function defaultJurisdiction(countryCode: string | null): ProposalJurisdiction {
	return countryCode?.toUpperCase() === "ES" ? "ES" : "PT";
}

function isPng(bytes: Buffer): boolean {
	return bytes[1] === 0x50 && imageSize(bytes) !== null;
}

@Injectable()
export class ProposalsService {
	private readonly logger = new Logger(ProposalsService.name);

	constructor(@InjectDatabase() private readonly db: Db) {}

	async forDeal(dealId: string) {
		const deal = await this.db.deal.findUnique({
			where: { id: dealId },
			select: {
				company: {
					select: {
						id: true,
						name: true,
						issuer: { select: { id: true, name: true } },
						proposalLogo: { select: { companyId: true } },
					},
				},
				proposals: { select: VERSION_SELECT, orderBy: { version: "desc" } },
			},
		});

		if (!deal) throw new NotFoundException(`No deal with id ${dealId}.`);

		return {
			companyId: deal.company.id,
			companyName: deal.company.name,
			issuer: deal.company.issuer,
			hasLogo: deal.company.proposalLogo !== null,
			versions: await this.toVersions(deal.proposals),
		};
	}

	private async toVersions(
		rows: Array<{
			id: string;
			version: number;
			number: string;
			date: Date;
			status: ProposalStatus;
			statusChangedAt: Date;
			total: { toFixed(digits: number): string };
			issuerName: string;
			templateName: string;
			generatedFileName: string;
			finalFileName: string | null;
			finalUploadedAt: Date | null;
			createdAt: Date;
			createdById: string;
		}>,
	): Promise<VersionOutput[]> {
		const authorIds = [...new Set(rows.map((row) => row.createdById))];
		const authors = await this.db.user.findMany({
			where: { id: { in: authorIds } },
			select: { id: true, name: true },
		});
		const nameOf = new Map(authors.map((author) => [author.id, author.name]));

		return rows.map((row) => ({
			id: row.id,
			version: row.version,
			number: row.number,
			date: isoDate(row.date),
			status: row.status,
			statusChangedAt: row.statusChangedAt.toISOString(),
			total: row.total.toFixed(2),
			issuerName: row.issuerName,
			templateName: row.templateName,
			generatedFileName: row.generatedFileName,
			finalFileName: row.finalFileName,
			finalUploadedAt: row.finalUploadedAt?.toISOString() ?? null,
			createdAt: row.createdAt.toISOString(),
			createdByName: nameOf.get(row.createdById) ?? null,
		}));
	}

	private async dealContext(dealId: string) {
		const deal = await this.db.deal.findUnique({
			where: { id: dealId },
			select: {
				id: true,
				company: {
					select: {
						name: true,
						countryCode: true,
						issuer: {
							select: {
								id: true,
								name: true,
								active: true,
								numberPrefix: true,
								defaultPayments: true,
								templates: {
									where: { archivedAt: null },
									select: { id: true, name: true, logoSlot: true },
									orderBy: { createdAt: "desc" },
								},
							},
						},
					},
				},
				contacts: {
					select: {
						contact: {
							select: {
								id: true,
								firstName: true,
								lastName: true,
								title: true,
							},
						},
					},
					orderBy: { contact: { firstName: "asc" } },
				},
			},
		});

		if (!deal) throw new NotFoundException(`No deal with id ${dealId}.`);

		const issuer = deal.company.issuer;
		if (!issuer) {
			throw new BadRequestException(
				"Set the issuer of this client before creating a proposal.",
			);
		}
		if (!issuer.active) {
			throw new BadRequestException(
				`The issuer ${issuer.name} is deactivated. Choose another issuer for this client.`,
			);
		}

		return { deal, issuer };
	}

	async draft(input: {
		dealId: string;
		serviceId?: string;
		fromProposalId?: string;
	}): Promise<DraftOutput> {
		const { deal, issuer } = await this.dealContext(input.dealId);
		const contacts = deal.contacts.map(({ contact }) => ({
			id: contact.id,
			name: contactName(contact),
			title: contact.title ?? "",
		}));
		const first = contacts[0];

		const base = {
			dealId: deal.id,
			issuer: { id: issuer.id, name: issuer.name },
			clientName: deal.company.name,
			templates: issuer.templates.map((template) => ({
				id: template.id,
				name: template.name,
				logoSlot: readProposalLogoSlot(template.logoSlot),
			})),
			contacts,
			date: isoDate(new Date()),
			jurisdictionTexts: { ...PROPOSALS.jurisdictions },
		};

		if (input.fromProposalId) {
			const previous = await this.db.proposal.findFirst({
				where: { id: input.fromProposalId, dealId: deal.id },
			});
			if (!previous) {
				throw new NotFoundException(
					`No proposal with id ${input.fromProposalId} on this deal.`,
				);
			}

			return {
				...base,
				serviceId: previous.serviceId,
				number: previous.number,
				attentionContactId: previous.attentionContactId,
				attentionName: previous.attentionName,
				attentionPosition: previous.attentionPosition,
				jurisdiction: previous.jurisdiction,
				jurisdictionText: previous.jurisdictionText,
				content: parseProposalContent(previous.content),
				lines: parseProposalLines(previous.lines),
				extras: parseProposalExtras(previous.extras),
				payments: parseProposalPayments(previous.payments),
			};
		}

		if (!input.serviceId) {
			throw new BadRequestException("Choose a service or a previous version.");
		}

		const service = await this.db.service.findUnique({
			where: { id: input.serviceId },
			select: {
				id: true,
				archivedAt: true,
				content: true,
				prices: {
					where: { issuerId: issuer.id },
					select: { amount: true, extras: true },
				},
			},
		});

		if (!service || service.archivedAt) {
			throw new NotFoundException(`No service with id ${input.serviceId}.`);
		}

		const price = service.prices[0];
		if (!price) {
			throw new BadRequestException(
				`This service has no price for ${issuer.name}.`,
			);
		}

		const content: ProposalContent = parseProposalContent(service.content);
		const jurisdiction = defaultJurisdiction(deal.company.countryCode);

		return {
			...base,
			serviceId: service.id,
			number: issuer.numberPrefix,
			attentionContactId: first?.id ?? null,
			attentionName: first?.name ?? "",
			attentionPosition: first?.title ?? "",
			jurisdiction,
			jurisdictionText: PROPOSALS.jurisdictions[jurisdiction],
			content,
			lines: [{ description: content.title, amount: price.amount.toFixed(2) }],
			extras: parseProposalExtras(price.extras),
			payments: this.issuerPayments(issuer.defaultPayments),
		};
	}

	private issuerPayments(value: JsonValue) {
		try {
			return parseProposalPayments(value);
		} catch {
			return [{ percent: 100, label: "upon acceptance" }];
		}
	}

	async generate(userId: string, input: GenerateInput) {
		const { deal, issuer } = await this.dealContext(input.dealId);

		const template = await this.db.issuerTemplate.findFirst({
			where: { id: input.templateId, issuerId: issuer.id, archivedAt: null },
			select: { id: true, name: true, content: true, logoSlot: true },
		});
		if (!template) {
			throw new BadRequestException(
				`That template does not belong to ${issuer.name}.`,
			);
		}

		if (
			input.attentionContactId &&
			!deal.contacts.some(
				({ contact }) => contact.id === input.attentionContactId,
			)
		) {
			throw new BadRequestException("The A/C contact is not on this deal.");
		}

		const logo = input.logoBase64
			? Buffer.from(input.logoBase64, "base64")
			: null;
		if (logo && !isPng(logo)) {
			throw new BadRequestException("The client logo must be a PNG image.");
		}

		const date = new Date(`${input.date}T00:00:00.000Z`);
		const totalCents = proposalTotalCents(input.lines);
		const file = this.render(
			Buffer.from(template.content),
			templateData({
				date,
				number: input.number,
				clientName: deal.company.name,
				attentionName: input.attentionName,
				attentionPosition: input.attentionPosition,
				jurisdictionText: input.jurisdictionText,
				content: input.content,
				lines: input.lines,
				extras: input.extras,
				payments: input.payments,
			}),
			readProposalLogoSlot(template.logoSlot) ? logo : null,
		);

		const created = await this.insertVersion(deal.id, (version) => ({
			dealId: deal.id,
			version,
			issuerId: issuer.id,
			issuerName: issuer.name,
			templateId: template.id,
			templateName: template.name,
			serviceId: input.serviceId,
			number: input.number,
			date,
			attentionContactId: input.attentionContactId,
			attentionName: input.attentionName,
			attentionPosition: input.attentionPosition,
			jurisdiction: input.jurisdiction,
			jurisdictionText: input.jurisdictionText,
			content: input.content,
			lines: input.lines,
			extras: input.extras,
			payments: input.payments,
			total: centsToDecimal(totalCents),
			generatedFile: toBytes(file),
			generatedFileName: `${safeFileName(
				`${input.number} ${deal.company.name} v${version}`,
			)}.docx`,
			createdById: userId,
		}));

		this.logger.log({
			message: "Proposal generated",
			proposalId: created.id,
			dealId: deal.id,
			version: created.version,
			issuerId: issuer.id,
			templateId: template.id,
			bytes: file.length,
		});

		return {
			id: created.id,
			version: created.version,
			total: centsToDecimal(totalCents),
			fileName: created.generatedFileName,
			contentBase64: file.toString("base64"),
		};
	}

	private render(
		template: Buffer,
		data: TemplateData,
		logo: Buffer | null,
	): Buffer {
		try {
			return renderProposal(template, data, logo);
		} catch (cause) {
			if (cause instanceof TemplateError) {
				throw new BadRequestException(
					[cause.message, ...cause.details].join(" "),
				);
			}
			throw cause;
		}
	}

	private async insertVersion<
		Data extends Parameters<Db["proposal"]["create"]>[0]["data"],
	>(dealId: string, build: (version: number) => Data) {
		for (let attempt = 0; attempt < 3; attempt += 1) {
			const last = await this.db.proposal.aggregate({
				where: { dealId },
				_max: { version: true },
			});
			const version = (last._max.version ?? 0) + 1;

			try {
				return await this.db.proposal.create({
					data: build(version),
					select: { id: true, version: true, generatedFileName: true },
				});
			} catch (cause) {
				if (prismaCode(cause) !== "P2002") throw cause;
			}
		}

		throw new ConflictException(
			"Another version was saved at the same time. Try again.",
		);
	}

	async download(id: string, which: "preferred" | "generated" | "final") {
		const row = await this.db.proposal.findUnique({
			where: { id },
			select: {
				generatedFile: true,
				generatedFileName: true,
				finalFile: true,
				finalFileName: true,
			},
		});
		if (!row) throw new NotFoundException(`No proposal with id ${id}.`);

		const wantsFinal =
			which === "final" || (which === "preferred" && row.finalFile !== null);

		if (wantsFinal) {
			if (!row.finalFile || !row.finalFileName) {
				throw new NotFoundException("This version has no final file.");
			}
			return {
				fileName: row.finalFileName,
				contentBase64: Buffer.from(row.finalFile).toString("base64"),
			};
		}

		return {
			fileName: row.generatedFileName,
			contentBase64: Buffer.from(row.generatedFile).toString("base64"),
		};
	}

	async uploadFinal(input: {
		id: string;
		fileName: string;
		contentBase64: string;
	}) {
		if (!input.fileName.toLowerCase().endsWith(".docx")) {
			throw new BadRequestException(
				"Only Word documents (.docx) are accepted.",
			);
		}

		const content = Buffer.from(input.contentBase64, "base64");
		if (content[0] !== 0x50 || content[1] !== 0x4b) {
			throw new BadRequestException("The file is not a Word document (.docx).");
		}

		try {
			await this.db.proposal.update({
				where: { id: input.id },
				data: {
					finalFile: toBytes(content),
					finalFileName: safeFileName(input.fileName),
					finalUploadedAt: new Date(),
				},
				select: { id: true },
			});
		} catch (cause) {
			if (prismaCode(cause) === "P2025") {
				throw new NotFoundException(`No proposal with id ${input.id}.`);
			}
			throw cause;
		}

		return { ok: true as const };
	}

	async setStatus(id: string, status: ProposalStatus) {
		const current = await this.db.proposal.findUnique({
			where: { id },
			select: { status: true },
		});
		if (!current) throw new NotFoundException(`No proposal with id ${id}.`);

		const row = await this.db.proposal.update({
			where: { id },
			data:
				current.status === status
					? {}
					: { status, statusChangedAt: new Date() },
			select: { id: true, dealId: true, status: true, total: true },
		});

		const stage = stageFor(status);
		const offersAmount = status === "ACCEPTED";

		return {
			id: row.id,
			dealId: row.dealId,
			status: row.status,
			suggestion: {
				stage,
				amountCents: offersAmount
					? Math.round(row.total.toNumber() * 100)
					: null,
				currency: offersAmount ? PROPOSALS.format.currency : null,
			},
		};
	}
}

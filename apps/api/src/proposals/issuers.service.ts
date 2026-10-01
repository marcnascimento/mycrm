import type { Db, JsonValue } from "@crm/db";
import {
	type ProposalPayment,
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
import type { z } from "zod";
import { InjectDatabase } from "../database/database.constants";
import { prismaCode } from "./prisma-code";
import {
	imageSize,
	inspectTemplate,
	type LogoSlot,
	TemplateError,
} from "./proposal-docx";
import type {
	CompanyProfileOutput,
	createIssuerInput,
	IssuerOutput,
	setClientLogoInput,
	TemplateOutput,
	updateIssuerInput,
	uploadTemplateInput,
} from "./proposals.contracts";

const TEMPLATE_SELECT = {
	id: true,
	name: true,
	fileName: true,
	size: true,
	markers: true,
	logoSlot: true,
	createdAt: true,
	archivedAt: true,
} as const;

type TemplateRow = {
	id: string;
	name: string;
	fileName: string;
	size: number;
	markers: string[];
	logoSlot: JsonValue;
	createdAt: Date;
	archivedAt: Date | null;
};

function toTemplate(row: TemplateRow): TemplateOutput {
	return {
		id: row.id,
		name: row.name,
		fileName: row.fileName,
		size: row.size,
		markers: row.markers,
		logoSlot: readProposalLogoSlot(row.logoSlot),
		createdAt: row.createdAt.toISOString(),
		archived: row.archivedAt !== null,
	};
}

function decode(contentBase64: string): Buffer {
	return Buffer.from(contentBase64, "base64");
}

export function toBytes(buffer: Buffer): Uint8Array<ArrayBuffer> {
	return new Uint8Array(buffer);
}

@Injectable()
export class IssuersService {
	private readonly logger = new Logger(IssuersService.name);

	constructor(@InjectDatabase() private readonly db: Db) {}

	async list(): Promise<IssuerOutput[]> {
		const rows = await this.db.issuer.findMany({
			orderBy: { name: "asc" },
			include: {
				templates: {
					select: TEMPLATE_SELECT,
					orderBy: { createdAt: "desc" },
				},
				_count: { select: { companies: true, proposals: true } },
			},
		});

		return rows.map((row) => ({
			id: row.id,
			name: row.name,
			numberPrefix: row.numberPrefix,
			defaultPayments: this.payments(row.defaultPayments),
			active: row.active,
			clients: row._count.companies,
			proposals: row._count.proposals,
			templates: row.templates.map(toTemplate),
		}));
	}

	private payments(value: JsonValue): ProposalPayment[] {
		try {
			return parseProposalPayments(value);
		} catch {
			return [];
		}
	}

	async create(input: z.infer<typeof createIssuerInput>) {
		try {
			const issuer = await this.db.issuer.create({
				data: {
					name: input.name,
					numberPrefix: input.numberPrefix,
					defaultPayments: input.defaultPayments,
				},
				select: { id: true },
			});
			this.logger.log({ message: "Issuer created", issuerId: issuer.id });
			return issuer;
		} catch (cause) {
			if (prismaCode(cause) === "P2002") {
				throw new ConflictException(`An issuer named ${input.name} exists.`);
			}
			throw cause;
		}
	}

	async update(input: z.infer<typeof updateIssuerInput>) {
		try {
			return await this.db.issuer.update({
				where: { id: input.id },
				data: {
					name: input.name,
					numberPrefix: input.numberPrefix,
					defaultPayments: input.defaultPayments,
					active: input.active,
				},
				select: { id: true },
			});
		} catch (cause) {
			if (prismaCode(cause) === "P2002") {
				throw new ConflictException(`An issuer named ${input.name} exists.`);
			}
			if (prismaCode(cause) === "P2025") {
				throw new NotFoundException(`No issuer with id ${input.id}.`);
			}
			throw cause;
		}
	}

	async remove(id: string) {
		const issuer = await this.db.issuer.findUnique({
			where: { id },
			select: {
				_count: {
					select: {
						companies: true,
						proposals: true,
						prices: true,
						templates: true,
					},
				},
			},
		});

		if (!issuer) throw new NotFoundException(`No issuer with id ${id}.`);

		const { companies, proposals, prices, templates } = issuer._count;
		if (companies + proposals + prices + templates > 0) {
			throw new ConflictException(
				"This issuer is in use by clients, prices, templates or proposals. Deactivate it instead.",
			);
		}

		await this.db.issuer.delete({ where: { id } });
		return { ok: true as const };
	}

	async uploadTemplate(
		userId: string,
		input: z.infer<typeof uploadTemplateInput>,
	): Promise<TemplateOutput> {
		if (!input.fileName.toLowerCase().endsWith(".docx")) {
			throw new BadRequestException(
				"Only Word documents (.docx) are accepted.",
			);
		}

		const issuer = await this.db.issuer.findUnique({
			where: { id: input.issuerId },
			select: { id: true },
		});
		if (!issuer) {
			throw new NotFoundException(`No issuer with id ${input.issuerId}.`);
		}

		const content = decode(input.contentBase64);
		const inspection = this.inspect(content);

		if (inspection.unknown.length > 0) {
			throw new BadRequestException(
				`The template uses markers this CRM does not know: ${inspection.unknown
					.map((marker) => `{${marker}}`)
					.join(", ")}.`,
			);
		}

		const row = await this.db.issuerTemplate.create({
			data: {
				issuerId: input.issuerId,
				name: input.name,
				fileName: input.fileName,
				content: toBytes(content),
				size: content.length,
				markers: inspection.markers,
				logoSlot: inspection.logoSlot ?? undefined,
				uploadedById: userId,
			},
			select: TEMPLATE_SELECT,
		});

		this.logger.log({
			message: "Proposal template uploaded",
			templateId: row.id,
			issuerId: input.issuerId,
			markers: inspection.markers.length,
			logoSlot: inspection.logoSlot !== null,
		});

		return toTemplate(row);
	}

	private inspect(content: Buffer) {
		try {
			return inspectTemplate(content);
		} catch (cause) {
			if (cause instanceof TemplateError) {
				throw new BadRequestException(
					[cause.message, ...cause.details].join(" "),
				);
			}
			throw cause;
		}
	}

	async archiveTemplate(id: string) {
		const updated = await this.db.issuerTemplate.updateMany({
			where: { id, archivedAt: null },
			data: { archivedAt: new Date() },
		});
		if (updated.count === 0) {
			const exists = await this.db.issuerTemplate.count({ where: { id } });
			if (!exists) throw new NotFoundException(`No template with id ${id}.`);
		}
		return { ok: true as const };
	}

	async downloadTemplate(id: string) {
		const row = await this.db.issuerTemplate.findUnique({
			where: { id },
			select: { fileName: true, content: true },
		});
		if (!row) throw new NotFoundException(`No template with id ${id}.`);
		return {
			fileName: row.fileName,
			contentBase64: Buffer.from(row.content).toString("base64"),
		};
	}

	async companyProfile(companyId: string): Promise<CompanyProfileOutput> {
		const company = await this.db.company.findUnique({
			where: { id: companyId },
			select: {
				id: true,
				issuerId: true,
				issuer: { select: { name: true } },
				proposalLogo: { select: { content: true, width: true, height: true } },
			},
		});

		if (!company)
			throw new NotFoundException(`No company with id ${companyId}.`);

		const proposals = await this.db.proposal.count({
			where: { deal: { companyId } },
		});

		return {
			companyId: company.id,
			issuerId: company.issuerId,
			issuerName: company.issuer?.name ?? null,
			proposals,
			logo: company.proposalLogo
				? {
						contentBase64: Buffer.from(company.proposalLogo.content).toString(
							"base64",
						),
						width: company.proposalLogo.width,
						height: company.proposalLogo.height,
					}
				: null,
		};
	}

	async setCompanyIssuer(companyId: string, issuerId: string | null) {
		if (issuerId) {
			const issuer = await this.db.issuer.findUnique({
				where: { id: issuerId },
				select: { active: true },
			});
			if (!issuer)
				throw new NotFoundException(`No issuer with id ${issuerId}.`);
			if (!issuer.active) {
				throw new BadRequestException("That issuer is deactivated.");
			}
		}

		try {
			await this.db.company.update({
				where: { id: companyId },
				data: { issuerId },
				select: { id: true },
			});
		} catch (cause) {
			if (prismaCode(cause) === "P2025") {
				throw new NotFoundException(`No company with id ${companyId}.`);
			}
			throw cause;
		}

		this.logger.log({ message: "Company issuer set", companyId, issuerId });
		return this.companyProfile(companyId);
	}

	async setClientLogo(
		userId: string,
		input: z.infer<typeof setClientLogoInput>,
	) {
		const content = decode(input.contentBase64);
		const size = imageSize(content);

		if (!size || content[1] !== 0x50) {
			throw new BadRequestException("The logo must be a PNG image.");
		}

		const exists = await this.db.company.count({
			where: { id: input.companyId },
		});
		if (!exists) {
			throw new NotFoundException(`No company with id ${input.companyId}.`);
		}

		await this.db.clientLogo.upsert({
			where: { companyId: input.companyId },
			create: {
				companyId: input.companyId,
				content: toBytes(content),
				width: size.width,
				height: size.height,
				uploadedById: userId,
			},
			update: {
				content: toBytes(content),
				width: size.width,
				height: size.height,
				uploadedById: userId,
			},
		});

		return this.companyProfile(input.companyId);
	}

	async removeClientLogo(companyId: string) {
		await this.db.clientLogo.deleteMany({ where: { companyId } });
		return this.companyProfile(companyId);
	}
}

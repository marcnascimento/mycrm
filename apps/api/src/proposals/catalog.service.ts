import type { Db, JsonValue, Prisma } from "@crm/db";
import {
	type ProposalExtra,
	parseProposalContent,
	parseProposalExtras,
} from "@crm/validation/proposal";
import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import type { z } from "zod";
import { InjectDatabase } from "../database/database.constants";
import { prismaCode } from "./prisma-code";
import type { ServiceOutput, saveServiceInput } from "./proposals.contracts";

const SERVICE_INCLUDE = {
	prices: {
		include: { issuer: { select: { name: true } } },
		orderBy: { issuer: { name: "asc" } },
	},
} as const satisfies Prisma.ServiceInclude;

type ServiceRow = Prisma.ServiceGetPayload<{ include: typeof SERVICE_INCLUDE }>;

function extrasOf(value: JsonValue): ProposalExtra[] {
	try {
		return parseProposalExtras(value);
	} catch {
		return [];
	}
}

function summary(row: ServiceRow) {
	return {
		id: row.id,
		name: row.name,
		archived: row.archivedAt !== null,
		updatedAt: row.updatedAt.toISOString(),
		prices: row.prices.map((price) => ({
			issuerId: price.issuerId,
			issuerName: price.issuer.name,
			amount: price.amount.toFixed(2),
			extras: extrasOf(price.extras),
		})),
	};
}

@Injectable()
export class CatalogService {
	private readonly logger = new Logger(CatalogService.name);

	constructor(@InjectDatabase() private readonly db: Db) {}

	async list(archived: boolean) {
		const rows = await this.db.service.findMany({
			where: { archivedAt: archived ? { not: null } : null },
			include: SERVICE_INCLUDE,
			orderBy: { name: "asc" },
		});
		return rows.map(summary);
	}

	async byId(id: string): Promise<ServiceOutput> {
		const row = await this.db.service.findUnique({
			where: { id },
			include: SERVICE_INCLUDE,
		});
		if (!row) throw new NotFoundException(`No service with id ${id}.`);
		return { ...summary(row), content: parseProposalContent(row.content) };
	}

	async save(input: z.infer<typeof saveServiceInput>): Promise<ServiceOutput> {
		const id = await this.write(input);

		this.logger.log({
			message: input.id ? "Service updated" : "Service created",
			serviceId: id,
			prices: input.prices.length,
		});

		return this.byId(id);
	}

	private async write(
		input: z.infer<typeof saveServiceInput>,
	): Promise<string> {
		try {
			return await this.db.$transaction(async (tx) => {
				const service = input.id
					? await tx.service.update({
							where: { id: input.id },
							data: { name: input.name, content: input.content },
							select: { id: true },
						})
					: await tx.service.create({
							data: { name: input.name, content: input.content },
							select: { id: true },
						});

				await tx.servicePrice.deleteMany({ where: { serviceId: service.id } });

				if (input.prices.length > 0) {
					await tx.servicePrice.createMany({
						data: input.prices.map((price) => ({
							serviceId: service.id,
							issuerId: price.issuerId,
							amount: price.amount,
							extras: price.extras,
						})),
					});
				}

				return service.id;
			});
		} catch (cause) {
			const code = prismaCode(cause);
			if (code === "P2025") {
				throw new NotFoundException(`No service with id ${input.id}.`);
			}
			if (code === "P2002") {
				throw new BadRequestException(
					"Each issuer can have one price per service.",
				);
			}
			if (code === "P2003") {
				throw new BadRequestException(
					"A price points at an issuer that does not exist.",
				);
			}
			throw cause;
		}
	}

	async setArchived(id: string, archived: boolean) {
		const updated = await this.db.service.updateMany({
			where: { id },
			data: { archivedAt: archived ? new Date() : null },
		});
		if (updated.count === 0) {
			throw new NotFoundException(`No service with id ${id}.`);
		}
		return { ok: true as const };
	}
}

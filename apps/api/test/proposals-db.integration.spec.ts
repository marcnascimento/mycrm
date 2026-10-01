import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";

const suffix = process.env.TEST_RUN_ID ?? "proposals-db-spec";
const userId = `user-${suffix}`;

let issuerId: string;
let companyId: string;

async function proposalFor(dealId: string, version: number) {
	return db.proposal.create({
		data: {
			dealId,
			version,
			issuerId,
			issuerName: "Spec issuer",
			templateName: "Spec template",
			number: `SPEC-${version}`,
			date: new Date("2026-09-29"),
			jurisdiction: "PT",
			jurisdictionText: "applicable Portuguese and EU law",
			content: { title: "Spec" },
			lines: [{ description: "Spec", amount: "100.00" }],
			extras: [],
			payments: [{ percent: 100, label: "upfront" }],
			total: "100.00",
			generatedFile: Buffer.from("docx"),
			generatedFileName: "spec.docx",
			createdById: userId,
		},
	});
}

beforeAll(async () => {
	await db.user.upsert({
		where: { id: userId },
		create: { id: userId, name: "Spec", email: `${suffix}@example.test` },
		update: {},
	});
	const issuer = await db.issuer.create({
		data: { name: `Issuer ${suffix}`, defaultPayments: [] },
	});
	issuerId = issuer.id;
	const company = await db.company.create({
		data: { name: `Company ${suffix}`, issuerId },
	});
	companyId = company.id;
}, 30_000);

afterAll(async () => {
	await db.company.deleteMany({ where: { id: companyId } });
	await db.issuer.deleteMany({ where: { id: issuerId } });
	await db.user.deleteMany({ where: { id: userId } });
}, 30_000);

describe("proposal storage", () => {
	it("deletes a deal's proposals with the deal", async () => {
		const deal = await db.deal.create({
			data: { name: `Deal ${suffix}`, companyId, ownerId: userId },
		});
		await proposalFor(deal.id, 1);
		await proposalFor(deal.id, 2);

		await db.deal.delete({ where: { id: deal.id } });

		expect(await db.proposal.count({ where: { dealId: deal.id } })).toBe(0);
	});

	it("refuses two proposals with the same version on one deal", async () => {
		const deal = await db.deal.create({
			data: { name: `Deal twin ${suffix}`, companyId, ownerId: userId },
		});
		await proposalFor(deal.id, 1);

		let code: string | undefined;
		try {
			await proposalFor(deal.id, 1);
		} catch (error) {
			code = (error as { code?: string }).code;
		}
		expect(code).toBe("P2002");

		await db.deal.delete({ where: { id: deal.id } });
	});

	it("refuses to delete an issuer that a client uses", async () => {
		let code: string | undefined;
		try {
			await db.issuer.delete({ where: { id: issuerId } });
		} catch (error) {
			code = (error as { code?: string }).code;
		}
		expect(code).toBe("P2003");
	});

	it("keeps the client logo out of an ordinary company read", async () => {
		await db.clientLogo.create({
			data: {
				companyId,
				content: Buffer.from("png"),
				width: 300,
				height: 128,
				uploadedById: userId,
			},
		});

		const company = await db.company.findUniqueOrThrow({
			where: { id: companyId },
		});

		expect(Object.keys(company)).not.toContain("proposalLogo");
		expect(JSON.stringify(company)).not.toContain("png");
	});
});

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WORKSPACE_ID } from "@crm/auth";
import { db } from "@crm/db";
import { SETTINGS_ID, writeReportingCurrency } from "@crm/db/settings";
import type { AgentTriggerService } from "../src/agent/agent-trigger.service";
import { ActivityStampService } from "../src/crm/activity-stamp.service";
import { ConversionService } from "../src/currency/conversion.service";
import { DealsService } from "../src/deals/deals.service";
import { FieldsService } from "../src/fields/fields.service";
import { CatalogService } from "../src/proposals/catalog.service";
import { IssuersService } from "../src/proposals/issuers.service";
import { ProposalAccessService } from "../src/proposals/proposal-access.service";
import { uploadTemplateInput } from "../src/proposals/proposals.contracts";
import { ProposalsService } from "../src/proposals/proposals.service";
import { withDiscardedCrmEvents } from "./agent-trigger.stub";

const suffix = process.env.TEST_RUN_ID ?? "proposals-spec";
const ownerId = `owner-${suffix}`;
const memberId = `member-${suffix}`;

const access = new ProposalAccessService(db);
const issuers = new IssuersService(db);
const catalog = new CatalogService(db);
const proposals = new ProposalsService(db);
const deals = new DealsService(
	db,
	{ withCrmEvents: withDiscardedCrmEvents } as unknown as AgentTriggerService,
	new ActivityStampService(db),
	new ConversionService(db),
	new FieldsService(db, { fieldBackfill: async () => undefined } as never),
);

const template = readFileSync(
	join(import.meta.dir, "fixtures", "proposal-template.docx"),
).toString("base64");
const PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR4nGP4z8DwnwEIGAEA/wH/eKDUAAAAAElFTkSuQmCC",
	"base64",
).toString("base64");

const payments = [
	{ percent: 50, label: "deposit required to schedule testing" },
	{ percent: 50, label: "final payment upon delivery" },
];

let issuerB: string;
let issuerA: string;
let companyId: string;
let dealId: string;
let contactId: string;
let serviceId: string;
let templateId: string;
let previousReporting: string | null = null;

async function codeOf(run: () => Promise<unknown>): Promise<number | null> {
	try {
		await run();
		return null;
	} catch (error) {
		return (error as { getStatus?: () => number }).getStatus?.() ?? -1;
	}
}

async function generateFrom(
	draft: Awaited<ReturnType<typeof proposals.draft>>,
) {
	return proposals.generate(ownerId, {
		dealId,
		serviceId: draft.serviceId,
		templateId,
		number: draft.number,
		date: draft.date,
		attentionContactId: draft.attentionContactId,
		attentionName: draft.attentionName,
		attentionPosition: draft.attentionPosition,
		jurisdiction: draft.jurisdiction,
		jurisdictionText: draft.jurisdictionText,
		content: draft.content,
		lines: draft.lines,
		extras: draft.extras,
		payments: draft.payments,
		logoBase64: PNG,
	});
}

beforeAll(async () => {
	const existing = await db.appSetting.findUnique({
		where: { id: SETTINGS_ID },
		select: { reportingCurrency: true },
	});
	previousReporting = existing?.reportingCurrency ?? null;
	await writeReportingCurrency(db, "EUR");

	await db.organization.upsert({
		where: { id: WORKSPACE_ID },
		create: {
			id: WORKSPACE_ID,
			name: "CRM",
			slug: "crm",
			createdAt: new Date(),
		},
		update: {},
	});
	for (const [id, role] of [
		[ownerId, "owner"],
		[memberId, "member"],
	] as const) {
		await db.user.upsert({
			where: { id },
			create: { id, name: `User ${id}`, email: `${id}@example.test` },
			update: {},
		});
		await db.member.upsert({
			where: {
				organizationId_userId: { organizationId: WORKSPACE_ID, userId: id },
			},
			create: {
				id: `m-${id}`,
				organizationId: WORKSPACE_ID,
				userId: id,
				role,
				createdAt: new Date(),
			},
			update: { role },
		});
	}

	const company = await db.company.create({
		data: { name: `Acme ${suffix}`, countryCode: "ES" },
	});
	companyId = company.id;
	const contact = await db.contact.create({
		data: {
			firstName: "Jane",
			lastName: "Doe",
			title: "CISO",
			email: `jane-${suffix}@example.test`,
			companyId,
		},
	});
	contactId = contact.id;
	const deal = await db.deal.create({
		data: {
			name: `Pentest ${suffix}`,
			companyId,
			ownerId,
			currency: "EUR",
			contacts: { create: { contactId } },
		},
	});
	dealId = deal.id;
}, 60_000);

afterAll(async () => {
	await db.deal.deleteMany({ where: { companyId } });
	await db.contact.deleteMany({ where: { companyId } });
	await db.company.deleteMany({ where: { id: companyId } });
	await db.servicePrice.deleteMany({
		where: { issuerId: { in: [issuerB, issuerA] } },
	});
	await db.service.deleteMany({ where: { name: { endsWith: suffix } } });
	await db.issuerTemplate.deleteMany({
		where: { issuerId: { in: [issuerB, issuerA] } },
	});
	await db.issuer.deleteMany({ where: { id: { in: [issuerB, issuerA] } } });
	await db.member.deleteMany({
		where: { userId: { in: [ownerId, memberId] } },
	});
	await db.user.deleteMany({ where: { id: { in: [ownerId, memberId] } } });
	if (previousReporting) await writeReportingCurrency(db, previousReporting);
}, 60_000);

describe("access", () => {
	it("lets the owner in and keeps a member out", async () => {
		expect(await access.canManage(ownerId)).toBe(true);
		expect(await access.canManage(memberId)).toBe(false);
		expect(await codeOf(() => access.requireOwner(memberId))).toBe(403);
		expect(await codeOf(() => access.requireOwner(ownerId))).toBeNull();
	});
});

describe("issuers", () => {
	it("creates issuers with default instalments", async () => {
		issuerB = (
			await issuers.create({
				name: `Emissor B ${suffix}`,
				numberPrefix: "MMN-",
				defaultPayments: payments,
			})
		).id;
		issuerA = (
			await issuers.create({
				name: `Emissor A ${suffix}`,
				numberPrefix: "MMN-A-",
				defaultPayments: payments,
			})
		).id;

		const listed = (await issuers.list()).find((row) => row.id === issuerB);
		expect(listed?.defaultPayments).toEqual(payments);
	});

	it("refuses a second issuer with the same name", async () => {
		expect(
			await codeOf(() =>
				issuers.create({
					name: `Emissor B ${suffix}`,
					numberPrefix: "",
					defaultPayments: payments,
				}),
			),
		).toBe(409);
	});
});

describe("templates", () => {
	it("accepts a valid template and reports its markers and logo slot", async () => {
		const row = await issuers.uploadTemplate(ownerId, {
			issuerId: issuerB,
			name: "Emissor B proposal",
			fileName: "modelo-emissor-b.docx",
			contentBase64: template,
		});
		templateId = row.id;
		expect(row.markers).toContain("phases");
		expect(row.logoSlot).toEqual({ width: 300, height: 128 });
	});

	it("refuses a PDF", async () => {
		expect(
			await codeOf(() =>
				issuers.uploadTemplate(ownerId, {
					issuerId: issuerB,
					name: "PDF",
					fileName: "gruposm.pdf",
					contentBase64: template,
				}),
			),
		).toBe(400);
	});

	it("refuses a template with an unknown marker", async () => {
		const unknown = readFileSync(
			join(import.meta.dir, "fixtures", "unknown-marker.docx"),
		).toString("base64");
		expect(
			await codeOf(() =>
				issuers.uploadTemplate(ownerId, {
					issuerId: issuerB,
					name: "Bad",
					fileName: "bad.docx",
					contentBase64: unknown,
				}),
			),
		).toBe(400);
	});

	it("refuses a file above the size limit before it reaches the service", () => {
		const big = "A".repeat(5 * 1024 * 1024);
		expect(
			uploadTemplateInput.safeParse({
				issuerId: issuerB,
				name: "Big",
				fileName: "big.docx",
				contentBase64: big,
			}).success,
		).toBe(false);
	});
});

describe("client issuer and logo", () => {
	it("asks for an issuer before a proposal", async () => {
		expect(
			await codeOf(() => proposals.draft({ dealId, serviceId: "x" })),
		).toBe(400);
	});

	it("sets the issuer and the logo of the client", async () => {
		await issuers.setCompanyIssuer(companyId, issuerB);
		const profile = await issuers.setClientLogo(ownerId, {
			companyId,
			contentBase64: PNG,
		});
		expect(profile.issuerName).toBe(`Emissor B ${suffix}`);
		expect(profile.logo?.width).toBe(2);
	});

	it("refuses a logo that is not a PNG", async () => {
		expect(
			await codeOf(() =>
				issuers.setClientLogo(ownerId, {
					companyId,
					contentBase64: Buffer.from("GIF89a....").toString("base64"),
				}),
			),
		).toBe(400);
	});

	it("refuses to delete an issuer in use", async () => {
		expect(await codeOf(() => issuers.remove(issuerB))).toBe(409);
	});
});

describe("catalog", () => {
	it("keeps one price per issuer", async () => {
		const saved = await catalog.save({
			name: `Web App Pentest ${suffix}`,
			content: {
				title: "Web Application Penetration Test",
				pitch: "a comprehensive web application penetration test",
				challenge: "",
				risks: ["Breach"],
				objective: "",
				scope: [{ title: "Input Validation", description: "SQLi, XSS" }],
				methodologyIntro: "",
				phases: [{ name: "PHASE 1", steps: ["Recon"] }],
				compliance: "",
				deliverables: [],
				outOfScope: "",
				schedule: [{ phase: "Recon", duration: "Days 1-2" }],
				effortNote: "",
				requirements: [],
				testAccounts: "",
				included: [],
			},
			prices: [
				{
					issuerId: issuerB,
					amount: "5200.00",
					extras: [{ label: "Extra retests", price: "600", unit: " each" }],
				},
				{ issuerId: issuerA, amount: "6100.00", extras: [] },
			],
		});
		serviceId = saved.id;
		expect(saved.prices.map((p) => p.amount).sort()).toEqual([
			"5200.00",
			"6100.00",
		]);
	});

	it("hides a service without a price for the client's issuer", async () => {
		const other = await catalog.save({
			name: `Emissor A only ${suffix}`,
			content: { title: "Only Emissor A" } as never,
			prices: [{ issuerId: issuerA, amount: "100.00", extras: [] }],
		});
		expect(
			await codeOf(() => proposals.draft({ dealId, serviceId: other.id })),
		).toBe(400);
	});
});

describe("proposals", () => {
	it("drafts from the catalog with the issuer's price and defaults", async () => {
		const draft = await proposals.draft({ dealId, serviceId });
		expect(draft.lines).toEqual([
			{ description: "Web Application Penetration Test", amount: "5200.00" },
		]);
		expect(draft.number).toBe("MMN-");
		expect(draft.jurisdiction).toBe("ES");
		expect(draft.attentionName).toBe("Jane Doe");
		expect(draft.payments).toEqual(payments);
	});

	it("generates v1 and v2, and v1 stays as it was", async () => {
		const draft = await proposals.draft({ dealId, serviceId });
		const v1 = await generateFrom({ ...draft, number: "MMN-001" });
		expect(v1.version).toBe(1);
		expect(v1.total).toBe("5200.00");

		const again = await proposals.draft({ dealId, fromProposalId: v1.id });
		expect(again.number).toBe("MMN-001");
		const v2 = await generateFrom({
			...again,
			lines: [{ description: "Web App", amount: "4800.00" }],
		});
		expect(v2.version).toBe(2);

		const listed = await proposals.forDeal(dealId);
		expect(listed.versions.map((v) => [v.version, v.total])).toEqual([
			[2, "4800.00"],
			[1, "5200.00"],
		]);
		expect(listed.versions[1]?.createdByName).toBe(`User ${ownerId}`);
	});

	it("keeps the generated file byte for byte after the template is archived", async () => {
		const [latest] = (await proposals.forDeal(dealId)).versions;
		const before = await proposals.download(latest?.id ?? "", "preferred");
		await issuers.archiveTemplate(templateId);
		const after = await proposals.download(latest?.id ?? "", "preferred");
		expect(after.contentBase64).toBe(before.contentBase64);
	});

	it("prefers the uploaded final file and keeps the generated one", async () => {
		const [latest] = (await proposals.forDeal(dealId)).versions;
		const id = latest?.id ?? "";
		const generated = await proposals.download(id, "generated");
		await proposals.uploadFinal({
			id,
			fileName: "final.docx",
			contentBase64: template,
		});

		expect((await proposals.download(id, "preferred")).fileName).toBe(
			"final.docx",
		);
		expect((await proposals.download(id, "generated")).contentBase64).toBe(
			generated.contentBase64,
		);
	});

	it("suggests the deal stage and amount, and leaves other versions alone", async () => {
		const [v2, v1] = (await proposals.forDeal(dealId)).versions;
		const sent = await proposals.setStatus(v2?.id ?? "", "SENT");
		expect(sent.suggestion).toEqual({
			stage: "CONTRACT_SENT",
			amountCents: null,
			currency: null,
		});

		const accepted = await proposals.setStatus(v2?.id ?? "", "ACCEPTED");
		expect(accepted.suggestion).toEqual({
			stage: "CLOSED_WON",
			amountCents: 480000,
			currency: "EUR",
		});

		const rejected = await proposals.setStatus(v1?.id ?? "", "REJECTED");
		expect(rejected.suggestion.stage).toBeNull();

		const after = await proposals.forDeal(dealId);
		expect(after.versions.map((v) => v.status)).toEqual([
			"ACCEPTED",
			"REJECTED",
		]);
	});

	it("keeps the old issuer on old versions after the client changes issuer", async () => {
		const profile = await issuers.companyProfile(companyId);
		expect(profile.proposals).toBe(2);

		await issuers.setCompanyIssuer(companyId, issuerA);
		const after = await proposals.forDeal(dealId);
		expect(after.issuer?.id).toBe(issuerA);
		expect(
			after.versions.every((v) => v.issuerName === `Emissor B ${suffix}`),
		).toBe(true);
		await issuers.setCompanyIssuer(companyId, issuerB);
	});

	it("updates the deal amount through the deals service, with conversion", async () => {
		await deals.update(dealId, { amountCents: 480000, currency: "EUR" });
		const deal = await db.deal.findUniqueOrThrow({
			where: { id: dealId },
			select: {
				amount: true,
				currency: true,
				baseAmount: true,
				baseCurrency: true,
			},
		});
		expect(deal.amount?.toFixed(2)).toBe("4800.00");
		expect(deal.currency).toBe("EUR");
		expect(deal.baseCurrency).toBe("EUR");
		expect(deal.baseAmount?.toFixed(2)).toBe("4800.00");
	});
});

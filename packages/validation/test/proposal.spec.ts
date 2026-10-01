import { describe, expect, it } from "bun:test";
import {
	parseProposalContent,
	parseProposalExtras,
	parseProposalLines,
	parseProposalPayments,
	proposalJurisdiction,
} from "../src/proposal";
import { webAppPentest } from "./fixtures/web-app-pentest";

describe("proposal content", () => {
	it("accepts the Web App service of the Emissor B template", () => {
		const content = parseProposalContent(webAppPentest);
		expect(content.scope).toHaveLength(9);
		expect(content.phases).toHaveLength(4);
		expect(content.phases[2]?.steps).toHaveLength(5);
		expect(content.schedule[4]?.duration).toBe("End of Week 2 (Day 14)");
	});

	it("fills missing sections with empty values", () => {
		const content = parseProposalContent({ title: "Retest" });
		expect(content.risks).toEqual([]);
		expect(content.challenge).toBe("");
	});

	it("refuses a service without a title", () => {
		expect(() => parseProposalContent({ title: "  " })).toThrow();
	});
});

describe("proposal money", () => {
	it("accepts euro amounts with up to two decimals", () => {
		expect(
			parseProposalLines([{ description: "Pentest", amount: "5200.00" }]),
		).toHaveLength(1);
		expect(
			parseProposalExtras([
				{ label: "Extra retests", price: "600", unit: " each" },
			])[0]?.unit,
		).toBe(" each");
	});

	it("refuses a line with a malformed amount", () => {
		expect(() =>
			parseProposalLines([{ description: "Pentest", amount: "5,200" }]),
		).toThrow();
	});

	it("refuses a proposal without lines", () => {
		expect(() => parseProposalLines([])).toThrow();
	});
});

describe("proposal payments", () => {
	it("accepts instalments that add up to 100", () => {
		expect(
			parseProposalPayments([
				{ percent: 50, label: "deposit required to schedule testing" },
				{ percent: 50, label: "final payment upon delivery" },
			]),
		).toHaveLength(2);
	});

	it("refuses instalments that do not add up to 100", () => {
		expect(() =>
			parseProposalPayments([
				{ percent: 50, label: "deposit" },
				{ percent: 40, label: "final" },
			]),
		).toThrow(/100%/);
	});
});

describe("proposal jurisdiction", () => {
	it("is Portugal or Spain", () => {
		expect(proposalJurisdiction.safeParse("PT").success).toBe(true);
		expect(proposalJurisdiction.safeParse("FR").success).toBe(false);
	});
});

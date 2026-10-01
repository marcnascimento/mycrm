import { describe, expect, it } from "bun:test";
import { unitSuffix } from "../src/proposals/proposal-data";
import {
	centsToDecimal,
	formatEur,
	formatProposalDate,
	splitByPercent,
} from "../src/proposals/proposal-format";

describe("formatEur", () => {
	it("groups thousands with a dot and puts the euro sign after", () => {
		expect(formatEur(10000)).toBe("10.000€");
		expect(formatEur("5200.00")).toBe("5.200€");
		expect(formatEur(1234567)).toBe("1.234.567€");
	});

	it("shows cents only when they are not zero", () => {
		expect(formatEur(1234.5)).toBe("1.234,50€");
		expect(formatEur("0.5")).toBe("0,50€");
		expect(formatEur(600)).toBe("600€");
	});
});

describe("formatProposalDate", () => {
	it("is day-month-year with dashes", () => {
		expect(formatProposalDate(new Date("2026-09-29T00:00:00.000Z"))).toBe(
			"29-09-2026",
		);
	});
});

describe("splitByPercent", () => {
	it("splits a total into instalments", () => {
		expect(splitByPercent(520000, [50, 50])).toEqual([260000, 260000]);
	});

	it("puts the rounding remainder on the last instalment", () => {
		const parts = splitByPercent(10001, [33, 33, 34]);
		expect(parts.reduce((a, b) => a + b, 0)).toBe(10001);
	});
});

describe("centsToDecimal", () => {
	it("writes cents as a two-decimal string", () => {
		expect(centsToDecimal(520000)).toBe("5200.00");
		expect(centsToDecimal(5)).toBe("0.05");
	});
});

describe("unitSuffix", () => {
	it("puts a space before a word and none before a slash", () => {
		expect(unitSuffix("each")).toBe(" each");
		expect(unitSuffix(" each")).toBe(" each");
		expect(unitSuffix("/hour")).toBe("/hour");
		expect(unitSuffix("")).toBe("");
	});
});

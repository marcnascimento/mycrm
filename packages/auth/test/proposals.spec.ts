import { describe, expect, it } from "bun:test";
import { canManageProposals } from "../src/proposals";

describe("canManageProposals", () => {
	it("is the owner alone", () => {
		expect(canManageProposals("owner")).toBe(true);
		expect(canManageProposals("admin")).toBe(false);
		expect(canManageProposals("member")).toBe(false);
		expect(canManageProposals(null)).toBe(false);
	});
});

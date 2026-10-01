import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import PizZip from "pizzip";
import { templateData } from "../src/proposals/proposal-data";
import {
	inspectTemplate,
	renderProposal,
	TemplateError,
} from "../src/proposals/proposal-docx";

const fixture = (name: string) =>
	readFileSync(join(import.meta.dir, "fixtures", name));

const LOGO = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR4nGP4z8DwnwEIGAEA/wH/eKDUAAAAAElFTkSuQmCC",
	"base64",
);

function documentText(file: Buffer): string {
	const zip = new PizZip(file);
	return (zip.file("word/document.xml")?.asText() ?? "")
		.replace(/<w:p[ >]/g, "\n$&")
		.replace(/<[^>]+>/g, "");
}

function logoBytes(file: Buffer): Buffer {
	const zip = new PizZip(file);
	const media = Object.keys(zip.files).find((name) =>
		name.startsWith("word/media/"),
	);
	return Buffer.from(zip.file(media ?? "")?.asUint8Array() ?? []);
}

const data = templateData({
	date: new Date("2026-09-29T00:00:00.000Z"),
	number: "MMN-TST-0001",
	clientName: "Acme Lda",
	attentionName: "Jane Doe",
	attentionPosition: "CISO",
	jurisdictionText: "applicable Spanish and EU law",
	content: {
		title: "Web Application Penetration Test",
		pitch: "a comprehensive web application penetration test",
		challenge: "",
		risks: [],
		objective: "",
		scope: [],
		methodologyIntro: "",
		phases: [
			{ name: "PHASE 1: Recon", steps: ["Passive recon", "Mapping"] },
			{ name: "PHASE 2: Scan", steps: ["Scanning"] },
			{ name: "PHASE 3: Exploit", steps: ["Exploitation"] },
			{ name: "PHASE 4: Report", steps: ["Reporting"] },
		],
		compliance: "",
		deliverables: [],
		outOfScope: "",
		schedule: [
			{ phase: "Recon", duration: "Days 1-2" },
			{ phase: "Scanning", duration: "Days 2-4" },
			{ phase: "Testing", duration: "Days 4-10" },
			{ phase: "Report", duration: "Days 11-14" },
			{ phase: "Delivery", duration: "Day 14" },
		],
		effortNote: "",
		requirements: [],
		testAccounts: "",
		included: [],
	},
	lines: [{ description: "Web Application Penetration Test", amount: "5200" }],
	extras: [],
	payments: [
		{ percent: 50, label: "deposit" },
		{ percent: 50, label: "final payment" },
	],
});

describe("templateData", () => {
	it("computes the total and the instalment amounts", () => {
		expect(data.total).toBe("5.200€");
		expect(data.payments.map((p) => p.amount)).toEqual(["2.600€", "2.600€"]);
		expect(data.date).toBe("29-09-2026");
	});
});

describe("renderProposal", () => {
	const out = renderProposal(fixture("proposal-template.docx"), data, LOGO);
	const text = documentText(out);

	it("fills fields and leaves no marker behind", () => {
		expect(text).toContain("29-09-2026 MMN-TST-0001");
		expect(text).toContain(
			"For Acme Lda, we propose a comprehensive web application penetration test.",
		);
		expect(text).not.toContain("{");
		expect(text).not.toContain("}");
	});

	it("repeats nested loops and table rows", () => {
		expect(text.match(/PHASE \d/g)).toHaveLength(4);
		expect(text).toContain("Passive recon");
		expect(text).toContain("Days 11-14");
		expect(text.match(/Days? \d/g)).toHaveLength(5);
		expect(text).toContain("50% deposit (2.600€)");
		expect(text).toMatch(/TOTAL\s+5\.200€/);
	});

	it("puts the client logo into the logo slot", () => {
		expect(logoBytes(out).equals(LOGO)).toBe(true);
	});

	it("empties the logo slot when the client has no logo", () => {
		const blank = renderProposal(fixture("proposal-template.docx"), data, null);
		const bytes = logoBytes(blank);
		expect(bytes.equals(LOGO)).toBe(false);
		expect(bytes.subarray(1, 4).toString()).toBe("PNG");
		expect(bytes.length).toBeLessThan(100);
	});
});

describe("inspectTemplate", () => {
	it("lists the markers and the logo slot", () => {
		const inspection = inspectTemplate(fixture("proposal-template.docx"));
		expect(inspection.unknown).toEqual([]);
		expect(inspection.markers).toContain("phases");
		expect(inspection.markers).toContain("steps");
		expect(inspection.logoSlot).toEqual({ width: 300, height: 128 });
	});

	it("reports a marker outside the contract", () => {
		expect(inspectTemplate(fixture("unknown-marker.docx")).unknown).toEqual([
			"client_nme",
		]);
	});

	it("refuses a loop that is never closed", () => {
		expect(() => inspectTemplate(fixture("broken-loop.docx"))).toThrow(
			TemplateError,
		);
	});

	it("refuses a file that is not a Word document", () => {
		expect(() => inspectTemplate(Buffer.from("%PDF-1.7"))).toThrow(
			TemplateError,
		);
	});
});

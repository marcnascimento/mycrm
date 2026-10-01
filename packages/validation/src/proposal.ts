import { z } from "zod";
import { parse } from "./index";

const text = z.string().trim().max(5000).default("");
const line = z.string().trim().min(1).max(1000);
const list = z.array(line).max(60).default([]);

export const eurAmount = z
	.string()
	.trim()
	.regex(/^\d{1,12}(\.\d{1,2})?$/, "is not an amount in euros, like 5200.00");

export const proposalContent = z.object({
	title: z.string().trim().min(1).max(300),
	pitch: text,
	challenge: text,
	risks: list,
	objective: text,
	scope: z
		.array(
			z.object({
				title: z.string().trim().min(1).max(300),
				description: z.string().trim().max(1000).default(""),
			}),
		)
		.max(60)
		.default([]),
	methodologyIntro: text,
	phases: z
		.array(z.object({ name: z.string().trim().min(1).max(300), steps: list }))
		.max(20)
		.default([]),
	compliance: text,
	deliverables: z
		.array(z.object({ name: z.string().trim().min(1).max(300), items: list }))
		.max(20)
		.default([]),
	outOfScope: text,
	schedule: z
		.array(
			z.object({
				phase: z.string().trim().min(1).max(300),
				duration: z.string().trim().min(1).max(120),
			}),
		)
		.max(40)
		.default([]),
	effortNote: text,
	requirements: list,
	testAccounts: text,
	included: list,
});

export type ProposalContent = z.infer<typeof proposalContent>;

const proposalLine = z.object({
	description: z.string().trim().min(1).max(1000),
	amount: eurAmount,
});

export type ProposalLine = z.infer<typeof proposalLine>;

export const proposalLines = z.array(proposalLine).min(1).max(20);

const proposalExtra = z.object({
	label: z.string().trim().min(1).max(300),
	price: eurAmount,
	unit: z.string().max(60).default(""),
});

export type ProposalExtra = z.infer<typeof proposalExtra>;

export const proposalExtras = z.array(proposalExtra).max(20).default([]);

const proposalPayment = z.object({
	percent: z.number().int().min(1).max(100),
	label: z.string().trim().min(1).max(300),
});

export type ProposalPayment = z.infer<typeof proposalPayment>;

export const proposalPayments = z
	.array(proposalPayment)
	.min(1)
	.max(12)
	.refine(
		(payments) => payments.reduce((sum, p) => sum + p.percent, 0) === 100,
		"Payment instalments must add up to 100%.",
	);

const PROPOSAL_JURISDICTIONS = ["PT", "ES"] as const;

export const proposalJurisdiction = z.enum(PROPOSAL_JURISDICTIONS);

export type ProposalJurisdiction = z.infer<typeof proposalJurisdiction>;

const proposalLogoSlot = z.object({
	width: z.number().positive(),
	height: z.number().positive(),
});

export type ProposalLogoSlot = z.infer<typeof proposalLogoSlot>;

export function readProposalLogoSlot(value: unknown): ProposalLogoSlot | null {
	const parsed = proposalLogoSlot.safeParse(value);
	return parsed.success ? parsed.data : null;
}

export function parseProposalContent(value: unknown): ProposalContent {
	return parse(proposalContent, value, "proposal content");
}

export function parseProposalLines(value: unknown): ProposalLine[] {
	return parse(proposalLines, value, "proposal lines");
}

export function parseProposalExtras(value: unknown): ProposalExtra[] {
	return parse(proposalExtras, value, "proposal extras");
}

export function parseProposalPayments(value: unknown): ProposalPayment[] {
	return parse(proposalPayments, value, "proposal payments");
}

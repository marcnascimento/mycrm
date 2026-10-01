import type {
	ProposalContent,
	ProposalExtra,
	ProposalLine,
	ProposalPayment,
} from "@crm/validation/proposal";
import {
	formatEur,
	formatProposalDate,
	splitByPercent,
	toCents,
} from "./proposal-format";

type ProposalDocument = {
	date: Date;
	number: string;
	clientName: string;
	attentionName: string;
	attentionPosition: string;
	jurisdictionText: string;
	content: ProposalContent;
	lines: ProposalLine[];
	extras: ProposalExtra[];
	payments: ProposalPayment[];
};

export const PROPOSAL_MARKERS = [
	"date",
	"number",
	"client_name",
	"attention_name",
	"attention_position",
	"jurisdiction_text",
	"service_title",
	"service_pitch",
	"challenge",
	"risks",
	"objective",
	"scope",
	"title",
	"description",
	"methodology_intro",
	"phases",
	"name",
	"steps",
	"compliance",
	"deliverables",
	"items",
	"out_of_scope",
	"schedule",
	"phase",
	"duration",
	"effort_note",
	"requirements",
	"test_accounts",
	"lines",
	"amount",
	"total",
	"included",
	"extras",
	"label",
	"price",
	"unit",
	"payments",
	"percent",
] as const;

export function unitSuffix(unit: string): string {
	const trimmed = unit.trim();
	return /^[\p{L}\p{N}]/u.test(trimmed) ? ` ${trimmed}` : trimmed;
}

export function proposalTotalCents(lines: ProposalLine[]): number {
	return lines.reduce((sum, line) => sum + toCents(line.amount), 0);
}

export function templateData(doc: ProposalDocument) {
	const { content } = doc;
	const totalCents = proposalTotalCents(doc.lines);
	const shares = splitByPercent(
		totalCents,
		doc.payments.map((payment) => payment.percent),
	);

	return {
		date: formatProposalDate(doc.date),
		number: doc.number,
		client_name: doc.clientName,
		attention_name: doc.attentionName,
		attention_position: doc.attentionPosition,
		jurisdiction_text: doc.jurisdictionText,
		service_title: content.title,
		service_pitch: content.pitch,
		challenge: content.challenge,
		risks: content.risks,
		objective: content.objective,
		scope: content.scope.map((item) => ({
			title: item.title,
			description: item.description,
		})),
		methodology_intro: content.methodologyIntro,
		phases: content.phases.map((phase) => ({
			name: phase.name,
			steps: phase.steps,
		})),
		compliance: content.compliance,
		deliverables: content.deliverables.map((group) => ({
			name: group.name,
			items: group.items,
		})),
		out_of_scope: content.outOfScope,
		schedule: content.schedule.map((row) => ({
			phase: row.phase,
			duration: row.duration,
		})),
		effort_note: content.effortNote,
		requirements: content.requirements,
		test_accounts: content.testAccounts,
		lines: doc.lines.map((line) => ({
			description: line.description,
			amount: formatEur(line.amount),
		})),
		total: formatEur(totalCents / 100),
		included: content.included,
		extras: doc.extras.map((extra) => ({
			label: extra.label,
			price: formatEur(extra.price),
			unit: unitSuffix(extra.unit),
		})),
		payments: doc.payments.map((payment, index) => ({
			percent: payment.percent,
			label: payment.label,
			amount: formatEur((shares[index] ?? 0) / 100),
		})),
	};
}

export type TemplateData = ReturnType<typeof templateData>;

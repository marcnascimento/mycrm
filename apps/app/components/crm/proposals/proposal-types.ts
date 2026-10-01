export type ProposalContent = {
	title: string;
	pitch: string;
	challenge: string;
	risks: string[];
	objective: string;
	scope: { title: string; description: string }[];
	methodologyIntro: string;
	phases: { name: string; steps: string[] }[];
	compliance: string;
	deliverables: { name: string; items: string[] }[];
	outOfScope: string;
	schedule: { phase: string; duration: string }[];
	effortNote: string;
	requirements: string[];
	testAccounts: string;
	included: string[];
};

export type ProposalLine = { description: string; amount: string };

export type ProposalExtra = { label: string; price: string; unit: string };

export type ProposalPayment = { percent: number; label: string };

export const EMPTY_CONTENT: ProposalContent = {
	title: "",
	pitch: "",
	challenge: "",
	risks: [],
	objective: "",
	scope: [],
	methodologyIntro: "",
	phases: [],
	compliance: "",
	deliverables: [],
	outOfScope: "",
	schedule: [],
	effortNote: "",
	requirements: [],
	testAccounts: "",
	included: [],
};

export function formatEur(amount: string | number): string {
	const cents = Math.round(Number(amount) * 100);
	if (!Number.isFinite(cents)) return "—";
	const sign = cents < 0 ? "-" : "";
	const abs = Math.abs(cents);
	const whole = String(Math.floor(abs / 100)).replace(
		/\B(?=(\d{3})+(?!\d))/g,
		".",
	);
	const fraction = abs % 100;
	return `${sign}${whole}${fraction === 0 ? "" : `,${String(fraction).padStart(2, "0")}`}€`;
}

export function toLines(value: string): string[] {
	return value
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
}

export function cleanContent(content: ProposalContent): ProposalContent {
	return {
		...content,
		scope: content.scope.filter((item) => item.title.trim() !== ""),
		phases: content.phases
			.filter((phase) => phase.name.trim() !== "")
			.map((phase) => ({ ...phase, steps: phase.steps.filter(Boolean) })),
		deliverables: content.deliverables
			.filter((group) => group.name.trim() !== "")
			.map((group) => ({ ...group, items: group.items.filter(Boolean) })),
		schedule: content.schedule.filter(
			(row) => row.phase.trim() !== "" && row.duration.trim() !== "",
		),
	};
}

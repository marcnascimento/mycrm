import { PROPOSALS } from "./proposals.config";

export function toCents(amount: string | number): number {
	const value = Number(amount);

	if (!Number.isFinite(value)) {
		throw new Error(`"${amount}" is not an amount.`);
	}

	return Math.round(value * 100);
}

export function centsToDecimal(cents: number): string {
	const sign = cents < 0 ? "-" : "";
	const abs = Math.abs(cents);
	return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function formatEur(amount: string | number): string {
	const { thousands, decimal, currencySuffix } = PROPOSALS.format;
	const cents = toCents(amount);
	const sign = cents < 0 ? "-" : "";
	const abs = Math.abs(cents);
	const whole = String(Math.floor(abs / 100)).replace(
		/\B(?=(\d{3})+(?!\d))/g,
		thousands,
	);
	const fraction = abs % 100;
	const tail =
		fraction === 0 ? "" : `${decimal}${String(fraction).padStart(2, "0")}`;

	return `${sign}${whole}${tail}${currencySuffix}`;
}

export function formatProposalDate(date: Date): string {
	const day = String(date.getUTCDate()).padStart(2, "0");
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	return `${day}-${month}-${date.getUTCFullYear()}`;
}

export function splitByPercent(
	totalCents: number,
	percents: number[],
): number[] {
	let allotted = 0;

	return percents.map((percent, index) => {
		if (index === percents.length - 1) return totalCents - allotted;
		const share = Math.round((totalCents * percent) / 100);
		allotted += share;
		return share;
	});
}

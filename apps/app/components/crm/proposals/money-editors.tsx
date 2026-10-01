"use client";

import Add from "@carbon/icons-react/es/Add";
import Close from "@carbon/icons-react/es/Close";
import { Button } from "@crm/ui/components/button";
import {
	FieldDescription,
	FieldLegend,
	FieldSet,
} from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { useState } from "react";
import { PROPOSAL_UI } from "./proposal-config";
import {
	formatEur,
	type ProposalExtra,
	type ProposalLine,
	type ProposalPayment,
} from "./proposal-types";

function useRowKeys(count: number) {
	const [keys, setKeys] = useState(() =>
		Array.from({ length: count }, () => crypto.randomUUID()),
	);
	return {
		keys,
		add: () => setKeys([...keys, crypto.randomUUID()]),
		remove: (index: number) => setKeys(keys.filter((_, at) => at !== index)),
	};
}

function RowActions({
	label,
	onRemove,
}: {
	label: string;
	onRemove: () => void;
}) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			aria-label={`Remove ${label}`}
			onClick={onRemove}
		>
			<Icon icon={Close} />
		</Button>
	);
}

function AddRow({ label, onAdd }: { label: string; onAdd: () => void }) {
	return (
		<div>
			<Button type="button" variant="outline" size="sm" onClick={onAdd}>
				<Icon icon={Add} data-icon="inline-start" />
				{label}
			</Button>
		</div>
	);
}

export function linesTotal(lines: ProposalLine[]): number {
	return lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
}

export function LinesEditor({
	value,
	onChange,
	single = false,
}: {
	value: ProposalLine[];
	onChange: (value: ProposalLine[]) => void;
	single?: boolean;
}) {
	const rows = useRowKeys(value.length);
	const update = (index: number, next: ProposalLine) =>
		onChange(value.map((line, at) => (at === index ? next : line)));

	return (
		<FieldSet>
			<FieldLegend variant="label">Financial proposal</FieldLegend>
			<div className="flex flex-col gap-2">
				{value.map((line, index) => (
					<div key={rows.keys[index]} className="flex items-center gap-2">
						<Input
							aria-label="Service"
							maxLength={PROPOSAL_UI.limits.lineDescription}
							placeholder="Service"
							value={line.description}
							onChange={(event) =>
								update(index, { ...line, description: event.target.value })
							}
						/>
						<Input
							aria-label="Investment in euros"
							inputMode="decimal"
							placeholder="5200.00"
							className="w-32"
							value={line.amount}
							onChange={(event) =>
								update(index, {
									...line,
									amount: event.target.value.replace(",", "."),
								})
							}
						/>
						{single ? null : (
							<RowActions
								label={line.description || "line"}
								onRemove={() => {
									onChange(value.filter((_, at) => at !== index));
									rows.remove(index);
								}}
							/>
						)}
					</div>
				))}
				{single ? null : (
					<AddRow
						label="Add line"
						onAdd={() => {
							onChange([...value, { description: "", amount: "" }]);
							rows.add();
						}}
					/>
				)}
				<FieldDescription>
					Total {formatEur(linesTotal(value))}. Amounts in euros, with a dot for
					cents.
				</FieldDescription>
			</div>
		</FieldSet>
	);
}

export function ExtrasEditor({
	value,
	onChange,
}: {
	value: ProposalExtra[];
	onChange: (value: ProposalExtra[]) => void;
}) {
	const rows = useRowKeys(value.length);
	const update = (index: number, next: ProposalExtra) =>
		onChange(value.map((extra, at) => (at === index ? next : extra)));

	return (
		<FieldSet>
			<FieldLegend variant="label">Additional services</FieldLegend>
			<div className="flex flex-col gap-2">
				{value.map((extra, index) => (
					<div key={rows.keys[index]} className="flex items-center gap-2">
						<Input
							aria-label="Label"
							maxLength={PROPOSAL_UI.limits.label}
							placeholder="Extra retests"
							value={extra.label}
							onChange={(event) =>
								update(index, { ...extra, label: event.target.value })
							}
						/>
						<Input
							aria-label="Price in euros"
							inputMode="decimal"
							placeholder="600"
							className="w-28"
							value={extra.price}
							onChange={(event) =>
								update(index, {
									...extra,
									price: event.target.value.replace(",", "."),
								})
							}
						/>
						<Input
							aria-label="Unit"
							maxLength={PROPOSAL_UI.limits.unit}
							placeholder="each"
							className="w-28"
							value={extra.unit}
							onChange={(event) =>
								update(index, { ...extra, unit: event.target.value })
							}
						/>
						<RowActions
							label={extra.label || "service"}
							onRemove={() => {
								onChange(value.filter((_, at) => at !== index));
								rows.remove(index);
							}}
						/>
					</div>
				))}
				<AddRow
					label="Add service"
					onAdd={() => {
						onChange([...value, { label: "", price: "", unit: "" }]);
						rows.add();
					}}
				/>
				<FieldDescription>
					Not added to the total. "each" prints as "600€ each", "/hour" as
					"300€/hour".
				</FieldDescription>
			</div>
		</FieldSet>
	);
}

export function PaymentsEditor({
	value,
	onChange,
	total,
}: {
	value: ProposalPayment[];
	onChange: (value: ProposalPayment[]) => void;
	total?: number;
}) {
	const rows = useRowKeys(value.length);
	const update = (index: number, next: ProposalPayment) =>
		onChange(value.map((payment, at) => (at === index ? next : payment)));
	const sum = value.reduce((acc, payment) => acc + payment.percent, 0);

	return (
		<FieldSet>
			<FieldLegend variant="label">Payment instalments</FieldLegend>
			<div className="flex flex-col gap-2">
				{value.map((payment, index) => (
					<div key={rows.keys[index]} className="flex items-center gap-2">
						<Input
							aria-label="Percent"
							inputMode="numeric"
							className="w-20"
							value={String(payment.percent)}
							onChange={(event) =>
								update(index, {
									...payment,
									percent: Number.parseInt(event.target.value, 10) || 0,
								})
							}
						/>
						<Input
							aria-label="Description"
							maxLength={PROPOSAL_UI.limits.label}
							placeholder="deposit required to schedule testing"
							value={payment.label}
							onChange={(event) =>
								update(index, { ...payment, label: event.target.value })
							}
						/>
						{total === undefined ? null : (
							<span className="w-24 shrink-0 text-right text-muted-foreground tabular-nums">
								{formatEur((total * payment.percent) / 100)}
							</span>
						)}
						<RowActions
							label={payment.label || "instalment"}
							onRemove={() => {
								onChange(value.filter((_, at) => at !== index));
								rows.remove(index);
							}}
						/>
					</div>
				))}
				<AddRow
					label="Add instalment"
					onAdd={() => {
						onChange([...value, { percent: 0, label: "" }]);
						rows.add();
					}}
				/>
				<FieldDescription>
					{sum === 100
						? "The instalments add up to 100%."
						: `The instalments add up to ${sum}%. They must add up to 100%.`}
				</FieldDescription>
			</div>
		</FieldSet>
	);
}

"use client";

import Add from "@carbon/icons-react/es/Add";
import Close from "@carbon/icons-react/es/Close";
import { Button } from "@crm/ui/components/button";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { Textarea } from "@crm/ui/components/textarea";
import { useId, useState } from "react";
import { PROPOSAL_UI } from "./proposal-config";
import { type ProposalContent, toLines } from "./proposal-types";

function TextField({
	label,
	description,
	value,
	onChange,
	rows = 3,
}: {
	label: string;
	description?: string;
	value: string;
	onChange: (value: string) => void;
	rows?: number;
}) {
	const id = useId();
	return (
		<Field>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Textarea
				id={id}
				rows={rows}
				value={value}
				onChange={(event) => onChange(event.target.value)}
			/>
			{description ? <FieldDescription>{description}</FieldDescription> : null}
		</Field>
	);
}

function LinesField({
	label,
	description = "One item per line.",
	value,
	onChange,
	rows = 4,
}: {
	label: string;
	description?: string;
	value: string[];
	onChange: (value: string[]) => void;
	rows?: number;
}) {
	const id = useId();
	const [text, setText] = useState(() => value.join("\n"));
	return (
		<Field>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Textarea
				id={id}
				rows={rows}
				value={text}
				onChange={(event) => {
					setText(event.target.value);
					onChange(toLines(event.target.value));
				}}
			/>
			<FieldDescription>{description}</FieldDescription>
		</Field>
	);
}

function ScopeField({
	value,
	onChange,
}: {
	value: ProposalContent["scope"];
	onChange: (value: ProposalContent["scope"]) => void;
}) {
	const id = useId();
	const [text, setText] = useState(() =>
		value
			.map((item) =>
				item.description ? `${item.title} - ${item.description}` : item.title,
			)
			.join("\n"),
	);
	return (
		<Field>
			<FieldLabel htmlFor={id}>Scope of testing</FieldLabel>
			<Textarea
				id={id}
				rows={6}
				value={text}
				onChange={(event) => {
					setText(event.target.value);
					onChange(
						toLines(event.target.value).map((line) => {
							const at = line.indexOf(" - ");
							return at === -1
								? { title: line, description: "" }
								: {
										title: line.slice(0, at).trim(),
										description: line.slice(at + 3).trim(),
									};
						}),
					);
				}}
			/>
			<FieldDescription>
				One item per line, as "Title - description". The title prints in bold.
			</FieldDescription>
		</Field>
	);
}

function GroupsField({
	legend,
	nameLabel,
	itemsLabel,
	addLabel,
	groups,
	onChange,
}: {
	legend: string;
	nameLabel: string;
	itemsLabel: string;
	addLabel: string;
	groups: { name: string; items: string[] }[];
	onChange: (groups: { name: string; items: string[] }[]) => void;
}) {
	const [keys, setKeys] = useState(() => groups.map(() => crypto.randomUUID()));

	const update = (index: number, next: { name: string; items: string[] }) =>
		onChange(groups.map((group, at) => (at === index ? next : group)));

	return (
		<FieldSet>
			<FieldLegend variant="label">{legend}</FieldLegend>
			<div className="flex flex-col gap-3">
				{groups.map((group, index) => (
					<div
						key={keys[index]}
						className="flex flex-col gap-2 rounded-lg border p-3"
					>
						<div className="flex items-center gap-2">
							<Input
								aria-label={nameLabel}
								maxLength={PROPOSAL_UI.limits.title}
								placeholder={nameLabel}
								value={group.name}
								onChange={(event) =>
									update(index, { ...group, name: event.target.value })
								}
							/>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								aria-label={`Remove ${group.name || nameLabel}`}
								onClick={() => {
									onChange(groups.filter((_, at) => at !== index));
									setKeys(keys.filter((_, at) => at !== index));
								}}
							>
								<Icon icon={Close} />
							</Button>
						</div>
						<LinesField
							label={itemsLabel}
							value={group.items}
							rows={3}
							onChange={(items) => update(index, { ...group, items })}
						/>
					</div>
				))}
				<div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => {
							onChange([...groups, { name: "", items: [] }]);
							setKeys([...keys, crypto.randomUUID()]);
						}}
					>
						<Icon icon={Add} data-icon="inline-start" />
						{addLabel}
					</Button>
				</div>
			</div>
		</FieldSet>
	);
}

function ScheduleField({
	rows,
	onChange,
}: {
	rows: ProposalContent["schedule"];
	onChange: (rows: ProposalContent["schedule"]) => void;
}) {
	const [keys, setKeys] = useState(() => rows.map(() => crypto.randomUUID()));

	const update = (index: number, next: { phase: string; duration: string }) =>
		onChange(rows.map((row, at) => (at === index ? next : row)));

	return (
		<FieldSet>
			<FieldLegend variant="label">Testing schedule</FieldLegend>
			<div className="flex flex-col gap-2">
				{rows.map((row, index) => (
					<div key={keys[index]} className="flex items-center gap-2">
						<Input
							aria-label="Phase"
							maxLength={PROPOSAL_UI.limits.title}
							placeholder="Phase"
							value={row.phase}
							onChange={(event) =>
								update(index, { ...row, phase: event.target.value })
							}
						/>
						<Input
							aria-label="Duration"
							maxLength={PROPOSAL_UI.limits.duration}
							placeholder="Days 1-2"
							value={row.duration}
							onChange={(event) =>
								update(index, { ...row, duration: event.target.value })
							}
						/>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							aria-label={`Remove ${row.phase || "row"}`}
							onClick={() => {
								onChange(rows.filter((_, at) => at !== index));
								setKeys(keys.filter((_, at) => at !== index));
							}}
						>
							<Icon icon={Close} />
						</Button>
					</div>
				))}
				<div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => {
							onChange([...rows, { phase: "", duration: "" }]);
							setKeys([...keys, crypto.randomUUID()]);
						}}
					>
						<Icon icon={Add} data-icon="inline-start" />
						Add row
					</Button>
				</div>
			</div>
		</FieldSet>
	);
}

export function ProposalContentEditor({
	value,
	onChange,
}: {
	value: ProposalContent;
	onChange: (value: ProposalContent) => void;
}) {
	const titleId = useId();
	const set = <Key extends keyof ProposalContent>(
		key: Key,
		next: ProposalContent[Key],
	) => onChange({ ...value, [key]: next });

	return (
		<FieldGroup>
			<Field>
				<FieldLabel htmlFor={titleId}>Service title</FieldLabel>
				<Input
					id={titleId}
					maxLength={PROPOSAL_UI.limits.title}
					value={value.title}
					onChange={(event) => set("title", event.target.value)}
					required
				/>
			</Field>
			<TextField
				label="Pitch"
				description='Completes "For {client}, we propose …".'
				rows={2}
				value={value.pitch}
				onChange={(next) => set("pitch", next)}
			/>
			<TextField
				label="Understanding your challenge"
				value={value.challenge}
				onChange={(next) => set("challenge", next)}
			/>
			<LinesField
				label="The risk of not acting"
				value={value.risks}
				onChange={(next) => set("risks", next)}
			/>
			<TextField
				label="Objective"
				value={value.objective}
				onChange={(next) => set("objective", next)}
			/>
			<ScopeField value={value.scope} onChange={(next) => set("scope", next)} />
			<TextField
				label="Methodology introduction"
				rows={2}
				value={value.methodologyIntro}
				onChange={(next) => set("methodologyIntro", next)}
			/>
			<GroupsField
				legend="Methodology phases"
				nameLabel="Phase name"
				itemsLabel="Steps"
				addLabel="Add phase"
				groups={value.phases.map((phase) => ({
					name: phase.name,
					items: phase.steps,
				}))}
				onChange={(groups) =>
					set(
						"phases",
						groups.map((group) => ({ name: group.name, steps: group.items })),
					)
				}
			/>
			<TextField
				label="Compliance support"
				rows={2}
				value={value.compliance}
				onChange={(next) => set("compliance", next)}
			/>
			<GroupsField
				legend="Deliverables"
				nameLabel="Deliverable"
				itemsLabel="Items"
				addLabel="Add deliverable"
				groups={value.deliverables}
				onChange={(groups) => set("deliverables", groups)}
			/>
			<TextField
				label="Out of scope"
				value={value.outOfScope}
				onChange={(next) => set("outOfScope", next)}
			/>
			<ScheduleField
				rows={value.schedule}
				onChange={(next) => set("schedule", next)}
			/>
			<TextField
				label="Effort note"
				rows={2}
				value={value.effortNote}
				onChange={(next) => set("effortNote", next)}
			/>
			<LinesField
				label="Requirements from client"
				value={value.requirements}
				onChange={(next) => set("requirements", next)}
			/>
			<TextField
				label="Test accounts"
				value={value.testAccounts}
				onChange={(next) => set("testAccounts", next)}
			/>
			<LinesField
				label="What's included"
				value={value.included}
				onChange={(next) => set("included", next)}
			/>
		</FieldGroup>
	);
}

"use client";

import { Button } from "@crm/ui/components/button";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@crm/ui/components/sheet";
import { Spinner } from "@crm/ui/components/spinner";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { ProposalContentEditor } from "./content-editor";
import {
	ExtrasEditor,
	LinesEditor,
	linesTotal,
	PaymentsEditor,
} from "./money-editors";
import { PROPOSAL_UI } from "./proposal-config";
import { downloadBase64, fitLogo } from "./proposal-files";
import { cleanContent, formatEur } from "./proposal-types";

type Draft = RouterOutputs["proposals"]["draft"];

export type ProposalSource =
	| { kind: "service"; serviceId: string }
	| { kind: "version"; proposalId: string; version: number };

export type Generated = { total: string; version: number };

const NO_CONTACT = "none";

export function ProposalEditorSheet({
	dealId,
	companyId,
	source,
	onClose,
	onGenerated,
}: {
	dealId: string;
	companyId: string;
	source: ProposalSource;
	onClose: () => void;
	onGenerated: (generated: Generated) => void;
}) {
	const trpc = useTRPC();
	const draft = useQuery({
		...trpc.proposals.draft.queryOptions(
			source.kind === "service"
				? { dealId, serviceId: source.serviceId }
				: { dealId, fromProposalId: source.proposalId },
		),
		staleTime: 0,
		gcTime: 0,
	});
	const profile = useQuery(
		trpc.proposals.companyProfile.queryOptions({ companyId }),
	);

	return (
		<Sheet open onOpenChange={(open) => (open ? null : onClose())}>
			<SheetContent side="right" size="xl">
				<SheetHeader>
					<SheetTitle>
						{source.kind === "service"
							? "New proposal"
							: `New version from v${source.version}`}
					</SheetTitle>
					<SheetDescription>
						{draft.data
							? `Goes out as ${draft.data.issuer.name} for ${draft.data.clientName}. Changes here do not touch the catalog.`
							: "Preparing the proposal."}
					</SheetDescription>
				</SheetHeader>
				{draft.error ? (
					<p className="px-4 text-destructive">{draft.error.message}</p>
				) : draft.data && profile.data ? (
					<ProposalForm
						draft={draft.data}
						logo={profile.data.logo?.contentBase64 ?? null}
						onGenerated={(generated) => {
							onGenerated(generated);
							onClose();
						}}
					/>
				) : (
					<div className="flex flex-1 items-center justify-center">
						<Spinner />
					</div>
				)}
			</SheetContent>
		</Sheet>
	);
}

function ProposalForm({
	draft,
	logo,
	onGenerated,
}: {
	draft: Draft;
	logo: string | null;
	onGenerated: (generated: Generated) => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const templateId = useId();
	const numberId = useId();
	const dateId = useId();
	const contactId = useId();
	const nameId = useId();
	const positionId = useId();
	const jurisdictionId = useId();
	const jurisdictionTextId = useId();

	const [form, setForm] = useState({
		templateId: draft.templates[0]?.id ?? "",
		number: draft.number,
		date: draft.date,
		attentionContactId: draft.attentionContactId,
		attentionName: draft.attentionName,
		attentionPosition: draft.attentionPosition,
		jurisdiction: draft.jurisdiction,
		jurisdictionText: draft.jurisdictionText,
		content: draft.content,
		lines: draft.lines,
		extras: draft.extras,
		payments: draft.payments,
	});
	const [preparing, setPreparing] = useState(false);

	const set = <Key extends keyof typeof form>(
		key: Key,
		value: (typeof form)[Key],
	) => setForm((current) => ({ ...current, [key]: value }));

	const template = draft.templates.find((row) => row.id === form.templateId);
	const missingLogo = Boolean(template?.logoSlot) && logo === null;
	const total = linesTotal(form.lines);

	const generate = useMutation(
		trpc.proposals.generate.mutationOptions({
			onSuccess: async (result) => {
				downloadBase64(result.fileName, result.contentBase64);
				await cache.proposals();
				toast.success(`Version ${result.version} generated.`);
				onGenerated({ total: result.total, version: result.version });
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const submit = async () => {
		setPreparing(true);
		try {
			const logoBase64 =
				template?.logoSlot && logo
					? await fitLogo(logo, template.logoSlot)
					: null;
			generate.mutate({
				dealId: draft.dealId,
				serviceId: draft.serviceId,
				templateId: form.templateId,
				number: form.number,
				date: form.date,
				attentionContactId: form.attentionContactId,
				attentionName: form.attentionName,
				attentionPosition: form.attentionPosition,
				jurisdiction: form.jurisdiction,
				jurisdictionText: form.jurisdictionText,
				content: cleanContent(form.content),
				lines: form.lines,
				extras: form.extras.filter((extra) => extra.label.trim()),
				payments: form.payments,
				logoBase64,
			});
		} catch (error) {
			toast.error((error as Error).message);
		} finally {
			setPreparing(false);
		}
	};

	if (draft.templates.length === 0) {
		return (
			<p className="px-4 text-muted-foreground">
				{draft.issuer.name} has no Word template. Upload one in Settings →
				Proposals.
			</p>
		);
	}

	const busy = preparing || generate.isPending;

	return (
		<>
			<form
				id="proposal-form"
				className="flex-1 overflow-y-auto px-4"
				onSubmit={(event) => {
					event.preventDefault();
					void submit();
				}}
			>
				<FieldGroup>
					<FieldSet>
						<FieldLegend>Proposal</FieldLegend>
						<FieldGroup>
							{draft.templates.length > 1 ? (
								<Field>
									<FieldLabel htmlFor={templateId}>Template</FieldLabel>
									<Select
										value={form.templateId}
										onValueChange={(value) => set("templateId", value)}
									>
										<SelectTrigger id={templateId} className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{draft.templates.map((row) => (
												<SelectItem key={row.id} value={row.id}>
													{row.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</Field>
							) : null}
							<div className="grid gap-4 sm:grid-cols-2">
								<Field>
									<FieldLabel htmlFor={numberId}>Number</FieldLabel>
									<Input
										id={numberId}
										maxLength={PROPOSAL_UI.limits.shortText}
										value={form.number}
										onChange={(event) => set("number", event.target.value)}
										required
									/>
								</Field>
								<Field>
									<FieldLabel htmlFor={dateId}>Date</FieldLabel>
									<Input
										id={dateId}
										type="date"
										value={form.date}
										onChange={(event) => set("date", event.target.value)}
										required
									/>
								</Field>
							</div>
							<Field>
								<FieldLabel htmlFor={contactId}>A/C</FieldLabel>
								<Select
									value={form.attentionContactId ?? NO_CONTACT}
									onValueChange={(value) => {
										const contact = draft.contacts.find(
											(row) => row.id === value,
										);
										setForm((current) => ({
											...current,
											attentionContactId: contact?.id ?? null,
											attentionName: contact?.name ?? current.attentionName,
											attentionPosition:
												contact?.title ?? current.attentionPosition,
										}));
									}}
								>
									<SelectTrigger id={contactId} className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={NO_CONTACT}>Somebody else</SelectItem>
										{draft.contacts.map((contact) => (
											<SelectItem key={contact.id} value={contact.id}>
												{contact.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
							<div className="grid gap-4 sm:grid-cols-2">
								<Field>
									<FieldLabel htmlFor={nameId}>A/C name</FieldLabel>
									<Input
										id={nameId}
										maxLength={PROPOSAL_UI.limits.person}
										value={form.attentionName}
										onChange={(event) =>
											set("attentionName", event.target.value)
										}
									/>
								</Field>
								<Field>
									<FieldLabel htmlFor={positionId}>A/C position</FieldLabel>
									<Input
										id={positionId}
										maxLength={PROPOSAL_UI.limits.person}
										value={form.attentionPosition}
										onChange={(event) =>
											set("attentionPosition", event.target.value)
										}
									/>
								</Field>
							</div>
							<Field>
								<FieldLabel htmlFor={jurisdictionId}>Jurisdiction</FieldLabel>
								<Select
									value={form.jurisdiction}
									onValueChange={(value) => {
										const next = value as "PT" | "ES";
										setForm((current) => ({
											...current,
											jurisdiction: next,
											jurisdictionText: draft.jurisdictionTexts[next],
										}));
									}}
								>
									<SelectTrigger id={jurisdictionId} className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="PT">Portugal</SelectItem>
										<SelectItem value="ES">Spain</SelectItem>
									</SelectContent>
								</Select>
							</Field>
							<Field>
								<FieldLabel htmlFor={jurisdictionTextId}>
									Legal authorization text
								</FieldLabel>
								<Textarea
									id={jurisdictionTextId}
									rows={2}
									value={form.jurisdictionText}
									onChange={(event) =>
										set("jurisdictionText", event.target.value)
									}
								/>
								<FieldDescription>
									Completes "safe harbor for authorized testing activities under
									…".
								</FieldDescription>
							</Field>
						</FieldGroup>
					</FieldSet>

					<LinesEditor
						value={form.lines}
						onChange={(lines) => set("lines", lines)}
						single
					/>
					<PaymentsEditor
						value={form.payments}
						onChange={(payments) => set("payments", payments)}
						total={total}
					/>
					<ExtrasEditor
						value={form.extras}
						onChange={(extras) => set("extras", extras)}
					/>

					<FieldSet>
						<FieldLegend>Content</FieldLegend>
						<ProposalContentEditor
							value={form.content}
							onChange={(content) => set("content", content)}
						/>
					</FieldSet>
				</FieldGroup>
			</form>
			<SheetFooter>
				{missingLogo ? (
					<p className="text-muted-foreground">
						This client has no logo. The logo space on the cover stays empty.
						Add one on the company to fill it.
					</p>
				) : null}
				<Button type="submit" form="proposal-form" disabled={busy}>
					{busy ? <Spinner data-icon="inline-start" /> : null}
					{missingLogo ? "Generate without logo" : "Generate"} ·{" "}
					{formatEur(total)}
				</Button>
			</SheetFooter>
		</>
	);
}

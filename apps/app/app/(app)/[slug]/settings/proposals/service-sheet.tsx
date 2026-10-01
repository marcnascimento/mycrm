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
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@crm/ui/components/sheet";
import { Spinner } from "@crm/ui/components/spinner";
import { Switch } from "@crm/ui/components/switch";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { ProposalContentEditor } from "@/components/crm/proposals/content-editor";
import { ExtrasEditor } from "@/components/crm/proposals/money-editors";
import { PROPOSAL_UI } from "@/components/crm/proposals/proposal-config";
import {
	cleanContent,
	EMPTY_CONTENT,
	type ProposalContent,
	type ProposalExtra,
} from "@/components/crm/proposals/proposal-types";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

type IssuerOption = { id: string; name: string; active: boolean };

type PriceDraft = {
	offered: boolean;
	amount: string;
	extras: ProposalExtra[];
};

type ServiceDraft = {
	name: string;
	content: ProposalContent;
	prices: Record<string, PriceDraft>;
};

export function ServiceSheet({
	serviceId,
	onClose,
}: {
	serviceId: string | null;
	onClose: () => void;
}) {
	const trpc = useTRPC();
	const issuers = useQuery(trpc.proposals.issuers.queryOptions());
	const service = useQuery({
		...trpc.proposals.service.queryOptions({ id: serviceId ?? "" }),
		enabled: serviceId !== null,
	});

	const ready = issuers.data && (serviceId === null || service.data);
	const options: IssuerOption[] = (issuers.data ?? []).map((issuer) => ({
		id: issuer.id,
		name: issuer.name,
		active: issuer.active,
	}));

	const initial: ServiceDraft | null = ready
		? {
				name: service.data?.name ?? "",
				content: service.data?.content ?? EMPTY_CONTENT,
				prices: Object.fromEntries(
					options.map((issuer) => {
						const price = service.data?.prices.find(
							(row) => row.issuerId === issuer.id,
						);
						return [
							issuer.id,
							{
								offered: Boolean(price),
								amount: price?.amount ?? "",
								extras: price?.extras ?? [],
							},
						];
					}),
				),
			}
		: null;

	return (
		<Sheet open onOpenChange={(open) => (open ? null : onClose())}>
			<SheetContent side="right" size="xl">
				<SheetHeader>
					<SheetTitle>{serviceId ? "Edit service" : "New service"}</SheetTitle>
					<SheetDescription>
						Proposals copy this text and price. Changing it later does not
						change proposals already made.
					</SheetDescription>
				</SheetHeader>
				{initial ? (
					<ServiceForm
						serviceId={serviceId}
						initial={initial}
						issuers={options}
						onDone={onClose}
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

function ServiceForm({
	serviceId,
	initial,
	issuers,
	onDone,
}: {
	serviceId: string | null;
	initial: ServiceDraft;
	issuers: IssuerOption[];
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const nameId = useId();
	const [draft, setDraft] = useState(initial);

	const save = useMutation(
		trpc.proposals.saveService.mutationOptions({
			onSuccess: async (saved) => {
				await cache.proposals();
				toast.success(`${saved.name} saved.`);
				onDone();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const setPrice = (issuerId: string, next: PriceDraft) =>
		setDraft({ ...draft, prices: { ...draft.prices, [issuerId]: next } });

	return (
		<>
			<form
				id="service-form"
				className="flex-1 overflow-y-auto px-4"
				onSubmit={(event) => {
					event.preventDefault();
					save.mutate({
						id: serviceId ?? undefined,
						name: draft.name,
						content: cleanContent(draft.content),
						prices: Object.entries(draft.prices)
							.filter(([, price]) => price.offered)
							.map(([issuerId, price]) => ({
								issuerId,
								amount: price.amount,
								extras: price.extras.filter((extra) => extra.label.trim()),
							})),
					});
				}}
			>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor={nameId}>Catalog name</FieldLabel>
						<Input
							id={nameId}
							maxLength={PROPOSAL_UI.limits.catalogName}
							value={draft.name}
							onChange={(event) =>
								setDraft({ ...draft, name: event.target.value })
							}
							required
						/>
						<FieldDescription>
							How you find it in the catalog. The document prints the service
							title below.
						</FieldDescription>
					</Field>

					{issuers.map((issuer) => {
						const price = draft.prices[issuer.id] ?? {
							offered: false,
							amount: "",
							extras: [],
						};
						return (
							<PriceFields
								key={issuer.id}
								issuer={issuer}
								price={price}
								onChange={(next) => setPrice(issuer.id, next)}
							/>
						);
					})}

					<ProposalContentEditor
						value={draft.content}
						onChange={(content) => setDraft({ ...draft, content })}
					/>
				</FieldGroup>
			</form>
			<SheetFooter>
				<Button type="submit" form="service-form" disabled={save.isPending}>
					{save.isPending ? <Spinner data-icon="inline-start" /> : null}
					Save service
				</Button>
			</SheetFooter>
		</>
	);
}

function PriceFields({
	issuer,
	price,
	onChange,
}: {
	issuer: IssuerOption;
	price: PriceDraft;
	onChange: (next: PriceDraft) => void;
}) {
	const offeredId = useId();
	const amountId = useId();

	return (
		<FieldSet>
			<FieldLegend variant="label">
				{issuer.name}
				{issuer.active ? "" : " (deactivated)"}
			</FieldLegend>
			<div className="flex flex-col gap-3 rounded-lg border p-3">
				<Field orientation="horizontal">
					<Switch
						id={offeredId}
						checked={price.offered}
						onCheckedChange={(offered) => onChange({ ...price, offered })}
					/>
					<FieldLabel htmlFor={offeredId}>
						{issuer.name} offers this service
					</FieldLabel>
				</Field>
				{price.offered ? (
					<>
						<Field>
							<FieldLabel htmlFor={amountId}>Price in euros</FieldLabel>
							<Input
								id={amountId}
								inputMode="decimal"
								placeholder="5200.00"
								value={price.amount}
								onChange={(event) =>
									onChange({
										...price,
										amount: event.target.value.replace(",", "."),
									})
								}
								required
							/>
						</Field>
						<ExtrasEditor
							value={price.extras}
							onChange={(extras) => onChange({ ...price, extras })}
						/>
					</>
				) : null}
			</div>
		</FieldSet>
	);
}

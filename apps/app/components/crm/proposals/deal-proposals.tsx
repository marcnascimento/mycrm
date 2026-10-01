"use client";

import DocumentIcon from "@carbon/icons-react/es/Document";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@crm/ui/components/alert-dialog";
import { Button } from "@crm/ui/components/button";
import { Checkbox } from "@crm/ui/components/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Field, FieldDescription, FieldLabel } from "@crm/ui/components/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import {
	SimpleTable,
	type SimpleTableColumn,
	SimpleTableRow,
} from "@crm/ui/components/simple-table";
import { TableCell } from "@crm/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import {
	DetailSheetBody,
	DetailSheetEmpty,
	DetailSheetSection,
} from "@/components/detail-sheet";
import { dealStageLabel } from "@/lib/deal-stage";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { IssuerSelect } from "./company-proposal-profile";
import { PROPOSAL_UI } from "./proposal-config";
import {
	type Generated,
	ProposalEditorSheet,
	type ProposalSource,
} from "./proposal-editor";
import { downloadBase64, fileToBase64 } from "./proposal-files";
import { formatEur } from "./proposal-types";

type Version = RouterOutputs["proposals"]["forDeal"]["versions"][number];
type Status = Version["status"];
type Suggestion = RouterOutputs["proposals"]["setStatus"]["suggestion"];

const STATUS_LABEL = {
	DRAFT: "Draft",
	SENT: "Sent",
	ACCEPTED: "Accepted",
	REJECTED: "Rejected",
} as const satisfies Record<Status, string>;

const CELL = "px-3 py-2.5 align-middle";

const COLUMNS: SimpleTableColumn[] = [
	{ id: "version", header: "Version", width: "w-16" },
	{ id: "number", header: "Number" },
	{ id: "status", header: "Status", width: "w-32" },
	{ id: "total", header: "Total", width: "w-24", align: "right" },
	{ id: "date", header: "Date", width: "w-24" },
	{ id: "actions", srLabel: "Actions", width: "w-28" },
];

export function DealProposals({ dealId }: { dealId: string }) {
	const trpc = useTRPC();
	const access = useQuery(trpc.proposals.access.queryOptions());

	if (!access.data?.canManage) return null;

	return (
		<DealProposalsPanel
			dealId={dealId}
			maxFileBytes={access.data.maxFileBytes}
		/>
	);
}

function DealProposalsPanel({
	dealId,
	maxFileBytes,
}: {
	dealId: string;
	maxFileBytes: number;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const serviceId = useId();
	const issuerId = useId();
	const [source, setSource] = useState<ProposalSource | null>(null);
	const [amountOffer, setAmountOffer] = useState<Generated | null>(null);
	const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

	const proposals = useQuery(trpc.proposals.forDeal.queryOptions({ dealId }));
	const services = useQuery(
		trpc.proposals.services.queryOptions({ archived: false }),
	);

	const updateDeal = useMutation(
		trpc.deals.update.mutationOptions({
			onSuccess: async () => {
				await cache.deal(dealId);
				toast.success("Deal amount updated.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const setStage = useMutation(
		trpc.deals.setStage.mutationOptions({
			onSuccess: async () => {
				await cache.deal(dealId);
				toast.success("Deal stage updated.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!proposals.data) return null;

	const { issuer, companyId, companyName, versions } = proposals.data;
	const offered = (services.data ?? []).filter((service) =>
		service.prices.some((price) => price.issuerId === issuer?.id),
	);

	return (
		<DetailSheetBody>
			{issuer ? (
				<DetailSheetSection title={`Issued as ${issuer.name}`}>
					<Field>
						<FieldLabel htmlFor={serviceId}>
							New proposal from a service
						</FieldLabel>
						<Select
							value=""
							onValueChange={(value) =>
								setSource({ kind: "service", serviceId: value })
							}
						>
							<SelectTrigger id={serviceId} className="w-full">
								<SelectValue placeholder="Choose a service" />
							</SelectTrigger>
							<SelectContent>
								{offered.map((service) => (
									<SelectItem key={service.id} value={service.id}>
										{service.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<FieldDescription>
							{offered.length === 0
								? `No service has a price for ${issuer.name}. Add one in Settings → Proposals.`
								: `Only services with a price for ${issuer.name} are listed.`}
						</FieldDescription>
					</Field>
				</DetailSheetSection>
			) : (
				<DetailSheetSection title="Set the issuer first">
					<Field>
						<FieldLabel htmlFor={issuerId}>Issuer of {companyName}</FieldLabel>
						<IssuerSelect companyId={companyId} id={issuerId} />
						<FieldDescription>
							Every proposal for this client goes out in the name of this
							company.
						</FieldDescription>
					</Field>
				</DetailSheetSection>
			)}

			{versions.length === 0 ? (
				<DetailSheetEmpty
					icon={DocumentIcon}
					title="No proposal yet"
					description="Each proposal you generate stays here as a version."
				/>
			) : (
				<SimpleTable variant="panel" columns={COLUMNS}>
					{versions.map((version) => (
						<VersionRow
							key={version.id}
							version={version}
							maxFileBytes={maxFileBytes}
							canCopy={issuer !== null}
							onCopy={() =>
								setSource({
									kind: "version",
									proposalId: version.id,
									version: version.version,
								})
							}
							onSuggestion={setSuggestion}
						/>
					))}
				</SimpleTable>
			)}

			{source ? (
				<ProposalEditorSheet
					key={source.kind === "service" ? source.serviceId : source.proposalId}
					dealId={dealId}
					companyId={companyId}
					source={source}
					onClose={() => setSource(null)}
					onGenerated={setAmountOffer}
				/>
			) : null}

			<AlertDialog
				open={amountOffer !== null}
				onOpenChange={(open) => (open ? null : setAmountOffer(null))}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Update the deal amount to {formatEur(amountOffer?.total ?? 0)}?
						</AlertDialogTitle>
						<AlertDialogDescription>
							Version {amountOffer?.version} totals{" "}
							{formatEur(amountOffer?.total ?? 0)}. The deal amount is set in
							EUR and converted for reports.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Keep the deal as it is</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (!amountOffer) return;
								updateDeal.mutate({
									id: dealId,
									data: {
										amountCents: Math.round(Number(amountOffer.total) * 100),
										currency: "EUR",
									},
								});
								setAmountOffer(null);
							}}
						>
							Update amount
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{suggestion?.stage ? (
				<StageSuggestion
					suggestion={suggestion}
					onClose={() => setSuggestion(null)}
					onApply={(applyAmount) => {
						if (suggestion.stage) {
							setStage.mutate({ id: dealId, stage: suggestion.stage });
						}
						if (applyAmount && suggestion.amountCents !== null) {
							updateDeal.mutate({
								id: dealId,
								data: { amountCents: suggestion.amountCents, currency: "EUR" },
							});
						}
						setSuggestion(null);
					}}
				/>
			) : null}
		</DetailSheetBody>
	);
}

function StageSuggestion({
	suggestion,
	onClose,
	onApply,
}: {
	suggestion: Suggestion;
	onClose: () => void;
	onApply: (applyAmount: boolean) => void;
}) {
	const amountId = useId();
	const [applyAmount, setApplyAmount] = useState(true);
	const stage = suggestion.stage;

	return (
		<AlertDialog open onOpenChange={(open) => (open ? null : onClose())}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						Move the deal to {stage ? dealStageLabel(stage) : ""}?
					</AlertDialogTitle>
					<AlertDialogDescription>
						The proposal status changed. The deal changes only if you confirm.
					</AlertDialogDescription>
				</AlertDialogHeader>
				{suggestion.amountCents !== null ? (
					<div className="flex items-center gap-2">
						<Checkbox
							id={amountId}
							checked={applyAmount}
							onCheckedChange={(checked) => setApplyAmount(checked === true)}
						/>
						<label htmlFor={amountId}>
							Also set the deal amount to{" "}
							{formatEur(suggestion.amountCents / 100)}
						</label>
					</div>
				) : null}
				<AlertDialogFooter>
					<AlertDialogCancel>Keep the deal as it is</AlertDialogCancel>
					<AlertDialogAction onClick={() => onApply(applyAmount)}>
						Move deal
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

function VersionRow({
	version,
	maxFileBytes,
	canCopy,
	onCopy,
	onSuggestion,
}: {
	version: Version;
	maxFileBytes: number;
	canCopy: boolean;
	onCopy: () => void;
	onSuggestion: (suggestion: Suggestion) => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const queryClient = useQueryClient();
	const fileInput = useRef<HTMLInputElement>(null);

	const setStatus = useMutation(
		trpc.proposals.setStatus.mutationOptions({
			onSuccess: async (result) => {
				await cache.proposals();
				if (result.suggestion.stage) onSuggestion(result.suggestion);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const uploadFinal = useMutation(
		trpc.proposals.uploadFinal.mutationOptions({
			onSuccess: async () => {
				await cache.proposals();
				toast.success(`Final file attached to v${version.version}.`);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const download = async (which: "preferred" | "generated" | "final") => {
		try {
			const file = await queryClient.fetchQuery({
				...trpc.proposals.download.queryOptions({ id: version.id, which }),
				staleTime: 0,
			});
			downloadBase64(file.fileName, file.contentBase64);
		} catch (error) {
			toast.error((error as Error).message);
		}
	};

	const pick = async (file: File | undefined) => {
		if (!file) return;
		if (!file.name.toLowerCase().endsWith(".docx")) {
			toast.error("Only Word documents (.docx) are accepted.");
			return;
		}
		if (file.size > maxFileBytes) {
			toast.error("The file is too large.");
			return;
		}
		uploadFinal.mutate({
			id: version.id,
			fileName: file.name,
			contentBase64: await fileToBase64(file),
		});
	};

	return (
		<SimpleTableRow>
			<TableCell className={`${CELL} tabular-nums`}>
				v{version.version}
			</TableCell>
			<TableCell className={CELL}>
				<div className="flex flex-col">
					<span className="font-medium">{version.number}</span>
					<span className="text-muted-foreground">
						{version.issuerName}
						{version.finalFileName ? " · final file attached" : ""}
					</span>
				</div>
			</TableCell>
			<TableCell className={CELL}>
				<Select
					value={version.status}
					disabled={setStatus.isPending}
					onValueChange={(status) =>
						setStatus.mutate({ id: version.id, status: status as Status })
					}
				>
					<SelectTrigger size="sm" aria-label={`Status of v${version.version}`}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{(Object.keys(STATUS_LABEL) as Status[]).map((status) => (
							<SelectItem key={status} value={status}>
								{STATUS_LABEL[status]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</TableCell>
			<TableCell className={`${CELL} text-right tabular-nums`}>
				{formatEur(version.total)}
			</TableCell>
			<TableCell className={`${CELL} text-muted-foreground tabular-nums`}>
				{version.date.split("-").reverse().join("-")}
			</TableCell>
			<TableCell className={CELL}>
				<input
					ref={fileInput}
					type="file"
					accept={PROPOSAL_UI.docx.accept}
					className="hidden"
					onChange={(event) => {
						void pick(event.target.files?.[0]);
						event.target.value = "";
					}}
				/>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="sm">
							Actions
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onSelect={() => void download("preferred")}>
							{version.finalFileName ? "Download final file" : "Download"}
						</DropdownMenuItem>
						{version.finalFileName ? (
							<DropdownMenuItem onSelect={() => void download("generated")}>
								Download generated file
							</DropdownMenuItem>
						) : null}
						<DropdownMenuItem onSelect={() => fileInput.current?.click()}>
							{version.finalFileName
								? "Replace final file"
								: "Upload final file"}
						</DropdownMenuItem>
						{canCopy ? (
							<DropdownMenuItem onSelect={onCopy}>
								New version from v{version.version}
							</DropdownMenuItem>
						) : null}
					</DropdownMenuContent>
				</DropdownMenu>
			</TableCell>
		</SimpleTableRow>
	);
}

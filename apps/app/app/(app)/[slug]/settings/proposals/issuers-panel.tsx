"use client";

import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import {
	SimpleTable,
	type SimpleTableColumn,
	SimpleTableRow,
} from "@crm/ui/components/simple-table";
import { Spinner } from "@crm/ui/components/spinner";
import { Switch } from "@crm/ui/components/switch";
import { TableCell } from "@crm/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { PaymentsEditor } from "@/components/crm/proposals/money-editors";
import { PROPOSAL_UI } from "@/components/crm/proposals/proposal-config";
import {
	downloadBase64,
	fileToBase64,
} from "@/components/crm/proposals/proposal-files";
import type { ProposalPayment } from "@/components/crm/proposals/proposal-types";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type Issuer = RouterOutputs["proposals"]["issuers"][number];

const DEFAULT_PAYMENTS: ProposalPayment[] = [
	{ percent: 50, label: "deposit required to schedule testing" },
	{ percent: 50, label: "final payment upon delivery" },
];

const CELL = "px-3 py-2.5 align-middle";

const TEMPLATE_COLUMNS: SimpleTableColumn[] = [
	{ id: "name", header: "Template" },
	{ id: "markers", header: "Markers", width: "w-24", align: "right" },
	{ id: "logo", header: "Client logo", width: "w-28" },
	{ id: "actions", srLabel: "Actions", width: "w-44" },
];

function megabytes(bytes: number): string {
	return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

export function IssuersPanel({ maxFileBytes }: { maxFileBytes: number }) {
	const trpc = useTRPC();
	const issuers = useQuery(trpc.proposals.issuers.queryOptions());

	return (
		<div className="flex flex-col gap-6">
			{(issuers.data ?? []).map((issuer) => (
				<IssuerCard
					key={issuer.id}
					issuer={issuer}
					maxFileBytes={maxFileBytes}
				/>
			))}
			<NewIssuerCard />
		</div>
	);
}

function NewIssuerCard() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const nameId = useId();
	const prefixId = useId();
	const [name, setName] = useState("");
	const [prefix, setPrefix] = useState("MMN-");
	const [payments, setPayments] = useState(DEFAULT_PAYMENTS);

	const create = useMutation(
		trpc.proposals.createIssuer.mutationOptions({
			onSuccess: async () => {
				await cache.proposals();
				toast.success(`${name} added.`);
				setName("");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>New issuer</CardTitle>
				<CardDescription>
					A company you issue proposals for. Each client belongs to one issuer.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					id="new-issuer"
					onSubmit={(event) => {
						event.preventDefault();
						create.mutate({
							name,
							numberPrefix: prefix,
							defaultPayments: payments,
						});
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={nameId}>Name</FieldLabel>
							<Input
								id={nameId}
								maxLength={PROPOSAL_UI.limits.shortText}
								value={name}
								onChange={(event) => setName(event.target.value)}
								required
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={prefixId}>Proposal number prefix</FieldLabel>
							<Input
								id={prefixId}
								maxLength={PROPOSAL_UI.limits.prefix}
								value={prefix}
								onChange={(event) => setPrefix(event.target.value)}
							/>
							<FieldDescription>
								A new proposal's number starts with this. You complete it.
							</FieldDescription>
						</Field>
						<PaymentsEditor value={payments} onChange={setPayments} />
					</FieldGroup>
				</form>
			</CardContent>
			<CardFooter>
				<Button
					type="submit"
					form="new-issuer"
					disabled={create.isPending || name.trim() === ""}
				>
					{create.isPending ? <Spinner data-icon="inline-start" /> : null}
					Add issuer
				</Button>
			</CardFooter>
		</Card>
	);
}

function IssuerCard({
	issuer,
	maxFileBytes,
}: {
	issuer: Issuer;
	maxFileBytes: number;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const nameId = useId();
	const prefixId = useId();
	const activeId = useId();
	const [name, setName] = useState(issuer.name);
	const [prefix, setPrefix] = useState(issuer.numberPrefix);
	const [active, setActive] = useState(issuer.active);
	const [payments, setPayments] = useState<ProposalPayment[]>(
		issuer.defaultPayments.length > 0
			? issuer.defaultPayments
			: DEFAULT_PAYMENTS,
	);

	const update = useMutation(
		trpc.proposals.updateIssuer.mutationOptions({
			onSuccess: async () => {
				await cache.proposals();
				toast.success(`${name} saved.`);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const remove = useMutation(
		trpc.proposals.deleteIssuer.mutationOptions({
			onSuccess: async () => {
				await cache.proposals();
				toast.success(`${issuer.name} deleted.`);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const inUse = issuer.clients + issuer.proposals + issuer.templates.length > 0;
	const formId = `issuer-${issuer.id}`;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{issuer.name}</CardTitle>
				<CardDescription>
					{issuer.clients} {issuer.clients === 1 ? "client" : "clients"} ·{" "}
					{issuer.proposals} {issuer.proposals === 1 ? "proposal" : "proposals"}
				</CardDescription>
				<CardAction>
					<Badge variant={issuer.active ? "secondary" : "outline"}>
						{issuer.active ? "Active" : "Deactivated"}
					</Badge>
				</CardAction>
			</CardHeader>
			<CardContent className="flex flex-col gap-6">
				<form
					id={formId}
					onSubmit={(event) => {
						event.preventDefault();
						update.mutate({
							id: issuer.id,
							name,
							numberPrefix: prefix,
							active,
							defaultPayments: payments,
						});
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={nameId}>Name</FieldLabel>
							<Input
								id={nameId}
								maxLength={PROPOSAL_UI.limits.shortText}
								value={name}
								onChange={(event) => setName(event.target.value)}
								required
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={prefixId}>Proposal number prefix</FieldLabel>
							<Input
								id={prefixId}
								maxLength={PROPOSAL_UI.limits.prefix}
								value={prefix}
								onChange={(event) => setPrefix(event.target.value)}
							/>
						</Field>
						<Field orientation="horizontal">
							<Switch
								id={activeId}
								checked={active}
								onCheckedChange={setActive}
							/>
							<FieldLabel htmlFor={activeId}>Active</FieldLabel>
						</Field>
						<PaymentsEditor value={payments} onChange={setPayments} />
					</FieldGroup>
				</form>
				<Templates issuer={issuer} maxFileBytes={maxFileBytes} />
			</CardContent>
			<CardFooter className="gap-2">
				<Button type="submit" form={formId} disabled={update.isPending}>
					{update.isPending ? <Spinner data-icon="inline-start" /> : null}
					Save
				</Button>
				{inUse ? null : (
					<Button
						type="button"
						variant="destructive"
						disabled={remove.isPending}
						onClick={() => remove.mutate({ id: issuer.id })}
					>
						Delete
					</Button>
				)}
			</CardFooter>
		</Card>
	);
}

function Templates({
	issuer,
	maxFileBytes,
}: {
	issuer: Issuer;
	maxFileBytes: number;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const nameId = useId();
	const fileInput = useRef<HTMLInputElement>(null);
	const [templateName, setTemplateName] = useState("");
	const [lastMarkers, setLastMarkers] = useState<string[] | null>(null);
	const templates = issuer.templates.filter((template) => !template.archived);

	const upload = useMutation(
		trpc.proposals.uploadTemplate.mutationOptions({
			onSuccess: async (template) => {
				await cache.proposals();
				setTemplateName("");
				setLastMarkers(template.markers);
				toast.success(`${template.name} uploaded.`);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const archive = useMutation(
		trpc.proposals.archiveTemplate.mutationOptions({
			onSuccess: async () => {
				await cache.proposals();
				toast.success("Template archived.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const queryClient = useQueryClient();
	const download = async (id: string) => {
		try {
			const file = await queryClient.fetchQuery({
				...trpc.proposals.downloadTemplate.queryOptions({ id }),
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
			toast.error(`The file is larger than ${megabytes(maxFileBytes)}.`);
			return;
		}
		upload.mutate({
			issuerId: issuer.id,
			name: templateName.trim() || file.name.replace(/\.docx$/i, ""),
			fileName: file.name,
			contentBase64: await fileToBase64(file),
		});
	};

	return (
		<div className="flex flex-col gap-3">
			<h3 className="font-medium">Word templates</h3>
			{templates.length > 0 ? (
				<SimpleTable variant="panel" columns={TEMPLATE_COLUMNS}>
					{templates.map((template) => (
						<SimpleTableRow key={template.id}>
							<TableCell className={CELL}>
								<div className="flex flex-col">
									<span className="font-medium">{template.name}</span>
									<span className="text-muted-foreground">
										{template.fileName}
									</span>
								</div>
							</TableCell>
							<TableCell className={`${CELL} text-right tabular-nums`}>
								{template.markers.length}
							</TableCell>
							<TableCell className={CELL}>
								{template.logoSlot ? "Yes" : "No"}
							</TableCell>
							<TableCell className={CELL}>
								<div className="flex justify-end gap-1">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => void download(template.id)}
									>
										Download
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										disabled={archive.isPending}
										onClick={() => archive.mutate({ id: template.id })}
									>
										Archive
									</Button>
								</div>
							</TableCell>
						</SimpleTableRow>
					))}
				</SimpleTable>
			) : (
				<p className="text-muted-foreground">
					No template yet. Upload the Word file with the markers from the marker
					guide.
				</p>
			)}
			<div className="flex flex-wrap items-end gap-3">
				<Field className="max-w-xs">
					<FieldLabel htmlFor={nameId}>Template name</FieldLabel>
					<Input
						id={nameId}
						maxLength={PROPOSAL_UI.limits.shortText}
						placeholder="Pentest proposal"
						value={templateName}
						onChange={(event) => setTemplateName(event.target.value)}
					/>
				</Field>
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
				<Button
					type="button"
					variant="outline"
					disabled={upload.isPending}
					onClick={() => fileInput.current?.click()}
				>
					{upload.isPending ? <Spinner data-icon="inline-start" /> : null}
					Upload .docx
				</Button>
			</div>
			{lastMarkers ? (
				<p className="text-muted-foreground">
					Markers found: {lastMarkers.map((marker) => `{${marker}}`).join(" ")}
				</p>
			) : null}
		</div>
	);
}

"use client";

import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { CardTableEmpty } from "@crm/ui/components/card-table";
import {
	SimpleTable,
	type SimpleTableColumn,
	SimpleTableRow,
} from "@crm/ui/components/simple-table";
import { Switch } from "@crm/ui/components/switch";
import { TableCell } from "@crm/ui/components/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { formatEur } from "@/components/crm/proposals/proposal-types";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { ServiceSheet } from "./service-sheet";

const CELL = "px-3 py-2.5 align-middle";

const COLUMNS: SimpleTableColumn[] = [
	{ id: "name", header: "Service" },
	{ id: "prices", header: "Prices" },
	{ id: "actions", srLabel: "Actions", width: "w-40" },
];

type Editing = { id: string | null } | null;

export function ServicesPanel() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const archivedId = useId();
	const [archived, setArchived] = useState(false);
	const [editing, setEditing] = useState<Editing>(null);

	const services = useQuery(trpc.proposals.services.queryOptions({ archived }));

	const setArchivedState = useMutation(
		trpc.proposals.archiveService.mutationOptions({
			onSuccess: async () => {
				await cache.proposals();
				toast.success("Service archived.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const restore = useMutation(
		trpc.proposals.restoreService.mutationOptions({
			onSuccess: async () => {
				await cache.proposals();
				toast.success("Service restored.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const rows = services.data ?? [];

	return (
		<Card>
			<CardHeader>
				<CardTitle>Services</CardTitle>
				<CardDescription>
					One catalog for every issuer. Each service keeps the text a proposal
					starts from, and a price per issuer.
				</CardDescription>
				<CardAction>
					<Button size="sm" onClick={() => setEditing({ id: null })}>
						New service
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="flex flex-col gap-3">
				<div className="flex items-center gap-2">
					<Switch
						id={archivedId}
						checked={archived}
						onCheckedChange={setArchived}
					/>
					<label htmlFor={archivedId}>Show archived services</label>
				</div>
				{rows.length === 0 ? (
					<CardTableEmpty>
						{archived ? "No archived service." : "No service yet."}
					</CardTableEmpty>
				) : (
					<SimpleTable variant="panel" columns={COLUMNS}>
						{rows.map((service) => (
							<SimpleTableRow key={service.id}>
								<TableCell className={`${CELL} font-medium`}>
									{service.name}
								</TableCell>
								<TableCell className={`${CELL} text-muted-foreground`}>
									{service.prices.length === 0
										? "No price"
										: service.prices
												.map(
													(price) =>
														`${price.issuerName} ${formatEur(price.amount)}`,
												)
												.join(" · ")}
								</TableCell>
								<TableCell className={CELL}>
									<div className="flex justify-end gap-1">
										<Button
											variant="ghost"
											size="sm"
											onClick={() => setEditing({ id: service.id })}
										>
											Edit
										</Button>
										{service.archived ? (
											<Button
												variant="ghost"
												size="sm"
												disabled={restore.isPending}
												onClick={() => restore.mutate({ id: service.id })}
											>
												Restore
											</Button>
										) : (
											<Button
												variant="ghost"
												size="sm"
												disabled={setArchivedState.isPending}
												onClick={() =>
													setArchivedState.mutate({ id: service.id })
												}
											>
												Archive
											</Button>
										)}
									</div>
								</TableCell>
							</SimpleTableRow>
						))}
					</SimpleTable>
				)}
			</CardContent>
			{editing ? (
				<ServiceSheet
					key={editing.id ?? "new"}
					serviceId={editing.id}
					onClose={() => setEditing(null)}
				/>
			) : null}
		</Card>
	);
}

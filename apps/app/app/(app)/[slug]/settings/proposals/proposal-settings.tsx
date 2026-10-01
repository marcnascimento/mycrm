"use client";

import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@crm/ui/components/tabs";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { IssuersPanel } from "./issuers-panel";
import { ServicesPanel } from "./services-panel";

export function ProposalSettings() {
	const trpc = useTRPC();
	const access = useQuery(trpc.proposals.access.queryOptions());

	if (!access.data) return null;

	if (!access.data.canManage) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Only the workspace owner uses proposals</CardTitle>
					<CardDescription>
						Issuers, templates, services and proposals are visible to the owner
						of this workspace only.
					</CardDescription>
				</CardHeader>
			</Card>
		);
	}

	return (
		<Tabs defaultValue="issuers">
			<TabsList>
				<TabsTrigger value="issuers">Issuers</TabsTrigger>
				<TabsTrigger value="services">Services</TabsTrigger>
			</TabsList>
			<TabsContent value="issuers">
				<IssuersPanel maxFileBytes={access.data.maxFileBytes} />
			</TabsContent>
			<TabsContent value="services">
				<ServicesPanel />
			</TabsContent>
		</Tabs>
	);
}

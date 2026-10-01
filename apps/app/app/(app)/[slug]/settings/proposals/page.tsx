import type { Metadata } from "next";
import { Suspense } from "react";
import {
	PageShell,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellLoading,
	PageShellTitle,
} from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { ProposalSettings } from "./proposal-settings";

export const metadata: Metadata = {
	title: "Proposals",
};

export default function ProposalsSettingsPage() {
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Proposals</PageShellTitle>
					<PageShellDescription>
						The companies you issue proposals for, their Word templates, and the
						services you sell with their prices.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<Proposals />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Proposals() {
	await requireSession();

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();

	await queryClient.prefetchQuery(trpc.proposals.access.queryOptions());

	return (
		<HydrateClient>
			<div className="flex max-w-4xl flex-col gap-6">
				<ProposalSettings />
			</div>
		</HydrateClient>
	);
}

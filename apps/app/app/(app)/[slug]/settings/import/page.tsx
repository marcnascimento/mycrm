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
import { ImportPanel } from "./import-panel";

export const metadata: Metadata = {
	title: "Import",
};

export default function ImportSettingsPage() {
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Import</PageShellTitle>
					<PageShellDescription>
						Carregue um CSV de empresas e contatos. Revise o relatório antes de
						confirmar — nada é gravado até você confirmar.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<Import />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Import() {
	await requireSession();

	return (
		<div className="flex max-w-3xl flex-col gap-6">
			<ImportPanel />
		</div>
	);
}

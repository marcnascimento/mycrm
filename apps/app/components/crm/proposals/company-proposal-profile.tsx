"use client";

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
import { EntityLogo } from "@crm/ui/components/entity-logo";
import { Field, FieldDescription, FieldLabel } from "@crm/ui/components/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { DetailSheetSection } from "@/components/detail-sheet";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { PROPOSAL_UI } from "./proposal-config";
import { imageFileToPng } from "./proposal-files";

const NONE = "none";

export function CompanyProposalProfile({ companyId }: { companyId: string }) {
	const trpc = useTRPC();
	const access = useQuery(trpc.proposals.access.queryOptions());

	if (!access.data?.canManage) return null;

	return (
		<ProposalProfileSection
			companyId={companyId}
			maxLogoBytes={access.data.maxLogoBytes}
		/>
	);
}

export function IssuerSelect({
	companyId,
	id,
}: {
	companyId: string;
	id?: string;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [pending, setPending] = useState<string | null>(null);

	const profile = useQuery(
		trpc.proposals.companyProfile.queryOptions({ companyId }),
	);
	const issuers = useQuery(trpc.proposals.issuers.queryOptions());

	const setIssuer = useMutation(
		trpc.proposals.setCompanyIssuer.mutationOptions({
			onSuccess: async (next) => {
				await cache.proposals();
				toast.success(
					next.issuerName
						? `Proposals for this client now go out as ${next.issuerName}.`
						: "This client has no issuer now.",
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!profile.data) return null;

	const current = profile.data.issuerId ?? NONE;
	const choose = (value: string) => {
		if (value === current) return;
		if (profile.data.proposals > 0) {
			setPending(value);
			return;
		}
		setIssuer.mutate({ companyId, issuerId: value === NONE ? null : value });
	};

	const active = (issuers.data ?? []).filter(
		(issuer) => issuer.active || issuer.id === profile.data.issuerId,
	);

	return (
		<>
			<Select
				value={current}
				disabled={setIssuer.isPending}
				onValueChange={choose}
			>
				<SelectTrigger id={id} className="w-full">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={NONE}>No issuer</SelectItem>
					{active.map((issuer) => (
						<SelectItem key={issuer.id} value={issuer.id}>
							{issuer.name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<AlertDialog
				open={pending !== null}
				onOpenChange={(open) => (open ? null : setPending(null))}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Change the issuer of this client?
						</AlertDialogTitle>
						<AlertDialogDescription>
							This client has {profile.data.proposals}{" "}
							{profile.data.proposals === 1 ? "proposal" : "proposals"}. They
							keep the issuer they were made with. New proposals use the new
							issuer.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (pending === null) return;
								setIssuer.mutate({
									companyId,
									issuerId: pending === NONE ? null : pending,
								});
								setPending(null);
							}}
						>
							Change issuer
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

function ProposalProfileSection({
	companyId,
	maxLogoBytes,
}: {
	companyId: string;
	maxLogoBytes: number;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const issuerId = useId();
	const fileInput = useRef<HTMLInputElement>(null);
	const profile = useQuery(
		trpc.proposals.companyProfile.queryOptions({ companyId }),
	);

	const setLogo = useMutation(
		trpc.proposals.setClientLogo.mutationOptions({
			onSuccess: async () => {
				await cache.proposals();
				toast.success("Logo saved for proposals.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const removeLogo = useMutation(
		trpc.proposals.removeClientLogo.mutationOptions({
			onSuccess: async () => {
				await cache.proposals();
				toast.success("Logo removed.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const pick = async (file: File | undefined) => {
		if (!file) return;
		try {
			const contentBase64 = await imageFileToPng(file);
			if ((contentBase64.length * 3) / 4 > maxLogoBytes) {
				toast.error("The logo is too large. Use a smaller image.");
				return;
			}
			setLogo.mutate({ companyId, contentBase64 });
		} catch (error) {
			toast.error((error as Error).message);
		}
	};

	const logo = profile.data?.logo ?? null;

	return (
		<DetailSheetSection title="Proposals">
			<Field>
				<FieldLabel htmlFor={issuerId}>Issuer</FieldLabel>
				<IssuerSelect companyId={companyId} id={issuerId} />
				<FieldDescription>
					Every proposal for this client goes out in the name of this company.
				</FieldDescription>
			</Field>
			<Field>
				<FieldLabel>Client logo</FieldLabel>
				{logo ? (
					<EntityLogo
						src={`data:image/png;base64,${logo.contentBase64}`}
						name="Client logo"
						size="xl"
					/>
				) : (
					<FieldDescription>
						No logo. Templates with a client logo print an empty space.
					</FieldDescription>
				)}
				<input
					ref={fileInput}
					type="file"
					accept={PROPOSAL_UI.logo.accept}
					className="hidden"
					onChange={(event) => {
						void pick(event.target.files?.[0]);
						event.target.value = "";
					}}
				/>
				<div className="flex gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={setLogo.isPending}
						onClick={() => fileInput.current?.click()}
					>
						{setLogo.isPending ? <Spinner data-icon="inline-start" /> : null}
						{logo ? "Replace logo" : "Upload logo"}
					</Button>
					{logo ? (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							disabled={removeLogo.isPending}
							onClick={() => removeLogo.mutate({ companyId })}
						>
							Remove
						</Button>
					) : null}
				</div>
			</Field>
		</DetailSheetSection>
	);
}

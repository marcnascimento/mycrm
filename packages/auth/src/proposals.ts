import type { WorkspaceRole } from "./organization";

export function canManageProposals(role: WorkspaceRole | null): boolean {
	return role === "owner";
}

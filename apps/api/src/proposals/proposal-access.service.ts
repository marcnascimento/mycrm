import { canManageProposals, workspaceRoleOf } from "@crm/auth";
import type { Db } from "@crm/db";
import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";

@Injectable()
export class ProposalAccessService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async canManage(userId: string): Promise<boolean> {
		return canManageProposals(await workspaceRoleOf(userId, this.db));
	}

	async requireOwner(userId: string): Promise<void> {
		if (!(await this.canManage(userId))) {
			throw new ForbiddenException(
				"Only the workspace owner can use proposals.",
			);
		}
	}
}

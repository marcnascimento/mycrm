import { Prisma } from "@crm/db";

export function prismaCode(cause: unknown): string | null {
	return cause instanceof Prisma.PrismaClientKnownRequestError
		? cause.code
		: null;
}

import { db } from "../src/client";
import {
	ACCOUNT_TYPE_OPTIONS,
	ensureFieldOptions,
	seedCompanyFields,
	seedContactCustomFields,
} from "./seed";

/**
 * Creates only the FieldDefinition/FieldOption rows the CSV importer needs
 * (Account type values, Lead source, and the four new Contact custom fields)
 * — none of the demo companies/contacts/deals that `seed.ts` also creates.
 * Safe to run against a real database: it never writes a Company, Contact,
 * Deal or FieldValue row, only field *definitions*, and every write here is
 * an idempotent upsert.
 */
async function main() {
	await seedCompanyFields();
	await ensureFieldOptions("COMPANY", "Account type", ACCOUNT_TYPE_OPTIONS);
	await seedContactCustomFields();

	console.log(
		"Seeded import field definitions (Account type, Lead source, Idioma, Evento de origem, Mensagem gancho, Abordagem sugerida).",
	);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await db.$disconnect();
	});

const KB = 1024;
const MB = 1024 * KB;

export const PROPOSALS = {
	files: {
		maxBytes: 3 * MB,
		docxMediaType:
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		pngMediaType: "image/png",
	},
	logo: {
		maxBytes: 1 * MB,
		slotDescr: "client_logo",
	},
	format: {
		thousands: ".",
		decimal: ",",
		currencySuffix: "€",
		currency: "EUR",
	},
	jurisdictions: {
		PT: "Lei do Cibercrime (Lei n.º 109/2009) and applicable Portuguese and EU law",
		ES: "applicable Spanish and EU law",
	},
} as const;

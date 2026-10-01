export const PROPOSAL_UI = {
	limits: {
		title: 300,
		shortText: 120,
		label: 300,
		lineDescription: 1000,
		duration: 120,
		unit: 60,
		prefix: 40,
		catalogName: 200,
		person: 200,
	},
	logo: {
		maxSide: 1000,
		margin: 0.12,
		accept: "image/png,image/jpeg,image/svg+xml",
	},
	docx: {
		accept:
			".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		mediaType:
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	},
} as const;

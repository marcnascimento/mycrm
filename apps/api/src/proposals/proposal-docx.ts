import Docxtemplater from "docxtemplater";
import InspectModule from "docxtemplater/js/inspect-module.js";
import PizZip from "pizzip";
import { z } from "zod";
import { PROPOSAL_MARKERS, type TemplateData } from "./proposal-data";
import { PROPOSALS } from "./proposals.config";

const TRANSPARENT_PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==",
	"base64",
);

const KNOWN_MARKERS = new Set<string>(PROPOSAL_MARKERS);

export type LogoSlot = { width: number; height: number };

type TemplateInspection = {
	markers: string[];
	unknown: string[];
	logoSlot: LogoSlot | null;
};

export class TemplateError extends Error {
	constructor(
		message: string,
		readonly details: string[],
	) {
		super(message);
	}
}

function openZip(file: Buffer): PizZip {
	try {
		return new PizZip(file);
	} catch {
		throw new TemplateError("The file is not a Word document (.docx).", []);
	}
}

function compile(zip: PizZip, modules: InspectModule[] = []): Docxtemplater {
	if (!zip.file("word/document.xml")) {
		throw new TemplateError("The file is not a Word document (.docx).", []);
	}

	try {
		return new Docxtemplater(zip, {
			paragraphLoop: true,
			linebreaks: true,
			nullGetter: () => "",
			errorLogging: false,
			modules,
		});
	} catch (cause) {
		throw new TemplateError(
			"The template has broken markers.",
			templateErrorDetails(cause),
		);
	}
}

const templateFault = z.object({
	message: z.string().optional(),
	properties: z.object({ explanation: z.string().optional() }).optional(),
});

const templateFailure = templateFault.extend({
	properties: z
		.object({
			explanation: z.string().optional(),
			errors: z.array(templateFault).optional(),
		})
		.optional(),
});

function templateErrorDetails(cause: unknown): string[] {
	const parsed = templateFailure.safeParse(cause);
	if (!parsed.success) return [String(cause)];

	const nested = parsed.data.properties?.errors ?? [];
	const faults = nested.length > 0 ? nested : [parsed.data];

	return faults.map(
		(fault) =>
			fault.properties?.explanation ?? fault.message ?? "Unknown error.",
	);
}

type TagTree = { [marker: string]: TagTree };

const tagTree: z.ZodType<TagTree> = z.lazy(() => z.record(z.string(), tagTree));

function flattenTags(tags: TagTree, into: Set<string>) {
	for (const [key, value] of Object.entries(tags)) {
		if (key !== ".") into.add(key);
		flattenTags(value, into);
	}
}

type LogoTarget = { path: string; extentRatio: number };

function logoTargets(zip: PizZip): LogoTarget[] {
	const document = zip.file("word/document.xml")?.asText() ?? "";
	const rels = zip.file("word/_rels/document.xml.rels")?.asText() ?? "";
	const descr = new RegExp(
		`<wp:docPr [^>]*descr="${PROPOSALS.logo.slotDescr}"`,
	);
	const targets = new Map<string, LogoTarget>();

	for (const drawing of document.matchAll(
		/<w:drawing>[\s\S]*?<\/w:drawing>/g,
	)) {
		if (!descr.test(drawing[0])) continue;

		const extent = drawing[0].match(/<wp:extent cx="(\d+)" cy="(\d+)"/);
		const extentRatio =
			extent && Number(extent[2]) > 0
				? Number(extent[1]) / Number(extent[2])
				: 1;

		for (const embed of drawing[0].matchAll(/r:embed="([^"]+)"/g)) {
			const rel = rels.match(
				new RegExp(`Id="${embed[1]}"[^>]*Target="([^"]+)"`),
			);
			if (!rel?.[1]) continue;
			const path = `word/${rel[1].replace(/^\.?\//, "")}`;
			if (!targets.has(path)) targets.set(path, { path, extentRatio });
		}
	}

	return [...targets.values()];
}

function pngSize(bytes: Uint8Array): LogoSlot | null {
	const isPng =
		bytes.length > 24 &&
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47;
	if (!isPng) return null;
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	return { width: view.getUint32(16), height: view.getUint32(20) };
}

function jpegSize(bytes: Uint8Array): LogoSlot | null {
	if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
	let offset = 2;

	while (offset + 9 < bytes.length) {
		if (bytes[offset] !== 0xff) return null;
		const marker = bytes[offset + 1] ?? 0;
		const length = ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0);
		if (
			marker >= 0xc0 &&
			marker <= 0xcf &&
			![0xc4, 0xc8, 0xcc].includes(marker)
		) {
			return {
				height: ((bytes[offset + 5] ?? 0) << 8) | (bytes[offset + 6] ?? 0),
				width: ((bytes[offset + 7] ?? 0) << 8) | (bytes[offset + 8] ?? 0),
			};
		}
		offset += 2 + length;
	}

	return null;
}

export function imageSize(bytes: Uint8Array): LogoSlot | null {
	return pngSize(bytes) ?? jpegSize(bytes);
}

function slotOf(zip: PizZip): LogoSlot | null {
	const [first] = logoTargets(zip);
	if (!first) return null;

	const media = zip.file(first.path)?.asUint8Array();
	const size = media ? imageSize(media) : null;
	if (size && size.width > 0 && size.height > 0) return size;

	return { width: Math.round(first.extentRatio * 1000), height: 1000 };
}

export function inspectTemplate(file: Buffer): TemplateInspection {
	const zip = openZip(file);
	const inspect = new InspectModule();
	compile(zip, [inspect]);

	const notPng = logoTargets(zip).filter(
		(target) => !target.path.toLowerCase().endsWith(".png"),
	);
	if (notPng.length > 0) {
		throw new TemplateError(
			"The client logo image in the template must be a PNG.",
			notPng.map((target) => target.path),
		);
	}

	const found = new Set<string>();
	flattenTags(tagTree.parse(inspect.getAllTags()), found);
	const markers = [...found].sort();

	return {
		markers,
		unknown: markers.filter((marker) => !KNOWN_MARKERS.has(marker)),
		logoSlot: slotOf(zip),
	};
}

export function renderProposal(
	file: Buffer,
	data: TemplateData,
	logo: Buffer | null,
): Buffer {
	const doc = compile(openZip(file));

	try {
		doc.render(data);
	} catch (cause) {
		throw new TemplateError(
			"The template could not be filled.",
			templateErrorDetails(cause),
		);
	}

	const zip = doc.getZip();
	for (const target of logoTargets(zip)) {
		zip.file(target.path, logo ?? TRANSPARENT_PNG);
	}

	return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}

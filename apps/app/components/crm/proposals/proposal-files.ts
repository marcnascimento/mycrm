import { PROPOSAL_UI } from "./proposal-config";

export type LogoSlot = { width: number; height: number };

export function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	const chunk = 0x8000;
	for (let index = 0; index < bytes.length; index += chunk) {
		binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
	}
	return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}

export async function fileToBase64(file: File): Promise<string> {
	return bytesToBase64(new Uint8Array(await file.arrayBuffer()));
}

export function downloadBase64(
	fileName: string,
	base64: string,
	mediaType: string = PROPOSAL_UI.docx.mediaType,
): void {
	const blob = new Blob([base64ToBytes(base64)], { type: mediaType });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = fileName;
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function loadImage(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error("The image could not be read."));
		image.src = url;
	});
}

function canvasToBase64(canvas: HTMLCanvasElement): Promise<string> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(async (blob) => {
			if (!blob) {
				reject(new Error("The image could not be converted."));
				return;
			}
			resolve(bytesToBase64(new Uint8Array(await blob.arrayBuffer())));
		}, "image/png");
	});
}

export async function imageFileToPng(file: File): Promise<string> {
	const url = URL.createObjectURL(file);
	try {
		const image = await loadImage(url);
		const width = image.naturalWidth || 600;
		const height = image.naturalHeight || 300;
		const scale = Math.min(
			1,
			PROPOSAL_UI.logo.maxSide / Math.max(width, height),
		);
		const canvas = document.createElement("canvas");
		canvas.width = Math.max(1, Math.round(width * scale));
		canvas.height = Math.max(1, Math.round(height * scale));
		canvas
			.getContext("2d")
			?.drawImage(image, 0, 0, canvas.width, canvas.height);
		return await canvasToBase64(canvas);
	} finally {
		URL.revokeObjectURL(url);
	}
}

export async function fitLogo(
	pngBase64: string,
	slot: LogoSlot,
): Promise<string> {
	const url = URL.createObjectURL(
		new Blob([base64ToBytes(pngBase64)], { type: "image/png" }),
	);
	try {
		const image = await loadImage(url);
		const canvas = document.createElement("canvas");
		canvas.width = slot.width;
		canvas.height = slot.height;
		const room = 1 - 2 * PROPOSAL_UI.logo.margin;
		const scale = Math.min(
			(slot.width * room) / image.naturalWidth,
			(slot.height * room) / image.naturalHeight,
		);
		const width = image.naturalWidth * scale;
		const height = image.naturalHeight * scale;
		canvas
			.getContext("2d")
			?.drawImage(
				image,
				(slot.width - width) / 2,
				(slot.height - height) / 2,
				width,
				height,
			);
		return await canvasToBase64(canvas);
	} finally {
		URL.revokeObjectURL(url);
	}
}

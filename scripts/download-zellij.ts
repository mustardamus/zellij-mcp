import { chmod, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "bun";

const REPO = "zellij-org/zellij";
const BIN_DIR = join(import.meta.dirname, "..", "bin");
const BIN_PATH = join(BIN_DIR, "zellij");

function getTarget(): string {
	const arch = process.arch === "arm64" ? "aarch64" : "x86_64";
	const os =
		process.platform === "darwin" ? "apple-darwin" : "unknown-linux-musl";
	return `zellij-${arch}-${os}`;
}

async function getLatestDownloadUrl(): Promise<{ url: string; tag: string }> {
	const res = await fetch(
		`https://api.github.com/repos/${REPO}/releases/latest`,
	);

	if (!res.ok) {
		throw new Error(`Failed to fetch latest release: ${res.statusText}`);
	}

	const release = (await res.json()) as {
		tag_name: string;
		assets: { name: string; browser_download_url: string }[];
	};
	const target = getTarget();
	const assetName = `${target}.tar.gz`;
	const asset = release.assets.find((a) => a.name === assetName);

	if (!asset) {
		throw new Error(
			`No asset found for ${assetName}. Available: ${release.assets.map((a) => a.name).join(", ")}`,
		);
	}

	return { url: asset.browser_download_url, tag: release.tag_name };
}

async function download(url: string): Promise<Buffer> {
	const res = await fetch(url);

	if (!res.ok) {
		throw new Error(`Failed to download: ${res.statusText}`);
	}

	return Buffer.from(await res.arrayBuffer());
}

function extractBinaryFromTar(tarData: Uint8Array): Uint8Array {
	// tar format: 512-byte header blocks followed by file data
	// file name is at offset 0 (100 bytes), file size at offset 124 (12 bytes, octal)
	let offset = 0;

	while (offset < tarData.length) {
		const header = tarData.subarray(offset, offset + 512);

		// check for end-of-archive (two consecutive zero blocks)
		if (header.every((b) => b === 0)) break;

		const nameBytes = header.subarray(0, 100);
		const name = new TextDecoder()
			.decode(nameBytes)
			.replace(/\0+$/, "")
			.replace(/^\.\//, "");
		const sizeStr = new TextDecoder()
			.decode(header.subarray(124, 136))
			.replace(/\0+$/, "")
			.trim();
		const size = Number.parseInt(sizeStr, 8);

		offset += 512; // advance past header

		if (name === "zellij") {
			return tarData.subarray(offset, offset + size);
		}

		// advance past file data, rounded up to 512-byte boundary
		offset += Math.ceil(size / 512) * 512;
	}

	throw new Error("'zellij' binary not found in tar archive");
}

async function main() {
	const { url, tag } = await getLatestDownloadUrl();
	const target = getTarget();

	console.log(`Downloading Zellij ${tag} for ${target}...`);

	const tgzData = await download(url);
	console.log(`Downloaded ${(tgzData.length / 1024 / 1024).toFixed(1)} MB`);

	const tarData = gunzipSync(new Uint8Array(tgzData));
	const binary = extractBinaryFromTar(tarData);

	await mkdir(BIN_DIR, { recursive: true });
	await Bun.write(BIN_PATH, binary);
	await chmod(BIN_PATH, 0o755);

	console.log(`Installed zellij to ${BIN_PATH}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});

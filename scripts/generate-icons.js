/* eslint-disable no-console */
// Generates FlowNotes icons (3 stacked, wavy horizontal lines) as PNGs
// Requires: pngjs

const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

function ensureDir(dir) {
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
}

function setPixel(png, x, y, r, g, b, a = 255) {
	if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
	const idx = (png.width * y + x) << 2;
	png.data[idx] = r;
	png.data[idx + 1] = g;
	png.data[idx + 2] = b;
	png.data[idx + 3] = a;
}

function drawThickPoint(png, x, y, radius, color) {
	for (let dy = -radius; dy <= radius; dy++) {
		for (let dx = -radius; dx <= radius; dx++) {
			if (dx * dx + dy * dy <= radius * radius) {
				setPixel(png, x + dx, y + dy, color.r, color.g, color.b, color.a);
			}
		}
	}
}

function drawWavyLine(png, yCenter, amplitude, periodPx, thickness, color) {
	for (let x = 0; x < png.width; x++) {
		const theta = (2 * Math.PI * x) / periodPx;
		const y = Math.round(yCenter + amplitude * Math.sin(theta));
		drawThickPoint(png, x, y, thickness, color);
	}
}

function createIcon(size) {
	const png = new PNG({ width: size, height: size });
	// Transparent background
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			setPixel(png, x, y, 0, 0, 0, 0);
		}
	}
	// Colors
	const lineColor = { r: 255, g: 255, b: 255, a: 255 };
	const bgColor = { r: 22, g: 40, b: 70, a: 255 };
	// Fill rounded rectangle background
	const radius = Math.round(size * 0.18);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const inCorner = (cx, cy) => {
				const dx = x - cx;
				const dy = y - cy;
				return dx * dx + dy * dy <= radius * radius;
			};
			const inRoundRect =
				(x >= radius && x <= size - radius) ||
				(y >= radius && y <= size - radius) ||
				inCorner(radius, radius) ||
				inCorner(size - radius, radius) ||
				inCorner(radius, size - radius) ||
				inCorner(size - radius, size - radius);
			if (inRoundRect) {
				setPixel(png, x, y, bgColor.r, bgColor.g, bgColor.b, bgColor.a);
			}
		}
	}
	// Wavy lines
	const thickness = Math.max(1, Math.round(size * 0.04));
	const amplitude = Math.max(2, Math.round(size * 0.07));
	const period = Math.round(size * 0.9);
	const margin = Math.round(size * 0.2);
	const spacing = Math.round((size - margin * 2) / 4);
	const y1 = margin + spacing;
	const y2 = margin + spacing * 2;
	const y3 = margin + spacing * 3;

	drawWavyLine(png, y1, amplitude, period, thickness, lineColor);
	drawWavyLine(png, y2, amplitude, period, thickness, lineColor);
	drawWavyLine(png, y3, amplitude, period, thickness, lineColor);

	return png;
}

function savePng(png, filePath) {
	return new Promise((resolve, reject) => {
		const stream = fs.createWriteStream(filePath);
		png.pack().pipe(stream);
		stream.on("finish", resolve);
		stream.on("error", reject);
	});
}

async function main() {
	const outDir = path.join(process.cwd(), "assets", "icons");
	ensureDir(outDir);
	const sizes = [16, 32, 48, 128];
	for (const size of sizes) {
		const png = createIcon(size);
		const filePath = path.join(outDir, `icon-${size}.png`);
		// eslint-disable-next-line no-await-in-loop
		await savePng(png, filePath);
		console.log("Wrote", filePath);
	}
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});



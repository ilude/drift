import { app, BrowserWindow } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import * as path from "node:path";
import * as net from "node:net";

const WS_PORT = 9742;
const BACKEND_BINARY = "drift-server";
const POLL_INTERVAL_MS = 200;
const POLL_TIMEOUT_MS = 10_000;

let backend: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;

function resolveBackendBinary(): string {
	const binDir = app.isPackaged
		? path.join(process.resourcesPath, "bin")
		: path.join(__dirname, "..", "rust-backend", "target", "release");
	const ext = process.platform === "win32" ? ".exe" : "";
	return path.join(binDir, `${BACKEND_BINARY}${ext}`);
}

function spawnBackend(): void {
	const binaryPath = resolveBackendBinary();
	backend = spawn(binaryPath, [], {
		stdio: ["ignore", "pipe", "pipe"],
	});

	backend.stdout?.on("data", (chunk: Buffer) => {
		process.stdout.write(`[drift-server] ${chunk}`);
	});

	backend.stderr?.on("data", (chunk: Buffer) => {
		process.stderr.write(`[drift-server] ${chunk}`);
	});

	backend.on("error", (err) => {
		console.error(`Backend process error: ${err.message}`);
	});

	backend.on("exit", (code, signal) => {
		console.log(`Backend exited — code=${code} signal=${signal}`);
		backend = null;
	});
}

function pollBackendReady(): Promise<void> {
	return new Promise((resolve, reject) => {
		const deadline = Date.now() + POLL_TIMEOUT_MS;

		function attempt(): void {
			const socket = net.createConnection({ port: WS_PORT, host: "127.0.0.1" });
			socket.on("connect", () => {
				socket.destroy();
				resolve();
			});
			socket.on("error", () => {
				socket.destroy();
				if (Date.now() >= deadline) {
					reject(new Error(`Backend did not become ready within ${POLL_TIMEOUT_MS}ms`));
					return;
				}
				setTimeout(attempt, POLL_INTERVAL_MS);
			});
		}

		attempt();
	});
}

function killBackend(): void {
	if (backend && !backend.killed) {
		backend.kill("SIGTERM");
		backend = null;
	}
}

async function createWindow(): Promise<void> {
	mainWindow = new BrowserWindow({
		width: 1400,
		height: 900,
		title: "Drift",
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: path.join(__dirname, "preload.js"),
		},
	});

	const devServerUrl = process.env.VITE_DEV_SERVER_URL;
	if (devServerUrl) {
		await mainWindow.loadURL(devServerUrl);
		mainWindow.webContents.openDevTools();
	} else {
		await mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
	}

	mainWindow.on("closed", () => {
		mainWindow = null;
	});
}

app.whenReady().then(async () => {
	spawnBackend();

	try {
		await pollBackendReady();
		console.log("Backend ready on port", WS_PORT);
	} catch (err) {
		console.warn("Backend readiness check failed — launching UI anyway:", err);
	}

	await createWindow();

	app.on("activate", async () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			await createWindow();
		}
	});
});

app.on("window-all-closed", () => {
	killBackend();
	if (process.platform !== "darwin") {
		app.quit();
	}
});

app.on("before-quit", () => {
	killBackend();
});

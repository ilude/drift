type ConnectionState = "connecting" | "connected" | "disconnected";

type StateUpdateCallback = (state: unknown) => void;

interface TickMessage {
	type: "tick";
	dt: number;
	timeSpeed: number;
}

interface CommandMessage {
	type: "command";
	ship: string;
	command: string;
}

interface TransferMessage {
	type: "transfer";
	ship: string;
	target: string;
}

interface SaveMessage {
	type: "save";
}

interface LoadMessage {
	type: "load";
	data: object;
}

type OutboundMessage = TickMessage | CommandMessage | TransferMessage | SaveMessage | LoadMessage;

const BACKOFF_STEPS_MS = [1000, 2000, 4000, 8000, 10000];

export class DriftBackendClient {
	private ws: WebSocket | null = null;
	private url = "";
	private state: ConnectionState = "disconnected";
	private stateUpdateCallbacks: StateUpdateCallback[] = [];
	private reconnectAttempt = 0;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private intentionallyClosed = false;

	connect(url: string): void {
		this.url = url;
		this.intentionallyClosed = false;
		this.reconnectAttempt = 0;
		this.openSocket();
	}

	disconnect(): void {
		this.intentionallyClosed = true;
		this.clearReconnectTimer();
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		this.state = "disconnected";
	}

	sendTick(dt: number, timeSpeed: number): void {
		this.send({ type: "tick", dt, timeSpeed });
	}

	sendCommand(ship: string, command: string): void {
		this.send({ type: "command", ship, command });
	}

	sendTransfer(ship: string, target: string): void {
		this.send({ type: "transfer", ship, target });
	}

	save(): void {
		this.send({ type: "save" });
	}

	load(data: object): void {
		this.send({ type: "load", data });
	}

	onStateUpdate(callback: StateUpdateCallback): void {
		this.stateUpdateCallbacks.push(callback);
	}

	getConnectionState(): ConnectionState {
		return this.state;
	}

	private openSocket(): void {
		this.state = "connecting";
		const ws = new WebSocket(this.url);
		this.ws = ws;

		ws.addEventListener("open", () => {
			this.state = "connected";
			this.reconnectAttempt = 0;
		});

		ws.addEventListener("message", (event: MessageEvent) => {
			let parsed: unknown;
			try {
				parsed = JSON.parse(event.data as string);
			} catch {
				console.warn("[DriftBackendClient] Unparseable message:", event.data);
				return;
			}
			for (const cb of this.stateUpdateCallbacks) {
				cb(parsed);
			}
		});

		ws.addEventListener("error", () => {
			// close event fires immediately after, handle reconnect there
		});

		ws.addEventListener("close", () => {
			this.ws = null;
			this.state = "disconnected";
			if (!this.intentionallyClosed) {
				this.scheduleReconnect();
			}
		});
	}

	private scheduleReconnect(): void {
		const delayMs = BACKOFF_STEPS_MS[Math.min(this.reconnectAttempt, BACKOFF_STEPS_MS.length - 1)];
		this.reconnectAttempt += 1;
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			if (!this.intentionallyClosed) {
				this.openSocket();
			}
		}, delayMs);
	}

	private clearReconnectTimer(): void {
		if (this.reconnectTimer !== null) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
	}

	private send(message: OutboundMessage): void {
		if (!this.ws || this.state !== "connected") {
			return;
		}
		this.ws.send(JSON.stringify(message));
	}
}

declare global {
	interface Window {
		driftBackend?: { wsUrl: string };
	}
}

let _client: DriftBackendClient | null = null;

export function getBackendClient(): DriftBackendClient | null {
	if (typeof window === "undefined" || !window.driftBackend) {
		return null;
	}
	if (!_client) {
		_client = new DriftBackendClient();
		_client.connect(window.driftBackend.wsUrl);
	}
	return _client;
}

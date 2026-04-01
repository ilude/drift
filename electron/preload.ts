import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("driftBackend", {
	wsUrl: "ws://localhost:9742",
});

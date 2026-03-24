import { checkCondition } from "../core/commands";
import { state } from "../core/state";
import type { CommandCondition, CommandEntry, CommandType, ShipEntry } from "../types";

const COMMAND_NAMES: Record<CommandType, string> = {
	"survey-nearest": "Survey nearest",
	"transfer-to": "Transfer to",
	refuel: "Refuel",
	"shore-leave": "Shore leave",
	overhaul: "Overhaul",
	"return-to-base": "Return to base",
	idle: "Hold position",
};

const CONDITION_LABELS: Record<string, string> = {
	"fuel-below": "fuel",
	"morale-below": "morale",
	"hull-below": "hull",
	"supplies-below": "supplies",
};

function formatCondition(condition: CommandCondition): string {
	if (condition.type === "always") return "ALWAYS";
	const label = CONDITION_LABELS[condition.type] ?? condition.type;
	return `IF ${label}<${condition.threshold}%`;
}

type ThresholdCondition = Extract<CommandCondition, { threshold: number }>;

function isThresholdCondition(c: CommandCondition): c is ThresholdCondition {
	return c.type !== "always";
}

// Immediate order options shown in "Give Order" dropdown
const IMMEDIATE_ORDERS: Array<{ label: string; command: CommandType }> = [
	{ label: "Survey Nearest", command: "survey-nearest" },
	{ label: "Refuel", command: "refuel" },
	{ label: "Shore Leave", command: "shore-leave" },
	{ label: "Overhaul", command: "overhaul" },
	{ label: "Idle", command: "idle" },
];

function buildGiveOrderButton(ship: ShipEntry, container: HTMLElement): HTMLDivElement {
	const wrapper = document.createElement("div");
	wrapper.style.position = "relative";
	wrapper.style.marginBottom = "4px";

	const btn = document.createElement("button");
	btn.type = "button";
	btn.className = "cmd-add-btn";
	btn.textContent = "Give Order \u25be";

	let dropdown: HTMLDivElement | null = null;

	btn.addEventListener("click", () => {
		if (dropdown) {
			dropdown.remove();
			dropdown = null;
			return;
		}

		dropdown = document.createElement("div");
		dropdown.className = "cmd-preset-list";

		for (const opt of IMMEDIATE_ORDERS) {
			const item = document.createElement("div");
			item.className = "cmd-preset-item";
			item.textContent = opt.label;
			item.addEventListener("click", () => {
				ship.immediateCommand = {
					id: `imm-${Date.now()}`,
					command: opt.command,
					condition: { type: "always" },
					enabled: true,
					origin: "ship",
				};
				state.renderNeeded = true;
				renderCommandTree(ship, container);
			});
			dropdown.appendChild(item);
		}

		wrapper.appendChild(dropdown);
	});

	wrapper.appendChild(btn);
	return wrapper;
}

export function renderCommandTree(ship: ShipEntry, container: HTMLElement): void {
	container.innerHTML = "";

	// Heading
	const heading = document.createElement("div");
	heading.className = "cmd-heading";
	heading.textContent = "Standing Orders";
	container.appendChild(heading);

	// Give Order button
	container.appendChild(buildGiveOrderButton(ship, container));

	const tree = document.createElement("div");
	tree.className = "cmd-tree";

	const entries = ship.commandTree.entries;

	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i];
		const row = buildRow(ship, container, entries, i, entry);
		tree.appendChild(row);
	}

	container.appendChild(tree);

	// Add Order button
	const addBtn = document.createElement("button");
	addBtn.type = "button";
	addBtn.className = "cmd-add-btn";
	addBtn.textContent = "+ Add Order";

	let presetList: HTMLDivElement | null = null;

	addBtn.addEventListener("click", () => {
		if (presetList) {
			presetList.remove();
			presetList = null;
			return;
		}

		presetList = buildPresetList(ship, container);
		container.appendChild(presetList);
	});

	container.appendChild(addBtn);
}

function buildRow(
	ship: ShipEntry,
	container: HTMLElement,
	entries: CommandEntry[],
	i: number,
	entry: CommandEntry,
): HTMLDivElement {
	const row = document.createElement("div");
	row.className = "cmd-row";

	// Up button
	const upBtn = document.createElement("button");
	upBtn.type = "button";
	upBtn.className = "cmd-btn";
	upBtn.textContent = "▲";
	upBtn.disabled = i === 0;
	upBtn.addEventListener("click", () => {
		entries.splice(i - 1, 2, entries[i], entries[i - 1]);
		state.renderNeeded = true;
		renderCommandTree(ship, container);
	});

	// Down button
	const downBtn = document.createElement("button");
	downBtn.type = "button";
	downBtn.className = "cmd-btn";
	downBtn.textContent = "▼";
	downBtn.disabled = i === entries.length - 1;
	downBtn.addEventListener("click", () => {
		entries.splice(i, 2, entries[i + 1], entries[i]);
		state.renderNeeded = true;
		renderCommandTree(ship, container);
	});

	// Condition status indicator: green if condition currently met, gray otherwise
	const condMet = entry.enabled && checkCondition(entry.condition, ship);
	const statusDot = document.createElement("span");
	statusDot.className = "cmd-cond-indicator";
	statusDot.textContent = "●";
	statusDot.style.color = condMet ? "#4a8a4a" : "#3a3a3a";
	statusDot.title = condMet ? "Condition met" : "Condition not met";

	// Condition display
	const condSpan = document.createElement("span");
	condSpan.className = "cmd-condition";

	if (isThresholdCondition(entry.condition)) {
		const label = CONDITION_LABELS[entry.condition.type] ?? entry.condition.type;
		const prefix = document.createTextNode(`IF ${label}<`);
		condSpan.appendChild(prefix);

		const threshSpan = document.createElement("span");
		threshSpan.textContent = `${entry.condition.threshold}%`;
		threshSpan.style.cursor = "pointer";
		threshSpan.style.textDecoration = "underline dotted";

		threshSpan.addEventListener("click", () => {
			const input = document.createElement("input");
			input.type = "number";
			input.min = "1";
			input.max = "99";
			input.value = String(entry.condition.threshold as number);
			input.style.width = "36px";
			input.style.fontSize = "9px";
			input.style.background = "#141420";
			input.style.border = "1px solid #4a6a4a";
			input.style.color = "#99aa99";
			input.style.fontFamily = "'Courier New', monospace";
			input.style.padding = "0 2px";

			const commit = () => {
				const val = Number.parseInt(input.value, 10);
				if (!Number.isNaN(val) && val >= 1 && val <= 99) {
					(entry.condition as ThresholdCondition).threshold = val;
				}
				state.renderNeeded = true;
				renderCommandTree(ship, container);
			};

			input.addEventListener("blur", commit);
			input.addEventListener("keydown", (e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					commit();
				}
			});

			threshSpan.replaceWith(input);
			input.focus();
			input.select();
		});

		condSpan.appendChild(threshSpan);
	} else {
		condSpan.textContent = "ALWAYS";
	}

	// Arrow separator
	const arrow = document.createElement("span");
	arrow.textContent = " → ";
	arrow.style.color = "#4a5a4a";

	// Command display
	const cmdSpan = document.createElement("span");
	cmdSpan.className = "cmd-command";
	cmdSpan.textContent = COMMAND_NAMES[entry.command] ?? entry.command;

	// Enabled toggle
	const toggleSpan = document.createElement("span");
	toggleSpan.className = `cmd-toggle ${entry.enabled ? "cmd-toggle-on" : "cmd-toggle-off"}`;
	toggleSpan.textContent = entry.enabled ? "●" : "○";
	toggleSpan.title = entry.enabled ? "Disable" : "Enable";
	toggleSpan.addEventListener("click", () => {
		entry.enabled = !entry.enabled;
		state.renderNeeded = true;
		renderCommandTree(ship, container);
	});

	// Remove button
	const removeBtn = document.createElement("button");
	removeBtn.type = "button";
	removeBtn.className = "cmd-btn";
	removeBtn.textContent = "✕";
	removeBtn.title = "Remove";
	removeBtn.addEventListener("click", () => {
		entries.splice(i, 1);
		state.renderNeeded = true;
		renderCommandTree(ship, container);
	});

	row.appendChild(upBtn);
	row.appendChild(downBtn);
	row.appendChild(statusDot);
	row.appendChild(condSpan);
	row.appendChild(arrow);
	row.appendChild(cmdSpan);

	// Spacer
	const spacer = document.createElement("span");
	spacer.style.flex = "1";
	row.appendChild(spacer);

	row.appendChild(toggleSpan);
	row.appendChild(removeBtn);

	return row;
}

interface Preset {
	label: string;
	command: CommandType;
	condition: CommandCondition;
}

const PRESETS: Preset[] = [
	{
		label: "Survey nearest body",
		command: "survey-nearest",
		condition: { type: "always" },
	},
	{
		label: "Refuel when fuel < 20%",
		command: "refuel",
		condition: { type: "fuel-below", threshold: 20 },
	},
	{
		label: "Shore leave when morale < 40%",
		command: "shore-leave",
		condition: { type: "morale-below", threshold: 40 },
	},
	{
		label: "Overhaul when hull < 30%",
		command: "overhaul",
		condition: { type: "hull-below", threshold: 30 },
	},
	{
		label: "Return to base",
		command: "return-to-base",
		condition: { type: "always" },
	},
	{
		label: "Hold position",
		command: "idle",
		condition: { type: "always" },
	},
];

function buildPresetList(ship: ShipEntry, container: HTMLElement): HTMLDivElement {
	const list = document.createElement("div");
	list.className = "cmd-preset-list";

	for (const preset of PRESETS) {
		const item = document.createElement("div");
		item.className = "cmd-preset-item";
		item.textContent = preset.label;
		item.addEventListener("click", () => {
			const newEntry: CommandEntry = {
				id: `cmd-${Date.now()}`,
				command: preset.command,
				condition: { ...preset.condition } as CommandCondition,
				enabled: true,
				origin: "ship",
			};
			ship.commandTree.entries.push(newEntry);
			state.renderNeeded = true;
			renderCommandTree(ship, container);
		});
		list.appendChild(item);
	}

	return list;
}

// Re-export formatCondition for potential external use
export { formatCondition };

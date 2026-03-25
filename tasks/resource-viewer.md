# Resource Viewer — Popout Spreadsheet Window

> **Status:** Implemented in `src/ui/resource-viewer.ts`. Body×resource matrix with category tabs, sortable columns, body-click navigation, postMessage sync. PWA manifest enables chrome-less popout.

## Goal

Provide a spreadsheet-like table of all surveyed resource deposits across all bodies, displayed in a popout browser window to support multi-monitor setups.

## Why

- Currently resource data is only visible per-body in the info panel — no way to compare across bodies or plan logistics
- A tabular view is essential before mining/extraction makes sense (need to know where to send ships)
- Popout window enables players to keep the resource overview visible on a second monitor while playing on the primary — critical for the data-heavy 4X experience this game targets
- Sets precedent for future popout windows (fleet manager, colony overview, trade routes)

## Requirements

### Data Table
- One row per deposit across all surveyed bodies
- Columns: Body Name, Body Type, Distance (AU), Resource Name, Symbol, Category, Quantity, Accessibility, Survey Level, Mining Value Score
- Sortable by any column (click header to toggle asc/desc)
- Filterable by resource category (metal, volatile, industrial, radioactive, umbral)
- Filterable by body type
- Search/filter by body name or resource name
- Aggregate row or summary showing totals per resource category

### Popout Window
- Opens via a button in the main UI (e.g., in the header bar or view menu)
- Uses `window.open()` to create a new browser window
- Window receives live data updates from the main game window (postMessage or shared state)
- Falls back gracefully if popups are blocked (inline panel or notification to allow popups)
- Persists window position/size across sessions if possible
- Styled consistently with the main game UI (dark theme, monospace, green-on-black aesthetic)

### Integration
- Only shows deposits from bodies that have been surveyed (respects survey level visibility)
- Updates when new surveys complete
- Clicking a body name in the table could select that body in the main game window
- Resource data comes from existing `survey.deposits` on body entries and `getResourceDef()` from `data/resources.ts`

## Design Considerations

- Keep the popout window lightweight — it's a data view, not a second game instance
- Communication pattern: main window pushes state snapshots to popout via `postMessage`, popout renders independently
- Consider a `BroadcastChannel` as an alternative to `postMessage` for cleaner decoupling
- The popout HTML/CSS can be generated as a blob URL or served from the same origin
- Sorting/filtering should be client-side in the popout (no round-trips to main window)

## Aurora 4X Reference

Aurora 4X uses multiple overlapping windows for mineral data — each optimized for a different workflow:

### Minerals Tab (System Map sidebar)
- Tree view listing all bodies with mineral deposits in the current system
- Shows minerals per body with quantity + accessibility
- Clicking a body name centers the system map on it
- "Show Surveyed Bodies" toggle draws white circles on surveyed bodies
- "Show Mineral Concentrations" toggle draws green circles on bodies with deposits
- "Mineral Text" button flattens tree into copyable text (includes planet/moon/asteroid counts)

### Geological Survey Report (dedicated window)
- The primary tool for finding where to mine — more useful than the Minerals tab for planning
- **Search/filter by mineral**: set minimum Amount and minimum Accessibility per mineral type
- Results ranked highest-to-lowest quantity, showing body name + amount + accessibility
- Can filter for multiple minerals simultaneously (e.g., "show bodies with Duranium > 1000 AND accessibility > 0.8")
- Accessed via toolbar icon (grey planet with chart overlay)

### Economics / Mining Report (Population & Production window)
- Per-colony view showing active mining operations
- Columns: Mineral Name, Quantity remaining, Accessibility, Annual Production, Years to Depletion, Stockpile, Recent Stockpile Change, Mass Driver +/-
- Accessibility degrades as deposits are mined past 50% — critical for long-term planning
- Shows projected usage and reserve levels

### System View (F9)
- Quick at-a-glance: column shows nothing (unsurveyed), "S" (surveyed, no minerals), or "M" (minerals present)

### Key Design Patterns from Aurora
- **Multiple views for different tasks**: quick check (System View), spatial (System Map Minerals tab), search/filter (Geological Survey Report), operational (Economics Mining Report)
- **Filter-first design**: the most useful view isn't "show everything" — it's "show me bodies matching these criteria"
- **Quantity + Accessibility are the two core columns** — everything else derives from them
- **Clicking body names navigates** the main map — the data views are portals into the game world
- **Multi-monitor is user-managed**: Aurora lets you drag windows around but doesn't have explicit popout support. We can do better with `window.open()`.

### What We Should Adopt
- The Geological Survey Report search pattern: filter by resource + min quantity + min accessibility
- Ranked results (best deposits first) rather than alphabetical body lists
- Click-to-navigate from data rows back to the game map
- Summary statistics (total quantity by category, count of surveyed vs unsurveyed bodies)

### What We Should Improve On
- Aurora's UI is famously hostile — our popout should be clean, keyboard-navigable, and responsive
- Aurora doesn't have a unified "all resources" view — we should, since our resource count (27) is manageable
- Real-time updates when surveys complete (Aurora requires manual refresh)
- Proper multi-monitor support via popout rather than manual window dragging

## Future Extensions

- Add "Send Ship" action column (dispatch a ship to mine at a specific body)
- Show which bodies have ships en route or mining
- Export to CSV
- Multiple popout windows for different data views (fleet, colonies, trade)

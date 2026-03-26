# AGENTS

This file is the root entry point for Codex and other coding agents working in this repository.

The detailed repository guide lives in [`./.claude/CLAUDE.md`](./.claude/CLAUDE.md), which is the canonical source for architecture, invariants, and deeper workflow rules.

## Quick Start

- Install dependencies: `bun install`
- Preferred commands:
  - `bun run dev`
  - `bun run lint`
  - `bun run test`
  - `bun run typecheck`
  - `bun run build`
- Treat `dist/` as generated output. Do not edit it manually.

## Source Of Truth

When documents overlap, use this order:

1. `AGENTS.md` for agent workflow entry
2. `.claude/CLAUDE.md` for repository coding rules and architecture invariants
3. `tasks/decisions.md` for accepted design decisions
4. `tasks/ddd-model.md` for domain/module boundaries
5. `README.md` for product overview and setup
6. Other `tasks/*.md` files as reference or proposals unless explicitly promoted

## Critical Invariants

These are repeated here because they directly affect safe autonomous edits:

- Use `src/core/entities.ts` lookup helpers. Do not introduce new direct `state.bodyMeshes.find()` / `filter()` access patterns where entity helpers should be used.
- Preserve the documented import hierarchy. Keep pure math modules free of app imports.
- Prefer small, targeted edits. `src/main.ts` and `src/ui/ui.ts` are high-risk files because they own broad orchestration.
- Follow the rate-modifier convention described in `.claude/CLAUDE.md` for new rate-based systems.
- Do not treat speculative docs in `tasks/` as implementation requirements unless they are marked as accepted decisions.

## Verification

- For focused changes, run the smallest relevant test set you can justify.
- Before handoff, prefer running:
  - `bun run lint`
  - `bun run test`
  - `bun run typecheck`
  - `bun run build`

## Edit Map

- Ship logic: `src/core/commands.ts`, `src/core/commander.ts`, `src/main.ts`
- Commander judgment overrides: `src/core/commander.ts` (preemptive service, defer maintenance, hold for tanker)
- Colony system: `src/core/colonies.ts` (workforce, qualities, mining/construction/research ticks), `src/ui/colony-panel.ts`
- Entity lookup and resolution: `src/core/entities.ts`
- Intent broadcast and coordination: `src/core/intents.ts`
- Data generation: `src/data/*`
- Rendering and scene behavior: `src/rendering/*`, `src/math/*`
- UI chrome and HUD: `src/ui/*`

## Design Research Library

Extensive design research lives in `tasks/`. Key files:
- `tasks/research-synthesis-report.md` — Full synthesis of all research (start here)
- `tasks/colony-system-design.md` — Colony system design notes and phased build plan
- `tasks/aurora-*-implementation.md` — Aurora 4X mechanics mapped to Drift (colonies, economy, research, logistics, exploration, commanders, ship design)
- `tasks/production-chain-*.md` — Nodal production chain design research (factory patterns, graph theory, 4X patterns, UX)

## Documentation Notes

- Keep `README.md` focused on overview and setup.
- Put durable coding rules in `.claude/CLAUDE.md` and summarize the most important ones here.
- Prefer promoting accepted design constraints into `tasks/decisions.md` instead of leaving them only in research/proposal docs.

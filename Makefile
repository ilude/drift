.PHONY: dev build test test-watch coverage lint typecheck dead-code clean verify verify-fast check install

dev:
	bun run dev

build:
	bun run build

test:
	bun run test

test-watch:
	bun run test:watch

coverage:
	bun run test:coverage

lint:
	bun run lint

typecheck:
	bun run typecheck

dead-code:
	bun run dead-code

verify-fast:
	bun run verify:fast

verify:
	bun run verify

check: verify

clean:
	bun run clean

install:
	bun install

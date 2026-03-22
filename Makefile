.PHONY: dev build test test-watch coverage lint clean check install

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

check: lint test build

clean:
	rm -rf dist coverage

install:
	bun install

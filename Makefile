.PHONY: dev build test test-watch coverage lint clean check install

node_modules: bun.lock package.json
	bun install
	@touch node_modules

dev: node_modules
	bun run dev

build: node_modules
	bun run build

test: node_modules
	bun run test

test-watch: node_modules
	bun run test:watch

coverage: node_modules
	bun run test:coverage

lint: node_modules
	bun run lint

check: lint test build

clean:
	rm -rf dist coverage

install:
	bun install

.PHONY: dev build test test-watch coverage lint clean check install

dev:
	npx vite

build:
	npx vite build

test:
	npx vitest run

test-watch:
	npx vitest

coverage:
	npx vitest run --coverage

lint:
	npx eslint .

check: lint test build

clean:
	rm -rf dist coverage

install:
	npm install

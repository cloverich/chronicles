# Entry points for people and tools (Engram lists `## ` targets). The work
# lives in package.json scripts and scripts/; keep these one line each.
.PHONY: help dev test check install

help: ## List targets
	@grep -E '^[a-z][a-z0-9-]*:.*## ' Makefile | awk -F':.*## ' '{printf "%-10s %s\n", $$1, $$2}'

dev: ## Run the app in development
	yarn start

test: ## Unit and node tests
	yarn test

check: ## Changelog and lint checks the build runs first
	yarn changelog:check && yarn lint:check

install: ## Build and install to /Applications
	bash .claude/skills/local-install/scripts/install-build.sh

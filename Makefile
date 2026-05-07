AGENTS_DIR := $(HOME)/.agents/skills
CLAUDE_DIR := $(HOME)/.claude/skills
SKILL_DIRS := $(shell find skills -maxdepth 2 -name 'SKILL.md' -exec dirname {} \;)
TANGLY_PKG := packages/tangly
# Workspace pkgs to register globally via `bun link`. `tangly` first so its bin
# lands on PATH before the scoped packages.
LINKABLE_PKGS := tangly schema theme-ui theme-tang theme-pith theme-readable theme-pip theme-geist
# Scoped pkg specifiers consumers reference (everything but tangly is @tanglydocs/*).
SCOPED_PKGS := @tanglydocs/schema @tanglydocs/theme-ui @tanglydocs/theme-tang @tanglydocs/theme-pith @tanglydocs/theme-readable @tanglydocs/theme-pip @tanglydocs/theme-geist

.PHONY: link unlink link-bin unlink-bin link-pkgs unlink-pkgs link-skill unlink-skill link-consumer unlink-consumer list

## link: register all workspace packages globally and link skills
link: link-pkgs link-skill

## unlink: tear down all global links and skill symlinks
unlink: unlink-pkgs unlink-skill

## link-bin: alias for link-pkgs (kept for back-compat)
link-bin: link-pkgs

## unlink-bin: alias for unlink-pkgs (kept for back-compat)
unlink-bin: unlink-pkgs

## link-pkgs: register every workspace package as a global `bun link` target
link-pkgs:
	@for pkg in $(LINKABLE_PKGS); do \
		(cd packages/$$pkg && bun link >/dev/null) && echo "Linked: packages/$$pkg"; \
	done

## unlink-pkgs: remove every workspace package's global `bun link` registration
unlink-pkgs:
	@for pkg in $(LINKABLE_PKGS); do \
		(cd packages/$$pkg && bun unlink >/dev/null 2>&1) || true; \
		echo "Unlinked: packages/$$pkg"; \
	done

## link-consumer: wire all linked packages into a downstream project. `make link-consumer DIR=path/to/proj`
link-consumer:
	@if [ -z "$(DIR)" ]; then echo "usage: make link-consumer DIR=<path>"; exit 2; fi
	@cd "$(DIR)" && bun link tangly $(SCOPED_PKGS)
	@echo "Linked Tangly workspace into $(DIR)"

## unlink-consumer: drop the local links from a downstream project (re-installs published versions on next `bun install`)
unlink-consumer:
	@if [ -z "$(DIR)" ]; then echo "usage: make unlink-consumer DIR=<path>"; exit 2; fi
	@cd "$(DIR)" && bun install --force
	@echo "Restored published deps in $(DIR)"

## link-skill: symlink skills/* into ~/.agents/skills and ~/.claude/skills
link-skill:
	@mkdir -p $(AGENTS_DIR) $(CLAUDE_DIR)
	@for skill in $(SKILL_DIRS); do \
		name=$$(basename $$skill); \
		src="$$(pwd)/skills/$$name"; \
		for dir in $(AGENTS_DIR) $(CLAUDE_DIR); do \
			target="$$dir/$$name"; \
			if [ -L "$$target" ] || [ -e "$$target" ]; then \
				rm -rf "$$target"; \
			fi; \
			ln -s "$$src" "$$target"; \
			echo "Linked: $$name -> $$target"; \
		done; \
	done

## unlink-skill: remove symlinks for this repo's skills
unlink-skill:
	@for skill in $(SKILL_DIRS); do \
		name=$$(basename $$skill); \
		for dir in $(AGENTS_DIR) $(CLAUDE_DIR); do \
			target="$$dir/$$name"; \
			if [ -L "$$target" ]; then \
				rm "$$target"; \
				echo "Unlinked: $$target"; \
			fi; \
		done; \
	done

## list: show discovered skills
list:
	@for skill in $(SKILL_DIRS); do echo $$skill; done

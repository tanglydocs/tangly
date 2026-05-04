AGENTS_DIR := $(HOME)/.agents/skills
CLAUDE_DIR := $(HOME)/.claude/skills
SKILL_DIRS := $(shell find skills -maxdepth 2 -name 'SKILL.md' -exec dirname {} \;)
TANGLY_PKG := packages/tangly

.PHONY: link unlink link-bin unlink-bin link-skill unlink-skill list

## link: link both the tangly CLI bin and the skills
link: link-bin link-skill

## unlink: unlink both the tangly CLI bin and the skills
unlink: unlink-bin unlink-skill

## link-bin: register the local tangly CLI on PATH via `bun link`
link-bin:
	@cd $(TANGLY_PKG) && bun link
	@bun link tangly
	@echo "Linked: tangly CLI -> $(TANGLY_PKG)/bin/tangly.js"

## unlink-bin: remove the local tangly CLI link
unlink-bin:
	@bun unlink tangly || true
	@cd $(TANGLY_PKG) && bun unlink || true
	@echo "Unlinked: tangly CLI"

## link-skill: symlink skills/* into ~/.agents/skills and ~/.claude/skills
link-skill:
	@mkdir -p $(AGENTS_DIR) $(CLAUDE_DIR)
	@for skill in $(SKILL_DIRS); do \
		name=$$(basename $$skill); \
		src="$$(pwd)/skills/$$name"; \
		for dir in $(AGENTS_DIR) $(CLAUDE_DIR); do \
			target="$$dir/$$name"; \
			if [ -L "$$target" ]; then \
				rm "$$target"; \
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

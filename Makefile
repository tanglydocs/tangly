AGENTS_DIR := $(HOME)/.agents/skills
CLAUDE_DIR := $(HOME)/.claude/skills
SKILL_DIRS := $(shell find skills -maxdepth 2 -name 'SKILL.md' -exec dirname {} \;)

.PHONY: link unlink list

## link: symlink skills/* into ~/.agents/skills and ~/.claude/skills
link:
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

## unlink: remove symlinks for this repo's skills
unlink:
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

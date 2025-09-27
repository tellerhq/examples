.DEFAULT_GOAL := default

# Default: run the Python example
default:
	@$(MAKE) run python

.PHONY: run
run:
	@if [ -z "$(filter-out $@,$(MAKECMDGOALS))" ]; then \
		echo "Usage: make run <language> [APP_ID=... ENV=...] [-- args...]"; \
		exit 1; \
	fi; \
	lang=$$(echo $(MAKECMDGOALS) | awk '{print $$2}'); \
	script="$$lang/run.sh"; \
	if [ ! -x "$$script" ]; then \
		echo "Error: no run.sh in $$lang"; \
		exit 1; \
	fi; \
	shifted=$$(echo $(MAKECMDGOALS) | cut -d' ' -f3-); \
	cd $$lang && ./run.sh $$shifted

# Swallow unknown targets so "make run python APP_ID=..." doesn’t error
%:
	@:
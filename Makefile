.PHONY: poster generate

poster:
	@bash scripts/make-poster.sh "$(PROMPT)"

generate: poster

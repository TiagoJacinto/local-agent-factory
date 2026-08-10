#!/usr/bin/env bash
set -euo pipefail

REPO="https://github.com/TiagoJacinto/local-agent-factory.git"
ROOT="$(pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

if ! command -v git >/dev/null 2>&1; then
	echo "Error: git is required." >&2
	exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
	echo "Error: Bun is required. Install it from https://bun.sh/" >&2
	exit 1
fi

echo "Downloading Super Simple Software Factory..."
git clone --depth 1 --quiet "$REPO" "$TMP_DIR/local-agent-factory"

mkdir -p "$ROOT/.pi/skills/sssf"
cp -R "$TMP_DIR/local-agent-factory/.pi/skills/sssf/." "$ROOT/.pi/skills/sssf/"

cd "$ROOT"
bun .pi/skills/sssf/scripts/install.ts

if [[ ! -f "$ROOT/.env" ]]; then
	cp "$ROOT/.env.sample" "$ROOT/.env"
	echo "Created .env from .env.sample. Add your API key before running an ADW."
else
	echo "Kept existing .env."
fi

echo
echo "Factory ready. Add your API key to .env, then run: just demo"

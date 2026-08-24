#!/usr/bin/env bash
set -euo pipefail

REPO="${SSSF_REPO:-TiagoJacinto/local-agent-factory}"
ROOT="$(pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

VERSION="latest"
while [[ $# -gt 0 ]]; do
  case "$1" in
  --version)
    [[ $# -ge 2 ]] || {
      echo "Error: --version needs a release tag." >&2
      exit 2
    }
    VERSION="$2"
    shift 2
    ;;
  --latest)
    VERSION="latest"
    shift
    ;;
  *)
    echo "Error: unknown option: $1" >&2
    exit 2
    ;;
  esac
done

for command in curl tar; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Error: $command is required." >&2
    exit 1
  fi
done
if ! command -v bun >/dev/null 2>&1; then
  echo "Error: Bun is required. Install it from https://bun.sh/" >&2
  exit 1
fi

if [[ "$VERSION" == "latest" ]]; then
  ARCHIVE_URL="https://github.com/$REPO/releases/latest/download/sssf.tar.gz"
  echo "Downloading the latest stable Super Simple Software Factory..."
else
  ARCHIVE_URL="https://github.com/$REPO/releases/download/$VERSION/sssf.tar.gz"
  echo "Downloading Super Simple Software Factory $VERSION..."
fi

ARCHIVE="$TMP_DIR/sssf.tar.gz"
curl --fail --location --silent --show-error "$ARCHIVE_URL" --output "$ARCHIVE"

CHECKSUM_URL="$ARCHIVE_URL.sha256"
RELEASE_SHA256=""
if curl --fail --location --silent --show-error "$CHECKSUM_URL" --output "$ARCHIVE.sha256"; then
  if command -v sha256sum >/dev/null 2>&1; then
    (cd "$TMP_DIR" && sha256sum --check "$(basename "$ARCHIVE.sha256")")
  elif command -v shasum >/dev/null 2>&1; then
    EXPECTED="$(awk '{print $1}' "$ARCHIVE.sha256")"
    ACTUAL="$(shasum -a 256 "$ARCHIVE" | awk '{print $1}')"
    [[ "$EXPECTED" == "$ACTUAL" ]] || {
      echo "Error: release checksum does not match." >&2
      exit 1
    }
  else
    echo "Error: sha256sum or shasum is required to verify the release." >&2
    exit 1
  fi
else
  echo "Error: release checksum is unavailable; refusing an unverified install." >&2
  exit 1
fi
RELEASE_SHA256="$(awk '{print $1}' "$ARCHIVE.sha256")"

mkdir -p "$TMP_DIR/package"
tar -xzf "$ARCHIVE" -C "$TMP_DIR/package"
PACKAGE="$TMP_DIR/package/.pi/skills"
[[ -d "$PACKAGE/sssf" ]] || {
  echo "Error: release archive must contain .pi/skills/sssf/." >&2
  exit 1
}

EXISTING_SKILL=0
[[ -d "$ROOT/.pi/skills/sssf" ]] && EXISTING_SKILL=1
mkdir -p "$ROOT/.pi/skills"
cp -R "$PACKAGE/." "$ROOT/.pi/skills/"

INSTALL_ARGS=()
[[ "$EXISTING_SKILL" -eq 1 ]] && INSTALL_ARGS+=(--update)
[[ "$VERSION" != "latest" ]] && INSTALL_ARGS+=(--version "$VERSION")
cd "$ROOT"
SSSF_ARCHIVE_SHA256="$RELEASE_SHA256" bun "$ROOT/.pi/skills/sssf/scripts/install.ts" "${INSTALL_ARGS[@]}"

if [[ ! -f "$ROOT/.env" ]]; then
  cp "$ROOT/.env.sample" "$ROOT/.env"
  echo "Created .env from .env.sample. Add your API key before running an ADW."
else
  echo "Kept existing .env."
fi

echo
echo "Factory ready. Add your API key to .env, then run: just demo"

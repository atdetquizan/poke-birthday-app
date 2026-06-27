#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${1:-../poke-birthday-from-ng-new}"
PROJECT_NAME="$(basename "$TARGET_DIR")"
CLI_VERSION="${ANGULAR_CLI_VERSION:-22.0.4}"
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -e "$TARGET_DIR" ]; then
  echo "Target already exists: $TARGET_DIR" >&2
  echo "Choose another directory or remove it first." >&2
  exit 1
fi

echo "Creating Angular workspace with ng new..."
npx -y "@angular/cli@${CLI_VERSION}" new "$PROJECT_NAME" \
  --directory "$TARGET_DIR" \
  --standalone \
  --style scss \
  --routing false \
  --ssr false \
  --skip-tests \
  --skip-git \
  --package-manager npm \
  --defaults

echo "Overlaying PokéBirthday source code..."
rsync -a --delete "$CURRENT_DIR/src/" "$TARGET_DIR/src/"
rsync -a --delete "$CURRENT_DIR/public/" "$TARGET_DIR/public/"
rsync -a --delete "$CURRENT_DIR/google-apps-script/" "$TARGET_DIR/google-apps-script/"
cp "$CURRENT_DIR/package.json" "$TARGET_DIR/package.json"
cp "$CURRENT_DIR/angular.json" "$TARGET_DIR/angular.json"
cp "$CURRENT_DIR/tsconfig.json" "$TARGET_DIR/tsconfig.json"
cp "$CURRENT_DIR/tsconfig.app.json" "$TARGET_DIR/tsconfig.app.json"
cp "$CURRENT_DIR/README.md" "$TARGET_DIR/README.md"
cp "$CURRENT_DIR/NG_NEW.md" "$TARGET_DIR/NG_NEW.md"

echo "Done: $TARGET_DIR"
echo "Next: cd $TARGET_DIR && npm install && npm start"

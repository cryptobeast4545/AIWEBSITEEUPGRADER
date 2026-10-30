#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# build_frontend.sh
# Run by the Render build command BEFORE pip install.
# Compiles the React app and copies the output into backend/static/frontend/
# so that FastAPI can serve it as a static SPA at runtime.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── 1. Make sure we have a usable Node.js ────────────────────────────────────
if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ]]; then
  echo ">>> Installing Node 20 via nvm..."
  export NVM_DIR="$HOME/.nvm"
  if [ ! -d "$NVM_DIR" ]; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  fi
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
  nvm install 20
  nvm use 20
fi

echo ">>> Node  : $(node -v)"
echo ">>> npm   : $(npm -v)"

# ── 2. Install frontend dependencies ─────────────────────────────────────────
cd frontend
echo ">>> Installing frontend npm packages..."
npm install --legacy-peer-deps --prefer-offline

# ── 3. Build the React app ───────────────────────────────────────────────────
echo ">>> Building React app (production)..."
# REACT_APP_BACKEND_URL is left empty so the frontend hits the SAME origin as
# the FastAPI server (no CORS, no separate domain needed).
REACT_APP_BACKEND_URL="" \
  DISABLE_EMERGENT_OVERLAY=true \
  CI=false \
  npm run build

cd ..

# ── 4. Copy build output into the backend static folder ─────────────────────
DEST="backend/static/frontend"
echo ">>> Copying build → $DEST ..."
rm -rf "$DEST"
mkdir -p "$DEST"
cp -r frontend/build/. "$DEST/"

echo ""
echo "✅  Frontend build complete. Files written to $DEST"
ls "$DEST" | head -20

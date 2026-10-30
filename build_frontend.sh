#!/usr/bin/env bash
set -e

echo "=== Node: $(node -v), npm: $(npm -v) ==="

echo "=== Installing frontend dependencies ==="
cd frontend
npm install --legacy-peer-deps

echo "=== Building React app ==="
REACT_APP_BACKEND_URL="" DISABLE_EMERGENT_OVERLAY=true CI=false npm run build

cd ..

echo "=== Copying build to backend/static/frontend ==="
rm -rf backend/static/frontend
mkdir -p backend/static/frontend
cp -r frontend/build/. backend/static/frontend/

echo "=== Frontend build done ==="

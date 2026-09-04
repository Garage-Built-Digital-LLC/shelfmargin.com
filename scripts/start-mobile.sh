#!/usr/bin/env bash
# Shelf Margin — start the API + the Expo dev server together for phone testing.
# Usage (from the repo root):  bash scripts/start-mobile.sh
# Then scan the QR with Expo Go on your phone (same Wi-Fi as this Mac).
set -e
cd "$(dirname "$0")/.."

echo "→ Starting API server on port 4173..."
node server.mjs &
API_PID=$!
# Stop the API automatically when you quit Expo (Ctrl+C).
trap 'kill $API_PID 2>/dev/null' EXIT
sleep 2
echo "→ API up. Starting Expo — scan the QR below with Expo Go."
echo ""
cd apps/mobile
exec npx expo start --offline

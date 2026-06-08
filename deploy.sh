#!/bin/bash
# Renewly AI backend — first-time deploy helper.
# Run from the renewly-backend directory: bash deploy.sh
set -e

echo "=== Step 1: Cloudflare login ==="
npx wrangler login

echo ""
echo "=== Step 2: Create KV namespaces ==="
QUOTA_OUTPUT=$(npx wrangler kv namespace create QUOTA)
CACHE_OUTPUT=$(npx wrangler kv namespace create CACHE)

QUOTA_ID=$(echo "$QUOTA_OUTPUT" | grep -o '"id": "[^"]*"' | head -1 | sed 's/"id": "//;s/"//')
CACHE_ID=$(echo "$CACHE_OUTPUT" | grep -o '"id": "[^"]*"' | head -1 | sed 's/"id": "//;s/"//')

echo "QUOTA KV id: $QUOTA_ID"
echo "CACHE KV id: $CACHE_ID"

echo ""
echo "=== Step 3: Patching wrangler.toml with real KV ids ==="
sed -i.bak \
  -e "s/REPLACE_WITH_QUOTA_KV_ID/$QUOTA_ID/" \
  -e "s/REPLACE_WITH_CACHE_KV_ID/$CACHE_ID/" \
  wrangler.toml
echo "wrangler.toml updated."

echo ""
echo "=== Step 4: Set ANTHROPIC_API_KEY secret ==="
echo "Paste your Anthropic API key when prompted."
npx wrangler secret put ANTHROPIC_API_KEY

echo ""
echo "=== Step 5: Deploy ==="
npx wrangler deploy

echo ""
echo "=== Done! ==="
echo "Your Worker URL is printed above (ends in .workers.dev)."
echo "Copy it and update AI_API_BASE_URL in constants/config.ts in the Renewly app."

#!/bin/bash
# Pushes the four DIDIT_* env vars from .env.local up to Vercel for
# production + preview + development. Values stay local; vercel CLI streams
# them directly to Vercel's env store.
#
# Usage: bash scripts/push-didit-to-vercel.sh

set -euo pipefail

if [ ! -f .env.local ]; then
  echo "No .env.local in current dir." >&2
  exit 1
fi

VARS=(DIDIT_ENV DIDIT_API_KEY DIDIT_WEBHOOK_SECRET DIDIT_WORKFLOW_ID)
ENVS=(production preview development)

for name in "${VARS[@]}"; do
  # Read value from .env.local (strip optional quotes).
  value=$(grep -E "^${name}=" .env.local | head -n1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/')
  if [ -z "$value" ]; then
    echo "  skip $name (missing in .env.local)"
    continue
  fi
  for env in "${ENVS[@]}"; do
    vercel env add "$name" "$env" --value "$value" --sensitive --force -y >/dev/null 2>&1
    echo "  set $name → $env"
  done
done

echo ""
echo "Done. Trigger a redeploy so the new vars are picked up:"
echo "  vercel --prod"

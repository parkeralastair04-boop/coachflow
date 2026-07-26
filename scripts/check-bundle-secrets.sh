#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATIC_DIR="${ROOT_DIR}/.next/static"

if [[ ! -d "${STATIC_DIR}" ]]; then
  echo "ERROR: ${STATIC_DIR} not found. Run 'npm run build' first."
  exit 1
fi

echo "Scanning client bundles in ${STATIC_DIR} for leaked secrets..."

FOUND=0

scan_pattern() {
  local label="$1"
  local pattern="$2"

  if grep -RqE "${pattern}" "${STATIC_DIR}" 2>/dev/null; then
    echo "ERROR: Found forbidden pattern (${label}) in client bundle."
    grep -RnE "${pattern}" "${STATIC_DIR}" | head -20
    FOUND=1
  fi
}

scan_pattern "env var name" "SUPABASE_SERVICE_ROLE_KEY"
scan_pattern "admin client helper" "createAdminClient"
scan_pattern "supabase secret key prefix" "sb_secret_"
scan_pattern "service role jwt role claim" '"role":"service_role"'
scan_pattern "service role jwt role claim (spaced)" '"role": "service_role"'
scan_pattern "service role base64 fragment" "c2VydmljZV9yb2xl"
scan_pattern "service role jwt payload prefix" "eyJyb2xlIjoic2VydmljZV9yb2xl"

if [[ "${FOUND}" -ne 0 ]]; then
  echo "Bundle secret scan failed."
  exit 1
fi

echo "Static pattern scan passed."
node "${ROOT_DIR}/scripts/check-bundle-jwt-leaks.mjs"

echo "Bundle secret scan passed."

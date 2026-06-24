#!/usr/bin/env bash
# Deploy the StellarCred contracts to testnet, wiring them together in
# dependency order, and print the resulting env vars for the frontend.
#
# Usage:
#   stellar keys generate --global deployer --network testnet --fund
#   SOURCE=deployer ./scripts/deploy.sh
#
# Requires stellar CLI v26+ (the verifier uses BN254 host functions / protocol
# 23). Registers the kyc circuit's verification key so the system works as-is.
set -euo pipefail

SOURCE="${SOURCE:-deployer}"
NETWORK="${NETWORK:-testnet}"
WASM_DIR="target/wasm32v1-none/release"

echo "Building contracts..."
stellar contract build >/dev/null

ADMIN="$(stellar keys address "$SOURCE")"
echo "Admin / deployer: $ADMIN"

deploy() {
  # $1 = wasm name (no extension); remaining args = constructor args
  local name="$1"; shift
  stellar contract deploy \
    --wasm "$WASM_DIR/$name.wasm" \
    --source "$SOURCE" --network "$NETWORK" \
    -- "$@"
}

echo "Deploying issuer_registry..."
ISSUER_REGISTRY_ID="$(deploy issuer_registry --admin "$ADMIN")"

echo "Deploying credential_verifier..."
CREDENTIAL_VERIFIER_ID="$(deploy credential_verifier --admin "$ADMIN")"

echo "Deploying proof_registry (-> verifier)..."
PROOF_REGISTRY_ID="$(deploy proof_registry --verifier "$CREDENTIAL_VERIFIER_ID")"

echo "Deploying gated_pool (-> registry)..."
GATED_POOL_ID="$(deploy gated_pool --registry "$PROOF_REGISTRY_ID")"

echo "Registering kyc verification key..."
stellar contract invoke \
  --id "$CREDENTIAL_VERIFIER_ID" \
  --source "$SOURCE" --network "$NETWORK" \
  --send yes \
  -- set_vk \
  --credential_type kyc \
  --vk-file-path fixtures/kyc/vk

cat <<EOF

Deployed. Copy into frontend/.env.local:

NEXT_PUBLIC_ISSUER_REGISTRY_ID=$ISSUER_REGISTRY_ID
NEXT_PUBLIC_CREDENTIAL_VERIFIER_ID=$CREDENTIAL_VERIFIER_ID
NEXT_PUBLIC_PROOF_REGISTRY_ID=$PROOF_REGISTRY_ID
NEXT_PUBLIC_GATED_POOL_ID=$GATED_POOL_ID
EOF

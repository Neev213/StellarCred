# StellarCred

Prove credential attributes on Stellar without the credential data ever touching
the chain. A user holds a credential issued by a trusted party (KYC provider,
government, employer), generates a zero-knowledge proof locally, and protocols
verify that proof on-chain — one verification, usable everywhere.

## Architecture

```
Issuer ──signs──> Credential (held by user, never on-chain)
                       │
                  Noir circuit (runs in browser, WASM)
                       │  proof + public inputs
                       ▼
  ┌────────────────────────────────────────────────────────┐
  │ Soroban contracts                                        │
  │                                                          │
  │  IssuerRegistry ── trust root: which issuers, which      │
  │                    credential types                      │
  │  CredentialVerifier ── stateless UltraHonk verify        │
  │                    (one fn per credential type)          │
  │  ProofRegistry ── caches "address X verified until T"    │
  │  GatedPool ── demo: deposits gated on KYC proof          │
  └────────────────────────────────────────────────────────┘
```

Data flow: `submit_proof` → ProofRegistry calls CredentialVerifier → if valid,
caches the result. Protocols (GatedPool) then make one cheap `is_verified` call
instead of re-running the verifier.

## Layout

```
contracts/          Soroban workspace (Rust, soroban-sdk 26)
  issuer_registry/      trust root; submit_proof checks is_valid_issuer
  credential_verifier/  real UltraHonk verify via host-native BN254 (VK per type)
  proof_registry/       caches verifications w/ expiry + TTL; gated on issuer
  gated_pool/           demo DeFi pool gated on a KYC proof
circuits/           Noir circuits (UltraHonk, Noir beta.9 / bb 0.87.0)
  commit/               issuer helper: returns Poseidon2([value, salt], 2)
  kyc_proof/            "I hold a credential the issuer committed to"
  age_proof/            "I am over N" without revealing DOB
  income_proof/         "my income exceeds T" without revealing it
  jurisdiction_proof/   "my country is not in [list]" without revealing it
  scripts/build.sh      compile + prove + stage circuit JSON for the frontend
fixtures/<type>/    real vk/proof/public_inputs per type, used by contract tests
frontend/           Next.js app — Issuer / Holder / Verifier screens
scripts/deploy.sh   deploy + wire + register issuer + install all VKs on testnet
```

All four credential circuits share one commitment scheme,
`commitment = Poseidon2([value, salt], 2)`, so the issuer derives commitments
with a single `commit` helper and every type is issuable and provable.

## Status

The **ZK verification is real**, not stubbed. `CredentialVerifier` runs the
host-native BN254 UltraHonk verifier from
[`rs-soroban-ultrahonk`](https://github.com/yugocabrio/rs-soroban-ultrahonk),
and the full path (GatedPool → ProofRegistry → IssuerRegistry + CredentialVerifier
→ BN254) is covered by tests that verify **genuine proofs** for all four
credential types.

What works today:
- All four contracts build to wasm on soroban-sdk 26; **20 contract tests pass**,
  including real proof verification for `kyc`/`age`/`income`/`jurisdiction`, an
  untrusted-issuer rejection, and a proof-expiry test that advances ledger time.
- `submit_proof` checks `IssuerRegistry.is_valid_issuer(issuer_id, type)` before
  verifying, and persistent writes extend their TTL.
- `circuits/scripts/build.sh` builds every circuit, commits VK + proof fixtures,
  and stages circuit JSON for the browser prover.
- Real end-to-end product flow: the Issuer page generates a secret, computes the
  Poseidon commitment via the `commit` circuit, and issues a credential; the
  Holder page generates a real UltraHonk proof (`noir_js` + `bb.js`) and submits
  it on-chain; the Demo page reads `is_verified` for all gated types.

Still to wire:
- **Deploy + click-through.** Everything builds, typechecks, and serves; a live
  testnet deploy (`./scripts/deploy.sh`, CLI 27) + a first in-browser proof run is
  the remaining validation.

## De-risking result (resolved)

- **soroban-sdk** is now `26.0.1` — the verifier uses the host-native BN254 crypto
  added in v26 (`soroban_sdk::crypto::bn254`), which is why on-chain verification
  fits the resource budget (~0.014 XLM/verify on testnet per the reference repo).
- **Toolchain is pinned**: Noir `1.0.0-beta.9`, Barretenberg `bb v0.87.0`, matching
  the verifier crate. The VK is deterministic from the circuit; our `kyc_proof`
  VK is byte-identical to the reference identity circuit's.

Known gaps (honest, not blockers for the demo):
1. **Issuer ↔ commitment binding is not cryptographic yet.** `submit_proof` now
   verifies the named `issuer_id` is registered and trusted
   (`IssuerRegistry.is_valid_issuer`), but the ZK proof only proves knowledge of
   a commitment pre-image — it does **not** prove the issuer signed that
   commitment. The credential `signature` field is therefore a placeholder
   (`"unsigned-demo"`). The hardening step is to have the issuer sign the
   commitment (ed25519/Schnorr) and verify that signature inside the circuit
   against the issuer's registered `pubkey`.
2. **Proof expiry storage.** ProofRegistry uses `persistent` storage with an
   explicit `expiry` field (checked against ledger time) plus TTL extension;
   `temporary` storage (ledger-enforced auto-TTL) is an alternative.

## Prerequisites

- Rust (nightly ok) + `wasm32v1-none` target: `rustup target add wasm32v1-none`
- Stellar CLI **v26+** to deploy (BN254 protocol); 23+ builds wasm fine
- Noir `nargo` **1.0.0-beta.9** (`noirup -v 1.0.0-beta.9`) + Barretenberg
  **bb v0.87.0** (`bbup -v 0.87.0`) — versions must match or the VK won't validate
- Node 20+ and pnpm

## Build & test

```bash
# Contracts (real proof verification in tests)
cargo test                 # 15 tests, incl. genuine BN254 verification
stellar contract build     # wasm artifacts -> target/wasm32v1-none/release

# Circuits — compile, prove, and stage circuit JSON for the frontend
./circuits/scripts/build.sh                 # all circuits
./circuits/scripts/build.sh kyc_proof       # one

# Frontend
cd frontend && pnpm install && pnpm dev
```

## Run it end to end (testnet)

One-time toolchain (macOS):

```bash
brew install stellar-cli            # need v26+; this repo verified on 27.0.0
rustup target add wasm32v1-none
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
noirup -v 1.0.0-beta.9              # nargo
curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/refs/heads/next/barretenberg/bbup/install | bash
bbup -v 0.87.0                      # bb
```

Deploy + wire the contracts, then point the frontend at them:

```bash
# 1. Create and fund a deployer identity (friendbot)
stellar keys generate --global deployer --network testnet --fund

# 2. Build, deploy all 4 contracts, wire them, and register the 3 VKs
SOURCE=deployer ./scripts/deploy.sh

# 3. Copy the printed NEXT_PUBLIC_* contract ids into frontend/.env.local
cp frontend/.env.example frontend/.env.local   # then paste the ids

# 4. (optional) regenerate circuit artifacts + VKs
./circuits/scripts/build.sh

# 5. Run the app
cd frontend && pnpm install && pnpm dev
```

In the browser: install **Freighter**, switch it to **testnet**, and fund that
account (https://lab.stellar.org or friendbot). On **Holder**, connect the
wallet → "Generate proof" (proves locally, ~seconds) → "Submit to Stellar"
(signs + submits). On **Demo**, connect the same wallet to see *access denied →
granted*. The deployer and the in-wallet holder can be the same funded account.

Notes:
- The demo KYC credential carries the preimage that matches the deployed `kyc`
  VK, so its proof verifies. Real issuance (issuer computes the commitment and
  signs) is the next step — see Status.
- In-browser proving uses cross-origin isolation (COOP/COEP headers in
  `next.config.mjs`) for multithreading; it falls back to single-threaded.

## References

- ZK on Stellar: https://developers.stellar.org/docs/build/apps/zk
- UltraHonk verifier: https://github.com/yugocabrio/rs-soroban-ultrahonk
- Noir: https://noir-lang.org/docs
- Stellar Wallets Kit: https://stellarwalletskit.dev

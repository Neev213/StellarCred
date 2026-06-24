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
contracts/          Soroban workspace (Rust)
  issuer_registry/      trust root (admin-controlled)
  credential_verifier/  UltraHonk verification gateway (verify is STUBBED)
  proof_registry/       caches successful verifications with expiry
  gated_pool/           demo DeFi pool gated on a KYC proof
circuits/           Noir circuits (UltraHonk)
  age_proof/            "I am over N" without revealing DOB
  jurisdiction_proof/   "my country is not in [list]" without revealing it
frontend/           Next.js app — Issuer / Holder / Verifier screens
scripts/deploy.sh   build + deploy + wire contracts on testnet
```

## Status

This is a **scaffold**. The end-to-end shape (issue → prove → submit → gate)
compiles and is tested, but two pieces are deliberately stubbed pending
de-risking:

- **`CredentialVerifier::verify`** does a structural check only. Real UltraHonk
  verification needs wiring to [`rs-soroban-ultrahonk`](https://github.com/yugocabrio/rs-soroban-ultrahonk).
- **`frontend/lib/proof.ts`** throws. Real proof generation needs
  `@noir-lang/noir_js` + `@aztec/bb.js` against the compiled circuits.

What works today: all four contracts build to wasm, 12 contract tests pass, both
circuits compile and their tests pass.

## Open decisions (resolve before building real verification)

1. **soroban-sdk version.** Pinned at `22.0.0`. The BN254 + Poseidon host
   functions that UltraHonk verification calls were added in **v25+**, and those
   CAPs (0074/0075) are status-sensitive — confirm they are live on the target
   network before bumping. This is the single biggest technical risk; de-risk it
   first (clone `rs-soroban-ultrahonk`, deploy, verify a dummy proof on testnet).
2. **Noir/bb version pinning.** Local `nargo` is `1.0.0-beta.18`; the reference
   verifier was built against Noir `1.0.0-beta.9` / Barretenberg `0.87.0`. The VK
   format must match between proof generation and the on-chain verifier — pin
   these together once the verifier is chosen.
3. **Credential binding.** Circuits currently bind to a Pedersen commitment as a
   stand-in for verifying the issuer's signature. Replacing this with real
   ECDSA/Schnorr signature verification over the credential is a hardening step.
4. **Proof expiry storage.** ProofRegistry uses `persistent` storage with an
   explicit `expiry` field. Consider `temporary` storage (auto-TTL) if you want
   expiry enforced by the ledger rather than a timestamp check.

## Prerequisites

- Rust (nightly ok) + `wasm32v1-none` target: `rustup target add wasm32v1-none`
- Stellar CLI 23+: `stellar --version`
- Noir `nargo` 1.0.0-beta.x + Barretenberg `bb` (for real proof generation)
- Node 20+ and pnpm

Recommended (per project references): install the Stellar dev skill so generated
code stays idiomatic — `/plugin marketplace add stellar/stellar-dev-skill` then
`/plugin install stellar-dev@stellar-dev`.

## Build & test

```bash
# Contracts
cargo test                 # native tests (fast)
stellar contract build     # wasm artifacts -> target/wasm32v1-none/release

# Circuits
cd circuits/age_proof && nargo test && nargo compile
cd circuits/jurisdiction_proof && nargo test && nargo compile

# Frontend
cd frontend && pnpm install && pnpm dev
```

## Deploy to testnet

```bash
stellar keys generate --global deployer --network testnet --fund
SOURCE=deployer ./scripts/deploy.sh
# paste the printed NEXT_PUBLIC_* vars into frontend/.env.local
```

## References

- ZK on Stellar: https://developers.stellar.org/docs/build/apps/zk
- UltraHonk verifier: https://github.com/yugocabrio/rs-soroban-ultrahonk
- Noir: https://noir-lang.org/docs
- Stellar Wallets Kit: https://stellarwalletskit.dev

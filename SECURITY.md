# Security Policy

## Supported versions

StellarCred is in active development. Security fixes are applied to the latest commit on `main`.

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Email **dahunsisamuel1st@gmail.com** with:

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept (private gist / attachment is fine)
- Any suggested mitigations if you have them

You will receive an acknowledgement within 48 hours. If the issue is confirmed, a fix will be prioritised and you will be credited in the release notes unless you prefer to remain anonymous.

## Scope

Areas of particular interest:

| Area | Risk |
|------|------|
| `contracts/proof_registry` | Forged proofs accepted on-chain |
| `contracts/issuer_registry` | Unauthorized issuer registration |
| `app/api/issue/route.ts` | Server-side signing key exposure, credential forgery |
| In-circuit ECDSA (`std::ecdsa_secp256k1`) | Signature bypass |
| Persona KYC relay | Identity data leakage, bypass |

## Security model notes

- `ISSUER_PRIVATE_KEY` must never have a `NEXT_PUBLIC_` prefix — it is server-side only.
- The issuer's secp256k1 signature is verified **inside** the ZK proof (`std::ecdsa_secp256k1`), and the contract checks the public key from public inputs matches the registered issuer key. A valid proof requires a registered issuer to have signed the credential.
- `prehash: false` is required when signing — Noir uses the raw 32-byte commitment as the message digest. Changing this breaks all existing proofs.
- Identity fields from KYC providers are used only to derive credential values and are never stored or logged after the API call completes.

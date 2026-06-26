"use client";

// Issuer-side secp256k1 ECDSA signing — matches circuits/scripts/sign.js and
// Noir's std::ecdsa_secp256k1::verify_signature. The issuer signs the raw
// 32-byte commitment (prehash:false, so z = commitment); the circuit passes the
// same commitment to verify_signature.
//
// DEMO KEY ONLY. A real issuer holds its secret key off the client (e.g. signs
// server-side). The corresponding public key is registered in IssuerRegistry,
// and ProofRegistry binds every proof to it.

import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";

const DEMO_SK = sha256(new TextEncoder().encode("stellarcred-demo-issuer"));

function be32(v: bigint): Uint8Array {
  const b = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) {
    b[i] = Number(v & 255n);
    v >>= 8n;
  }
  return b;
}

export function issuerPublicKey(): { x: number[]; y: number[]; hex: string } {
  const p = secp256k1.getPublicKey(DEMO_SK, false); // 0x04 || x || y
  const x = p.slice(1, 33);
  const y = p.slice(33, 65);
  const hex = Buffer.from([...x, ...y]).toString("hex");
  return { x: Array.from(x), y: Array.from(y), hex };
}

export function signCommitment(commitment: string): {
  sig: number[];
  issuerX: number[];
  issuerY: number[];
} {
  const sig = secp256k1.sign(be32(BigInt(commitment)), DEMO_SK, { prehash: false });
  const { x, y } = issuerPublicKey();
  return { sig: Array.from(sig), issuerX: x, issuerY: y };
}

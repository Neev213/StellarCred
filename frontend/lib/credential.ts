"use client";

// Credential issuance + local storage.
//
// A credential is a small JSON object the issuer signs to a holder. The holder
// keeps it locally and proves knowledge of its `preimage` (the secret) without
// revealing it. The `commitment` is Poseidon2(preimage), computed by running
// the `commit` helper circuit so it always matches the proving circuit's hash.

import type { CredentialType } from "./stellar";

export interface Credential {
  type: CredentialType;
  title: string;
  claim: string;
  issuer: string;
  holder: string;
  /** Secret preimage (private input to the proof). Never shared on-chain. */
  preimage: string;
  /** Poseidon2(preimage) — the public input the proof commits to. */
  commitment: string;
  /** Issuer attestation over the commitment. Placeholder until real signing. */
  signature: string;
  issuedAt: number;
  expiry: string;
}

export const TYPE_META: Record<
  CredentialType,
  { title: string; claim: string; issuable: boolean }
> = {
  kyc: { title: "KYC Complete", claim: "identity verified", issuable: true },
  age: { title: "Age Verified", claim: "age ≥ 18", issuable: false },
  jurisdiction: {
    title: "Jurisdiction Eligible",
    claim: "country not restricted",
    issuable: false,
  },
  income: { title: "Accredited Investor", claim: "income > $200k", issuable: false },
};

// BN254 scalar field is ~254 bits; 31 random bytes (248 bits) is always in range.
export function randomPreimage(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(31));
  return (
    "0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

// Derive commitment = Poseidon2(preimage) via the commit circuit (witness only).
async function poseidonCommit(preimage: string): Promise<string> {
  const res = await fetch("/circuits/commit.json");
  if (!res.ok) throw new Error("commit circuit not found (run circuits/scripts/build.sh)");
  const circuit = await res.json();
  const { Noir } = await import("@noir-lang/noir_js");
  const noir = new Noir(circuit);
  const { returnValue } = await noir.execute({ preimage });
  return String(returnValue);
}

export async function issueCredential(opts: {
  type: CredentialType;
  holder: string;
  issuer: string;
  expiry: string;
}): Promise<Credential> {
  const preimage = randomPreimage();
  const commitment = await poseidonCommit(preimage);
  const meta = TYPE_META[opts.type];
  return {
    type: opts.type,
    title: meta.title,
    claim: meta.claim,
    issuer: opts.issuer,
    holder: opts.holder,
    preimage,
    commitment,
    // Real issuance would sign the commitment with the issuer's key; the proof
    // already binds to the commitment, so this is an attestation placeholder.
    signature: "unsigned-demo",
    issuedAt: Math.floor(Date.now() / 1000),
    expiry: opts.expiry,
  };
}

// ---- Local wallet (this browser) ----------------------------------------

const KEY = "stellarcred:credentials";

export function loadCredentials(): Credential[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveCredential(cred: Credential): Credential[] {
  const all = loadCredentials();
  // De-dupe by (type, commitment).
  const next = [
    cred,
    ...all.filter((c) => !(c.type === cred.type && c.commitment === cred.commitment)),
  ];
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function removeCredential(commitment: string): Credential[] {
  const next = loadCredentials().filter((c) => c.commitment !== commitment);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function parseCredential(json: string): Credential {
  const c = JSON.parse(json);
  if (!c.type || !c.preimage || !c.commitment) {
    throw new Error("Not a valid credential (missing type, preimage, or commitment).");
  }
  return c as Credential;
}

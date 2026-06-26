"use client";

// Credential issuance + local storage.
//
// A credential commits to a private attribute: commitment = Poseidon2([value,
// salt], 2), computed by running the `commit` helper circuit so it always
// matches the proving circuits. The holder later proves a claim about `value`
// (knowledge of it for KYC; a range/membership claim for age/income/
// jurisdiction) without revealing it.

import type { CredentialType } from "./stellar";

export interface Credential {
  type: CredentialType;
  title: string;
  claim: string;
  /** Issuer display name. */
  issuer: string;
  /** Registered issuer Stellar address — checked by IssuerRegistry on submit. */
  issuerId: string;
  holder: string;
  /** Private committed attribute (identity secret / DOB-days / income / country). */
  value: string;
  salt: string;
  /** Poseidon2([value, salt], 2). */
  commitment: string;
  /** Issuer attestation. Placeholder until in-circuit signature verification. */
  signature: string;
  issuedAt: number;
  expiry: string;
}

export const TYPE_META: Record<
  CredentialType,
  { title: string; claim: string; issuable: boolean; attribute?: string }
> = {
  kyc: { title: "KYC Complete", claim: "identity verified", issuable: true },
  age: { title: "Age Verified", claim: "age ≥ 18", issuable: true, attribute: "Date of birth" },
  income: {
    title: "Accredited Investor",
    claim: "income > $200k",
    issuable: true,
    attribute: "Annual income (USD)",
  },
  jurisdiction: {
    title: "Jurisdiction Eligible",
    claim: "country not restricted",
    issuable: true,
    attribute: "Country (ISO numeric)",
  },
};

// BN254 scalar field is ~254 bits; 31 random bytes (248 bits) is always in range.
export function randomField(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(31));
  return (
    "0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

// Derive commitment = Poseidon2([value, salt], 2) via the commit circuit.
async function poseidonCommit(value: string, salt: string): Promise<string> {
  const res = await fetch("/circuits/commit.json");
  if (!res.ok) throw new Error("commit circuit not found (run circuits/scripts/build.sh)");
  const circuit = await res.json();
  const { Noir } = await import("@noir-lang/noir_js");
  const noir = new Noir(circuit);
  const { returnValue } = await noir.execute({ value, salt });
  return String(returnValue);
}

// Turn the issuer's per-type attribute input into the committed `value`.
function attributeToValue(type: CredentialType, attribute: string): string {
  switch (type) {
    case "kyc":
      return randomField(); // identity secret — no human-entered attribute
    case "age": {
      // attribute is a YYYY-MM-DD date; commit to days since the Unix epoch.
      const days = Math.floor(new Date(attribute).getTime() / 86_400_000);
      return String(days);
    }
    case "income":
    case "jurisdiction":
      return String(parseInt(attribute, 10)); // income in USD / ISO numeric code
  }
}

export async function issueCredential(opts: {
  type: CredentialType;
  holder: string;
  issuerId: string;
  issuerName: string;
  expiry: string;
  attribute: string;
}): Promise<Credential> {
  const value = attributeToValue(opts.type, opts.attribute);
  const salt = randomField();
  const commitment = await poseidonCommit(value, salt);
  const meta = TYPE_META[opts.type];
  return {
    type: opts.type,
    title: meta.title,
    claim: meta.claim,
    issuer: opts.issuerName,
    issuerId: opts.issuerId,
    holder: opts.holder,
    value,
    salt,
    commitment,
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
  if (!c.type || c.value === undefined || !c.commitment || !c.issuerId) {
    throw new Error("Not a valid credential (missing type, value, commitment, or issuerId).");
  }
  return c as Credential;
}

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
// Resolved by webpack at build time — avoids process.cwd() which is unreliable
// in Next.js server routes (can return "/" depending on how the server starts).
import commitCircuit from "../../../public/circuits/commit.json";

// Server-side only — never shipped to the browser.
// Set ISSUER_PRIVATE_KEY in .env.local to the 64-char hex secp256k1 private
// key whose public key was registered in IssuerRegistry. The registered pubkey
// and the signing key must match or ProofRegistry will reject every proof.
const DEMO_SK = process.env.ISSUER_PRIVATE_KEY
  ? Buffer.from(process.env.ISSUER_PRIVATE_KEY, "hex")
  : sha256(new TextEncoder().encode("stellarcred-demo-issuer"));

function be32(v: bigint): Uint8Array {
  const b = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) {
    b[i] = Number(v & 255n);
    v >>= 8n;
  }
  return b;
}

function randomField(): string {
  // 31 bytes = 248 bits, always fits in BN254 scalar field.
  return "0x" + randomBytes(31).toString("hex");
}

// Derive the circuit `value` (preimage) for a credential type from the shared
// verification attributes. One SmileID/KYC response carries everything needed
// for every requested type, so each type just reads the field it cares about.
function attributeToValue(type: string, attributes: Record<string, string>): string {
  switch (type) {
    case "kyc":
      // Binary claim — no attribute to commit, just a fresh random secret.
      return randomField();
    case "age": {
      const dob = attributes.date_of_birth;
      if (!dob) throw new Error("age credential requires attributes.date_of_birth");
      const days = Math.floor(new Date(dob).getTime() / 86_400_000);
      if (!Number.isFinite(days)) throw new Error("Invalid date_of_birth");
      return String(days);
    }
    case "income": {
      const income = parseInt(attributes.income ?? "", 10);
      if (!Number.isFinite(income)) throw new Error("income credential requires attributes.income");
      return String(income);
    }
    case "jurisdiction": {
      const country = parseInt(attributes.country_code ?? "", 10);
      if (!Number.isFinite(country)) throw new Error("jurisdiction credential requires attributes.country_code");
      return String(country);
    }
    default:
      throw new Error(`Unknown credential type: ${type}`);
  }
}

async function poseidonCommit(value: string, salt: string): Promise<string> {
  const { Noir } = await import("@noir-lang/noir_js");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const noir = new Noir(commitCircuit as any);
  const { returnValue } = await noir.execute({ value, salt });
  return String(returnValue);
}

function issuerPublicKey(): { x: number[]; y: number[] } {
  const p = secp256k1.getPublicKey(DEMO_SK, false); // 0x04 || x || y
  return { x: Array.from(p.slice(1, 33)), y: Array.from(p.slice(33, 65)) };
}

function signCommitment(commitment: string): {
  sig: number[];
  issuerX: number[];
  issuerY: number[];
} {
  const sig = secp256k1.sign(be32(BigInt(commitment)), DEMO_SK, { prehash: false });
  const { x, y } = issuerPublicKey();
  return { sig: Array.from(sig), issuerX: x, issuerY: y };
}

// Attestation relay: StellarCred verifies identity with a trusted KYC provider
// (SmileID) and only then signs credentials. We never store the raw identity
// fields — they are passed straight to SmileID and discarded.
//
// Mock mode: with no SMILEID_API_KEY set, verification always passes so local
// development and the sandbox demo work without provider credentials.
async function verifyWithSmileID(attributes: Record<string, string>): Promise<boolean> {
  if (!process.env.SMILEID_API_KEY) {
    console.warn(
      "[StellarCred] SMILEID_API_KEY not set — running in mock mode, verification always passes",
    );
    return true;
  }

  const response = await fetch("https://testapi.smileidentity.com/v1/id_verification", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SMILEID_API_KEY}`,
    },
    body: JSON.stringify({
      partner_id: process.env.SMILEID_PARTNER_ID,
      country: attributes.country ?? "NG",
      id_type: "NIN_SLIP",
      id_number: attributes.id_number ?? "00000000000",
      first_name: attributes.first_name ?? "",
      last_name: attributes.last_name ?? "",
    }),
  });

  const result = await response.json();
  // SmileID returns ResultCode "1020" for an exact match.
  return result.ResultCode === "1020" || result.result?.ResultCode === "1020";
}

const VALID_TYPES = ["kyc", "age", "income", "jurisdiction"];

const TYPE_META: Record<string, { title: string; claim: string }> = {
  kyc: { title: "KYC Complete", claim: "identity verified" },
  age: { title: "Age Verified", claim: "age >= 18" },
  income: { title: "Accredited Investor", claim: "income > $200k" },
  jurisdiction: { title: "Jurisdiction Eligible", claim: "country not restricted" },
};

interface IssueParams {
  type: string;
  holder: string;
  issuerId: string;
  issuerName: string;
  expiry: string;
  attributes: Record<string, string>;
}

// Build one complete, independent credential for a single type. Each gets its
// own preimage/salt/commitment/signature — they share nothing but the issuer.
async function buildCredential({ type, holder, issuerId, issuerName, expiry, attributes }: IssueParams) {
  const value = attributeToValue(type, attributes);
  const salt = randomField();
  const commitment = await poseidonCommit(value, salt);
  const { sig, issuerX, issuerY } = signCommitment(commitment);
  const meta = TYPE_META[type];
  return {
    type,
    title: meta.title,
    claim: meta.claim,
    issuer: issuerName,
    issuerId,
    holder,
    value,
    salt,
    commitment,
    sig,
    issuerPubX: issuerX,
    issuerPubY: issuerY,
    issuedAt: Math.floor(Date.now() / 1000),
    expiry,
  };
}

export async function POST(req: NextRequest) {
  let body: {
    credential_types?: string[];
    // Legacy single-type shape — still accepted for backward compatibility.
    type?: string;
    holder?: string;
    issuerId?: string;
    issuerName?: string;
    expiry?: string;
    attributes?: Record<string, string>;
    attribute?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    holder,
    issuerId,
    issuerName = "StellarCred Authority",
    expiry = "90 days",
  } = body;

  // Normalize to the multi-claim shape. Legacy callers send { type, attribute };
  // map that single attribute onto the right key in `attributes`.
  const credentialTypes = body.credential_types ?? (body.type ? [body.type] : []);
  const attributes: Record<string, string> = { ...(body.attributes ?? {}) };
  if (body.attribute !== undefined && body.type) {
    if (body.type === "age") attributes.date_of_birth ??= body.attribute;
    else if (body.type === "income") attributes.income ??= body.attribute;
    else if (body.type === "jurisdiction") attributes.country_code ??= body.attribute;
  }

  if (credentialTypes.length === 0) {
    return NextResponse.json({ error: "credential_types must contain at least one type" }, { status: 400 });
  }
  const invalid = credentialTypes.find((t) => !VALID_TYPES.includes(t));
  if (invalid) {
    return NextResponse.json({ error: `Invalid credential type: ${invalid}` }, { status: 400 });
  }
  if (!holder) {
    return NextResponse.json({ error: "holder address is required" }, { status: 400 });
  }
  if (!issuerId) {
    return NextResponse.json({ error: "issuerId is required" }, { status: 400 });
  }

  // Gate issuance on identity verification (mock-passes without an API key).
  const passed = await verifyWithSmileID(attributes);
  if (!passed) {
    return NextResponse.json({ error: "Identity verification failed" }, { status: 403 });
  }

  try {
    // De-duplicate types so the same claim isn't issued twice in one call.
    const uniqueTypes = Array.from(new Set(credentialTypes));
    const credentials = [];
    for (const type of uniqueTypes) {
      credentials.push(
        await buildCredential({ type, holder, issuerId, issuerName, expiry, attributes }),
      );
    }
    return NextResponse.json({ credentials });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

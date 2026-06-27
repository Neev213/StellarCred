import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
// Resolved by webpack at build time — avoids process.cwd() which is unreliable
// in Next.js server routes (can return "/" depending on how the server starts).
import commitCircuit from "../../../public/circuits/commit.json";

// Server-side only — the demo key never ships to the browser.
// DEMO KEY ONLY. A real issuer would read this from a secrets manager.
const DEMO_SK = sha256(new TextEncoder().encode("stellarcred-demo-issuer"));

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

function attributeToValue(type: string, attribute: string): string {
  switch (type) {
    case "kyc":
      return randomField();
    case "age": {
      const days = Math.floor(new Date(attribute).getTime() / 86_400_000);
      return String(days);
    }
    case "income":
    case "jurisdiction":
      return String(parseInt(attribute, 10));
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

const VALID_TYPES = ["kyc", "age", "income", "jurisdiction"];

const TYPE_META: Record<string, { title: string; claim: string }> = {
  kyc: { title: "KYC Complete", claim: "identity verified" },
  age: { title: "Age Verified", claim: "age >= 18" },
  income: { title: "Accredited Investor", claim: "income > $200k" },
  jurisdiction: { title: "Jurisdiction Eligible", claim: "country not restricted" },
};

export async function POST(req: NextRequest) {
  let body: {
    type?: string;
    holder?: string;
    issuerId?: string;
    issuerName?: string;
    expiry?: string;
    attribute?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, holder, issuerId, issuerName = "StellarCred Authority", expiry = "90 days", attribute = "" } = body;

  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid or missing credential type" }, { status: 400 });
  }
  if (!holder) {
    return NextResponse.json({ error: "holder address is required" }, { status: 400 });
  }
  if (!issuerId) {
    return NextResponse.json({ error: "issuerId is required" }, { status: 400 });
  }

  try {
    const value = attributeToValue(type, attribute);
    const salt = randomField();
    const commitment = await poseidonCommit(value, salt);
    const { sig, issuerX, issuerY } = signCommitment(commitment);
    const meta = TYPE_META[type];

    return NextResponse.json({
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
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

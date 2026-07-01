import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHmac } from "crypto";
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
    case "funds": {
      const balance = parseInt(attributes.balance ?? "", 10);
      if (!Number.isFinite(balance)) throw new Error("funds credential requires attributes.balance");
      return String(balance);
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

// SmileID authenticates via HMAC-SHA256, not Bearer tokens.
// signature = base64(HMAC_SHA256(timestamp + partner_id + "sid_request", api_key))
function smileIDSignature(
  partnerId: string,
  apiKey: string,
): { timestamp: string; signature: string } {
  const timestamp = new Date().toISOString();
  const signature = createHmac("sha256", apiKey)
    .update(timestamp + partnerId + "sid_request")
    .digest("base64");
  return { timestamp, signature };
}

async function verifyWithSmileID(
  attributes: Record<string, string>,
): Promise<{ ok: boolean; code: string; text: string }> {
  if (!process.env.SMILEID_API_KEY) {
    console.warn(
      "[StellarCred] SMILEID_API_KEY not set — running in mock mode, verification always passes",
    );
    return { ok: true, code: "mock", text: "mock mode" };
  }

  const apiKey = process.env.SMILEID_API_KEY;
  const partnerId = process.env.SMILEID_PARTNER_ID ?? "";
  const isSandbox = (process.env.SMILEID_ENVIRONMENT ?? "sandbox") !== "production";
  const baseUrl = isSandbox
    ? "https://testapi.smileidentity.com"
    : "https://api.smileidentity.com";

  const { timestamp, signature } = smileIDSignature(partnerId, apiKey);

  const response = await fetch(`${baseUrl}/v1/id_verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      partner_id: partnerId,
      timestamp,
      signature,
      country: attributes.country ?? "NG",
      id_type: process.env.SMILEID_ID_TYPE ?? "NIN_V2",
      id_number: attributes.id_number ?? "",
      first_name: attributes.first_name ?? "",
      last_name: attributes.last_name ?? "",
      partner_params: {
        job_id: randomBytes(16).toString("hex"),
        user_id: randomBytes(16).toString("hex"),
        job_type: 5,
        ...(isSandbox ? { sandbox_result: "0" } : {}),
      },
    }),
  });

  const result = await response.json();
  const code: string = result.ResultCode ?? result.result?.ResultCode ?? "";
  const text: string = result.ResultText ?? result.result?.ResultText ?? "";
  console.log("[SmileID]", response.status, code, text);

  // 1012 = sandbox success; 1020 = production exact match; 1021 = partial match.
  const ok = code === "1012" || code === "1020" || code === "1021";
  return { ok, code, text };
}

// Plaid balance attestation relay. Returns the verified balance from the user's
// bank — this becomes the credential value, not what the user typed.
// Mock mode: no PLAID_ACCESS_TOKEN set → returns a mock balance of $50,000.
async function verifyWithPlaid(): Promise<{ ok: boolean; balance?: number; error?: string }> {
  if (!process.env.PLAID_ACCESS_TOKEN) {
    console.warn(
      "[StellarCred] PLAID_ACCESS_TOKEN not set — running in mock mode, returning mock balance $50,000",
    );
    return { ok: true, balance: 50000 };
  }

  const env = process.env.PLAID_ENV ?? "sandbox";
  const baseUrl =
    env === "production"
      ? "https://production.plaid.com"
      : env === "development"
        ? "https://development.plaid.com"
        : "https://sandbox.plaid.com";

  const response = await fetch(`${baseUrl}/accounts/balance/get`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      access_token: process.env.PLAID_ACCESS_TOKEN,
    }),
  });

  const result = await response.json();
  console.log("[Plaid]", response.status, result.error_code ?? "ok");

  if (!response.ok || result.error_code) {
    return { ok: false, error: result.error_message ?? "Plaid error" };
  }

  // Use the highest available balance across depository accounts.
  const accounts: Array<{ type: string; balances: { available: number | null } }> =
    result.accounts ?? [];
  const depository = accounts.filter((a) => a.type === "depository");
  const verifiedBalance = depository.reduce(
    (max, a) => Math.max(max, a.balances.available ?? 0),
    0,
  );

  return { ok: true, balance: verifiedBalance };
}

const VALID_TYPES = ["kyc", "age", "income", "jurisdiction", "funds"];

const TYPE_TITLE: Record<string, string> = {
  kyc: "KYC Complete",
  age: "Age Verified",
  income: "Accredited Investor",
  jurisdiction: "Jurisdiction Eligible",
  funds: "Proof of Funds",
};

function buildClaimLabel(type: string, claimParams?: ClaimParams): string {
  switch (type) {
    case "age":
      return `age ≥ ${claimParams?.threshold_years ?? "18"}`;
    case "income": {
      const t = Number(claimParams?.threshold ?? "200000");
      return `income > $${t.toLocaleString("en-US")}`;
    }
    case "funds": {
      const t = Number(claimParams?.threshold ?? "10000");
      return `balance > $${t.toLocaleString("en-US")}`;
    }
    case "jurisdiction":
      return "country not restricted";
    case "kyc":
    default:
      return "identity verified";
  }
}

interface ClaimParams {
  threshold_years?: string;
  threshold?: string;
  restricted?: string[];
}

interface IssueParams {
  type: string;
  holder: string;
  issuerId: string;
  issuerName: string;
  expiry: string;
  attributes: Record<string, string>;
  claimParams?: ClaimParams;
}

// Build one complete, independent credential for a single type. Each gets its
// own preimage/salt/commitment/signature — they share nothing but the issuer.
async function buildCredential({ type, holder, issuerId, issuerName, expiry, attributes, claimParams }: IssueParams) {
  const value = attributeToValue(type, attributes);
  const salt = randomField();
  const commitment = await poseidonCommit(value, salt);
  const { sig, issuerX, issuerY } = signCommitment(commitment);
  return {
    type,
    title: TYPE_TITLE[type],
    claim: buildClaimLabel(type, claimParams),
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
    ...(claimParams && Object.values(claimParams).some((v) => v !== undefined) ? { claimParams } : {}),
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
    claimParams?: ClaimParams;
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
    claimParams,
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

  // Gate KYC/age/jurisdiction issuance on SmileID identity verification.
  const needsKyc = credentialTypes.some((t) => ["kyc", "age", "jurisdiction"].includes(t));
  if (needsKyc) {
    const kyc = await verifyWithSmileID(attributes);
    if (!kyc.ok) {
      return NextResponse.json(
        { error: "Identity verification failed", smileid: { code: kyc.code, text: kyc.text } },
        { status: 403 },
      );
    }
  }

  // Gate funds issuance on Plaid balance attestation. Plaid is the source of
  // truth — we overwrite any user-supplied balance with the verified figure.
  const needsFunds = credentialTypes.includes("funds");
  if (needsFunds) {
    const plaid = await verifyWithPlaid();
    if (!plaid.ok) {
      return NextResponse.json(
        { error: plaid.error ?? "Balance verification failed" },
        { status: 403 },
      );
    }
    attributes.balance = String(plaid.balance ?? 0);
  }

  try {
    // De-duplicate types so the same claim isn't issued twice in one call.
    const uniqueTypes = Array.from(new Set(credentialTypes));
    const credentials = [];
    for (const type of uniqueTypes) {
      credentials.push(
        await buildCredential({ type, holder, issuerId, issuerName, expiry, attributes, claimParams }),
      );
    }
    return NextResponse.json({ credentials });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

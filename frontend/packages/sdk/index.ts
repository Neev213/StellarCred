// @stellarcred/sdk
//
// A tiny, read-only client for protocols integrating StellarCred. The only
// thing a protocol trusts is the on-chain ProofRegistry — there is no API key,
// no backend, and no personal data handling. `hasClaim` is the primary call:
// "has this wallet proven the claim I require?".
//
// All reads are pure Soroban simulations (no wallet connection, no transaction,
// no fee), so they are safe to call from a server or a browser.

const PROOF_REGISTRY_ID = process.env.NEXT_PUBLIC_PROOF_REGISTRY_ID ?? "";
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";
const BASE_URL = process.env.NEXT_PUBLIC_STELLARCRED_BASE_URL ?? "https://stellarcred.xyz";

// The credential types StellarCred knows about, matching the contract Symbols.
export const CLAIM_TYPES = ["kyc", "age", "income", "jurisdiction"] as const;
export type ClaimType = (typeof CLAIM_TYPES)[number];

export interface Claim {
  type: string;
  verifiedAt: number;
  expiry: number;
}

// @stellar/stellar-sdk is imported dynamically so this module never pulls the
// SDK into SSR bundles or executes it at import time.
type SDK = typeof import("@stellar/stellar-sdk");
let sdkPromise: Promise<SDK> | null = null;
function sdk(): Promise<SDK> {
  if (!sdkPromise) sdkPromise = import("@stellar/stellar-sdk");
  return sdkPromise;
}

// Read ProofRegistry.is_verified(wallet, claimType) via simulation. Returns
// null if the registry isn't configured, the account can't be read, or the
// simulation errors — callers treat null as "no valid claim".
async function readIsVerified(
  wallet: string,
  claimType: string,
): Promise<{ valid: boolean; verifiedAt: number; expiry: number } | null> {
  if (!PROOF_REGISTRY_ID) return null;

  const { rpc, Contract, TransactionBuilder, Address, nativeToScVal, scValToNative, BASE_FEE } =
    await sdk();
  const server = new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith("http://") });

  let account;
  try {
    account = await server.getAccount(wallet);
  } catch {
    // Unfunded / non-existent account can't have a proof anyway.
    return null;
  }

  const contract = new Contract(PROOF_REGISTRY_ID);
  const op = contract.call(
    "is_verified",
    Address.fromString(wallet).toScVal(),
    nativeToScVal(claimType, { type: "symbol" }),
  );
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim) || !sim.result) return null;

  const [valid, verifiedAt, expiry] = scValToNative(sim.result.retval) as [
    boolean,
    bigint | number,
    bigint | number,
  ];
  return { valid, verifiedAt: Number(verifiedAt), expiry: Number(expiry) };
}

/**
 * Returns true if `wallet` has a currently-valid, unexpired proof of `claimType`
 * in the StellarCred ProofRegistry. This is the primary integration call for
 * protocols — one read-only query, no wallet connection required.
 */
export async function hasClaim(wallet: string, claimType: string): Promise<boolean> {
  const r = await readIsVerified(wallet, claimType);
  return !!r && r.valid;
}

/**
 * Returns every active claim a wallet has proven, across all known credential
 * types. Useful for dashboards and protocol UIs.
 */
export async function getClaims(wallet: string): Promise<Claim[]> {
  const results = await Promise.all(
    CLAIM_TYPES.map(async (t) => {
      const r = await readIsVerified(wallet, t);
      return r && r.valid ? { type: t, verifiedAt: r.verifiedAt, expiry: r.expiry } : null;
    }),
  );
  return results.filter((x): x is NonNullable<typeof x> => x !== null);
}

/**
 * Build a StellarCred verification URL a protocol can redirect users to. After
 * the user verifies, StellarCred sends them back to `returnUrl` with
 * `sc_verified=true` and `sc_wallet=<address>` appended.
 */
export function buildVerifyUrl(options: {
  returnUrl: string;
  claim: string;
  baseUrl?: string;
}): string {
  const base = options.baseUrl ?? BASE_URL;
  const url = new URL("/verify", base);
  url.searchParams.set("return_url", options.returnUrl);
  url.searchParams.set("claim", options.claim);
  return url.toString();
}

// Namespace object so protocols can write `StellarCred.hasClaim(...)`.
export const StellarCred = { hasClaim, getClaims, buildVerifyUrl };
export default StellarCred;

"use client";

// Real Soroban contract calls against the deployed StellarCred contracts.
//  - submitProof: builds, signs (via wallet), and submits a ProofRegistry
//    submit_proof transaction carrying a real UltraHonk proof.
//  - isVerified: read-only simulation of ProofRegistry.is_verified.
//
// @stellar/stellar-sdk is imported dynamically so it never runs during SSR.

import { Buffer } from "buffer";
import { RPC_URL, NETWORK_PASSPHRASE, CONTRACTS } from "./stellar";
import { signTx } from "./wallet";

type SDK = typeof import("@stellar/stellar-sdk");

let sdkPromise: Promise<SDK> | null = null;
function sdk(): Promise<SDK> {
  if (!sdkPromise) sdkPromise = import("@stellar/stellar-sdk");
  return sdkPromise;
}

let server: InstanceType<SDK["rpc"]["Server"]> | null = null;
async function getServer() {
  if (!server) {
    const { rpc } = await sdk();
    server = new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith("http://") });
  }
  return server;
}

export interface VerificationStatus {
  valid: boolean;
  verifiedAt: number;
  expiry: number;
}

/**
 * Submit a proof to the ProofRegistry. Returns the confirmed transaction hash.
 * Throws with a clear message if contracts aren't configured or the tx fails.
 */
export async function submitProof(params: {
  holder: string;
  issuerId: string;
  credentialType: string;
  proof: Uint8Array;
  publicInputs: Uint8Array;
  /** Validity window in seconds from now. */
  ttlSecs: number;
}): Promise<string> {
  const { holder, issuerId, credentialType, proof, publicInputs, ttlSecs } = params;
  if (!CONTRACTS.proofRegistry) {
    throw new Error(
      "ProofRegistry contract id not set. Deploy the contracts and fill NEXT_PUBLIC_PROOF_REGISTRY_ID.",
    );
  }

  const { Contract, TransactionBuilder, Address, nativeToScVal, xdr, BASE_FEE } =
    await sdk();
  const srv = await getServer();

  const account = await srv.getAccount(holder);
  const contract = new Contract(CONTRACTS.proofRegistry);
  const expiry = Math.floor(Date.now() / 1000) + ttlSecs;

  const op = contract.call(
    "submit_proof",
    Address.fromString(holder).toScVal(),
    Address.fromString(issuerId).toScVal(),
    nativeToScVal(credentialType, { type: "symbol" }),
    xdr.ScVal.scvBytes(Buffer.from(proof)),
    xdr.ScVal.scvBytes(Buffer.from(publicInputs)),
    nativeToScVal(BigInt(expiry), { type: "u64" }),
  );

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(60)
    .build();

  // Simulate + assemble Soroban resources/fees, then sign with the wallet.
  const prepared = await srv.prepareTransaction(tx);
  const signedXdr = await signTx(prepared.toXDR(), holder);
  const sent = await srv.sendTransaction(
    TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE),
  );

  if (sent.status === "ERROR") {
    // errorResult is an XDR object — JSON.stringify corrupts it; use hex.
    const errHex =
      sent.errorResult &&
      typeof (sent.errorResult as { toXDR?: (f: string) => string }).toXDR === "function"
        ? (sent.errorResult as { toXDR: (f: string) => string }).toXDR("hex")
        : String(sent.errorResult);
    throw new Error(`Submission rejected: ${errHex}`);
  }

  // Poll for confirmation. If the Stellar SDK's XDR parser hits an unknown
  // union discriminant (e.g. TransactionMetaV4 on Protocol 22+ nodes while
  // running stellar-sdk built for Protocol 21), it throws "Bad union switch: N".
  // The TX still landed — NOT_FOUND would have been returned instead. Treat it
  // as success and let isVerified() confirm via the contract's persistent store.
  function isBadUnionSwitch(e: unknown): boolean {
    return e instanceof Error && e.message.startsWith("Bad union switch");
  }

  const start = Date.now();
  let result;
  try {
    result = await srv.getTransaction(sent.hash);
  } catch (e) {
    if (isBadUnionSwitch(e)) return sent.hash;
    throw e;
  }
  while (result.status === "NOT_FOUND" && Date.now() - start < 30_000) {
    await new Promise((r) => setTimeout(r, 1500));
    try {
      result = await srv.getTransaction(sent.hash);
    } catch (e) {
      if (isBadUnionSwitch(e)) return sent.hash;
      throw e;
    }
  }
  if (result.status !== "SUCCESS") {
    throw new Error(`Transaction ${sent.hash} did not succeed (${result.status}).`);
  }
  return sent.hash;
}

/** Read-only check of whether `holder` has a currently-valid proof of `type`. */
export async function isVerified(
  holder: string,
  credentialType: string,
): Promise<VerificationStatus> {
  const empty: VerificationStatus = { valid: false, verifiedAt: 0, expiry: 0 };
  if (!CONTRACTS.proofRegistry) return empty;

  const { rpc, Contract, TransactionBuilder, Address, nativeToScVal, scValToNative, BASE_FEE } =
    await sdk();
  const srv = await getServer();

  const account = await srv.getAccount(holder);
  const contract = new Contract(CONTRACTS.proofRegistry);
  const op = contract.call(
    "is_verified",
    Address.fromString(holder).toScVal(),
    nativeToScVal(credentialType, { type: "symbol" }),
  );
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(30)
    .build();

  const sim = await srv.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim) || !sim.result) return empty;

  const [valid, verifiedAt, expiry] = scValToNative(sim.result.retval) as [
    boolean,
    bigint | number,
    bigint | number,
  ];
  return { valid, verifiedAt: Number(verifiedAt), expiry: Number(expiry) };
}

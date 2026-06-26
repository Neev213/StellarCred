// Client-side zero-knowledge proof generation.
//
// Loads a compiled Noir circuit (ACIR JSON), executes the witness from the
// holder's private credential, and produces an UltraHonk proof with the keccak
// oracle hash (matching the on-chain verifier and the `bb` CLI build flags).
// Private inputs never leave this function — only the proof + public inputs are
// returned, ready to submit to the ProofRegistry contract.
//
// Toolchain must match the contracts: Noir 1.0.0-beta.9 / bb 0.87.0.

import type { InputMap } from "@noir-lang/noir_js";
import type { CredentialType } from "./stellar";

// bb.js and noir_js are browser-only (WASM + workers) and crash if evaluated
// during SSR, so they're imported dynamically inside generateProof().

export interface GeneratedProof {
  /** Raw proof bytes (456 fields × 32 = 14592 bytes), as the contract expects. */
  proof: Uint8Array;
  /** Public inputs serialized as concatenated 32-byte big-endian field elements. */
  publicInputs: Uint8Array;
}

interface CompiledCircuit {
  bytecode: string;
  abi: unknown;
}

// Compiled circuits are emitted to /public/circuits/<type>.json by
// `circuits/scripts/build.sh` (see repo README).
async function loadCircuit(type: CredentialType): Promise<CompiledCircuit> {
  const res = await fetch(`/circuits/${type}.json`);
  if (!res.ok) {
    throw new Error(
      `Compiled circuit "${type}" not found. Run the circuit build to emit /public/circuits/${type}.json.`,
    );
  }
  return res.json();
}

// bb.js returns public inputs as an array of 0x-prefixed field hex strings. The
// contract expects them concatenated as 32-byte big-endian values.
function fieldsToBytes(fields: string[]): Uint8Array {
  const out = new Uint8Array(fields.length * 32);
  fields.forEach((f, i) => {
    const hex = f.replace(/^0x/, "").padStart(64, "0");
    for (let j = 0; j < 32; j++) {
      out[i * 32 + j] = parseInt(hex.slice(j * 2, j * 2 + 2), 16);
    }
  });
  return out;
}

// Maps a credential to the circuit's named inputs. Every credential carries
// { value, salt, commitment }; each circuit adds public claim parameters the
// verifying protocol supplies (threshold, restricted list, current date).
const RESTRICTED = ["840", "364", "408", "0", "0", "0", "0", "0"]; // US, IR, KP

function buildInputs(
  type: CredentialType,
  credential: Record<string, unknown>,
): InputMap {
  const value = String(credential.value);
  const salt = String(credential.salt);
  const commitment = String(credential.commitment);
  // Issuer signature inputs, common to every circuit.
  const sigInputs = {
    sig: credential.sig as number[],
    issuer_x: credential.issuerPubX as number[],
    issuer_y: credential.issuerPubY as number[],
  };
  switch (type) {
    case "age":
      return {
        date_of_birth: value,
        salt,
        ...sigInputs,
        commitment,
        current_date: String(Math.floor(Date.now() / 86_400_000)),
        threshold_years: "18",
      };
    case "income":
      return { income: value, salt, ...sigInputs, commitment, threshold: "200000" };
    case "jurisdiction":
      return { country_code: value, salt, ...sigInputs, commitment, restricted: RESTRICTED };
    case "kyc":
    default:
      return { secret: value, salt, ...sigInputs, commitment };
  }
}

export async function generateProof(
  type: CredentialType,
  credential: Record<string, unknown>,
): Promise<GeneratedProof> {
  const circuit = await loadCircuit(type);
  const { Noir } = await import("@noir-lang/noir_js");
  const { UltraHonkBackend } = await import("@aztec/bb.js");

  // 1. Execute the circuit to produce the witness (private inputs stay local).
  const noir = new Noir(circuit as never);
  const { witness } = await noir.execute(buildInputs(type, credential));

  // 2. Generate the UltraHonk proof. `keccak` matches the verifier's transcript.
  //    Multithreading needs cross-origin isolation (COOP/COEP headers, set in
  //    next.config.mjs); falls back to single-threaded if unavailable.
  const threads =
    typeof navigator !== "undefined" && crossOriginIsolated
      ? navigator.hardwareConcurrency || 4
      : 1;
  const backend = new UltraHonkBackend(circuit.bytecode, { threads });
  try {
    const { proof, publicInputs } = await backend.generateProof(witness, {
      keccak: true,
    });
    return { proof, publicInputs: fieldsToBytes(publicInputs) };
  } finally {
    await backend.destroy();
  }
}

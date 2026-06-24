// Client-side proof generation (STUB).
//
// In the real flow this loads the compiled Noir circuit (ACIR JSON from
// circuits/<name>/target) and the bb WASM backend, executes the witness from
// the holder's private credential, and returns an UltraHonk proof plus its
// public inputs. The private inputs never leave this function.
//
// Wiring target (next step):
//   import { Noir } from "@noir-lang/noir_js";
//   import { UltraHonkBackend } from "@aztec/bb.js";
//   const noir = new Noir(circuitJson);
//   const { witness } = await noir.execute(inputs);
//   const backend = new UltraHonkBackend(circuitJson.bytecode);
//   const { proof, publicInputs } = await backend.generateProof(witness);

import type { CredentialType } from "./stellar";

export interface GeneratedProof {
  proof: Uint8Array;
  publicInputs: Uint8Array;
}

export async function generateProof(
  _type: CredentialType,
  _credential: Record<string, unknown>,
): Promise<GeneratedProof> {
  throw new Error(
    "generateProof not yet wired — see lib/proof.ts. Integrate @noir-lang/noir_js + @aztec/bb.js against the compiled circuit in circuits/<type>/target.",
  );
}

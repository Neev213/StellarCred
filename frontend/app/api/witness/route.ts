import { NextRequest, NextResponse } from "next/server";
import type { InputMap } from "@noir-lang/noir_js";
import ageCircuit from "../../../public/circuits/age.json";
import incomeCircuit from "../../../public/circuits/income.json";
import jurisdictionCircuit from "../../../public/circuits/jurisdiction.json";
import kycCircuit from "../../../public/circuits/kyc.json";

// Same restricted-country list used client-side.
const RESTRICTED = ["840", "364", "408", "0", "0", "0", "0", "0"];

function buildInputs(type: string, cred: Record<string, unknown>): InputMap {
  const value = String(cred.value);
  const salt = String(cred.salt);
  const commitment = String(cred.commitment);
  const sigInputs = {
    sig: cred.sig as number[],
    issuer_x: cred.issuerPubX as number[],
    issuer_y: cred.issuerPubY as number[],
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

function circuitFor(type: string) {
  switch (type) {
    case "age": return ageCircuit;
    case "income": return incomeCircuit;
    case "jurisdiction": return jurisdictionCircuit;
    case "kyc":
    default: return kycCircuit;
  }
}

export async function POST(req: NextRequest) {
  let body: { type?: string; credential?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, credential } = body;
  if (!type || !credential) {
    return NextResponse.json({ error: "type and credential are required" }, { status: 400 });
  }

  try {
    const { Noir } = await import("@noir-lang/noir_js");
    const circuit = circuitFor(type);
    const noir = new Noir(circuit as never);
    const inputs = buildInputs(type, credential);
    const { witness } = await noir.execute(inputs);
    // Serialize Uint8Array → hex string for JSON transport.
    const hex = Buffer.from(witness).toString("hex");
    return NextResponse.json({ witness: hex });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

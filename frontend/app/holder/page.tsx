"use client";

import { useState } from "react";
import { connect } from "@/lib/wallet";
import { generateProof } from "@/lib/proof";
import { CREDENTIAL_TYPES, type CredentialType } from "@/lib/stellar";

// Holder Dashboard
//  - import credential JSON
//  - generate a proof per credential type (locally, in WASM)
//  - submit proof to ProofRegistry
//  - view active proofs + expiry

export default function HolderPage() {
  const [address, setAddress] = useState("");
  const [credentialJson, setCredentialJson] = useState("");
  const [status, setStatus] = useState<string>("");

  async function onConnect() {
    setAddress(await connect());
  }

  async function onProve(type: CredentialType) {
    setStatus(`Generating ${type} proof…`);
    try {
      const credential = JSON.parse(credentialJson || "{}");
      const { proof } = await generateProof(type, credential);
      setStatus(`Proof generated (${proof.length} bytes). TODO: submit to registry.`);
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`);
    }
  }

  return (
    <>
      <h1>Holder Dashboard</h1>
      <button onClick={onConnect}>
        {address ? `Connected: ${address.slice(0, 6)}…` : "Connect wallet"}
      </button>

      <div className="panel" style={{ marginTop: "1.5rem" }}>
        <h2>Import credential</h2>
        <textarea
          rows={8}
          placeholder='{"type":"kyc","holder":"G...","country":"NG",...}'
          value={credentialJson}
          onChange={(e) => setCredentialJson(e.target.value)}
        />
      </div>

      <div className="panel">
        <h2>Generate proof</h2>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {CREDENTIAL_TYPES.map((t) => (
            <button key={t} onClick={() => onProve(t)} disabled={!credentialJson}>
              Prove {t}
            </button>
          ))}
        </div>
        {status && <p className="muted" style={{ marginTop: "1rem" }}>{status}</p>}
      </div>
    </>
  );
}

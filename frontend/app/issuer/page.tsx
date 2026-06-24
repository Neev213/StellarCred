"use client";

import { useState } from "react";
import { connect } from "@/lib/wallet";

// Issuer Panel (admin)
//  - register as issuer on IssuerRegistry
//  - issue + sign credential JSON to a holder address
// Contract calls are stubbed; wire them via @stellar/stellar-sdk + the kit.

export default function IssuerPage() {
  const [address, setAddress] = useState<string>("");
  const [holder, setHolder] = useState("");
  const [credentialType, setCredentialType] = useState("kyc");
  const [output, setOutput] = useState("");

  async function onConnect() {
    setAddress(await connect());
  }

  function onIssue() {
    // STUB: in the real flow the issuer signs this payload with its
    // credential-signing key and the holder stores the result locally.
    const credential = {
      holder,
      type: credentialType,
      issuer: address,
      issued_at: Math.floor(Date.now() / 1000),
      // attribute fields depend on type, e.g. { date_of_birth, country, income }
    };
    setOutput(JSON.stringify(credential, null, 2));
  }

  return (
    <>
      <h1>Issuer Panel</h1>
      <button onClick={onConnect}>
        {address ? `Connected: ${address.slice(0, 6)}…` : "Connect wallet"}
      </button>

      <div className="panel" style={{ marginTop: "1.5rem" }}>
        <h2>Issue a credential</h2>
        <label>Holder address</label>
        <input
          value={holder}
          onChange={(e) => setHolder(e.target.value)}
          placeholder="G..."
        />
        <label style={{ display: "block", marginTop: "1rem" }}>
          Credential type
        </label>
        <input
          value={credentialType}
          onChange={(e) => setCredentialType(e.target.value)}
        />
        <div style={{ marginTop: "1rem" }}>
          <button onClick={onIssue} disabled={!holder}>
            Sign &amp; export credential
          </button>
        </div>
        {output && (
          <textarea readOnly rows={10} value={output} style={{ marginTop: "1rem" }} />
        )}
      </div>
    </>
  );
}

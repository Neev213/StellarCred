"use client";

import { useState } from "react";
import { connect } from "@/lib/wallet";

// Verifier Demo (GatedPool)
//  - shows "Access Denied" when no valid KYC proof exists for the address
//  - shows "Access Granted" once a proof is in the registry
//  - deposit form gated on that check
// Reads ProofRegistry.is_verified and calls GatedPool.deposit (stubbed here).

export default function VerifierPage() {
  const [address, setAddress] = useState("");
  const [verified, setVerified] = useState<boolean | null>(null);
  const [amount, setAmount] = useState("100");

  async function onConnect() {
    const addr = await connect();
    setAddress(addr);
    // STUB: query ProofRegistry.is_verified(addr, "kyc").
    setVerified(false);
  }

  return (
    <>
      <h1>Verifier Demo &mdash; Gated Pool</h1>
      <button onClick={onConnect}>
        {address ? `Connected: ${address.slice(0, 6)}…` : "Connect wallet"}
      </button>

      {address && (
        <div className="panel" style={{ marginTop: "1.5rem" }}>
          <h2>
            KYC status:{" "}
            {verified ? (
              <span className="badge-good">Access Granted</span>
            ) : (
              <span className="badge-bad">Access Denied</span>
            )}
          </h2>
          <p className="muted">
            {verified
              ? "A valid KYC proof exists in the registry for this address."
              : "No valid KYC proof found. Generate one on the Holder dashboard, then submit it."}
          </p>

          <label>Deposit amount</label>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div style={{ marginTop: "1rem" }}>
            <button disabled={!verified}>Deposit</button>
          </div>
        </div>
      )}
    </>
  );
}

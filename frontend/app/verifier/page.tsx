"use client";

import { useState } from "react";
import { IconLock, IconCheck, IconCircle } from "@tabler/icons-react";
import { WalletButton } from "@/components/WalletButton";
import { Badge } from "@/components/Badge";
import { ConfigBanner } from "@/components/ConfigBanner";
import { isVerified } from "@/lib/contracts";

interface Requirement {
  label: string;
  proved: boolean;
}

export default function VerifierPage() {
  const [reqs, setReqs] = useState<Requirement[]>([
    { label: "KYC verified", proved: true },
    { label: "Age ≥ 18", proved: true },
    { label: "Accredited investor", proved: false },
  ]);
  const [amount, setAmount] = useState("5,000");
  const eligible = reqs.every((r) => r.proved);

  // When a wallet connects, reflect the real on-chain KYC status if the
  // contracts are deployed; otherwise the demo defaults stand.
  async function onConnected(address: string) {
    try {
      const status = await isVerified(address, "kyc");
      setReqs((rs) =>
        rs.map((r) =>
          r.label === "KYC verified" ? { ...r, proved: status.valid } : r,
        ),
      );
    } catch {
      // contracts not deployed / account unfunded — keep demo defaults
    }
  }

  return (
    <>
      <div className="between" style={{ marginBottom: "2.5rem" }}>
        <div>
          <span className="eyebrow">Gated protocol · demo</span>
          <h1 style={{ fontSize: "2rem", marginTop: "0.35rem" }}>PrivPool</h1>
        </div>
        <WalletButton onConnected={onConnected} />
      </div>

      <ConfigBanner />

      <div className="grid grid-2" style={{ alignItems: "start", gap: "1.5rem" }}>
        <div className="card">
          <span className="eyebrow">Total value locked</span>
          <div style={{ margin: "0.5rem 0 0.25rem", fontSize: "2.25rem", fontWeight: 600, letterSpacing: "-0.03em" }}>
            $124,800
          </div>
          <span className="mono faint">USDC · stellar:testnet</span>

          <hr className="divider" />

          <span className="eyebrow">Eligibility</span>
          <div className="stack" style={{ marginTop: "0.5rem" }}>
            {reqs.map((r) => (
              <div className="line" key={r.label}>
                <span className="row" style={{ gap: "0.6rem" }}>
                  {r.proved ? (
                    <IconCheck size={16} color="var(--accent)" stroke={2.5} />
                  ) : (
                    <IconCircle size={16} color="var(--faint)" />
                  )}
                  <span style={{ color: r.proved ? "var(--text)" : "var(--muted)" }}>
                    {r.label}
                  </span>
                </span>
                {r.proved ? (
                  <Badge variant="verified">Proved</Badge>
                ) : (
                  <Badge variant="pending">Needed</Badge>
                )}
              </div>
            ))}
          </div>

          {!eligible && (
            <button
              className="btn btn-secondary"
              style={{ marginTop: "1.25rem", width: "100%" }}
              onClick={() => setReqs((rs) => rs.map((r) => ({ ...r, proved: true })))}
            >
              Prove remaining eligibility
            </button>
          )}
        </div>

        <div
          className="card"
          style={{
            borderColor: eligible ? "rgba(62,207,142,0.4)" : "var(--border)",
            transition: "border-color 0.5s var(--ease)",
          }}
        >
          <div className="between" style={{ marginBottom: "1.5rem" }}>
            <span className="eyebrow">Deposit</span>
            {eligible ? (
              <Badge variant="verified">Access granted</Badge>
            ) : (
              <Badge variant="denied">Access denied</Badge>
            )}
          </div>

          <label className="field-label">Amount (USDC)</label>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} />

          <button
            className="btn btn-primary"
            style={{
              marginTop: "1.25rem",
              width: "100%",
              opacity: eligible ? 1 : 0.45,
              transition: "opacity 0.5s var(--ease)",
            }}
            disabled={!eligible}
          >
            {eligible ? (
              "Deposit"
            ) : (
              <>
                <IconLock size={15} />
                Prove eligibility to deposit
              </>
            )}
          </button>

          <p className="faint" style={{ marginTop: "1.25rem", fontSize: "0.8125rem", lineHeight: 1.6 }}>
            {eligible
              ? "PrivPool read ProofRegistry.is_verified and found valid proofs for your address. No personal data was shared."
              : "PrivPool only reads ProofRegistry.is_verified for your address — it never sees the credential data behind your proofs."}
          </p>
        </div>
      </div>
    </>
  );
}

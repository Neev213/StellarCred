"use client";

import { useEffect, useState } from "react";
import { IconLock, IconCheck, IconCircle } from "@tabler/icons-react";
import { WalletButton } from "@/components/WalletButton";
import { useWallet } from "@/lib/wallet-context";
import { Badge } from "@/components/Badge";
import { ConfigBanner } from "@/components/ConfigBanner";
import { isVerified } from "@/lib/contracts";

interface Requirement {
  label: string;
  type: string;
  proved: boolean;
}

const REQ_TYPES = ["kyc", "age", "income"] as const;

export default function VerifierPage() {
  const { address } = useWallet();
  // PrivPool gates deposits on three credential proofs, read live from the
  // ProofRegistry once a wallet connects.
  const [reqs, setReqs] = useState<Requirement[]>([
    { label: "KYC verified", type: "kyc", proved: false },
    { label: "Age ≥ 18", type: "age", proved: false },
    { label: "Accredited investor", type: "income", proved: false },
  ]);
  const [amount, setAmount] = useState("5,000");
  const [checked, setChecked] = useState(false);
  const eligible = reqs.every((r) => r.proved);

  // Reflect real on-chain status for each requirement whenever the connected
  // wallet changes (including restored-on-reload connections).
  useEffect(() => {
    if (!address) {
      setChecked(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const statuses = await Promise.all(
          REQ_TYPES.map((t) => isVerified(address, t)),
        );
        if (!cancelled) {
          setReqs((rs) => rs.map((r, i) => ({ ...r, proved: statuses[i].valid })));
        }
      } catch {
        // contracts not deployed / account unfunded — requirements stay unmet
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  return (
    <>
      <div className="between" style={{ marginBottom: "2.5rem" }}>
        <div>
          <span className="eyebrow">Gated protocol · demo</span>
          <h1 style={{ fontSize: "2rem", marginTop: "0.35rem" }}>PrivPool</h1>
        </div>
        <WalletButton />
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

          {checked && !eligible && (
            <p className="faint" style={{ marginTop: "1.25rem", fontSize: "0.8125rem" }}>
              Missing proofs? Generate and submit them on the Holder page, then
              reconnect here.
            </p>
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

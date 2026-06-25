"use client";

import { IconInfoCircle } from "@tabler/icons-react";
import { CONTRACTS } from "@/lib/stellar";

// Shown when the contract ids aren't set: proofs still generate locally, but
// on-chain submission/reads won't work until contracts are deployed.
export function ConfigBanner() {
  if (CONTRACTS.proofRegistry) return null;
  return (
    <div
      className="row"
      style={{
        gap: "0.6rem",
        padding: "0.7rem 1rem",
        marginBottom: "1.5rem",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border-strong)",
        background: "var(--bg-soft)",
        fontSize: "0.8125rem",
      }}
    >
      <IconInfoCircle size={16} className="muted" />
      <span className="muted">
        Contracts not configured. Proofs generate locally, but submission needs a
        testnet deploy — run <span className="mono">./scripts/deploy.sh</span> and
        set the ids in <span className="mono">frontend/.env.local</span>.
      </span>
    </div>
  );
}

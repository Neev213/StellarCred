"use client";

import { useEffect, useState } from "react";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconExternalLink,
  IconPlus,
} from "@tabler/icons-react";
import { WalletButton } from "@/components/WalletButton";
import { Badge } from "@/components/Badge";
import { Check } from "@/components/Check";
import { truncateHash } from "@/lib/format";
import { EXPLORER_TX } from "@/lib/stellar";

interface Cred {
  id: string;
  title: string;
  claim: string;
  issuer: string;
  status: "active" | "pending";
}

const CREDENTIALS: Cred[] = [
  { id: "kyc", title: "KYC Complete", claim: "identity verified", issuer: "StellarCred Authority", status: "active" },
  { id: "age", title: "Age Verified", claim: "age ≥ 18", issuer: "StellarCred Authority", status: "active" },
  { id: "income", title: "Accredited Investor", claim: "income > $200k", issuer: "Employer Inc.", status: "pending" },
];

export default function HolderPage() {
  const [proving, setProving] = useState<Cred | null>(null);

  return (
    <>
      <div className="between" style={{ marginBottom: "2.5rem" }}>
        <div>
          <span className="eyebrow">Holder</span>
          <h1 style={{ fontSize: "2rem", marginTop: "0.35rem" }}>
            Your credentials
          </h1>
        </div>
        <WalletButton />
      </div>

      {proving ? (
        <ProofFlow cred={proving} onBack={() => setProving(null)} />
      ) : (
        <div className="stack reveal" style={{ gap: "0.75rem" }}>
          {CREDENTIALS.map((c) => (
            <div className="card between" key={c.id} style={{ padding: "1.25rem 1.5rem" }}>
              <div>
                <div className="row" style={{ gap: "0.6rem" }}>
                  <span style={{ fontWeight: 500 }}>{c.title}</span>
                  <span className="mono faint">{c.claim}</span>
                </div>
                <div className="faint" style={{ fontSize: "0.8125rem", marginTop: "0.2rem" }}>
                  Issued by {c.issuer}
                </div>
              </div>
              <div className="row">
                {c.status === "active" ? (
                  <Badge variant="verified">Active</Badge>
                ) : (
                  <Badge variant="pending">Pending</Badge>
                )}
                <button
                  className="btn btn-primary btn-sm"
                  disabled={c.status !== "active"}
                  onClick={() => setProving(c)}
                >
                  Generate proof
                  <IconArrowRight size={14} />
                </button>
              </div>
            </div>
          ))}

          <button
            className="btn btn-ghost"
            style={{ alignSelf: "flex-start", marginTop: "0.5rem" }}
          >
            <IconPlus size={15} />
            Import credential
          </button>
        </div>
      )}
    </>
  );
}

type Stage = "generating" | "generated" | "submitting" | "confirmed";

function ProofFlow({ cred, onBack }: { cred: Cred; onBack: () => void }) {
  const [stage, setStage] = useState<Stage>("generating");
  const proofHash = "0x4a3f8b2c91e07d2204a1f6b3c8e5d9e1";
  const txHash = "5K8MdQ2pX9vR4tL7nB3wXP2N";

  // Simulated timing for the demo. Real flow: generateProof() in lib/proof.ts
  // (Noir + bb in WASM), then submit_proof() to ProofRegistry, await tx.
  useEffect(() => {
    if (stage === "generating") {
      const t = setTimeout(() => setStage("generated"), 2200);
      return () => clearTimeout(t);
    }
    if (stage === "submitting") {
      const t = setTimeout(() => setStage("confirmed"), 1600);
      return () => clearTimeout(t);
    }
  }, [stage]);

  const done = (s: Stage[]) => s.includes(stage);

  return (
    <div className="reveal" style={{ maxWidth: 540, margin: "0 auto" }}>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: "1.5rem" }}>
        <IconArrowLeft size={15} />
        All credentials
      </button>

      <div className="card">
        <span className="eyebrow">Proving</span>
        <h2 style={{ margin: "0.4rem 0 0.3rem" }}>{cred.title}</h2>
        <div className="mono faint">{cred.claim}</div>

        <hr className="divider" />

        <div className="stack" style={{ gap: "1.25rem" }}>
          <Step
            active={stage === "generating"}
            done={done(["generated", "submitting", "confirmed"])}
            title="Generate proof"
            detail={
              stage === "generating"
                ? "Noir circuit running locally — private inputs stay on this device"
                : `Proof ${truncateHash(proofHash)}`
            }
          />
          <Step
            active={stage === "submitting"}
            done={stage === "confirmed"}
            title="Submit to Stellar"
            detail={
              stage === "confirmed" ? (
                <a
                  className="row accent"
                  href={EXPLORER_TX(txHash)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ gap: "0.3rem", fontSize: "0.8125rem" }}
                >
                  {txHash.slice(0, 5)}…{txHash.slice(-4)}
                  <IconExternalLink size={13} />
                </a>
              ) : stage === "submitting" ? (
                "Writing verification to ProofRegistry…"
              ) : (
                "Cache the verification on-chain"
              )
            }
          />
          <Step
            active={false}
            done={stage === "confirmed"}
            title="Verified on-chain"
            detail="Any protocol can now check your proof for 30 days"
          />
        </div>

        {stage === "generated" && (
          <button
            className="btn btn-primary"
            style={{ marginTop: "1.5rem", width: "100%" }}
            onClick={() => setStage("submitting")}
          >
            Submit to Stellar
            <IconArrowRight size={15} />
          </button>
        )}

        {stage === "confirmed" && (
          <div
            className="reveal"
            style={{
              marginTop: "1.5rem",
              padding: "1.5rem",
              borderRadius: "var(--radius)",
              background: "var(--accent-soft)",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <Check size={44} run />
            <div>
              <div style={{ fontWeight: 500 }}>Proof verified</div>
              <div className="muted" style={{ fontSize: "0.85rem" }}>
                Your claim is now provable on Stellar — without revealing the data behind it.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Step({
  active,
  done,
  title,
  detail,
}: {
  active: boolean;
  done: boolean;
  title: string;
  detail: React.ReactNode;
}) {
  return (
    <div className="row" style={{ alignItems: "flex-start", gap: "0.85rem" }}>
      <span
        style={{
          marginTop: 2,
          width: 22,
          height: 22,
          borderRadius: "50%",
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          border: `1px solid ${done ? "var(--accent)" : "var(--border-strong)"}`,
          background: done ? "var(--accent)" : "transparent",
          color: "var(--bg)",
          transition: "all 0.3s var(--ease)",
        }}
      >
        {done && <IconCheck size={13} stroke={3} />}
        {active && !done && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--accent)",
            }}
          />
        )}
      </span>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontWeight: 500,
            color: active || done ? "var(--text)" : "var(--muted)",
          }}
        >
          {title}
        </div>
        <div className="muted" style={{ fontSize: "0.8125rem", marginTop: "0.15rem" }}>
          {detail}
        </div>
        {active && (
          <div className="bar" style={{ marginTop: "0.6rem", maxWidth: 200 }}>
            <i />
          </div>
        )}
      </div>
    </div>
  );
}

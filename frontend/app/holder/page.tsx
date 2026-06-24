"use client";

import { useEffect, useState } from "react";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconExternalLink,
  IconPlus,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { WalletButton } from "@/components/WalletButton";
import { Badge } from "@/components/Badge";
import { Check } from "@/components/Check";
import { truncateHash } from "@/lib/format";
import { EXPLORER_TX, type CredentialType } from "@/lib/stellar";
import { generateProof } from "@/lib/proof";
import { submitProof } from "@/lib/contracts";

interface Cred {
  id: CredentialType;
  title: string;
  claim: string;
  issuer: string;
  status: "active" | "pending";
  // Private credential inputs the holder stores locally; fed to the circuit.
  inputs: Record<string, unknown>;
}

const CREDENTIALS: Cred[] = [
  {
    id: "kyc",
    title: "KYC Complete",
    claim: "identity verified",
    issuer: "StellarCred Authority",
    status: "active",
    inputs: {
      preimage: "42",
      commitment:
        "0x255ee8299be9389b21052fd317f8cae762f9c89f756ac79262fb648a70ee7a08",
    },
  },
  {
    id: "age",
    title: "Age Verified",
    claim: "age ≥ 18",
    issuer: "StellarCred Authority",
    status: "pending",
    inputs: {},
  },
  {
    id: "income",
    title: "Accredited Investor",
    claim: "income > $200k",
    issuer: "Employer Inc.",
    status: "pending",
    inputs: {},
  },
];

export default function HolderPage() {
  const [address, setAddress] = useState("");
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
        <WalletButton onConnected={setAddress} />
      </div>

      {proving ? (
        <ProofFlow
          cred={proving}
          holder={address}
          onBack={() => setProving(null)}
        />
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
                  disabled={c.status !== "active" || !address}
                  title={!address ? "Connect a wallet first" : undefined}
                  onClick={() => setProving(c)}
                >
                  Generate proof
                  <IconArrowRight size={14} />
                </button>
              </div>
            </div>
          ))}

          {!address && (
            <p className="faint" style={{ fontSize: "0.8125rem", marginTop: "0.25rem" }}>
              Connect a wallet to generate and submit proofs.
            </p>
          )}

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

type Stage = "generating" | "generated" | "submitting" | "confirmed" | "error";

function ProofFlow({
  cred,
  holder,
  onBack,
}: {
  cred: Cred;
  holder: string;
  onBack: () => void;
}) {
  const [stage, setStage] = useState<Stage>("generating");
  const [proof, setProof] = useState<{ proof: Uint8Array; publicInputs: Uint8Array } | null>(null);
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");

  // 1. Generate the proof locally as soon as the flow opens.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await generateProof(cred.id, cred.inputs);
        if (!cancelled) {
          setProof(result);
          setStage("generated");
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setStage("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cred]);

  // 2. Submit to the ProofRegistry on user action.
  async function onSubmit() {
    if (!proof) return;
    setStage("submitting");
    try {
      const hash = await submitProof({
        holder,
        credentialType: cred.id,
        proof: proof.proof,
        publicInputs: proof.publicInputs,
        ttlSecs: 30 * 86_400,
      });
      setTxHash(hash);
      setStage("confirmed");
    } catch (e) {
      setError((e as Error).message);
      setStage("error");
    }
  }

  const proofReady = stage === "generated" || stage === "submitting" || stage === "confirmed";

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
            done={proofReady}
            title="Generate proof"
            detail={
              stage === "generating"
                ? "Noir circuit running locally — private inputs stay on this device"
                : proof
                  ? `Proof ${truncateHash("0x" + toHex(proof.proof).slice(0, 14))}`
                  : "—"
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
                  {txHash.slice(0, 6)}…{txHash.slice(-4)}
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
          <button className="btn btn-primary" style={{ marginTop: "1.5rem", width: "100%" }} onClick={onSubmit}>
            Submit to Stellar
            <IconArrowRight size={15} />
          </button>
        )}

        {stage === "error" && (
          <div
            style={{
              marginTop: "1.5rem",
              padding: "1rem 1.25rem",
              borderRadius: "var(--radius)",
              border: "1px solid rgba(240,96,77,0.35)",
              background: "rgba(240,96,77,0.08)",
            }}
          >
            <div className="row" style={{ gap: "0.5rem", color: "var(--danger)", fontWeight: 500 }}>
              <IconAlertTriangle size={16} />
              Could not complete
            </div>
            <div className="muted" style={{ fontSize: "0.8125rem", marginTop: "0.4rem" }}>
              {error}
            </div>
          </div>
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

function toHex(u8: Uint8Array): string {
  return Array.from(u8.slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
        )}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500, color: active || done ? "var(--text)" : "var(--muted)" }}>
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

"use client";

import { useEffect, useState } from "react";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconExternalLink,
  IconPlus,
  IconAlertTriangle,
  IconTrash,
  IconCertificate,
} from "@tabler/icons-react";
import { WalletButton } from "@/components/WalletButton";
import { Badge } from "@/components/Badge";
import { Check } from "@/components/Check";
import { ConfigBanner } from "@/components/ConfigBanner";
import { truncateHash } from "@/lib/format";
import { EXPLORER_TX } from "@/lib/stellar";
import { generateProof } from "@/lib/proof";
import { submitProof } from "@/lib/contracts";
import {
  type Credential,
  loadCredentials,
  saveCredential,
  removeCredential,
  parseCredential,
} from "@/lib/credential";

export default function HolderPage() {
  const [address, setAddress] = useState("");
  const [creds, setCreds] = useState<Credential[]>([]);
  const [proving, setProving] = useState<Credential | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => setCreds(loadCredentials()), []);

  return (
    <>
      <div className="between" style={{ marginBottom: "2.5rem" }}>
        <div>
          <span className="eyebrow">Holder</span>
          <h1 style={{ fontSize: "2rem", marginTop: "0.35rem" }}>Your credentials</h1>
        </div>
        <WalletButton onConnected={setAddress} />
      </div>

      <ConfigBanner />

      {proving ? (
        <ProofFlow cred={proving} holder={address} onBack={() => setProving(null)} />
      ) : (
        <div className="stack reveal" style={{ gap: "0.75rem" }}>
          {creds.length === 0 && !importing && (
            <div className="card" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
              <IconCertificate size={28} stroke={1.5} className="muted" />
              <h3 style={{ margin: "1rem 0 0.4rem" }}>No credentials yet</h3>
              <p className="muted" style={{ fontSize: "0.9rem", maxWidth: 360, margin: "0 auto" }}>
                Issue one on the Issuer page, or import a credential JSON you were
                given.
              </p>
            </div>
          )}

          {creds.map((c) => (
            <div className="card between" key={c.commitment} style={{ padding: "1.25rem 1.5rem" }}>
              <div>
                <div className="row" style={{ gap: "0.6rem" }}>
                  <span style={{ fontWeight: 500 }}>{c.title}</span>
                  <span className="mono faint">{c.claim}</span>
                </div>
                <div className="faint" style={{ fontSize: "0.8125rem", marginTop: "0.2rem" }}>
                  Issued by {c.issuer} · {truncateHash(c.commitment)}
                </div>
              </div>
              <div className="row">
                <Badge variant="verified">Held</Badge>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!address}
                  title={!address ? "Connect a wallet first" : undefined}
                  onClick={() => setProving(c)}
                >
                  Generate proof
                  <IconArrowRight size={14} />
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  title="Remove from this browser"
                  onClick={() => setCreds(removeCredential(c.commitment))}
                >
                  <IconTrash size={14} />
                </button>
              </div>
            </div>
          ))}

          {!address && creds.length > 0 && (
            <p className="faint" style={{ fontSize: "0.8125rem", marginTop: "0.25rem" }}>
              Connect a wallet to generate and submit proofs.
            </p>
          )}

          {importing ? (
            <ImportPanel
              onImport={(c) => {
                setCreds(saveCredential(c));
                setImporting(false);
              }}
              onCancel={() => setImporting(false)}
            />
          ) : (
            <button
              className="btn btn-ghost"
              style={{ alignSelf: "flex-start", marginTop: "0.5rem" }}
              onClick={() => setImporting(true)}
            >
              <IconPlus size={15} />
              Import credential
            </button>
          )}
        </div>
      )}
    </>
  );
}

function ImportPanel({
  onImport,
  onCancel,
}: {
  onImport: (c: Credential) => void;
  onCancel: () => void;
}) {
  const [json, setJson] = useState("");
  const [error, setError] = useState("");

  function onAdd() {
    try {
      onImport(parseCredential(json));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="card reveal">
      <span className="eyebrow">Import credential</span>
      <textarea
        rows={6}
        placeholder='{"type":"kyc","preimage":"0x…","commitment":"0x…", …}'
        value={json}
        onChange={(e) => setJson(e.target.value)}
        style={{ marginTop: "0.75rem" }}
      />
      {error && (
        <p style={{ color: "var(--danger)", fontSize: "0.8125rem", marginTop: "0.5rem" }}>{error}</p>
      )}
      <div className="row" style={{ marginTop: "1rem", gap: "0.6rem" }}>
        <button className="btn btn-primary btn-sm" onClick={onAdd} disabled={!json.trim()}>
          Add credential
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

type Stage = "generating" | "generated" | "submitting" | "confirmed" | "error";

function ProofFlow({
  cred,
  holder,
  onBack,
}: {
  cred: Credential;
  holder: string;
  onBack: () => void;
}) {
  const [stage, setStage] = useState<Stage>("generating");
  const [proof, setProof] = useState<{ proof: Uint8Array; publicInputs: Uint8Array } | null>(null);
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await generateProof(cred.type, {
          value: cred.value,
          salt: cred.salt,
          commitment: cred.commitment,
        });
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

  async function onSubmit() {
    if (!proof) return;
    setStage("submitting");
    try {
      const hash = await submitProof({
        holder,
        issuerId: cred.issuerId,
        credentialType: cred.type,
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
                ? "Running the Noir circuit in your browser — this can take a few seconds. Your secret never leaves this device."
                : proof
                  ? `Proof ${truncateHash("0x" + toHex(proof.proof))} · ${proof.proof.length} bytes`
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
            <div className="muted" style={{ fontSize: "0.8125rem", marginTop: "0.4rem" }}>{error}</div>
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
  return Array.from(u8.slice(0, 7))
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
          <div className="bar" style={{ marginTop: "0.6rem", maxWidth: 220 }}>
            <i />
          </div>
        )}
      </div>
    </div>
  );
}

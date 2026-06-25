"use client";

import { useState } from "react";
import {
  IconKey,
  IconArrowRight,
  IconCopy,
  IconCheck,
  IconLoader2,
} from "@tabler/icons-react";
import { WalletButton } from "@/components/WalletButton";
import { Badge } from "@/components/Badge";
import { issueCredential, saveCredential, TYPE_META } from "@/lib/credential";
import type { CredentialType } from "@/lib/stellar";

const TYPES = Object.entries(TYPE_META) as [
  CredentialType,
  (typeof TYPE_META)[CredentialType],
][];

export default function IssuerPage() {
  const [holder, setHolder] = useState("");
  const [type, setType] = useState<CredentialType>("kyc");
  const [expiry, setExpiry] = useState("90 days");
  const [issued, setIssued] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function onIssue() {
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const cred = await issueCredential({
        type,
        holder,
        issuer: "StellarCred Authority",
        expiry,
      });
      saveCredential(cred); // appears in the Holder dashboard (same browser)
      setIssued(JSON.stringify(cred, null, 2));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function onCopy() {
    if (issued) navigator.clipboard?.writeText(issued);
    setCopied(true);
  }

  return (
    <>
      <div className="between" style={{ marginBottom: "2.5rem" }}>
        <div>
          <span className="eyebrow">Issuer</span>
          <h1 style={{ fontSize: "2rem", marginTop: "0.35rem" }}>Issue a credential</h1>
        </div>
        <WalletButton />
      </div>

      <div className="grid grid-2" style={{ alignItems: "start", gap: "1.5rem" }}>
        <div className="card">
          <label className="field-label">Holder address</label>
          <input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="G…" />

          <div className="grid grid-2" style={{ marginTop: "1.25rem", gap: "1rem" }}>
            <div>
              <label className="field-label">Credential type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as CredentialType)}
              >
                {TYPES.map(([key, meta]) => (
                  <option key={key} value={key} disabled={!meta.issuable}>
                    {meta.title}
                    {meta.issuable ? "" : " (soon)"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Expiry</label>
              <select value={expiry} onChange={(e) => setExpiry(e.target.value)}>
                {["30 days", "90 days", "1 year"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="row faint" style={{ marginTop: "1.25rem", fontSize: "0.8125rem" }}>
            <IconKey size={14} />
            <span>
              A fresh secret is generated and committed with Poseidon2 — the holder
              proves it without revealing it.
            </span>
          </div>

          <button
            className="btn btn-primary"
            style={{ marginTop: "1.5rem", width: "100%" }}
            disabled={!holder || busy}
            onClick={onIssue}
          >
            {busy ? (
              <>
                <IconLoader2 size={15} className="spin" />
                Computing commitment…
              </>
            ) : (
              <>
                Sign &amp; issue
                <IconArrowRight size={15} />
              </>
            )}
          </button>
          {error && (
            <p className="badge-deny" style={{ marginTop: "0.75rem", fontSize: "0.8125rem", color: "var(--danger)" }}>
              {error}
            </p>
          )}
        </div>

        <div className="card" style={{ minHeight: 280 }}>
          <div className="between" style={{ marginBottom: "1rem" }}>
            <span className="eyebrow">Signed credential</span>
            {issued && (
              <div className="row" style={{ gap: "0.5rem" }}>
                <Badge variant="verified">Saved to wallet</Badge>
                <button className="btn btn-ghost btn-sm" onClick={onCopy}>
                  {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            )}
          </div>
          {issued ? (
            <pre
              className="mono"
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: "var(--muted)",
                lineHeight: 1.7,
                maxHeight: 360,
                overflow: "auto",
              }}
            >
              {issued}
            </pre>
          ) : (
            <div style={{ height: 200, display: "grid", placeItems: "center", textAlign: "center" }}>
              <p className="faint" style={{ maxWidth: 280, fontSize: "0.875rem" }}>
                Issue a credential to generate signed JSON. It is saved to this
                browser&rsquo;s wallet and ready to prove on the Holder page — we
                never store it server-side.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

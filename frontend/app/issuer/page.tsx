"use client";

import { useState } from "react";
import { IconKey, IconArrowRight, IconCopy, IconCheck } from "@tabler/icons-react";
import { WalletButton } from "@/components/WalletButton";
import { Badge } from "@/components/Badge";

const TYPES = ["KYC Complete", "Age Verified", "Jurisdiction Eligible", "Accredited Investor"];

export default function IssuerPage() {
  const [holder, setHolder] = useState("");
  const [type, setType] = useState(TYPES[0]);
  const [expiry, setExpiry] = useState("90 days");
  const [issued, setIssued] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function onIssue() {
    // STUB: issuer signs this with its credential key; the holder stores it
    // locally. No PII ever goes on-chain.
    const credential = {
      holder,
      type,
      issuer: "StellarCred Authority",
      expiry,
      issued_at: Math.floor(Date.now() / 1000),
      signature: "0x8b3f…c2a1",
    };
    setIssued(JSON.stringify(credential, null, 2));
    setCopied(false);
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
              <select value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
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
            <span className="mono">signing key 0x8b3f…c2a1</span>
          </div>

          <button
            className="btn btn-primary"
            style={{ marginTop: "1.5rem", width: "100%" }}
            disabled={!holder}
            onClick={onIssue}
          >
            Sign &amp; issue
            <IconArrowRight size={15} />
          </button>
        </div>

        <div className="card" style={{ minHeight: 280 }}>
          <div className="between" style={{ marginBottom: "1rem" }}>
            <span className="eyebrow">Signed credential</span>
            {issued && (
              <button className="btn btn-ghost btn-sm" onClick={onCopy}>
                {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                {copied ? "Copied" : "Copy"}
              </button>
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
              }}
            >
              {issued}
            </pre>
          ) : (
            <div
              style={{
                height: 200,
                display: "grid",
                placeItems: "center",
                textAlign: "center",
              }}
            >
              <p className="faint" style={{ maxWidth: 260, fontSize: "0.875rem" }}>
                Issue a credential to generate signed JSON for the holder to
                import. We never store it.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

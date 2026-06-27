"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconArrowRight,
  IconLoader2,
  IconCheck,
} from "@tabler/icons-react";
import { WalletButton } from "@/components/WalletButton";
import { useWallet } from "@/lib/wallet-context";
import { Badge } from "@/components/Badge";
import { saveCredential, TYPE_META, type Credential } from "@/lib/credential";
import type { CredentialType } from "@/lib/stellar";

const TYPES = Object.entries(TYPE_META) as [
  CredentialType,
  (typeof TYPE_META)[CredentialType],
][];

const DEFAULT_ATTR: Record<CredentialType, string> = {
  kyc: "",
  age: "1995-06-15",
  income: "250000",
  jurisdiction: "566",
};

const COUNTRIES = [
  { code: "566", name: "Nigeria" },
  { code: "276", name: "Germany" },
  { code: "356", name: "India" },
  { code: "840", name: "United States (restricted)" },
  { code: "364", name: "Iran (restricted)" },
];

const DEMO_ISSUER_ID = process.env.NEXT_PUBLIC_ISSUER_ADDRESS ?? "";

export default function VerifyPage() {
  const router = useRouter();
  const { address } = useWallet();
  const [type, setType] = useState<CredentialType>("kyc");
  const [attribute, setAttribute] = useState(DEFAULT_ATTR.kyc);
  const [expiry, setExpiry] = useState("90 days");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const meta = TYPE_META[type];
  const needsAttr = !!meta.attribute;

  function onType(t: CredentialType) {
    setType(t);
    setAttribute(DEFAULT_ATTR[t]);
  }

  async function onRequest() {
    if (!address) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          holder: address,
          issuerId: DEMO_ISSUER_ID || address,
          issuerName: "StellarCred Authority",
          expiry,
          attribute,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const cred = (await res.json()) as Credential;
      saveCredential(cred);
      setDone(true);
      setTimeout(() => router.push("/holder"), 1200);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="between" style={{ marginBottom: "2.5rem" }}>
        <div>
          <span className="eyebrow">Holder</span>
          <h1 style={{ fontSize: "2rem", marginTop: "0.35rem" }}>Get a credential</h1>
        </div>
        <WalletButton />
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="card">
          {!address ? (
            <div style={{ textAlign: "center", padding: "2rem 0" }}>
              <p className="muted" style={{ marginBottom: "1.25rem", fontSize: "0.9rem" }}>
                Connect your wallet to request a credential for your address.
              </p>
              <WalletButton />
            </div>
          ) : done ? (
            <div
              className="reveal"
              style={{ textAlign: "center", padding: "2rem 0" }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "var(--accent-soft)",
                  marginBottom: "1rem",
                }}
              >
                <IconCheck size={24} color="var(--accent)" stroke={2.5} />
              </span>
              <div style={{ fontWeight: 500 }}>Credential saved</div>
              <div className="muted" style={{ fontSize: "0.85rem", marginTop: "0.3rem" }}>
                Redirecting to your wallet…
              </div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: "1.25rem" }}>
                <label className="field-label">Credential type</label>
                <select value={type} onChange={(e) => onType(e.target.value as CredentialType)}>
                  {TYPES.map(([key, m]) => (
                    <option key={key} value={key}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>

              {needsAttr && (
                <div style={{ marginBottom: "1.25rem" }}>
                  <label className="field-label">{meta.attribute}</label>
                  {type === "age" ? (
                    <input
                      type="date"
                      value={attribute}
                      onChange={(e) => setAttribute(e.target.value)}
                    />
                  ) : type === "jurisdiction" ? (
                    <select
                      value={attribute}
                      onChange={(e) => setAttribute(e.target.value)}
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      value={attribute}
                      onChange={(e) => setAttribute(e.target.value)}
                    />
                  )}
                </div>
              )}

              <div style={{ marginBottom: "1.5rem" }}>
                <label className="field-label">Validity period</label>
                <select value={expiry} onChange={(e) => setExpiry(e.target.value)}>
                  {["30 days", "90 days", "1 year"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div
                className="line"
                style={{
                  marginBottom: "1.5rem",
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--radius)",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border)",
                }}
              >
                <span className="faint" style={{ fontSize: "0.8125rem" }}>
                  Issued to
                </span>
                <span className="mono" style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                  {address.slice(0, 6)}…{address.slice(-4)}
                </span>
              </div>

              <button
                className="btn btn-primary"
                style={{ width: "100%" }}
                disabled={busy || (needsAttr && !attribute)}
                onClick={onRequest}
              >
                {busy ? (
                  <>
                    <IconLoader2 size={15} className="spin" />
                    Creating credential…
                  </>
                ) : (
                  <>
                    Get credential
                    <IconArrowRight size={15} />
                  </>
                )}
              </button>

              {error && (
                <p
                  style={{
                    marginTop: "0.75rem",
                    fontSize: "0.8125rem",
                    color: "var(--danger)",
                  }}
                >
                  {error}
                </p>
              )}

              <p className="faint" style={{ marginTop: "1.25rem", fontSize: "0.8125rem", lineHeight: 1.6 }}>
                {needsAttr
                  ? `Your ${meta.attribute?.toLowerCase()} is committed with Poseidon2 and stays private. You'll prove a claim about it, not the value itself.`
                  : "A fresh identity secret is generated and committed with Poseidon2. You'll prove knowledge of it without revealing it."}
              </p>
            </>
          )}
        </div>

        {!done && address && (
          <div className="row faint" style={{ marginTop: "1rem", fontSize: "0.8125rem", justifyContent: "center" }}>
            <Badge variant="pending">Demo issuer</Badge>
            <span>Credentials are issued by the StellarCred demo key</span>
          </div>
        )}
      </div>
    </>
  );
}

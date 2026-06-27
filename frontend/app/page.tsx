import Link from "next/link";
import {
  IconArrowRight,
  IconShieldLock,
  IconFingerprint,
  IconCloudUpload,
  IconBolt,
} from "@tabler/icons-react";
import { CredentialCard } from "@/components/CredentialCard";

const STEPS = [
  {
    n: "01",
    icon: <IconFingerprint size={20} stroke={1.5} color="var(--accent)" />,
    title: "Issue",
    body: "A trusted issuer signs a credential to your wallet. It lives on your device — never on a server.",
  },
  {
    n: "02",
    icon: <IconBolt size={20} stroke={1.5} color="var(--accent)" />,
    title: "Prove",
    body: "Generate a zero-knowledge proof locally in your browser. Only the claim leaves; the data behind it never does.",
  },
  {
    n: "03",
    icon: <IconCloudUpload size={20} stroke={1.5} color="var(--accent)" />,
    title: "Verify",
    body: "Any Stellar protocol reads ProofRegistry on-chain. One proof, valid across every protocol, for 30 days.",
  },
];

const STATS = [
  { value: "4",        label: "Credential types" },
  { value: "UltraHonk", label: "ZK proof system" },
  { value: "~10s",    label: "Proof generation" },
  { value: "30 days", label: "Proof validity" },
];

export default function Home() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section
        className="reveal"
        style={{ paddingTop: "3rem" }}
      >
        {/* eyebrow chip */}
        <div style={{ marginBottom: "2rem" }}>
          <span
            className="eyebrow row"
            style={{
              display: "inline-flex",
              fontSize: "0.6rem",
              gap: "0.45rem",
              padding: "0.35rem 0.75rem",
              background: "rgba(62,207,142,0.07)",
              border: "1px solid rgba(62,207,142,0.2)",
              borderRadius: "999px",
              color: "var(--accent)",
            }}
          >
            <IconShieldLock size={13} stroke={2} />
            Zero-knowledge credentials · Stellar testnet
          </span>
        </div>

        <div
          className="grid grid-2"
          style={{ alignItems: "center", gap: "4rem" }}
        >
          {/* left: copy */}
          <div>
            <h1 style={{ marginBottom: "1.25rem" }}>
              Prove anything.{" "}
              <span className="gradient-text">Reveal&nbsp;nothing.</span>
            </h1>

            <p className="lead" style={{ maxWidth: 480, marginBottom: "2rem" }}>
              Hold a credential from a trusted issuer, generate an UltraHonk
              zero-knowledge proof locally, and verify your claim on Stellar —
              without the underlying data ever touching the chain.
            </p>

            <div className="row" style={{ gap: "0.65rem", flexWrap: "wrap" }}>
              <Link href="/verifier" className="btn btn-primary btn-lg">
                See the demo
                <IconArrowRight size={16} />
              </Link>
              <Link href="/verify" className="btn btn-secondary btn-lg">
                Get a credential
              </Link>
            </div>
          </div>

          {/* right: credential card */}
          <div style={{ display: "flex", justifyContent: "right" }}>
            <CredentialCard
              issuer="StellarCred Authority"
              type="Identity Credential"
              holder="GA7X…K3NP"
              fields={[
                { label: "KYC status",   value: "verified" },
                { label: "Age",          value: null },
                { label: "Country",      value: null },
                { label: "Income range", value: null },
              ]}
              proofHash="0x4a3f8b2c00d9e1"
              validity="valid 30 days"
            />
          </div>
        </div>

        {/* stats strip */}
        <div className="stats-strip reveal" style={{ marginTop: "3.5rem" }}>
          {STATS.map((s, i) => (
            <div key={s.label} style={{ display: "contents" }}>
              <div className="stat-item">
                <span className="stat-value gradient-text">{s.value}</span>
                <span className="stat-label">{s.label}</span>
              </div>
              {i < STATS.length - 1 && <div className="stat-divider" />}
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section style={{ marginTop: "8rem" }}>
        <div style={{ marginBottom: "2.5rem" }}>
          <p className="eyebrow" style={{ marginBottom: "0.75rem" }}>Protocol</p>
          <h2>How StellarCred works</h2>
        </div>

        <div className="grid grid-3" style={{ gap: "1.25rem" }}>
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="card card-link"
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "var(--radius-sm)",
                  background: "rgba(62,207,142,0.08)",
                  border: "1px solid rgba(62,207,142,0.18)",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                {s.icon}
              </div>
              <div>
                <p className="feature-num">{s.n}</p>
                <h3 style={{ marginBottom: "0.5rem" }}>{s.title}</h3>
                <p className="muted" style={{ fontSize: "0.9rem", lineHeight: 1.65 }}>
                  {s.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA strip ────────────────────────────────────────────────── */}
      <section style={{ marginTop: "8rem" }}>
        <div
          style={{
            padding: "3rem",
            borderRadius: "var(--radius-xl)",
            background: "linear-gradient(135deg, rgba(62,207,142,0.06) 0%, rgba(62,207,142,0.02) 100%)",
            border: "1px solid rgba(62,207,142,0.15)",
            textAlign: "center",
          }}
        >
          <h2 style={{ marginBottom: "0.75rem" }}>Ready to try it?</h2>
          <p
            className="muted"
            style={{ marginBottom: "2rem", maxWidth: 440, margin: "0 auto 2rem" }}
          >
            Connect a Freighter wallet on testnet, get a credential, generate
            your first on-chain ZK proof in under a minute.
          </p>
          <div className="row" style={{ justifyContent: "center", gap: "0.65rem", flexWrap: "wrap" }}>
            <Link href="/verify" className="btn btn-primary btn-lg">
              Get started
              <IconArrowRight size={16} />
            </Link>
            <Link href="/holder" className="btn btn-secondary btn-lg">
              Open dashboard
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

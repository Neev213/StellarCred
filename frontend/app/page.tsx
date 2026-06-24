import Link from "next/link";
import { IconArrowRight, IconShieldLock } from "@tabler/icons-react";
import { CredentialCard } from "@/components/CredentialCard";

const STEPS = [
  {
    n: "01",
    title: "Issue",
    body: "A trusted issuer signs a credential to your wallet. It lives on your device — never on a server.",
  },
  {
    n: "02",
    title: "Prove",
    body: "Generate a zero-knowledge proof locally. Only the claim leaves your browser, never the data behind it.",
  },
  {
    n: "03",
    title: "Verify",
    body: "Any Stellar protocol checks the proof on-chain. One verification, usable everywhere, for 30 days.",
  },
];

export default function Home() {
  return (
    <>
      <section
        className="grid grid-2 reveal"
        style={{ alignItems: "center", gap: "3.5rem", paddingTop: "2rem" }}
      >
        <div>
          <div className="row" style={{ marginBottom: "1.5rem" }}>
            <span className="eyebrow row" style={{ gap: "0.4rem" }}>
              <IconShieldLock size={15} stroke={1.6} />
              Zero-knowledge credentials on Stellar
            </span>
          </div>
          <h1>
            Prove anything.
            <br />
            <span className="muted">Reveal nothing.</span>
          </h1>
          <p className="lead" style={{ marginTop: "1.5rem", maxWidth: 460 }}>
            Hold a credential from a trusted issuer and prove facts from it
            on-chain — without the underlying data ever touching Stellar.
          </p>
          <div className="row" style={{ marginTop: "2rem", gap: "0.6rem" }}>
            <Link href="/verifier" className="btn btn-primary">
              See the demo
              <IconArrowRight size={15} />
            </Link>
            <Link href="/holder" className="btn btn-secondary">
              Open dashboard
            </Link>
          </div>
        </div>

        <div style={{ justifySelf: "center" }}>
          <CredentialCard
            issuer="StellarCred Authority"
            type="Identity Credential"
            holder="GA7X…K3NP"
            fields={[
              { label: "KYC status", value: "verified" },
              { label: "Age", value: null },
              { label: "Country", value: null },
              { label: "Income range", value: null },
            ]}
            proofHash="0x4a3f8b2c00d9e1"
            validity="valid 30 days"
          />
        </div>
      </section>

      <section style={{ marginTop: "7rem" }}>
        <div className="between" style={{ marginBottom: "1.5rem" }}>
          <h3 className="muted" style={{ fontWeight: 500 }}>
            How it works
          </h3>
        </div>
        <div className="grid grid-3">
          {STEPS.map((s) => (
            <div className="card" key={s.n}>
              <div className="mono faint" style={{ marginBottom: "1.25rem" }}>
                {s.n}
              </div>
              <h3 style={{ marginBottom: "0.5rem" }}>{s.title}</h3>
              <p className="muted" style={{ fontSize: "0.9rem" }}>
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

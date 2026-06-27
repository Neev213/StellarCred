import type { Metadata } from "next";
import { CONTRACTS } from "@/lib/stellar";

export const metadata: Metadata = {
  title: "Developers · StellarCred",
  description: "Integrate StellarCred in minutes — one contract call, no backend.",
};

function Code({ children }: { children: string }) {
  return (
    <pre
      style={{
        fontFamily: "var(--font-mono), monospace",
        fontSize: "0.8rem",
        background: "var(--bg-raised)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "1rem 1.25rem",
        overflowX: "auto",
        lineHeight: 1.7,
        color: "var(--muted)",
        margin: "0.75rem 0 0",
        whiteSpace: "pre",
      }}
    >
      <code style={{ color: "var(--text)" }}>{children}</code>
    </pre>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: "3rem" }}>
      <h2 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>{title}</h2>
      {children}
    </section>
  );
}

const CLAIMS: [string, string, string][] = [
  ["kyc", "Identity verified", "KYC provider"],
  ["age", "Age ≥ 18", "KYC provider"],
  ["income", "Income ≥ threshold", "Financial data provider"],
  ["jurisdiction", "Country not restricted", "KYC provider"],
];

const ADDRESSES: [string, string][] = [
  ["NEXT_PUBLIC_ISSUER_REGISTRY_ID", CONTRACTS.issuerRegistry],
  ["NEXT_PUBLIC_CREDENTIAL_VERIFIER_ID", CONTRACTS.credentialVerifier],
  ["NEXT_PUBLIC_PROOF_REGISTRY_ID", CONTRACTS.proofRegistry],
  ["NEXT_PUBLIC_GATED_POOL_ID", CONTRACTS.gatedPool],
];

export default function DevelopersPage() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <span className="eyebrow">Developers</span>
      <h1 style={{ fontSize: "2rem", marginTop: "0.35rem" }}>Integrate StellarCred</h1>

      <Section title="How it works">
        <p className="muted" style={{ fontSize: "0.95rem", lineHeight: 1.7 }}>
          StellarCred stores zero-knowledge proofs on Stellar. Your protocol
          reads them with one contract call. No API keys, no backend, no data
          handling — the only thing you trust is the on-chain ProofRegistry.
        </p>
      </Section>

      <Section title="Installation">
        <Code>{`npm install @stellarcred/sdk`}</Code>
      </Section>

      <Section title="Checking a claim">
        <p className="muted" style={{ fontSize: "0.95rem", lineHeight: 1.7 }}>
          The primary call. Returns <span className="mono">true</span> if the
          wallet has a valid, unexpired proof of the claim.
        </p>
        <Code>{`import { StellarCred } from "@stellarcred/sdk";

// In your deposit function
async function canUserDeposit(wallet: string): Promise<boolean> {
  return await StellarCred.hasClaim(wallet, "kyc");
}`}</Code>
      </Section>

      <Section title="Redirecting users to verify">
        <p className="muted" style={{ fontSize: "0.95rem", lineHeight: 1.7 }}>
          If a user hasn&rsquo;t verified yet, send them to StellarCred and get
          them back automatically.
        </p>
        <Code>{`import { StellarCred } from "@stellarcred/sdk";

// Build the return URL
const verifyUrl = StellarCred.buildVerifyUrl({
  returnUrl: 'https://yourapp.xyz/deposit',
  claim: 'kyc',
});

// Redirect the user
window.location.href = verifyUrl;

// When they return, check again:
const verified = await StellarCred.hasClaim(wallet, "kyc");`}</Code>
      </Section>

      <Section title="Available claim types">
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: "0.75rem",
            fontFamily: "var(--font-mono), monospace",
            fontSize: "0.8rem",
          }}
        >
          <thead>
            <tr>
              {["Claim", "What it proves", "Issued by"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "0.6rem 0.75rem",
                    borderBottom: "1px solid var(--border)",
                    color: "var(--faint)",
                    fontWeight: 600,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CLAIMS.map(([claim, proves, by]) => (
              <tr key={claim}>
                <td style={{ padding: "0.6rem 0.75rem", borderBottom: "1px solid var(--border)", color: "var(--accent)" }}>
                  {claim}
                </td>
                <td style={{ padding: "0.6rem 0.75rem", borderBottom: "1px solid var(--border)", color: "var(--muted)" }}>
                  {proves}
                </td>
                <td style={{ padding: "0.6rem 0.75rem", borderBottom: "1px solid var(--border)", color: "var(--muted)" }}>
                  {by}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Contract addresses">
        <p className="muted" style={{ fontSize: "0.95rem", lineHeight: 1.7 }}>
          The deployed StellarCred contracts on{" "}
          <span className="mono">{process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet"}</span>.
        </p>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: "0.75rem",
            fontFamily: "var(--font-mono), monospace",
            fontSize: "0.78rem",
          }}
        >
          <tbody>
            {ADDRESSES.map(([name, value]) => (
              <tr key={name}>
                <td style={{ padding: "0.6rem 0.75rem", borderBottom: "1px solid var(--border)", color: "var(--faint)", whiteSpace: "nowrap" }}>
                  {name}
                </td>
                <td style={{ padding: "0.6rem 0.75rem", borderBottom: "1px solid var(--border)", color: "var(--muted)", wordBreak: "break-all" }}>
                  {value || "— not configured —"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Calling the contract directly">
        <p className="muted" style={{ fontSize: "0.95rem", lineHeight: 1.7 }}>
          Prefer Soroban? Read ProofRegistry from your own contract — no SDK
          required.
        </p>
        <Code>{`// In your Soroban contract
let registry = ProofRegistryClient::new(&env, &registry_id);
let (verified, _, _) = registry.is_verified(&holder, &symbol_short!("kyc"));
require!(verified, Error::KycRequired);`}</Code>
      </Section>

      <div style={{ height: "4rem" }} />
    </div>
  );
}

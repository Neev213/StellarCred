import Link from "next/link";

export default function Home() {
  return (
    <>
      <h1>StellarCred</h1>
      <p className="muted">
        Hold a credential from a trusted issuer. Prove specific attributes on
        Stellar &mdash; without the credential data ever touching the chain.
      </p>

      <div className="panel">
        <h2>1. Issuer</h2>
        <p>
          Register as a trusted issuer and sign credentials to holder wallets.
        </p>
        <Link href="/issuer">Open issuer panel &rarr;</Link>
      </div>

      <div className="panel">
        <h2>2. Holder</h2>
        <p>
          Import a credential, generate a zero-knowledge proof locally, and
          submit it to the on-chain proof registry.
        </p>
        <Link href="/holder">Open holder dashboard &rarr;</Link>
      </div>

      <div className="panel">
        <h2>3. Verifier Demo</h2>
        <p>
          A gated DeFi pool: deposits are blocked until a valid KYC proof exists
          for your address. Access denied &rarr; access granted.
        </p>
        <Link href="/verifier">Open verifier demo &rarr;</Link>
      </div>
    </>
  );
}

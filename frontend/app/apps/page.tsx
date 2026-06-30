"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  IconLock,
  IconCheck,
  IconCircle,
  IconArrowRight,
  IconBuildingBank,
  IconCoin,
  IconId,
} from "@tabler/icons-react";
import { WalletButton } from "@/components/WalletButton";
import { useWallet } from "@/lib/wallet-context";
import { Badge } from "@/components/Badge";
import { ConfigBanner } from "@/components/ConfigBanner";
import { isVerified } from "@/lib/contracts";

interface Requirement {
  label: string;
  type: string;
}

interface Protocol {
  id: string;
  name: string;
  tagline: string;
  description: string;
  stat: { label: string; value: string; sub: string };
  requirements: Requirement[];
  verifyUrl: string;
  actionLabel: string;
  inputLabel: string;
  inputDefault: string;
  icon: React.ReactNode;
}

const PROTOCOLS: Protocol[] = [
  {
    id: "lendfi",
    name: "LendFi",
    tagline: "Institutional DeFi Lending",
    description:
      "Undercollateralised lending for verified institutional participants. Requires full KYC, age, and accreditation proofs.",
    stat: { label: "Total value locked", value: "$124,800", sub: "USDC · stellar:testnet" },
    requirements: [
      { label: "KYC verified", type: "kyc" },
      { label: "Age ≥ 18", type: "age" },
      { label: "Accredited investor", type: "income" },
    ],
    verifyUrl: "/verify?return_url=/apps&claim=kyc",
    actionLabel: "Deposit",
    inputLabel: "Amount (USDC)",
    inputDefault: "5,000",
    icon: <IconBuildingBank size={18} stroke={1.6} />,
  },
  {
    id: "fundvault",
    name: "FundVault",
    tagline: "Institutional Yield Pool",
    description:
      "Fixed-rate yield vault for participants who can prove minimum liquid reserves. Balance is verified directly from your bank — nothing is disclosed on-chain.",
    stat: { label: "Current APY", value: "8.4%", sub: "30-day trailing average" },
    requirements: [{ label: "Balance ≥ $10,000", type: "funds" }],
    verifyUrl: "/verify?return_url=/apps&claim=funds&threshold=10000",
    actionLabel: "Deposit",
    inputLabel: "Amount (USDC)",
    inputDefault: "10,000",
    icon: <IconCoin size={18} stroke={1.6} />,
  },
  {
    id: "agegate",
    name: "AgeGate",
    tagline: "21+ Regulated Markets",
    description:
      "Access to regulated derivatives and structured products restricted to verified adults. Age is proved from a ZK commitment — your date of birth is never revealed.",
    stat: { label: "Eligible instruments", value: "47", sub: "regulated derivatives" },
    requirements: [
      { label: "Age ≥ 21", type: "age" },
      { label: "KYC verified", type: "kyc" },
    ],
    verifyUrl: "/verify?return_url=/apps&claim=age&threshold_years=21",
    actionLabel: "Access markets",
    inputLabel: "Notional value (USD)",
    inputDefault: "25,000",
    icon: <IconId size={18} stroke={1.6} />,
  },
];

function ProtocolCard({
  protocol,
  activeWallet,
  scVerified,
  inputValue,
  onInputChange,
}: {
  protocol: Protocol;
  activeWallet: string | null;
  scVerified: boolean;
  inputValue: string;
  onInputChange: (v: string) => void;
}) {
  const [statuses, setStatuses] = useState<boolean[]>(protocol.requirements.map(() => false));
  const [checked, setChecked] = useState(false);
  const eligible = statuses.every(Boolean);

  useEffect(() => {
    if (!activeWallet) {
      setChecked(false);
      setStatuses(protocol.requirements.map(() => false));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.all(
          protocol.requirements.map((r) => isVerified(activeWallet, r.type)),
        );
        if (!cancelled) setStatuses(results.map((s) => s.valid));
      } catch {
        // contracts not deployed — requirements stay unmet
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeWallet, protocol.requirements]);

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Header */}
      <div className="between" style={{ marginBottom: "0.35rem" }}>
        <span
          className="row"
          style={{
            gap: "0.5rem",
            color: "var(--accent)",
            fontWeight: 600,
            fontSize: "1.1rem",
          }}
        >
          {protocol.icon}
          {protocol.name}
        </span>
        {checked ? (
          eligible ? (
            <Badge variant="verified">Access granted</Badge>
          ) : (
            <Badge variant="denied">Locked</Badge>
          )
        ) : null}
      </div>
      <p className="mono faint" style={{ fontSize: "0.72rem", marginBottom: "0.9rem" }}>
        {protocol.tagline}
      </p>

      <p className="muted" style={{ fontSize: "0.8125rem", lineHeight: 1.6, marginBottom: "1.25rem" }}>
        {protocol.description}
      </p>

      {/* Stat */}
      <div
        style={{
          padding: "0.65rem 0.9rem",
          borderRadius: "var(--radius)",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid var(--border)",
          marginBottom: "1.25rem",
        }}
      >
        <div className="faint" style={{ fontSize: "0.72rem", marginBottom: "0.2rem" }}>
          {protocol.stat.label}
        </div>
        <div style={{ fontWeight: 600, fontSize: "1.5rem", letterSpacing: "-0.03em" }}>
          {protocol.stat.value}
        </div>
        <div className="mono faint" style={{ fontSize: "0.7rem" }}>
          {protocol.stat.sub}
        </div>
      </div>

      {/* Eligibility */}
      <div className="eyebrow" style={{ marginBottom: "0.4rem" }}>
        Requirements
      </div>
      <div className="stack" style={{ marginBottom: "1.25rem" }}>
        {protocol.requirements.map((r, i) => (
          <div className="line" key={r.label}>
            <span className="row" style={{ gap: "0.6rem" }}>
              {statuses[i] ? (
                <IconCheck size={15} color="var(--accent)" stroke={2.5} />
              ) : (
                <IconCircle size={15} color="var(--faint)" />
              )}
              <span style={{ fontSize: "0.875rem", color: statuses[i] ? "var(--text)" : "var(--muted)" }}>
                {r.label}
              </span>
            </span>
            {statuses[i] ? (
              <Badge variant="verified">Proved</Badge>
            ) : (
              <Badge variant="pending">Needed</Badge>
            )}
          </div>
        ))}
      </div>

      {/* Divider */}
      <hr className="divider" />

      {/* Action */}
      <label className="field-label">{protocol.inputLabel}</label>
      <input
        value={inputValue}
        onChange={(e) => onInputChange(e.target.value)}
        disabled={!eligible}
        style={{ opacity: eligible ? 1 : 0.5 }}
      />

      <button
        className="btn btn-primary"
        style={{
          marginTop: "0.9rem",
          width: "100%",
          opacity: eligible ? 1 : 0.45,
          transition: "opacity 0.4s var(--ease)",
        }}
        disabled={!eligible}
      >
        {eligible ? (
          protocol.actionLabel
        ) : (
          <>
            <IconLock size={14} />
            Prove eligibility first
          </>
        )}
      </button>

      {/* CTA when not eligible */}
      {checked && !eligible && (
        <Link
          href={protocol.verifyUrl}
          className="btn btn-secondary btn-sm"
          style={{ marginTop: "0.6rem", width: "100%" }}
        >
          Get verified
          <IconArrowRight size={13} />
        </Link>
      )}

      {eligible && scVerified && (
        <p className="faint" style={{ marginTop: "0.75rem", fontSize: "0.8rem", lineHeight: 1.6 }}>
          {protocol.name} read <span className="mono" style={{ fontSize: "0.72rem" }}>ProofRegistry.is_verified</span> and found
          valid proofs. No personal data was shared.
        </p>
      )}

      {!activeWallet && (
        <p className="faint" style={{ marginTop: "0.75rem", fontSize: "0.8rem" }}>
          Connect your wallet to check eligibility.
        </p>
      )}
    </div>
  );
}

function AppsInner() {
  const { address } = useWallet();
  const searchParams = useSearchParams();

  const scVerified = searchParams.get("sc_verified") === "true";
  const scWallet = searchParams.get("sc_wallet");
  const activeWallet = address ?? scWallet ?? null;

  const [inputs, setInputs] = useState<Record<string, string>>(
    Object.fromEntries(PROTOCOLS.map((p) => [p.id, p.inputDefault])),
  );

  return (
    <>
      <div className="between" style={{ marginBottom: "2rem" }}>
        <div>
          <span className="eyebrow">Demo protocols</span>
          <h1 style={{ fontSize: "2rem", marginTop: "0.35rem" }}>Apps</h1>
        </div>
        <WalletButton />
      </div>

      <div
        style={{
          marginBottom: "1.75rem",
          padding: "0.75rem 1rem",
          borderRadius: "var(--radius)",
          background: "rgba(62,207,142,0.05)",
          border: "1px solid rgba(62,207,142,0.15)",
          fontSize: "0.8125rem",
          color: "var(--muted)",
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: "var(--text)" }}>Any protocol, any claim.</strong>{" "}
        Each app below gates access on a different credential type — one read-only call to{" "}
        <span className="mono" style={{ fontSize: "0.75rem" }}>ProofRegistry.is_verified</span>.
        The protocol never sees the credential, the commitment, or the proof itself.
      </div>

      {scVerified && (
        <div
          className="reveal"
          style={{
            marginBottom: "1.5rem",
            padding: "0.85rem 1rem",
            borderRadius: "var(--radius)",
            background: "rgba(62,207,142,0.08)",
            border: "1px solid rgba(62,207,142,0.35)",
            fontSize: "0.875rem",
            color: "var(--text)",
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
          }}
        >
          <IconCheck size={18} color="var(--accent)" stroke={2.5} />
          <span>
            <strong>Verification complete.</strong>{" "}
            <span className="muted">You were returned here from StellarCred automatically.</span>
          </span>
        </div>
      )}

      <ConfigBanner />

      <div className="grid grid-3" style={{ alignItems: "start", gap: "1.25rem" }}>
        {PROTOCOLS.map((p) => (
          <ProtocolCard
            key={p.id}
            protocol={p}
            activeWallet={activeWallet}
            scVerified={scVerified}
            inputValue={inputs[p.id]}
            onInputChange={(v) => setInputs((prev) => ({ ...prev, [p.id]: v }))}
          />
        ))}
      </div>

      <p className="faint" style={{ marginTop: "2rem", fontSize: "0.8rem", textAlign: "center", lineHeight: 1.6 }}>
        Go to <Link href="/holder" style={{ color: "var(--muted)" }}>Wallet</Link> to generate proofs from your credentials, then return here to unlock access.
      </p>
    </>
  );
}

export default function AppsPage() {
  return (
    <Suspense fallback={null}>
      <AppsInner />
    </Suspense>
  );
}

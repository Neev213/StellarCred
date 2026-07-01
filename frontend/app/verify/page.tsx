"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IconArrowRight,
  IconLoader2,
  IconCheck,
  IconBuildingBank,
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

const COUNTRIES = [
  { code: "566", name: "Nigeria" },
  { code: "276", name: "Germany" },
  { code: "356", name: "India" },
  { code: "840", name: "United States (restricted)" },
  { code: "364", name: "Iran (restricted)" },
];

const DEMO_ISSUER_ID = process.env.NEXT_PUBLIC_ISSUER_ADDRESS ?? "";

const VALID_CLAIMS = TYPES.map(([k]) => k);

function VerifyInner() {
  const router = useRouter();
  const { address } = useWallet();
  const searchParams = useSearchParams();

  // When a protocol redirects here it can specify where to send the user back
  // (return_url) and exactly which claim it requires (claim). A required claim
  // locks the selector — the user can't pick something the protocol didn't ask
  // for.
  const returnUrl = searchParams.get("return_url");
  const claimParam = searchParams.get("claim") as CredentialType | null;
  const requiredClaim = claimParam && VALID_CLAIMS.includes(claimParam) ? claimParam : null;
  const locked = !!requiredClaim;

  // Protocol-supplied proof parameters. These flow into the issued credential
  // so the witness route can use them at prove time instead of hardcoded values.
  const claimParamsFromUrl = {
    threshold_years: searchParams.get("threshold_years") ?? undefined,
    threshold: searchParams.get("threshold") ?? undefined,
    restricted: searchParams.get("restricted")?.split(",").filter(Boolean) ?? undefined,
  };

  // Multi-select: one verification can issue several credentials at once.
  const [selected, setSelected] = useState<CredentialType[]>(
    requiredClaim ? [requiredClaim] : [],
  );
  const [attributes, setAttributes] = useState<Record<string, string>>({
    date_of_birth: "1995-06-15",
    income: "250000",
    country_code: "566",
  });
  const [expiry, setExpiry] = useState("90 days");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [plaidBalance, setPlaidBalance] = useState<number | null>(null);
  const [plaidAccounts, setPlaidAccounts] = useState<{ name: string; available: number }[]>([]);
  const [plaidMock, setPlaidMock] = useState(false);

  const fundsSelected = selected.includes("funds");
  useEffect(() => {
    if (!fundsSelected) return;
    setPlaidBalance(null);
    fetch("/api/plaid-balance")
      .then((r) => r.json())
      .then((d: { balance?: number; accounts?: { name: string; available: number }[]; mock?: boolean; error?: string }) => {
        if (d.balance !== undefined) {
          setPlaidBalance(d.balance);
          setPlaidAccounts(d.accounts ?? []);
          setPlaidMock(!!d.mock);
        }
      })
      .catch(() => {});
  }, [fundsSelected]);

  function setAttr(key: string, val: string) {
    setAttributes((a) => ({ ...a, [key]: val }));
  }

  function toggle(t: CredentialType) {
    if (locked) return; // protocol-required claim — selection is fixed
    setSelected((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));
  }

  // Where the user is sent after a successful issue.
  function redirectAfterIssue() {
    if (returnUrl && address) {
      // Resolve against the current origin so relative ("/verifier") and
      // absolute ("https://app.xyz/deposit") return URLs both work.
      const dest = new URL(returnUrl, window.location.origin);
      dest.searchParams.set("sc_verified", "true");
      dest.searchParams.set("sc_wallet", address);
      if (dest.origin === window.location.origin) {
        router.push(dest.pathname + dest.search);
      } else {
        // Never router.push an external URL — do a real browser navigation.
        window.location.href = dest.toString();
      }
    } else {
      router.push("/holder");
    }
  }

  // Display label for the "Returning to …" message: path for same-origin
  // (relative) return URLs, hostname for absolute external ones.
  let returnLabel = "";
  if (returnUrl) {
    if (returnUrl.startsWith("/")) {
      returnLabel = returnUrl;
    } else {
      try {
        returnLabel = new URL(returnUrl).hostname;
      } catch {
        returnLabel = returnUrl;
      }
    }
  }

  async function onRequest() {
    if (!address || selected.length === 0) return;
    setBusy(true);
    setError("");
    try {
      if (!DEMO_ISSUER_ID) {
        throw new Error("NEXT_PUBLIC_ISSUER_ADDRESS is not set — cannot issue credentials");
      }
      const res = await fetch("/api/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credential_types: selected,
          holder: address,
          issuerId: DEMO_ISSUER_ID,
          issuerName: "StellarCred Authority",
          expiry,
          attributes,
          claimParams: claimParamsFromUrl,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
          smileid?: { code: string; text: string };
        } | null;
        if (data?.smileid) {
          console.error("[SmileID]", data.smileid.code, data.smileid.text);
        }
        throw new Error(data?.error ?? "Issuing failed");
      }
      const { credentials } = (await res.json()) as { credentials: Credential[] };
      credentials.forEach((c) => saveCredential(c));
      setDone(true);
      setTimeout(redirectAfterIssue, 1500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="between" style={{ marginBottom: "2rem" }}>
        <div>
          <span className="eyebrow">Demo</span>
          <h1 style={{ fontSize: "2rem", marginTop: "0.35rem" }}>Get verified</h1>
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
        <strong style={{ color: "var(--text)" }}>Demo shortcut.</strong>{" "}
        In production, credentials come from a real issuer&rsquo;s portal after off-chain verification —
        KYC provider, bank, government, etc. This page simulates that by self-issuing directly to
        your connected wallet. Pick every claim you want — one verification issues them all.
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div className="card">
          {!address ? (
            <div style={{ textAlign: "center", padding: "2rem 0" }}>
              <p className="muted" style={{ marginBottom: "1.25rem", fontSize: "0.9rem" }}>
                Connect your wallet to request credentials for your address.
              </p>
              <WalletButton />
            </div>
          ) : done ? (
            <div className="reveal" style={{ textAlign: "center", padding: "2rem 0" }}>
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
              <div style={{ fontWeight: 500 }}>
                {returnUrl
                  ? "Verified"
                  : `${selected.length} credential${selected.length > 1 ? "s" : ""} saved`}
              </div>
              <div className="muted" style={{ fontSize: "0.85rem", marginTop: "0.3rem" }}>
                {returnUrl
                  ? `Returning to ${returnLabel}…`
                  : "Credential saved — redirecting to your wallet…"}
              </div>
            </div>
          ) : (
            <>
              <label className="field-label">Claims to verify</label>
              {locked && (
                <p className="faint" style={{ fontSize: "0.8125rem", margin: "0.4rem 0 0" }}>
                  A protocol requested the <strong style={{ color: "var(--accent)" }}>{requiredClaim}</strong> claim — selection is locked.
                </p>
              )}
              <div className="stack" style={{ gap: "0.5rem", marginTop: "0.5rem", marginBottom: "1.25rem" }}>
                {TYPES.map(([key, m]) => {
                  const on = selected.includes(key);
                  // When locked, hide everything except the required claim.
                  if (locked && key !== requiredClaim) return null;
                  return (
                    <div
                      key={key}
                      onClick={() => toggle(key)}
                      style={{
                        padding: "0.75rem 0.9rem",
                        borderRadius: "var(--radius)",
                        border: `1px solid ${on ? "rgba(62,207,142,0.4)" : "var(--border)"}`,
                        background: on ? "rgba(62,207,142,0.05)" : "transparent",
                        cursor: locked ? "default" : "pointer",
                        transition: "border-color 0.2s var(--ease), background 0.2s var(--ease)",
                      }}
                    >
                      <div className="between" style={{ alignItems: "center" }}>
                        <span className="row" style={{ gap: "0.6rem" }}>
                          <span
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 5,
                              display: "grid",
                              placeItems: "center",
                              border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
                              background: on ? "var(--accent)" : "transparent",
                              flexShrink: 0,
                            }}
                          >
                            {on && <IconCheck size={12} color="#0a0a0a" stroke={3} />}
                          </span>
                          <span style={{ fontWeight: 500, fontSize: "0.9rem" }}>{m.title}</span>
                        </span>
                        <span className="mono faint" style={{ fontSize: "0.72rem" }}>
                          {key === "funds" && claimParamsFromUrl.threshold
                            ? `balance > $${Number(claimParamsFromUrl.threshold).toLocaleString("en-US")}`
                            : key === "age" && claimParamsFromUrl.threshold_years
                              ? `age ≥ ${claimParamsFromUrl.threshold_years}`
                              : key === "income" && claimParamsFromUrl.threshold
                                ? `income > $${Number(claimParamsFromUrl.threshold).toLocaleString("en-US")}`
                                : m.claim}
                        </span>
                      </div>

                      {/* KYC needs identity fields for the SmileID check. These
                          are sent once to verify identity and never stored. */}
                      {on && key === "kyc" && (
                        <div
                          className="stack"
                          style={{ marginTop: "0.75rem", gap: "0.6rem" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="grid grid-2" style={{ gap: "0.6rem" }}>
                            <div>
                              <label className="field-label">First name</label>
                              <input
                                value={attributes.first_name ?? ""}
                                onChange={(e) => setAttr("first_name", e.target.value)}
                                placeholder="Ada"
                              />
                            </div>
                            <div>
                              <label className="field-label">Last name</label>
                              <input
                                value={attributes.last_name ?? ""}
                                onChange={(e) => setAttr("last_name", e.target.value)}
                                placeholder="Lovelace"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="field-label">ID Number (NIN, passport, etc.)</label>
                            <input
                              value={attributes.id_number ?? ""}
                              onChange={(e) => setAttr("id_number", e.target.value)}
                              placeholder="00000000000"
                            />
                          </div>
                          <p className="faint" style={{ fontSize: "0.75rem", margin: 0 }}>
                            Used once to verify your identity with the KYC provider. Never stored.
                          </p>
                        </div>
                      )}

                      {/* Per-claim attribute input, revealed when selected */}
                      {on && key === "age" && (
                        <div style={{ marginTop: "0.75rem" }} onClick={(e) => e.stopPropagation()}>
                          <label className="field-label">{m.attribute}</label>
                          <input
                            type="date"
                            value={attributes.date_of_birth}
                            onChange={(e) => setAttr("date_of_birth", e.target.value)}
                          />
                        </div>
                      )}
                      {on && key === "income" && (
                        <div style={{ marginTop: "0.75rem" }} onClick={(e) => e.stopPropagation()}>
                          <label className="field-label">{m.attribute}</label>
                          <input
                            type="number"
                            value={attributes.income}
                            onChange={(e) => setAttr("income", e.target.value)}
                          />
                        </div>
                      )}
                      {on && key === "funds" && (
                        <div style={{ marginTop: "0.75rem" }} onClick={(e) => e.stopPropagation()}>
                          {plaidBalance === null ? (
                            <p className="faint" style={{ fontSize: "0.75rem", margin: 0, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                              <IconLoader2 size={12} className="spin" />
                              Reading balance from Plaid…
                            </p>
                          ) : (
                            <div
                              style={{
                                padding: "0.65rem 0.9rem",
                                borderRadius: "var(--radius)",
                                background: "rgba(62,207,142,0.05)",
                                border: "1px solid rgba(62,207,142,0.2)",
                              }}
                            >
                              <div className="between" style={{ alignItems: "center", marginBottom: plaidAccounts.length > 1 ? "0.5rem" : 0 }}>
                                <span className="row" style={{ gap: "0.4rem", fontSize: "0.75rem", color: "var(--faint)" }}>
                                  <IconBuildingBank size={12} stroke={1.6} />
                                  {plaidMock ? "Mock balance" : "Verified balance (Plaid)"}
                                </span>
                                <span style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text)" }}>
                                  ${plaidBalance.toLocaleString("en-US")}
                                </span>
                              </div>
                              {plaidAccounts.length > 1 && (
                                <div className="stack" style={{ gap: "0.2rem" }}>
                                  {plaidAccounts.map((a) => (
                                    <div key={a.name} className="between" style={{ fontSize: "0.72rem" }}>
                                      <span className="faint">{a.name}</span>
                                      <span className="mono" style={{ color: "var(--muted)" }}>${a.available.toLocaleString("en-US")}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <hr style={{ margin: "0.5rem 0", borderColor: "rgba(62,207,142,0.15)" }} />
                              <div className="between" style={{ alignItems: "center" }}>
                                <span className="faint" style={{ fontSize: "0.72rem" }}>
                                  Proof will certify
                                </span>
                                <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--accent)" }}>
                                  balance ≥ ${Number(claimParamsFromUrl.threshold ?? "10000").toLocaleString("en-US")}
                                </span>
                              </div>
                              <p className="faint" style={{ fontSize: "0.72rem", margin: "0.35rem 0 0" }}>
                                Your exact balance is never stored or revealed on-chain — only this threshold is public.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                      {on && key === "jurisdiction" && (
                        <div style={{ marginTop: "0.75rem" }} onClick={(e) => e.stopPropagation()}>
                          <label className="field-label">{m.attribute}</label>
                          <select
                            value={attributes.country_code}
                            onChange={(e) => setAttr("country_code", e.target.value)}
                          >
                            {COUNTRIES.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.name} ({c.code})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

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
                disabled={busy || selected.length === 0}
                onClick={onRequest}
              >
                {busy ? (
                  <>
                    <IconLoader2 size={15} className="spin" />
                    Creating {selected.length} credential{selected.length > 1 ? "s" : ""}…
                  </>
                ) : (
                  <>
                    Get {selected.length} credential{selected.length > 1 ? "s" : ""}
                    <IconArrowRight size={15} />
                  </>
                )}
              </button>

              {error && (
                <p style={{ marginTop: "0.75rem", fontSize: "0.8125rem", color: "var(--danger)" }}>
                  {error}
                </p>
              )}

              <p className="faint" style={{ marginTop: "1.25rem", fontSize: "0.8125rem", lineHeight: 1.6 }}>
                Each claim is committed with Poseidon2 and stays private. You prove a statement about
                it — never the underlying value.
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

// useSearchParams() must be inside a Suspense boundary in the App Router.
export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  );
}

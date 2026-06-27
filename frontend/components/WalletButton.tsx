"use client";

import { IconWallet, IconChevronDown } from "@tabler/icons-react";
import { useWallet } from "@/lib/wallet-context";
import { truncateAddress } from "@/lib/format";

export function WalletButton() {
  const { address, connecting, error, connect, disconnect } = useWallet();

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.35rem" }}>
      <button
        className={`btn ${address ? "btn-secondary" : "btn-primary"}`}
        onClick={address ? disconnect : connect}
        disabled={connecting}
        title={address ? "Click to disconnect" : undefined}
        style={address ? { fontFamily: "var(--font-mono), monospace", fontSize: "0.8rem" } : undefined}
      >
        <IconWallet size={14} />
        {address ? (
          <>
            {truncateAddress(address)}
            <IconChevronDown size={13} style={{ opacity: 0.5 }} />
          </>
        ) : connecting ? (
          "Connecting…"
        ) : (
          "Connect wallet"
        )}
      </button>
      {error && (
        <span
          className="mono"
          style={{
            color: "var(--danger)",
            fontSize: "0.7rem",
            maxWidth: 260,
            textAlign: "right",
            lineHeight: 1.4,
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}

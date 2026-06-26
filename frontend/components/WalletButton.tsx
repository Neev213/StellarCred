"use client";

import { IconWallet } from "@tabler/icons-react";
import { useWallet } from "@/lib/wallet-context";
import { truncateAddress } from "@/lib/format";

export function WalletButton() {
  const { address, connecting, error, connect, disconnect } = useWallet();

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem" }}>
      <button
        className={`btn ${address ? "btn-secondary" : "btn-primary"}`}
        onClick={address ? disconnect : connect}
        disabled={connecting}
        title={address ? "Click to disconnect" : undefined}
      >
        <IconWallet size={15} />
        {address
          ? truncateAddress(address)
          : connecting
            ? "Connecting…"
            : "Connect wallet"}
      </button>
      {error && (
        <span
          className="mono"
          style={{ color: "var(--danger)", fontSize: "0.7rem", maxWidth: 260, textAlign: "right" }}
        >
          {error}
        </span>
      )}
    </div>
  );
}

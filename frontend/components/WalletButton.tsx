"use client";

import { useState } from "react";
import { IconWallet } from "@tabler/icons-react";
import { connect } from "@/lib/wallet";
import { truncateAddress } from "@/lib/format";

export function WalletButton({
  onConnected,
}: {
  onConnected?: (address: string) => void;
}) {
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (address) return;
    setBusy(true);
    try {
      const addr = await connect();
      setAddress(addr);
      onConnected?.(addr);
    } catch {
      // dismissed
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className={`btn ${address ? "btn-secondary" : "btn-primary"}`}
      onClick={onClick}
      disabled={busy}
    >
      <IconWallet size={15} />
      {address
        ? truncateAddress(address)
        : busy
          ? "Connecting…"
          : "Connect wallet"}
    </button>
  );
}
